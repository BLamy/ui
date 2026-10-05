/* ══ FFmpeg in the browser — openclaw/ffmpeg-wasm, run like a command line ══
   FFmpeg and FFprobe, built for the browser from openclaw/ffmpeg-wasm (tools/ffmpeg-wasm), as jobs: arguments and input
   files in; the files the run wrote, its stdout and its stderr out. Each job runs in a module worker
   (lib/ffmpeg/ffmpeg-worker.js, served next to the wasm), at most `concurrency` at once. Inputs are Blobs or Files, mounted
   read-only and never copied, or bytes. Progress is FFmpeg's own `-progress` report. Aborting a job terminates its worker.

   The build uses threads, so the page must be cross-origin isolated: `Document-Isolation-Policy:
   isolate-and-credentialless` on the document (Chrome), or `Cross-Origin-Opener-Policy: same-origin` with
   `Cross-Origin-Embedder-Policy: require-corp` (every browser; then the worker scripts need that COEP header too).
   `ffmpegUnsupportedReason()` says what is missing. Nothing touches the DOM at module scope. ══ */

export type FfmpegTool = 'ffmpeg' | 'ffprobe';
/** A job input: a Blob or File (mounted, not copied) or bytes (written as a file). */
export type FfmpegInput = Blob | ArrayBuffer | ArrayBufferView;

export interface FfmpegProgress {
  /** Seconds of output written so far. */
  time: number;
  /** 0…1, when the job was given the output's `duration`. */
  fraction?: number;
  frame?: number;
  /** Times realtime (2 = twice as fast as playback). */
  speed?: number;
}

export interface FfmpegJob {
  /** The command line after the program name: `['-i', 'clip.mp4', '-vn', 'audio.mp3']`. */
  args: readonly string[];
  /** Files in the working directory, by name: what the arguments read. */
  inputs?: Record<string, FfmpegInput>;
  /** Default `ffmpeg`. */
  tool?: FfmpegTool;
  /** The output's length in seconds, so progress can report a fraction. */
  duration?: number;
  /** FFmpeg only: asks for `-progress` reports (about twice a second). */
  onProgress?: (progress: FfmpegProgress) => void;
  /** Each stderr line as it is printed. */
  onLog?: (line: string) => void;
  signal?: AbortSignal;
}

export interface FfmpegResult {
  /** Every file the run wrote, by name. */
  files: Record<string, Uint8Array>;
  stdout: string;
  stderr: string;
}

/** `unsupported`: the page can't run it (no isolation, no workers); `missing`: the worker or the wasm isn't served
 *  where `baseURL` says; `failed`: the tool exited non-zero (see `exitCode`, `stderr`); `crashed`: the runtime died;
 *  `aborted`: the job's signal fired, or the instance was disposed. */
export type FfmpegErrorCode = 'unsupported' | 'missing' | 'failed' | 'crashed' | 'aborted';

export class FfmpegError extends Error {
  readonly code: FfmpegErrorCode;
  readonly exitCode?: number;
  /** What the tool printed to stderr. */
  readonly stderr: string;
  constructor(code: FfmpegErrorCode, message: string, options: { exitCode?: number; stderr?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'FfmpegError';
    this.code = code;
    this.exitCode = options.exitCode;
    this.stderr = options.stderr ?? '';
  }
}

/** Why FFmpeg can't run in this page, or null when it can. */
export function ffmpegUnsupportedReason(): string | null {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return 'This browser can’t run WebAssembly in a worker.';
  if (!(globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) {
    return 'FFmpeg runs on threads, which need a cross-origin isolated page: serve it with Document-Isolation-Policy: '
      + 'isolate-and-credentialless (Chrome), or Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp.';
  }
  return null;
}

export interface FfmpegOptions {
  /** The directory serving ffmpeg-worker.js, ffmpeg.js, ffmpeg_g.wasm, ffprobe.js and ffprobe_g.wasm. Default
   *  `ffmpeg/`, against the document's base URL. */
  baseURL?: string | URL;
  /** Jobs that run at once, each in its own worker. Default 2. */
  concurrency?: number;
}

export interface ProbeOptions {
  /** The file name FFprobe sees (its extension can matter). Default: the File's name, else one from the MIME type. */
  name?: string;
  signal?: AbortSignal;
}

export interface Ffmpeg {
  /** Where the worker and the wasm are loaded from (absolute, ends in `/`). */
  readonly baseURL: string;
  /** Runs one job. Rejects with an FfmpegError when the tool exits non-zero, can't start, or is aborted. */
  run(job: FfmpegJob): Promise<FfmpegResult>;
  /** What a media file holds: its kind, duration, and the first video and audio stream. */
  probe(input: Blob, options?: ProbeOptions): Promise<MediaInfo>;
  /** Ends every job (they reject `aborted`) and every worker. */
  dispose(): void;
}

/* ── Probe results ── */

export type MediaKind = 'video' | 'audio' | 'image';

export interface VideoStreamInfo {
  codec: string;
  /** Coded size. */
  width: number;
  height: number;
  /** Size as shown, after the rotation metadata (FFmpeg applies it when decoding). */
  displayWidth: number;
  displayHeight: number;
  /** Frames per second (0 when unknown). */
  fps: number;
  /** Clockwise degrees the frames are turned for display: 0, 90, 180 or 270. */
  rotation: number;
  pixelFormat?: string;
}

export interface AudioStreamInfo {
  codec: string;
  sampleRate: number;
  channels: number;
}

export interface MediaInfo {
  kind: MediaKind;
  /** Seconds; 0 for a still image. */
  duration: number;
  /** FFmpeg's demuxer names: `mov,mp4,m4a,3gp,3g2,mj2`, `matroska,webm`, `image2`, … */
  format: string;
  /** Bytes. */
  size?: number;
  /** Bits per second, overall. */
  bitRate?: number;
  /** The first video stream (cover art in an audio file doesn't count). */
  video?: VideoStreamInfo;
  /** The first audio stream. */
  audio?: AudioStreamInfo;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
  pix_fmt?: string;
  tags?: Record<string, string>;
  side_data_list?: { rotation?: number }[];
  disposition?: { attached_pic?: number };
}
interface ProbeJson {
  streams?: ProbeStream[];
  format?: { format_name?: string; duration?: string; size?: string; bit_rate?: string };
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};
/** `30000/1001` → 29.97; `0/0` → 0. */
export function parseRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [a, b = '1'] = rate.split('/');
  const n = Number(a) / Number(b);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** FFprobe's `-print_format json -show_format -show_streams` output, as a MediaInfo. */
export function parseProbe(json: unknown): MediaInfo {
  const j = (json ?? {}) as ProbeJson;
  const streams = j.streams ?? [];
  const format = j.format ?? {};
  const v = streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  const a = streams.find((s) => s.codec_type === 'audio');
  let video: VideoStreamInfo | undefined;
  if (v) {
    const turn = num(v.side_data_list?.find((d) => d.rotation != null)?.rotation) ?? -(num(v.tags?.rotate) ?? 0);
    // The display matrix turns counter-clockwise; report the clockwise turn a viewer applies.
    const rotation = ((Math.round(-turn / 90) * 90) % 360 + 360) % 360;
    const width = v.width ?? 0;
    const height = v.height ?? 0;
    const side = rotation === 90 || rotation === 270;
    video = {
      codec: v.codec_name ?? 'unknown',
      width,
      height,
      displayWidth: side ? height : width,
      displayHeight: side ? width : height,
      fps: parseRate(v.avg_frame_rate) || parseRate(v.r_frame_rate),
      rotation,
      pixelFormat: v.pix_fmt,
    };
  }
  const audio: AudioStreamInfo | undefined = a
    ? { codec: a.codec_name ?? 'unknown', sampleRate: num(a.sample_rate) ?? 0, channels: a.channels ?? 0 }
    : undefined;
  const name = format.format_name ?? '';
  const duration = num(format.duration) ?? Math.max(0, ...streams.map((s) => num(s.duration) ?? 0));
  const still = !!video && !audio && (/(^|,)image2$|_pipe$/.test(name) || !(duration > 0));
  return {
    kind: still ? 'image' : video ? 'video' : 'audio',
    duration: still ? 0 : duration,
    format: name,
    size: num(format.size),
    bitRate: num(format.bit_rate),
    video,
    audio,
  };
}

/* ── File names ── */

const EXT: Record<string, string> = {
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-matroska': 'mkv', 'video/mp2t': 'ts',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/flac': 'flac', 'image/png': 'png', 'image/jpeg': 'jpg',
  'image/webp': 'webp', 'image/gif': 'gif',
};

/** A safe working-directory name for an input (letters, digits, `.`, `_`, `-`), keeping its extension, which FFmpeg
 *  uses to recognise stills and some containers. */
export function mediaFileName(input: Blob, fallback = 'input'): string {
  const raw = typeof File !== 'undefined' && input instanceof File && input.name ? input.name : '';
  const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(raw)?.[1] ?? EXT[input.type.split(';')[0]] ?? '').toLowerCase();
  const stem = (raw.replace(/\.[A-Za-z0-9]{1,5}$/, '') || fallback).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || fallback;
  return ext ? `${stem}.${ext}` : stem;
}

const validName = (name: string) => !!name && name !== '.' && name !== '..' && !/[/\\\0]/.test(name);

/* ── The worker pool ── */

type WorkerMessage =
  | { id: number; type: 'progress'; progress: { time: number; frame?: number; speed?: number; done: boolean } }
  | { id: number; type: 'log'; line: string }
  | { id: number; type: 'done'; exitCode: number; stdout: string; stderr: string; files: Record<string, ArrayBuffer> }
  | { id: number; type: 'error'; error: string; stderr: string };

const lastLines = (text: string, n = 3) => text.split('\n').map((l) => l.trim()).filter(Boolean).slice(-n).join(' · ');
const aborted = () => new FfmpegError('aborted', 'The FFmpeg job was aborted.');

/** An FFmpeg runner: a small pool of workers that start on the first job. */
export function createFfmpeg({ baseURL, concurrency = 2 }: FfmpegOptions = {}): Ffmpeg {
  const origin = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI;
  const base = new URL(baseURL ?? 'ffmpeg/', origin).href.replace(/\/?$/, '/');
  const workerURL = new URL('ffmpeg-worker.js', base).href;
  const limit = Math.max(1, Math.floor(concurrency));
  const idle: Worker[] = [];
  const all = new Set<Worker>();
  const waiting: Array<{ go: () => void; fail: (e: FfmpegError) => void }> = [];
  const cancels = new Set<() => void>();
  let running = 0;
  let seq = 0;
  let disposed = false;

  const kill = (w: Worker) => { w.terminate(); all.delete(w); };
  const release = () => {
    running--;
    if (disposed) return;
    const next = running < limit ? waiting.shift() : undefined;
    if (next) { running++; next.go(); }
  };
  /** Waits for a free worker slot (queued jobs start in order). */
  const slot = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (running < limit) { running++; resolve(); return; }
    const onAbort = () => { waiting.splice(waiting.indexOf(entry), 1); reject(aborted()); };
    const entry = {
      go: () => { signal?.removeEventListener('abort', onAbort); resolve(); },
      fail: (e: FfmpegError) => { signal?.removeEventListener('abort', onAbort); reject(e); },
    };
    waiting.push(entry);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

  async function run(job: FfmpegJob): Promise<FfmpegResult> {
    const reason = ffmpegUnsupportedReason();
    if (reason) throw new FfmpegError('unsupported', reason);
    if (disposed || job.signal?.aborted) throw aborted();
    const tool = job.tool ?? 'ffmpeg';
    const inputs = Object.entries(job.inputs ?? {}).map(([name, data]) => {
      if (!validName(name)) throw new TypeError(`"${name}" isn't a plain file name.`);
      return { name, data: data instanceof Blob || data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
    });
    const args = [...job.args];
    if (tool === 'ffmpeg') {
      if (job.onProgress && !args.includes('-progress')) args.unshift('-progress', 'pipe:2', '-nostats');
      if (!args.includes('-nostdin')) args.unshift('-nostdin');
    }
    await slot(job.signal);
    // The pool may have been disposed, or the job aborted, while it waited (or in the same tick it was queued).
    if (disposed || job.signal?.aborted) {
      release();
      throw aborted();
    }
    const fresh = !idle.length;
    let worker: Worker;
    try {
      worker = idle.pop() ?? new Worker(workerURL, { type: 'module', name: `bl-${tool}` });
    } catch (e) {
      release();
      throw new FfmpegError('unsupported', `Couldn’t start a module worker: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
    all.add(worker);
    const id = ++seq;
    return new Promise<FfmpegResult>((resolve, reject) => {
      const finish = (keep: boolean) => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        job.signal?.removeEventListener('abort', onAbort);
        cancels.delete(onAbort);
        if (keep && !disposed) idle.push(worker);
        else kill(worker);
        release();
      };
      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        const m = event.data;
        if (!m || m.id !== id) return;
        if (m.type === 'progress') {
          const { time, frame, speed, done } = m.progress;
          const fraction = job.duration ? Math.min(1, done ? 1 : time / job.duration) : undefined;
          job.onProgress?.({ time, frame, speed, fraction });
        } else if (m.type === 'log') job.onLog?.(m.line);
        else if (m.type === 'done') {
          finish(true);
          if (m.exitCode === 0) {
            const files: Record<string, Uint8Array> = {};
            for (const [k, buf] of Object.entries(m.files)) files[k] = new Uint8Array(buf);
            resolve({ files, stdout: m.stdout, stderr: m.stderr });
          } else {
            reject(new FfmpegError('failed', lastLines(m.stderr) || `${tool} exited with code ${m.exitCode}.`, { exitCode: m.exitCode, stderr: m.stderr }));
          }
        } else {
          finish(false);
          const missing = /dynamically imported module|failed to fetch|importing a module script failed|error loading/i.test(m.error);
          reject(new FfmpegError(missing ? 'missing' : 'crashed',
            missing ? `Couldn’t load ${tool} from ${base}: serve the FFmpeg wasm build there (tools/ffmpeg-wasm).` : m.error,
            { stderr: m.stderr }));
        }
      };
      const onError = (event: ErrorEvent) => {
        event.preventDefault();
        finish(false);
        reject(fresh
          ? new FfmpegError('missing', `Couldn’t start the FFmpeg worker at ${workerURL}: serve ffmpeg-worker.js next to the wasm build.`)
          : new FfmpegError('crashed', event.message || 'The FFmpeg worker crashed.'));
      };
      const onAbort = () => { finish(false); reject(aborted()); };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      job.signal?.addEventListener('abort', onAbort, { once: true });
      cancels.add(onAbort);
      worker.postMessage({ type: 'run', id, base, tool, args, inputs, logs: !!job.onLog });
    });
  }

  return {
    baseURL: base,
    run,
    async probe(input, { name = mediaFileName(input), signal } = {}) {
      const { stdout } = await run({
        tool: 'ffprobe',
        args: ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', name],
        inputs: { [name]: input },
        signal,
      });
      return parseProbe(JSON.parse(stdout || '{}'));
    },
    dispose() {
      disposed = true;
      for (const cancel of [...cancels]) cancel();
      for (const entry of waiting.splice(0)) entry.fail(aborted());
      for (const w of [...all]) kill(w);
      idle.length = 0;
    },
  };
}
