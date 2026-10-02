/* The board's surface: what Freeform does on the core Canvas. The canvas owns navigation (pan, pinch, wheel and
   keyboard zoom, the background); this owns every other pointer and key — items never take events; it hits them by
   geometry — so selection, move, resize, rotate, connect, draw and erase are one state machine (`Gesture`) instead of
   handlers spread over a dozen elements. Items render in the canvas's board layer, scaled by the camera. */
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { PencilPoint, PencilTool } from '@/components/ui/pencilkit/constants';
import { StrokePath } from '@/components/ui/pencilkit/stroke-path';
import { Canvas, CanvasFrame, CanvasGuides, CanvasHandles, CanvasMarquee, type CanvasPointerInfo } from '@/components/ui/canvas';
import { dist, handleCursor, intersects, rectOf, resizeFrame, rotateFrame, snapMove, toBoard, toScreen, unionRect, type Camera, type Guide, type HandleId, type Pt, type Rect } from '@/lib/canvas-math';
import { anchorPoint, boundsOf, connectorGeometry, hitItem, nearestAnchor, strokeFrame } from './geometry';
import { moveItem, scaleItem, selectionFrame } from './handles';
import { Connector, ItemView } from './items';
import { isAttached, isBox, makeConnector, type ConnectorEnd, type ConnectorItem, type Item, type StrokeItem } from './model';
import { cloneItems, useFreeform, withGroups } from './store';

export type Tool = 'select' | 'hand' | 'draw' | 'connector';
export interface DrawSettings { tool: PencilTool; ink: string; width: number }

interface Props {
  camera: Camera;
  onCameraChange: (camera: Camera) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  draw: DrawSettings;
  editing: string | null;
  setEditing: (id: string | null) => void;
}

type Gesture =
  | { k: 'marquee'; start: Pt; base: string[] }
  | { k: 'move'; start: Pt; sstart: Pt; ids: string[]; orig: Map<string, Item>; began: boolean; click: string | null; alt: boolean }
  | { k: 'resize'; handle: HandleId; item: Item; p0: Pt; began: boolean }
  | { k: 'scale'; handle: HandleId; origin: Pt; p0: Pt; origs: Item[]; began: boolean }
  | { k: 'rotate'; item: Item; began: boolean }
  | { k: 'endpoint'; id: string; which: 'from' | 'to'; began: boolean }
  | { k: 'draw' }
  | { k: 'erase'; began: boolean }
  | { k: 'connect'; from: ConnectorEnd; to: ConnectorEnd };

interface Ui {
  marquee: Rect | null;
  guides: Guide[];
  /** The item whose connection points show (while connecting). */
  anchors: { id: string; side: string } | null;
  cursor: string;
}

const HIT_PX = 11;

export function BoardSurface({ camera, onCameraChange, tool, setTool, draw, editing, setEditing }: Props) {
  const f = useFreeform();
  const { items, byId, selection, selected, board } = f;
  const g = useRef<Gesture | null>(null);
  const live = useRef<StrokeItem | null>(null);
  const [, redraw] = useState(0);
  const [ui, setUi] = useState<Ui>({ marquee: null, guides: [], anchors: null, cursor: 'default' });
  const [preview, setPreview] = useState<ConnectorItem | null>(null);
  const z = camera.z;

  const sel = useMemo(() => selectionFrame(selected, byId, z), [selected, byId, z]);
  const patchUi = (p: Partial<Ui>) => setUi((u) => ({ ...u, ...p }));

  const hitAt = (p: Pt): Item | null => {
    const tol = 6 / z;
    for (let i = items.length - 1; i >= 0; i--) if (hitItem(p, items[i], byId, tol)) return items[i];
    return null;
  };
  const handleAt = (s: Pt) => sel.handles.find((h) => dist(toScreen(camera, h.pt), s) <= HIT_PX);

  /* ── Text ── */
  const setText = (id: string, text: string) => {
    setEditing(null);
    const it = byId.get(id);
    if (!it || !('text' in it)) return;
    if (it.kind === 'text' && !text.trim()) { f.remove([id]); return; }
    if (text !== it.text) f.commit((all) => all.map((i) => (i.id === id && 'text' in i ? { ...i, text } : i)));
  };
  const grow = (id: string, h: number) => f.patch((all) => all.map((i) => (i.id === id && i.kind === 'text' && Math.abs(i.h - h) > 1 ? { ...i, h } : i)));

  /* ── Erasing and connecting ── */
  const eraseAt = (gs: { began: boolean }, p: Pt) => {
    const r = 14 / z;
    const hit = items.filter((i) => i.kind === 'stroke' && !i.locked && hitItem(p, i, byId, r)).map((i) => i.id);
    if (!hit.length) return;
    if (!gs.began) { gs.began = true; f.begin(); }
    f.patch((all) => all.filter((i) => !hit.includes(i.id)));
  };

  const endAt = (p: Pt, exclude?: string): { end: ConnectorEnd; anchor: ReturnType<typeof nearestAnchor> } => {
    const a = nearestAnchor(p, items, 30 / z, exclude);
    return { end: a ? { id: a.id, side: a.side } : { x: p.x, y: p.y }, anchor: a };
  };

  /* ── Pointer (the canvas has already taken pan and pinch) ── */
  const onPointerDown = (e: ReactPointerEvent, { screen: s, board: p }: CanvasPointerInfo) => {
    if (editing) setEditing(null);

    if (tool === 'draw') {
      if (draw.tool === 'eraser') { const gs = { k: 'erase' as const, began: false }; g.current = gs; eraseAt(gs, p); return; }
      const pen = e.pointerType === 'pen';
      live.current = { id: 'live', kind: 'stroke', tool: draw.tool, color: draw.ink, width: draw.width, pen, points: [[p.x, p.y, e.pressure > 0 ? e.pressure : 0.5]], x: p.x, y: p.y, w: 0, h: 0, rot: 0 };
      g.current = { k: 'draw' };
      redraw((n) => n + 1);
      return;
    }

    if (tool === 'connector') {
      const { end } = endAt(p);
      g.current = { k: 'connect', from: end, to: end };
      return;
    }

    // Select.
    const h = handleAt(s);
    if (h) {
      const only = selected[0];
      if (h.id === 'rot') g.current = { k: 'rotate', item: only, began: false };
      else if (h.id === 'from' || h.id === 'to') g.current = { k: 'endpoint', id: only.id, which: h.id, began: false };
      else if (sel.kind === 'single') g.current = { k: 'resize', handle: h.id, item: only, p0: p, began: false };
      else if (sel.frame) {
        const f0 = sel.frame;
        const origin = { x: h.id.includes('w') ? f0.x + f0.w : f0.x, y: h.id.includes('n') ? f0.y + f0.h : f0.y };
        g.current = { k: 'scale', handle: h.id, origin, p0: p, origs: selected.filter((i) => !i.locked), began: false };
      }
      return;
    }
    const hit = hitAt(p);
    if (hit) {
      const ids = withGroups(items, [hit.id]);
      if (e.shiftKey) {
        f.select(selection.includes(hit.id) ? selection.filter((id) => !ids.includes(id)) : [...selection, ...ids]);
        return;
      }
      const keep = selection.includes(hit.id);
      const moving = keep ? selection : ids;
      if (!keep) f.select(ids);
      g.current = { k: 'move', start: p, sstart: s, ids: moving, orig: new Map(items.filter((i) => moving.includes(i.id)).map((i) => [i.id, i])), began: false, click: keep && selection.length > 1 ? hit.id : null, alt: e.altKey };
      return;
    }
    if (!e.shiftKey) f.select([]);
    g.current = { k: 'marquee', start: p, base: e.shiftKey ? selection : [] };
  };

  const onPointerMove = (e: ReactPointerEvent, { screen: s, board: p }: CanvasPointerInfo) => {
    const gs = g.current;

    if (!gs) {
      // Hovering: the cursor, and the connection points while connecting.
      let cursor = tool === 'draw' ? (draw.tool === 'eraser' ? 'cell' : 'crosshair') : tool === 'connector' ? 'crosshair' : 'default';
      if (tool === 'select') {
        const h = handleAt(s);
        if (h) cursor = handleCursor(h.id, sel.frame?.rot ?? 0);
        else { const it = hitAt(p); if (it && selection.includes(it.id)) cursor = 'move'; }
      }
      const anchors = tool === 'connector' ? nearestAnchor(p, items, 30 / z) : null;
      setUi((u) => (u.cursor === cursor && u.anchors?.id === anchors?.id ? u : { ...u, cursor, anchors: anchors ? { id: anchors.id, side: anchors.side } : null }));
      return;
    }

    switch (gs.k) {
      case 'marquee': {
        const r = rectOf([gs.start, p]);
        patchUi({ marquee: r });
        const inside = items.filter((i) => intersects(r, boundsOf(i, byId))).map((i) => i.id);
        f.select([...new Set([...gs.base, ...withGroups(items, inside)])]);
        break;
      }
      case 'move': {
        if (!gs.began) {
          if (dist(s, gs.sstart) < 3) return;
          gs.began = true;
          f.begin();
          if (gs.alt) {
            // Option-drag moves a copy.
            const copies = cloneItems([...gs.orig.values()], 0);
            f.patch((all) => [...all, ...copies]);
            f.select(copies.map((c) => c.id));
            gs.ids = copies.map((c) => c.id);
            gs.orig = new Map(copies.map((c) => [c.id, c]));
          }
        }
        let dx = p.x - gs.start.x, dy = p.y - gs.start.y;
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        let guides: Guide[] = [];
        if (!e.metaKey && !e.ctrlKey) {
          const box = unionRect([...gs.orig.values()].map((i) => boundsOf(i, byId)));
          if (box) {
            const others = items.filter((i) => i.kind !== 'connector' && !gs.orig.has(i.id)).map((i) => boundsOf(i, byId));
            const r = snapMove({ ...box, x: box.x + dx, y: box.y + dy }, others, 6 / z);
            dx += r.dx; dy += r.dy; guides = r.guides;
          }
        }
        const { orig } = gs;
        f.patch((all) => all.map((i) => { const o = orig.get(i.id); return o && !o.locked ? moveItem(o, dx, dy) : i; }));
        patchUi({ guides });
        break;
      }
      case 'resize': {
        if (!gs.began) { gs.began = true; f.begin(); }
        const it = gs.item;
        if (it.kind === 'connector') break;
        const lock = it.kind === 'sticky' || it.kind === 'image' || e.shiftKey;
        const nf = resizeFrame(it, gs.handle, gs.p0, p, lock);
        f.patch((all) => all.map((i) => {
          if (i.id !== it.id) return i;
          if (it.kind === 'stroke') {
            const sx = nf.w / it.w, sy = nf.h / it.h;
            return { ...it, ...nf, points: it.points.map(([x, y, pr]) => [nf.x + (x - it.x) * sx, nf.y + (y - it.y) * sy, pr] as PencilPoint) };
          }
          // Text in a shape or sticky scales with it.
          const k = 'size' in it && isBox(it) && (it.kind === 'sticky' || it.kind === 'shape') ? { size: Math.max(8, Math.round(it.size * Math.sqrt((nf.w * nf.h) / (it.w * it.h)))) } : null;
          return { ...it, ...nf, ...(it.kind === 'sticky' ? k : null) } as Item;
        }));
        break;
      }
      case 'scale': {
        if (!gs.began) { gs.began = true; f.begin(); }
        const dx0 = gs.p0.x - gs.origin.x, dy0 = gs.p0.y - gs.origin.y;
        if (!dx0 || !dy0) break;
        const sx = (p.x - gs.origin.x) / dx0, sy = (p.y - gs.origin.y) / dy0;
        const k = Math.max(0.05, Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy);
        const { origs, origin } = gs;
        f.patch((all) => all.map((i) => { const o = origs.find((x) => x.id === i.id); return o ? scaleItem(o, k, k, origin) : i; }));
        break;
      }
      case 'rotate': {
        if (!gs.began) { gs.began = true; f.begin(); }
        const it = gs.item;
        if (it.kind === 'connector' || it.kind === 'stroke') break;
        const rot = rotateFrame(it, p, !e.shiftKey);
        f.patch((all) => all.map((i) => (i.id === it.id && i.kind !== 'connector' ? { ...i, rot } : i)));
        break;
      }
      case 'endpoint': {
        if (!gs.began) { gs.began = true; f.begin(); }
        const { end, anchor } = endAt(p, undefined);
        const { id, which } = gs;
        f.patch((all) => all.map((i) => (i.id === id && i.kind === 'connector' ? { ...i, [which]: end } : i)));
        patchUi({ anchors: anchor ? { id: anchor.id, side: anchor.side } : null });
        break;
      }
      case 'draw': {
        const st = live.current;
        if (!st) break;
        const ne = e.nativeEvent;
        const box = e.currentTarget.getBoundingClientRect();
        const evs: { clientX: number; clientY: number; pressure: number }[] = ne.getCoalescedEvents ? ne.getCoalescedEvents() : [e];
        for (const ev of evs) {
          const q = toBoard(camera, ev.clientX - box.left, ev.clientY - box.top);
          st.points.push([q.x, q.y, ev.pressure > 0 ? ev.pressure : 0.5]);
        }
        redraw((n) => n + 1);
        break;
      }
      case 'erase': eraseAt(gs, p); break;
      case 'connect': {
        const { end, anchor } = endAt(p);
        gs.to = end;
        const both = isAttached(gs.from) && isAttached(end);
        setPreview(makeConnector(gs.from, end, { route: both ? 'elbow' : 'straight' }));
        patchUi({ anchors: anchor ? { id: anchor.id, side: anchor.side } : null });
        break;
      }
    }
  };

  const onPointerUp = () => {
    const gs = g.current;
    if (!gs) return;
    g.current = null;
    if (gs.k === 'move' && !gs.began && gs.click) f.select([gs.click]);
    if (gs.k === 'draw') {
      const st = live.current;
      live.current = null;
      if (st && st.points.length > 1) {
        const done: StrokeItem = { ...st, id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ...strokeFrame(st.points, st.tool, st.width) };
        f.commit((all) => [...all, done], []);
      }
      redraw((n) => n + 1);
    }
    if (gs.k === 'connect') {
      const far = dist(toScreen(camera, endXY(gs.from)), toScreen(camera, endXY(gs.to))) > 12;
      setPreview(null);
      if (far || (isAttached(gs.from) && isAttached(gs.to) && gs.from.id !== gs.to.id)) {
        const both = isAttached(gs.from) && isAttached(gs.to);
        const c = makeConnector(gs.from, gs.to, { route: both ? 'elbow' : 'straight' });
        f.commit((all) => [...all, c], [c.id]);
        setTool('select');
      }
    }
    setUi((u) => ({ ...u, marquee: null, guides: [], anchors: null }));
  };

  const endXY = (end: ConnectorEnd): Pt => {
    if ('x' in end) return end;
    const it = byId.get(end.id);
    if (it && isBox(it)) return { x: it.x + it.w / 2, y: it.y + it.h / 2 };
    return { x: 0, y: 0 };
  };

  const onDoubleClick = (_: unknown, { board }: CanvasPointerInfo) => {
    if (tool !== 'select') return;
    const it = hitAt(board);
    if (it && !it.locked && (it.kind === 'sticky' || it.kind === 'shape' || it.kind === 'text')) {
      f.select([it.id]);
      f.begin();
      setEditing(it.id);
    }
  };

  /* ── Keys (Space and the zoom keys are the canvas's) ── */
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const ids = selection;
    const nudge = (dx: number, dy: number) => {
      const set = new Set(ids);
      f.commit((all) => all.map((i) => (set.has(i.id) && !i.locked ? moveItem(i, dx, dy) : i)));
    };
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) f.redo(); else f.undo(); return; }
    if (mod && key === 'a') { e.preventDefault(); f.selectAll(); return; }
    if (mod && key === 'c') { e.preventDefault(); f.copy(ids); return; }
    if (mod && key === 'x') { e.preventDefault(); f.cut(ids); return; }
    if (mod && key === 'v') { e.preventDefault(); f.paste(); return; }
    if (mod && key === 'd') { e.preventDefault(); f.duplicate(ids); return; }
    if (mod && key === 'g') { e.preventDefault(); if (e.shiftKey) f.ungroup(ids); else if (ids.length > 1) f.group(ids); return; }
    if (mod) return;
    if (key === 'delete' || key === 'backspace') { e.preventDefault(); f.remove(ids); return; }
    if (key === 'escape') { if (ids.length) f.select([]); else setTool('select'); return; }
    if (key === 'enter' && ids.length === 1) {
      const it = byId.get(ids[0]);
      if (it && !it.locked && (it.kind === 'sticky' || it.kind === 'shape' || it.kind === 'text')) { e.preventDefault(); f.begin(); setEditing(it.id); }
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    if (key === 'arrowleft') { e.preventDefault(); nudge(-step, 0); } else if (key === 'arrowright') { e.preventDefault(); nudge(step, 0); }
    else if (key === 'arrowup') { e.preventDefault(); nudge(0, -step); } else if (key === 'arrowdown') { e.preventDefault(); nudge(0, step); }
    else if (key === 'v') setTool('select');
    else if (key === 'h') setTool('hand');
    else if (key === 'p') setTool('draw');
    else if (key === 'c') setTool('connector');
  };

  const fit = useMemo(() => unionRect(items.map((i) => boundsOf(i, byId))), [items, byId]);

  return (
    <Canvas
      camera={camera}
      onCameraChange={onCameraChange}
      background={board?.background ?? 'dots'}
      panning={tool === 'hand'}
      fit={fit}
      cursor={ui.cursor}
      autoFocus
      aria-label={board ? `${board.title} board` : 'Board'}
      onCanvasPointerDown={onPointerDown}
      onCanvasPointerMove={onPointerMove}
      onCanvasPointerUp={onPointerUp}
      onCanvasDoubleClick={onDoubleClick}
      onNavigationStart={() => { g.current = null; live.current = null; }}
      onCanvasKeyDown={onKeyDown}
      overlay={!items.length && !live.current ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center text-tertiary-foreground">
          <div>
            <div className="text-body font-semibold">A blank board</div>
            <div className="mt-1 text-footnote">Add a sticky, a shape or a drawing from the toolbar below.</div>
          </div>
        </div>
      ) : null}
    >
      {items.map((it) => <ItemView key={it.id} item={it} byId={byId} editing={editing === it.id} onText={setText} onGrow={grow} />)}
      {live.current ? (
        <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
          <StrokePath st={{ tool: live.current.tool, color: live.current.color, w: live.current.width, pen: live.current.pen, points: live.current.points, done: false }} />
        </svg>
      ) : null}
      {preview ? <Connector item={preview} byId={byId} preview /> : null}

      {/* Selection */}
      {selected.map((it) => (it.kind === 'connector'
        ? <ConnectorHighlight key={it.id} item={it} byId={byId} z={z} />
        : <CanvasFrame key={it.id} frame={it} dashed={it.locked} />))}
      {selected.length > 1 && sel.frame ? <CanvasFrame frame={sel.frame} offset={6} /> : null}
      <CanvasHandles handles={sel.handles} />
      {ui.anchors ? <Anchors id={ui.anchors.id} side={ui.anchors.side} byId={byId} z={z} /> : null}
      <CanvasGuides guides={ui.guides} />
      {ui.marquee ? <CanvasMarquee rect={ui.marquee} /> : null}
    </Canvas>
  );
}

function ConnectorHighlight({ item, byId, z }: { item: ConnectorItem; byId: Map<string, Item>; z: number }) {
  return (
    <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
      <ConnectorPath item={item} byId={byId} width={item.width + 10 / z} />
    </svg>
  );
}

function ConnectorPath({ item, byId, width }: { item: ConnectorItem; byId: Map<string, Item>; width: number }) {
  return <path d={connectorGeometry(item, byId).d} fill="none" stroke="var(--primary)" strokeOpacity=".28" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;
}

/** The four connection points of an item, with the nearest enlarged. */
function Anchors({ id, side, byId, z }: { id: string; side: string; byId: Map<string, Item>; z: number }) {
  const it = byId.get(id);
  if (!it || !isBox(it)) return null;
  const pts = (['t', 'r', 'b', 'l'] as const).map((s) => ({ s, p: anchorPoint(it, s) }));
  return (
    <>
      {pts.map(({ s, p }) => {
        const d = (s === side ? 15 : 10) / z;
        return <span key={s} aria-hidden="true" className="pointer-events-none absolute rounded-full bg-primary" style={{ left: p.x - d / 2, top: p.y - d / 2, width: d, height: d, boxShadow: `0 0 0 ${2 / z}px var(--background)` }} />;
      })}
    </>
  );
}

