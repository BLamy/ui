/* Freeform's geometry: what a connector's ends are on the board, item bounds and hit testing. Connector routes, anchors and
   arrowheads are the diagram model's, in @/lib/diagram-model, and the frame math underneath (rotated frames, corners,
   distances) is the canvas toolkit's, in @/lib/canvas-math. All in board units. */
import { PK_TOOLS } from '@/components/ui/pencilkit/constants';
import { cornersOf, distToPolyline, inFrame, rectOf, type Pt, type Rect } from '@/lib/canvas-math';
import { anchorNormal, anchorPoint, connectorPath, type ConnectorEnd as RouteEnd, type ConnectorGeometry } from '@/lib/diagram-model';
import { isAttached, isBox, type ConnectorEnd, type ConnectorItem, type Item, type StrokeItem } from './model';

/* ── Connectors ── */

function endPoint(e: ConnectorEnd, byId: Map<string, Item>): RouteEnd {
  if (isAttached(e)) {
    const it = byId.get(e.id);
    if (it && isBox(it)) return { p: anchorPoint(it, e.side), n: anchorNormal(it, e.side) };
  }
  return { p: 'x' in e ? { x: e.x, y: e.y } : { x: 0, y: 0 }, n: null };
}

export function connectorGeometry(c: ConnectorItem, byId: Map<string, Item>): ConnectorGeometry {
  return connectorPath(c.route, endPoint(c.from, byId), endPoint(c.to, byId));
}

/* ── Bounds and hit testing ── */

/** Where a stroke's ink reaches, padded by half its widest nib. */
export function strokeFrame(points: StrokeItem['points'], tool: StrokeItem['tool'], width: number): Rect {
  const pad = (PK_TOOLS[tool].opt.size * width) / 2 + 1;
  const r = rectOf(points.map(([x, y]) => ({ x, y })));
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

/** An item's bounding box on the board (rotation applied; a connector's is its path's). */
export function boundsOf(item: Item, byId: Map<string, Item>): Rect {
  if (item.kind === 'connector') return rectOf(connectorGeometry(item, byId).pts);
  return rectOf(cornersOf(item));
}

/** Is the board point `p` on `item`? `tol` is how far off a thin thing (a stroke, a connector) still counts. */
export function hitItem(p: Pt, item: Item, byId: Map<string, Item>, tol: number): boolean {
  if (item.kind === 'connector') return distToPolyline(p, connectorGeometry(item, byId).pts) <= tol + item.width / 2;
  if (item.kind === 'stroke') {
    if (!inFrame(p, item, tol)) return false;
    const r = (PK_TOOLS[item.tool].opt.size * item.width) / 2 + tol;
    return distToPolyline(p, item.points.map(([x, y]) => ({ x, y }))) <= r;
  }
  // An unfilled shape with no text is hit on its outline, not its empty middle, so a frame drawn around other
  // things doesn't swallow clicks meant for them.
  if (item.kind === 'shape' && item.fill === null && !item.text) {
    const edge = tol + item.sw + 6;
    return inFrame(p, item, tol) && !inFrame(p, { ...item, x: item.x + edge, y: item.y + edge, w: item.w - edge * 2, h: item.h - edge * 2 });
  }
  return inFrame(p, item, tol);
}
