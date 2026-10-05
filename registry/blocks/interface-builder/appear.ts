/* Appear animations: from the values an effect lists to the node's own, scheduled the way Framer's stacks stagger
   them. A node's start is its stagger slot (the nearest staggering ancestor's `delay + index × each`) plus its own
   delay. framer-motion would let a child's own delay replace its stagger slot rather than add to it, so the
   renderer hands each node its whole delay itself; the timeline scrubs the same schedule, so what you scrub is what
   plays. */
import { interpolate } from 'framer-motion';
import { sample, type TransitionSpec } from './easing';
import { cssColor, type MotionKey, type MotionValue, type Node, type Target } from './model';
import { eachChild } from './tree';

/** A color with nothing in it, for animating a fill in from none. */
const CLEAR = 'rgba(0, 0, 0, 0)';

/** The value a node rests at for a key (what appear animates to, and gestures return to). */
export function restValue(key: MotionKey, node: Node): number | string {
  switch (key) {
    case 'opacity': return node.style?.opacity ?? 1;
    case 'scale': return 1;
    case 'borderRadius': return node.style?.radius ?? 0;
    case 'backgroundColor': return cssColor(node.style?.fill) ?? CLEAR;
    case 'blur': return 0;
    default: return 0;
  }
}

const blurOf = (v: number | string) => `blur(${typeof v === 'number' ? v : parseFloat(v) || 0}px)`;
const color = (v: number | string) => (typeof v === 'string' ? cssColor(v) ?? v : v);

/** A target in framer-motion's terms: blur becomes a filter, theme colors become CSS variables. */
export function toFramerTarget(t: Target): Record<string, MotionValue> {
  const out: Record<string, MotionValue> = {};
  for (const [k, v] of Object.entries(t) as [MotionKey, MotionValue][]) {
    if (v === undefined) continue;
    const each = (fn: (x: number | string) => number | string) => (Array.isArray(v) ? v.map(fn) : fn(v));
    if (k === 'blur') out.filter = each(blurOf);
    else if (k === 'backgroundColor') out.backgroundColor = each(color);
    else out[k] = v;
  }
  return out;
}

/**
 * An appear effect as two variants. Each listed value starts where the effect says and ends at the node's own; a
 * list of values is a path through keyframes on the way (`scale: [0, 1.15]` pops past full size and settles).
 */
export function appearVariants(t: Target, node: Node): { hidden: Target; shown: Target } {
  const hidden: Target = {}, shown: Target = {};
  for (const [k, v] of Object.entries(t) as [MotionKey, MotionValue][]) {
    const rest = restValue(k, node);
    hidden[k] = Array.isArray(v) ? v[0] : v;
    shown[k] = Array.isArray(v) ? [...v, rest] : rest;
  }
  return { hidden, shown };
}

/** Does a target turn in 3D (and so want a perspective)? */
export const is3d = (t?: Target) => !!t && (t.rotateX !== undefined || t.rotateY !== undefined);

/* ── The schedule ── */

export interface Slot {
  /** When it starts, ms after the scene appears (stagger slot and own delay). */
  start: number;
  transition: TransitionSpec;
}

/** Instances of a repeated node, by key: `id` or `id#index`. */
export const instanceKey = (id: string, index: number | null) => (index == null ? id : `${id}#${index}`);

/**
 * When each node's appear animation starts. `count` says how many times a repeated node renders (its list's
 * length, on the canvas). Nodes whose appear waits for the viewport are left out: they start when scrolled to.
 */
export function appearSchedule(root: Node, count: (n: Node) => number): Map<string, Slot> {
  const out = new Map<string, Slot>();
  const visit = (n: Node, index: number | null, base: number, stagger: { delay: number; each: number; dir: 1 | -1 } | null, slot: number, total: number) => {
    const a = n.motion?.appear;
    const offset = stagger ? (stagger.delay + (stagger.dir === 1 ? slot : total - 1 - slot) * stagger.each) * 1000 : 0;
    const start = base + offset;
    if (a && a.trigger === 'mount') out.set(instanceKey(n.id, index), { start: start + a.transition.delay * 1000, transition: a.transition });
    // Its children stagger from where it starts (not counting its own delay, as framer-motion does).
    const s = n.motion?.stagger;
    const next = s ? { delay: s.delay, each: s.each, dir: s.from === 'last' ? -1 as const : 1 as const } : null;
    const kids = eachChild(n).flatMap((c) => {
      const k = c.node.repeat ? count(c.node) : 1;
      return Array.from({ length: k }, (_, i) => ({ node: c.node, index: c.node.repeat ? i : null }));
    });
    // Only children that animate in take a stagger slot; the rest pass it through to theirs.
    let i = 0;
    const animating = kids.filter((k) => k.node.motion?.appear?.trigger === 'mount').length;
    for (const k of kids) {
      if (next) {
        const takes = k.node.motion?.appear?.trigger === 'mount';
        visit(k.node, k.index, start, takes ? next : null, takes ? i : 0, animating);
        if (takes) i++;
      } else visit(k.node, k.index, start, null, 0, 1);
    }
  };
  visit(root, null, 0, null, 0, 1);
  return out;
}

/** The whole appear sequence's length in ms: when the last animation comes to rest. */
export function scheduleLength(schedule: Map<string, Slot>): number {
  let end = 0;
  for (const s of schedule.values()) end = Math.max(end, s.start + sample(s.transition).duration);
  return end;
}

/** The node's values `ms` into the scene's appear: for scrubbing. Null when it has no appear effect. */
export function appearValuesAt(node: Node, slot: Slot | undefined, ms: number): Target | null {
  const a = node.motion?.appear;
  if (!a || !slot) return null;
  const p = sample(slot.transition).at(ms - slot.start);
  const out: Target = {};
  for (const [k, from] of Object.entries(a.target) as [MotionKey, MotionValue][]) {
    // The path the value takes: its keyframes (or start), then its rest, evenly spaced as framer-motion spaces them.
    const values = [...(Array.isArray(from) ? from : [from]), restValue(k, node)].map((v) => (k === 'backgroundColor' ? color(v) : v));
    const stops = values.map((_, i) => i / (values.length - 1));
    out[k] = interpolate(stops, values as number[], { clamp: false })(p) as number | string;
  }
  return out;
}
