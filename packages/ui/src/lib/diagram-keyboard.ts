/* ══ Diagram keyboard — where focus goes, and what a screen reader hears ══
   A canvas is pointer-first, so this is the other way in. The diagram is one tab stop: from there the keys move focus between
   nodes and along edges, and Tab leaves. These are plain functions, so that none of them can get stuck: every item can be
   reached by `stepFocus` alone, whatever's connected to what.

     Arrows           to a neighbour that way, along an edge if there is one, or else whatever's nearest that way.
                      On an edge: right or down to where it goes, left or up to where it comes from.
     [ and ]          through a node's edges, and from an edge to the next one from the same node
     Alt + ↓ and ↑    into what a node holds, and out to what holds it
     PageDown, PageUp every node and then every edge, in order, round and round
     Home, End        the first and the last node */
import { centerOf, type Pt, type Rect } from '@/lib/canvas-math';
import { ancestorsOf, descendantsOf, type DiagramEdge, type DiagramIndex, type DiagramNode } from '@/lib/diagram-model';

export interface DiagramFocus {
  kind: 'node' | 'edge';
  id: string;
}

export interface DiagramFocusContext {
  index: DiagramIndex<any>;
  edges: readonly DiagramEdge<any>[];
}

/** The edges at each node, in the order they're listed, each once. */
export function edgesByNode(edges: readonly DiagramEdge<any>[]): Map<string, { out: DiagramEdge<any>[]; into: DiagramEdge<any>[] }> {
  const out = new Map<string, { out: DiagramEdge<any>[]; into: DiagramEdge<any>[] }>();
  const at = (id: string) => {
    let v = out.get(id);
    if (!v) { v = { out: [], into: [] }; out.set(id, v); }
    return v;
  };
  for (const e of edges) {
    at(e.from).out.push(e);
    if (e.to !== e.from) at(e.to).into.push(e);
  }
  return out;
}

/** How far off the direction of travel something can be and still count as that way: 60° either side. */
const CONE = 1.73;

function bestThatWay(from: DiagramNode<any>, dir: Pt, candidates: Iterable<DiagramNode<any>>): DiagramNode<any> | null {
  const a = centerOf(from);
  let best: DiagramNode<any> | null = null, score = Infinity;
  for (const n of candidates) {
    const c = centerOf(n);
    const vx = c.x - a.x, vy = c.y - a.y;
    const along = vx * dir.x + vy * dir.y;
    if (along <= 0) continue;
    const across = Math.abs(vx * dir.y - vy * dir.x);
    if (across > along * CONE) continue;
    // Something straight ahead beats something nearer but off to the side.
    const here = along + across * 2;
    if (here < score) { best = n; score = here; }
  }
  return best;
}

/** The node to go to from a node, that way: along an edge if one goes that way, or else whatever's nearest that way that
 *  isn't around it or in it. Null at the edge of the diagram, when there's nothing that way at all. */
export function nodeInDirection(id: string, dir: Pt, { index, edges }: DiagramFocusContext): string | null {
  const from = index.byId.get(id);
  if (!from) return null;
  const neighbours = new Map<string, DiagramNode<any>>();
  for (const e of edges) {
    const other = e.from === id ? e.to : e.to === id ? e.from : null;
    if (other && other !== id) { const n = index.byId.get(other); if (n) neighbours.set(other, n); }
  }
  const along = bestThatWay(from, dir, neighbours.values());
  if (along) return along.id;
  const around = new Set([id, ...ancestorsOf(index, id), ...descendantsOf(index, id)]);
  const rest = index.nodes.filter((n) => !around.has(n.id));
  return bestThatWay(from, dir, rest)?.id ?? null;
}

const DIRS = { ArrowRight: { x: 1, y: 0 }, ArrowLeft: { x: -1, y: 0 }, ArrowDown: { x: 0, y: 1 }, ArrowUp: { x: 0, y: -1 } } as const;

export type DiagramFocusStep = keyof typeof DIRS | 'edge+' | 'edge-' | 'in' | 'out' | 'next' | 'previous' | 'first' | 'last';

/** Everything that can be focused, in order: nodes, then edges. */
export function focusOrder({ index, edges }: DiagramFocusContext): DiagramFocus[] {
  return [
    // A root's the background: a pointer can't land on it, and it can't be selected or connected.
    ...index.nodes.filter((n) => n.kind !== 'root').map((n): DiagramFocus => ({ kind: 'node', id: n.id })),
    ...edges.filter((e) => index.byId.has(e.from) && index.byId.has(e.to)).map((e): DiagramFocus => ({ kind: 'edge', id: e.id })),
  ];
}

/** Where a key takes focus. Null means it stays where it is. */
export function stepFocus(current: DiagramFocus | null, step: DiagramFocusStep, ctx: DiagramFocusContext): DiagramFocus | null {
  const order = focusOrder(ctx);
  if (!order.length) return null;
  const nodes = order.filter((f) => f.kind === 'node');
  if (step === 'first') return nodes.length ? { kind: 'node', id: nodes[0].id } : null;
  if (step === 'last') return nodes.length ? { kind: 'node', id: nodes[nodes.length - 1].id } : null;
  if (!current) return order[0];
  if (step === 'next' || step === 'previous') {
    const at = order.findIndex((f) => f.kind === current.kind && f.id === current.id);
    const by = step === 'next' ? 1 : -1;
    return order[at < 0 ? 0 : (at + by + order.length) % order.length];
  }
  if (current.kind === 'edge') {
    const e = ctx.edges.find((x) => x.id === current.id);
    if (!e) return null;
    if (step === 'ArrowRight' || step === 'ArrowDown') return { kind: 'node', id: e.to };
    if (step === 'ArrowLeft' || step === 'ArrowUp') return { kind: 'node', id: e.from };
    if (step === 'edge+' || step === 'edge-') {
      const list = ctx.edges.filter((x) => x.from === e.from);
      const at = list.findIndex((x) => x.id === e.id);
      return { kind: 'edge', id: list[(at + (step === 'edge+' ? 1 : -1) + list.length) % list.length].id };
    }
    return null;
  }
  if (step === 'in') {
    const kids = ctx.index.children.get(current.id);
    return kids?.length ? { kind: 'node', id: kids[0].id } : null;
  }
  if (step === 'out') {
    const parent = ctx.index.parent.get(current.id);
    return parent ? { kind: 'node', id: parent } : null;
  }
  if (step === 'edge+' || step === 'edge-') {
    // Those going out first, then those coming in, so all of a node's edges can be stepped through.
    const list = [...ctx.edges.filter((x) => x.from === current.id), ...ctx.edges.filter((x) => x.to === current.id && x.from !== current.id)];
    if (!list.length) return null;
    return { kind: 'edge', id: (step === 'edge+' ? list[0] : list[list.length - 1]).id };
  }
  const to = nodeInDirection(current.id, DIRS[step], ctx);
  return to ? { kind: 'node', id: to } : null;
}

/** Where a node that's gone leaves focus: on whatever's nearest where it was. */
export function nearestNode(index: DiagramIndex<any>, p: Pt): string | null {
  let best: string | null = null, d = Infinity;
  for (const n of index.nodes) {
    if (n.kind === 'root') continue;
    const c = centerOf(n);
    const here = Math.hypot(c.x - p.x, c.y - p.y);
    if (here < d) { best = n.id; d = here; }
  }
  return best;
}

/* ── What a screen reader hears ── */

const nameOf = (n: DiagramNode<any> | undefined, fallback: string) => n?.label || fallback;

function kindOf(n: DiagramNode<any>, index: DiagramIndex<any>, noun: string): string {
  const count = index.children.get(n.id)?.length ?? 0;
  const inside = count === 1 ? `holding 1 ${noun}` : `holding ${count} ${noun}s`;
  switch (n.kind) {
    case 'initial': return 'start marker';
    case 'final': return `final ${noun}`;
    case 'compound': return `group, ${inside}`;
    case 'parallel': return `parallel group, ${inside}`;
    case 'region': return `region, ${inside}`;
    case 'root': return `diagram, ${inside}`;
    default: return noun;
  }
}

const MAX_LISTED = 5;

function listEdges(edges: readonly DiagramEdge<any>[], name: (e: DiagramEdge<any>) => string, word: string): string {
  if (!edges.length) return '';
  const shown = edges.slice(0, MAX_LISTED).map(name).join(', ');
  const more = edges.length > MAX_LISTED ? `, and ${edges.length - MAX_LISTED} more` : '';
  return ` ${edges.length} ${word}: ${shown}${more}.`;
}

/** What a node is, what it's in, and what it connects to, as a sentence or two. */
export function describeNode(node: DiagramNode<any>, index: DiagramIndex<any>, at: { out: readonly DiagramEdge<any>[]; into: readonly DiagramEdge<any>[] } | undefined, noun = 'node'): string {
  const parent = index.parent.get(node.id);
  const parentNode = parent ? index.byId.get(parent) : undefined;
  const where = parentNode && parentNode.kind !== 'root' ? `, in ${nameOf(parentNode, parentNode.id)}` : '';
  const name = node.kind === 'initial' ? 'Start' : nameOf(node, node.id);
  const detail = node.detail ? ` ${node.detail}.` : '';
  const out = at?.out ?? [], into = at?.into ?? [];
  const going = (e: DiagramEdge<any>) => (e.to === node.id ? `${e.label ? `${e.label} ` : ''}back to itself` : `${e.label ? `${e.label} ` : ''}to ${nameOf(index.byId.get(e.to), e.to)}`);
  const coming = (e: DiagramEdge<any>) => `${e.label ? `${e.label} ` : ''}from ${nameOf(index.byId.get(e.from), e.from)}`;
  const none = !out.length && !into.length ? ' Not connected to anything.' : '';
  return `${name}, ${kindOf(node, index, noun)}${where}.${detail}${listEdges(out, going, 'going out')}${listEdges(into, coming, 'coming in')}${none}`;
}

/** What an edge is, and what it joins. */
export function describeEdge(edge: DiagramEdge<any>, index: DiagramIndex<any>): string {
  const from = nameOf(index.byId.get(edge.from), edge.from), to = nameOf(index.byId.get(edge.to), edge.to);
  const what = edge.label ? `${edge.label}, edge` : 'Edge';
  return edge.from === edge.to ? `${what} from ${from} back to itself.` : `${what} from ${from} to ${to}.`;
}

/* ── The view follows ── */

/** A camera that shows `box`, moving as little as it can, with `margin` px of air. If it doesn't fit at this zoom, it's
 *  centered instead. Returns the same camera if it's already in view. */
export function cameraToShow<C extends { x: number; y: number; z: number }>(camera: C, box: Rect, size: { width: number; height: number }, margin = 48): C {
  const left = box.x * camera.z + camera.x, top = box.y * camera.z + camera.y;
  const w = box.w * camera.z, h = box.h * camera.z;
  const axis = (start: number, length: number, room: number) => {
    if (length + margin * 2 > room) return room / 2 - (start + length / 2);
    if (start < margin) return margin - start;
    if (start + length > room - margin) return room - margin - (start + length);
    return 0;
  };
  const dx = axis(left, w, size.width), dy = axis(top, h, size.height);
  return dx || dy ? { ...camera, x: camera.x + dx, y: camera.y + dy } : camera;
}
