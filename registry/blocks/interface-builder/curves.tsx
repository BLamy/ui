/* The transition editor, Framer's: pick a spring, an easing curve or instant; shape the spring by its feel (time and
   bounce: drag the curve's first peak) or its physics (stiffness, damping, mass); shape a bezier by dragging its two
   control points (or with the arrow keys); and watch it play. Every graph samples framer-motion's own generators,
   and the preview plays the transition with framer-motion's `animate`, so what you see is what runs. */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AreaReason, AreaValue } from '@ui-sdk/core';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from 'framer-motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  bezierOf, codeOf, cssOf, describe, EASE_PRESETS, easeFn, fromPeak, instantSpec, round, sample, sameEase, SPRING_PRESETS, springPeak, springSpec,
  syncSpring, timeOf, toFramer, physicsOf, tweenSpec, type Bezier, type Ease, type EaseName, type SpringSpec, type TransitionSpec, type TweenSpec,
} from './easing';
import { NumberInput } from './fields';
import { pointPad, type PointPadChangeDetails, type PointPadOptions } from './point-pad';

/* ── Thumbnails ── */

/** A transition's curve as a little sparkline (value over time). */
export function CurveThumb({ spec, w = 34, h = 20, className }: { spec: TransitionSpec; w?: number; h?: number; className?: string }) {
  const d = useMemo(() => {
    if (spec.type === 'instant') return `M 2 ${h - 3} L ${w / 2} ${h - 3} L ${w / 2} 3 L ${w - 2} 3`;
    const s = sample(spec);
    const pts = Array.from({ length: 33 }, (_, i) => s.at((i / 32) * s.duration));
    const lo = Math.min(0, ...pts), hi = Math.max(1, ...pts);
    return pts.map((v, i) => `${i ? 'L' : 'M'} ${2 + (i / 32) * (w - 4)} ${3 + ((hi - v) / (hi - lo)) * (h - 6)}`).join(' ');
  }, [spec, w, h]);
  return (
    <svg aria-hidden="true" width={w} height={h} className={cn('shrink-0', className)}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A named easing as a little curve (for the preset grid). */
function EaseThumb({ ease, size = 22 }: { ease: Ease; size?: number }) {
  return <CurveThumb spec={tweenSpec(1, ease)} w={size} h={size} />;
}

/* ── The bezier editor ── */

const W = 280, H = 190, PAD = 16;

/** Close cubic-bezier stand-ins for framer-motion's function easings, to start editing one from. */
const APPROX: Partial<Record<EaseName, Bezier>> = {
  circIn: [0.55, 0, 1, 0.45],
  circOut: [0, 0.55, 0.45, 1],
  circInOut: [0.85, 0, 0.15, 1],
  backIn: [0.36, 0, 0.66, -0.56],
  backInOut: [0.68, -0.6, 0.32, 1.6],
  anticipate: [0.6, -0.28, 0.73, 0.05],
};

const editable = (e: Ease): Bezier => bezierOf(e) ?? APPROX[e as EaseName] ?? [0.25, 0.1, 0.25, 1];

export interface CurveEditorProps {
  ease: Ease;
  onChange: (e: Ease, live: boolean) => void;
  onBegin?: () => void;
  /** The preview's time through the motion (0–1): a dot rides the curve. */
  time?: MotionValue<number>;
}

/** A graph's plotting box over its SVG, as insets in percent of the SVG's viewBox (`w` × `h`, `PAD` all round). */
const plotInsets = (w: number, h: number): CSSProperties => ({ left: `${(PAD / w) * 100}%`, right: `${(PAD / w) * 100}%`, top: `${(PAD / h) * 100}%`, bottom: `${(PAD / h) * 100}%` });

/** A range on the 0.05 grid, so a step of 0.01 from its bottom lands on round values. */
const onGrid = ([lo, hi]: [number, number]): [number, number] => [Math.floor(lo * 20) / 20, Math.ceil(hi * 20) / 20];

const { Thumb: PointThumb } = createParts(pointPad, { thumb: 'span' });

/** One draggable point on a graph: the plotting box (`pointPad`'s pad, which lets presses through to the graph)
    and its thumb, a 2D slider. */
function GraphPoint({ label, active, insets, className, ...options }: PointPadOptions & { label: string; active: boolean; insets: CSSProperties; className?: string }) {
  const handle = usePrimitive(pointPad, options);
  return usePart(handle, 'pad', {}, {
    className: 'pointer-events-none absolute',
    style: insets,
    children: (
      <PointThumb
        aria-label={label}
        className={cn(
          'pointer-events-auto box-border size-[15px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-[2.5px] border-primary bg-background outline-none transition-[scale] duration-150 focus-visible:border-4 active:cursor-grabbing',
          active && 'scale-120',
          className,
        )}
      />
    ),
  }, 'div');
}

/** The undo step and the still scale of a gesture on a graph's point: the scale holds still while a point is
    dragged, so the point stays under the pointer. */
function useGraphGesture<T>(onBegin?: () => void) {
  const frozen = useRef<T | null>(null);
  const [active, setActive] = useState<number | null>(null);
  return {
    frozen,
    active,
    /** A change to point `i`: `live` while a press or a drag runs (the first one checkpoints and freezes `scale`). */
    change(i: number, reason: AreaReason, scale: T) {
      const live = reason !== 'step-key';
      if (live && frozen.current === null) { frozen.current = scale; setActive(i); onBegin?.(); }
      return live;
    },
    end() { frozen.current = null; setActive(null); },
  };
}

/** A cubic bezier you shape by dragging its two control points (or focusing one and using the arrow keys). */
export function CurveEditor({ ease, onChange, onBegin, time }: CurveEditorProps) {
  const b = editable(ease);
  const isFunction = !bezierOf(ease);
  const fn = useMemo(() => easeFn(ease), [ease]);
  const samples = useMemo(() => Array.from({ length: 65 }, (_, i) => fn(i / 64)), [fn]);
  const natural = useMemo((): [number, number] => {
    const ys = [...samples, b[1], b[3]];
    return onGrid([Math.min(-0.2, Math.min(...ys) - 0.08), Math.max(1.2, Math.max(...ys) + 0.08)]);
  }, [samples, b]);
  const gesture = useGraphGesture<[number, number]>(onBegin);
  const [lo, hi] = gesture.frozen.current ?? natural;
  const X = (x: number) => PAD + x * (W - 2 * PAD);
  const Y = (y: number) => PAD + ((hi - y) / (hi - lo)) * (H - 2 * PAD);
  const set = (which: 0 | 1, p: AreaValue, details: PointPadChangeDetails) => {
    const live = gesture.change(which, details.reason, natural);
    const next: Bezier = [...b] as Bezier;
    next[which * 2] = round(Math.max(0, Math.min(1, p.x)), 3);
    next[which * 2 + 1] = round(Math.max(-1.5, Math.min(2.5, p.y)), 3);
    onChange(next, live);
  };

  const curve = isFunction
    ? samples.map((v, i) => `${i ? 'L' : 'M'} ${X(i / 64)} ${Y(v)}`).join(' ')
    : `M ${X(0)} ${Y(0)} C ${X(b[0])} ${Y(b[1])}, ${X(b[2])} ${Y(b[3])}, ${X(1)} ${Y(1)}`;
  const still = useMotionValue(0);
  const dotX = useTransform(time ?? still, (t) => X(Math.max(0, Math.min(1, t))));
  const dotY = useTransform(time ?? still, (t) => Y(fn(Math.max(0, Math.min(1, t)))));
  const active = gesture.active;

  return (
    <div className="relative" role="group" aria-label="Easing curve">
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} className="block w-full rounded-lg bg-background shadow-hairline">
        {/* The unit square and a grid at quarters; linear for reference. */}
        <rect x={X(0)} y={Y(1)} width={X(1) - X(0)} height={Y(0) - Y(1)} fill="var(--secondary)" opacity={0.55} rx={3} />
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g} stroke="var(--border)" strokeWidth={1}>
            <line x1={X(g)} x2={X(g)} y1={Y(0)} y2={Y(1)} />
            <line x1={X(0)} x2={X(1)} y1={Y(g)} y2={Y(g)} />
          </g>
        ))}
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--muted-foreground)" strokeOpacity={0.35} strokeDasharray="3 4" />
        {/* Handles */}
        <g opacity={isFunction ? 0.45 : 1}>
          <line x1={X(0)} y1={Y(0)} x2={X(b[0])} y2={Y(b[1])} stroke="var(--primary)" strokeWidth={1.4} />
          <line x1={X(1)} y1={Y(1)} x2={X(b[2])} y2={Y(b[3])} stroke="var(--primary)" strokeWidth={1.4} />
        </g>
        <path d={curve} fill="none" stroke="var(--foreground)" strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={X(0)} cy={Y(0)} r={3.5} fill="var(--foreground)" />
        <circle cx={X(1)} cy={Y(1)} r={3.5} fill="var(--foreground)" />
        {time ? <motion.circle cx={dotX} cy={dotY} r={5} fill="var(--primary)" stroke="var(--background)" strokeWidth={2} /> : null}
      </svg>
      {([0, 1] as const).map((i) => (
        <GraphPoint
          key={i}
          label={`Control point ${i + 1}`}
          active={active === i}
          insets={plotInsets(W, H)}
          value={{ x: b[i * 2], y: b[i * 2 + 1] }}
          x={{ min: 0, max: 1, step: 0.01, label: 'x' }}
          y={{ min: lo, max: hi, step: 0.01, label: 'y' }}
          valueText={(v) => `x ${round(v.x, 2)}, y ${round(v.y, 2)}`}
          onValueChange={(v, details) => set(i, v, details)}
          onValueCommit={(_, details) => { if (details.reason !== 'step-key') gesture.end(); }}
        />
      ))}
      {active !== null ? (
        <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-primary px-1.5 py-0.5 font-mono text-caption2 text-primary-foreground tabular-nums">
          {round(b[active * 2], 2)}, {round(b[active * 2 + 1], 2)}
        </span>
      ) : null}
    </div>
  );
}

/* ── The spring graph ── */

export interface SpringGraphProps {
  spec: SpringSpec;
  onChange: (s: SpringSpec, live: boolean) => void;
  onBegin?: () => void;
  /** The preview's time (ms): a dot rides the curve. */
  ms?: MotionValue<number>;
}

interface SpringScale { tmax: number; lo: number; hi: number }

/** A spring's motion over time. In Time mode its first peak is a handle: drag it (or step it with the arrow keys)
    later or earlier for a longer or shorter spring, higher or lower for more or less bounce. */
export function SpringGraph({ spec, onChange, onBegin, ms }: SpringGraphProps) {
  const s = sample(spec);
  const natural = useMemo((): SpringScale => {
    const tmax = Math.max(s.duration, spec.duration * 1000 * 1.6, 300) * 1.08;
    const pts = Array.from({ length: 121 }, (_, i) => s.at((i / 120) * tmax));
    const [lo, hi] = onGrid([Math.min(-0.08, Math.min(...pts) - 0.05), Math.max(1.25, Math.max(...pts) + 0.12)]);
    return { tmax, lo, hi };
  }, [s, spec.duration]);
  const gesture = useGraphGesture<SpringScale>(onBegin);
  const { tmax, lo, hi } = gesture.frozen.current ?? natural;
  const GH = 150;
  const X = (t: number) => PAD + (t / tmax) * (W - 2 * PAD);
  const Y = (v: number) => PAD + ((hi - v) / (hi - lo)) * (GH - 2 * PAD);
  const path = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * tmax;
    return `${i ? 'L' : 'M'} ${X(t)} ${Y(s.at(t))}`;
  }).join(' ');
  const time = spec.mode === 'time';
  const peak = springPeak(spec.duration, spec.bounce);
  // The handle: the first peak, or with no bounce the duration on the target line.
  const handle = time ? (peak ? { t: peak.t * 1000, v: 1 + peak.over } : { t: spec.duration * 1000, v: 1 }) : null;
  const set = (p: AreaValue, details: PointPadChangeDetails) => {
    const live = gesture.change(0, details.reason, natural);
    const t = Math.max(20, p.x);
    const over = p.y - 1;
    const next = over > 0.004 ? fromPeak(t / 1000, over) : { duration: t / 1000, bounce: 0 };
    onChange(syncSpring({ ...spec, duration: round(Math.max(0.05, Math.min(10, next.duration)), 2), bounce: round(Math.max(0, Math.min(1, next.bounce)), 2) }), live);
  };
  const still = useMotionValue(0);
  const dotX = useTransform(ms ?? still, (t) => X(Math.max(0, Math.min(tmax, t))));
  const dotY = useTransform(ms ?? still, (t) => Y(s.at(Math.max(0, t))));

  return (
    <div className="relative" role="group" aria-label="Spring curve">
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${GH}`} className="block w-full rounded-lg bg-background shadow-hairline">
        <line x1={X(0)} x2={X(tmax)} y1={Y(1)} y2={Y(1)} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeDasharray="3 4" />
        <line x1={X(0)} x2={X(tmax)} y1={Y(0)} y2={Y(0)} stroke="var(--border)" />
        {time ? (
          <g>
            <line x1={X(spec.duration * 1000)} x2={X(spec.duration * 1000)} y1={Y(hi) + 4} y2={Y(lo) - 2} stroke="var(--primary)" strokeOpacity={0.35} strokeDasharray="2 3" />
            <text x={X(spec.duration * 1000) + 4} y={Y(hi) + 12} className="fill-primary text-[9px] font-medium">{round(spec.duration, 2)}s</text>
          </g>
        ) : null}
        <line x1={X(s.duration)} x2={X(s.duration)} y1={Y(1) - 6} y2={Y(1) + 6} stroke="var(--muted-foreground)" strokeWidth={1.4} />
        <text x={Math.min(X(s.duration) + 4, W - 70)} y={Y(1) + 16} className="fill-muted-foreground text-[9px]">settles {round(s.duration / 1000, 2)}s</text>
        <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        {ms ? <motion.circle cx={dotX} cy={dotY} r={5} fill="var(--primary)" stroke="var(--background)" strokeWidth={2} /> : null}
      </svg>
      {handle ? (
        <GraphPoint
          label="Spring: ← → duration, ↑ ↓ bounce"
          active={gesture.active === 0}
          insets={plotInsets(W, GH)}
          value={{ x: handle.t, y: handle.v }}
          x={{ min: 0, max: tmax, step: 10, label: 'time' }}
          y={{ min: lo, max: hi, step: 0.01, label: 'peak' }}
          valueText={() => `duration ${round(spec.duration, 2)} seconds, bounce ${round(spec.bounce, 2)}`}
          onValueChange={set}
          onValueCommit={(_, details) => { if (details.reason !== 'step-key') gesture.end(); }}
        />
      ) : null}
    </div>
  );
}

/* ── The preview ── */

type PreviewKind = 'move' | 'scale' | 'rotate' | 'fade';

/** Plays a transition on a square, again and again (or once, on request, with reduced motion). Exposes the run's
    time so the graphs can ride along. */
export function usePreviewClock(spec: TransitionSpec) {
  const value = useMotionValue(0);
  const ms = useMotionValue(0);
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const key = JSON.stringify(spec);
  useEffect(() => {
    if (reduced && !run) return;
    let stop = false;
    let live: AnimationPlaybackControls[] = [];
    const s = sample(spec);
    const total = spec.delay * 1000 + s.duration;
    const once = { ...spec, ...(spec.type !== 'instant' ? { repeat: 0 } : null) } as TransitionSpec;
    const play = async () => {
      do {
        value.jump(0);
        ms.jump(-spec.delay * 1000);
        // framer-motion plays the transition; a linear clock beside it says how far through it is.
        live = [
          animate(value, 1, once.type === 'instant' ? { duration: 0, delay: spec.delay } : toFramer(once)),
          animate(ms, s.duration, { duration: Math.max(0.05, total / 1000), ease: 'linear' }),
        ];
        await Promise.all(live.map((c) => c.finished)).catch(() => undefined);
        if (stop) return;
        await new Promise((r) => setTimeout(r, 650));
      } while (!stop && !reduced);
    };
    void play();
    return () => { stop = true; live.forEach((c) => c.stop()); };
    // `key` stands for the spec's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, run, reduced]);
  return { value, ms, replay: () => setRun((n) => n + 1) };
}

export function MotionPreview({ clock, kind, onKind }: { clock: ReturnType<typeof usePreviewClock>; kind: PreviewKind; onKind: (k: PreviewKind) => void }) {
  const x = useTransform(clock.value, (v) => `calc(12px + ${v} * (100% - 58px))`);
  const scale = useTransform(clock.value, (v) => 0.25 + 0.75 * v);
  const rotate = useTransform(clock.value, (v) => v * 180);
  const opacity = useTransform(clock.value, (v) => Math.max(0, Math.min(1, v)));
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-14 overflow-hidden rounded-lg bg-background shadow-hairline">
        <div className="absolute inset-x-3 top-1/2 h-px bg-border" />
        <motion.div
          aria-hidden="true"
          className="absolute top-[11px] size-[34px] rounded-ctl bg-primary shadow-md"
          style={kind === 'move' ? { left: x } : kind === 'scale' ? { left: 'calc(50% - 17px)', scale } : kind === 'rotate' ? { left: 'calc(50% - 17px)', rotate } : { left: 'calc(50% - 17px)', opacity }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Segmented<PreviewKind>
          aria-label="Preview"
          value={kind}
          onValueChange={(k) => k && onKind(k)}
          size="sm"
          className="flex-1"
        >
          <SegmentedItem value="move">Move</SegmentedItem>
          <SegmentedItem value="scale">Scale</SegmentedItem>
          <SegmentedItem value="rotate">Rotate</SegmentedItem>
          <SegmentedItem value="fade">Fade</SegmentedItem>
        </Segmented>
        <SdkButton aria-label="Replay" title="Replay" onClick={clock.replay} className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-secondary text-foreground outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">
          <Icon name="arrow-counterclockwise" size={14} sw={2.2} />
        </SdkButton>
      </div>
    </div>
  );
}

/* ── The editor ── */

export interface TransitionEditorProps {
  spec: TransitionSpec;
  onChange: (s: TransitionSpec, live: boolean) => void;
  onBegin?: () => void;
  /** Leave out the preview (when something else previews it). */
  preview?: boolean;
  /** Instant is a choice (a segue can be; a gesture's transition shouldn't need it). */
  allowInstant?: boolean;
}

const sectionLabel = 'text-caption2 font-semibold tracking-wide text-muted-foreground uppercase';

export function TransitionEditor({ spec, onChange, onBegin, preview = true, allowInstant = true }: TransitionEditorProps) {
  const clock = usePreviewClock(spec);
  // How far through the motion the preview is (0–1), for the bezier's dot.
  const progress = useTransform(clock.ms, (v) => (spec.type === 'tween' ? v / Math.max(1, spec.duration * 1000) : 0));
  const [kind, setKind] = useState<PreviewKind>('move');
  const [copied, setCopied] = useState<'code' | 'css' | null>(null);
  const setType = (t: string) => {
    if (t === spec.type) return;
    const delay = spec.delay;
    if (t === 'spring') onChange(springSpec(spec.type === 'tween' ? Math.max(0.2, spec.duration) : 0.4, 0.2, delay), false);
    else if (t === 'tween') onChange(tweenSpec(spec.type === 'spring' ? round(spec.duration, 2) : 0.3, 'easeOut', delay), false);
    else onChange(instantSpec(delay), false);
  };
  const num = (label: string, value: number, patch: (v: number) => TransitionSpec, o: { min?: number; max?: number; step?: number; unit?: string } = {}) => (
    <NumberInput label={label} value={value} onBegin={onBegin} onChange={(v, live) => onChange(patch(v), live)} {...o} />
  );
  const copy = async (what: 'code' | 'css') => {
    try { await navigator.clipboard.writeText(what === 'code' ? codeOf(spec) : cssOf(spec)); setCopied(what); setTimeout(() => setCopied(null), 1200); } catch { /* no clipboard */ }
  };

  return (
    <div data-slot="ib-transition-editor" className="flex flex-col gap-3">
      <Segmented aria-label="Transition type" value={spec.type} onValueChange={(t) => t && setType(t)}>
        <SegmentedItem value="spring">Spring</SegmentedItem>
        <SegmentedItem value="tween">Ease</SegmentedItem>
        {allowInstant ? <SegmentedItem value="instant">Instant</SegmentedItem> : null}
      </Segmented>

      {spec.type === 'spring' ? (
        <>
          <div className="flex items-center gap-2">
            <Segmented<SpringSpec['mode']>
              aria-label="Spring by"
              value={spec.mode}
              onValueChange={(m) => m && onChange(syncSpring({ ...spec, mode: m }), false)}
              size="sm"
              className="flex-1"
            >
              <SegmentedItem value="time">Time</SegmentedItem>
              <SegmentedItem value="physics">Physics</SegmentedItem>
            </Segmented>
            <SpringPresets onPick={(p) => onChange({ ...p, mode: spec.mode, delay: spec.delay }, false)} />
          </div>
          <SpringGraph spec={spec} onBegin={onBegin} onChange={onChange} ms={preview ? clock.ms : undefined} />
          {spec.mode === 'time' ? (
            <>
              {num('Duration', spec.duration, (v) => syncSpring({ ...spec, duration: v }), { min: 0.05, max: 10, step: 0.01, unit: 's' })}
              {num('Bounce', spec.bounce, (v) => syncSpring({ ...spec, bounce: v }), { min: 0, max: 1, step: 0.01 })}
            </>
          ) : (
            <>
              {num('Stiffness', spec.stiffness, (v) => syncSpring({ ...spec, stiffness: v }), { min: 1, max: 3000, step: 1 })}
              {num('Damping', spec.damping, (v) => syncSpring({ ...spec, damping: v }), { min: 0, max: 300, step: 0.5 })}
              {num('Mass', spec.mass, (v) => syncSpring({ ...spec, mass: v }), { min: 0.05, max: 20, step: 0.05 })}
            </>
          )}
          <p className="m-0 font-mono text-caption2 text-muted-foreground">{equivalent(spec)}</p>
        </>
      ) : spec.type === 'tween' ? (
        <>
          <CurveEditor ease={spec.ease} onBegin={onBegin} onChange={(e, live) => onChange({ ...spec, ease: e }, live)} time={preview ? progress : undefined} />
          <BezierFields spec={spec} onBegin={onBegin} onChange={onChange} />
          <div>
            <div className={cn(sectionLabel, 'mb-1.5')}>Easing</div>
            <div className="grid grid-cols-3 gap-1">
              {EASE_PRESETS.map((p) => (
                <SdkToggle
                  key={p.id}
                  aria-label={p.label}
                  pressed={sameEase(p.ease, spec.ease)}
                  onPressedChange={() => onChange({ ...spec, ease: p.ease }, false)}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-0 px-1.5 text-left text-caption2 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    sameEase(p.ease, spec.ease) ? 'bg-primary/14 text-primary' : 'bg-secondary text-foreground hover:bg-secondary-strong',
                  )}
                >
                  <EaseThumb ease={p.ease} size={18} />
                  <span className="truncate">{p.label}</span>
                </SdkToggle>
              ))}
            </div>
          </div>
          {num('Duration', spec.duration, (v) => ({ ...spec, duration: v }), { min: 0.01, max: 10, step: 0.01, unit: 's' })}
          <RepeatFields spec={spec} onChange={onChange} onBegin={onBegin} />
        </>
      ) : (
        <p className="m-0 text-caption text-muted-foreground">Jumps straight to the end (after the delay): <code className="font-mono">duration: 0</code>.</p>
      )}

      {num('Delay', spec.delay, (v) => ({ ...spec, delay: v }) as TransitionSpec, { min: 0, max: 10, step: 0.01, unit: 's' })}

      {preview ? <MotionPreview clock={clock} kind={kind} onKind={setKind} /> : null}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>framer-motion</span>
          <span className="flex gap-1">
            <CopyButton label="Copy transition" done={copied === 'code'} onClick={() => void copy('code')}>{'{ }'}</CopyButton>
            <CopyButton label="Copy as CSS" done={copied === 'css'} onClick={() => void copy('css')}>CSS</CopyButton>
          </span>
        </div>
        <code className="block rounded-md bg-code px-2 py-1.5 font-mono text-caption2 leading-[1.5] break-all text-code-foreground">transition={'{'}{codeOf(spec)}{'}'}</code>
      </div>
    </div>
  );
}

function CopyButton({ label, done, onClick, children }: { label: string; done: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <SdkButton aria-label={label} title={label} onClick={onClick} className="flex h-6 cursor-pointer items-center gap-1 rounded-md border-0 bg-secondary px-1.5 font-mono text-caption2 text-foreground outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">
      {done ? <Icon name="checkmark" size={12} sw={2.6} className="text-success" /> : children}
    </SdkButton>
  );
}

/** The other form of a spring, for reference. */
function equivalent(s: SpringSpec): string {
  if (s.mode === 'time') {
    const p = physicsOf(s.duration, s.bounce);
    return `≈ stiffness ${round(p.stiffness, 0)} · damping ${round(p.damping, 1)}`;
  }
  const t = timeOf(s.stiffness, s.damping, s.mass);
  return `≈ ${round(t.duration, 2)}s · bounce ${round(t.bounce, 2)}`;
}

function BezierFields({ spec, onChange, onBegin }: { spec: TweenSpec; onChange: (s: TransitionSpec, live: boolean) => void; onBegin?: () => void }) {
  const b = editable(spec.ease);
  const set = (i: number, v: number, live: boolean) => {
    const next = [...b] as Bezier;
    next[i] = i % 2 === 0 ? Math.max(0, Math.min(1, v)) : v;
    onChange({ ...spec, ease: next }, live);
  };
  return (
    <div className="grid grid-cols-4 gap-1">
      {(['x1', 'y1', 'x2', 'y2'] as const).map((k, i) => (
        <NumberInput key={k} label={k} value={round(b[i], 3)} step={0.01} scrub="none" onBegin={onBegin} onChange={(v, live) => set(i, v, live)} className="[&_input]:px-1.5 [&_input]:text-center" />
      ))}
    </div>
  );
}

function RepeatFields({ spec, onChange, onBegin }: { spec: TweenSpec; onChange: (s: TransitionSpec, live: boolean) => void; onBegin?: () => void }) {
  const repeat = spec.repeat ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-[84px] shrink-0 text-caption text-muted-foreground">Repeat</span>
        <Segmented
          aria-label="Repeat"
          value={repeat < 0 ? 'inf' : String(Math.min(repeat, 3))}
          onValueChange={(v) => v && onChange({ ...spec, repeat: v === 'inf' ? -1 : Number(v), repeatType: spec.repeatType ?? 'loop' }, false)}
          size="sm"
          className="flex-1"
        >
          <SegmentedItem value="0">Once</SegmentedItem>
          <SegmentedItem value="1">2×</SegmentedItem>
          <SegmentedItem value="3">4×</SegmentedItem>
          <SegmentedItem value="inf">∞</SegmentedItem>
        </Segmented>
      </div>
      {repeat ? (
        <>
          <div className="flex items-center gap-2">
            <span className="w-[84px] shrink-0 text-caption text-muted-foreground">Then</span>
            <Segmented<NonNullable<TweenSpec['repeatType']>>
              aria-label="Repeat type"
              value={spec.repeatType ?? 'loop'}
              onValueChange={(v) => v && onChange({ ...spec, repeatType: v }, false)}
              size="sm"
              className="flex-1"
            >
              <SegmentedItem value="loop">Loop</SegmentedItem>
              <SegmentedItem value="reverse">Reverse</SegmentedItem>
              <SegmentedItem value="mirror">Mirror</SegmentedItem>
            </Segmented>
          </div>
          <NumberInput label="Pause" value={spec.repeatDelay ?? 0} min={0} max={10} step={0.05} unit="s" onBegin={onBegin} onChange={(v, live) => onChange({ ...spec, repeatDelay: v }, live)} />
        </>
      ) : null}
    </div>
  );
}

function SpringPresets({ onPick }: { onPick: (s: SpringSpec) => void }) {
  return (
    <DropdownMenu onAction={(k) => { const p = SPRING_PRESETS.find((x) => x.id === k); if (p) onPick(p.spec); }}>
      <DropdownMenuTrigger className="flex h-7 cursor-pointer items-center gap-1 rounded-md border-0 bg-secondary px-2 text-caption font-medium text-foreground outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">
        Presets <Icon name="chevron-down" size={11} sw={2.4} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SPRING_PRESETS.map((p) => (
          <DropdownMenuItem key={p.id} value={p.id} description={p.note} icon={<CurveThumb spec={p.spec} w={30} h={18} className="text-primary" />}>{p.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── The button that opens it ── */

/** A transition as a row you press: its curve and its summary; the editor opens beside it. */
export function TransitionButton({ spec, onChange, onBegin, label = 'Transition', allowInstant }: {
  spec: TransitionSpec; onChange: (s: TransitionSpec, live: boolean) => void; onBegin?: () => void; label?: string; allowInstant?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger aria-label={`${label}: ${describe(spec)}`} className="flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-secondary px-2 text-left text-footnote text-foreground outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">
        <CurveThumb spec={spec} className="text-primary" />
        <span className="min-w-0 flex-1 truncate">{describe(spec)}</span>
        <Icon name="chevron-right" size={12} sw={2.4} className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent side="start" align="start" className="max-h-[min(720px,90vh)] w-[312px] overflow-y-auto">
        <TransitionEditor spec={spec} onChange={onChange} onBegin={onBegin} allowInstant={allowInstant} />
      </PopoverContent>
    </Popover>
  );
}
