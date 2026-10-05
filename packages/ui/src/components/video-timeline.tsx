'use client';
import {
  Fragment, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type DragEvent, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode,
} from 'react';
import { Icon } from '@/lib/icon';
import { useControllableState } from '@/lib/controllable-state';
import { usePlaybackState, type Playback } from '@/lib/playback';
import { cn } from '@/lib/utils';
import {
  clipDuration, clipEnd, findClip, formatTimecode, magneticIndex, moveClip, quantize, removeClips, snapTargets, snapTime,
  timelineDuration, trimClip, updateTrack,
  type Timeline, type TimelineClip, type TimelineTrack,
} from '@/lib/video-timeline';
import { Toggle } from '@/components/ui/toggle';

/* ══ VideoTimeline — the editing surface for a lib/video-timeline Timeline ══
   A ruler, one lane per track behind a header (name; hide, mute and lock), the clips, and the playhead. Drag a clip to
   move it (along a free track; among a magnetic track's clips, which make room as you go; or to another track of its
   kind), drag either edge to trim it (the playhead follows the edge, so a preview shows that frame), and click or drag
   the ruler to scrub. Moves and trims land on frames and snap to clip edges, the playhead and 0 (hold ⌥/Alt to place
   freely). ⌘/Ctrl + wheel, or a pinch, zooms around the pointer. Media dragged in from elsewhere (`timelineMediaType`)
   is reported by `onDropMedia` with the lane and time it was dropped on.

   Controlled: it draws `timeline` and reports each edit through `onChange` once, when the gesture ends, so an edit is one
   undo step. Keyboard: Tab reaches the clips; ←/→ nudge one a frame (⇧ a second) or move it among magnetic clips,
   Delete removes the selection, Enter selects, Escape clears. The ruler is a slider: ←/→ a frame (⇧ a second),
   Home/End. ══ */

/** The MIME type a drag carries to drop media on the timeline (its data is the media id). */
export const timelineMediaType = 'application/x-bl-timeline-media';

export interface TimelineMediaInfo {
  /** Seconds (trim limit); ignored for stills. */
  duration: number;
  kind: 'video' | 'audio' | 'image';
  /** The clip label when the clip has none. */
  name?: string;
}

export interface TimelineDrop {
  trackId: string;
  /** Timeline time under the pointer. */
  time: number;
  /** Magnetic tracks: the position among the clips. */
  index?: number;
}

export interface VideoTimelineProps {
  timeline: Timeline;
  onChange?: (timeline: Timeline) => void;
  /** Media lengths (trim limits) and names (clip labels), by media id. */
  media?: Record<string, TimelineMediaInfo | undefined>;
  clock: Playback;
  /** Frames per second: edits land on frames. Default 30. */
  fps?: number;
  /** Selected clip ids. */
  selection?: readonly string[];
  defaultSelection?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Pixels per second. */
  zoom?: number;
  defaultZoom?: number;
  onZoomChange?: (zoom: number) => void;
  /** Snap to clip edges, the playhead and 0. Default true. */
  snap?: boolean;
  /** A clip's content: a Filmstrip, a Waveform, a title… (default: its name). */
  renderClip?: (clip: TimelineClip, track: TimelineTrack, info: { width: number; selected: boolean }) => ReactNode;
  /** A clip's tint (border and background classes), in place of the default: primary for video, success for audio. */
  clipClassName?: (clip: TimelineClip, track: TimelineTrack) => string | undefined;
  /** Lane height in pixels. Default 64 for a magnetic video track, 44 for other video, 40 for audio. */
  trackHeight?: (track: TimelineTrack) => number;
  /** Media dragged in (`timelineMediaType`) was dropped on a lane. */
  onDropMedia?: (mediaId: string, drop: TimelineDrop) => void;
  className?: string;
  style?: CSSProperties;
}

const HEADER = 132;
const RULER = 28;
const SNAP_PX = 8;
export const timelineZoomRange = { min: 2, max: 600 } as const;
const clampZoom = (z: number) => Math.max(timelineZoomRange.min, Math.min(timelineZoomRange.max, z));
const defaultHeight = (t: TimelineTrack) => (t.kind === 'audio' ? 40 : t.magnetic ? 64 : 44);

/** The zoom (pixels per second) that fits `duration` seconds into `width` pixels of lanes. */
export function fitTimelineZoom(duration: number, width: number): number {
  return clampZoom(duration > 0 ? (width - HEADER - 24) / duration : 60);
}

/** Ruler spacing: labelled ticks at least 64 px apart, and minor ticks between them when there's room. */
export function rulerSteps(pps: number, fps: number): { major: number; minor: number | null } {
  const f = 1 / Math.max(1, fps);
  const steps = [f, 2 * f, 5 * f, 10 * f, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const major = steps.find((s) => s * pps >= 64) ?? 3600;
  const minor = major < 0.5 ? f : major === 2 || major === 30 || major === 120 ? major / 2 : major === 15 || major === 60 || major === 900 || major === 3600 ? major / 3 : major / 5;
  return { major, minor: minor * pps >= 5 && minor < major ? minor : null };
}

function rulerLabel(t: number, major: number, fps: number): string {
  const s = Math.floor(t + 1e-6);
  const hms = s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}` : String(Math.floor(s / 60));
  const base = `${hms}:${String(s % 60).padStart(2, '0')}`;
  return major < 1 ? `${base}:${String(Math.round((t - s) * fps)).padStart(2, '0')}` : base;
}

interface Drag {
  kind: 'move' | 'start' | 'end';
  id: string;
  pointerId: number;
  x0: number;
  y0: number;
  orig: TimelineClip;
  origTrack: TimelineTrack;
  preview: Timeline;
  /** Move: where the clip is drawn (it follows the pointer) and on which lane. */
  ghost: number;
  ghostTrack: string;
  /** The time a snap guide shows. */
  snap: number | null;
  moved: boolean;
  additive: boolean;
}

export function VideoTimeline({
  timeline, onChange, media = {}, clock, fps = 30, selection: selectionProp, defaultSelection = [], onSelectionChange,
  zoom: zoomProp, defaultZoom = 60, onZoomChange, snap = true, renderClip, clipClassName, trackHeight = defaultHeight,
  onDropMedia, className, style,
}: VideoTimelineProps) {
  const [zoom, setZoom] = useControllableState(zoomProp, defaultZoom, onZoomChange);
  const [selection, setSelection] = useControllableState<string[]>(selectionProp && [...selectionProp], [...defaultSelection], onSelectionChange);
  const scroller = useRef<HTMLDivElement | null>(null);
  const ruler = useRef<HTMLCanvasElement | null>(null);
  const heads = useRef<HTMLElement[]>([]);
  const lanes = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dropAt, setDropAt] = useState<TimelineDrop | null>(null);
  const [view, setView] = useState({ w: 0, left: 0 });
  const zoomAnchor = useRef<{ time: number; x: number } | null>(null);
  const shown = drag?.preview ?? timeline;
  const duration = timelineDuration(shown);
  const contentW = HEADER + Math.max(duration + 8, (view.w - HEADER) / zoom) * zoom;
  const editable = !!onChange;

  // The playhead and auto-scroll follow every tick without a render.
  useLayoutEffect(() => {
    const move = () => {
      const { time: t, playing } = clock.getState();
      const x = t * zoom;
      heads.current.forEach((el) => el?.style.setProperty('--ph', `${x}px`));
      const sc = scroller.current;
      if (sc && playing) {
        const lanesW = sc.clientWidth - HEADER;
        if (x < sc.scrollLeft || x > sc.scrollLeft + lanesW - 24) sc.scrollLeft = Math.max(0, x - 24);
      }
    };
    move();
    return clock.subscribe(move);
  }, [clock, zoom]);

  // Viewport size and scroll, for the ruler and the content width.
  useLayoutEffect(() => {
    const sc = scroller.current;
    if (!sc) return undefined;
    const read = () => setView((v) => (v.w === sc.clientWidth && v.left === sc.scrollLeft ? v : { w: sc.clientWidth, left: sc.scrollLeft }));
    read();
    sc.addEventListener('scroll', read, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(sc);
    return () => { sc.removeEventListener('scroll', read); ro?.disconnect(); };
  }, []);

  // Zooming keeps the time under the pointer where it was. The wheel listener is native (React's is passive, and a
  // pinch must not zoom the page); it reads the latest zoom through refs.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const setZoomRef = useRef(setZoom);
  setZoomRef.current = setZoom;
  useLayoutEffect(() => {
    const a = zoomAnchor.current, sc = scroller.current;
    if (!a || !sc) return;
    zoomAnchor.current = null;
    sc.scrollLeft = Math.max(0, a.time * zoom - a.x);
  }, [zoom]);
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = sc.getBoundingClientRect();
      const x = Math.max(0, e.clientX - r.left - HEADER);
      const current = zoomRef.current;
      zoomAnchor.current = { time: (sc.scrollLeft + x) / current, x };
      setZoomRef.current(clampZoom(current * Math.exp(-e.deltaY * 0.01)));
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  // The ruler is a canvas the width of the view, redrawn as it scrolls and zooms.
  useLayoutEffect(() => {
    const c = ruler.current;
    if (!c) return;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const w = c.clientWidth, h = c.clientHeight;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const cs = getComputedStyle(c);
    g.fillStyle = cs.color;
    g.font = `10px ${cs.fontFamily}`;
    g.textBaseline = 'top';
    const { major, minor } = rulerSteps(zoom, fps);
    const t0 = view.left / zoom, t1 = (view.left + w) / zoom;
    if (minor) {
      g.globalAlpha = 0.4;
      for (let k = Math.floor(t0 / minor); k * minor <= t1; k++) g.fillRect(Math.round(k * minor * zoom - view.left), h - 5, 1, 5);
    }
    g.globalAlpha = 0.85;
    for (let k = Math.floor(t0 / major); k * major <= t1 + major; k++) {
      const x = Math.round(k * major * zoom - view.left);
      g.fillRect(x, h - 10, 1, 10);
      g.fillText(rulerLabel(k * major, major, fps), x + 4, 6);
    }
  }, [zoom, fps, view]);

  /* ── Geometry ── */
  const timeAtX = (clientX: number) => {
    const sc = scroller.current;
    if (!sc) return 0;
    const r = sc.getBoundingClientRect();
    return Math.max(0, (clientX - r.left - HEADER + sc.scrollLeft) / zoom);
  };
  const laneAtY = (clientY: number) => {
    for (const t of timeline.tracks) {
      const r = lanes.current.get(t.id)?.getBoundingClientRect();
      if (r && clientY >= r.top && clientY < r.bottom) return t;
    }
    return null;
  };
  const select = (ids: string[]) => setSelection(ids);

  /* ── Clip gestures ── */
  const begin = (e: PointerEvent<HTMLElement>, track: TimelineTrack, clip: TimelineClip, kind: Drag['kind']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) select(selection.includes(clip.id) ? selection.filter((id) => id !== clip.id) : [...selection, clip.id]);
    else if (!selection.includes(clip.id)) select([clip.id]);
    if (!editable || track.locked) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      kind, id: clip.id, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, orig: clip, origTrack: track, preview: timeline,
      ghost: clip.start, ghostTrack: track.id, snap: null, moved: false, additive,
    };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 3 && Math.abs(e.clientY - d.y0) < 3) return;
    if (!d.moved) { d.moved = true; clock.pause(); }
    const snapping = snap && !e.altKey;
    const threshold = SNAP_PX / zoom;
    const targets = snapping ? snapTargets(timeline, { exclude: [d.id], extra: [clock.getState().time] }) : [];
    if (d.kind === 'move') {
      const dur = clipDuration(d.orig);
      let s = d.orig.start + dx / zoom;
      let guide: number | null = null;
      if (snapping) {
        const a = snapTime(s, targets, threshold), b = snapTime(s + dur, targets, threshold);
        if (a.snapped && (!b.snapped || Math.abs(a.time - s) <= Math.abs(b.time - s - dur))) { s = a.time; guide = a.time; }
        else if (b.snapped) { s = b.time - dur; guide = b.time; }
      }
      s = Math.max(0, quantize(s, fps));
      const over = laneAtY(e.clientY);
      const target = over && over.kind === d.origTrack.kind && !over.locked ? over : timeline.tracks.find((t) => t.id === d.ghostTrack) ?? d.origTrack;
      const preview = target.magnetic
        ? moveClip(timeline, d.id, { trackId: target.id, index: magneticIndex(target, timeAtX(e.clientX), d.id) })
        : moveClip(timeline, d.id, { trackId: target.id, start: s });
      Object.assign(d, { preview, ghost: target.magnetic ? Math.max(0, d.orig.start + dx / zoom) : s, ghostTrack: target.id, snap: target.magnetic ? null : guide });
    } else {
      let at = (d.kind === 'start' ? d.orig.start : clipEnd(d.orig)) + dx / zoom;
      let guide: number | null = null;
      if (snapping) {
        const r = snapTime(at, targets, threshold);
        if (r.snapped) { at = r.time; guide = r.time; }
      }
      at = quantize(at, fps);
      const m = media[d.orig.media];
      const preview = trimClip(timeline, d.id, d.kind, at, { mediaDuration: m && m.kind !== 'image' ? m.duration : Infinity, minDuration: 1 / fps });
      const c = findClip(preview, d.id)?.clip;
      if (c) clock.seek(d.kind === 'start' ? c.start : Math.max(c.start, clipEnd(c) - 1 / fps));
      Object.assign(d, { preview, snap: guide });
    }
    setDrag({ ...d });
  };
  const end = (e: PointerEvent<HTMLElement>, commit = true) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (d.moved) {
      // A drag that lands where it started isn't an edit (and isn't an undo step).
      if (commit && d.preview !== timeline && JSON.stringify(d.preview) !== JSON.stringify(timeline)) onChange?.(d.preview);
    } else if (!d.additive && selection.length > 1) select([d.id]);
  };

  const onClipKey = (e: KeyboardEvent<HTMLElement>, track: TimelineTrack, clip: TimelineClip) => {
    const ids = selection.includes(clip.id) ? [...selection] : [clip.id];
    if (e.key === 'Enter') { e.preventDefault(); select(e.shiftKey ? [...new Set([...selection, clip.id])] : [clip.id]); return; }
    if (e.key === 'Escape') { select([]); return; }
    if (!editable || track.locked) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange?.(removeClips(timeline, ids));
      select([]);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      if (track.magnetic) {
        const at = findClip(timeline, clip.id);
        if (at) onChange?.(moveClip(timeline, clip.id, { index: Math.max(0, at.index + dir) }));
      } else onChange?.(moveClip(timeline, clip.id, { start: Math.max(0, quantize(clip.start + dir * (e.shiftKey ? 1 : 1 / fps), fps)) }));
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-clip-id="${CSS.escape(clip.id)}"]`)?.focus());
    }
  };

  /* ── Ruler (a slider) ── */
  const scrub = useRef<number | null>(null);
  const onRulerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    scrub.current = e.pointerId;
    clock.pause();
    clock.setScrubbing(true);
    clock.seek(quantize(timeAtX(e.clientX), fps));
  };
  const onRulerMove = (e: PointerEvent<HTMLElement>) => {
    if (scrub.current === e.pointerId) clock.seek(quantize(timeAtX(e.clientX), fps));
  };
  const onRulerUp = (e: PointerEvent<HTMLElement>) => {
    if (scrub.current !== e.pointerId) return;
    scrub.current = null;
    clock.setScrubbing(false);
  };
  const onRulerKey = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? 1 : 1 / fps;
    const now = clock.getState().time;
    const to = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? now - step
      : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? now + step
        : e.key === 'Home' ? 0
          : e.key === 'End' ? clock.getState().duration
            : e.key === 'PageUp' ? now - 10 : e.key === 'PageDown' ? now + 10 : null;
    if (to == null) return;
    e.preventDefault();
    clock.pause();
    clock.seek(quantize(to, fps));
  };

  /* ── Drops from outside ── */
  const dropTarget = (e: DragEvent<HTMLElement>, track: TimelineTrack): TimelineDrop => {
    const t = quantize(timeAtX(e.clientX), fps);
    return { trackId: track.id, time: t, index: track.magnetic ? magneticIndex(track, t) : undefined };
  };
  const onLaneDragOver = (e: DragEvent<HTMLElement>, track: TimelineTrack) => {
    if (!onDropMedia || track.locked || !e.dataTransfer.types.includes(timelineMediaType)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const next = dropTarget(e, track);
    setDropAt((d) => (d && d.trackId === next.trackId && d.time === next.time && d.index === next.index ? d : next));
  };
  const onLaneDrop = (e: DragEvent<HTMLElement>, track: TimelineTrack) => {
    const id = e.dataTransfer.getData(timelineMediaType);
    setDropAt(null);
    if (!onDropMedia || !id || track.locked) return;
    e.preventDefault();
    onDropMedia(id, dropTarget(e, track));
  };

  const setHead = (i: number) => (el: HTMLElement | null) => { if (el) heads.current[i] = el; };
  const trackName = (t: TimelineTrack, i: number) => t.name ?? (t.kind === 'audio' ? `Audio ${i + 1}` : t.magnetic ? 'Main' : `Video ${i + 1}`);
  const lanesH = shown.tracks.reduce((h, t) => h + trackHeight(t), 0);
  const dropClip = dropAt && shown.tracks.find((t) => t.id === dropAt.trackId);

  return (
    <div data-slot="video-timeline" role="group" aria-label="Timeline"
      className={cn('relative flex min-h-0 flex-col overflow-hidden bg-background text-foreground select-none', className)}
      style={{ '--header': `${HEADER}px`, '--ruler': `${RULER}px`, ...style } as CSSProperties}>
      <div ref={scroller} className="bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="relative w-(--content)" style={{ '--content': `${contentW}px`, '--lanes': `${lanesH}px` } as CSSProperties}>
          {/* Ruler: a corner, then the scale (it stays in view while the lanes scroll under it). */}
          <div className="sticky top-0 z-30 flex h-(--ruler) w-full shadow-hairline-b">
            <div className="sticky left-0 z-10 box-border flex w-(--header) shrink-0 items-center border-r border-border bg-background px-3">
              <TimeReadout clock={clock} fps={fps} />
            </div>
            <RulerSlider clock={clock} fps={fps} duration={duration}
              onPointerDown={onRulerDown} onPointerMove={onRulerMove} onPointerUp={onRulerUp} onPointerCancel={onRulerUp} onKeyDown={onRulerKey}>
              <canvas ref={ruler} aria-hidden className="sticky left-(--header) block h-full w-[calc(var(--view)-var(--header))] text-muted-foreground"
                style={{ '--view': `${view.w}px` } as CSSProperties} />
              <div ref={setHead(0)} aria-hidden className="pointer-events-none absolute top-0 left-0 h-full translate-x-(--ph)">
                <div className="absolute -left-[5px] bottom-0 h-3 w-[11px] rounded-b-sm bg-destructive" />
              </div>
            </RulerSlider>
          </div>
          {/* Lanes */}
          {shown.tracks.map((track, ti) => {
            const h = trackHeight(track);
            return (
              <div key={track.id} role="group" aria-label={trackName(track, ti)} className="relative flex h-(--h) shadow-hairline-b" style={{ '--h': `${h}px` } as CSSProperties}>
                <div className="sticky left-0 z-20 box-border flex w-(--header) shrink-0 items-center gap-0.5 border-r border-border bg-background ps-3 pe-1.5">
                  <span className="min-w-0 flex-1 truncate text-caption font-semibold text-foreground/70">{trackName(track, ti)}</span>
                  {track.kind === 'video' ? (
                    <Toggle size="sm" aria-label="Hide track" isSelected={!!track.hidden} isDisabled={!editable}
                      className="size-6 min-w-6 rounded-md px-0" onChange={(v) => onChange?.(updateTrack(timeline, track.id, { hidden: v }))}>
                      <Icon name="eye" size={14} />
                    </Toggle>
                  ) : null}
                  <Toggle size="sm" aria-label="Mute track" isSelected={!!track.muted} isDisabled={!editable}
                    className="size-6 min-w-6 rounded-md px-0" onChange={(v) => onChange?.(updateTrack(timeline, track.id, { muted: v }))}>
                    <Icon name="speaker" size={14} />
                  </Toggle>
                  <Toggle size="sm" aria-label="Lock track" isSelected={!!track.locked} isDisabled={!editable}
                    className="size-6 min-w-6 rounded-md px-0" onChange={(v) => onChange?.(updateTrack(timeline, track.id, { locked: v }))}>
                    <Icon name="lock" size={14} />
                  </Toggle>
                </div>
                <div ref={(el) => { if (el) lanes.current.set(track.id, el); else lanes.current.delete(track.id); }}
                  className={cn('relative min-w-0 flex-1', track.magnetic ? 'bg-secondary/60' : 'bg-secondary/30', track.locked && 'opacity-60')}
                  onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) { select([]); clock.seek(quantize(timeAtX(e.clientX), fps)); } }}
                  onDragOver={(e) => onLaneDragOver(e, track)} onDragLeave={() => setDropAt(null)} onDrop={(e) => onLaneDrop(e, track)}>
                  {track.clips.map((clip) => {
                    const lifted = drag?.kind === 'move' && drag.moved && drag.id === clip.id;
                    const left = (lifted ? drag.ghost : clip.start) * zoom;
                    const width = Math.max(4, clipDuration(clip) * zoom);
                    const selected = selection.includes(clip.id);
                    const m = media[clip.media];
                    const label = clip.label ?? m?.name ?? clip.media;
                    const box = { '--l': `${left}px`, '--w': `${width}px` } as CSSProperties;
                    return (
                      <Fragment key={clip.id}>
                      {/* An opaque underlay: a clip's tint is translucent, and a clip that dissolves in must hide the
                          tail of the one under it rather than blend with it. */}
                      <div aria-hidden data-lifted={lifted || undefined}
                        className="pointer-events-none absolute inset-y-1 left-(--l) w-(--w) rounded-md bg-background data-lifted:z-10" style={box} />
                      <div data-clip-id={clip.id} role="button" tabIndex={0} aria-pressed={selected}
                        aria-label={`${label}, ${formatTimecode(clip.start)} to ${formatTimecode(clipEnd(clip))}`}
                        data-selected={selected || undefined} data-lifted={lifted || undefined} data-kind={track.kind}
                        className={cn(
                          'group/clip absolute inset-y-1 left-(--l) box-border w-(--w) cursor-grab overflow-hidden rounded-md border outline-none',
                          clipClassName?.(clip, track) ?? (track.kind === 'audio' ? 'border-success/45 bg-success/18' : 'border-primary/45 bg-primary/18'),
                          'focus-visible:ring-2 focus-visible:ring-ring data-lifted:z-10 data-lifted:cursor-grabbing data-lifted:opacity-85 data-lifted:shadow-lg data-selected:border-foreground data-selected:ring-1 data-selected:ring-foreground',
                        )}
                        style={box}
                        onPointerDown={(e) => begin(e, track, clip, 'move')} onPointerMove={move} onPointerUp={(e) => end(e)} onPointerCancel={(e) => end(e, false)}
                        onKeyDown={(e) => onClipKey(e, track, clip)}>
                        <div className="pointer-events-none absolute inset-0">
                          {renderClip ? renderClip(clip, track, { width, selected }) : null}
                        </div>
                        {clip.transition ? (
                          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-(--tw) bg-linear-to-r from-background/70 to-transparent"
                            style={{ '--tw': `${clip.transition * zoom}px` } as CSSProperties} />
                        ) : null}
                        {clip.fadeIn ? <div aria-hidden className="pointer-events-none absolute top-0 left-0 h-full w-(--fw) bg-linear-to-br from-background/60 from-50% to-transparent to-50%" style={{ '--fw': `${clip.fadeIn * zoom}px` } as CSSProperties} /> : null}
                        {clip.fadeOut ? <div aria-hidden className="pointer-events-none absolute top-0 right-0 h-full w-(--fw) bg-linear-to-bl from-background/60 from-50% to-transparent to-50%" style={{ '--fw': `${clip.fadeOut * zoom}px` } as CSSProperties} /> : null}
                        <div className="pointer-events-none absolute inset-x-1.5 top-0.5 flex min-w-0 items-center gap-1 text-caption2 font-semibold text-foreground [text-shadow:0_1px_2px_var(--background)]">
                          <span className="truncate">{label}</span>
                          {(clip.speed || 1) !== 1 ? <span className="shrink-0 rounded-sm bg-background/70 px-1 tabular-nums">{clip.speed}×</span> : null}
                        </div>
                        {editable && !track.locked ? (
                          <>
                            {/* Trim handles: their moves bubble to the clip's handlers. They stack over a neighbour that
                                overlaps (a dissolve), so the outgoing clip's end stays reachable. */}
                            <div aria-hidden className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-foreground/0 group-hover/clip:bg-foreground/25 group-data-selected/clip:bg-foreground/70"
                              onPointerDown={(e) => begin(e, track, clip, 'start')} />
                            <div aria-hidden className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-foreground/0 group-hover/clip:bg-foreground/25 group-data-selected/clip:bg-foreground/70"
                              onPointerDown={(e) => begin(e, track, clip, 'end')} />
                          </>
                        ) : null}
                      </div>
                      </Fragment>
                    );
                  })}
                  {dropClip?.id === track.id && dropAt ? (
                    <div aria-hidden className="pointer-events-none absolute inset-y-0 left-(--dx) w-0.5 bg-primary" style={{ '--dx': `${(track.magnetic && dropAt.index != null ? (track.clips[dropAt.index]?.start ?? timelineDuration({ tracks: [track] })) : dropAt.time) * zoom}px` } as CSSProperties} />
                  ) : null}
                </div>
              </div>
            );
          })}
          {/* Playhead line and snap guide, over the lanes and under the headers. */}
          <div aria-hidden className="pointer-events-none absolute top-(--ruler) left-(--header) z-10 h-(--lanes) w-0">
            <div ref={setHead(1)} className="absolute inset-y-0 left-0 w-px translate-x-(--ph) bg-destructive" />
            {drag?.snap != null ? <div className="absolute inset-y-0 left-(--sx) w-px bg-warning" style={{ '--sx': `${drag.snap * zoom}px` } as CSSProperties} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The playhead's time, re-rendered on its own as the clock ticks. */
function TimeReadout({ clock, fps }: { clock: Playback; fps: number }) {
  const time = usePlaybackState(clock, (s) => quantize(s.time, fps));
  return <span className="font-mono text-caption2 text-foreground/70 tabular-nums">{formatTimecode(time, fps)}</span>;
}

type RulerSliderProps = {
  clock: Playback;
  fps: number;
  duration: number;
  children: ReactNode;
} & Pick<HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onKeyDown'>;

/** The ruler as a slider: its value follows the clock (only this element re-renders as it ticks). */
function RulerSlider({ clock, fps, duration, children, ...handlers }: RulerSliderProps) {
  const time = usePlaybackState(clock, (s) => quantize(s.time, fps));
  return (
    <div role="slider" tabIndex={0} aria-label="Playhead" aria-valuemin={0} aria-valuemax={Math.round(duration * 100) / 100}
      aria-valuenow={Math.round(time * 100) / 100} aria-valuetext={formatTimecode(time, fps)}
      className="relative h-full flex-1 cursor-col-resize bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      {...handlers}>
      {children}
    </div>
  );
}
