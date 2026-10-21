/* The one-time WebGPU adapter probe the GPU-backed parts share (SyntaxHighlighting's gpu-lexer, Spreadsheet's sort and
   histograms): is there an adapter at all, and is it real hardware or a software one (SwiftShader in headless CI,
   llvmpipe)? Each part decides from the answer whether its GPU path is worth taking. */

/** What the one-time adapter probe found: a `hardware` adapter, only a `software`/fallback one (or the probe timed
    out), or `none` (no `navigator.gpu`, no adapter, insecure context, SSR). */
export type WebGPUProbe = 'hardware' | 'software' | 'none';

let probeState: WebGPUProbe | null = null;
let probePromise: Promise<WebGPUProbe> | null = null;

/** How long the probe waits for an adapter before `auto` settles on the fallback. */
const PROBE_TIMEOUT = 2500;
const SOFTWARE_ADAPTER = /swiftshader|llvmpipe|lavapipe|software|microsoft basic/i;

interface ProbeAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  isFallbackAdapter?: boolean;
}
interface ProbeAdapter {
  isFallbackAdapter?: boolean;
  info?: ProbeAdapterInfo;
  requestAdapterInfo?: () => Promise<ProbeAdapterInfo>;
}
export interface ProbeGpu {
  requestAdapter(): Promise<ProbeAdapter | null>;
}

export const navigatorGpu = (): ProbeGpu | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { gpu?: ProbeGpu }).gpu;

async function classifyAdapter(adapter: ProbeAdapter | null): Promise<WebGPUProbe> {
  if (!adapter) return 'none';
  let info = adapter.info;
  if (!info && typeof adapter.requestAdapterInfo === 'function') info = await adapter.requestAdapterInfo().catch(() => undefined);
  if (adapter.isFallbackAdapter || info?.isFallbackAdapter) return 'software';
  const text = [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean).join(' ');
  return SOFTWARE_ADAPTER.test(text) ? 'software' : 'hardware';
}

/** Probe WebGPU once per page (cached): is there an adapter, and is it real hardware? Settles within ~2.5 s; a probe
    that takes longer counts as `software` (so `auto` falls back), and a late answer still updates later lexes. */
export function probeWebGPU(): Promise<WebGPUProbe> {
  if (probePromise) return probePromise;
  const gpu = navigatorGpu();
  if (!gpu) {
    probeState = 'none';
    return (probePromise = Promise.resolve<WebGPUProbe>('none'));
  }
  const request = Promise.resolve()
    .then(() => gpu.requestAdapter())
    .then(classifyAdapter, (): WebGPUProbe => 'none');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<WebGPUProbe>((resolve) => {
    timer = setTimeout(() => resolve('software'), PROBE_TIMEOUT);
  });
  void request.then((r) => {
    clearTimeout(timer);
    probeState = r;
  });
  probePromise = Promise.race([request, timeout]).then((r) => (probeState ??= r));
  return probePromise;
}

/** What the probe has found so far: `null` until it answers. */
export const webgpuProbeResult = (): WebGPUProbe | null => probeState;
