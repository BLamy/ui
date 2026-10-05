'use client';
/* ══ FFmpeg for React — a runner per provider, and hooks that share the work per file ══
   <FfmpegProvider> makes one runner (lib/ffmpeg) for its subtree; workers start with the first job and end when the
   provider unmounts. `useMediaInfo`, `useMediaFrames` and `useMediaPeaks` probe a Blob or File, grab filmstrip frames
   and decode waveform peaks. Results are cached per file for the page's lifetime, so twenty clips cut from one recording
   ask FFmpeg once; `releaseMedia(file)` drops a file's results and revokes its frame URLs. ══ */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createFfmpeg, ffmpegUnsupportedReason, type Ffmpeg, type FfmpegOptions, type MediaInfo } from '@/lib/ffmpeg';
import { extractFrames, extractPeaks, frameTimes, type MediaPeaks } from '@/lib/ffmpeg/media';

const FfmpegCtx = createContext<Ffmpeg | null>(null);

export interface FfmpegProviderProps extends FfmpegOptions {
  children?: ReactNode;
}

/** One FFmpeg runner for the subtree. */
export function FfmpegProvider({ baseURL, concurrency, children }: FfmpegProviderProps) {
  const [ffmpeg, setFfmpeg] = useState<Ffmpeg | null>(null);
  const base = baseURL == null ? undefined : String(baseURL);
  useEffect(() => {
    const f = createFfmpeg({ baseURL: base, concurrency });
    setFfmpeg(f);
    return () => f.dispose();
  }, [base, concurrency]);
  return <FfmpegCtx.Provider value={ffmpeg}>{children}</FfmpegCtx.Provider>;
}

/** The provider's runner (null before it mounts, or outside a provider). */
export function useFfmpeg(): Ffmpeg | null {
  return useContext(FfmpegCtx);
}

/** Why FFmpeg can't run in this page, null when it can, undefined until mounted (it reads the page's isolation). */
export function useFfmpegSupport(): string | null | undefined {
  const [reason, setReason] = useState<string | null | undefined>(undefined);
  useEffect(() => setReason(ffmpegUnsupportedReason()), []);
  return reason;
}

/* ── Per-file cache ── */

interface Entry {
  info?: Promise<MediaInfo>;
  frames: Map<string, Promise<MediaFrameURL[]>>;
  peaks: Map<number, Promise<MediaPeaks | null>>;
  urls: string[];
}
const cache = new WeakMap<Blob, Entry>();
const entry = (blob: Blob) => {
  let e = cache.get(blob);
  if (!e) cache.set(blob, (e = { frames: new Map(), peaks: new Map(), urls: [] }));
  return e;
};
/** Keeps a promise in the cache until it fails (so a later call retries). */
function keep<K, T>(map: Map<K, Promise<T>>, key: K, make: () => Promise<T>): Promise<T> {
  let p = map.get(key);
  if (!p) {
    p = make();
    map.set(key, p);
    p.catch(() => map.delete(key));
  }
  return p;
}

/** Forgets what was worked out for a file and revokes its frame URLs. */
export function releaseMedia(blob: Blob) {
  const e = cache.get(blob);
  if (!e) return;
  e.urls.forEach((u) => URL.revokeObjectURL(u));
  cache.delete(blob);
}

/** Probes a file once (cached). */
export function probeMedia(ffmpeg: Ffmpeg, blob: Blob): Promise<MediaInfo> {
  const e = entry(blob);
  if (!e.info) {
    e.info = ffmpeg.probe(blob);
    e.info.catch(() => { if (cache.get(blob) === e) e.info = undefined; });
  }
  return e.info;
}

export interface MediaFrameURL {
  /** Media time, seconds. */
  time: number;
  /** An object URL of a JPEG. */
  src: string;
}

/** Filmstrip frames for a file (cached by count and height). */
export function mediaFrames(ffmpeg: Ffmpeg, blob: Blob, { count = 24, height = 72 }: { count?: number; height?: number } = {}) {
  const e = entry(blob);
  return keep(e.frames, `${count}@${height}`, async () => {
    const info = await probeMedia(ffmpeg, blob);
    if (!info.video) return [];
    const frames = await extractFrames(ffmpeg, blob, { times: frameTimes(info.duration, count), height });
    const urls = frames.map((f) => ({ time: f.time, src: URL.createObjectURL(f.blob) }));
    e.urls.push(...urls.map((u) => u.src));
    return urls;
  });
}

/** Waveform peaks for a file (cached by rate), or null when it has no audio. */
export function mediaPeaks(ffmpeg: Ffmpeg, blob: Blob, { rate = 50 }: { rate?: number } = {}) {
  return keep(entry(blob).peaks, rate, async () => {
    const info = await probeMedia(ffmpeg, blob);
    return info.audio ? extractPeaks(ffmpeg, blob, { rate }) : null;
  });
}

export interface AsyncResult<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

function useAsync<T>(make: (ffmpeg: Ffmpeg, blob: Blob) => Promise<T>, blob: Blob | null | undefined, key: string): AsyncResult<T> {
  const ffmpeg = useFfmpeg();
  const [state, setState] = useState<{ blob?: Blob; key?: string; data?: T; error?: Error }>({});
  useEffect(() => {
    if (!ffmpeg || !blob) return undefined;
    let live = true;
    make(ffmpeg, blob).then(
      (data) => { if (live) setState({ blob, key, data }); },
      (error: unknown) => { if (live) setState({ blob, key, error: error instanceof Error ? error : new Error(String(error)) }); },
    );
    return () => { live = false; };
    // `make` is rebuilt each render; `key` names what it computes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ffmpeg, blob, key]);
  if (!blob) return { loading: false };
  // A result for another file or question is stale: loading until this one's arrives.
  if (state.blob !== blob || state.key !== key) return { loading: true };
  return { data: state.data, error: state.error, loading: false };
}

/** What a file holds (kind, duration, streams), probed once per file. */
export function useMediaInfo(blob: Blob | null | undefined): AsyncResult<MediaInfo> {
  return useAsync(probeMedia, blob, 'info');
}

/** Evenly spaced filmstrip frames across a video (one for a still; none for audio). */
export function useMediaFrames(blob: Blob | null | undefined, options: { count?: number; height?: number } = {}): AsyncResult<MediaFrameURL[]> {
  const { count = 24, height = 72 } = options;
  return useAsync((f, b) => mediaFrames(f, b, { count, height }), blob, `frames:${count}@${height}`);
}

/** Waveform peaks of a file's audio (null when it has none). */
export function useMediaPeaks(blob: Blob | null | undefined, options: { rate?: number } = {}): AsyncResult<MediaPeaks | null> {
  const { rate = 50 } = options;
  return useAsync((f, b) => mediaPeaks(f, b, { rate }), blob, `peaks:${rate}`);
}
