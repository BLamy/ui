import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FfmpegError, createFfmpeg, ffmpegUnsupportedReason, mediaFileName, parseProbe, parseRate } from '@/lib/ffmpeg';

afterEach(() => vi.unstubAllGlobals());

interface RunMessage { type: string; id: number; base: string; tool: string; args: string[]; inputs: { name: string; data: unknown }[] }

/** Stands in for ffmpeg-worker.js: keeps what it is sent, and answers when a test says so. */
class FakeWorker {
  static started: FakeWorker[] = [];
  readonly sent: RunMessage[] = [];
  terminated = false;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  constructor(readonly url: string, readonly options?: WorkerOptions) {
    FakeWorker.started.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  postMessage(message: RunMessage) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  /** Posts a message back about the last job it was sent, as the worker script does. */
  answer(message: Record<string, unknown>) {
    const id = this.sent.at(-1)?.id;
    for (const listener of [...(this.listeners.get('message') ?? [])]) listener({ data: { id, ...message } });
  }
}

/** Lets pending promise callbacks run. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** Where a promise has got to: 'pending', 'resolved', or its FfmpegError's code. */
function watch(promise: Promise<unknown>): () => string {
  let state = 'pending';
  promise.then(() => { state = 'resolved'; }, (e: unknown) => { state = e instanceof FfmpegError ? e.code : 'rejected'; });
  return () => state;
}

describe('parseRate', () => {
  it('reads a fraction or a plain number, and 0 for nothing usable', () => {
    expect(parseRate('30000/1001')).toBeCloseTo(29.97, 2);
    expect(parseRate('25/1')).toBe(25);
    expect(parseRate('25')).toBe(25);
    expect(parseRate('0/0')).toBe(0);
    expect(parseRate('')).toBe(0);
    expect(parseRate(undefined)).toBe(0);
    expect(parseRate('n/a')).toBe(0);
  });
});

describe('parseProbe', () => {
  it('reads a phone video: its display-matrix rotation, display size, frame rate and audio', () => {
    const info = parseProbe({
      streams: [
        {
          codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '30000/1001', r_frame_rate: '30/1',
          pix_fmt: 'yuv420p', side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }], disposition: { attached_pic: 0 },
        },
        { codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2 },
      ],
      format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '12.345000', size: '2048000', bit_rate: '1327182' },
    });
    expect(info).toMatchObject({ kind: 'video', duration: 12.345, format: 'mov,mp4,m4a,3gp,3g2,mj2', size: 2048000, bitRate: 1327182 });
    expect(info.video).toMatchObject({ codec: 'h264', width: 1920, height: 1080, displayWidth: 1080, displayHeight: 1920, rotation: 90, pixelFormat: 'yuv420p' });
    expect(info.video?.fps).toBeCloseTo(29.97, 2);
    expect(info.audio).toEqual({ codec: 'aac', sampleRate: 48000, channels: 2 });
  });
  it('reports every rotation as a clockwise turn, from the display matrix or the old rotate tag', () => {
    const video = (stream: object) => parseProbe({ streams: [{ codec_type: 'video', width: 4, height: 2, ...stream }], format: { duration: '1' } }).video;
    expect(video({ side_data_list: [{ rotation: 90 }] })).toMatchObject({ rotation: 270, displayWidth: 2, displayHeight: 4 });
    expect(video({ side_data_list: [{ rotation: -180 }] })).toMatchObject({ rotation: 180, displayWidth: 4, displayHeight: 2 });
    expect(video({ tags: { rotate: '90' } })).toMatchObject({ rotation: 90, displayWidth: 2, displayHeight: 4 });
    expect(video({})).toMatchObject({ rotation: 0, displayWidth: 4, displayHeight: 2, codec: 'unknown' });
  });
  it('falls back to r_frame_rate when avg_frame_rate is unknown', () => {
    const info = parseProbe({ streams: [{ codec_type: 'video', avg_frame_rate: '0/0', r_frame_rate: '25/1' }], format: { duration: '1' } });
    expect(info.video?.fps).toBe(25);
  });
  it('reads an mp3 with cover art as audio, without the picture', () => {
    const info = parseProbe({
      streams: [
        { codec_type: 'audio', codec_name: 'mp3', sample_rate: '44100', channels: 2, duration: '183.249000' },
        { codec_type: 'video', codec_name: 'mjpeg', width: 600, height: 600, disposition: { attached_pic: 1 } },
      ],
      format: { format_name: 'mp3', duration: '183.249000' },
    });
    expect(info.kind).toBe('audio');
    expect(info.video).toBeUndefined();
    expect(info.audio).toEqual({ codec: 'mp3', sampleRate: 44100, channels: 2 });
    expect(info.duration).toBeCloseTo(183.249);
  });
  it('reads a PNG as a still with no duration', () => {
    const png = parseProbe({
      streams: [{ codec_type: 'video', codec_name: 'png', width: 800, height: 600, avg_frame_rate: '0/0', r_frame_rate: '25/1' }],
      format: { format_name: 'png_pipe' },
    });
    expect(png).toMatchObject({ kind: 'image', duration: 0, format: 'png_pipe' });
    expect(png.video).toMatchObject({ codec: 'png', displayWidth: 800, displayHeight: 600 });
    // image2 reports a frame's worth of time: still a still
    const jpeg = parseProbe({ streams: [{ codec_type: 'video', codec_name: 'mjpeg', width: 8, height: 8 }], format: { format_name: 'image2', duration: '0.040000' } });
    expect(jpeg).toMatchObject({ kind: 'image', duration: 0 });
  });
  it('takes the longest stream when the format has no duration', () => {
    const info = parseProbe({ streams: [{ codec_type: 'audio', duration: '2.5' }, { codec_type: 'video', duration: '3' }], format: { format_name: 'matroska,webm' } });
    expect(info).toMatchObject({ kind: 'video', duration: 3 });
  });
});

describe('mediaFileName', () => {
  it('keeps letters, digits, _ and - in the stem, and the extension in lower case', () => {
    expect(mediaFileName(new File(['x'], 'My Clip (1).MOV'))).toBe('My_Clip_1_.mov');
    expect(mediaFileName(new File(['x'], 'a.mp4', { type: 'video/mp4' }))).toBe('a.mp4');
    expect(mediaFileName(new File(['x'], '../../etc/passwd'))).toBe('_etc_passwd');
    expect(mediaFileName(new File(['x'], `${'a'.repeat(100)}.mp4`))).toBe(`${'a'.repeat(60)}.mp4`);
  });
  it('takes the extension from the MIME type when the name has none', () => {
    expect(mediaFileName(new File(['x'], 'clip', { type: 'video/mp4' }))).toBe('clip.mp4');
    expect(mediaFileName(new Blob(['x'], { type: 'video/webm' }))).toBe('input.webm');
    expect(mediaFileName(new Blob(['x'], { type: 'audio/webm;codecs=opus' }))).toBe('input.webm');
    expect(mediaFileName(new Blob(['x'], { type: 'image/jpeg' }), 'media')).toBe('media.jpg');
  });
  it('is the bare fallback for an unknown type', () => {
    expect(mediaFileName(new Blob(['x'], { type: 'application/x-unknown' }))).toBe('input');
    expect(mediaFileName(new Blob(['x']))).toBe('input');
  });
});

describe('ffmpegUnsupportedReason', () => {
  it('needs workers', () => {
    vi.stubGlobal('Worker', undefined);
    expect(ffmpegUnsupportedReason()).toMatch(/WebAssembly in a worker/);
  });
  it('needs a cross-origin isolated page', () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('crossOriginIsolated', false);
    expect(ffmpegUnsupportedReason()).toMatch(/cross-origin isolated/);
  });
  it('is null on an isolated page with workers and WebAssembly', () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('crossOriginIsolated', true);
    expect(typeof WebAssembly).toBe('object');
    expect(ffmpegUnsupportedReason()).toBeNull();
  });
});

describe('createFfmpeg', () => {
  beforeEach(() => {
    FakeWorker.started = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('crossOriginIsolated', true);
  });

  it('resolves baseURL against the page and ends it with a slash', () => {
    const { baseURL } = createFfmpeg({ baseURL: '/x' });
    expect(baseURL).toMatch(/^[a-z]+:\/\/.*\/x\/$/);
    expect(createFfmpeg({ baseURL: '/x/' }).baseURL).toBe(baseURL);
    expect(createFfmpeg({ baseURL: 'https://cdn.example/ffmpeg' }).baseURL).toBe('https://cdn.example/ffmpeg/');
    expect(createFfmpeg().baseURL).toMatch(/\/ffmpeg\/$/);
  });
  it('rejects a job with an unsupported FfmpegError on a page that is not isolated, starting no worker', async () => {
    vi.stubGlobal('crossOriginIsolated', false);
    const job = createFfmpeg().run({ args: ['-version'] });
    await expect(job).rejects.toBeInstanceOf(FfmpegError);
    await expect(job).rejects.toMatchObject({ name: 'FfmpegError', code: 'unsupported', message: expect.stringContaining('cross-origin isolated') });
    expect(FakeWorker.started).toHaveLength(0);
  });
  it('runs a job in a module worker, with -nostdin and progress reports, and resolves with the files it wrote', async () => {
    const ffmpeg = createFfmpeg({ baseURL: 'https://cdn.example/ffmpeg/' });
    const onProgress = vi.fn();
    const job = ffmpeg.run({ args: ['-i', 'in.wav', 'out.mp3'], inputs: { 'in.wav': new Uint8Array([1, 2]) }, duration: 10, onProgress });
    await flush();
    const [worker] = FakeWorker.started;
    expect(worker.url).toBe('https://cdn.example/ffmpeg/ffmpeg-worker.js');
    expect(worker.options).toEqual({ type: 'module', name: 'bl-ffmpeg' });
    expect(worker.sent[0]).toMatchObject({
      type: 'run', tool: 'ffmpeg', base: 'https://cdn.example/ffmpeg/',
      args: ['-nostdin', '-progress', 'pipe:2', '-nostats', '-i', 'in.wav', 'out.mp3'],
      inputs: [{ name: 'in.wav', data: expect.any(ArrayBuffer) }],
    });
    worker.answer({ type: 'progress', progress: { time: 2.5, frame: 75, speed: 1.5, done: false } });
    expect(onProgress).toHaveBeenLastCalledWith({ time: 2.5, frame: 75, speed: 1.5, fraction: 0.25 });
    worker.answer({ type: 'done', exitCode: 0, stdout: '', stderr: '', files: { 'out.mp3': new Uint8Array([7, 8, 9]).buffer } });
    expect((await job).files['out.mp3']).toEqual(new Uint8Array([7, 8, 9]));
    expect(worker.terminated).toBe(false); // kept for the next job
  });
  it('rejects aborted and ends the worker when a running job is aborted', async () => {
    const ffmpeg = createFfmpeg();
    const controller = new AbortController();
    const job = watch(ffmpeg.run({ args: ['-version'], signal: controller.signal }));
    await flush();
    controller.abort();
    await flush();
    expect(job()).toBe('aborted');
    expect(FakeWorker.started[0].terminated).toBe(true);
  });

  it('dispose() ends queued jobs as well as running ones', async () => {
    const ffmpeg = createFfmpeg({ concurrency: 1 });
    const first = watch(ffmpeg.run({ args: ['-version'] }));
    const second = watch(ffmpeg.run({ args: ['-version'] }));
    await flush();
    ffmpeg.dispose();
    await flush();
    expect(first()).toBe('aborted');
    expect(second()).toBe('aborted');
    expect(FakeWorker.started).toHaveLength(1);
  });

  it('an abort right after run() ends the job', async () => {
    const ffmpeg = createFfmpeg();
    const controller = new AbortController();
    const job = watch(ffmpeg.run({ args: ['-version'], signal: controller.signal }));
    controller.abort();
    await flush();
    expect(job()).toBe('aborted');
  });
});
