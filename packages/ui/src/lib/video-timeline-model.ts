/* ══ Video timeline — the model behind a video editor ══
   Tracks of clips. A clip plays part of a media file (source `in`…`out`, at `speed`) from `start` on the timeline.
   Video tracks stack, the first track on top; the audio of every clip mixes. A `magnetic` track (the main storyline)
   keeps its clips end to end, in order: removing or trimming one closes the gap, and a clip's `transition` overlaps it
   with the one before by that many seconds (a cross-dissolve). Other tracks place clips anywhere.

   Edits are pure functions that return a new timeline, so undo is keeping the old one. Times are seconds; a format's
   `fps` turns them into frames and timecode. lib/video-render turns a timeline into an FFmpeg render;
   components/video-preview plays it; components/video-timeline edits it. ══ */

/** A rectangle in the frame, as fractions of its width and height. */
export interface ClipFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineClip {
  id: string;
  /** The media it plays: a key the app resolves (to a File for a render, a URL for the preview). */
  media: string;
  /** Where it starts on the timeline, seconds (derived on a magnetic track). */
  start: number;
  /** The part of the media it plays: source in and out points, seconds. */
  in: number;
  out: number;
  /** Playback rate: 2 plays twice as fast, so the clip lasts (out - in) / 2. Default 1. */
  speed?: number;
  /** Gain, 0…2. Default 1. */
  volume?: number;
  /** Silences this clip's audio. */
  muted?: boolean;
  /** Seconds of fade in from, and out to, nothing (black or the tracks below; silence). */
  fadeIn?: number;
  fadeOut?: number;
  /** Magnetic tracks: seconds this clip dissolves in over the one before (it starts that much earlier). */
  transition?: number;
  /** Where the picture sits in the frame (picture in picture). Default: the whole frame. */
  frame?: ClipFrame;
  /** Letterbox the picture into its frame (`contain`, the default) or fill it and crop (`cover`). */
  fit?: 'contain' | 'cover';
  /** A colour look (see `timelineLooks`). */
  look?: TimelineLook;
  /** A name to show instead of the media's. */
  label?: string;
  /** Whatever the app keeps with the clip (a title's text, a tint, …). */
  data?: Record<string, unknown>;
}

export type TrackKind = 'video' | 'audio';

export interface TimelineTrack {
  id: string;
  kind: TrackKind;
  name?: string;
  clips: TimelineClip[];
  /** The main storyline: clips butt end to end and edits ripple. */
  magnetic?: boolean;
  /** No audio from this track. */
  muted?: boolean;
  /** No picture from this track. */
  hidden?: boolean;
  /** No edits on this track. */
  locked?: boolean;
}

export interface Timeline {
  /** Top to bottom: the first video track draws over the rest. */
  tracks: TimelineTrack[];
}

/** Output geometry and frame rate. */
export interface TimelineFormat {
  width: number;
  height: number;
  fps: number;
}

/* ── Looks: the same colour treatment as a CSS filter (preview) and FFmpeg filters (render) ── */

export type TimelineLook = 'none' | 'mono' | 'noir' | 'sepia' | 'vintage' | 'vivid' | 'fade';

interface LookParams { sepia?: number; saturate?: number; contrast?: number; brightness?: number }
const LOOKS: Record<Exclude<TimelineLook, 'none'>, { label: string; p: LookParams }> = {
  mono: { label: 'Mono', p: { saturate: 0 } },
  noir: { label: 'Noir', p: { saturate: 0, contrast: 1.35, brightness: 0.95 } },
  sepia: { label: 'Sepia', p: { sepia: 1 } },
  vintage: { label: 'Vintage', p: { sepia: 0.4, saturate: 0.85, contrast: 1.08, brightness: 1.05 } },
  vivid: { label: 'Vivid', p: { saturate: 1.6, contrast: 1.1 } },
  fade: { label: 'Faded', p: { saturate: 0.7, contrast: 0.85, brightness: 1.1 } },
};
const SEPIA = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
const f3 = (n: number) => String(Math.round(n * 1000) / 1000);

/** The looks a clip can take, with their names. */
export const timelineLooks: { id: TimelineLook; label: string }[] = [
  { id: 'none', label: 'None' },
  ...Object.entries(LOOKS).map(([id, l]) => ({ id: id as TimelineLook, label: l.label })),
];

/** A look as a CSS `filter` value (for the preview), or '' for none. */
export function lookCss(look: TimelineLook | undefined): string {
  const p = look && look !== 'none' ? LOOKS[look]?.p : undefined;
  if (!p) return '';
  return [
    p.sepia != null && `sepia(${p.sepia})`,
    p.saturate != null && `saturate(${p.saturate})`,
    p.contrast != null && `contrast(${p.contrast})`,
    p.brightness != null && `brightness(${p.brightness})`,
  ].filter(Boolean).join(' ');
}

/** A look as FFmpeg filters (for a render), applied in the CSS filter's order, or '' for none. */
export function lookFfmpeg(look: TimelineLook | undefined): string {
  const p = look && look !== 'none' ? LOOKS[look]?.p : undefined;
  if (!p) return '';
  const out: string[] = [];
  if (p.sepia) {
    const a = p.sepia;
    const m = SEPIA.map((s, i) => (1 - a) * (i % 4 === 0 ? 1 : 0) + a * s);
    out.push(`colorchannelmixer=rr=${f3(m[0])}:rg=${f3(m[1])}:rb=${f3(m[2])}:gr=${f3(m[3])}:gg=${f3(m[4])}:gb=${f3(m[5])}:br=${f3(m[6])}:bg=${f3(m[7])}:bb=${f3(m[8])}`);
  }
  if (p.saturate != null) out.push(`hue=s=${f3(p.saturate)}`);
  if (p.contrast != null && p.contrast !== 1) {
    // CSS contrast is c·v + (1 - c)/2: a straight line through the middle grey, clipped.
    const c = p.contrast;
    const pts = c > 1 ? `0/0 ${f3(0.5 - 0.5 / c)}/0 ${f3(0.5 + 0.5 / c)}/1 1/1` : `0/${f3(0.5 - 0.5 * c)} 1/${f3(0.5 + 0.5 * c)}`;
    out.push(`curves=all='${pts}':interp=pchip`);
  }
  if (p.brightness != null && p.brightness !== 1) out.push(`colorchannelmixer=rr=${f3(p.brightness)}:gg=${f3(p.brightness)}:bb=${f3(p.brightness)}`);
  return out.join(',');
}

/* ── Measures ── */

/** Seconds a clip lasts on the timeline. */
export const clipDuration = (c: TimelineClip) => Math.max(0, (c.out - c.in) / (c.speed || 1));
/** Where a clip ends on the timeline. */
export const clipEnd = (c: TimelineClip) => c.start + clipDuration(c);
/** The media time showing at timeline time `t` in a clip. */
export const sourceTime = (c: TimelineClip, t: number) => c.in + (t - c.start) * (c.speed || 1);
/** Where a track's last clip ends. */
export const trackDuration = (t: TimelineTrack) => t.clips.reduce((m, c) => Math.max(m, clipEnd(c)), 0);
/** Where the timeline's last clip ends. */
export const timelineDuration = (tl: Timeline) => tl.tracks.reduce((m, t) => Math.max(m, trackDuration(t)), 0);
/** `t` on the frame grid. */
export const quantize = (t: number, fps: number) => (fps > 0 ? Math.round(t * fps) / fps : t);

/** The clips playing at `t`, per track (a free track may have several), top track first. */
export function clipsAt(tl: Timeline, t: number): { track: TimelineTrack; clip: TimelineClip }[] {
  return tl.tracks.flatMap((track) => track.clips.filter((c) => c.start <= t && t < clipEnd(c)).map((clip) => ({ track, clip })));
}

/** A clip, its track and where they are. */
export function findClip(tl: Timeline, id: string) {
  for (let ti = 0; ti < tl.tracks.length; ti++) {
    const track = tl.tracks[ti];
    const index = track.clips.findIndex((c) => c.id === id);
    if (index >= 0) return { track, trackIndex: ti, clip: track.clips[index], index };
  }
  return null;
}

/** A unique id (`clip-1a2b3c`). */
export function timelineId(prefix = 'clip'): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${r}`;
}

/* ── Layout ── */

/** A track with its clips in place: a magnetic one end to end from 0, any other sorted by start. On a magnetic track a
 *  transition overlaps the clip before it, by no more than this clip lasts nor more than the clip before has left
 *  after its own dissolve: never three clips at once. */
export function layoutTrack(track: TimelineTrack): TimelineTrack {
  if (!track.magnetic) return { ...track, clips: [...track.clips].sort((a, b) => a.start - b.start) };
  let at = 0;
  // What the clip before has left after its own dissolve.
  let room = 0;
  const clips = track.clips.map((c, i) => {
    const d = clipDuration(c);
    const tr = i > 0 && c.transition ? Math.max(0, Math.min(c.transition, d, room)) : 0;
    const start = Math.max(0, at - tr);
    const next: TimelineClip = { ...c, start };
    if (tr > 0) next.transition = tr;
    else delete next.transition;
    at = start + d;
    room = d - tr;
    return next;
  });
  return { ...track, clips };
}

const withTrack = (tl: Timeline, trackId: string, fn: (t: TimelineTrack) => TimelineTrack): Timeline => ({
  tracks: tl.tracks.map((t) => (t.id === trackId ? layoutTrack(fn(t)) : t)),
});

/* ── Edits ── */

/** Changes a clip (the track re-lays out). */
export function updateClip(tl: Timeline, id: string, patch: Partial<Omit<TimelineClip, 'id'>>): Timeline {
  const at = findClip(tl, id);
  if (!at) return tl;
  return withTrack(tl, at.track.id, (t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
}

/** Changes a track. */
export function updateTrack(tl: Timeline, id: string, patch: Partial<Omit<TimelineTrack, 'id' | 'clips'>>): Timeline {
  return { tracks: tl.tracks.map((t) => (t.id === id ? layoutTrack({ ...t, ...patch }) : t)) };
}

/** Removes clips; on a magnetic track the rest close up. */
export function removeClips(tl: Timeline, ids: readonly string[]): Timeline {
  const drop = new Set(ids);
  return {
    tracks: tl.tracks.map((t) => (t.clips.some((c) => drop.has(c.id)) ? layoutTrack({ ...t, clips: t.clips.filter((c) => !drop.has(c.id)) }) : t)),
  };
}

/** Cuts a clip in two at timeline time `at` (the second half gets `newId`). Nothing happens unless `at` is inside it,
 *  nor inside a dissolve on a magnetic track (the stretch where two clips overlap): a cut there would move the edit. */
export function splitClip(tl: Timeline, id: string, at: number, newId = timelineId()): Timeline {
  const found = findClip(tl, id);
  if (!found) return tl;
  const { clip, track, index } = found;
  if (at <= clip.start + 1e-6 || at >= clipEnd(clip) - 1e-6) return tl;
  if (track.magnetic) {
    const next = track.clips[index + 1];
    if ((clip.transition && at < clip.start + clip.transition) || (next?.transition && at > next.start)) return tl;
  }
  const cut = sourceTime(clip, at);
  const first: TimelineClip = { ...clip, out: cut };
  delete first.fadeOut;
  const second: TimelineClip = { ...clip, id: newId, in: cut, start: at };
  delete second.fadeIn;
  delete second.transition;
  return withTrack(tl, found.track.id, (t) => ({
    ...t,
    clips: t.clips.flatMap((c) => (c.id === id ? [first, second] : [c])),
  }));
}

export interface TrimLimits {
  /** The media's length: the latest `out` (Infinity for a still). */
  mediaDuration?: number;
  /** The shortest a clip may get, seconds. Default 0.1. */
  minDuration?: number;
}

/** Moves one edge of a clip to timeline time `at`. The start edge changes `in` (on a free track the clip's start moves
 *  with it and its end stays); the end edge changes `out`. On a magnetic track the clips after it ripple. */
export function trimClip(tl: Timeline, id: string, edge: 'start' | 'end', at: number, limits: TrimLimits = {}): Timeline {
  const found = findClip(tl, id);
  if (!found) return tl;
  const { clip, track } = found;
  const speed = clip.speed || 1;
  const min = (limits.minDuration ?? 0.1) * speed;
  const max = limits.mediaDuration ?? Infinity;
  if (edge === 'end') {
    const out = Math.max(clip.in + min, Math.min(max, sourceTime(clip, at)));
    return updateClip(tl, id, { out });
  }
  // Magnetic clips keep their place, so a start trim is measured from where the clip starts.
  const lowest = track.magnetic ? 0 : clip.in - clip.start * speed;
  const inPoint = Math.max(0, lowest, Math.min(clip.out - min, sourceTime(clip, at)));
  const patch: Partial<TimelineClip> = { in: inPoint };
  if (!track.magnetic) patch.start = clip.start + (inPoint - clip.in) / speed;
  return updateClip(tl, id, patch);
}

export interface PlaceOptions {
  /** The track to put it on (default: where it is). */
  trackId?: string;
  /** Free tracks: where it starts. */
  start?: number;
  /** Magnetic tracks: its position among the clips (default: by `start`, else at the end). */
  index?: number;
}

/** Where a clip lands among a magnetic track's clips when dropped at time `t`: before the first clip whose middle is later. */
export function magneticIndex(track: TimelineTrack, t: number, excludeId?: string): number {
  const clips = track.clips.filter((c) => c.id !== excludeId);
  const i = clips.findIndex((c) => t < c.start + clipDuration(c) / 2);
  return i < 0 ? clips.length : i;
}

/** Puts a new clip on a track. */
export function insertClip(tl: Timeline, trackId: string, clip: TimelineClip, place: Omit<PlaceOptions, 'trackId'> = {}): Timeline {
  return withTrack(tl, trackId, (t) => {
    if (!t.magnetic) return { ...t, clips: [...t.clips, { ...clip, start: Math.max(0, place.start ?? clip.start) }] };
    const index = place.index ?? (place.start != null ? magneticIndex(t, place.start) : t.clips.length);
    const clips = [...t.clips];
    clips.splice(Math.max(0, Math.min(index, clips.length)), 0, clip);
    return { ...t, clips };
  });
}

/** Moves a clip along its track, to another position among magnetic clips, or to another track. */
export function moveClip(tl: Timeline, id: string, place: PlaceOptions): Timeline {
  const found = findClip(tl, id);
  if (!found) return tl;
  const to = place.trackId ?? found.track.id;
  const target = tl.tracks.find((t) => t.id === to);
  if (!target) return tl;
  const clip = { ...found.clip };
  if (!target.magnetic) clip.start = Math.max(0, place.start ?? clip.start);
  else if (to !== found.track.id) delete clip.transition;
  if (to === found.track.id && target.magnetic) {
    const rest = target.clips.filter((c) => c.id !== id);
    const index = Math.max(0, Math.min(place.index ?? magneticIndex(target, place.start ?? clip.start, id), rest.length));
    rest.splice(index, 0, clip);
    return withTrack(tl, to, (t) => ({ ...t, clips: rest }));
  }
  const removed = removeClips(tl, [id]);
  return insertClip(removed, to, clip, { start: place.start ?? clip.start, index: place.index });
}

/** The part of a timeline between `from` and `to`, moved to start at 0: clips cut at the edges, the rest dropped
 *  (for rendering a range). Magnetic tracks stay magnetic. */
export function sliceTimeline(tl: Timeline, from: number, to: number): Timeline {
  return {
    tracks: tl.tracks.map((t) => {
      const clips = t.clips.flatMap((c) => {
        const s = c.start, e = clipEnd(c);
        if (e <= from || s >= to) return [];
        const speed = c.speed || 1;
        const cut: TimelineClip = { ...c };
        if (s < from) { cut.in = c.in + (from - s) * speed; cut.start = from; delete cut.fadeIn; delete cut.transition; }
        if (e > to) { cut.out = c.out - (e - to) * speed; delete cut.fadeOut; }
        cut.start -= from;
        return [cut];
      });
      return { ...t, clips };
    }),
  };
}

/* ── Snapping ── */

/** Every clip edge, 0 and any extra times, for snapping (minus the clips being dragged). */
export function snapTargets(tl: Timeline, { exclude = [], extra = [] }: { exclude?: readonly string[]; extra?: readonly number[] } = {}): number[] {
  const skip = new Set(exclude);
  const out = new Set<number>([0, ...extra]);
  for (const t of tl.tracks) for (const c of t.clips) if (!skip.has(c.id)) { out.add(c.start); out.add(clipEnd(c)); }
  return [...out].sort((a, b) => a - b);
}

/** The target nearest `t` within `threshold` seconds, else `t`. */
export function snapTime(t: number, targets: readonly number[], threshold: number): { time: number; snapped: boolean } {
  let best = t, dist = threshold;
  for (const x of targets) {
    const d = Math.abs(x - t);
    if (d <= dist) { best = x; dist = d; }
  }
  return { time: best, snapped: best !== t };
}

/* ── Timecode ── */

/** `1:02.5` (minutes, seconds and tenths), or with `fps`, SMPTE-style `00:01:02:15` (hours:minutes:seconds:frames). */
export function formatTimecode(t: number, fps?: number): string {
  const sign = t < 0 ? '-' : '';
  const a = Math.abs(t);
  if (fps && fps > 0) {
    const r = Math.round(fps);
    const total = Math.round(a * fps);
    const f = total % r, s = Math.floor(total / r);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${sign}${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(f)}`;
  }
  const tenths = Math.floor(a * 10 + 1e-6);
  const s = Math.floor(tenths / 10);
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenths % 10}`;
}

/** Reads `1:02.5`, `62.5`, `00:01:02:15` (with `fps`) or `1:02:03` back into seconds, as `formatTimecode` writes
 *  them (a leading `-` included); NaN when it can't. */
export function parseTimecode(text: string, fps?: number): number {
  let s = text.trim();
  const sign = s.startsWith('-') ? -1 : 1;
  if (sign < 0) s = s.slice(1);
  if (!s) return NaN;
  const parts = s.split(':');
  if (parts.some((p) => !/^\d*\.?\d+$/.test(p))) return NaN;
  const n = parts.map(Number);
  if (n.length === 4) {
    // Frames count at the rounded rate (non-drop-frame), as formatTimecode writes them.
    return fps ? (sign * ((n[0] * 3600 + n[1] * 60 + n[2]) * Math.round(fps) + n[3])) / fps : NaN;
  }
  return sign * n.reduce((acc, v) => acc * 60 + v, 0);
}
