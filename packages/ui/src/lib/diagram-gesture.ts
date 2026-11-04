/* ══ Diagram gesture — selecting and moving, as one state machine that doesn't care about the camera ══
   `Canvas` hands over the pointer in board units, and this says what that means, as a pure function: which state comes
   next, what's selected, and what to commit. There's only ever one gesture, so a press can't start two things and a
   cancel can't leave one half done. Nothing's committed until the pointer comes up. */
import { dist, inFrame, intersects, rectOf, snapMove, unionRect, type Guide, type Pt, type Rect } from '@/lib/canvas-math';
import { ancestorsOf, edgeAt, nodeAt, type ConnectorGeometry, type DiagramIndex, type DiagramSelection } from '@/lib/diagram-model';

export type DiagramHit = { kind: 'node' | 'edge'; id: string } | null;

export type DiagramGesture =
  | { k: 'idle' }
  /** Down, and not far enough yet to be a drag. */
  | { k: 'press'; hit: DiagramHit; start: Pt; screen: Pt; additive: boolean; wasSelected: boolean }
  | { k: 'move'; ids: readonly string[]; start: Pt; delta: Pt; guides: Guide[]; box: Rect; others: readonly Rect[] }
  | { k: 'marquee'; start: Pt; rect: Rect; additive: boolean; before: DiagramSelection };

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
}

export interface DiagramGestureStep {
  gesture: DiagramGesture;
  /** The selection, if it changed. */
  selection?: DiagramSelection;
  /** Nodes to move, for good. */
  commit?: { ids: readonly string[]; delta: Pt };
}

/** How far the pointer goes, in px on screen, before a press is a drag. */
export const DRAG_THRESHOLD = 3;
/** How near a node has to come to another's edge or center to line up with it, in px on screen. */
export const SNAP_DISTANCE = 6;

const IDLE: DiagramGesture = { k: 'idle' };

const toggled = (list: readonly string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** How near a line has to be to the pointer to count as hit, in px on screen. */
export const EDGE_HIT_DISTANCE = 6;

/**
 * What's under a board point. A node on top of an edge comes first. An edge runs over what holds other nodes, so it and its
 * label come before those. A root's the background, and can't be hit at all.
 */
export function hitTestDiagram(p: Pt, what: { index: DiagramIndex<any>; geometries: ReadonlyMap<string, ConnectorGeometry>; labels: readonly { id: string; box: Rect }[] }, zoom: number): DiagramHit {
  const n = nodeAt(p, what.index);
  const node = n && n.kind !== 'root' ? n : null;
  const holds = node && (node.kind === 'compound' || node.kind === 'parallel' || node.kind === 'region');
  if (node && !holds) return { kind: 'node', id: node.id };
  const label = what.labels.find((l) => inFrame(p, l.box));
  if (label) return { kind: 'edge', id: label.id };
  const edge = edgeAt(p, what.geometries, EDGE_HIT_DISTANCE / zoom);
  if (edge) return { kind: 'edge', id: edge };
  return node ? { kind: 'node', id: node.id } : null;
}

/** What a node's selection can move. A root doesn't, and a region moves as its parallel state. Something inside something
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
    const holds = n.kind === 'compound' || n.kind === 'parallel' || n.kind === 'region';
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
      return { gesture: IDLE };
    }
    case 'cancel': {
      // Nothing was committed, so there's nothing to undo but a marquee's selection.
      if (g.k === 'marquee') return { gesture: IDLE, selection: g.before };
      return { gesture: IDLE };
    }
  }
}
