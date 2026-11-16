import { describe, expect, it } from 'vitest';
import { centerOf, dist, distToPolyline, inFrame, rotatePt, type Pt, type Rect } from '@/lib/canvas-math';
import { ARROW_BROAD, ARROW_SLIM, anchorPoint, arrowHead, connectorPath, dirOf, facingCurve, loopingCurve, nearestAnchor, type ConnectorEnd, type DiagramSide } from './diagram-model';

/* The three versions this module replaced, frozen as they were at 56ec315, and the new one held to them on thousands of
   seeded inputs. Freeform's connectorGeometry and nearestAnchor (registry/blocks/freeform/geometry.ts), Interface
   Builder's segueGeometry (registry/blocks/interface-builder/geometry.ts), Replay Canvas's seguePath
   (registry/blocks/replay-canvas/layout.ts), and the arrowheads from items.tsx, storyboard.tsx and board.tsx.
   Delete a block from this list only when that block's picture is meant to change. */

const NORMAL: Record<DiagramSide, Pt> = { t: { x: 0, y: -1 }, r: { x: 1, y: 0 }, b: { x: 0, y: 1 }, l: { x: -1, y: 0 } };
type Box = Rect & { rot: number; id: string };

function oldAnchorPoint(item: Box, side: DiagramSide): Pt {
  const local: Pt = side === 't' ? { x: item.x + item.w / 2, y: item.y }
    : side === 'b' ? { x: item.x + item.w / 2, y: item.y + item.h }
    : side === 'l' ? { x: item.x, y: item.y + item.h / 2 }
    : { x: item.x + item.w, y: item.y + item.h / 2 };
  return item.rot ? rotatePt(local, centerOf(item), item.rot) : local;
}
function oldAnchorNormal(item: Box, side: DiagramSide): Pt {
  const n = NORMAL[side];
  return item.rot ? rotatePt(n, { x: 0, y: 0 }, item.rot) : n;
}
const unit = (v: Pt): Pt => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const dominantSide = (from: Pt, to: Pt): Pt => (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y) ? { x: Math.sign(to.x - from.x) || 1, y: 0 } : { x: 0, y: Math.sign(to.y - from.y) || 1 });
function cubic(a: Pt, b: Pt, c: Pt, d: Pt, steps = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({
      x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    });
  }
  return out;
}
function oldConnector(route: 'straight' | 'curve' | 'elbow', a: { p: Pt; n: Pt | null }, b: { p: Pt; n: Pt | null }) {
  const na = a.n ?? dominantSide(a.p, b.p);
  const nb = b.n ?? dominantSide(b.p, a.p);
  let pts: Pt[];
  let d: string;
  if (route === 'straight') {
    pts = [a.p, b.p];
    d = `M${a.p.x} ${a.p.y}L${b.p.x} ${b.p.y}`;
  } else if (route === 'curve') {
    const k = Math.max(40, dist(a.p, b.p) * 0.4);
    const c1 = { x: a.p.x + na.x * k, y: a.p.y + na.y * k };
    const c2 = { x: b.p.x + nb.x * k, y: b.p.y + nb.y * k };
    pts = cubic(a.p, c1, c2, b.p);
    d = `M${a.p.x} ${a.p.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.p.x} ${b.p.y}`;
  } else {
    const gap = 28;
    const a1 = { x: a.p.x + na.x * gap, y: a.p.y + na.y * gap };
    const b1 = { x: b.p.x + nb.x * gap, y: b.p.y + nb.y * gap };
    const horizA = Math.abs(na.x) > 0.5, horizB = Math.abs(nb.x) > 0.5;
    let mid: Pt[];
    if (horizA && horizB) { const mx = (a1.x + b1.x) / 2; mid = [{ x: mx, y: a1.y }, { x: mx, y: b1.y }]; }
    else if (!horizA && !horizB) { const my = (a1.y + b1.y) / 2; mid = [{ x: a1.x, y: my }, { x: b1.x, y: my }]; }
    else if (horizA) mid = [{ x: b1.x, y: a1.y }];
    else mid = [{ x: a1.x, y: b1.y }];
    pts = [a.p, a1, ...mid, b1, b.p];
    d = 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L');
  }
  const startDir = unit({ x: pts[0].x - pts[1].x, y: pts[0].y - pts[1].y });
  const last = pts.length - 1;
  const endDir = unit({ x: pts[last].x - pts[last - 1].x, y: pts[last].y - pts[last - 1].y });
  return { d, pts, start: a.p, end: b.p, startDir, endDir };
}
function oldNearestAnchor(p: Pt, items: Box[], tol: number, exclude?: string) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.id === exclude || !inFrame(p, it, tol)) continue;
    let best: { side: DiagramSide; point: Pt; d: number } | null = null;
    for (const side of ['t', 'r', 'b', 'l'] as DiagramSide[]) {
      const point = oldAnchorPoint(it, side);
      const d = dist(point, p);
      if (!best || d < best.d) best = { side, point, d };
    }
    if (best) return { id: it.id, side: best.side, point: best.point };
  }
  return null;
}
const bez = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};
function oldSegueGeometry(from: Rect, to: Rect, src: Rect | null, gap: number) {
  const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 }, tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const dx = tc.x - fc.x, dy = tc.y - fc.y;
  const sideways = Math.abs(dx) >= Math.abs(dy) * 0.6;
  let start: Pt, end: Pt, c1: Pt, c2: Pt;
  if (sideways) {
    const dir = dx >= 0 ? 1 : -1;
    start = src ? { x: dir > 0 ? src.x + src.w : src.x, y: src.y + src.h / 2 } : { x: dir > 0 ? from.x + from.w : from.x, y: fc.y };
    end = { x: dir > 0 ? to.x - gap : to.x + to.w + gap, y: Math.max(to.y + 40, Math.min(to.y + to.h - 40, start.y)) };
    const k = Math.max(48, Math.abs(end.x - start.x) * 0.42);
    c1 = { x: start.x + k * dir, y: start.y };
    c2 = { x: end.x - k * dir, y: end.y };
  } else {
    const dir = dy >= 0 ? 1 : -1;
    start = src ? { x: src.x + src.w, y: src.y + src.h / 2 } : { x: fc.x, y: dir > 0 ? from.y + from.h : from.y };
    end = { x: tc.x, y: dir > 0 ? to.y - gap : to.y + to.h + gap };
    const k = Math.max(60, Math.abs(end.y - start.y) * 0.45);
    c1 = src ? { x: start.x + k, y: start.y } : { x: start.x, y: start.y + k * dir };
    c2 = { x: end.x, y: end.y - k * dir };
  }
  return { d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`, start, end, mid: bez(start, c1, c2, end, 0.5), angle: Math.atan2(end.y - c2.y, end.x - c2.x) };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function oldSeguePath(start: Pt, to: Rect, offset = 0) {
  let end: Pt, c1: Pt, c2: Pt;
  if (to.x >= start.x + 60) {
    end = { x: to.x - 10, y: clamp(start.y, to.y + 24, to.y + to.h - 24) };
    const k = Math.max(80, (end.x - start.x) * 0.45);
    c1 = { x: start.x + k, y: start.y };
    c2 = { x: end.x - k, y: end.y };
  } else {
    const below = to.y >= start.y;
    end = { x: to.x + Math.min(to.w / 2, 240), y: below ? to.y - 10 : to.y + to.h + 10 };
    const k = Math.max(160, Math.abs(end.y - start.y) * 0.4);
    const side = Math.max(start.x, end.x) + 220;
    c1 = { x: side, y: start.y };
    c2 = { x: end.x, y: below ? end.y - k : end.y + k };
  }
  if (offset) {
    const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const nx = (-(end.y - start.y) / len) * offset, ny = ((end.x - start.x) / len) * offset;
    for (const pt of [start, c1, c2, end]) { pt.x += nx; pt.y += ny; }
  }
  return { d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`, start, end, mid: bez(start, c1, c2, end, 0.5), angle: Math.atan2(end.y - c2.y, end.x - c2.x) };
}
/* The arrowheads, as each block wrote them. */
function oldFreeformHead(tip: Pt, dir: Pt, size: number): number[] {
  const bx = tip.x - dir.x * size, by = tip.y - dir.y * size;
  const px = -dir.y * size * 0.55, py = dir.x * size * 0.55;
  return [tip.x, tip.y, bx + px, by + py, bx - px, by - py];
}
function oldBuilderHead(end: Pt, a: number, head: number): number[] {
  return [end.x, end.y, end.x - head * Math.cos(a - 0.45), end.y - head * Math.sin(a - 0.45), end.x - head * Math.cos(a + 0.45), end.y - head * Math.sin(a + 0.45)];
}
function oldReplayHead(end: Pt, angle: number, size: number): number[] {
  const a1 = angle + Math.PI - 0.45, a2 = angle + Math.PI + 0.45;
  return [end.x, end.y, end.x + Math.cos(a1) * size, end.y + Math.sin(a1) * size, end.x + Math.cos(a2) * size, end.y + Math.sin(a2) * size];
}

/* A seeded generator, so a failure repeats. */
function random(seed: number) {
  let s = seed >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  return {
    r,
    n: (k: number) => Math.round((r() - 0.5) * k * 100) / 100,
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)],
    rect: (): Rect => ({ x: Math.round((r() - 0.5) * 4000), y: Math.round((r() - 0.5) * 4000), w: 20 + Math.round(r() * 900), h: 20 + Math.round(r() * 900) }),
  };
}
const SIDES: DiagramSide[] = ['t', 'r', 'b', 'l'];
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?(e[-+]?\d+)?/g) ?? []).map(Number);

describe('the geometry the three blocks had', () => {
  it('Freeform: every route between attached, rotated and free ends', () => {
    const g = random(1);
    for (let i = 0; i < 4000; i++) {
      const box = (): Box => ({ id: 'x', ...g.rect(), rot: g.pick([0, 0, 15, 90, -45, 33.3, 180]) });
      const end = (): { p: Pt; n: Pt | null } => {
        if (g.r() < 0.25) return { p: { x: g.n(4000), y: g.n(4000) }, n: null };
        const it = box(), side = g.pick(SIDES);
        expect(anchorPoint(it, side)).toEqual(oldAnchorPoint(it, side));
        return { p: oldAnchorPoint(it, side), n: oldAnchorNormal(it, side) };
      };
      const a = end(), b = end(), route = g.pick(['straight', 'curve', 'elbow'] as const);
      const was = oldConnector(route, a, b);
      const now = connectorPath(route, a as ConnectorEnd, b as ConnectorEnd);
      expect(now.d).toBe(was.d);
      expect(now.pts).toEqual(was.pts);
      expect(now.start).toEqual(was.start);
      expect(now.end).toEqual(was.end);
      expect(now.startDir).toEqual(was.startDir);
      expect(now.endDir).toEqual(was.endDir);
    }
  });

  it('Freeform: the nearest anchor', () => {
    const g = random(2);
    for (let i = 0; i < 4000; i++) {
      const items: Box[] = Array.from({ length: 1 + Math.floor(g.r() * 6) }, (_, k) => ({ id: `i${k}`, ...g.rect(), rot: g.pick([0, 0, 30, -60, 90]) }));
      const near = g.pick(items);
      const p = g.r() < 0.7 ? { x: near.x + g.r() * near.w, y: near.y + g.r() * near.h } : { x: g.n(4000), y: g.n(4000) };
      const exclude = g.r() < 0.3 ? g.pick(items).id : undefined;
      const tol = g.pick([0, 6, 30]);
      expect(nearestAnchor(p, items, tol, exclude)).toEqual(oldNearestAnchor(p, items, tol, exclude));
    }
  });

  it('Interface Builder: segues, with and without a source control', () => {
    const g = random(3);
    for (let i = 0; i < 4000; i++) {
      const from = g.rect(), to = g.rect(), src = g.r() < 0.5 ? g.rect() : null;
      const was = oldSegueGeometry(from, to, src, 10);
      const now = facingCurve(from, to, src, 10);
      expect(numbers(now.d)).toEqual(numbers(was.d));
      expect(now.start).toEqual(was.start);
      expect(now.end).toEqual(was.end);
      expect(now.mid).toEqual(was.mid);
      expect(now.angle).toBe(was.angle);
    }
  });

  it('Replay Canvas: segues, ahead, behind, and offset', () => {
    const g = random(4);
    for (let i = 0; i < 4000; i++) {
      const start = { x: g.n(4000), y: g.n(4000) }, to = g.rect(), offset = g.pick([0, 0, 8, -8, 24]);
      const was = oldSeguePath({ ...start }, to, offset);
      const now = loopingCurve(start, to, offset);
      expect(numbers(now.d)).toEqual(numbers(was.d));
      expect(now.start).toEqual(was.start);
      expect(now.end).toEqual(was.end);
      expect(now.mid).toEqual(was.mid);
      expect(now.angle).toBe(was.angle);
    }
  });

  it('the arrowheads', () => {
    const g = random(5);
    const close = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(1e-9));
    for (let i = 0; i < 4000; i++) {
      const tip = { x: g.n(4000), y: g.n(4000) }, angle = g.r() * Math.PI * 4 - Math.PI * 2, size = 1 + g.r() * 40;
      const flat = (c: readonly Pt[]) => c.flatMap((p) => [p.x, p.y]);
      close(flat(arrowHead(tip, dirOf(angle), size, ARROW_SLIM)), oldBuilderHead(tip, angle, size));
      close(flat(arrowHead(tip, dirOf(angle), size, ARROW_SLIM)), oldReplayHead(tip, angle, size));
      const dir = unit({ x: g.n(10) + 0.01, y: g.n(10) });
      expect(flat(arrowHead(tip, dir, size, ARROW_BROAD))).toEqual(oldFreeformHead(tip, dir, size));
    }
  });

  it('hits at least as much of a segue as the old sampled distance did', () => {
    // The old distToSegue measured to 41 points on the curve, so a click on the line between two of them could miss.
    const g = random(6);
    for (let i = 0; i < 2000; i++) {
      const from = g.rect(), to = g.rect();
      const now = facingCurve(from, to, null, 10);
      const p = { x: now.mid.x + g.n(40), y: now.mid.y + g.n(40) };
      const m = /M(-?[\d.e-]+) (-?[\d.e-]+)C(-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+) (-?[\d.e-]+)/.exec(now.d)!;
      const v = m.slice(1).map(Number);
      let was = Infinity;
      for (let k = 0; k <= 40; k++) { const q = bez({ x: v[0], y: v[1] }, { x: v[2], y: v[3] }, { x: v[4], y: v[5] }, { x: v[6], y: v[7] }, k / 40); was = Math.min(was, Math.hypot(q.x - p.x, q.y - p.y)); }
      // Chords cut corners by a little on a tight curve, so allow a board unit.
      expect(distToPolyline(p, now.pts)).toBeLessThanOrEqual(was + 1);
    }
  });
});
