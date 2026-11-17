/* ══ The diagram family's drawing rules, as checks ══
   What a drawn diagram (`drawDiagram`'s answer) is held to, by the layout invariants (`lib/diagram-invariants.test.ts`), the
   seeded editing walks (`lib/diagram-editing.fuzz.test.ts`) and the Replay story, which shows a walk step by step with what
   each step breaks. Each check returns what's wrong, in words, one finding a string; none is all clear.

   1. attached: an edge starts and ends on (within 1.5 of) the border of what it claims (a port, a box's hairline under its
      sections for its own child, the label it forks from); the arrowhead is its last point; ends of different edges on one
      side of a card are at least 8 apart unless they share a port (no arrowhead on another edge's start);
   2. clear: no run goes through a card, an entry marker, a box's header strip and sections, or along a box's wall (within a
      lane, 10), its hairline (6) or a region's divider it doesn't cross; what's in a box keeps clear of its walls and header;
   3. its own lane and label: no two edges run within a lane of each other for longer than a crossing; each label is on its
      own route, which runs through it, and nothing else is: no other route, card, label, header or border;
   4. no U-turn: an edge that leaves (or enters) by a side not facing the other end, when a route between facing sides would
      take fewer bends, is going round;
   5. the frame is used: an editable drawing's places are its read-only ones; a drawing too big to read whole is shaped like
      its view (within 2×) or fills its width at the readable zoom;
   6. the first view shows the top-start corner (a root's header and sections), and what has the eye with it (with nothing
      selected or current, where it starts: its root's first card with an entry marker), or that alone when the two can't
      both be read at once;
   7. what's announced is what's drawn: a box "holding N things" holds N of them.

   And what editing promises (`checkStable`, `checkPushed`, `checkPlaced`, `checkLabelRuns`, `checkOverlaps`, `checkContained`,
   `checkRootBox`, `checkInView`): see each.

   The frames' chrome (a toolbar over the top, a frame's bar along the foot, the 288 px column panel) is the kit's, measured
   in a browser: `CHROME`. Text is estimated, as on a server; a browser's measured text is checked by eye and in e2e. */
import type { Pt, Rect, Viewport } from '@/lib/canvas-math';
import { diagramEye, drawingCorner, diagramStartEye, firstView, keepInView, type DiagramDrawing } from '@/lib/diagram-drawing';
import type { DiagramBoardSize } from '@/lib/diagram-layout';
import { DIAGRAM_LEGIBLE_ZOOM, holdsNodes, isInside, nodeAnatomy, portPoint, type DiagramEdge, type DiagramNode } from '@/lib/diagram-model';
import { estimateText } from '@/lib/diagram-text';

const text = estimateText;

/* ── The frames, and the chrome over them ── */

export const FRAMES = [
  { name: '800x1000', width: 800, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '1600x900', width: 1600, height: 900 },
] as const;
export type Frame = (typeof FRAMES)[number];

/** What covers a board, px, as measured in the docs app: the floating toolbar at the top, a DiagramFrame's bar at the foot,
 *  air at the sides (the Diagram's `fitPadding`); a column panel's width; the size class a column needs. */
export const CHROME = { top: 60, bottom: 72, side: 24, column: 288, columnFrom: 720 };

/** The board a frame leaves (a column panel narrows it), and what of it nothing covers. */
export function boardOf(frame: Frame, panel: boolean) {
  const column = panel && frame.width >= CHROME.columnFrom;
  const size = { width: frame.width - (column ? CHROME.column : 0), height: frame.height };
  const pad = { top: CHROME.top, bottom: CHROME.bottom, left: CHROME.side, right: CHROME.side };
  return { size, pad, visible: { x: pad.left, y: pad.top, w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom } };
}
/** The board a layout wraps to, as the hooks measure it: in steps of 40 px. */
export const step = (s: { width: number; height: number }): DiagramBoardSize => ({ width: Math.round(s.width / 40) * 40, height: Math.round(s.height / 40) * 40 });


/* ── Geometry ── */

export const ATTACH = 1.5;
/** A lane: what keeps a route from reading as part of a border, a card's side or another route; two routes closer than
 *  `EDGE_LANE` read as one (the critics' 8 to 12). */
export const LANE = 6;
export const EDGE_LANE = 10;
/** Longer than this, two lines that close are read as one (a crossing, or a stub out of a shared port, is shorter). */
const ALONG = 10;
const SHARED = 20;
/** What a box keeps between its walls (and its header and sections) and what it holds. */
export const INSIDE_CLEAR = 8;
/** How far apart the ends of two different edges on one side of a card keep (round 9's F4). */
const END_APART = 8;

export interface Seg { a: Pt; b: Pt; i: number }
export const segs = (pts: readonly Pt[]): Seg[] => pts.slice(1).map((b, i) => ({ a: pts[i]!, b, i }));
export const level = (s: Seg) => Math.abs(s.a.y - s.b.y) < 0.5;
export const upright = (s: Seg) => Math.abs(s.a.x - s.b.x) < 0.5;
export const len = (s: Seg) => Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y);
export const shrink = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });
export const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.min(Math.max(a0, a1), Math.max(b0, b1)) - Math.max(Math.min(a0, a1), Math.min(b0, b1));
/** Whether a square run goes into a rect's inside. */
export const runIn = (s: Seg, r: Rect) => r.w > 0 && r.h > 0 && Math.max(s.a.x, s.b.x) > r.x && Math.min(s.a.x, s.b.x) < r.x + r.w && Math.max(s.a.y, s.b.y) > r.y && Math.min(s.a.y, s.b.y) < r.y + r.h;
export const rectsMeet = (p: Rect, q: Rect) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
/** How far a point is from a rect's border (0 on it). */
export const fromBorder = (p: Pt, r: Rect) => {
  const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  if (inside) return Math.min(p.x - r.x, r.x + r.w - p.x, p.y - r.y, r.y + r.h - p.y);
  const dx = Math.max(r.x - p.x, 0, p.x - r.x - r.w), dy = Math.max(r.y - p.y, 0, p.y - r.y - r.h);
  return Math.hypot(dx, dy);
};
export const distToSeg = (p: Pt, s: Seg) => {
  const x = Math.min(Math.max(p.x, Math.min(s.a.x, s.b.x)), Math.max(s.a.x, s.b.x)), y = Math.min(Math.max(p.y, Math.min(s.a.y, s.b.y)), Math.max(s.a.y, s.b.y));
  return Math.hypot(p.x - x, p.y - y);
};
/** The four sides of a rect, and any other line a route mustn't run along (a box's hairline under its sections). */
export const sidesOf = (r: Rect): Seg[] => [
  { a: { x: r.x, y: r.y }, b: { x: r.x + r.w, y: r.y }, i: 0 }, { a: { x: r.x, y: r.y + r.h }, b: { x: r.x + r.w, y: r.y + r.h }, i: 1 },
  { a: { x: r.x, y: r.y }, b: { x: r.x, y: r.y + r.h }, i: 2 }, { a: { x: r.x + r.w, y: r.y }, b: { x: r.x + r.w, y: r.y + r.h }, i: 3 },
];
/** How long a run lies along a line, closer than `gap` to it. */
export const alongBy = (s: Seg, line: Seg, gap: number) => {
  if (level(s) && level(line) && Math.abs(s.a.y - line.a.y) < gap) return overlap1(s.a.x, s.b.x, line.a.x, line.b.x);
  if (upright(s) && upright(line) && Math.abs(s.a.x - line.a.x) < gap) return overlap1(s.a.y, s.b.y, line.a.y, line.b.y);
  return 0;
};
export const fmt = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;
export const fmtR = (r: Rect) => `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}×${Math.round(r.h)}`;

/** A box's header strip and sections: from its top to where what it holds starts. */
export const headOf = (n: DiagramNode) => ({ x: n.x, y: n.y, w: n.w, h: Math.min(n.h, nodeAnatomy(n, text).top) });
export const nameOf = (n: DiagramNode | undefined) => n?.title ?? n?.id ?? '?';

/* ── The rules ── */

export function check(d: DiagramDrawing): string[] {
  const out: string[] = [];
  const { index } = d;
  const nodes = index.nodes;
  const cards = nodes.filter((n) => !holdsNodes(n) && n.kind !== 'marker');
  const boxes = nodes.filter((n) => holdsNodes(n));
  // An entry marker: a dot above the card's start corner and a curved arrow from it into the start side, beside the header.
  const markers = nodes.filter((n) => n.entry).map((n) => ({ n, r: { x: n.x - 22, y: n.y - 16, w: 22, h: 34 } }));
  const labelOf = new Map(d.labels.map((l) => [l.edge.id, l.box]));
  const routes = d.edges.map(({ edge, geometry }) => ({ edge, pts: geometry.pts }));
  const byEdge = new Map(routes.map((r) => [r.edge.id, r]));
  const lines = (n: DiagramNode): Seg[] => {
    const own = sidesOf(n);
    const head = headOf(n);
    // A box with sections ends them on a hairline.
    if (holdsNodes(n) && n.kind !== 'region' && head.h > 0 && head.h < n.h) own.push({ a: { x: n.x, y: n.y + head.h }, b: { x: n.x + n.w, y: n.y + head.h }, i: 4 });
    return n.kind === 'region' ? [] : own;
  };
  const dividers: Seg[] = d.dividers.map((v, i) => ({ a: { x: v.x1, y: v.y1 }, b: { x: v.x2, y: v.y2 }, i }));

  // 1. Attached: on what it claims, on a side clear of the corners, its end run square to that side and outside it.
  const CORNER = 6;
  for (const { edge, pts } of routes) {
    if (pts.length < 2) continue;
    const a = index.byId.get(edge.from), b = index.byId.get(edge.to);
    if (!a || !b) continue;
    const end = (n: DiagramNode, p: Pt, next: Pt, port: string | undefined, other: DiagramNode, which: 'start' | 'end') => {
      const say = (why: string) => out.push(`1 attached: ${edge.id} ${which}s at ${fmt(p)}, ${why}`);
      const pp = port ? n.ports?.find((q) => q.id === port) : undefined;
      if (pp) {
        // Edges that share a port leave it side by side, a few units apart along its side.
        const at = portPoint(n, pp).p;
        if (Math.hypot(at.x - p.x, at.y - p.y) > LANE || fromBorder(p, n) > ATTACH) say(`not at its port ${port} on ${nameOf(n)} (${fmt(at)})`);
        return;
      }
      if (which === 'start' && edge.forkOf) {
        const l = labelOf.get(edge.forkOf);
        if (!l || fromBorder(p, l) > ATTACH) say(`not on ${edge.forkOf}’s label${l ? ` (${fmtR(l)})` : ''}, which it forks from`);
        return;
      }
      if (n.kind === 'marker') {
        if (fromBorder(p, n) > ATTACH) say(`${Math.round(fromBorder(p, n))} off ${nameOf(n)}`);
        return;
      }
      // A box's own edge to what it holds starts (or ends) under its sections, on the hairline, and runs into the box.
      if (holdsNodes(n) && isInside(index, other.id, n.id)) {
        const top = n.y + headOf(n).h;
        if (Math.abs(p.y - top) > ATTACH || p.x <= n.x + CORNER || p.x >= n.x + n.w - CORNER) say(`not under ${nameOf(n)}’s sections (its hairline is at y ${Math.round(top)})`);
        else if (next.y < p.y - 0.5) say(`and runs up out of ${nameOf(n)}’s sections`);
        return;
      }
      const d = fromBorder(p, n);
      if (d > ATTACH) { say(`${Math.round(d)} off ${nameOf(n)} (${fmtR(n)})`); return; }
      const onX = Math.abs(p.x - n.x) <= ATTACH || Math.abs(p.x - n.x - n.w) <= ATTACH, onY = Math.abs(p.y - n.y) <= ATTACH || Math.abs(p.y - n.y - n.h) <= ATTACH;
      const cornerless = Math.min(n.w, n.h) >= 4 * CORNER;
      if (cornerless && onX && onY) { say(`on ${nameOf(n)}’s corner`); return; }
      if (cornerless && ((onX && (p.y < n.y + CORNER || p.y > n.y + n.h - CORNER)) || (onY && (p.x < n.x + CORNER || p.x > n.x + n.w - CORNER)))) say(`within ${CORNER} of ${nameOf(n)}’s corner`);
      // Square to its side, and from outside the card: an arrowhead into it, a line out of it. (A straight or a curved route
      // goes as it's asked to.)
      if (edge.route === 'straight' || edge.route === 'curve') return;
      const out0 = onX ? { x: Math.abs(p.x - n.x) <= ATTACH ? -1 : 1, y: 0 } : { x: 0, y: Math.abs(p.y - n.y) <= ATTACH ? -1 : 1 };
      const run = { x: next.x - p.x, y: next.y - p.y };
      if (run.x * out0.x + run.y * out0.y <= 0.5 || Math.abs(run.x * out0.y) + Math.abs(run.y * out0.x) > 0.5) say(`not square out of ${nameOf(n)}’s side (its run there goes ${fmt(p)}→${fmt(next)})`);
    };
    end(a, pts[0]!, pts[1]!, edge.fromPort, b, 'start');
    end(b, pts[pts.length - 1]!, pts[pts.length - 2]!, edge.toPort, a, 'end');
  }
  // Ends of different edges on one side of a card keep apart (unless they share a port, which spreads them by a few
  // units): an arrowhead that lands where another edge leaves reads as one line through the wall.
  const sideEnds = new Map<string, { edge: DiagramEdge; p: Pt; which: 'start' | 'end'; port?: string }[]>();
  for (const { edge, pts } of routes) {
    if (pts.length < 2 || edge.from === edge.to) continue;
    for (const [which, id, p, port] of [['start', edge.from, pts[0]!, edge.fromPort], ['end', edge.to, pts[pts.length - 1]!, edge.toPort]] as const) {
      if (which === 'start' && edge.forkOf) continue;
      const n = index.byId.get(id);
      if (!n || n.kind === 'marker' || fromBorder(p, n) > ATTACH) continue;
      // A box's own edge to what it holds starts under its sections, not on a side.
      const other = index.byId.get(which === 'start' ? edge.to : edge.from);
      if (holdsNodes(n) && other && isInside(index, other.id, n.id)) continue;
      const side = Math.abs(p.y - n.y) <= ATTACH ? 'top' : Math.abs(p.y - n.y - n.h) <= ATTACH ? 'foot' : Math.abs(p.x - n.x) <= ATTACH ? 'start' : 'end';
      const key = `${n.id}\0${side}`;
      sideEnds.set(key, [...(sideEnds.get(key) ?? []), { edge, p, which, port }]);
    }
  }
  for (const [key, list] of sideEnds) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const u = list[i]!, v = list[j]!;
      if (u.edge.id === v.edge.id || (u.port && u.port === v.port)) continue;
      const apart = Math.hypot(u.p.x - v.p.x, u.p.y - v.p.y);
      if (apart >= END_APART) continue;
      const [id, side] = key.split('\0') as [string, string];
      const what = u.which !== v.which ? `${(u.which === 'end' ? u : v).edge.id}’s arrowhead lands on ${(u.which === 'end' ? v : u).edge.id}’s start` : `${u.edge.id} and ${v.edge.id} ${u.which === 'end' ? 'arrive' : 'leave'} at one point`;
      out.push(`1 attached: ${what} on ${nameOf(index.byId.get(id))}’s ${side} (${Math.round(apart)} apart at ${fmt(u.p)})`);
    }
  }

  // 2. Clear: of cards, markers, heads, borders and dividers.
  for (const { edge, pts } of routes) {
    for (const s of segs(pts)) {
      for (const c of cards) if (runIn(s, shrink(c, ATTACH))) out.push(`2 clear: ${edge.id} runs through ${nameOf(c)} (${fmt(s.a)}→${fmt(s.b)})`);
      for (const { n, r } of markers) if (runIn(s, shrink(r, 2))) out.push(`2 clear: ${edge.id} runs over ${nameOf(n)}’s entry marker (${fmt(s.a)}→${fmt(s.b)})`);
      for (const box of boxes) {
        const head = headOf(box);
        if (box.kind !== 'region' && head.h > 0 && runIn(s, shrink(head, ATTACH))) out.push(`2 clear: ${edge.id} runs through ${nameOf(box)}’s header and sections (${fmt(s.a)}→${fmt(s.b)})`);
        for (const line of lines(box)) {
          // A lane off a wall (round 9's F8: a fork 9 px inside `playing`'s); a hairline, J4's 6.
          const by = alongBy(s, line, line.i === 4 ? LANE : EDGE_LANE);
          if (by > ALONG) out.push(`2 clear: ${edge.id} runs ${Math.round(by)} along ${nameOf(box)}’s ${['top', 'foot', 'start side', 'end side', 'hairline'][line.i]} (${fmt(s.a)}→${fmt(s.b)})`);
        }
      }
      for (const c of cards) for (const line of sidesOf(c)) {
        const by = alongBy(s, line, 4);
        if (by > ALONG) out.push(`2 clear: ${edge.id} runs ${Math.round(by)} along ${nameOf(c)}’s side (${fmt(s.a)}→${fmt(s.b)})`);
      }
      for (const v of dividers) { const by = alongBy(s, v, LANE); if (by > ALONG) out.push(`2 clear: ${edge.id} runs ${Math.round(by)} along a region divider (${fmt(s.a)}→${fmt(s.b)})`); }
    }
    // Nor does it start or end where a divider meets a box's border: it would read as the divider going on.
    for (const p of [pts[0]!, pts[pts.length - 1]!]) for (const v of dividers) {
      const meets = [v.a, v.b].some((q) => Math.hypot(q.x - p.x, q.y - p.y) < LANE + 2) || (upright(v) && Math.abs(v.a.x - p.x) < EDGE_LANE + 4 && (Math.abs(Math.min(v.a.y, v.b.y) - p.y) < 40 || Math.abs(Math.max(v.a.y, v.b.y) - p.y) < 40));
      if (meets) out.push(`2 clear: ${edge.id} ends at ${fmt(p)}, where a region divider meets the border`);
    }
  }
  for (const n of nodes) {
    const p = n.parent ? index.byId.get(n.parent) : undefined;
    if (!p || p.kind === 'region' || n.kind === 'region') continue;
    const head = headOf(p), r = n.kind === 'marker' ? n : n;
    const gaps = { top: r.y - (p.y + head.h), start: r.x - p.x, end: p.x + p.w - (r.x + r.w), foot: p.y + p.h - (r.y + r.h) };
    for (const [side, g] of Object.entries(gaps)) if (g < INSIDE_CLEAR - 0.5) out.push(`2 clear: ${nameOf(n)} is ${Math.round(g)} from ${nameOf(p)}’s ${side === 'top' ? 'header and sections' : `${side} wall`}`);
  }

  // 3. A lane and a label of its own.
  const forks = (e: DiagramEdge, f: DiagramEdge) => e.forkOf === f.id || f.forkOf === e.id || (!!e.forkOf && e.forkOf === f.forkOf);
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const p = routes[i]!, q = routes[j]!;
    if (forks(p.edge, q.edge)) continue;
    let worst = 0, at: Seg | null = null;
    for (const s of segs(p.pts)) for (const t of segs(q.pts)) { const by = alongBy(s, t, EDGE_LANE); if (by > worst) { worst = by; at = s; } }
    if (worst > SHARED) out.push(`3 lanes: ${p.edge.id} and ${q.edge.id} share a lane for ${Math.round(worst)} (${fmt(at!.a)}→${fmt(at!.b)})`);
  }
  for (const { edge, box: l } of d.labels) {
    const own = byEdge.get(edge.id);
    const mid = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
    if (own && !segs(own.pts).some((s) => runIn(s, shrink(l, 1)) || distToSeg(mid, s) <= 3)) out.push(`3 labels: ${edge.id}’s label (${fmtR(l)}) isn’t on its route`);
    const inner = shrink(l, 1);
    for (const r of routes) if (r.edge.id !== edge.id && !forks(r.edge, edge) && segs(r.pts).some((s) => runIn(s, inner))) out.push(`3 labels: ${r.edge.id} runs through ${edge.id}’s label`);
    for (const c of cards) if (rectsMeet(inner, c)) out.push(`3 labels: ${edge.id}’s label is on ${nameOf(c)}`);
    for (const { n, r } of markers) if (rectsMeet(inner, r)) out.push(`3 labels: ${edge.id}’s label is on ${nameOf(n)}’s entry marker`);
    for (const o of d.labels) if (o.edge.id < edge.id && rectsMeet(inner, o.box)) out.push(`3 labels: ${edge.id}’s label is on ${o.edge.id}’s`);
    for (const box of boxes) {
      if (box.kind !== 'region' && rectsMeet(inner, headOf(box))) out.push(`3 labels: ${edge.id}’s label is on ${nameOf(box)}’s header and sections`);
      for (const line of lines(box)) if (runIn(line, inner)) out.push(`3 labels: ${edge.id}’s label straddles ${nameOf(box)}’s ${['top', 'foot', 'start side', 'end side', 'hairline'][line.i]}`);
    }
    for (const v of dividers) if (runIn(v, shrink(l, -LANE / 2))) out.push(`3 labels: ${edge.id}’s label is on a region divider`);
  }

  // 4. No U-turn.
  const facing = (from: Rect, to: Rect, n: Pt) => {
    const c = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    return n.x > 0 ? c.x > from.x + from.w : n.x < 0 ? c.x < from.x : n.y > 0 ? c.y > from.y + from.h : c.y < from.y;
  };
  const sideAt = (r: Rect, p: Pt): Pt => {
    const ds = [Math.abs(p.y - r.y), Math.abs(p.x - (r.x + r.w)), Math.abs(p.y - (r.y + r.h)), Math.abs(p.x - r.x)];
    const k = ds.indexOf(Math.min(...ds));
    return [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }][k]!;
  };
  /** The fewest bends between a side of `a` that faces `b` and a side of `b` that faces `a`, with nothing in the way. */
  const fewest = (a: Rect, b: Rect) => {
    const across = overlap1(a.x, a.x + a.w, b.x, b.x + b.w) > 16, down = overlap1(a.y, a.y + a.h, b.y, b.y + b.h) > 16;
    if (across || down) return 0;
    return 1;
  };
  // A route that ends with a hook (up past its target, across, and back down a stub onto it) is going round too (round 10's
  // F7, a fork into the top of a state it rose beside). A wide U under something in its way isn't a hook.
  for (const { edge, pts } of routes) {
    if (pts.length < 4 || edge.from === edge.to) continue;
    const s = segs(pts), n = s.length;
    const dir = (q: Seg) => ({ x: Math.sign(q.b.x - q.a.x), y: Math.sign(q.b.y - q.a.y) });
    const last = dir(s[n - 1]!), before = dir(s[n - 3]!);
    if (len(s[n - 1]!) > 0.5 && len(s[n - 1]!) <= 48 && len(s[n - 3]!) > 0.5 && last.x === -before.x && last.y === -before.y && (last.x || last.y)) out.push(`4 U-turn: ${edge.id} ends with a hook: past ${nameOf(index.byId.get(edge.to))}, across, and back onto it`);
  }
  for (const { edge, pts } of routes) {
    if (pts.length < 2 || edge.from === edge.to || edge.forkOf) continue;
    const a = index.byId.get(edge.from), b = index.byId.get(edge.to);
    if (!a || !b || isInside(index, a.id, b.id) || isInside(index, b.id, a.id) || a.kind === 'marker') continue;
    const bends = pts.length - 2;
    const least = fewest(a, b);
    const out0 = facing(a, b, sideAt(a, pts[0]!)), in0 = facing(b, a, sideAt(b, pts[pts.length - 1]!));
    if ((!out0 || !in0) && bends >= least + 3) out.push(`4 U-turn: ${edge.id} ${!out0 ? `leaves ${nameOf(a)} by a side away from ${nameOf(b)}` : `enters ${nameOf(b)} by its far side`} and takes ${bends} bends where ${least} would do`);
  }
  return out;
}

/** 6: the opening view (and the view that keeps what has the eye) shows the top-start corner, and what has the eye. The view
 *  is the component's (`firstView`, then `keepInView`); what's checked of it is plain geometry. */
export function checkView(d: DiagramDrawing, frame: Frame, panel: boolean, eyeIds: { nodes: string[]; edges: string[] } | null): string[] {
  const out: string[] = [];
  const { size, pad } = boardOf(frame, panel);
  let view = firstView(d.bounds, size, pad);
  const corner = drawingCorner(d, text);
  let must: Rect | null = null, want: Rect | null = null;
  if (eyeIds) {
    const union = (rs: Rect[]) => (rs.length ? { x: Math.min(...rs.map((r) => r.x)), y: Math.min(...rs.map((r) => r.y)), w: Math.max(...rs.map((r) => r.x + r.w)) - Math.min(...rs.map((r) => r.x)), h: Math.max(...rs.map((r) => r.y + r.h)) - Math.min(...rs.map((r) => r.y)) } : null);
    must = union(eyeIds.nodes.flatMap((id) => { const n = d.index.byId.get(id); return n ? [n] : []; }));
    want = union(eyeIds.edges.flatMap((id) => { const l = d.labels.find((x) => x.edge.id === id)?.box; return l ? [l] : []; }));
    if (must) view = keepInView(view, { must, want }, corner, size, pad);
  } else {
    // Nothing selected or current: where it starts (a machine's first state) has the eye.
    const start = diagramStartEye(d);
    if (start) { must = start.must; view = keepInView(view, start, corner, size, pad); }
  }
  const free = { w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom };
  const shown = (r: Rect) => {
    const x0 = r.x * view.zoom + view.x, y0 = r.y * view.zoom + view.y;
    return x0 >= pad.left - 1 && y0 >= pad.top - 1 && x0 + r.w * view.zoom <= size.width - pad.right + 1 && y0 + r.h * view.zoom <= size.height - pad.bottom + 1;
  };
  const readable = (r: Rect) => r.w * DIAGRAM_LEGIBLE_ZOOM <= free.w && r.h * DIAGRAM_LEGIBLE_ZOOM <= free.h;
  const where = `${frame.name}${panel ? ', panel open' : ''} (zoom ${view.zoom.toFixed(2)}, at ${Math.round(view.x)},${Math.round(view.y)})`;
  const both = (p: Rect, q: Rect) => ({ x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), w: Math.max(p.x + p.w, q.x + q.w) - Math.min(p.x, q.x), h: Math.max(p.y + p.h, q.y + q.h) - Math.min(p.y, q.y) });
  if (must && readable(must) && !shown(must)) out.push(`6 view: what has the eye (${fmtR(must)}) is out of view at ${where}`);
  if (must && want && readable(both(must, want)) && !shown(want)) out.push(`6 view: what it can do now (${fmtR(want)}) is out of view, though there’s room, at ${where}`);
  // The corner: always without an eye; with one, when the two can be read at once.
  const eyeAll = must && want && readable(both(must, want)) ? both(must, want) : must;
  if (corner && (!eyeAll || readable(both(corner, eyeAll))) && !shown(corner)) out.push(`6 view: the top-start corner (${fmtR(corner)}) is out of view at ${where}${must ? ', with what has the eye' : ''}`);
  const whole = d.bounds ? Math.min(1, free.w / d.bounds.w, free.h / d.bounds.h) : 1;
  if (view.zoom < Math.min(DIAGRAM_LEGIBLE_ZOOM, whole) - 0.001) out.push(`6 view: opens at ${view.zoom.toFixed(2)}, under the readable ${DIAGRAM_LEGIBLE_ZOOM}`);
  return out;
}

/** 5: the frame is used. */
export function checkShape(d: DiagramDrawing, frame: Frame, panel: boolean): string[] {
  const { visible } = boardOf(frame, panel);
  const b = d.bounds;
  if (!b) return [];
  // Text here is estimated, a little wider than a browser's: 1% of slack on the readable floor.
  const fits = Math.min(visible.w / b.w, visible.h / b.h) >= DIAGRAM_LEGIBLE_ZOOM * 0.99;
  if (fits) return [];
  const aspect = (b.w / b.h) / (visible.w / visible.h);
  const fillsWidth = b.w * DIAGRAM_LEGIBLE_ZOOM >= visible.w * 0.6;
  return aspect <= 2 && aspect >= 0.5 || fillsWidth ? [] : [`5 frame: ${Math.round(b.w)}×${Math.round(b.h)} doesn’t fit ${visible.w}×${visible.h} at a readable size, isn’t its shape (${aspect.toFixed(2)}×) and doesn’t fill its width`];
}

/** 7: a box holding N things holds N of them. */
export function checkAnnounced(d: DiagramDrawing, noun: string | ((n: DiagramNode) => string) | undefined, describe: (n: DiagramNode) => string): string[] {
  if (!noun) return [];
  const out: string[] = [];
  const nounOf = typeof noun === 'string' ? () => noun : noun;
  for (const n of d.index.nodes) {
    const kids = d.index.children.get(n.id) ?? [];
    if (!kids.length) continue;
    const said = describe(n);
    const m = /holding ([^.(]*)/.exec(said);
    if (!m) { out.push(`7 announced: ${nameOf(n)} doesn’t say what it holds: “${said.slice(0, 80)}”`); continue; }
    const counts = new Map<string, number>();
    for (const k of kids) counts.set(nounOf(k), (counts.get(nounOf(k)) ?? 0) + 1);
    for (const [what, count] of counts) {
      const re = new RegExp(`\\b${count} ${what}${count === 1 ? '' : 's'}\\b`);
      if (!re.test(m[1]!)) out.push(`7 announced: ${nameOf(n)} says “holding ${m[1]!.trim()}”, and holds ${count} ${what}${count === 1 ? '' : 's'}`);
    }
  }
  return out;
}

export const cardsOf = (d: DiagramDrawing) => d.index.nodes.filter((n) => !holdsNodes(n) && n.kind !== 'marker');

/** Stable: what the step didn't touch is where it was. */
export function checkStable(before: DiagramDrawing, after: DiagramDrawing, touched: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const n of cardsOf(before)) {
    if (touched.has(n.id)) continue;
    const m = after.index.byId.get(n.id);
    if (!m) continue;
    if (Math.abs(m.x - n.x) > 0.5 || Math.abs(m.y - n.y) > 0.5) out.push(`stable: ${nameOf(n)} moved from ${fmt(n)} to ${fmt(m)}`);
  }
  return out;
}

/** Placed: a new card is clear of what's there (cards, labels, markers, the header and sections of every box it's in or
 *  near); inside its box is rule 2's. */
export function checkPlaced(d: DiagramDrawing, id: string): string[] {
  const out: string[] = [];
  const n = d.index.byId.get(id);
  if (!n) return [`placed: ${id} isn’t drawn`];
  for (const c of cardsOf(d)) if (c.id !== id && rectsMeet(n, c)) out.push(`placed: ${nameOf(n)} is on ${nameOf(c)}`);
  for (const l of d.labels) if (rectsMeet(n, l.box)) out.push(`placed: ${nameOf(n)} is on ${l.edge.id}’s label`);
  for (const m of d.index.nodes) if (m.entry && m.id !== id && rectsMeet(n, { x: m.x - 22, y: m.y - 16, w: 22, h: 34 })) out.push(`placed: ${nameOf(n)} is on ${nameOf(m)}’s entry marker`);
  for (const b of d.index.nodes.filter((x) => holdsNodes(x) && x.kind !== 'region')) {
    if (rectsMeet(n, headOf(b))) out.push(`placed: ${nameOf(n)} is on ${nameOf(b)}’s header and sections`);
    // A box it isn't in: not on it at all.
    if (!isInside(d.index, id, b.id) && rectsMeet(n, b)) out.push(`placed: ${nameOf(n)} is on ${nameOf(b)}, which it isn’t in`);
  }
  return out;
}

/** In view: the view after a step is the least pan (`keepInView`) from the one before, on the board the panel leaves, and
 *  what the step made is in it (an edge's two ends with its label, when they can be read together). */
export function checkInView(d: DiagramDrawing, frame: Frame, view: Viewport, select: { nodes: string[]; edges: string[] }, what: string): { found: string[]; view: Viewport } {
  const { size, pad } = boardOf(frame, true);
  const eye = diagramEye(d, select, null, { ends: true });
  if (!eye) return { found: [`in view: ${what} has nothing to keep in view`], view };
  const next = keepInView(view, eye, drawingCorner(d, text), size, pad);
  const free = { w: size.width - pad.left - pad.right, h: size.height - pad.top - pad.bottom };
  const shown = (r: Rect) => {
    const x0 = r.x * next.zoom + next.x, y0 = r.y * next.zoom + next.y;
    return x0 >= pad.left - 1 && y0 >= pad.top - 1 && x0 + r.w * next.zoom <= size.width - pad.right + 1 && y0 + r.h * next.zoom <= size.height - pad.bottom + 1;
  };
  const found: string[] = [];
  const where = `${frame.name}, panel open (zoom ${next.zoom.toFixed(2)})`;
  for (const id of select.nodes) { const n = d.index.byId.get(id); if (n && !shown(n)) found.push(`in view: ${what}, ${nameOf(n)} (${fmtR(n)}) isn’t on the board at ${where}`); }
  for (const id of select.edges) {
    const label = d.labels.find((l) => l.edge.id === id)?.box;
    const e = d.edges.find((x) => x.edge.id === id)?.edge;
    if (label && !shown(label)) found.push(`in view: ${what}, ${id}’s label isn’t on the board at ${where}`);
    const ends = e ? [d.index.byId.get(e.from), d.index.byId.get(e.to)].filter((n): n is DiagramNode => !!n) : [];
    const all = [...ends, ...(label ? [label] : [])];
    const box = { x: Math.min(...all.map((r) => r.x)), y: Math.min(...all.map((r) => r.y)), w: 0, h: 0 };
    box.w = Math.max(...all.map((r) => r.x + r.w)) - box.x; box.h = Math.max(...all.map((r) => r.y + r.h)) - box.y;
    if (all.length && box.w * DIAGRAM_LEGIBLE_ZOOM <= free.w && box.h * DIAGRAM_LEGIBLE_ZOOM <= free.h) {
      for (const n of ends) if (!shown(n)) found.push(`in view: ${what}, ${id}’s end ${nameOf(n)} is under the panel or off the board at ${where}`);
    }
  }
  return { found, view: next };
}

/* ── What editing promises ── */

/** How far a label keeps from a bend on its run, and from where its route leaves a card; from the arrowhead's tip, which takes
 *  8 of it, enough for the head to be whole and a stroke of the line to show before it. */
export const LABEL_RUN_AIR = 8;
export const LABEL_ARROW_AIR = 16;

/** Which edges have a label of their own that the rules below hold: not a fork's (it starts at another's label) nor one forked
 *  from, nor a self-loop's (a loop's label rides its far side). */
const plainLabel = (d: DiagramDrawing, edge: DiagramEdge) => edge.from !== edge.to && !edge.forkOf && !d.edges.some((o) => o.edge.forkOf === edge.id);

/** A label lies on a straight run of its own route, the route drawn into it and out of it: a run of the line before it, and
 *  after it a run to the next bend or, into the end, room for the whole arrowhead (round 10's F1: a label 9 px above its
 *  target, the arrowhead a stub). */
export function checkLabelRuns(d: DiagramDrawing): string[] {
  const out: string[] = [];
  for (const { edge, box: l } of d.labels) {
    if (!plainLabel(d, edge)) continue;
    const pts = d.edges.find((x) => x.edge.id === edge.id)?.geometry.pts ?? [];
    if (pts.length < 2) continue;
    const mid = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
    const all = segs(pts);
    const run = all.find((s) => (level(s) ? Math.abs(s.a.y - mid.y) <= Math.max(3, l.h / 2 - 4) && mid.x >= Math.min(s.a.x, s.b.x) && mid.x <= Math.max(s.a.x, s.b.x) : upright(s) && Math.abs(s.a.x - mid.x) <= Math.max(3, l.w / 2 - 4) && mid.y >= Math.min(s.a.y, s.b.y) && mid.y <= Math.max(s.a.y, s.b.y)));
    if (!run) { out.push(`labels: ${edge.id}’s label (${fmtR(l)}) isn’t on a straight run of its route`); continue; }
    const k = level(run) ? 'x' : 'y', size = k === 'x' ? l.w : l.h, lo = k === 'x' ? l.x : l.y;
    const forward = run.b[k] >= run.a[k];
    const before = forward ? lo - run.a[k] : run.a[k] - (lo + size);
    const after = forward ? run.b[k] - (lo + size) : lo - run.b[k];
    const last = run.i === all.length - 1;
    if (before < LABEL_RUN_AIR - 1.5) out.push(`labels: ${edge.id}’s route isn’t drawn into its label (${Math.round(before)} of line before it, at ${fmt(run.a)})`);
    if (after < (last ? LABEL_ARROW_AIR : LABEL_RUN_AIR) - 1.5) out.push(last ? `labels: ${edge.id}’s arrowhead isn’t whole: its label ends ${Math.round(after)} from ${nameOf(d.index.byId.get(edge.to))}` : `labels: ${edge.id}’s route isn’t drawn out of its label (${Math.round(after)} of line after it, at ${fmt(run.b)})`);
  }
  return out;
}

/** Nothing overlaps: no card on another, nor on a box it isn't in, and no two boxes side by side over one another. */
export function checkOverlaps(d: DiagramDrawing): string[] {
  const out: string[] = [];
  const { index } = d;
  const cards = cardsOf(d);
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) if (rectsMeet(shrink(cards[i]!, 0.5), cards[j]!)) out.push(`overlaps: ${nameOf(cards[i])} is on ${nameOf(cards[j])}`);
  const boxes = index.nodes.filter((n) => holdsNodes(n) && n.kind !== 'region');
  for (const c of cards) for (const b of boxes) if (!isInside(index, c.id, b.id) && rectsMeet(shrink(c, 0.5), b)) out.push(`overlaps: ${nameOf(c)} is on ${nameOf(b)}, which it isn’t in`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const p = boxes[i]!, q = boxes[j]!;
    if (isInside(index, p.id, q.id) || isInside(index, q.id, p.id)) continue;
    if (rectsMeet(shrink(p, 0.5), q)) out.push(`overlaps: ${nameOf(p)} and ${nameOf(q)} are over one another`);
  }
  return out;
}

/** What a box holds, and the labels and routes of edges between what it holds, are inside it, under its header and sections:
 *  no label is outside the system (round 10's F2: JOBS on the root's header, no line into it). */
export function checkContained(d: DiagramDrawing): string[] {
  const out: string[] = [];
  const { index } = d;
  for (const box of index.nodes.filter((n) => holdsNodes(n) && n.kind !== 'region')) {
    const body = { x: box.x, y: box.y + headOf(box).h, w: box.w, h: box.h - headOf(box).h };
    const within = (r: Rect) => r.x >= body.x - 0.5 && r.y >= body.y - 0.5 && r.x + r.w <= body.x + body.w + 0.5 && r.y + r.h <= body.y + body.h + 0.5;
    for (const { edge, box: l } of d.labels) {
      if (!isInside(index, edge.from, box.id) || !isInside(index, edge.to, box.id)) continue;
      if (!within(l)) out.push(`contained: ${edge.id}’s label (${fmtR(l)}) is outside ${nameOf(box)}’s body (${fmtR(body)})`);
    }
    for (const { edge, geometry } of d.edges) {
      if (!isInside(index, edge.from, box.id) || !isInside(index, edge.to, box.id)) continue;
      const p = geometry.pts.find((q) => !within({ x: q.x, y: q.y, w: 0, h: 0 }));
      if (p) out.push(`contained: ${edge.id} runs outside ${nameOf(box)} (at ${fmt(p)})`);
    }
  }
  return out;
}

/** What a root's box is drawn round: what it holds, and the routes and labels of edges between them (an entry marker stands
 *  out past its card's corner). */
export function rootContent(d: DiagramDrawing): { root: DiagramNode; content: Rect } | null {
  const { index } = d;
  const root = index.nodes.find((n) => n.kind === 'root' && !index.parent.get(n.id));
  if (!root) return null;
  const rs: Rect[] = [];
  for (const n of index.nodes) {
    if (n.id === root.id || !isInside(index, n.id, root.id)) continue;
    rs.push(n);
  }
  for (const { edge, geometry } of d.edges) {
    if (!isInside(index, edge.from, root.id) || !isInside(index, edge.to, root.id)) continue;
    for (const p of geometry.pts) rs.push({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  for (const { edge, box } of d.labels) if (isInside(index, edge.from, root.id) && isInside(index, edge.to, root.id)) rs.push(box);
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
  return { root, content: { x: x0, y: y0, w: Math.max(...rs.map((r) => r.x + r.w)) - x0, h: Math.max(...rs.map((r) => r.y + r.h)) - y0 } };
}

/** The room a root's box keeps round what it holds, on each side: under its header and sections, at its sides and its foot. */
export function rootMargins(d: DiagramDrawing): { top: number; left: number; right: number; bottom: number } | null {
  const rc = rootContent(d);
  if (!rc) return null;
  const { root: r, content: c } = rc;
  return { top: c.y - (r.y + headOf(r).h), left: c.x - r.x, right: r.x + r.w - (c.x + c.w), bottom: r.y + r.h - (c.y + c.h) };
}

/** The root's box is the same function of what it holds in every path (round 10's F3: 7 px wider and 14 px taller after any
 *  edit): its header and sections, then what it holds with the room round it that the last layout (the first, or Tidy up)
 *  kept; never narrower than its header needs. */
export function checkRootBox(d: DiagramDrawing, margins: { top: number; left: number; right: number; bottom: number } | null): string[] {
  const rc = rootContent(d);
  if (!rc || !margins) return [];
  const { root, content: c } = rc;
  const a = nodeAnatomy(root, text);
  const want = { x: c.x - margins.left, y: c.y - margins.top - a.top, w: Math.max(a.w, c.w + margins.left + margins.right), h: a.top + margins.top + c.h + margins.bottom };
  const off = Math.max(Math.abs(root.x - want.x), Math.abs(root.y - want.y), Math.abs(root.w - want.w), Math.abs(root.h - want.h));
  return off > 1 ? [`root box: ${nameOf(root)} is ${fmtR(root)}, and what it holds would be drawn round as ${fmtR(want)}`] : [];
}

/** Made room, and nothing else: whatever moved that the step didn't touch moved as one monotone push does, along each axis
 *  (each card by as much as or more than those before it, cards level with one another by as much): order, rows and columns
 *  kept, every other gap kept. */
export function checkPushed(before: DiagramDrawing, after: DiagramDrawing, touched: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const moves = cardsOf(before).flatMap((n) => {
    const m = after.index.byId.get(n.id);
    return m && !touched.has(n.id) ? [{ n, d: { x: m.x - n.x, y: m.y - n.y } }] : [];
  });
  for (const k of ['x', 'y'] as const) {
    for (let i = 0; i < moves.length; i++) for (let j = 0; j < moves.length; j++) {
      const a = moves[i]!, b = moves[j]!;
      if (i === j || a.n[k] > b.n[k] + 0.5) continue;
      const levelled = Math.abs(a.n[k] - b.n[k]) <= 0.5;
      if (levelled ? Math.abs(a.d[k] - b.d[k]) > 0.5 : a.d[k] > b.d[k] + 0.5) {
        out.push(`pushed: ${nameOf(a.n)} moved ${Math.round(a.d[k])} along ${k} and ${nameOf(b.n)}${levelled ? ', level with it,' : ', after it,'} ${Math.round(b.d[k])}: that isn’t making room`);
        return out;
      }
    }
  }
  return out;
}

/** No route goes the long way round: a route between two cards is at most twice the square distance between its ends, and
 *  300 more (what going round a card or two takes). An edit that routes a connection a lap round the board isn't making room
 *  for it. */
export function checkDetours(d: DiagramDrawing): string[] {
  const out: string[] = [];
  for (const { edge, geometry } of d.edges) {
    const pts = geometry.pts;
    if (pts.length < 3 || edge.from === edge.to || edge.forkOf) continue;
    const a = pts[0]!, b = pts[pts.length - 1]!;
    const direct = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const length = segs(pts).reduce((t, s) => t + len(s), 0);
    if (length > direct * 2 + 300) out.push(`4 detour: ${edge.id} is ${Math.round(length)} long between ends ${Math.round(direct)} apart`);
  }
  return out;
}
