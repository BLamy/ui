/* Spreadsheet's WebGPU compute: a bitonic sort of exact 64-bit keys and a column histogram. lib/spreadsheet decides
   when to call these (and has the CPU versions, which return the same answers); nothing here is reached without a
   WebGPU adapter. One device is shared by every Spreadsheet on the page and jobs run one at a time.

   Sort: each element is (key high, key low, row index), padded to a power of two with keys that sort last. Every
   (k, j) step of the bitonic network is one dispatch in a single compute pass — WebGPU orders the dispatches, so no
   round trip to the CPU between them — with the step read from a uniform at a dynamic offset. The row index breaks
   ties, so equal keys keep their original order and the result equals the CPU's stable sort exactly.

   Histogram: one thread per value; each workgroup tallies into shared memory and adds its tally to the output once,
   so the global atomics see one add per bin per workgroup rather than one per value.

   The WebGPU types are declared locally (the slice this file uses), so it compiles without @webgpu/types. */

import { navigatorGpu } from '@/lib/webgpu';

interface GpuBuffer {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}
interface GpuPass {
  setPipeline(pipeline: unknown): void;
  setBindGroup(index: number, group: unknown, dynamicOffsets?: number[]): void;
  dispatchWorkgroups(x: number, y?: number): void;
  end(): void;
}
interface GpuEncoder {
  beginComputePass(): GpuPass;
  copyBufferToBuffer(src: GpuBuffer, srcOffset: number, dst: GpuBuffer, dstOffset: number, size: number): void;
  finish(): unknown;
}
interface GpuDevice {
  lost: Promise<unknown>;
  limits: { maxStorageBufferBindingSize: number; maxComputeWorkgroupsPerDimension: number; minUniformBufferOffsetAlignment: number };
  queue: { writeBuffer(buffer: GpuBuffer, offset: number, data: ArrayBufferView): void; submit(commands: unknown[]): void };
  createBuffer(descriptor: { size: number; usage: number }): GpuBuffer;
  createShaderModule(descriptor: { code: string }): unknown;
  createBindGroupLayout(descriptor: unknown): unknown;
  createPipelineLayout(descriptor: unknown): unknown;
  createComputePipeline(descriptor: unknown): unknown;
  createBindGroup(descriptor: unknown): unknown;
  createCommandEncoder(): GpuEncoder;
  destroy(): void;
}
interface GpuAdapter {
  limits: { maxStorageBufferBindingSize: number; maxBufferSize: number };
  requestDevice(descriptor?: unknown): Promise<GpuDevice>;
}

// GPUBufferUsage / GPUShaderStage / GPUMapMode flag values from the WebGPU spec.
const MAP_READ = 0x0001;
const COPY_SRC = 0x0004;
const COPY_DST = 0x0008;
const UNIFORM = 0x0040;
const STORAGE = 0x0080;
const COMPUTE = 0x4;

const WORKGROUP = 256;

const SORT_WGSL = /* wgsl */ `
struct Step { j: u32, k: u32, n: u32, width: u32 }
@group(0) @binding(0) var<storage, read_write> data: array<vec4<u32>>;
@group(0) @binding(1) var<uniform> step: Step;

fn before(a: vec4<u32>, b: vec4<u32>) -> bool {
  if (a.x != b.x) { return a.x < b.x; }
  if (a.y != b.y) { return a.y < b.y; }
  return a.z < b.z;
}

@compute @workgroup_size(${WORKGROUP})
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x + id.y * step.width;
  if (i >= step.n) { return; }
  let l = i ^ step.j;
  if (l <= i) { return; }
  let a = data[i];
  let b = data[l];
  // Ascending within blocks where bit k of i is clear, descending where it is set.
  if (before(b, a) == ((i & step.k) == 0u)) {
    data[i] = b;
    data[l] = a;
  }
}`;

const HISTOGRAM_WGSL = /* wgsl */ `
struct Params { min: f32, scale: f32, n: u32, bins: u32, width: u32 }
@group(0) @binding(0) var<storage, read> values: array<f32>;
@group(0) @binding(1) var<storage, read_write> bins: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> p: Params;
var<workgroup> tally: array<atomic<u32>, 64>;

@compute @workgroup_size(${WORKGROUP})
fn main(@builtin(global_invocation_id) id: vec3<u32>, @builtin(local_invocation_index) local: u32) {
  if (local < 64u) { atomicStore(&tally[local], 0u); }
  workgroupBarrier();
  let i = id.x + id.y * p.width;
  if (i < p.n) {
    let scaled = floor((values[i] - p.min) * p.scale);
    let b = u32(clamp(scaled, 0.0, f32(p.bins - 1u)));
    atomicAdd(&tally[b], 1u);
  }
  workgroupBarrier();
  if (local < p.bins) {
    let count = atomicLoad(&tally[local]);
    if (count > 0u) { atomicAdd(&bins[local], count); }
  }
}`;

interface Gpu {
  device: GpuDevice;
  sort: { pipeline: unknown; layout: unknown };
  histogram: { pipeline: unknown; layout: unknown };
}

let gpuPromise: Promise<Gpu> | null = null;
/** 8M rows of 16 bytes is 128 MiB, WebGPU's default binding limit; a device with less lowers it. */
let gpuLimit = 1 << 23;
let queue: Promise<unknown> = Promise.resolve();

function pipeline(device: GpuDevice, code: string, entries: unknown[]) {
  const layout = device.createBindGroupLayout({ entries });
  return {
    layout,
    pipeline: device.createComputePipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      compute: { module: device.createShaderModule({ code }), entryPoint: 'main' },
    }),
  };
}

function loadGpu(): Promise<Gpu> {
  return (gpuPromise ??= (async () => {
    const gpu = navigatorGpu() as unknown as { requestAdapter(o?: unknown): Promise<GpuAdapter | null> } | undefined;
    const adapter = await gpu?.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('WebGPU unavailable');
    // Ask for as much of one buffer as the adapter allows, so big columns sort in one piece.
    const binding = Math.min(adapter.limits.maxStorageBufferBindingSize, adapter.limits.maxBufferSize, 1 << 30);
    const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: binding, maxBufferSize: binding } });
    void device.lost.then(() => { gpuPromise = null; });
    const storage = (type: 'storage' | 'read-only-storage') => ({ visibility: COMPUTE, buffer: { type } });
    const result: Gpu = {
      device,
      sort: pipeline(device, SORT_WGSL, [
        { binding: 0, ...storage('storage') },
        { binding: 1, visibility: COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
      ]),
      histogram: pipeline(device, HISTOGRAM_WGSL, [
        { binding: 0, ...storage('read-only-storage') },
        { binding: 1, ...storage('storage') },
        { binding: 2, visibility: COMPUTE, buffer: { type: 'uniform' } },
      ]),
    };
    gpuLimit = Math.min(1 << 23, 2 ** Math.floor(Math.log2(device.limits.maxStorageBufferBindingSize / 16)));
    return result;
  })().catch((e: unknown) => { gpuPromise = null; throw e; }));
}

/** The most rows the GPU sorts in one piece (past it, the CPU sorts). */
export const gpuSortLimit = () => gpuLimit;

/** Drop the shared device (after an error); the next job asks for a new one. */
export function resetSpreadsheetGpu() {
  const pending = gpuPromise;
  gpuPromise = null;
  void pending?.then((g) => g.device.destroy(), () => undefined);
}

/** Jobs share the device and run one at a time. */
function enqueue<T>(job: (gpu: Gpu) => Promise<T>): Promise<T> {
  const run = queue.then(() => loadGpu()).then(job);
  queue = run.catch(() => undefined);
  return run;
}

/** Workgroups for `n` threads, as (x, y) under the per-dimension limit. */
function grid(device: GpuDevice, n: number) {
  const groups = Math.ceil(n / WORKGROUP);
  const max = device.limits.maxComputeWorkgroupsPerDimension;
  const x = Math.min(groups, max);
  return { x, y: Math.ceil(groups / x), width: x * WORKGROUP };
}

async function readBack(device: GpuDevice, source: GpuBuffer, size: number, encoder: GpuEncoder) {
  const read = device.createBuffer({ size, usage: MAP_READ | COPY_DST });
  encoder.copyBufferToBuffer(source, 0, read, 0, size);
  device.queue.submit([encoder.finish()]);
  await read.mapAsync(MAP_READ);
  const out = new Uint32Array(read.getMappedRange().slice(0));
  read.unmap();
  read.destroy();
  return out;
}

/** The stable permutation that sorts `keys` ((high, low) pairs from `sortKeys`), computed on the GPU. */
export function gpuSortPermutation(keys: Uint32Array): Promise<Uint32Array> {
  const n = keys.length / 2;
  if (n < 2) return Promise.resolve(Uint32Array.from({ length: n }, (_, i) => i));
  return enqueue(async ({ device, sort }) => {
    let size = 1;
    while (size < n) size *= 2;
    if (size > gpuLimit) throw new Error(`${n} rows is past the GPU sort's ${gpuLimit}`);
    const items = new Uint32Array(size * 4);
    for (let i = 0; i < size; i++) {
      const o = i * 4;
      if (i < n) { items[o] = keys[2 * i]; items[o + 1] = keys[2 * i + 1]; items[o + 2] = i; }
      else { items[o] = 0xffffffff; items[o + 1] = 0xffffffff; items[o + 2] = 0xffffffff; }
    }
    const data = device.createBuffer({ size: items.byteLength, usage: STORAGE | COPY_SRC | COPY_DST });
    device.queue.writeBuffer(data, 0, items);

    // One uniform slot per network step, at the device's dynamic-offset alignment.
    const { x, y, width } = grid(device, size);
    const align = Math.max(256, device.limits.minUniformBufferOffsetAlignment);
    const steps: [number, number][] = [];
    for (let k = 2; k <= size; k *= 2) for (let j = k / 2; j > 0; j = Math.floor(j / 2)) steps.push([j, k]);
    const params = new Uint32Array((steps.length * align) / 4);
    steps.forEach(([j, k], s) => params.set([j, k, size, width], (s * align) / 4));
    const uniform = device.createBuffer({ size: params.byteLength, usage: UNIFORM | COPY_DST });
    device.queue.writeBuffer(uniform, 0, params);

    const group = device.createBindGroup({
      layout: sort.layout,
      entries: [{ binding: 0, resource: { buffer: data } }, { binding: 1, resource: { buffer: uniform, size: 16 } }],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(sort.pipeline);
    for (let s = 0; s < steps.length; s++) {
      pass.setBindGroup(0, group, [s * align]);
      pass.dispatchWorkgroups(x, y);
    }
    pass.end();
    const sorted = await readBack(device, data, items.byteLength, encoder);
    data.destroy();
    uniform.destroy();
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = sorted[i * 4 + 2];
    return order;
  });
}

/** Counts of `values` in `bins` (≤ 64) equal bins from `min`, `scale` bins per unit (see `binScale`), on the GPU. */
export function gpuHistogram(values: Float32Array, min: number, scale: number, bins: number): Promise<Uint32Array> {
  return enqueue(async ({ device, histogram }) => {
    if (values.byteLength > device.limits.maxStorageBufferBindingSize) throw new Error('Column too large for one GPU buffer');
    const input = device.createBuffer({ size: Math.max(16, values.byteLength), usage: STORAGE | COPY_DST });
    device.queue.writeBuffer(input, 0, values);
    const output = device.createBuffer({ size: 64 * 4, usage: STORAGE | COPY_SRC | COPY_DST });
    device.queue.writeBuffer(output, 0, new Uint32Array(64));
    const { x, y, width } = grid(device, values.length);
    const params = new ArrayBuffer(32);
    new Float32Array(params, 0, 2).set([min, scale]);
    new Uint32Array(params, 8, 3).set([values.length, bins, width]);
    const uniform = device.createBuffer({ size: 32, usage: UNIFORM | COPY_DST });
    device.queue.writeBuffer(uniform, 0, new Uint8Array(params));
    const group = device.createBindGroup({
      layout: histogram.layout,
      entries: [{ binding: 0, resource: { buffer: input } }, { binding: 1, resource: { buffer: output } }, { binding: 2, resource: { buffer: uniform } }],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(histogram.pipeline);
    pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(x, y);
    pass.end();
    const counts = await readBack(device, output, 64 * 4, encoder);
    input.destroy();
    output.destroy();
    uniform.destroy();
    return counts.slice(0, bins);
  });
}
