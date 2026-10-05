'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/lib/icon';
import { usePlaybackState, type Playback } from '@/lib/playback';
import { cn } from '@/lib/utils';
import { clipDuration, clipEnd, formatTimecode, lookCss, type Timeline, type TimelineClip, type TimelineFormat, type TimelineTrack } from '@/lib/video-timeline';
import { Button } from '@/components/ui/button';

/* ══ VideoPreview — a timeline played live in the page ══
   Nothing is rendered ahead of time: every clip near the playhead is a <video>, <audio> or <img> of its media, laid out
   in its frame, with its look as a CSS filter and its fades as opacity and volume, bottom track first. The playback
   clock (lib/playback) owns the time and the elements follow it: they play along while it runs, are re-synced when
   they drift, seek as it scrubs, and the clips about to start are loaded ahead so a cut doesn't stall. A clip whose
   media isn't a file (a title, a shape) is drawn by `renderClip`. The picture keeps the format's aspect, as large as
   its box allows. A preview approximates the render (lib/video-render): volume can't go past 100 %, and looks are CSS. ══ */

export interface PreviewMedia {
  /** An object URL or any playable URL. */
  url: string;
  kind: 'video' | 'audio' | 'image';
}

export interface VideoPreviewProps {
  timeline: Timeline;
  /** The media clips play, by the ids clips use. */
  media: Record<string, PreviewMedia | undefined>;
  clock: Playback;
  /** The output's size (only its aspect matters here). */
  format: Pick<TimelineFormat, 'width' | 'height'>;
  /** Draws a clip itself (a title); return undefined for the default. */
  renderClip?: (clip: TimelineClip, track: TimelineTrack) => ReactNode;
  /** Seconds ahead a clip starts loading. Default 2. */
  preload?: number;
  /** Over the picture: guides, a play button, … */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface Layer {
  clip: TimelineClip;
  track: TimelineTrack;
  /** Fade-in, picture and sound (a transition is a fade-in over the clip before). */
  fadeIn: number;
  fadeOut: number;
  /** Sound fade-out: the clip after may dissolve in over this one. */
  soundOut: number;
  z: number;
}

const ramp = (local: number, d: number, fadeIn: number, fadeOut: number) =>
  Math.max(0, Math.min(1, fadeIn > 0 ? local / fadeIn : 1, fadeOut > 0 ? (d - local) / fadeOut : 1));

function layersOf(timeline: Timeline): Layer[] {
  const out: Layer[] = [];
  [...timeline.tracks].reverse().forEach((track) => {
    track.clips.forEach((clip, i) => {
      const next = track.magnetic ? track.clips[i + 1] : undefined;
      out.push({
        clip, track,
        fadeIn: Math.max(clip.fadeIn ?? 0, track.magnetic ? clip.transition ?? 0 : 0),
        fadeOut: clip.fadeOut ?? 0,
        soundOut: Math.max(clip.fadeOut ?? 0, next?.transition ?? 0),
        z: out.length,
      });
    });
  });
  return out;
}

/** The ids of the clips that should be mounted at `t`: playing, or starting within `ahead` seconds. */
const windowAt = (layers: Layer[], t: number, ahead: number) =>
  layers.filter((l) => l.clip.start - ahead <= t && t < clipEnd(l.clip) + 0.25).map((l) => l.clip.id).join('|');

export function VideoPreview({ timeline, media, clock, format, renderClip, preload = 2, children, className, style }: VideoPreviewProps) {
  const layers = layersOf(timeline);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [win, setWin] = useState(() => windowAt(layers, clock.getState().time, preload));
  const els = useRef(new Map<string, HTMLElement>());

  // Re-render only when the set of nearby clips changes; everything else is applied straight to the elements.
  useLayoutEffect(() => {
    const sync = () => {
      const { time, playing, scrubbing } = clock.getState();
      const next = windowAt(layersRef.current, time, preload);
      setWin((w) => (w === next ? w : next));
      for (const l of layersRef.current) {
        const el = els.current.get(l.clip.id);
        if (!el) continue;
        const c = l.clip;
        const d = clipDuration(c);
        const local = time - c.start;
        const live = local >= 0 && local < d;
        const speed = c.speed || 1;
        const f = live ? ramp(local, d, l.fadeIn, l.fadeOut) : 0;
        el.style.setProperty('--fade', String(f));
        if (!(el instanceof HTMLMediaElement)) continue;
        const src = c.in + Math.max(0, Math.min(d, local)) * speed;
        const quiet = l.track.muted || c.muted;
        el.muted = !!quiet;
        if (!quiet) el.volume = Math.max(0, Math.min(1, (c.volume ?? 1) * (live ? ramp(local, d, l.fadeIn, l.soundOut) : 0)));
        if (el.playbackRate !== speed) el.playbackRate = speed;
        if (live && playing && !scrubbing) {
          if (Math.abs(el.currentTime - src) > 0.25) el.currentTime = src;
          if (el.paused) void el.play().catch(() => undefined);
        } else {
          if (!el.paused) el.pause();
          // Parked on the frame the time points at (or the first, for a clip about to start).
          if (Math.abs(el.currentTime - src) > 0.02) el.currentTime = src;
        }
      }
    };
    sync();
    return clock.subscribe(sync);
  }, [clock, preload, timeline, win]);

  // Unmounting stops everything (a paused element can't keep playing).
  useEffect(() => () => { els.current.forEach((el) => { if (el instanceof HTMLMediaElement) el.pause(); }); }, []);

  const mounted = new Set(win.split('|'));
  const setEl = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
  return (
    <div data-slot="video-preview" role="group" aria-label="Preview"
      className={cn('relative grid size-full place-items-center overflow-hidden [container-type:size]', className)} style={style}>
      <div className="relative aspect-(--ar) w-[min(100cqw,calc(100cqh*var(--ar)))] overflow-hidden bg-black"
        style={{ '--ar': `${format.width} / ${format.height}` } as CSSProperties}>
        {layers.filter((l) => mounted.has(l.clip.id)).map((l) => {
          const c = l.clip;
          const m = media[c.media];
          const custom = renderClip?.(c, l.track);
          const r = c.frame;
          // Sized as well as placed: a <video> or <img> keeps its own size when only its edges are pinned.
          const box = cn('pointer-events-none absolute opacity-(--fade)', r ? 'top-(--y) left-(--x) h-(--h) w-(--w)' : 'top-0 left-0 size-full', l.track.hidden && 'invisible');
          const vars = {
            zIndex: l.z,
            '--fade': 0,
            ...(r ? { '--x': `${r.x * 100}%`, '--y': `${r.y * 100}%`, '--w': `${r.width * 100}%`, '--h': `${r.height * 100}%` } : null),
            '--look': lookCss(c.look) || 'none',
          } as CSSProperties;
          const fit = c.fit === 'cover' ? 'object-cover' : 'object-contain';
          if (custom !== undefined) return <div key={c.id} ref={setEl(c.id)} aria-hidden className={box} style={vars}>{custom}</div>;
          if (!m) return null;
          if (m.kind === 'image') return <img key={c.id} ref={setEl(c.id)} src={m.url} alt="" aria-hidden className={cn(box, fit, '[filter:var(--look)]')} style={vars} />;
          if (m.kind === 'audio' || l.track.kind === 'audio') {
            return <audio key={c.id} ref={setEl(c.id)} src={m.url} preload="auto" aria-hidden className="hidden" style={vars} />;
          }
          return (
            <video key={c.id} ref={setEl(c.id)} src={m.url} preload="auto" playsInline muted={!!(l.track.muted || c.muted)}
              aria-hidden className={cn(box, fit, '[filter:var(--look)]')} style={vars} />
          );
        })}
        {children}
      </div>
    </div>
  );
}

/* ── Transport ── */

export interface PlaybackTimecodeProps {
  clock: Playback;
  /** Frames per second: show `HH:MM:SS:FF` instead of `M:SS.t`. */
  fps?: number;
  /** Also show the duration. */
  showDuration?: boolean;
  className?: string;
}

/** The clock's time (and length), in tabular figures. */
export function PlaybackTimecode({ clock, fps, showDuration, className }: PlaybackTimecodeProps) {
  const time = usePlaybackState(clock, (s) => (fps ? Math.round(s.time * fps) / fps : Math.floor(s.time * 10) / 10));
  const duration = usePlaybackState(clock, (s) => s.duration);
  return (
    <span data-slot="playback-timecode" className={cn('font-mono text-footnote text-foreground tabular-nums', className)}>
      {formatTimecode(time, fps)}
      {showDuration ? <span className="text-foreground/60"> / {formatTimecode(duration, fps)}</span> : null}
    </span>
  );
}

export interface PlaybackControlsProps {
  clock: Playback;
  /** Frames per second, for the frame steps and the timecode. Default 30. */
  fps?: number;
  /** Show the timecode between the buttons. Default true. */
  timecode?: boolean;
  className?: string;
}

/** Start, frame back, play/pause, frame forward, end, and the time. */
export function PlaybackControls({ clock, fps = 30, timecode = true, className }: PlaybackControlsProps) {
  const playing = usePlaybackState(clock, (s) => s.playing);
  const atEnd = usePlaybackState(clock, (s) => s.duration > 0 && s.time >= s.duration);
  const step = (n: number) => { clock.pause(); clock.step(n / fps); };
  return (
    <div data-slot="playback-controls" className={cn('flex items-center gap-1', className)}>
      <Button variant="quiet" size="icon-sm" aria-label="Go to start" onPress={() => { clock.pause(); clock.seek(0); }}>
        <Icon name="backward" size={16} />
      </Button>
      <Button variant="quiet" size="icon-sm" aria-label="Previous frame" onPress={() => step(-1)}>
        <Icon name="chevL" size={16} />
      </Button>
      <Button variant="ghost" size="icon" aria-label={playing ? 'Pause' : atEnd ? 'Replay' : 'Play'} onPress={clock.toggle}>
        <Icon name={playing ? 'pause' : 'play'} size={20} />
      </Button>
      <Button variant="quiet" size="icon-sm" aria-label="Next frame" onPress={() => step(1)}>
        <Icon name="chev" size={16} />
      </Button>
      <Button variant="quiet" size="icon-sm" aria-label="Go to end" onPress={() => { clock.pause(); clock.seek(clock.getState().duration); }}>
        <Icon name="forward" size={16} />
      </Button>
      {timecode ? <PlaybackTimecode clock={clock} fps={fps} showDuration className="ms-2" /> : null}
    </div>
  );
}
