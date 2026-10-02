/*! Vendored from safzanpirani/gpu-query (MIT, © 2026 Safzan Pirani), site/src/runtime/webgpu.ts @ 41739a2.
    Changed: the weights are passed in (they load lazily); the WebGPU types and flag constants are declared locally so
    the file compiles without @webgpu/types or a DOM lib that has them. See ./README.md and ./LICENSE. */

/**
 * WebGPU backend.
 *
 * The device, pipeline, weight buffer and grow-only IO buffers stay resident
 * between calls, so a warm batch pays for dispatch and readback only.
 *
 * One dispatch handles a whole batch: one workgroup per query. A single short
 * query is faster on the CPU because dispatch and readback dominate, which is
 * why `backend: "auto"` keeps small work there. gpu-time draws the same line at
 * 32 inputs or 512 tokens.
 */

import { buildKernel } from "./kernel.wgsl";
import { FEATURE_ROWS, SLOTS } from "./featurize";
import { LABELS } from "./weights";
import type { Weights } from "./weights";

/** Longest query the kernel handles; tokens past it are dropped. (The CPU path has no cap.) */
export const MAX_TOKENS = 24;

/* The slice of the WebGPU API this file touches. */
interface GpuBuffer {
  destroy(): void;
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
}
interface GpuPass {
  setPipeline(pipeline: unknown): void;
  setBindGroup(index: number, group: unknown): void;
  dispatchWorkgroups(x: number): void;
  end(): void;
}
interface GpuEncoder {
  beginComputePass(): GpuPass;
  copyBufferToBuffer(src: GpuBuffer, srcOffset: number, dst: GpuBuffer, dstOffset: number, size: number): void;
  finish(): unknown;
}
interface GpuDevice {
  lost: Promise<unknown>;
  queue: { writeBuffer(buffer: GpuBuffer, offset: number, data: ArrayBufferView): void; submit(commands: unknown[]): void };
  createBuffer(descriptor: { size: number; usage: number }): GpuBuffer;
  createShaderModule(descriptor: { code: string }): { getCompilationInfo(): Promise<{ messages: Array<{ type: string }> }> };
  createBindGroupLayout(descriptor: unknown): unknown;
  createPipelineLayout(descriptor: unknown): unknown;
  createComputePipeline(descriptor: unknown): unknown;
  createBindGroup(descriptor: unknown): unknown;
  createCommandEncoder(): GpuEncoder;
}
interface GpuNavigator { gpu?: { requestAdapter(): Promise<{ requestDevice(): Promise<GpuDevice> } | null> } }

// GPUBufferUsage / GPUShaderStage / GPUMapMode flag values from the WebGPU spec.
const MAP_READ = 0x0001;
const COPY_SRC = 0x0004;
const COPY_DST = 0x0008;
const STORAGE = 0x0080;
const STAGE_COMPUTE = 0x0004;
const MAP_MODE_READ = 0x0001;

let device: GpuDevice | null = null;
let pipeline: unknown = null;
let layout: unknown = null;
let weightBuffer: GpuBuffer | null = null;
let failed = false;

interface Slot {
  buffer: GpuBuffer;
  size: number;
}
const slots: Record<string, Slot | null> = {
  rows: null, neighbors: null, lengths: null, outputs: null, readback: null,
};

function navigatorGpu(): GpuNavigator["gpu"] {
  return typeof navigator === "undefined" ? undefined : (navigator as unknown as GpuNavigator).gpu;
}

export function supported(): boolean {
  return !!navigatorGpu() && !failed;
}

/** Flatten every tensor into one buffer, and record where each one starts. */
function packWeights(weights: Weights): { data: Float32Array; offsets: Record<string, number> } {
  const offsets: Record<string, number> = {};
  let total = 0;
  for (const name of weights.order) {
    offsets[name] = total;
    total += weights.tensors[name].length;
  }
  const data = new Float32Array(total);
  for (const name of weights.order) data.set(weights.tensors[name], offsets[name]);
  return { data, offsets };
}

export async function init(weights: Weights): Promise<boolean> {
  if (device) return true;
  const gpu = navigatorGpu();
  if (!gpu || failed) return false;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) { failed = true; return false; }
    const opened = await adapter.requestDevice();
    device = opened;
    opened.lost.then(() => { device = null; pipeline = null; failed = true; });

    const { data, offsets } = packWeights(weights);
    weightBuffer = opened.createBuffer({ size: data.byteLength, usage: STORAGE | COPY_DST });
    opened.queue.writeBuffer(weightBuffer, 0, data);

    const code = buildKernel({
      featureRows: FEATURE_ROWS,
      slots: SLOTS,
      roles: LABELS.length,
      maxTokens: MAX_TOKENS,
      offsets,
    });
    const module = opened.createShaderModule({ code });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === "error");
    if (errors.length) {
      console.error("WGSL compilation failed", errors);
      failed = true;
      return false;
    }

    layout = opened.createBindGroupLayout({
      entries: [0, 1, 2, 3, 4].map((binding) => ({
        binding,
        visibility: STAGE_COMPUTE,
        buffer: { type: binding === 4 ? "storage" : "read-only-storage" },
      })),
    });
    pipeline = opened.createComputePipeline({
      layout: opened.createPipelineLayout({ bindGroupLayouts: [layout] }),
      compute: { module, entryPoint: "main" },
    });
    return true;
  } catch (error) {
    console.error("WebGPU init failed", error);
    failed = true;
    return false;
  }
}

/** Grow-only buffers: reallocate when a batch needs more room, never shrink. */
function ensure(gpu: GpuDevice, name: string, size: number, usage: number): GpuBuffer {
  const existing = slots[name];
  if (existing && existing.size >= size) return existing.buffer;
  existing?.buffer.destroy();
  const buffer = gpu.createBuffer({ size, usage });
  slots[name] = { buffer, size };
  return buffer;
}

export interface Batch {
  rows: number[][][];
  neighbors: Array<Array<[number, number]>>;
}

/** Logits plus the boundary score, per token, for every query in the batch. */
export async function runBatch(batch: Batch): Promise<number[][][]> {
  const gpu = device;
  if (!gpu || !pipeline) throw new Error("WebGPU not initialised");
  const count = batch.rows.length;
  const outs = LABELS.length + 1;

  const rowData = new Uint32Array(count * MAX_TOKENS * SLOTS).fill(FEATURE_ROWS);
  const neighborData = new Int32Array(count * MAX_TOKENS * 2).fill(-1);
  const lengthData = new Uint32Array(count);

  for (let s = 0; s < count; s++) {
    const tokens = Math.min(batch.rows[s].length, MAX_TOKENS);
    lengthData[s] = tokens;
    for (let t = 0; t < tokens; t++) {
      rowData.set(batch.rows[s][t], (s * MAX_TOKENS + t) * SLOTS);
      neighborData.set(batch.neighbors[s][t], (s * MAX_TOKENS + t) * 2);
    }
  }

  const outBytes = count * MAX_TOKENS * outs * 4;
  const rowsBuf = ensure(gpu, "rows", rowData.byteLength, STORAGE | COPY_DST);
  const neighBuf = ensure(gpu, "neighbors", neighborData.byteLength, STORAGE | COPY_DST);
  const lenBuf = ensure(gpu, "lengths", Math.max(4, lengthData.byteLength), STORAGE | COPY_DST);
  const outBuf = ensure(gpu, "outputs", outBytes, STORAGE | COPY_SRC);
  const readBuf = ensure(gpu, "readback", outBytes, COPY_DST | MAP_READ);

  gpu.queue.writeBuffer(rowsBuf, 0, rowData);
  gpu.queue.writeBuffer(neighBuf, 0, neighborData);
  gpu.queue.writeBuffer(lenBuf, 0, lengthData);

  const bindGroup = gpu.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: weightBuffer } },
      { binding: 1, resource: { buffer: rowsBuf } },
      { binding: 2, resource: { buffer: neighBuf } },
      { binding: 3, resource: { buffer: lenBuf } },
      { binding: 4, resource: { buffer: outBuf } },
    ],
  });

  const encoder = gpu.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(count);
  pass.end();
  encoder.copyBufferToBuffer(outBuf, 0, readBuf, 0, outBytes);
  gpu.queue.submit([encoder.finish()]);

  await readBuf.mapAsync(MAP_MODE_READ, 0, outBytes);
  const view = new Float32Array(readBuf.getMappedRange(0, outBytes).slice(0));
  readBuf.unmap();

  const results: number[][][] = [];
  for (let s = 0; s < count; s++) {
    const tokens = Math.min(batch.rows[s].length, MAX_TOKENS);
    const perToken: number[][] = [];
    for (let t = 0; t < tokens; t++) {
      const base = (s * MAX_TOKENS + t) * outs;
      perToken.push(Array.from(view.subarray(base, base + outs)));
    }
    results.push(perToken);
  }
  return results;
}
