/* ══ Diagram gesture — selecting and moving, as one state machine that doesn't care about the camera ══
   `Canvas` hands over the pointer in board units, and this says what that means, as a pure function: which state comes
   next, what's selected, and what to commit. There's only ever one gesture, so a press can't start two things and a
   cancel can't leave one half done. Nothing's committed until the pointer comes up. */
import { dist, inFrame, intersects, rectOf, snapMove, unionRect, type Guide, type Pt, type Rect } from '@/lib/canvas-math';
import { ancestorsOf, edgesAtPoint, holdsNodes, nodeAt, portPoint, type ConnectorGeometry, type DiagramConnection, type DiagramIndex, type DiagramSelection, type DiagramSide } from '@/lib/diagram-model';

/** Where a connection starts or lands: a node, or one of its ports. */
export interface DiagramConnectionEnd {
  node: string;
  port?: string;
}

/** What's under the pointer: a node or edge, a place to start a connection, or an end of a selected edge to move. */
export type DiagramHit =
  | { kind: 'node' | 'edge'; id: string }
  | { kind: 'port'; id: string; port?: string; side?: DiagramSide }
  | { kind: 'end'; id: string; end: 'from' | 'to' }
  | null;

export type DiagramGesture =
  | { k: 'idle' }
  /** Down, and not far enough yet to be a drag. */
  | { k: 'press'; hit: Extract<DiagramHit, { kind: 'node' | 'edge' } | null>; start: Pt; screen: Pt; additive: boolean; wasSelected: boolean }
  | { k: 'move'; ids: readonly string[]; start: Pt; delta: Pt; guides: Guide[]; box: Rect; others: readonly Rect[] }
  | { k: 'marquee'; start: Pt; rect: Rect; additive: boolean; before: DiagramSelection }
  /** Drawing a connection, or moving an end of `edge`. `fixed` is the end that stays, and `over` what's being offered. */
  | { k: 'connect'; fixed: DiagramConnectionEnd; side?: DiagramSide; edge?: string; end: 'from' | 'to'; at: Pt; over: DiagramConnectionEnd | null; valid: true | string | null; keyboard?: boolean };

export type DiagramGestureEvent =
  | { type: 'down'; hit: DiagramHit; board: Pt; screen: Pt; additive: boolean }
  | { type: 'move'; board: Pt; screen: Pt; noSnap?: boolean }
  | { type: 'up' }
  | { type: 'cancel' };

export interface DiagramGestureContext {
  index: DiagramIndex<any>;
  selection: DiagramSelection;
  /** The camera's zoom, for what's measured on screen. */
  zoom: number;
  /** Whether dragging a node moves it. */
  editable: boolean;
  /** Whether connections can be drawn, and what's there to land on, and whether it's allowed. */
  connect?: {
    targetAt: (p: Pt) => DiagramConnectionEnd | null;
    check: (c: DiagramConnection) => true | string;
    edgeEnds: (id: string) => { from: DiagramConnectionEnd; to: DiagramConnectionEnd } | null;
  };
}

export interface DiagramGestureStep {
  gesture: DiagramGesture;
  /** The selection, if it changed. */
  selection?: DiagramSelection;
  /** Nodes to move, for good. */
  commit?: { ids: readonly string[]; delta: Pt };
  /** A connection to make, or an end to move. */
  connect?: DiagramConnection;
}

/** How far the pointer goes, in px on screen, before a press is a drag. */
export const DRAG_THRESHOLD = 3;
/** How near a node has to come to another's edge or center to line up with it, in px on screen. */
export const SNAP_DISTANCE = 6;

const IDLE: DiagramGesture = { k: 'idle' };

const toggled = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** How near a line has to be to the pointer to count as hit, in px on screen. */
export const EDGE_HIT_DISTANCE = 6;
/** How near a port or an edge's end has to be to be pressed, in px on screen. */
export const PORT_HIT_DISTANCE = 10;
/** How near the pointer has to come to a port for a connection to land on it, in px on screen. React Flow's is 20. */
export const SNAP_RADIUS = 24;

/** What a connection would land on at a board point: the nearest port in reach, wherever it is, even under another node.
 *  Failing that, the deepest node there. A root's the background, so it can't be connected to. */
export function connectionTargetAt(p: Pt, index: DiagramIndex<any>, zoom: number): DiagramConnectionEnd | null {
  const reach = SNAP_RADIUS / zoom;
  let best: DiagramConnectionEnd | null = null, d = reach;
  for (const n of index.nodes) {
    if (!n.ports) continue;
    for (const port of n.ports) {
      const here = dist(portPoint(n, port).p, p);
      if (here <= d) { best = { node: n.id, port: port.id }; d = here; }
    }
  }
  if (best) return best;
  const n = nodeAt(p, index, 8 / zoom);
  return n && n.kind !== 'root' ? { node: n.id } : null;
}

/** The connection a gesture would make, if it landed on `over`. */
export function connectionOf(g: Extract<DiagramGesture, { k: 'connect' }>, over: DiagramConnectionEnd): DiagramConnection {
  const fixed = { node: g.fixed.node, port: g.fixed.port };
  const [a, b] = g.end === 'to' ? [fixed, over] : [over, fixed];
  return { from: a.node, ...(a.port ? { fromPort: a.port } : null), to: b.node, ...(b.port ? { toPort: b.port } : null), ...(g.edge ? { edge: g.edge } : null) };
}

/** A press in a place that starts a connection or moves an edge's end. */
export function startConnection(hit: Extract<NonNullable<DiagramHit>, { kind: 'port' | 'end' }>, at: Pt, ctx: DiagramGestureContext): Extract<DiagramGesture, { k: 'connect' }> | null {
  if (hit.kind === 'port') return { k: 'connect', fixed: { node: hit.id, ...(hit.port ? { port: hit.port } : null) }, side: hit.side, end: 'to', at, over: null, valid: null };
  const ends = ctx.connect?.edgeEnds(hit.id);
  if (!ends) return null;
  // What stays is the other end.
  return { k: 'connect', fixed: hit.end === 'to' ? ends.from : ends.to, edge: hit.id, end: hit.end, at, over: null, valid: null };
}

/** The ends a connection could use instead of `end`: ports at the same place as its port (they're one place to connect), or
 *  every port of its node when it names none (a press or a drop on the card itself). `end` first. */
function endsLike(end: DiagramConnectionEnd, ctx: DiagramGestureContext): DiagramConnectionEnd[] {
  const n = ctx.index.byId.get(end.node);
  if (!n?.ports?.length) return [end];
  const own = end.port ? n.ports.find((p) => p.id === end.port) : undefined;
  if (end.port && !own) return [end];
  const here = own ? portPoint(n, own).p : null;
  const like = n.ports.filter((p) => p.id !== end.port && (!here || dist(portPoint(n, p).p, here) < 0.5));
  return [end, ...like.map((p) => ({ node: end.node, port: p.id }))];
}

/** Ends of one node in the order its ports are declared, a bare node first. */
function inCardOrder(ends: DiagramConnectionEnd[], ctx: DiagramGestureContext): DiagramConnectionEnd[] {
  const order = ctx.index.byId.get(ends[0]?.node ?? '')?.ports?.map((p) => p.id) ?? [];
  const rank = (e: DiagramConnectionEnd) => (e.port ? order.indexOf(e.port) : -1);
  return [...ends].sort((a, b) => rank(a) - rank(b));
}

/** A connection gesture, offered `over`. Where the ports it's between aren't a connection the rule allows, but others at the
 *  same places are (or `over` is a node, and one of its ports is), it's offered between those: the first the rule takes. */
export function offerConnection(g: Extract<DiagramGesture, { k: 'connect' }>, at: Pt, over: DiagramConnectionEnd | null, ctx: DiagramGestureContext): Extract<DiagramGesture, { k: 'connect' }> {
  if (!over || !ctx.connect) return { ...g, at, over, valid: null };
  const check = ctx.connect.check;
  // Ports at one place are one place to connect, whichever of them the pointer is nearest (they're all under it): tried in
  // the order each card has them, the first pair the rule takes. An edge's end that's being moved keeps the other end it has.
  const fixeds = g.edge ? [g.fixed] : inCardOrder(endsLike(g.fixed, ctx), ctx);
  const overs = inCardOrder(endsLike(over, ctx), ctx);
  for (const fixed of fixeds) {
    for (const o of overs) {
      const tried = fixed === g.fixed ? g : { ...g, fixed };
      if (check(connectionOf(tried, o)) === true) return { ...tried, at, over: o, valid: true };
    }
  }
  const valid = check(connectionOf(g, over));
  // Why not: as it was offered, or, for a node with ports, as its first port would be.
  return { ...g, at, over, valid: over.port || !overs[1] ? valid : check(connectionOf(g, overs[1])) };
}

/**
 * What's under a board point. A node on top of an edge comes first. An edge runs over what holds other nodes, so it and its
 * label come before those. A root's the background, and can't be hit at all. Where edges lie on one line, it's the one
 * selected, or with `cycle` the next one after it, so that pressing again goes to each in turn. With none of them
 * selected, it's the last given.
 */
export function hitTestDiagram(p: Pt, what: {
  index: DiagramIndex<any>; geometries: ReadonlyMap<string, ConnectorGeometry>; labels: readonly { id: string; box: Rect }[];
  /** Places on top of everything that start a connection or move an edge's end, nearest first. */
  handles?: readonly { hit: NonNullable<DiagramHit>; at: Pt }[];
  selectedEdges?: readonly string[];
  cycle?: boolean;
}, zoom: number): DiagramHit {
  let handle: NonNullable<DiagramHit> | null = null, near = PORT_HIT_DISTANCE / zoom;
  for (const h of what.handles ?? []) {
    const d = dist(h.at, p);
    if (d <= near) { handle = h.hit; near = d; }
  }
  if (handle) return handle;
  const n = nodeAt(p, what.index);
  const node = n && n.kind !== 'root' ? n : null;
  const holds = node && holdsNodes(node);
  if (node && !holds) return { kind: 'node', id: node.id };
  const label = what.labels.find((l) => inFrame(p, l.box));
  if (label) return { kind: 'edge', id: label.id };
  const along = edgesAtPoint(p, what.geometries, EDGE_HIT_DISTANCE / zoom);
  if (along.length) {
    const at = what.selectedEdges?.length ? along.findIndex((id) => what.selectedEdges!.includes(id)) : -1;
    return { kind: 'edge', id: at < 0 ? along[along.length - 1] : what.cycle ? along[(at + 1) % along.length] : along[at] };
  }
  return node ? { kind: 'node', id: node.id } : null;
}

/** What a node's selection can move. A root doesn't, and a region moves as the group it's a lane of. Something inside something
 *  else that's also moving only goes along with it. */
export function movableNodes(index: DiagramIndex<any>, ids: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const n = index.byId.get(id);
    if (!n || n.kind === 'root') continue;
    const parent = index.parent.get(id);
    out.add(n.kind === 'region' && parent ? parent : id);
  }
  return [...out].filter((id) => !ancestorsOf(index, id).some((a) => out.has(a)));
}

/** What a marquee takes: a leaf it touches, and something holding others only if it's all inside. A root never. */
export function nodesInMarquee(index: DiagramIndex<any>, rect: Rect): string[] {
  const out: string[] = [];
  for (const n of index.nodes) {
    if (n.kind === 'root') continue;
    const holds = holdsNodes(n);
    const touched = holds
      ? n.x >= rect.x && n.y >= rect.y && n.x + n.w <= rect.x + rect.w && n.y + n.h <= rect.y + rect.h
      : intersects(rect, n);
    if (touched) out.push(n.id);
  }
  return out;
}

/** What can be lined up with while moving `ids`: everything else that isn't around them. */
function snapTargets(index: DiagramIndex<any>, ids: readonly string[]): Rect[] {
  const moving = new Set(ids);
  const around = new Set<string>();
  for (const id of ids) for (const a of ancestorsOf(index, id)) around.add(a);
  const out: Rect[] = [];
  for (const n of index.nodes) {
    if (moving.has(n.id) || around.has(n.id) || n.kind === 'root' || n.kind === 'region') continue;
    if (ancestorsOf(index, n.id).some((a) => moving.has(a))) continue;
    out.push(n);
  }
  return out;
}

function moved(g: Extract<DiagramGesture, { k: 'move' }>, board: Pt, zoom: number, noSnap?: boolean): DiagramGesture {
  let dx = board.x - g.start.x, dy = board.y - g.start.y;
  let guides: Guide[] = [];
  if (!noSnap) {
    const snap = snapMove({ ...g.box, x: g.box.x + dx, y: g.box.y + dy }, g.others as Rect[], SNAP_DISTANCE / zoom);
    dx += snap.dx;
    dy += snap.dy;
    guides = snap.guides;
  }
  return { ...g, delta: { x: dx, y: dy }, guides };
}

export function stepDiagramGesture(g: DiagramGesture, e: DiagramGestureEvent, ctx: DiagramGestureContext): DiagramGestureStep {
  const { selection } = ctx;
  switch (e.type) {
    case 'down': {
      if (g.k !== 'idle') return { gesture: g };
      const { hit, additive } = e;
      if (hit?.kind === 'port' || hit?.kind === 'end') {
        const connect = startConnection(hit, e.board, ctx);
        return connect ? { gesture: connect } : { gesture: g };
      }
      const press = (wasSelected: boolean): DiagramGesture => ({ k: 'press', hit, start: e.board, screen: e.screen, additive, wasSelected });
      if (hit?.kind === 'node') {
        const was = selection.nodes.includes(hit.id);
        if (was) return { gesture: press(true) };
        return { gesture: press(false), selection: additive ? { ...selection, nodes: [...selection.nodes, hit.id] } : { nodes: [hit.id], edges: [] } };
      }
      if (hit?.kind === 'edge') {
        return { gesture: press(selection.edges.includes(hit.id)), selection: additive ? { ...selection, edges: toggled(selection.edges, hit.id) } : { nodes: [], edges: [hit.id] } };
      }
      return { gesture: press(false) };
    }
    case 'move': {
      if (g.k === 'press') {
        if (dist(e.screen, g.screen) < DRAG_THRESHOLD) return { gesture: g };
        if (g.hit === null) {
          const rect = rectOf([g.start, e.board]);
          const before = selection;
          const base = g.additive ? selection.nodes : [];
          return {
            gesture: { k: 'marquee', start: g.start, rect, additive: g.additive, before },
            selection: { nodes: [...new Set([...base, ...nodesInMarquee(ctx.index, rect)])], edges: g.additive ? selection.edges : [] },
          };
        }
        if (g.hit.kind === 'node' && ctx.editable) {
          const ids = movableNodes(ctx.index, selection.nodes);
          const box = unionRect(ids.map((id) => ctx.index.byId.get(id)!));
          if (!box) return { gesture: g };
          // From where the press was, so the first step of the drag isn't lost.
          return { gesture: moved({ k: 'move', ids, start: g.start, delta: { x: 0, y: 0 }, guides: [], box, others: snapTargets(ctx.index, ids) }, e.board, ctx.zoom, e.noSnap) };
        }
        return { gesture: g };
      }
      if (g.k === 'move') return { gesture: moved(g, e.board, ctx.zoom, e.noSnap) };
      if (g.k === 'connect') return g.keyboard ? { gesture: g } : { gesture: offerConnection(g, e.board, ctx.connect?.targetAt(e.board) ?? null, ctx) };
      if (g.k === 'marquee') {
        const rect = rectOf([g.start, e.board]);
        const base = g.additive ? g.before.nodes : [];
        return {
          gesture: { ...g, rect },
          selection: { nodes: [...new Set([...base, ...nodesInMarquee(ctx.index, rect)])], edges: g.additive ? g.before.edges : [] },
        };
      }
      return { gesture: g };
    }
    case 'up': {
      if (g.k === 'press') {
        if (g.hit?.kind === 'node' && g.wasSelected) {
          // A click on what's already selected: a click with the modifier takes it out, and one without leaves only it.
          return { gesture: IDLE, selection: g.additive ? { ...selection, nodes: selection.nodes.filter((x) => x !== g.hit!.id) } : { nodes: [g.hit.id], edges: [] } };
        }
        if (g.hit === null && !g.additive) return { gesture: IDLE, selection: { nodes: [], edges: [] } };
        return { gesture: IDLE };
      }
      if (g.k === 'move') return { gesture: IDLE, ...(g.delta.x || g.delta.y ? { commit: { ids: g.ids, delta: g.delta } } : null) };
      if (g.k === 'connect') {
        if (g.keyboard) return { gesture: g };
        return { gesture: IDLE, ...(g.over && g.valid === true ? { connect: connectionOf(g, g.over) } : null) };
      }
      return { gesture: IDLE };
    }
    case 'cancel': {
      // Nothing was committed, so there's nothing to undo but a marquee's selection.
      if (g.k === 'marquee') return { gesture: IDLE, selection: g.before };
      return { gesture: IDLE };
    }
  }
}
