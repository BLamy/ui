/* ══ Diagram keyboard — where focus goes, and what a screen reader hears ══
   A canvas is pointer-first, so this is the other way in. The diagram is one tab stop: from there the keys move focus between
   nodes and along edges, and Tab leaves. These are plain functions, so that none of them can get stuck: every item can be
   reached by `stepFocus` alone, whatever's connected to what.

     Arrows           to a neighbour that way, along an edge if there is one, or else whatever's nearest that way.
                      On an edge: right or down to where it goes, left or up to where it comes from.
     [ and ]          through a node's edges, and from an edge to the next one from the same node
     Alt + ↓ and ↑    into a node's or an edge label's items (when they can be pressed) and then into what a node holds,
                      and out again to what holds it
     On an item       arrows to the next or the last item of the same node or label
     PageDown, PageUp every node and then every edge, in order, round and round
     Home, End        the first and the last node */
import { centerOf, type Pt, type Rect, type Viewport } from '@/lib/canvas-math';
import { ancestorsOf, descendantsOf, itemKey, sectionKey, type DiagramEdge, type DiagramIndex, type DiagramNode, type DiagramSection } from '@/lib/diagram-model';

/** A node or an edge, by id, or with `section` and `item` one of the items of its sections: what has focus, what
 *  `onAction` hands over, what a step goes to. */
export interface DiagramItem {
  kind: 'node' | 'edge';
  id: string;
  /** The section's address (`DiagramSection.id`, or its index), with `item`. */
  section?: string;
  /** The item's address (`DiagramSectionItem.id`, or its title). */
  item?: string;
}

export interface DiagramStepContext {
  index: DiagramIndex<any>;
  edges: readonly DiagramEdge<any>[];
  /** Whether items can be pressed, which makes them somewhere focus goes. */
  items?: boolean;
}

/** The items of a node's or an edge label's sections, in order, as addresses. */
export function itemsOf(owner: { kind: 'node' | 'edge'; id: string }, sections: readonly DiagramSection[] | undefined): DiagramItem[] {
  const out: DiagramItem[] = [];
  sections?.forEach((s, si) => { for (const it of s.items) out.push({ kind: owner.kind, id: owner.id, section: sectionKey(s, si), item: itemKey(it) }); });
  return out;
}

const sameItem = (a: DiagramItem, b: DiagramItem) => a.kind === b.kind && a.id === b.id && a.section === b.section && a.item === b.item;

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
export function nodeInDirection(id: string, dir: Pt, { index, edges }: DiagramStepContext): string | null {
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

export type DiagramStep = keyof typeof DIRS | 'edge+' | 'edge-' | 'in' | 'out' | 'next' | 'previous' | 'first' | 'last';

/** Everything that can be focused, in order: nodes, then edges. */
export function focusOrder({ index, edges }: DiagramStepContext): DiagramItem[] {
  return [
    // A root's the background: a pointer can't land on it, and it can't be selected or connected.
    ...index.nodes.filter((n) => n.kind !== 'root').map((n): DiagramItem => ({ kind: 'node', id: n.id })),
    ...edges.filter((e) => index.byId.has(e.from) && index.byId.has(e.to)).map((e): DiagramItem => ({ kind: 'edge', id: e.id })),
  ];
}

/** Where a key takes focus. Null means it stays where it is. */
export function stepFocus(current: DiagramItem | null, step: DiagramStep, ctx: DiagramStepContext): DiagramItem | null {
  const order = focusOrder(ctx);
  if (!order.length) return null;
  const nodes = order.filter((f) => f.kind === 'node');
  if (step === 'first') return nodes.length ? { kind: 'node', id: nodes[0].id } : null;
  if (step === 'last') return nodes.length ? { kind: 'node', id: nodes[nodes.length - 1].id } : null;
  if (!current) return order[0];
  const sectionsOf = (it: DiagramItem) => (it.kind === 'node' ? ctx.index.byId.get(it.id)?.sections : ctx.edges.find((e) => e.id === it.id)?.sections);
  if (current.item !== undefined) {
    // On an item: along its owner's items, and out to the owner; a group's children are past its items.
    const owner: DiagramItem = { kind: current.kind, id: current.id };
    const list = itemsOf(owner, sectionsOf(current));
    const at = list.findIndex((x) => sameItem(x, current));
    if (step === 'ArrowDown' || step === 'ArrowRight') return at >= 0 && at < list.length - 1 ? list[at + 1] : null;
    if (step === 'ArrowUp' || step === 'ArrowLeft') return at > 0 ? list[at - 1] : null;
    if (step === 'out') return owner;
    if (step === 'in') {
      const kids = current.kind === 'node' ? ctx.index.children.get(current.id) : undefined;
      return kids?.length ? { kind: 'node', id: kids[0].id } : null;
    }
    if (step === 'next' || step === 'previous') return stepFocus(owner, step, ctx);
    return null;
  }
  if (step === 'in' && ctx.items) {
    const first = itemsOf(current, sectionsOf(current))[0];
    if (first) return first;
  }
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

const nameOf = (n: DiagramNode<any> | undefined, fallback: string) => n?.title || fallback;

/** What a screen reader calls a node: one word for all of them, or a word for each (a system's environments and services). */
export type DiagramNoun = string | ((node: DiagramNode<any>) => string);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What a node is, and for a box, what it holds by kind ("holding 2 environments and 1 service"), and of the commonest kind
 *  under it, how many in all when that's more than it holds itself ("(12 services in all)"). */
function kindOf(n: DiagramNode<any>, index: DiagramIndex<any>, noun: DiagramNoun): string {
  const nounOf = typeof noun === 'string' ? () => noun : noun;
  const kids = index.children.get(n.id) ?? [];
  const counts = new Map<string, number>();
  for (const k of kids) counts.set(nounOf(k), (counts.get(nounOf(k)) ?? 0) + 1);
  const parts = [...counts].map(([word, count]) => plural(count, word));
  const holding = `holding ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] ?? 'nothing'}`;
  // The commonest kind of what's anywhere inside it, if there's more of it than it holds itself.
  const all = new Map<string, number>();
  for (const d of descendantsOf(index, n.id)) all.set(nounOf(index.byId.get(d)!), (all.get(nounOf(index.byId.get(d)!)) ?? 0) + 1);
  const [most, total] = [...all].sort((p, q) => q[1] - p[1])[0] ?? ['', 0];
  const inside = total > (counts.get(most) ?? 0) && counts.size ? `${holding} (${plural(total, most)} in all)` : holding;
  switch (n.kind) {
    case 'group': return `group, ${inside}`;
    case 'region': return `region, ${inside}`;
    case 'root': return `diagram, ${inside}`;
    default: return nounOf(n);
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
export function describeNode(node: DiagramNode<any>, index: DiagramIndex<any>, at: { out: readonly DiagramEdge<any>[]; into: readonly DiagramEdge<any>[] } | undefined, noun: DiagramNoun = 'node'): string {
  const parent = index.parent.get(node.id);
  const parentNode = parent ? index.byId.get(parent) : undefined;
  const where = parentNode && parentNode.kind !== 'root' ? `, in ${nameOf(parentNode, parentNode.id)}` : '';
  // A marker goes by its label ("Start, marker"), and is only a marker without one.
  const head = node.kind === 'marker' ? (node.title ? `${node.title}, marker` : 'Marker') : `${nameOf(node, node.id)}, ${kindOf(node, index, noun)}`;
  const badge = node.trailing ? `, ${node.trailing}` : '';
  const entry = node.entry ? ', where it starts' : '';
  const description = node.description ? ` ${node.description}.` : '';
  const out = at?.out ?? [], into = at?.into ?? [];
  const going = (e: DiagramEdge<any>) => (e.to === node.id ? `${e.title ? `${e.title} ` : ''}back to itself` : `${e.title ? `${e.title} ` : ''}to ${nameOf(index.byId.get(e.to), e.to)}`);
  const coming = (e: DiagramEdge<any>) => `${e.title ? `${e.title} ` : ''}from ${nameOf(index.byId.get(e.from), e.from)}`;
  const none = !out.length && !into.length ? ' Not connected to anything.' : '';
  return `${head}${badge}${entry}${where}.${description}${describeSections(node.sections)}${listEdges(out, going, 'going out')}${listEdges(into, coming, 'coming in')}${none}`;
}

/** A node's or an edge label's sections, as a sentence each: "Entry actions: onPause, onPlay." */
export function describeSections(sections: readonly DiagramSection[] | undefined): string {
  if (!sections?.length) return '';
  return sections.filter((s) => s.items.length).map((s) => ` ${s.title ? `${s.title}: ` : ''}${s.items.map((it) => (it.description ? `${it.title} ${it.description}` : it.title)).join(', ')}.`).join('');
}

/** What an item is, and whose: "onPause, Entry actions, in Paused". */
export function describeItem(item: DiagramItem, sections: readonly DiagramSection[] | undefined, owner: string): string {
  let found: { title: string; description?: string; section?: string } | null = null;
  sections?.forEach((s, si) => {
    if (sectionKey(s, si) !== item.section) return;
    const it = s.items.find((x) => itemKey(x) === item.item);
    if (it) found = { title: it.title, description: it.description, section: s.title };
  });
  if (!found) return owner;
  const f = found as { title: string; description?: string; section?: string };
  return `${f.title}${f.description ? ` ${f.description}` : ''}${f.section ? `, ${f.section}` : ''}, in ${owner}`;
}

/** What an edge is, and what it joins. */
export function describeEdge(edge: DiagramEdge<any>, index: DiagramIndex<any>): string {
  const from = nameOf(index.byId.get(edge.from), edge.from), to = nameOf(index.byId.get(edge.to), edge.to);
  const what = edge.title ? `${edge.title}, edge` : 'Edge';
  return `${what} from ${from} ${edge.from === edge.to ? 'back to itself' : `to ${to}`}.${describeSections(edge.sections)}`;
}

/* ── The view follows ── */

/** A viewport that shows `box`, moving as little as it can, with `margin` px of air. If it doesn't fit at this zoom, it's
 *  centered instead. Returns the same viewport if it's already in view. */
export function viewportToShow<V extends Viewport>(viewport: V, box: Rect, size: { width: number; height: number }, margin = 48): V {
  const left = box.x * viewport.zoom + viewport.x, top = box.y * viewport.zoom + viewport.y;
  const w = box.w * viewport.zoom, h = box.h * viewport.zoom;
  const axis = (start: number, length: number, room: number) => {
    if (length + margin * 2 > room) return room / 2 - (start + length / 2);
    if (start < margin) return margin - start;
    if (start + length > room - margin) return room - margin - (start + length);
    return 0;
  };
  const dx = axis(left, w, size.width), dy = axis(top, h, size.height);
  return dx || dy ? { ...viewport, x: viewport.x + dx, y: viewport.y + dy } : viewport;
}

/** The viewport moved by as little as brings all of `box` into what `insets` leave of the board (each side's px), or, when it
 *  can't fit there, its start into view when none of it is in view (and nothing when some is). The same viewport when it's
 *  in view already. */
export function viewportToKeep<V extends Viewport>(viewport: V, box: Rect, size: { width: number; height: number }, insets: { top: number; right: number; bottom: number; left: number }): V {
  const axis = (start: number, length: number, from: number, to: number) => {
    const end = start + length;
    if (length > to - from) return end < from || start > to ? from - start : 0;
    if (start < from) return from - start;
    if (end > to) return to - end;
    return 0;
  };
  const z = viewport.zoom;
  const dx = axis(box.x * z + viewport.x, box.w * z, insets.left, size.width - insets.right);
  const dy = axis(box.y * z + viewport.y, box.h * z, insets.top, size.height - insets.bottom);
  return Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5 ? { ...viewport, x: viewport.x + dx, y: viewport.y + dy } : viewport;
}

/** The viewport that shows all of `box`, centered in what's left once `padding` px are taken from each side (one number
 *  for all four, or each), and no closer than 100%: what a diagram shows until its view is moved. With nothing to show,
 *  the origin is in the middle of that room at 100%. */
export function fitViewport(box: Rect | null, size: { width: number; height: number }, padding: number | { top: number; right: number; bottom: number; left: number } = 24, { minZoom = 0.02, maxZoom = 1 }: { minZoom?: number; maxZoom?: number } = {}): Viewport {
  const pad = typeof padding === 'number' ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
  const w = Math.max(1, size.width - pad.left - pad.right), h = Math.max(1, size.height - pad.top - pad.bottom);
  const cx = pad.left + w / 2, cy = pad.top + h / 2;
  if (!box || box.w <= 0 || box.h <= 0) return { x: cx, y: cy, zoom: 1 };
  const zoom = Math.max(minZoom, Math.min(maxZoom, w / box.w, h / box.h));
  return { zoom, x: cx - (box.x + box.w / 2) * zoom, y: cy - (box.y + box.h / 2) * zoom };
}
