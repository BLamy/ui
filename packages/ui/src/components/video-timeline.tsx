'use client';
import {
  Fragment, useLayoutEffect, useRef, useState,
  type CSSProperties, type DragEvent, type ReactNode, type RefObject,
} from 'react';
import { createParts, usePart, usePrimitive, type PrimitiveHandle } from '@ui-sdk/react/primitive';
import { Slider, SliderControl, SliderThumb, SliderTrack } from '@ui-sdk/react/slider';
import { changeDetails } from '@/lib/change-details';
import { Icon } from '@/lib/icon';
import { usePlaybackState, type Playback } from '@/lib/playback';
import { cn } from '@/lib/utils';
import {
  clipDuration, clipEnd, formatTimecode, magneticIndex, quantize, timelineDuration,
  type Timeline, type TimelineClip, type TimelineTrack,
} from '@/lib/video-timeline-model';
import type { ChangeDetails } from '@ui-sdk/core';
import {
  clampTimelineZoom, timelineClipName, timelineTrackName, TIMELINE_TAIL, videoTimeline,
  type ClipSpan, type TimelineMediaInfo, type VideoTimelineOptions,
} from '@/lib/video-timeline-primitive';
import { Toggle } from '@/components/ui/toggle';

export { timelineZoomRange } from '@/lib/video-timeline-primitive';
export type {
  TimelineMediaInfo, VideoTimelineAction, VideoTimelineChangeDetails, VideoTimelineChangeReason,
  VideoTimelineSelectionReason, VideoTimelineZoomReason,
} from '@/lib/video-timeline-primitive';

/* ══ VideoTimeline — the editing surface for a lib/video-timeline-model Timeline ══
   A ruler, one lane per track behind a header (name; hide, mute and lock), the clips, and the playhead. The clips are
   UI SDK spans (lib/video-timeline-primitive): drag one to move it (along a free track; among a magnetic track's clips,
   which make room as you go; or to another track of its kind), drag either edge to trim it (the playhead follows the
   edge, so a preview shows that frame). Moves and trims land on frames and snap to clip edges, the playhead and 0
   (hold ⌥/Alt to place freely). The ruler is UI SDK's Slider for the playhead: press or drag it to scrub. ⌘/Ctrl +
   wheel, or a pinch, zooms around the pointer. Media dragged in from elsewhere (`timelineMediaType`) is reported by
   `onDropMedia(mediaId, details)` with the lane and time it was dropped on.

   `value` / `defaultValue` / `onValueChange(value, details)`, once per gesture or key, so an edit is one undo step;
   `selectedClips` / `onSelectedClipsChange(ids, details)`; `zoom` / `onZoomChange(zoom, details)`; `readOnly`.

   Keyboard: the clips are one Tab stop. ←/→ move a clip a frame (on a magnetic track, past its neighbour), ⇧←/→ move
   its end, ⌥⇧←/→ its start, ↑/↓ move it to the next track of its kind; ⌥ + an arrow moves focus to the next clip, or
   to the track above or below; Home/End reach the track's first and last clip. Enter or Space selects (⇧ adds),
   Escape clears, Delete removes the selection. On the ruler: ←/→ a frame, ⇧←/→ or Page Up/Down a second, Home/End.

   <VideoTimeline value={timeline} onValueChange={(next) => push(next)} clock={clock} media={media} /> ══ */

/** The MIME type a drag carries to drop media on the timeline (its data is the media id). */
export const timelineMediaType = 'application/x-bl-timeline-media';

export interface TimelineDrop {
  trackId: string;
  /** Timeline time under the pointer. */
  time: number;
  /** Magnetic tracks: the position among the clips. */
  index?: number;
}

/** What `onDropMedia` gets: where the media landed, and the drop's `event` and `source`. `cancel()` refuses the drop,
 *  so the browser hears it wasn't taken. */
export type TimelineDropDetails = ChangeDetails<'drop'> & TimelineDrop;

export interface VideoTimelineProps extends Omit<VideoTimelineOptions, 'playback'> {
  /** The playback clock the playhead and the ruler follow. */
  clock: Playback;
  /** A clip's content: a Filmstrip, a Waveform, a title… (default: its name). */
  renderClip?: (clip: TimelineClip, track: TimelineTrack, info: { width: number; selected: boolean }) => ReactNode;
  /** A clip's tint (border and background classes), in place of the default: primary for video, success for audio. */
  clipClassName?: (clip: TimelineClip, track: TimelineTrack) => string | undefined;
  /** Lane height in pixels. Default 64 for a magnetic video track, 44 for other video, 40 for audio. */
  trackHeight?: (track: TimelineTrack) => number;
  /** Media dragged in (`timelineMediaType`) was dropped on a lane. */
  onDropMedia?: (mediaId: string, details: TimelineDropDetails) => void;
  /** Names the timeline. Default "Timeline". */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

const HEADER = 132;
const RULER = 28;
const defaultHeight = (t: TimelineTrack) => (t.kind === 'audio' ? 40 : t.magnetic ? 64 : 44);

/** The zoom (pixels per second) that fits `duration` seconds into `width` pixels of lanes. */
export function fitTimelineZoom(duration: number, width: number): number {
  return clampTimelineZoom(duration > 0 ? (width - HEADER - 24) / duration : 60);
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

const { Scroller: TimelineScroller, Track: TimelineLane, Clip: TimelineClipPart } = createParts(videoTimeline, { scroller: 'div', track: 'div', clip: 'div' });

type Handle = PrimitiveHandle<typeof videoTimeline>;
type RootState = { value: Timeline; selectedClips: string[]; zoom: number; guide: number | null; lifted: { id: string; span: ClipSpan } | null; readOnly: boolean };

export function VideoTimeline({
  clock, renderClip, clipClassName, trackHeight = defaultHeight, onDropMedia, 'aria-label': label = 'Timeline',
  className, style, ...options
}: VideoTimelineProps) {
  const handle = usePrimitive(videoTimeline, { ...options, playback: clock } as VideoTimelineOptions);
  return usePart(handle, 'root', {}, {
    'aria-label': label,
    className: cn('relative flex min-h-0 flex-col overflow-hidden bg-background text-foreground select-none', className),
    style: { '--header': `${HEADER}px`, '--ruler': `${RULER}px`, ...style } as CSSProperties,
    children: (state: RootState) => (
      <TimelineBody state={state} handle={handle} clock={clock} fps={options.fps ?? 30} media={options.media ?? {}}
        renderClip={renderClip} clipClassName={clipClassName} trackHeight={trackHeight} onDropMedia={onDropMedia} />
    ),
  }, 'div');
}

interface BodyProps extends Pick<VideoTimelineProps, 'renderClip' | 'clipClassName' | 'onDropMedia'> {
  state: RootState;
  handle: Handle;
  clock: Playback;
  fps: number;
  media: Record<string, TimelineMediaInfo | undefined>;
  trackHeight: (track: TimelineTrack) => number;
}

function TimelineBody({ state, handle, clock, fps, media, renderClip, clipClassName, trackHeight, onDropMedia }: BodyProps) {
  const { api } = handle;
  const { value: shown, selectedClips, zoom, guide, lifted, readOnly } = state;
  const scroller = useRef<HTMLDivElement | null>(null);
  const ruler = useRef<HTMLCanvasElement | null>(null);
  const head = useRef<HTMLDivElement | null>(null);
  const [dropAt, setDropAt] = useState<TimelineDrop | null>(null);
  const [view, setView] = useState({ w: 0, left: 0 });
  const duration = timelineDuration(shown);
  const extent = Math.max(duration + TIMELINE_TAIL, (view.w - HEADER) / zoom);
  const contentW = HEADER + extent * zoom;

  // The playhead line and auto-scroll follow every tick without a render.
  useLayoutEffect(() => {
    const move = () => {
      const { time: t, playing } = clock.getState();
      const x = t * zoom;
      head.current?.style.setProperty('--ph', `${x}px`);
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

  // A wheel zoom keeps the time under the pointer where it was, once the new zoom has laid the lanes out.
  useLayoutEffect(() => {
    const sc = scroller.current;
    const left = api.zoomScroll(zoom);
    if (sc && left !== undefined) sc.scrollLeft = left;
  }, [api, zoom]);

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

  /* ── Drops from outside ── */
  const timeAtX = (clientX: number) => {
    const sc = scroller.current;
    if (!sc) return 0;
    const r = sc.getBoundingClientRect();
    return Math.max(0, (clientX - r.left - HEADER + sc.scrollLeft) / zoom);
  };
  const dropTarget = (e: DragEvent<HTMLElement>, track: TimelineTrack): TimelineDrop => {
    const t = quantize(timeAtX(e.clientX), fps);
    return { trackId: track.id, time: t, index: track.magnetic ? magneticIndex(track, t) : undefined };
  };
  const onLaneDragOver = (e: DragEvent<HTMLElement>, track: TimelineTrack) => {
    if (!onDropMedia || track.locked || readOnly || !e.dataTransfer.types.includes(timelineMediaType)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const next = dropTarget(e, track);
    setDropAt((d) => (d && d.trackId === next.trackId && d.time === next.time && d.index === next.index ? d : next));
  };
  const onLaneDrop = (e: DragEvent<HTMLElement>, track: TimelineTrack) => {
    const id = e.dataTransfer.getData(timelineMediaType);
    setDropAt(null);
    if (!onDropMedia || !id || track.locked || readOnly) return;
    const details = Object.assign(changeDetails({ reason: 'drop', event: e.nativeEvent }), dropTarget(e, track));
    onDropMedia(id, details);
    if (!details.canceled) e.preventDefault();
  };

  const lanesH = shown.tracks.reduce((h, t) => h + trackHeight(t), 0);
  const dropClip = dropAt && shown.tracks.find((t) => t.id === dropAt.trackId);
  const headerToggle = 'size-6 min-w-6 rounded-md px-0';

  return (
    <TimelineScroller ref={scroller} className="bl-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain">
      <div className="relative w-(--content)" style={{ '--content': `${contentW}px`, '--lanes': `${lanesH}px` } as CSSProperties}>
        {/* Ruler: a corner, then the scale (it stays in view while the lanes scroll under it). */}
        <div className="sticky top-0 z-30 flex h-(--ruler) w-full shadow-hairline-b">
          <div className="sticky left-0 z-10 box-border flex w-(--header) shrink-0 items-center border-r border-border bg-background px-3">
            <TimeReadout clock={clock} fps={fps} />
          </div>
          <RulerSlider clock={clock} fps={fps} max={extent} canvas={ruler} viewWidth={view.w} />
        </div>
        {/* Lanes */}
        {shown.tracks.map((track, ti) => {
          const name = timelineTrackName(track, ti);
          const editable = !readOnly;
          return (
            <div key={track.id} className="relative flex h-(--h) shadow-hairline-b" style={{ '--h': `${trackHeight(track)}px` } as CSSProperties}>
              <div className="sticky left-0 z-20 box-border flex w-(--header) shrink-0 items-center gap-0.5 border-r border-border bg-background ps-3 pe-1.5">
                <span className="min-w-0 flex-1 truncate text-caption font-semibold text-foreground/70">{name}</span>
                {track.kind === 'video' ? (
                  <Toggle size="sm" aria-label="Hide track" pressed={!!track.hidden} disabled={!editable} className={headerToggle}
                    onPressedChange={(v, d) => api.setTrack(track.id, { hidden: v }, { reason: 'press', event: d.event })}>
                    <Icon name="eye" size={14} />
                  </Toggle>
                ) : null}
                <Toggle size="sm" aria-label="Mute track" pressed={!!track.muted} disabled={!editable} className={headerToggle}
                  onPressedChange={(v, d) => api.setTrack(track.id, { muted: v }, { reason: 'press', event: d.event })}>
                  <Icon name="speaker" size={14} />
                </Toggle>
                <Toggle size="sm" aria-label="Lock track" pressed={!!track.locked} disabled={!editable} className={headerToggle}
                  onPressedChange={(v, d) => api.setTrack(track.id, { locked: v }, { reason: 'press', event: d.event })}>
                  <Icon name="lock" size={14} />
                </Toggle>
              </div>
              <TimelineLane value={track.id} aria-label={name}
                className={cn('relative min-w-0 flex-1', track.magnetic ? 'bg-secondary/60' : 'bg-secondary/30', track.locked && 'opacity-60')}
                onDragOver={(e) => onLaneDragOver(e, track)} onDragLeave={() => setDropAt(null)} onDrop={(e) => onLaneDrop(e, track)}>
                {track.clips.map((clip) => {
                  const up = lifted?.id === clip.id;
                  const left = (up ? lifted.span.start : clip.start) * zoom;
                  const width = Math.max(4, clipDuration(clip) * zoom);
                  const selected = selectedClips.includes(clip.id);
                  const clipName = timelineClipName(clip, media);
                  const box = { '--l': `${left}px`, '--w': `${width}px` } as CSSProperties;
                  return (
                    <Fragment key={clip.id}>
                      {/* An opaque underlay: a clip's tint is translucent, and a clip that dissolves in must hide the
                          tail of the one under it rather than blend with it. */}
                      <div aria-hidden data-lifted={up || undefined}
                        className="pointer-events-none absolute inset-y-1 left-(--l) w-(--w) rounded-md bg-background data-lifted:z-10" style={box} />
                      <TimelineClipPart value={clip.id}
                        aria-label={`${clipName}, ${formatTimecode(clip.start)} to ${formatTimecode(clipEnd(clip))}`}
                        data-kind={track.kind}
                        className={cn(
                          'group/clip absolute inset-y-1 left-(--l) box-border w-(--w) cursor-grab touch-none overflow-hidden rounded-md border outline-none',
                          clipClassName?.(clip, track) ?? (track.kind === 'audio' ? 'border-success/45 bg-success/18' : 'border-primary/45 bg-primary/18'),
                          'focus-visible:ring-2 focus-visible:ring-ring data-dragging:z-10 data-dragging:cursor-grabbing data-dragging:opacity-85 data-dragging:shadow-lg data-selected:border-foreground data-selected:ring-1 data-selected:ring-foreground',
                        )}
                        style={box}>
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
                          <span className="truncate">{clipName}</span>
                          {(clip.speed || 1) !== 1 ? <span className="shrink-0 rounded-sm bg-background/70 px-1 tabular-nums">{clip.speed}×</span> : null}
                        </div>
                        {editable && !track.locked ? (
                          <>
                            {/* Trim handles. They stack over a neighbour that overlaps (a dissolve), so the outgoing
                                clip's end stays reachable; the keyboard trims with ⇧ and ⌥⇧ + arrows. */}
                            <div aria-hidden data-span-edge="start" className="absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize bg-foreground/0 group-hover/clip:bg-foreground/25 group-data-selected/clip:bg-foreground/70" />
                            <div aria-hidden data-span-edge="end" className="absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize bg-foreground/0 group-hover/clip:bg-foreground/25 group-data-selected/clip:bg-foreground/70" />
                          </>
                        ) : null}
                      </TimelineClipPart>
                    </Fragment>
                  );
                })}
                {dropClip?.id === track.id && dropAt ? (
                  <div aria-hidden className="pointer-events-none absolute inset-y-0 left-(--dx) w-0.5 bg-primary" style={{ '--dx': `${(track.magnetic && dropAt.index != null ? (track.clips[dropAt.index]?.start ?? timelineDuration({ tracks: [track] })) : dropAt.time) * zoom}px` } as CSSProperties} />
                ) : null}
              </TimelineLane>
            </div>
          );
        })}
        {/* Playhead line and snap guide, over the lanes and under the headers. */}
        <div aria-hidden className="pointer-events-none absolute top-(--ruler) left-(--header) z-10 h-(--lanes) w-0">
          <div ref={head} className="absolute inset-y-0 left-0 w-px translate-x-(--ph) bg-destructive" />
          {guide != null ? <div className="absolute inset-y-0 left-(--sx) w-px bg-warning" style={{ '--sx': `${guide * zoom}px` } as CSSProperties} /> : null}
        </div>
      </div>
    </TimelineScroller>
  );
}

/** The playhead's time, re-rendered on its own as the clock ticks. */
function TimeReadout({ clock, fps }: { clock: Playback; fps: number }) {
  const time = usePlaybackState(clock, (s) => quantize(s.time, fps));
  return <span className="font-mono text-caption2 text-foreground/70 tabular-nums">{formatTimecode(time, fps)}</span>;
}

/** The ruler: UI SDK's Slider for the playhead, its value following the clock (only this re-renders as it ticks),
    over the tick canvas. Its thumb is the playhead's head. */
function RulerSlider({ clock, fps, max, canvas, viewWidth }: { clock: Playback; fps: number; max: number; canvas: RefObject<HTMLCanvasElement | null>; viewWidth: number }) {
  const time = usePlaybackState(clock, (s) => quantize(s.time, fps));
  return (
    <Slider value={Math.min(time, max)} min={0} max={max} step={1 / Math.max(1, fps)} largeStep={1}
      format={(t) => formatTimecode(t, fps)}
      onValueChange={(t, details) => {
        clock.pause();
        if (details.reason === 'drag' || details.reason === 'track-press') clock.setScrubbing(true);
        clock.seek(t);
      }}
      onValueCommit={() => clock.setScrubbing(false)}
      className="relative h-full flex-1">
      <SliderControl className="h-full w-full cursor-col-resize bg-background has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset">
        <SliderTrack className="h-full w-full">
          <canvas ref={canvas} aria-hidden className="sticky left-(--header) block h-full w-[calc(var(--view)-var(--header))] text-muted-foreground"
            style={{ '--view': `${viewWidth}px` } as CSSProperties} />
          <SliderThumb aria-label="Playhead" className="flex h-full w-[11px] items-end outline-none">
            <span className="h-3 w-full rounded-b-sm bg-destructive" />
          </SliderThumb>
        </SliderTrack>
      </SliderControl>
    </Slider>
  );
}
