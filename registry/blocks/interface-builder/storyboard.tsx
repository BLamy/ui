/* The storyboard: every scene at its device's size on the core Canvas, with Xcode's scene dock above each, segue
   arrows between them and the entry arrow into the first. The canvas owns pan and zoom; this owns every other
   pointer and key as one state machine (`Gesture`). Scenes, docks and arrows are hit by geometry; nodes by the
   browser's own hit-testing (pick.ts), so what you click is what's drawn there — inside a scene shown in place in
   another (a tab, a stack's root, a split view's column) too, where it's edited in place.
   - Click (or ⌘-click, the design tools' deep select) selects the node drawn under the pointer; drag it to move it
     between stacks and scenes. ⇧-click (or ⇧⌘-click) adds it to the selection or takes it out.
   - Right-click (or ⌃-click) lists everything under the pointer, from what's on top out to the scene, to pick from.
   - Esc selects what the selection is drawn in (across an embedded scene: the tab or stack showing it), Return what's
     drawn in it, Tab the next sibling.
   - Double-click a text to edit it where it's drawn, as itself; Return or Esc finishes.
   - Drag the round handle on a selection (or ⌃-drag a node) to another scene for a segue, or from a container to
     embed the scene; drag a dock to move its scene; drag the entry arrow. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, CanvasFrame, CanvasGuides, useCanvas, type CanvasPointerInfo } from '@/components/ui/canvas';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSection, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import { snapMove, toBoard, type Camera, type Guide, type Pt, type Rect } from '@/lib/canvas-math';
import { Icon } from '@/lib/icon';
import type { Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { nodeLabel, specOf } from './catalog';
import { libraryDrag, useLibraryDrag, type LibraryDrag } from './dnd';
import {
  contains, distToSegue, measure, nodeIndex, rectAt, rectIn, sameMeasure, sceneAt, sceneRect, segueGeometry, union, EMPTY_MEASURE,
  type At, type DropTarget, type Measured, type SegueGeometry,
} from './geometry';
import { DEVICES, newId, type Doc, type Node, type Scene, type Segue, type SegueKind } from './model';
import { connect, removeSegue } from './ops';
import { DOCK_COLORS, SEGUE_INK } from './palette';
import { dropAt, elementAt, firstChildAt, parentAt, stackAt } from './pick';
import { navigationOf } from './hosts';
import { designEnv, PreviewContext, SceneView } from './render';
import { useBuilder, type Selection } from './store';
import { findNode, mapNode, pathTo, placeOf, segueSource, walk as walkTree } from './tree';

/** The dock above a scene, in screen px. */
const DOCK_H = 26;
const DOCK_GAP = 8;
const HANDLE_PX = 9;
/** How far (screen px) a press travels before it's a drag. */
const DRAG_SLOP = 4;

/** Containers whose handle embeds the scene it's dropped on (a tab, a stack's root, a column), even as a root. */
const EMBEDS = new Set(['TabView', 'NavigationStack', 'SplitView', 'SceneRef']);

export const SEGUE_GLYPH: Record<SegueKind, string> = {
  push: 'arrow-right',
  detail: 'rectangle-split',
  modal: 'arrow-up',
  fade: 'circle',
  magic: 'sparkle',
  replace: 'arrow-clockwise',
};

type Gesture =
  | { k: 'scene'; id: string; start: Pt; orig: Pt; began: boolean }
  /** A node being dragged. `then`: pressed inside the selection, so a click without a drag selects this. */
  | { k: 'node'; id: string; sstart: Pt; began: boolean; then: At | null }
  /** A segue (or an embed) being dragged out. A ⌃-click that never moves opens the menu instead (`menu`: the
      browser asked for one when the button went down). */
  | { k: 'connect'; scene: string; node: string | null; from: Pt; sstart: Pt; client: Pt; began: boolean; menu: boolean }
  | { k: 'entry'; began: boolean };

interface Ui {
  hover: At | null;
  hoverSegue: string | null;
  drop: DropTarget | null;
  /** A segue being dragged out: its end, and the scene under it. */
  wire: { from: Pt; to: Pt; target: string | null } | null;
  /** The entry arrow being dragged: the scene under it. */
  entryTo: { at: Pt; target: string | null } | null;
  guides: Guide[];
  cursor: string;
  /** The node being dragged, where the pointer is. */
  carry: { rect: Rect; label: string } | null;
}

const NO_UI: Ui = { hover: null, hoverSegue: null, drop: null, wire: null, entryTo: null, guides: [], cursor: 'default', carry: null };

const sameAt = (a: At | null, b: At | null) => a === b || (!!a && !!b && a.id === b.id && a.frame === b.frame && a.k === b.k);

/** What the menu lists: everything under the pointer in one scene's frame, the topmost first. */
interface LayerMenu {
  frame: string;
  stack: At[];
}

/** A text being edited where it's drawn: the element drawing it, and what it said. */
interface Editing {
  frame: string;
  node: string;
  prop: string;
  el: HTMLElement;
  original: string;
  multiline: boolean;
}

/** The innermost element under `root` that draws exactly `text` and nothing else (one text node), to edit in place. */
function textElementIn(root: HTMLElement | null, text: string): HTMLElement | null {
  if (!root) return null;
  let hit: HTMLElement | null = null;
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE && el.textContent === text) hit = el;
  }
  return hit;
}

export interface StoryboardProps {
  camera: Camera;
  onCameraChange: (c: Camera) => void;
  appearance: Appearance;
  /** Bump to play the selected scene's appear animations. */
  play: number;
  /** The timeline's playhead (ms), when scrubbing. */
  frameAt: number | null;
  /** The scene the timeline scrubs (others render at rest). */
  timelineScene: string | null;
}

export function Storyboard({ camera, onCameraChange, appearance, play, frameAt, timelineScene }: StoryboardProps) {
  const b = useBuilder();
  const { doc, selection } = b;
  const device = DEVICES[doc.device];
  const wrap = useRef<HTMLDivElement>(null);
  const g = useRef<Gesture | null>(null);
  const [ui, setUi] = useState<Ui>(NO_UI);
  const [m, setM] = useState<Measured>(EMPTY_MEASURE);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editRef = useRef<Editing | null>(null);
  /** Which instance of the selected node was picked: where its outline, name tag and handle go. */
  const [focus, setFocus] = useState<At | null>(null);
  const [menu, setMenu] = useState<LayerMenu | null>(null);
  const drag = useLibraryDrag();
  const z = camera.z;
  const index = nodeIndex(doc);
  const patchUi = (p: Partial<Ui>) => setUi((u) => ({ ...u, ...p }));

  /* ── Measuring the rendered nodes (board units survive camera moves; re-measured when content changes) ── */
  const cam = useRef(camera);
  cam.current = camera;
  const remeasure = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const next = measure(el, cam.current);
    setM((prev) => (sameMeasure(prev, next) ? prev : next));
  }, []);
  const dragging = !!drag || ui.carry != null;
  useLayoutEffect(remeasure, [doc, appearance, frameAt, dragging, remeasure]);
  // While appear animations play, keep the outlines on the moving nodes.
  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const until = performance.now() + 2600;
    const tick = () => { remeasure(); if (performance.now() < until) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play, remeasure]);
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => remeasure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [remeasure]);

  /* ── What's where ── */
  const segueGeo = useMemo(() => {
    const out = new Map<string, SegueGeometry>();
    for (const sg of doc.segues) {
      const from = doc.scenes.find((s) => s.id === sg.from), to = doc.scenes.find((s) => s.id === sg.to);
      if (!from || !to) continue;
      const src = segueSource(from, sg.id);
      const srcRect = src ? rectIn(m, src.id, from.id) ?? null : null;
      out.set(sg.id, segueGeometry(sceneRect(from, device), sceneRect(to, device), srcRect, 10));
    }
    return out;
  }, [doc, m, device]);

  /** Relationships: an embedded scene (a TabView's tab, a NavigationStack's root, a SplitView column) to its scene. */
  const relGeo = useMemo(() => {
    const out = new Map<string, { geo: SegueGeometry; scene: string; node: string }>();
    for (const s of doc.scenes) {
      walkTree(s.root, (n) => {
        if (n.type !== 'SceneRef' || !n.props.scene) return;
        const to = doc.scenes.find((x) => x.id === n.props.scene);
        const r = rectIn(m, n.id, s.id);
        if (!to || to.id === s.id) return;
        out.set(n.id, { geo: segueGeometry(sceneRect(s, device), sceneRect(to, device), r ?? null, 10), scene: s.id, node: n.id });
      });
    }
    return out;
  }, [doc, m, device]);

  const entryScene = doc.scenes.find((s) => s.id === doc.entry) ?? null;
  const dockRect = (s: Scene): Rect => ({ x: s.x, y: s.y - (DOCK_H + DOCK_GAP) / z, w: device.w, h: DOCK_H / z });
  /** The dock's three proxies (component, first responder, exit), right-aligned. */
  const dockIcons = (s: Scene) => {
    const r = dockRect(s);
    const step = 22 / z, size = 16 / z;
    return (['component', 'responder', 'exit'] as const).map((kind, i) => ({ kind, x: r.x + r.w - (3 - i) * step, y: r.y + (r.h - size) / 2, size }));
  };

  /* ── Selected instances ── */
  const isRoot = (id: string) => doc.scenes.find((s) => s.id === index.get(id)?.scene)?.root.id === id;
  /** A node's instance: the one picked, else its first in `frame` (or in its own scene's frame), else any. */
  const instanceOf = (id: string, frame?: string): At | null => {
    if (focus?.id === id && (!frame || focus.frame === frame) && rectAt(m, focus)) return focus;
    const own = index.get(id)?.scene;
    const hit = m.hits.find((h) => h.id === id && h.frame === (frame ?? own)) ?? m.hits.find((h) => h.id === id && h.frame === own) ?? m.hits.find((h) => h.id === id && h.frame);
    return hit ? { id, frame: hit.frame!, k: hit.k } : null;
  };
  const rectOf = (id: string): Rect | undefined => {
    const at = instanceOf(id);
    return at ? rectAt(m, at) : undefined;
  };
  /** Select an instance (with `add`, add its node to the selection or take it out). */
  const pick = (at: At, add = false) => {
    b.selectNode(at.id, add);
    setFocus(at);
  };
  /** Select a node, keeping to the frame the selection was picked in when it's drawn there. */
  const pickNear = (id: string) => {
    const at = instanceOf(id, focus?.frame);
    if (at) pick(at);
    else b.selectNode(id);
  };

  /** Where the selection's connection handle is (screen-constant, off its right edge). */
  const handleAt = (): { pt: Pt; scene: string; node: string | null } | null => {
    if (selection.kind === 'node' && selection.ids.length === 1) {
      const id = selection.ids[0];
      const e = index.get(id);
      const r = rectOf(id);
      if (!e || !r || (isRoot(id) && !EMBEDS.has(e.node.type))) return null;
      return { pt: { x: r.x + r.w + 12 / z, y: r.y + r.h / 2 }, scene: e.scene, node: id };
    }
    if (selection.kind === 'scene') {
      const s = doc.scenes.find((x) => x.id === selection.scene);
      if (!s) return null;
      const r = dockRect(s);
      return { pt: { x: r.x + r.w + 14 / z, y: r.y + r.h / 2 }, scene: s.id, node: null };
    }
    return null;
  };

  const entryPath = (s: Scene) => ({ from: { x: s.x - 150, y: s.y + device.h / 2 }, to: { x: s.x - 14, y: s.y + device.h / 2 } });

  /** Every node under a client point in a frame, the one drawn on top first (whichever scene it belongs to), out to
      the frame's root (even from its bar or status bar, which no node draws). */
  const stackUnder = (frame: Scene, client: Pt): At[] => {
    const stack = wrap.current ? stackAt(wrap.current, frame.id, client.x, client.y) : [];
    if (stack[stack.length - 1]?.id !== frame.root.id) stack.push({ id: frame.root.id, frame: frame.id, k: 0 });
    return stack;
  };

  /* ── Pointer ── */
  const onPointerDown = (e: ReactPointerEvent, { board: p, screen: sp }: CanvasPointerInfo) => {
    finishEdit();
    const near = (q: Pt, px: number) => Math.hypot((q.x - p.x) * z, (q.y - p.y) * z) <= px;

    // The connection handle.
    const h = handleAt();
    if (h && near(h.pt, HANDLE_PX + 4)) {
      g.current = { k: 'connect', scene: h.scene, node: h.node, from: h.pt, sstart: sp, client: { x: e.clientX, y: e.clientY }, began: true, menu: false };
      patchUi({ wire: { from: h.pt, to: p, target: null } });
      return;
    }
    // Segue badges, then relationship badges (they select the embedded scene's node).
    for (const [id, geo] of segueGeo) if (near(geo.mid, 13)) { b.select({ kind: 'segue', segue: id }); return; }
    for (const [, rel] of relGeo) if (near(rel.geo.mid, 13)) { b.selectNode(rel.node); setFocus(null); return; }
    // Docks: the proxies, else the scene (drag to move it).
    for (let i = doc.scenes.length - 1; i >= 0; i--) {
      const s = doc.scenes[i];
      if (!contains(dockRect(s), p)) continue;
      const icon = dockIcons(s).find((d) => contains({ x: d.x, y: d.y, w: d.size, h: d.size }, p));
      if (icon) {
        b.select(icon.kind === 'component' ? { kind: 'scene', scene: s.id } : icon.kind === 'responder' ? { kind: 'responder', scene: s.id } : { kind: 'exit', scene: s.id });
        return;
      }
      b.select({ kind: 'scene', scene: s.id });
      g.current = { k: 'scene', id: s.id, start: p, orig: { x: s.x, y: s.y }, began: false };
      return;
    }
    // The entry arrow.
    if (entryScene) {
      const ep = entryPath(entryScene);
      if (p.x >= ep.from.x - 8 / z && p.x <= ep.to.x + 4 / z && Math.abs(p.y - ep.from.y) <= 12 / z) {
        b.select({ kind: 'entry' });
        g.current = { k: 'entry', began: false };
        return;
      }
    }
    // Scenes: the node drawn under the pointer.
    const frame = sceneAt(doc, device, p);
    if (frame) {
      const stack = stackUnder(frame, { x: e.clientX, y: e.clientY });
      const at = stack[0];
      const e2 = index.get(at.id);
      const root = isRoot(at.id);
      if (e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Interface Builder's ⌃-drag: a segue from the node (from a scene's root, the scene's own), or an embed from
        // a container.
        const r = rectAt(m, at);
        pick(at);
        g.current = {
          k: 'connect', scene: e2?.scene ?? frame.id, node: root && !EMBEDS.has(e2?.node.type ?? '') ? null : at.id,
          from: r ? { x: r.x + r.w, y: r.y + r.h / 2 } : p, sstart: sp, client: { x: e.clientX, y: e.clientY }, began: false, menu: false,
        };
        return;
      }
      if (e.shiftKey) { pick(at, true); return; }
      // Pressing inside the selection drags the selection, and a click without a drag selects what's under the
      // pointer, as in a design tool; ⌘ goes straight to what's under the pointer, drag and all.
      const held = !e.metaKey && selection.kind === 'node' ? stack.find((s) => selection.ids.includes(s.id) && !isRoot(s.id)) : undefined;
      if (held && held.id !== at.id) {
        setFocus(held);
        g.current = { k: 'node', id: held.id, sstart: sp, began: false, then: at };
        return;
      }
      pick(at);
      if (!root) g.current = { k: 'node', id: at.id, sstart: sp, began: false, then: null };
      return;
    }
    // Segue lines.
    for (const [id, geo] of segueGeo) if (distToSegue(geo, p) * z <= 6) { b.select({ kind: 'segue', segue: id }); return; }
    b.select({ kind: 'none' });
  };

  // Hover asks the browser what's under the pointer at most once a frame.
  const hoverAt = useRef<{ client: Pt; p: Pt } | null>(null);
  const hoverRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(hoverRaf.current), []);
  const hover = () => {
    hoverRaf.current = 0;
    const at = hoverAt.current;
    if (!at || g.current || editRef.current) return;
    const { client, p } = at;
    const frame = sceneAt(doc, device, p);
    const hit = frame && wrap.current ? stackAt(wrap.current, frame.id, client.x, client.y)[0] ?? null : null;
    let seg: string | null = null;
    if (!hit) for (const [id, geo] of segueGeo) if (Math.hypot((geo.mid.x - p.x) * z, (geo.mid.y - p.y) * z) <= 13 || distToSegue(geo, p) * z <= 6) { seg = id; break; }
    const h = handleAt();
    const overHandle = h && Math.hypot((h.pt.x - p.x) * z, (h.pt.y - p.y) * z) <= HANDLE_PX + 4;
    const overDock = doc.scenes.some((s) => contains(dockRect(s), p));
    const cursor = overHandle ? 'crosshair' : overDock ? 'grab' : seg ? 'pointer' : 'default';
    setUi((u) => (sameAt(u.hover, hit) && u.hoverSegue === seg && u.cursor === cursor ? u : { ...u, hover: hit, hoverSegue: seg, cursor }));
  };

  const onPointerMove = (e: ReactPointerEvent, { board: p, screen: sp }: CanvasPointerInfo) => {
    const gs = g.current;
    if (!gs) {
      hoverAt.current = { client: { x: e.clientX, y: e.clientY }, p };
      if (!hoverRaf.current) hoverRaf.current = requestAnimationFrame(hover);
      return;
    }
    switch (gs.k) {
      case 'scene': {
        if (!gs.began) {
          if (Math.hypot(p.x - gs.start.x, p.y - gs.start.y) * z < 3) return;
          gs.began = true;
          b.begin();
        }
        let x = gs.orig.x + p.x - gs.start.x, y = gs.orig.y + p.y - gs.start.y;
        let guides: Guide[] = [];
        if (!e.metaKey) {
          const others = doc.scenes.filter((s) => s.id !== gs.id).map((s) => sceneRect(s, device));
          const snap = snapMove({ x, y, w: device.w, h: device.h }, others, 8 / z);
          x += snap.dx; y += snap.dy; guides = snap.guides;
        }
        const id = gs.id;
        b.patch((d) => ({ ...d, scenes: d.scenes.map((s) => (s.id === id ? { ...s, x: Math.round(x), y: Math.round(y) } : s)) }));
        patchUi({ guides, cursor: 'grabbing' });
        break;
      }
      case 'node': {
        if (!gs.began) {
          if (Math.hypot(sp.x - gs.sstart.x, sp.y - gs.sstart.y) < DRAG_SLOP) return;
          gs.began = true;
        }
        const frame = sceneAt(doc, device, p);
        const drop = frame && wrap.current ? dropAt(doc, wrap.current, frame.id, { x: e.clientX, y: e.clientY }, cam.current, m, gs.id) : null;
        const r = rectOf(gs.id);
        const node = index.get(gs.id)?.node;
        patchUi({ drop, hover: null, cursor: drop ? 'grabbing' : 'no-drop', carry: r && node ? { rect: { x: p.x + 8 / z, y: p.y + 8 / z, w: Math.min(r.w, 220), h: Math.min(r.h, 80) }, label: nodeLabel(node, doc) } : null });
        break;
      }
      case 'connect': {
        if (!gs.began) {
          if (Math.hypot(sp.x - gs.sstart.x, sp.y - gs.sstart.y) < DRAG_SLOP) return;
          gs.began = true;
        }
        const s = sceneAt(doc, device, p);
        patchUi({ hover: null, wire: { from: gs.from, to: p, target: s && s.id !== gs.scene ? s.id : null } });
        break;
      }
      case 'entry': {
        gs.began = true;
        const s = sceneAt(doc, device, p);
        patchUi({ entryTo: { at: p, target: s?.id ?? null } });
        break;
      }
    }
  };

  const onPointerUp = () => {
    const gs = g.current;
    g.current = null;
    if (gs?.k === 'node' && gs.began && ui.drop) b.move(gs.id, ui.drop.place);
    if (gs?.k === 'node' && !gs.began && gs.then) pick(gs.then);
    if (gs?.k === 'connect' && !gs.began && gs.menu) openMenu(gs.client);
    if (gs?.k === 'connect' && gs.began && ui.wire?.target) {
      const fromScene = doc.scenes.find((s) => s.id === gs.scene);
      const src = gs.node && fromScene ? findNode(fromScene.root, gs.node) : null;
      const target = ui.wire.target;
      const embedded = src && fromScene ? embedInto(doc, fromScene.id, src, target) : null;
      if (embedded) b.commit(() => embedded.doc, { kind: 'node', scene: fromScene!.id, ids: [embedded.node] });
      else {
        const event = src ? specOf(src.type).events[0]?.name ?? 'onTap' : null;
        const [next, segue] = connect(doc, gs.scene, target, gs.node, event);
        b.commit(() => next, { kind: 'segue', segue: segue.id });
      }
    }
    if (gs?.k === 'entry' && ui.entryTo?.target && ui.entryTo.target !== doc.entry) {
      const target = ui.entryTo.target;
      b.commit((d) => ({ ...d, entry: target }), { kind: 'entry' });
    }
    setUi((u) => ({ ...u, drop: null, wire: null, entryTo: null, guides: [], carry: null, cursor: 'default' }));
  };

  const onNavigationStart = () => { g.current = null; setUi((u) => ({ ...u, drop: null, wire: null, entryTo: null, guides: [], carry: null })); };

  /* ── The menu of what's under the pointer ── */
  const lastPointer = useRef<Pt>({ x: 0, y: 0 });
  const boardAt = (client: Pt): Pt | null => {
    const r = wrap.current?.getBoundingClientRect();
    return r ? toBoard(cam.current, client.x - r.left, client.y - r.top) : null;
  };
  const layersAt = (client: Pt): LayerMenu | null => {
    const p = boardAt(client);
    const frame = p ? sceneAt(doc, device, p) : null;
    return frame ? { frame: frame.id, stack: stackUnder(frame, client) } : null;
  };
  const onContextMenu = (e: ReactMouseEvent) => {
    lastPointer.current = { x: e.clientX, y: e.clientY };
    const gs = g.current;
    // A ⌃-press: the browser's menu comes with the button going down, but it may become a ⌃-drag. Its own menu
    // waits for the button to come up without a drag.
    if (gs?.k === 'connect') { e.preventDefault(); gs.menu = true; return; }
    if ((e.target as Element).closest?.('input, textarea')) { e.preventDefault(); return; }
    const layers = layersAt(lastPointer.current);
    if (!layers) { e.preventDefault(); return; }
    // Like a design tool's: a right-click selects what's under it, unless it's already selected.
    const top = layers.stack[0];
    if (!(selection.kind === 'node' && selection.ids.includes(top.id))) pick(top);
  };
  const onMenuOpenChange = (open: boolean) => {
    if (open) setMenu(layersAt(lastPointer.current));
    // Keys go back to the canvas.
    else requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('[data-slot=canvas]')?.focus({ preventScroll: true }));
  };
  const openMenu = (client: Pt) => {
    wrap.current?.querySelector('[data-slot=canvas]')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: client.x, clientY: client.y }));
  };

  /* ── Double-click: edit a text where it is, as itself (the element it's drawn in becomes editable) ── */
  const onDoubleClick = (e: ReactMouseEvent, { board: p }: CanvasPointerInfo) => {
    const frame = sceneAt(doc, device, p);
    const root = wrap.current;
    if (!frame || !root) return;
    const at = stackUnder(frame, { x: e.clientX, y: e.clientY })[0];
    const node = index.get(at.id)?.node;
    if (!node) return;
    if (node.type === 'SceneRef' && node.props.scene) { b.select({ kind: 'scene', scene: String(node.props.scene) }); return; }
    const spec = specOf(node.type);
    const ps = (['children', 'label', 'title'] as const).map((k) => spec.props.find((x) => x.name === k && x.control.kind === 'text')).find(Boolean);
    const value = ps ? node.props[ps.name] ?? ps.default : null;
    if (!ps || node.bind?.[ps.name] || typeof value !== 'string' || !value) return;
    // The element drawing the text: inside the node, or (a Screen's title) in its frame's bar.
    const box = elementAt(root, at);
    const el = (box && textElementIn(box, value)) ?? (at.id === frame.root.id ? textElementIn(root.querySelector<HTMLElement>(`[data-ib-scene-frame="${CSS.escape(frame.id)}"] [data-ib-content]`), value) : null);
    if (!el) return;
    pick(at);
    const ed: Editing = { frame: frame.id, node: node.id, prop: ps.name, el, original: value, multiline: ps.control.kind === 'text' && !!ps.control.multiline };
    editRef.current = ed;
    setEditing(ed);
  };
  /** End editing: keep the text, and hand the element back to React as it rendered it. From the keyboard, the keys
      go back to the canvas (⌘Z takes the edit back). */
  const finishEdit = (refocus = false) => {
    const ed = editRef.current;
    if (!ed) return;
    editRef.current = null;
    if (refocus) wrap.current?.querySelector<HTMLElement>('[data-slot=canvas]')?.focus({ preventScroll: true });
    const text = ed.multiline ? ed.el.innerText.replace(/\n$/, '') : (ed.el.textContent ?? '').replace(/\s*\n\s*/g, ' ');
    ed.el.textContent = ed.original;
    setEditing(null);
    if (text !== ed.original) b.updateNode(ed.node, (n) => ({ ...n, props: { ...n.props, [ed.prop]: text } }));
  };
  // The element takes the keys and the pointer while it's edited (the canvas would pan on Space, or end the edit on
  // a click that only moves the caret). Return, Esc, Tab or a click elsewhere finishes, as in a design tool (⌘Z
  // takes it back); ⇧Return starts a new line in a multi-line text.
  useLayoutEffect(() => {
    if (!editing) return;
    const { el, multiline } = editing;
    const attrs = { style: el.getAttribute('style'), spellcheck: el.getAttribute('spellcheck') };
    el.contentEditable = 'plaintext-only';
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.spellcheck = false;
    Object.assign(el.style, { pointerEvents: 'auto', userSelect: 'text', webkitUserSelect: 'text', cursor: 'text', outline: 'none', caretColor: 'var(--primary)' });
    const stop = (e: Event) => e.stopPropagation();
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape' || e.key === 'Tab' || (e.key === 'Enter' && !(multiline && e.shiftKey))) { e.preventDefault(); finishEdit(true); }
    };
    const onBlur = () => finishEdit();
    const events = ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'keyup'] as const;
    events.forEach((t) => el.addEventListener(t, stop));
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    return () => {
      events.forEach((t) => el.removeEventListener(t, stop));
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('blur', onBlur);
      el.removeAttribute('contenteditable');
      for (const [k, v] of Object.entries(attrs)) { if (v == null) el.removeAttribute(k); else el.setAttribute(k, v); }
    };
    // finishEdit reads the latest edit from its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /* ── Library drops ── */
  const libraryTarget = useCallback((d: { x: number; y: number }, docNow: Doc, camNow: Camera): DropTarget | null => {
    const el = wrap.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (d.x < r.left || d.x > r.right || d.y < r.top || d.y > r.bottom) return null;
    const frame = sceneAt(docNow, DEVICES[docNow.device], toBoard(camNow, d.x - r.left, d.y - r.top));
    return frame ? dropAt(docNow, el, frame.id, d, camNow, m, null) : null;
  }, [m]);
  const dropFromLibrary = useCallback((d: LibraryDrag): boolean => {
    const target = libraryTarget(d, b.doc, cam.current);
    if (!target) return false;
    b.insert(d.item.make(), target.place);
    return true;
  }, [b, libraryTarget]);
  useEffect(() => {
    libraryDrag.setDropHandler(dropFromLibrary);
    return () => libraryDrag.setDropHandler(null);
  }, [dropFromLibrary]);
  const [libraryDrop, setLibraryDrop] = useState<DropTarget | null>(null);
  useLayoutEffect(() => {
    setLibraryDrop(drag ? libraryTarget(drag, doc, camera) : null);
  }, [drag, doc, camera, libraryTarget]);

  /* ── Keys ── */
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    const ids = selection.kind === 'node' ? selection.ids : [];
    const scene = b.scene;
    const el = wrap.current;
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) b.redo(); else b.undo(); return; }
    if (mod && key === 'c' && ids.length) { e.preventDefault(); b.copy(ids); return; }
    if (mod && key === 'x' && ids.length) { e.preventDefault(); b.copy(ids); b.remove(ids); return; }
    if (mod && key === 'v') { e.preventDefault(); b.paste(); return; }
    if (mod && key === 'd' && ids.length) { e.preventDefault(); b.duplicate(ids); return; }
    if (mod && (key === 'arrowup' || key === 'arrowdown') && ids.length === 1 && scene) {
      // Move the node up or down among its siblings.
      e.preventDefault();
      const at = placeOf(scene.root, ids[0]);
      if (at) b.move(ids[0], { ...at, index: Math.max(0, at.index + (key === 'arrowup' ? -1 : 1)) });
      return;
    }
    if (mod) return;
    if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      if (ids.length) b.remove(ids);
      else if (selection.kind === 'segue') { const id = selection.segue; b.commit((d) => removeSegue(d, id)); }
      return;
    }
    if (key === 'escape' || (key === 'enter' && e.shiftKey)) {
      // Out: what the node is drawn in (across an embedded scene, what shows it) → … → the scene → nothing.
      e.preventDefault();
      if (ids.length && scene) {
        const at = instanceOf(ids[0]);
        const up = el && at ? parentAt(el, at) : null;
        if (up) { pick(up); return; }
        const path = pathTo(scene.root, ids[0]);
        if (path.length > 1) pickNear(path[path.length - 2].id);
        else b.select({ kind: 'scene', scene: at?.frame ?? scene.id });
      } else if (key === 'escape') b.select({ kind: 'none' });
      return;
    }
    if (key === 'enter' && scene) {
      // In: what's drawn inside it (inside an embedded scene's SceneRef, that scene's root).
      e.preventDefault();
      if (selection.kind === 'scene') { pickNear(scene.root.id); return; }
      if (ids.length !== 1) return;
      const at = instanceOf(ids[0]);
      const down = el && at ? firstChildAt(el, at) : null;
      if (down) { pick(down); return; }
      const n = findNode(scene.root, ids[0]);
      const first = n?.children?.[0] ?? Object.values(n?.slots ?? {}).flat()[0];
      if (first) pickNear(first.id);
      return;
    }
    if (key === 'tab' && ids.length === 1 && scene) {
      e.preventDefault();
      const at = placeOf(scene.root, ids[0]);
      const parent = at ? findNode(scene.root, at.parent) : null;
      const list = parent ? (at!.slot ? parent.slots?.[at!.slot] : parent.children) ?? [] : [];
      if (list.length) pickNear(list[(at!.index + (e.shiftKey ? list.length - 1 : 1)) % list.length].id);
    }
  };

  const fit = useMemo(() => union(doc.scenes.map((s) => sceneRect(s, device))), [doc.scenes, device]);
  const drop = ui.drop ?? libraryDrop;
  const selectedIds = selection.kind === 'node' ? selection.ids : [];
  const primary = selectedIds.length === 1 ? instanceOf(selectedIds[0]) : null;
  const h = handleAt();
  const hoverRect = ui.hover && !g.current && !(primary && sameAt(primary, ui.hover)) ? rectAt(m, ui.hover) : undefined;

  return (
    <div ref={wrap} data-slot="ib-storyboard" className="absolute inset-0">
      <ContextMenu
        className="absolute inset-0"
        onContextMenu={onContextMenu}
        onPointerDown={(e) => { lastPointer.current = { x: e.clientX, y: e.clientY }; }}
        onOpenChange={onMenuOpenChange}
      >
        <Canvas
          camera={camera}
          onCameraChange={onCameraChange}
          background="dots"
          fit={fit}
          cursor={ui.cursor}
          aria-label="Storyboard"
          className="bg-muted"
          onCanvasPointerDown={onPointerDown}
          onCanvasPointerMove={onPointerMove}
          onCanvasPointerUp={onPointerUp}
          onCanvasDoubleClick={onDoubleClick}
          onNavigationStart={onNavigationStart}
          onCanvasKeyDown={onKeyDown}
        >
          <PreviewContext.Provider value={b.preview}>
          <RelationLayer rels={[...relGeo.values()]} selected={selectedIds} />
          <SegueLayer doc={doc} geo={segueGeo} selected={selection.kind === 'segue' ? selection.segue : null} hovered={ui.hoverSegue} />
          {entryScene ? <EntryArrow path={entryPath(entryScene)} selected={selection.kind === 'entry'} /> : null}
          {doc.scenes.map((s) => (
            <SceneFrame
              key={s.id}
              scene={s}
              doc={doc}
              appearance={appearance}
              selection={selection}
              picked={primary?.frame === s.id}
              play={timelineScene === s.id || (b.scene?.id === s.id) ? play : 0}
              frameAt={timelineScene === s.id ? frameAt : null}
              dragging={dragging}
              editing={editing?.frame === s.id}
              isEntry={doc.entry === s.id}
            />
          ))}
          </PreviewContext.Provider>

          {/* Hover and selection: every place a selected node is drawn, the picked one solid. */}
          {hoverRect ? <HoverFrame rect={hoverRect} /> : null}
          {selectedIds.map((id) => {
            const main = rectOf(id);
            return (m.nodes.get(id) ?? []).map((r, i) => <CanvasFrame key={`${id}-${i}`} frame={{ ...r, rot: 0 }} offset={1} dashed={r !== main} />);
          })}
          {primary ? <NameTag doc={doc} at={primary} rect={rectAt(m, primary)} /> : null}
          {selection.kind === 'scene' || selection.kind === 'responder' || selection.kind === 'exit' ? (
            <SceneOutline rect={sceneRectOf(doc, selection.scene)} />
          ) : null}
          {h && !g.current ? <ConnectHandle at={h.pt} /> : null}

          {/* Gestures */}
          {drop ? <DropIndicator drop={drop} /> : null}
          {ui.wire ? <Wire from={ui.wire.from} to={ui.wire.to} target={ui.wire.target ? sceneRectOf(doc, ui.wire.target) : null} /> : null}
          {ui.entryTo ? <EntryDrag at={ui.entryTo.at} target={ui.entryTo.target ? sceneRectOf(doc, ui.entryTo.target) : null} /> : null}
          {ui.carry ? <Carry rect={ui.carry.rect} label={ui.carry.label} /> : null}
          <CanvasGuides guides={ui.guides} />
        </Canvas>
        <ContextMenuContent aria-label="Layers under the pointer" popoverClassName="max-w-[320px]">
          <ContextMenuSection title="Select">
            {(menu?.stack ?? []).map((at) => {
              const e = index.get(at.id);
              if (!e) return null;
              const spec = specOf(e.node.type);
              const owner = e.scene !== menu?.frame ? doc.scenes.find((s) => s.id === e.scene)?.name : null;
              return (
                <ContextMenuItem
                  key={`${at.id}:${at.k}`}
                  id={`${at.id}:${at.k}`}
                  textValue={nodeLabel(e.node, doc)}
                  description={owner ? `in ${owner}` : undefined}
                  icon={<Icon name={typeof spec.icon === 'string' ? spec.icon : undefined} shapes={typeof spec.icon === 'string' ? undefined : spec.icon} size={18} sw={1.8} />}
                  onAction={() => pick(at)}
                >
                  {nodeLabel(e.node, doc)}
                </ContextMenuItem>
              );
            })}
            {menu ? (
              <ContextMenuItem id="scene" textValue="Scene" icon={<span style={{ color: DOCK_COLORS.component }}><Icon name="circle-fill" size={16} /></span>} onAction={() => b.select({ kind: 'scene', scene: menu.frame })}>
                {`Scene “${doc.scenes.find((s) => s.id === menu.frame)?.name ?? ''}”`}
              </ContextMenuItem>
            ) : null}
          </ContextMenuSection>
          <ContextMenuSeparator />
          <ContextMenuSection>
            <ContextMenuItem id="copy" isDisabled={!selectedIds.length} onAction={() => b.copy(selectedIds)} shortcut={<ContextMenuShortcut>⌘C</ContextMenuShortcut>}>Copy</ContextMenuItem>
            <ContextMenuItem id="paste" isDisabled={!b.canPaste} onAction={() => b.paste()} shortcut={<ContextMenuShortcut>⌘V</ContextMenuShortcut>}>Paste</ContextMenuItem>
            <ContextMenuItem id="duplicate" isDisabled={!selectedIds.length} onAction={() => b.duplicate(selectedIds)} shortcut={<ContextMenuShortcut>⌘D</ContextMenuShortcut>}>Duplicate</ContextMenuItem>
            <ContextMenuItem id="delete" variant="destructive" isDisabled={!selectedIds.length || selectedIds.every(isRoot)} onAction={() => b.remove(selectedIds)} shortcut={<ContextMenuShortcut>⌫</ContextMenuShortcut>}>Delete</ContextMenuItem>
          </ContextMenuSection>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );

  function sceneRectOf(d: Doc, id: string): Rect | null {
    const s = d.scenes.find((x) => x.id === id);
    return s ? sceneRect(s, device) : null;
  }
}

/* ── A scene on the board ── */

function SceneFrame({ scene, doc, appearance, selection, picked, play, frameAt, dragging, editing, isEntry }: {
  scene: Scene; doc: Doc; appearance: Appearance; selection: Selection;
  /** The selection was picked in this frame (in a scene shown here in place). */
  picked: boolean;
  play: number; frameAt: number | null; dragging: boolean;
  /** A text in it is being edited where it is. */
  editing: boolean;
  isEntry: boolean;
}) {
  const { zoom: z } = useCanvas();
  const device = DEVICES[doc.device];
  const env = useMemo(() => designEnv({ doc, contexts: doc.contexts, play, frameAt, dragging }), [doc, play, frameAt, dragging]);
  const simulateNav = useMemo(() => navigationOf(doc, scene.id), [doc, scene.id]);
  const active = picked || ((selection.kind === 'scene' || selection.kind === 'node' || selection.kind === 'responder' || selection.kind === 'exit') && selection.scene === scene.id);
  const sel = selection.kind === 'responder' ? 'responder' : selection.kind === 'exit' ? 'exit' : selection.kind === 'scene' ? 'component' : null;
  return (
    // Its own stacking context: the z-indexes inside a scene (a status bar, a stack's screens) stay inside it, under the
    // selection, the name tag and the handles drawn over the board.
    <div data-ib-scene-frame={scene.id} className="absolute isolate" style={{ left: scene.x, top: scene.y, width: device.w, height: device.h }}>
      {/* The dock: the scene's name and its three proxies, at a constant size on screen. */}
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute left-0 flex items-center justify-between gap-2 rounded-md px-1.5', active ? 'text-foreground' : 'text-muted-foreground')}
        style={{ top: -(DOCK_H + DOCK_GAP) / z, width: device.w, height: DOCK_H / z, fontSize: 12 / z }}
      >
        <span className="flex min-w-0 items-center gap-[0.4em] truncate font-semibold">
          {isEntry ? <Icon name="arrow-right" size={13 / z} sw={2.4} /> : null}
          {scene.name}
        </span>
        <span className={cn('shrink-0 items-center', device.w * z < 150 ? 'hidden' : 'flex')} style={{ gap: 6 / z }}>
          {(['component', 'responder', 'exit'] as const).map((k) => (
            <span
              key={k}
              className={cn('grid place-items-center rounded-[30%] text-white', sel === k && 'ring-primary')}
              style={{ width: 16 / z, height: 16 / z, background: DOCK_COLORS[k], boxShadow: sel === k ? `0 0 0 ${2 / z}px var(--primary)` : undefined }}
            >
              <Icon name={k === 'component' ? 'circle-fill' : k === 'responder' ? 'bolt-fill' : 'arrow-uturn-backward'} size={10 / z} sw={2.6} />
            </span>
          ))}
        </span>
      </div>
      <SceneView
        scene={scene}
        device={device}
        env={env}
        simulateNav={simulateNav}
        editing={editing}
        appearance={appearance}
        className={cn('shadow-[0_18px_50px_black] shadow-black/18 ring-1 ring-border', active && 'ring-primary/40')}
      />
    </div>
  );
}

/* ── Arrows ── */

function SegueLayer({ doc, geo, selected, hovered }: { doc: Doc; geo: Map<string, SegueGeometry>; selected: string | null; hovered: string | null }) {
  const { zoom: z } = useCanvas();
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1">
      {doc.segues.map((s: Segue) => {
        const g = geo.get(s.id);
        if (!g) return null;
        const on = s.id === selected, hot = s.id === hovered;
        const ink = on ? 'var(--primary)' : SEGUE_INK;
        const head = 9 / z;
        const a = g.angle;
        const tip = `M ${g.end.x} ${g.end.y} L ${g.end.x - head * Math.cos(a - 0.45)} ${g.end.y - head * Math.sin(a - 0.45)} L ${g.end.x - head * Math.cos(a + 0.45)} ${g.end.y - head * Math.sin(a + 0.45)} Z`;
        return (
          <g key={s.id} data-ib-segue={s.id}>
            <path d={g.d} fill="none" stroke={ink} strokeOpacity={on || hot ? 1 : 0.85} strokeWidth={(on || hot ? 2.4 : 1.6) / z} strokeDasharray={s.kind === 'modal' ? `${6 / z} ${4 / z}` : undefined} />
            <circle cx={g.start.x} cy={g.start.y} r={3.5 / z} fill={ink} />
            <path d={tip} fill={ink} />
            <circle cx={g.mid.x} cy={g.mid.y} r={11 / z} fill="var(--background)" stroke={ink} strokeWidth={1.6 / z} />
            <foreignObject x={g.mid.x - 7 / z} y={g.mid.y - 7 / z} width={14 / z} height={14 / z} style={{ overflow: 'visible' }}>
              <div style={{ color: ink, width: 14 / z, height: 14 / z }}>
                <Icon name={SEGUE_GLYPH[s.kind]} size={14 / z} sw={2.3} />
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

function EntryArrow({ path, selected }: { path: { from: Pt; to: Pt }; selected: boolean }) {
  const { zoom: z } = useCanvas();
  const ink = selected ? 'var(--primary)' : SEGUE_INK;
  const w = 6 / z, head = 16 / z;
  const { from, to } = path;
  return (
    <svg aria-hidden="true" data-ib-entry className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1">
      <path d={`M ${from.x} ${from.y} L ${to.x - head} ${to.y}`} stroke={ink} strokeWidth={w} strokeLinecap="round" />
      <path d={`M ${to.x} ${to.y} L ${to.x - head} ${to.y - head * 0.62} L ${to.x - head} ${to.y + head * 0.62} Z`} fill={ink} />
    </svg>
  );
}

/** Relationship arrows (Xcode's): solid, from a container's embedded scene to the scene it shows. */
function RelationLayer({ rels, selected }: { rels: { geo: SegueGeometry; node: string }[]; selected: string[] }) {
  const { zoom: z } = useCanvas();
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1">
      {rels.map(({ geo: g, node }) => {
        const on = selected.includes(node);
        const ink = on ? 'var(--primary)' : SEGUE_INK;
        const head = 9 / z, a = g.angle;
        return (
          <g key={node}>
            <path d={g.d} fill="none" stroke={ink} strokeWidth={(on ? 2.6 : 2) / z} strokeOpacity={0.9} />
            <path d={`M ${g.end.x} ${g.end.y} L ${g.end.x - head * Math.cos(a - 0.45)} ${g.end.y - head * Math.sin(a - 0.45)} L ${g.end.x - head * Math.cos(a + 0.45)} ${g.end.y - head * Math.sin(a + 0.45)} Z`} fill={ink} />
            <rect x={g.mid.x - 10 / z} y={g.mid.y - 10 / z} width={20 / z} height={20 / z} rx={5 / z} fill="var(--background)" stroke={ink} strokeWidth={1.6 / z} />
            <foreignObject x={g.mid.x - 7 / z} y={g.mid.y - 7 / z} width={14 / z} height={14 / z} style={{ overflow: 'visible' }}>
              <div style={{ color: ink, width: 14 / z, height: 14 / z }}>
                <Icon name="square-on-square" size={14 / z} sw={2.2} />
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Dragging a container's handle to a scene embeds the scene (a relationship, not a segue): a TabView gets a tab, a
 * NavigationStack its root screen, a SplitView its next empty column; an embedded scene points at the new one.
 */
function embedInto(doc: Doc, sceneId: string, src: Node, target: string): { doc: Doc; node: string } | null {
  const dest = doc.scenes.find((s) => s.id === target);
  if (!dest) return null;
  const ref = (): Node => ({ id: newId(), type: 'SceneRef', props: { scene: target }, layout: { width: 'fill', height: 'fill' } });
  const edit = (fn: (n: Node) => Node, node: string) => ({ doc: { ...doc, scenes: doc.scenes.map((s) => (s.id === sceneId ? { ...s, root: mapNode(s.root, src.id, fn) } : s)) }, node });
  if (src.type === 'SceneRef') return edit((n) => ({ ...n, props: { ...n.props, scene: target } }), src.id);
  if (src.type === 'TabView') {
    const r = ref();
    const tabs = [String(src.props.tabs ?? '').trim(), `${dest.name}:circle`].filter(Boolean).join(', ');
    return edit((n) => ({ ...n, props: { ...n.props, tabs }, children: [...(n.children ?? []), r] }), r.id);
  }
  if (src.type === 'NavigationStack') {
    const r = ref();
    return edit((n) => ({ ...n, children: [r] }), r.id);
  }
  if (src.type === 'SplitView') {
    const r = ref();
    const slot = (['sidebar', 'supplementary', 'detail'] as const).find((k) => !(src.slots?.[k] ?? []).length) ?? 'detail';
    return edit((n) => ({ ...n, slots: { ...n.slots, [slot]: [r] } }), r.id);
  }
  return null;
}

/* ── Overlays (constant on screen) ── */

function HoverFrame({ rect }: { rect: Rect | undefined }) {
  const { zoom: z } = useCanvas();
  if (!rect) return null;
  return <span aria-hidden="true" className="pointer-events-none absolute rounded-[2px]" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, outline: `${1 / z}px solid var(--primary)`, outlineOffset: 0 }} />;
}

function SceneOutline({ rect }: { rect: Rect | null }) {
  if (!rect) return null;
  return <CanvasFrame frame={{ ...rect, rot: 0 }} offset={4} />;
}

/** The selected node's name and size, above it (Framer's layer tag); picked in a scene shown in place, the scene
    it belongs to first. */
function NameTag({ doc, at, rect }: { doc: Doc; at: At; rect: Rect | undefined }) {
  const { zoom: z } = useCanvas();
  const e = nodeIndex(doc).get(at.id);
  if (!rect || !e) return null;
  const owner = e.scene !== at.frame ? doc.scenes.find((s) => s.id === e.scene)?.name : null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex items-center gap-[0.5em] rounded-[0.35em] bg-primary px-[0.5em] font-medium whitespace-nowrap text-primary-foreground"
      style={{ left: rect.x, top: rect.y - 22 / z, height: 18 / z, fontSize: 11 / z }}
    >
      {owner ? <span className="opacity-75">{owner} ›</span> : null}
      <span>{nodeLabel(e.node, doc)}</span>
      <span className="opacity-70 tabular-nums">{Math.round(rect.w)} × {Math.round(rect.h)}</span>
      {e.node.ref ? <span className="opacity-90">@{e.node.ref}</span> : null}
    </div>
  );
}

/** Framer's prototype handle: drag it to another scene for a segue. */
function ConnectHandle({ at }: { at: Pt }) {
  const { zoom: z } = useCanvas();
  const d = (HANDLE_PX * 2) / z;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute grid place-items-center rounded-full bg-primary text-primary-foreground"
      style={{ left: at.x - d / 2, top: at.y - d / 2, width: d, height: d, boxShadow: `0 0 0 ${2 / z}px var(--background)` }}
    >
      <Icon name="plus" size={12 / z} sw={3} />
    </span>
  );
}

function DropIndicator({ drop }: { drop: DropTarget }) {
  const { zoom: z } = useCanvas();
  const { box, line } = drop;
  return (
    <>
      <span aria-hidden="true" className="pointer-events-none absolute rounded-[3px] bg-primary/8" style={{ left: box.x, top: box.y, width: box.w, height: box.h, outline: `${1.5 / z}px ${line ? 'dashed' : 'solid'} var(--primary)` }} />
      {line ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full bg-primary"
          style={line.h === 0
            ? { left: line.x, top: line.y - 1.5 / z, width: line.w, height: 3 / z }
            : { left: line.x - 1.5 / z, top: line.y, width: 3 / z, height: line.h }}
        />
      ) : null}
    </>
  );
}

function Wire({ from, to, target }: { from: Pt; to: Pt; target: Rect | null }) {
  const { zoom: z } = useCanvas();
  const k = Math.max(40, Math.abs(to.x - from.x) * 0.4);
  return (
    <>
      {target ? <CanvasFrame frame={{ ...target, rot: 0 }} offset={4} /> : null}
      <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1">
        <path d={`M ${from.x} ${from.y} C ${from.x + k} ${from.y}, ${to.x - k} ${to.y}, ${to.x} ${to.y}`} fill="none" stroke="var(--primary)" strokeWidth={2 / z} strokeDasharray={`${5 / z} ${4 / z}`} />
        <circle cx={to.x} cy={to.y} r={4 / z} fill="var(--primary)" />
      </svg>
    </>
  );
}

function EntryDrag({ at, target }: { at: Pt; target: Rect | null }) {
  const { zoom: z } = useCanvas();
  return (
    <>
      {target ? <CanvasFrame frame={{ ...target, rot: 0 }} offset={4} /> : null}
      <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1">
        <path d={`M ${at.x - 120} ${at.y} L ${at.x} ${at.y}`} stroke="var(--primary)" strokeWidth={6 / z} strokeLinecap="round" />
      </svg>
    </>
  );
}

function Carry({ rect, label }: { rect: Rect; label: string }) {
  const { zoom: z } = useCanvas();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute flex items-center rounded-md bg-primary px-[0.6em] font-medium whitespace-nowrap text-primary-foreground shadow-lg"
      style={{ left: rect.x, top: rect.y, height: 24 / z, fontSize: 12 / z }}
    >
      {label}
    </div>
  );
}
