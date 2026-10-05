/* Transitions: how a value gets from one state to the next, in framer-motion's terms.

   - a spring, set by feel (`visualDuration` and `bounce`, Framer's "Time") or by physics (`stiffness`, `damping`,
     `mass`). Both forms are kept, so switching between them loses nothing, and each is converted to the other the
     way framer-motion converts them;
   - a tween: a duration and an easing curve, either one of framer-motion's named easings or a cubic bezier;
   - instant.

   The graphs sample framer-motion's own generators (`spring`, `easingDefinitionToFunction`), so what the editor
   draws is what the runtime plays. */
import { calcGeneratorDuration, cubicBezier, easingDefinitionToFunction, generateLinearEasing, spring } from 'framer-motion';

export type EaseName =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'circIn' | 'circOut' | 'circInOut'
  | 'backIn' | 'backOut' | 'backInOut'
  | 'anticipate';
export type Bezier = [number, number, number, number];
export type Ease = EaseName | Bezier;

export type RepeatType = 'loop' | 'reverse' | 'mirror';

interface Timing {
  /** Seconds before it starts. */
  delay: number;
  /** Extra plays after the first; -1 repeats forever. */
  repeat?: number;
  repeatType?: RepeatType;
  repeatDelay?: number;
}

export interface SpringSpec extends Timing {
  type: 'spring';
  mode: 'time' | 'physics';
  /** Time mode: when it visually arrives (seconds), and how much it overshoots (0–1). */
  duration: number;
  bounce: number;
  /** Physics mode. */
  stiffness: number;
  damping: number;
  mass: number;
}

export interface TweenSpec extends Timing {
  type: 'tween';
  duration: number;
  ease: Ease;
}

export interface InstantSpec {
  type: 'instant';
  delay: number;
}

export type TransitionSpec = SpringSpec | TweenSpec | InstantSpec;

/* ── Springs: the two forms ── */

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

/** framer-motion's conversion from visualDuration and bounce (mass is 1). */
export function physicsOf(duration: number, bounce: number): { stiffness: number; damping: number; mass: number } {
  const root = (2 * Math.PI) / (Math.max(0.01, duration) * 1.2);
  const stiffness = root * root;
  const damping = 2 * clamp(0.05, 1, 1 - bounce) * Math.sqrt(stiffness);
  return { stiffness, damping, mass: 1 };
}

/** The inverse: the visualDuration and bounce that move like these physics. */
export function timeOf(stiffness: number, damping: number, mass: number): { duration: number; bounce: number } {
  const w0 = Math.sqrt(Math.max(0.0001, stiffness) / Math.max(0.0001, mass));
  const zeta = damping / (2 * Math.sqrt(Math.max(0.0001, stiffness * mass)));
  return { duration: (2 * Math.PI) / (1.2 * w0), bounce: clamp(0, 1, 1 - zeta) };
}

/** A spring's physics, whichever form it's set in. */
export function springPhysics(s: SpringSpec) {
  return s.mode === 'time' ? physicsOf(s.duration, s.bounce) : { stiffness: s.stiffness, damping: s.damping, mass: s.mass };
}

/** Keep the other form in step after an edit, so switching modes shows the same spring. */
export function syncSpring(s: SpringSpec): SpringSpec {
  if (s.mode === 'time') {
    const p = physicsOf(s.duration, s.bounce);
    return { ...s, stiffness: round(p.stiffness, 1), damping: round(p.damping, 2), mass: 1 };
  }
  const t = timeOf(s.stiffness, s.damping, s.mass);
  return { ...s, duration: round(t.duration, 2), bounce: round(t.bounce, 2) };
}

export const round = (v: number, places = 2) => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};

/* ── Factories and presets ── */

export function springSpec(duration = 0.4, bounce = 0.2, delay = 0): SpringSpec {
  return syncSpring({ type: 'spring', mode: 'time', duration, bounce, stiffness: 0, damping: 0, mass: 1, delay });
}

export function physicsSpec(stiffness: number, damping: number, mass = 1, delay = 0): SpringSpec {
  return syncSpring({ type: 'spring', mode: 'physics', duration: 0, bounce: 0, stiffness, damping, mass, delay });
}

export function tweenSpec(duration = 0.3, ease: Ease = 'easeOut', delay = 0): TweenSpec {
  return { type: 'tween', duration, ease, delay };
}

export const instantSpec = (delay = 0): InstantSpec => ({ type: 'instant', delay });

export interface SpringPreset { id: string; label: string; note: string; spec: SpringSpec }

/** The kit's springs (lib/motion.ts) first, then the classic react-spring set. */
export const SPRING_PRESETS: SpringPreset[] = [
  { id: 'snappy', label: 'Snappy', note: 'Small controls', spec: physicsSpec(620, 48) },
  { id: 'smooth', label: 'Smooth', note: 'Layout and panels', spec: physicsSpec(380, 40) },
  { id: 'tray', label: 'Tray', note: 'Sheets', spec: physicsSpec(520, 44) },
  { id: 'bouncy', label: 'Bouncy', note: 'Rare, celebratory', spec: physicsSpec(520, 26) },
  { id: 'gentle', label: 'Gentle', note: 'react-spring', spec: physicsSpec(120, 14) },
  { id: 'wobbly', label: 'Wobbly', note: 'react-spring', spec: physicsSpec(180, 12) },
  { id: 'stiff', label: 'Stiff', note: 'react-spring', spec: physicsSpec(210, 20) },
  { id: 'slow', label: 'Slow', note: 'react-spring', spec: physicsSpec(280, 60) },
];

export interface EasePreset { id: string; label: string; ease: Ease }

/** framer-motion's named easings, then the kit's curves. */
export const EASE_PRESETS: EasePreset[] = [
  { id: 'linear', label: 'Linear', ease: 'linear' },
  { id: 'easeIn', label: 'Ease In', ease: 'easeIn' },
  { id: 'easeOut', label: 'Ease Out', ease: 'easeOut' },
  { id: 'easeInOut', label: 'Ease In Out', ease: 'easeInOut' },
  { id: 'circIn', label: 'Circ In', ease: 'circIn' },
  { id: 'circOut', label: 'Circ Out', ease: 'circOut' },
  { id: 'circInOut', label: 'Circ In Out', ease: 'circInOut' },
  { id: 'backIn', label: 'Back In', ease: 'backIn' },
  { id: 'backOut', label: 'Back Out', ease: 'backOut' },
  { id: 'backInOut', label: 'Back In Out', ease: 'backInOut' },
  { id: 'anticipate', label: 'Anticipate', ease: 'anticipate' },
  { id: 'ios', label: 'iOS', ease: [0.32, 0.72, 0, 1] },
  { id: 'exit', label: 'Exit', ease: [0.4, 0, 1, 1] },
  { id: 'fade-in', label: 'Fade In', ease: [0.22, 1, 0.36, 1] },
];

/** The named easings that are cubic beziers, as their control points (the rest are functions). */
const NAMED_BEZIERS: Partial<Record<EaseName, Bezier>> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  backOut: [0.33, 1.53, 0.69, 0.99],
};

/** A curve's control points, when it has them. */
export const bezierOf = (e: Ease): Bezier | null => (Array.isArray(e) ? e : NAMED_BEZIERS[e] ?? null);

/** The label of an easing: a preset's name, else its control points. */
export function easeLabel(e: Ease): string {
  const p = EASE_PRESETS.find((x) => sameEase(x.ease, e));
  return p ? p.label : `Bezier ${(e as Bezier).map((v) => round(v, 2)).join(', ')}`;
}

export const sameEase = (a: Ease, b: Ease) => (Array.isArray(a) && Array.isArray(b) ? a.every((v, i) => Math.abs(v - b[i]) < 1e-4) : a === b);

/** An easing as a function of progress, framer-motion's own. */
export function easeFn(e: Ease): (p: number) => number {
  return Array.isArray(e) ? cubicBezier(e[0], e[1], e[2], e[3]) : easingDefinitionToFunction(e);
}

/* ── Sampling: what a transition does to a value going 0 → 1 ── */

export interface Sampled {
  /** The value at t ms. */
  at: (ms: number) => number;
  /** How long until it rests (ms), not counting the delay. */
  duration: number;
}

const springCache = new Map<string, Sampled>();

/** A transition as a function of time. Springs come from framer-motion's generator; tweens from their easing. */
export function sample(spec: TransitionSpec): Sampled {
  if (spec.type === 'instant') return { at: () => 1, duration: 0 };
  if (spec.type === 'tween') {
    const f = easeFn(spec.ease);
    const d = Math.max(1, spec.duration * 1000);
    return { at: (ms) => (ms <= 0 ? 0 : ms >= d ? 1 : f(ms / d)), duration: d };
  }
  const p = springPhysics(spec);
  const key = `${p.stiffness}|${p.damping}|${p.mass}`;
  const hit = springCache.get(key);
  if (hit) return hit;
  // framer-motion's own rest thresholds for a 0 → 1 move, so the settle time is the one it uses.
  const make = () => spring({ keyframes: [0, 1], stiffness: p.stiffness, damping: p.damping, mass: p.mass });
  const g = make();
  const duration = Math.min(calcGeneratorDuration(make(), 10), 10000);
  const out: Sampled = { at: (ms) => (ms <= 0 ? 0 : ms >= duration ? 1 : g.next(ms).value as number), duration };
  if (springCache.size > 200) springCache.clear();
  springCache.set(key, out);
  return out;
}

/** The whole run in ms: delay, then the motion (once). */
export const totalMs = (spec: TransitionSpec) => spec.delay * 1000 + sample(spec).duration;

/** The visible length of a transition for a timeline bar: a spring's settle time, a tween's duration. */
export const lengthMs = (spec: TransitionSpec) => sample(spec).duration;

/* ── To framer-motion ── */

export type FramerTransition = Record<string, unknown>;

const repeatOf = (t: Timing): FramerTransition =>
  t.repeat ? { repeat: t.repeat < 0 ? Infinity : t.repeat, repeatType: t.repeatType ?? 'loop', repeatDelay: t.repeatDelay ?? 0 } : {};

/** The transition object for a `transition` prop. `speed` < 1 plays it slower (Slow Animations). */
export function toFramer(spec: TransitionSpec, speed = 1): FramerTransition {
  const k = 1 / Math.max(0.01, speed);
  const delay = spec.delay * k;
  if (spec.type === 'instant') return { duration: 0, delay };
  if (spec.type === 'tween') {
    return { type: 'tween', duration: spec.duration * k, ease: spec.ease, delay, ...scaleRepeat(repeatOf(spec), k) };
  }
  if (spec.mode === 'time' && k === 1) return { type: 'spring', visualDuration: spec.duration, bounce: spec.bounce, delay, ...repeatOf(spec) };
  // Slowed by k: the same curve over k× the time is stiffness / k², damping / k.
  const p = springPhysics(spec);
  return { type: 'spring', stiffness: p.stiffness / (k * k), damping: p.damping / k, mass: p.mass, delay, ...scaleRepeat(repeatOf(spec), k) };
}

const scaleRepeat = (r: FramerTransition, k: number) => (r.repeatDelay ? { ...r, repeatDelay: (r.repeatDelay as number) * k } : r);

/* ── Words and code ── */

const secs = (v: number) => `${round(v, 2)}s`;

/** One line for a button: "Spring · 0.4s · bounce 0.2". */
export function describe(spec: TransitionSpec): string {
  const delay = spec.delay ? ` · after ${secs(spec.delay)}` : '';
  if (spec.type === 'instant') return `Instant${delay}`;
  if (spec.type === 'tween') return `${easeLabel(spec.ease)} · ${secs(spec.duration)}${delay}`;
  if (spec.mode === 'time') return `Spring · ${secs(spec.duration)} · bounce ${round(spec.bounce, 2)}${delay}`;
  return `Spring · ${round(spec.stiffness, 0)} / ${round(spec.damping, 1)}${spec.mass !== 1 ? ` / ${round(spec.mass, 2)}` : ''}${delay}`;
}

const num = (v: number) => String(round(v, 3));

/** The transition as framer-motion source: `{ type: 'spring', visualDuration: 0.4, bounce: 0.2 }`. */
export function codeOf(spec: TransitionSpec): string {
  const parts: string[] = [];
  if (spec.type === 'instant') parts.push('duration: 0');
  else if (spec.type === 'tween') {
    parts.push(`duration: ${num(spec.duration)}`, `ease: ${Array.isArray(spec.ease) ? `[${spec.ease.map(num).join(', ')}]` : `'${spec.ease}'`}`);
  } else if (spec.mode === 'time') parts.push(`type: 'spring'`, `visualDuration: ${num(spec.duration)}`, `bounce: ${num(spec.bounce)}`);
  else parts.push(`type: 'spring'`, `stiffness: ${num(spec.stiffness)}`, `damping: ${num(spec.damping)}`, ...(spec.mass !== 1 ? [`mass: ${num(spec.mass)}`] : []));
  if (spec.delay) parts.push(`delay: ${num(spec.delay)}`);
  if (spec.type !== 'instant' && spec.repeat) {
    parts.push(`repeat: ${spec.repeat < 0 ? 'Infinity' : spec.repeat}`);
    if (spec.repeatType && spec.repeatType !== 'loop') parts.push(`repeatType: '${spec.repeatType}'`);
    if (spec.repeatDelay) parts.push(`repeatDelay: ${num(spec.repeatDelay)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

/** The same motion as a CSS transition timing: `550ms linear(…)` (springs are sampled, as framer-motion does). */
export function cssOf(spec: TransitionSpec): string {
  if (spec.type === 'instant') return '0ms';
  if (spec.type === 'tween') {
    const b = bezierOf(spec.ease);
    const timing = b ? `cubic-bezier(${b.map(num).join(', ')})` : generateLinearEasing(easeFn(spec.ease), spec.duration * 1000, 12);
    return `${Math.round(spec.duration * 1000)}ms ${timing}`;
  }
  const s = sample(spec);
  return `${Math.round(s.duration)}ms ${generateLinearEasing((p) => s.at(p * s.duration), s.duration, 12)}`;
}

/* ── Direct manipulation of a time spring's graph: its first peak ── */

/** Where a time-mode spring first peaks: the time (s) and the overshoot (0 = none). Null when it doesn't overshoot. */
export function springPeak(duration: number, bounce: number): { t: number; over: number } | null {
  const zeta = clamp(0.05, 1, 1 - bounce);
  if (zeta >= 1) return null;
  const w0 = (2 * Math.PI) / (Math.max(0.01, duration) * 1.2);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return { t: Math.PI / wd, over: Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta)) };
}

/** The duration and bounce whose first peak is at `t` seconds with `over` overshoot. */
export function fromPeak(t: number, over: number): { duration: number; bounce: number } {
  const o = clamp(0.0005, 0.95, over);
  const ln = Math.log(o);
  const zeta = clamp(0.05, 0.9999, -ln / Math.sqrt(Math.PI * Math.PI + ln * ln));
  const wd = Math.PI / Math.max(0.02, t);
  const w0 = wd / Math.sqrt(1 - zeta * zeta);
  return { duration: clamp(0.05, 10, (2 * Math.PI) / (1.2 * w0)), bounce: clamp(0, 0.95, 1 - zeta) };
}
