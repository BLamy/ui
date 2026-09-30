import {
  memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref,
} from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { AnimatePresence, motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  ReplayStage, getReplayMarkers, getReplayMeta, getReplayPointerTrack, replayPointerAt,
  type ReplayEvent, type ReplayMarker, type ReplayMarkerKind, type ReplayPointerTrack, type ReplayStageHandle,
} from '@brett_lamy/docstream/replay';
import { Icon } from '../lib/icon';
import { fades, springs, useReducedMotion } from '../lib/motion';
import { cn } from '../lib/utils';
import { Button } from './button';
import { IconSwap } from './icon-swap';
import { Skeleton } from './skeleton';
import { Slider, SliderThumb, SliderTrack } from './slider';
import { Spinner } from './spinner';
import { Tooltip, TooltipTrigger } from './tooltip';

/* ══ ReplayPreview — an rrweb session replay in a browser frame (the "rr-preview") ══
   docstream's headless ReplayStage plays the recording (rrweb loads lazily, on first render); this adds the
   chrome around it: a URL bar that follows the recording's navigations, play/pause, a scrubber with the
   recording's moments on a rail above it (clicks, console errors, failed requests, navigations, custom
   events — press one to jump there), a speed control, fullscreen, and a drawn cursor whose clicks ripple.
   Until the player is ready a poster (a page-shaped skeleton by default) holds the frame's exact size, so
   nothing jumps when the page appears.

   Motion: the poster dissolves into the page; the big play button scales out of the way and back; the play
   glyph swaps in place; ripples expand from the click point. Everything is time-driven, so scrubbing
   backwards replays them. Reduced motion keeps opacity only. Keys (focus inside the player): Space / K play
   and pause, ← → seek 5 s, J / L 10 s, < > speed, F fullscreen, Home / End jump to the ends. */

/** Named content colors: macOS window buttons. */
const TRAFFIC_LIGHTS = ['#FF5F57', '#FEBC2E', '#28C840'] as const;
const DEFAULT_SPEEDS = [1, 2, 4, 0.5];
const RIPPLE_MS = 650;

export const replayPreviewVariants = cva(
  'group/replay relative isolate flex min-w-0 flex-col overflow-hidden bg-card text-foreground outline-none data-[fullscreen]:rounded-none data-[fullscreen]:border-0',
  {
    variants: {
      chrome: {
        /** A browser window: traffic lights, URL bar, controls. */
        browser: 'rounded-[14px] border border-border shadow-[0_1px_2px_--alpha(black/6%),0_18px_40px_-18px_--alpha(black/28%)]',
        /** Just the page and its controls, in a rounded card. */
        minimal: 'rounded-[12px] border border-border',
        /** No frame: fill the parent (a hero, a lightbox). */
        none: '',
      },
    },
    defaultVariants: { chrome: 'browser' },
  },
);

/** Dot colors for each marker kind on the rail. */
export const replayMarkerVariants = cva(
  'absolute top-1/2 m-0 box-border -translate-x-1/2 -translate-y-1/2 cursor-pointer appearance-none rounded-full border-0 p-0 outline-none transition-[scale] duration-spring-snappy ease-spring-snappy data-hovered:scale-150 data-focus-visible:ring-2 data-focus-visible:ring-ring motion-reduce:transition-none',
  {
    variants: {
      kind: {
        click: 'h-2 w-[3px] rounded-[1.5px] bg-tertiary-foreground',
        error: 'size-2 bg-destructive ring-2 ring-card',
        network: 'size-2 bg-warning ring-2 ring-card',
        navigation: 'size-2 bg-primary ring-2 ring-card',
        custom: 'size-2 bg-success ring-2 ring-card',
      },
    },
    defaultVariants: { kind: 'custom' },
  },
);

export interface ReplayPreviewHandle {
  play(offset?: number): void;
  pause(offset?: number): void;
  /** Jump to `ms` from the start, keeping the play state. */
  seek(ms: number): void;
  toggle(): void;
  getCurrentTime(): number;
}

export interface ReplayPreviewProps extends VariantProps<typeof replayPreviewVariants> {
  /** The rrweb recording. */
  events: ReplayEvent[];
  /** Address shown in the URL bar (default: the recording's own URL, following its navigations). */
  url?: string;
  /** Accessible name of the player (default "Session replay"). */
  title?: string;
  /** macOS window buttons in the browser chrome (default true). */
  trafficLights?: boolean;
  /** Play/pause, scrubber, speed and fullscreen (default true). */
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  /** Where the player starts, in ms from the start. */
  initialTime?: number;
  /** Speeds the speed button cycles through; the first is the initial speed (default 1, 2, 4, 0.5). */
  speeds?: number[];
  /** Markers on the scrubber rail: `true` (default) reads them from the recording, `false` hides the rail,
   *  or pass your own. */
  markers?: boolean | ReplayMarker[];
  /** Which recorded marker kinds to show (default all). */
  markerKinds?: ReplayMarkerKind[];
  /** Draw the recorded pointer and click ripples (default true). */
  cursor?: boolean;
  /** `width` (default): the page scales to the frame's width and sets its height. `contain`: fill the frame's
   *  height (give it one) and letterbox the page. */
  fit?: 'width' | 'contain';
  /** Shown until the player is ready (default: a page-shaped skeleton). */
  poster?: ReactNode;
  /** Mount the player only once the frame nears the viewport (default true). */
  lazy?: boolean;
  /** Imperative control (play, pause, seek). */
  playerRef?: Ref<ReplayPreviewHandle | null>;
  onTimeUpdate?: (ms: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onMarkerPress?: (marker: ReplayMarker) => void;
  className?: string;
  style?: CSSProperties;
}

export function formatReplayTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MARKER_NOUN: Record<ReplayMarkerKind, string> = {
  click: 'Click', error: 'Error', network: 'Request failed', navigation: 'Navigation', custom: 'Checkpoint',
};

export function ReplayPreview({
  events, url, title = 'Session replay', chrome = 'browser', trafficLights = true, controls = true,
  autoplay = false, loop = false, initialTime = 0, speeds = DEFAULT_SPEEDS, markers = true, markerKinds,
  cursor = true, fit = 'width', poster, lazy = true, playerRef, onTimeUpdate, onPlayingChange, onMarkerPress,
  className, style,
}: ReplayPreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stage = useRef<ReplayStageHandle>(null);
  const meta = useMemo(() => getReplayMeta(events), [events]);
  const track = useMemo(() => getReplayPointerTrack(events), [events]);
  const recorded = useMemo(() => getReplayMarkers(events), [events]);
  const shown = useMemo(() => {
    const list = Array.isArray(markers) ? markers : markers ? recorded : [];
    return markerKinds ? list.filter((m) => markerKinds.includes(m.kind)) : list;
  }, [markers, recorded, markerKinds]);

  const [visible, setVisible] = useState(!lazy);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const duration = meta.duration;
  const speed = speeds[speedIndex % speeds.length] ?? 1;

  // Lazy mount: start the player (and fetch rrweb) once the frame is near the viewport.
  useEffect(() => {
    if (visible) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '240px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const handle = useMemo<ReplayPreviewHandle>(() => ({
    play: (offset) => { setFinished(false); stage.current?.play(offset); },
    pause: (offset) => stage.current?.pause(offset),
    seek: (ms) => { setFinished(false); stage.current?.seek(ms); },
    toggle: () => { setFinished(false); stage.current?.toggle(); },
    getCurrentTime: () => stage.current?.getCurrentTime() ?? 0,
  }), []);
  useImperativeHandle(playerRef, () => handle, [handle]);

  const onTime = useCallback((ms: number) => { setTime(ms); onTimeUpdate?.(ms); }, [onTimeUpdate]);
  const onPlaying = useCallback((p: boolean) => { setPlaying(p); onPlayingChange?.(p); }, [onPlayingChange]);

  const toggle = () => handle.toggle();
  const seekBy = (d: number) => handle.seek(Math.max(0, Math.min(duration, time + d)));
  const cycleSpeed = (d = 1) => setSpeedIndex((i) => (i + d + speeds.length) % speeds.length);
  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  };
  const jumpTo = (m: ReplayMarker) => {
    handle.seek(Math.max(0, m.time - 250));
    onMarkerPress?.(m);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input:not([type=range]), textarea, [contenteditable=true]')) return;
    const onSlider = target.matches('input[type=range]');
    const run = (fn: () => void) => { e.preventDefault(); fn(); };
    switch (e.key) {
      case ' ': case 'k': case 'K': if (target.closest('button') && e.key === ' ') return; return run(toggle);
      case 'ArrowLeft': if (onSlider) return; return run(() => seekBy(-5000));
      case 'ArrowRight': if (onSlider) return; return run(() => seekBy(5000));
      case 'j': case 'J': return run(() => seekBy(-10000));
      case 'l': case 'L': return run(() => seekBy(10000));
      case 'Home': if (onSlider) return; return run(() => handle.seek(0));
      case 'End': if (onSlider) return; return run(() => handle.seek(duration));
      case '>': case '.': return run(() => cycleSpeed(1));
      case '<': case ',': return run(() => cycleSpeed(-1));
      case 'f': case 'F': return run(toggleFullscreen);
    }
  };

  // The URL bar follows the recording: the latest navigation at or before the playhead.
  const href = useMemo(() => {
    if (url) return url;
    let current = meta.href ?? '';
    for (const m of recorded) if (m.kind === 'navigation' && m.time <= time && m.detail) current = m.detail;
    return current;
  }, [url, meta.href, recorded, time]);

  const w = meta.width || 1280;
  const h = meta.height || 800;
  const contain = fit === 'contain' || fullscreen;

  return (
    <div
      ref={rootRef}
      data-slot="replay-preview"
      data-chrome={chrome}
      data-state={!ready ? 'loading' : playing ? 'playing' : 'paused'}
      data-fullscreen={fullscreen || undefined}
      role="group"
      aria-label={title}
      aria-busy={!ready || undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      // A click anywhere in the player (the page, the frame) makes its keys live, without a focus ring.
      onPointerDown={() => {
        const root = rootRef.current;
        if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
      }}
      className={cn(replayPreviewVariants({ chrome }), contain && 'h-full', className)}
      style={style}
    >
      {chrome === 'browser' ? <BrowserBar href={href} trafficLights={trafficLights} loading={!ready && meta.playable} /> : null}

      <div
        data-slot="replay-preview-stage"
        className={cn('relative min-h-0 overflow-hidden bg-muted', contain ? 'flex-1' : 'aspect-(--replay-ar)')}
        style={{ '--replay-ar': `${w} / ${h}` } as CSSProperties}
      >
        {visible && meta.playable ? (
          <ReplayStage
            ref={stage}
            events={events}
            fit="contain"
            speed={speed}
            loop={loop}
            autoplay={autoplay}
            initialTime={initialTime}
            showMouse={false}
            className="absolute! inset-0"
            overlay={cursor ? <PointerOverlay track={track} time={time} /> : null}
            onReady={() => setReady(true)}
            onTimeUpdate={onTime}
            onPlayingChange={onPlaying}
            onFinish={() => setFinished(true)}
          />
        ) : null}

        <AnimatePresence initial={false}>
          {!ready ? (
            <motion.div
              key="poster"
              data-slot="replay-preview-poster"
              className="absolute inset-0 z-10"
              exit={{ opacity: 0, transition: fades.out }}
            >
              {poster ?? <PagePoster empty={!meta.playable} />}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {controls ? (
          <CenterPlay
            show={ready && !playing}
            finished={finished}
            // The overlay leaves as playback starts; keep focus (and the keys) in the player.
            onPress={() => { rootRef.current?.focus({ preventScroll: true }); toggle(); }}
          />
        ) : null}
      </div>

      {controls ? (
        <div data-slot="replay-preview-controls" className="flex h-11 shrink-0 items-center gap-1 border-t border-border bg-card px-1.5">
          <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" aria-label={playing ? 'Pause' : 'Play'} onPress={toggle} isDisabled={!ready}>
            <IconSwap id={playing ? 'pause' : 'play'}>
              <Icon name={playing ? 'pause' : 'play'} size={15} />
            </IconSwap>
          </Button>
          <span className="w-[74px] shrink-0 text-[11.5px] font-medium text-muted-foreground tabular-nums">
            <span className="text-foreground">{formatReplayTime(time)}</span> / {formatReplayTime(duration)}
          </span>
          <Scrubber
            time={time}
            duration={duration}
            markers={shown}
            disabled={!ready}
            onSeek={(ms) => handle.seek(ms)}
            onMarker={jumpTo}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 min-w-[42px] shrink-0 rounded-md px-1.5 text-[12px] tabular-nums"
            aria-label={`Playback speed ${speed}×`}
            onPress={() => cycleSpeed(1)}
          >
            {`${speed}×`}
          </Button>
          <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onPress={toggleFullscreen}>
            <IconSwap id={fullscreen ? 'collapse' : 'expand'}>
              <Icon name={fullscreen ? 'arrows-collapse' : 'arrows-expand'} size={15} sw={2} />
            </IconSwap>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ── parts ───────────────────────────────────────────────────────────────────────── */

function BrowserBar({ href, trafficLights, loading }: { href: string; trafficLights: boolean; loading: boolean }) {
  const shown = href.replace(/^https?:\/\//, '');
  const slash = shown.indexOf('/');
  const host = slash < 0 ? shown : shown.slice(0, slash);
  const path = slash < 0 ? '' : shown.slice(slash);
  return (
    <div data-slot="replay-preview-bar" className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-muted/60 px-3.5">
      {trafficLights ? (
        <span aria-hidden="true" className="flex shrink-0 gap-[7px]">
          {TRAFFIC_LIGHTS.map((c) => (
            <span key={c} className="size-[11px] rounded-full bg-(--light) shadow-[inset_0_0_0_.5px_--alpha(black/12%)]" style={{ '--light': c } as CSSProperties} />
          ))}
        </span>
      ) : null}
      <div className="mx-auto flex h-[26px] w-full max-w-[460px] min-w-0 items-center justify-center gap-1.5 rounded-[7px] bg-background px-2.5 text-[12px] shadow-[inset_0_0_0_1px_var(--border)]">
        <span className="grid size-3 shrink-0 place-items-center text-tertiary-foreground">
          {loading ? <Spinner size={11} /> : <Icon name="lock-fill" size={10} />}
        </span>
        <span className="min-w-0 truncate" title={href}>
          <span className="text-foreground">{host}</span>
          <span className="text-muted-foreground">{path}</span>
        </span>
      </div>
      {trafficLights ? <span aria-hidden="true" className="w-[47px] shrink-0" /> : null}
    </div>
  );
}

/** The recorded pointer and its click ripples, in recorded-viewport coordinates. Everything is a function of
 *  the playhead, so scrubbing backwards replays the ripples too. */
const PointerOverlay = memo(function PointerOverlay({ track, time }: { track: ReplayPointerTrack; time: number }) {
  const reduced = useReducedMotion();
  const at = replayPointerAt(track, time);
  const ripples = track.clicks.filter((c) => time >= c.time && time - c.time < RIPPLE_MS);
  return (
    <div data-slot="replay-preview-pointer" aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {ripples.map((c) => {
        const p = (time - c.time) / RIPPLE_MS;
        const ease = 1 - (1 - p) ** 3;
        return (
          <span
            key={c.time}
            className="absolute size-11 origin-center rounded-full border-2 border-primary bg-primary/20"
            style={{
              left: c.x, top: c.y,
              transform: `translate(-50%, -50%) scale(calc(${reduced ? 0.8 : 0.25 + ease * 1.05} / var(--replay-scale, 1)))`,
              opacity: 1 - p,
            }}
          />
        );
      })}
      {at ? (
        <svg
          viewBox="0 0 20 24" width="20" height="24"
          className="absolute origin-top-left drop-shadow-[0_1px_1.5px_--alpha(black/35%)]"
          style={{ left: at.x - 2, top: at.y - 1, transform: 'scale(calc(1 / var(--replay-scale, 1)))' }}
        >
          <path d="M2.5 1.5v18.2l4.7-4.5 3 6.8 3.1-1.4-3-6.6h6.5z" className="fill-black stroke-white" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  );
});

function CenterPlay({ show, finished, onPress }: { show: boolean; finished: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="center"
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.15, transition: { ...fades.out, scale: springs.snappy } }}
          transition={reduced ? { duration: 0.12 } : { opacity: fades.in, scale: springs.bouncy }}
        >
          <AriaButton
            aria-label={finished ? 'Replay from the start' : 'Play'}
            onPress={onPress}
            // Mouse users get the big target; keyboard users already have the play button in the bar.
            excludeFromTabOrder
            className="pointer-events-auto grid size-14 cursor-pointer border-0 p-0 place-items-center rounded-full bg-foreground/72 text-background shadow-[0_8px_24px_--alpha(black/25%)] backdrop-blur-md outline-none transition-[scale] duration-spring-snappy ease-spring-snappy data-hovered:scale-105 data-pressed:scale-95 motion-reduce:transition-none"
          >
            <Icon name={finished ? 'arrow-counterclockwise' : 'play'} size={22} sw={2.4} className={finished ? '' : 'translate-x-px'} />
          </AriaButton>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Scrubber({ time, duration, markers, disabled, onSeek, onMarker }: {
  time: number; duration: number; markers: ReplayMarker[]; disabled: boolean;
  onSeek: (ms: number) => void; onMarker: (m: ReplayMarker) => void;
}) {
  const max = Math.max(1, duration);
  // Dots closer than ~1.5% of the timeline would sit on top of each other: step each one 10px right of the last.
  const nudges = useMemo(() => {
    const out = new Map<string, number>();
    let last: { time: number; n: number } | null = null;
    for (const m of [...markers].sort((a, b) => a.time - b.time)) {
      if (m.kind === 'click') continue;
      const n: number = last && m.time - last.time < max * 0.015 ? last.n + 1 : 0;
      out.set(m.id, n);
      last = { time: m.time, n };
    }
    return out;
  }, [markers, max]);
  return (
    <div data-slot="replay-preview-scrubber" className="relative flex min-w-0 flex-1 flex-col justify-center self-stretch px-1">
      {markers.length ? (
        <div data-slot="replay-preview-markers" className="absolute inset-x-1 top-[3px] mx-[6px] h-2.5">
          {markers.map((m) => (
            <TooltipTrigger key={m.id} delay={150}>
              <AriaButton
                aria-label={`${m.label} at ${formatReplayTime(m.time)}`}
                data-kind={m.kind}
                className={cn(replayMarkerVariants({ kind: m.kind }))}
                style={{ left: `calc(${(m.time / max) * 100}% + ${(nudges.get(m.id) ?? 0) * 10}px)` }}
                onPress={() => onMarker(m)}
                isDisabled={disabled}
              />
              <Tooltip placement="top">
                <span className="block text-[12px] leading-4">
                  <span className="opacity-60">{formatReplayTime(m.time)} · {MARKER_NOUN[m.kind]}</span>
                  <br />
                  {m.detail ? `${m.label} — ${m.detail}` : m.label}
                </span>
              </Tooltip>
            </TooltipTrigger>
          ))}
        </div>
      ) : null}
      <Slider
        aria-label="Playback position"
        size="sm"
        minValue={0}
        maxValue={max}
        step={10}
        value={Math.min(time, max)}
        onChange={(v) => onSeek(v as number)}
        isDisabled={disabled}
        className={cn(markers.length && 'translate-y-[5px]')}
        formatOptions={{ style: 'decimal', maximumFractionDigits: 0 }}
      >
        <SliderTrack className="col-span-2">
          <SliderThumb />
        </SliderTrack>
      </Slider>
    </div>
  );
}

/** A page-shaped placeholder: header, hero lines and a card grid, sized to the frame. */
function PagePoster({ empty }: { empty: boolean }) {
  return (
    <div className="relative flex size-full flex-col gap-[6%] bg-background p-[4%]">
      <div className="flex items-center gap-[3%]">
        <Skeleton className="h-[5%] min-h-2 w-[12%]" shape="text" />
        <Skeleton className="h-[5%] min-h-2 w-[8%]" shape="text" />
        <Skeleton className="h-[5%] min-h-2 w-[8%]" shape="text" />
        <span className="flex-1" />
        <Skeleton className="h-[5%] min-h-3 w-[9%]" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-[38%]" shape="text" />
        <Skeleton className="h-2 w-[24%]" shape="text" />
      </div>
      <div className="grid flex-1 grid-cols-4 gap-[2.5%]">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[70%]" />)}
      </div>
      {empty ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-card px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground shadow-[0_0_0_1px_var(--border),0_4px_16px_--alpha(black/8%)]">
            This recording has no page snapshot to play
          </span>
        </span>
      ) : null}
    </div>
  );
}

export type { ReplayEvent, ReplayMarker, ReplayMarkerKind };
