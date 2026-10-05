/* ══ Media helpers on lib/ffmpeg — frames for a filmstrip, peaks for a waveform ══
   `extractFrames` seeks to each time and keeps one small JPEG. A run takes a handful of seeks, each decoding a frame or
   two from the nearest keyframe, so a long file is never decoded end to end. Its decoders run on one thread each: every
   FFmpeg thread is a Web Worker, and a decoder's default is one per core. `extractPeaks` decodes the audio once, to
   8 kHz mono PCM, and keeps the loudest sample of each slice. Both take an AbortSignal. ══ */
import { FfmpegError, mediaFileName, type Ffmpeg } from '@/lib/ffmpeg';

export interface MediaFrame {
  /** Media time of the frame, seconds. */
  time: number;
  /** A JPEG. */
  blob: Blob;
}

export interface FramesOptions {
  /** Media times to grab, seconds. */
  times: readonly number[];
  /** Frame height in pixels; the width follows the aspect. Default 72. */
  height?: number;
  /** Seeks per FFmpeg run. Default 6. */
  batch?: number;
  signal?: AbortSignal;
}

/** Evenly spaced media times for `count` frames of a `duration`-second file (one, at 0, for a still). */
export function frameTimes(duration: number, count: number): number[] {
  if (!(duration > 0)) return [0];
  const n = Math.max(1, Math.round(count));
  // Mid-slice times, kept a little short of the end: a seek to the very end finds no frame.
  return Array.from({ length: n }, (_, i) => Math.max(0, Math.min(duration - 0.1, ((i + 0.5) * duration) / n)));
}

/** One small JPEG per time. A batch that fails (a time past the end, a broken stretch) is skipped; a missing build, an
 *  unisolated page or an abort rejects. */
export async function extractFrames(ffmpeg: Ffmpeg, input: Blob, { times, height = 72, batch = 6, signal }: FramesOptions): Promise<MediaFrame[]> {
  const name = mediaFileName(input, 'media');
  const chunks: number[][] = [];
  for (let i = 0; i < times.length; i += Math.max(1, batch)) chunks.push(times.slice(i, i + Math.max(1, batch)));
  const runs = chunks.map(async (chunk) => {
    const args = ['-hide_banner', '-loglevel', 'error'];
    for (const t of chunk) args.push('-threads', '1', '-ss', t.toFixed(3), '-i', name);
    chunk.forEach((_, i) => {
      args.push('-map', `${i}:v:0`, '-frames:v', '1', '-vf', `scale=-2:${Math.round(height)},format=yuvj420p`, '-q:v', '5', `f${i}.jpg`);
    });
    try {
      const { files } = await ffmpeg.run({ args, inputs: { [name]: input }, signal });
      return chunk.flatMap((time, i) => {
        const bytes = files[`f${i}.jpg`];
        return bytes?.byteLength ? [{ time, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }) }] : [];
      });
    } catch (e) {
      if (e instanceof FfmpegError && e.code === 'failed') return [];
      throw e;
    }
  });
  return (await Promise.all(runs)).flat();
}

export interface MediaPeaks {
  /** The loudest |sample| of each slice, 0…1. */
  peaks: Float32Array;
  /** Slices per second. */
  rate: number;
  /** Seconds of audio. */
  duration: number;
}

export interface PeaksOptions {
  /** Slices per second. Default 50. */
  rate?: number;
  signal?: AbortSignal;
}

/** The audio's peaks, or null when the file has no audio. */
export async function extractPeaks(ffmpeg: Ffmpeg, input: Blob, { rate = 50, signal }: PeaksOptions = {}): Promise<MediaPeaks | null> {
  const name = mediaFileName(input, 'media');
  try {
    const { files } = await ffmpeg.run({
      args: ['-hide_banner', '-loglevel', 'error', '-threads', '2', '-i', name, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-f', 'wav', 'peaks.wav'],
      inputs: { [name]: input },
      signal,
    });
    return wavPeaks(files['peaks.wav'], rate);
  } catch (e) {
    if (e instanceof FfmpegError && e.code === 'failed' && /matches no streams|does not contain any stream/i.test(e.stderr)) return null;
    throw e;
  }
}

/** Peaks of a 16-bit PCM WAV (the first channel when there are several). */
export function wavPeaks(bytes: Uint8Array, rate = 50): MediaPeaks {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (bytes.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new TypeError('Not a WAV file.');
  let sampleRate = 8000, channels = 1, bits = 16, data = -1, length = 0;
  for (let at = 12; at + 8 <= bytes.byteLength;) {
    const id = tag(at);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ') {
      channels = view.getUint16(at + 10, true);
      sampleRate = view.getUint32(at + 12, true);
      bits = view.getUint16(at + 22, true);
    } else if (id === 'data') {
      data = at + 8;
      // A streamed WAV leaves the size unset (0 or 0xFFFFFFFF): read to the end.
      length = size && size !== 0xffffffff ? Math.min(size, bytes.byteLength - data) : bytes.byteLength - data;
      break;
    }
    at += 8 + size + (size & 1);
  }
  if (data < 0 || bits !== 16) throw new TypeError('Expected 16-bit PCM WAV data.');
  const frame = channels * 2;
  const frames = Math.floor(length / frame);
  const per = sampleRate / rate;
  const peaks = new Float32Array(Math.max(1, Math.ceil(frames / per)));
  for (let i = 0; i < frames; i++) {
    const v = Math.abs(view.getInt16(data + i * frame, true)) / 32768;
    const k = Math.floor(i / per);
    if (v > peaks[k]) peaks[k] = v;
  }
  return { peaks, rate, duration: frames / sampleRate };
}
