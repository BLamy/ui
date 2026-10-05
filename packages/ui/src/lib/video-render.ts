/* ══ Video render — a timeline as one FFmpeg command ══
   `buildRender` turns a timeline (lib/video-timeline) and its media into FFmpeg arguments:
   - one input per clip, seeked to its in point and cut to its length (a still loops for as long as the clip lasts);
   - each picture fitted into its frame, given its look and its fades (as transparency), and laid over the background
     at its time, bottom track first, so a magnetic clip's transition is its fade-in over the clip before;
   - each clip's audio retimed, levelled, faded and delayed to its start, then mixed;
   - the container's encoders: MP4 (MPEG-4 Part 2 + AAC, for players and phones), WebM (VP8 + Opus, for browsers),
     GIF (its own palette), MP3 or WAV.
   `renderTimeline` runs it on a runner (lib/ffmpeg) and returns the file. Decoders get one or two threads each: every
   FFmpeg thread is a Web Worker. ══ */
import { mediaFileName, type Ffmpeg, type FfmpegProgress } from '@/lib/ffmpeg';
import { clipDuration, lookFfmpeg, timelineDuration, type Timeline, type TimelineClip, type TimelineFormat } from '@/lib/video-timeline';

export interface RenderMedia {
  file: Blob;
  kind: 'video' | 'audio' | 'image';
  /** It has an audio stream. */
  hasAudio: boolean;
}

export type RenderContainer = 'mp4' | 'webm' | 'gif' | 'mp3' | 'wav';
export type RenderQuality = 'low' | 'medium' | 'high';

export interface RenderOptions {
  /** Default `mp4`. */
  container?: RenderContainer;
  /** Default `medium`. */
  quality?: RenderQuality;
  /** What shows behind and between clips, as an FFmpeg colour (`black`, `#202020`). Default black. */
  background?: string;
}

export interface RenderPlan {
  args: string[];
  inputs: Record<string, Blob>;
  /** The file the command writes. */
  output: string;
  mime: string;
  /** Seconds. */
  duration: number;
}

export const renderMime: Record<RenderContainer, string> = {
  mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif', mp3: 'audio/mpeg', wav: 'audio/wav',
};

const n = (x: number) => String(Math.round(x * 1000) / 1000);
const even = (x: number) => Math.max(2, Math.round(x / 2) * 2);

/** `atempo` takes 0.5…100 per filter: chain it for slower. */
function tempo(speed: number): string[] {
  if (!(speed > 0) || !Number.isFinite(speed)) return [];
  const out: string[] = [];
  let s = speed;
  while (s < 0.5) { out.push('atempo=0.5'); s /= 0.5; }
  while (s > 100) { out.push('atempo=100'); s /= 100; }
  if (Math.abs(s - 1) > 1e-6) out.push(`atempo=${n(s)}`);
  return out;
}

/** The FFmpeg command that renders `timeline` at `format`. Throws when there's nothing to render. */
export function buildRender(timeline: Timeline, media: Record<string, RenderMedia>, format: TimelineFormat, options: RenderOptions = {}): RenderPlan {
  const container = options.container ?? 'mp4';
  const quality = options.quality ?? 'medium';
  const W = even(format.width), H = even(format.height), fps = format.fps > 0 ? format.fps : 30;
  const duration = timelineDuration(timeline);
  if (!(duration > 0)) throw new RangeError('The timeline is empty.');
  const wantVideo = container !== 'mp3' && container !== 'wav';
  const wantAudio = container !== 'gif';
  const background = (options.background ?? 'black').replace(/[^A-Za-z0-9#@.]/g, '') || 'black';

  // One file per media; one input per clip that shows or sounds.
  const files: Record<string, Blob> = {};
  const fileOf = new Map<string, string>();
  const nameFor = (id: string, m: RenderMedia) => {
    let name = fileOf.get(id);
    if (!name) {
      const ext = /\.([a-z0-9]+)$/.exec(mediaFileName(m.file))?.[1];
      name = `m${fileOf.size}${ext ? `.${ext}` : ''}`;
      fileOf.set(id, name);
      files[name] = m.file;
    }
    return name;
  };

  interface Part { clip: TimelineClip; m: RenderMedia; input: number; picture: boolean; sound: boolean; fadeIn: number; fadeOut: number; audioOut: number }
  const parts: Part[] = [];
  const args = ['-hide_banner', '-loglevel', 'error'];
  // Bottom track first, so later overlays land on top.
  for (const track of [...timeline.tracks].reverse()) {
    track.clips.forEach((clip, i) => {
      const m = media[clip.media];
      if (!m) return;
      const picture = wantVideo && track.kind === 'video' && !track.hidden && m.kind !== 'audio';
      const sound = wantAudio && m.hasAudio && m.kind !== 'image' && !track.muted && !clip.muted && (clip.volume ?? 1) > 0;
      if (!picture && !sound) return;
      const next = track.magnetic ? track.clips[i + 1] : undefined;
      parts.push({
        clip, m, input: parts.length, picture, sound,
        fadeIn: Math.max(clip.fadeIn ?? 0, track.magnetic ? clip.transition ?? 0 : 0),
        fadeOut: clip.fadeOut ?? 0,
        // The clip after dissolves in over this one: its sound fades out across the overlap.
        audioOut: Math.max(clip.fadeOut ?? 0, next?.transition ?? 0),
      });
    });
  }
  if (container === 'gif' && !parts.some((p) => p.picture)) throw new RangeError('Nothing on the timeline has a picture.');
  if (!wantVideo && !parts.some((p) => p.sound)) throw new RangeError('Nothing on the timeline makes a sound.');
  const threads = parts.length > 4 ? '1' : '2';
  for (const p of parts) {
    const name = nameFor(p.clip.media, p.m);
    if (p.m.kind === 'image') args.push('-loop', '1', '-framerate', n(fps), '-t', n(clipDuration(p.clip)), '-i', name);
    else args.push('-threads', threads, '-ss', n(p.clip.in), '-t', n(p.clip.out - p.clip.in), '-i', name);
  }

  const graph: string[] = [];
  let videoOut: string | null = null;
  if (wantVideo) {
    graph.push(`color=c=${background}:s=${W}x${H}:r=${n(fps)}:d=${n(duration)},format=yuv420p[bg]`);
    let under = 'bg';
    parts.filter((p) => p.picture).forEach((p, k) => {
      const c = p.clip;
      const d = clipDuration(c);
      const rect = c.frame ?? { x: 0, y: 0, width: 1, height: 1 };
      const w = even(rect.width * W), h = even(rect.height * H);
      const speed = c.speed || 1;
      const chain = [`setpts=PTS-STARTPTS`];
      if (p.m.kind !== 'image' && speed !== 1) chain.push(`setpts=PTS/${n(speed)}`);
      chain.push('format=yuva420p');
      if (c.fit === 'cover') chain.push(`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`);
      else chain.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2`, `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black@0`);
      chain.push('setsar=1', `fps=${n(fps)}`);
      const look = lookFfmpeg(c.look);
      if (look) chain.push(look, 'format=yuva420p');
      if (p.fadeIn > 0) chain.push(`fade=t=in:st=0:d=${n(Math.min(p.fadeIn, d))}:alpha=1`);
      if (p.fadeOut > 0) chain.push(`fade=t=out:st=${n(Math.max(0, d - p.fadeOut))}:d=${n(Math.min(p.fadeOut, d))}:alpha=1`);
      chain.push(`setpts=PTS+${n(c.start)}/TB`);
      graph.push(`[${p.input}:v]${chain.join(',')}[v${k}]`);
      graph.push(`[${under}][v${k}]overlay=x=${Math.round(rect.x * W)}:y=${Math.round(rect.y * H)}:eof_action=pass[o${k}]`);
      under = `o${k}`;
    });
    if (container === 'gif') {
      const gw = even(Math.min(W, 480));
      graph.push(`[${under}]fps=${n(Math.min(fps, 15))},scale=${gw}:-2:flags=lanczos,split[g1][g2]`);
      graph.push('[g1]palettegen=stats_mode=diff[pal]', '[g2][pal]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[vout]');
    } else graph.push(`[${under}]format=yuv420p[vout]`);
    videoOut = '[vout]';
  }

  let audioOut: string | null = null;
  const sounds = parts.filter((p) => p.sound);
  if (wantAudio && sounds.length) {
    sounds.forEach((p, k) => {
      const c = p.clip;
      const d = clipDuration(c);
      const chain = ['asetpts=PTS-STARTPTS', ...tempo(c.speed || 1), 'aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo'];
      const volume = c.volume ?? 1;
      if (volume !== 1) chain.push(`volume=${n(volume)}`);
      if (p.fadeIn > 0) chain.push(`afade=t=in:st=0:d=${n(Math.min(p.fadeIn, d))}`);
      if (p.audioOut > 0) chain.push(`afade=t=out:st=${n(Math.max(0, d - p.audioOut))}:d=${n(Math.min(p.audioOut, d))}`);
      if (c.start > 0) chain.push(`adelay=delays=${Math.round(c.start * 1000)}:all=1`);
      graph.push(`[${p.input}:a]${chain.join(',')}[a${k}]`);
    });
    const mixed = sounds.length > 1
      ? `${sounds.map((_, k) => `[a${k}]`).join('')}amix=inputs=${sounds.length}:duration=longest:dropout_transition=0:normalize=0,`
      : '[a0]';
    graph.push(`${mixed}apad,atrim=end=${n(duration)}[aout]`);
    audioOut = '[aout]';
  }

  const output = `render.${container}`;
  args.push('-filter_complex', graph.join(';'), '-filter_complex_threads', '2');
  if (videoOut) args.push('-map', videoOut);
  if (audioOut) args.push('-map', audioOut);
  const px = W * H * fps;
  switch (container) {
    case 'mp4':
      args.push('-c:v', 'mpeg4', '-q:v', { high: '2', medium: '4', low: '7' }[quality], '-pix_fmt', 'yuv420p');
      if (audioOut) args.push('-c:a', 'aac', '-b:a', quality === 'low' ? '96k' : '160k');
      args.push('-movflags', '+faststart');
      break;
    case 'webm': {
      const bpp = { high: 0.12, medium: 0.07, low: 0.035 }[quality];
      // libvpx's realtime speeds 4–10 encode alike in wasm; 16 is about three times faster for ~3 % more bytes.
      args.push('-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', quality === 'high' ? '8' : '16',
        '-b:v', `${Math.round((px * bpp) / 1000)}k`, '-crf', { high: '8', medium: '16', low: '28' }[quality], '-auto-alt-ref', '0');
      if (audioOut) args.push('-c:a', 'opus', '-strict', 'experimental', '-b:a', quality === 'low' ? '64k' : '128k');
      break;
    }
    case 'gif':
      args.push('-loop', '0');
      break;
    case 'mp3':
      args.push('-c:a', 'libmp3lame', '-b:a', { high: '256k', medium: '192k', low: '128k' }[quality]);
      break;
    case 'wav':
      args.push('-c:a', 'pcm_s16le');
      break;
  }
  args.push('-threads', '2', output);
  return { args, inputs: files, output, mime: renderMime[container], duration };
}

export interface RenderTimelineOptions extends RenderOptions {
  onProgress?: (progress: FfmpegProgress) => void;
  onLog?: (line: string) => void;
  signal?: AbortSignal;
}

/** Renders a timeline to a file. */
export async function renderTimeline(ffmpeg: Ffmpeg, timeline: Timeline, media: Record<string, RenderMedia>, format: TimelineFormat, options: RenderTimelineOptions = {}): Promise<Blob> {
  const plan = buildRender(timeline, media, format, options);
  const { files } = await ffmpeg.run({
    args: plan.args, inputs: plan.inputs, duration: plan.duration,
    onProgress: options.onProgress, onLog: options.onLog, signal: options.signal,
  });
  return new Blob([files[plan.output] as Uint8Array<ArrayBuffer>], { type: plan.mime });
}
