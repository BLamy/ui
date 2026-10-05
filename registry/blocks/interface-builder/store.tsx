/* The builder's state: the document, its undo history, what's selected and the clipboard. One reducer, so every
   edit is a function of the document; a gesture calls `begin()` once for its undo step and then `patch()`es as it
   goes, so a drag is one undo step, not a hundred. */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { specOf } from './catalog';
import type { Doc, Node, Scene } from './model';
import * as ops from './ops';
import { cloneNode, findNode, placeOf, sceneOf, type Place } from './tree';

export type Selection =
  | { kind: 'none' }
  | { kind: 'scene'; scene: string }
  | { kind: 'node'; scene: string; ids: string[] }
  | { kind: 'segue'; segue: string }
  | { kind: 'context'; context: string }
  | { kind: 'entry' }
  /** A scene's First Responder proxy (its responder chain). */
  | { kind: 'responder'; scene: string }
  /** A scene's Exit proxy (unwinds). */
  | { kind: 'exit'; scene: string };

/** Props shown on the canvas for now without being in the document (a font hovered in the font list): a node's
    (`target` its id) or the document's own (`target` 'doc'). */
export interface Preview {
  target: string;
  props: Record<string, unknown>;
}

const NONE: Selection = { kind: 'none' };
const HISTORY = 120;

interface State {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  selection: Selection;
  clipboard: Node[];
  preview: Preview | null;
}

type Act =
  | { t: 'begin' }
  | { t: 'doc'; fn: (d: Doc) => Doc; checkpoint: boolean; select?: Selection }
  | { t: 'select'; selection: Selection }
  | { t: 'undo' }
  | { t: 'redo' }
  | { t: 'clipboard'; nodes: Node[] }
  | { t: 'preview'; preview: Preview | null }
  | { t: 'load'; doc: Doc };

/** The selection, minus whatever no longer exists. */
function valid(doc: Doc, s: Selection): Selection {
  switch (s.kind) {
    case 'scene': case 'responder': case 'exit': return doc.scenes.some((x) => x.id === s.scene) ? s : NONE;
    case 'node': {
      const scene = doc.scenes.find((x) => x.id === s.scene);
      const ids = scene ? s.ids.filter((id) => findNode(scene.root, id)) : [];
      return ids.length ? { ...s, ids } : scene ? { kind: 'scene', scene: scene.id } : NONE;
    }
    case 'segue': return doc.segues.some((g) => g.id === s.segue) ? s : NONE;
    case 'context': return doc.contexts.some((c) => c.id === s.context) ? s : NONE;
    default: return s;
  }
}

function reduce(s: State, a: Act): State {
  switch (a.t) {
    case 'begin': return { ...s, past: [...s.past, s.doc].slice(-HISTORY), future: [] };
    case 'doc': {
      const doc = a.fn(s.doc);
      if (doc === s.doc && !a.select) return s;
      const base = a.checkpoint && doc !== s.doc ? { ...s, past: [...s.past, s.doc].slice(-HISTORY), future: [] } : s;
      return { ...base, doc, selection: valid(doc, a.select ?? s.selection) };
    }
    case 'select': return { ...s, selection: valid(s.doc, a.selection) };
    case 'undo': {
      if (!s.past.length) return s;
      const doc = s.past[s.past.length - 1];
      return { ...s, doc, past: s.past.slice(0, -1), future: [s.doc, ...s.future], selection: valid(doc, s.selection) };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const doc = s.future[0];
      return { ...s, doc, past: [...s.past, s.doc], future: s.future.slice(1), selection: valid(doc, s.selection) };
    }
    case 'clipboard': return { ...s, clipboard: a.nodes };
    case 'preview': return s.preview === a.preview ? s : { ...s, preview: a.preview };
    case 'load': return { doc: a.doc, past: [...s.past, s.doc].slice(-HISTORY), future: [], selection: NONE, clipboard: s.clipboard, preview: null };
  }
}

export interface Builder {
  doc: Doc;
  selection: Selection;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  /** The scene the selection is in (or is). */
  scene: Scene | null;
  /** The selected nodes, in the selected scene. */
  nodes: Node[];
  /** What the canvas shows for now, outside the document and its undo history. */
  preview: Preview | null;
  setPreview: (p: Preview | null) => void;
  select: (s: Selection) => void;
  /** Select a node (with `add`, add it to the selection or take it out). */
  selectNode: (id: string, add?: boolean) => void;
  /** A checkpoint for undo: call once before a gesture's first change. */
  begin: () => void;
  /** Change the document without a checkpoint (during a gesture). */
  patch: (fn: (d: Doc) => Doc) => void;
  /** A checkpoint, then the change; optionally a new selection. */
  commit: (fn: (d: Doc) => Doc, select?: Selection) => void;
  updateNode: (id: string, fn: (n: Node) => Node, checkpoint?: boolean) => void;
  updateScene: (id: string, fn: (s: Scene) => Scene, checkpoint?: boolean) => void;
  insert: (node: Node, place: Place) => void;
  move: (id: string, place: Place) => void;
  remove: (ids: string[]) => void;
  duplicate: (ids: string[]) => void;
  copy: (ids: string[]) => void;
  paste: () => void;
  embed: (ids: string[], axis: 'vertical' | 'horizontal' | 'overlay') => void;
  load: (doc: Doc) => void;
  undo: () => void;
  redo: () => void;
}

const Ctx = createContext<Builder | null>(null);

export function useBuilder(): Builder {
  const b = useContext(Ctx);
  if (!b) throw new Error('useBuilder must be used inside <BuilderProvider>');
  return b;
}

export function BuilderProvider({ doc, selection = NONE, children }: { doc: Doc; selection?: Selection; children: ReactNode }) {
  const [s, dispatch] = useReducer(reduce, { doc, past: [], future: [], selection: valid(doc, selection), clipboard: [], preview: null });

  const api = useMemo<Builder>(() => {
    const sel = s.selection;
    const sceneId = sel.kind === 'scene' || sel.kind === 'node' || sel.kind === 'responder' || sel.kind === 'exit' ? sel.scene : null;
    const scene = s.doc.scenes.find((x) => x.id === sceneId) ?? null;
    const nodes = sel.kind === 'node' && scene ? sel.ids.map((id) => findNode(scene.root, id)).filter((n): n is Node => !!n) : [];
    const run = (fn: (d: Doc) => Doc, checkpoint: boolean, select?: Selection) => dispatch({ t: 'doc', fn, checkpoint, select });
    const nodeSel = (ids: string[], doc = s.doc): Selection => {
      const sc = ids.length ? sceneOf(doc, ids[0]) : null;
      return sc ? { kind: 'node', scene: sc.id, ids } : NONE;
    };

    return {
      doc: s.doc,
      selection: sel,
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
      canPaste: s.clipboard.length > 0,
      scene,
      nodes,
      preview: s.preview,
      setPreview: (preview) => dispatch({ t: 'preview', preview }),
      select: (x) => dispatch({ t: 'select', selection: x }),
      selectNode: (id, add) => {
        const sc = sceneOf(s.doc, id);
        if (!sc) return;
        if (add && sel.kind === 'node' && sel.scene === sc.id) {
          const ids = sel.ids.includes(id) ? sel.ids.filter((x) => x !== id) : [...sel.ids, id];
          dispatch({ t: 'select', selection: ids.length ? { kind: 'node', scene: sc.id, ids } : { kind: 'scene', scene: sc.id } });
        } else dispatch({ t: 'select', selection: { kind: 'node', scene: sc.id, ids: [id] } });
      },
      begin: () => dispatch({ t: 'begin' }),
      patch: (fn) => run(fn, false),
      commit: (fn, select) => run(fn, true, select),
      updateNode: (id, fn, checkpoint = true) => {
        const sc = sceneOf(s.doc, id);
        if (sc) run((d) => ops.mapNodeIn(d, sc.id, id, fn), checkpoint);
      },
      updateScene: (id, fn, checkpoint = true) => run((d) => ({ ...d, scenes: d.scenes.map((x) => (x.id === id ? fn(x) : x)) }), checkpoint),
      insert: (node, place) => {
        const sc = sceneOf(s.doc, place.parent);
        run((d) => ops.insertAt(d, place, node), true, sc ? { kind: 'node', scene: sc.id, ids: [node.id] } : undefined);
      },
      move: (id, place) => {
        const next = ops.moveTo(s.doc, id, place);
        run(() => next, true, nodeSel([id], next));
      },
      remove: (ids) => {
        const sc = ids.length ? sceneOf(s.doc, ids[0]) : null;
        run((d) => ops.removeNodes(d, ids), true, sc ? { kind: 'scene', scene: sc.id } : undefined);
      },
      duplicate: (ids) => {
        const [next, made] = ops.duplicateNodes(s.doc, ids);
        run(() => next, true, nodeSel(made, next));
      },
      copy: (ids) => {
        const sc = ids.length ? sceneOf(s.doc, ids[0]) : null;
        const list = sc ? ids.map((id) => findNode(sc.root, id)).filter((n): n is Node => !!n && n.id !== sc.root.id) : [];
        if (list.length) dispatch({ t: 'clipboard', nodes: list });
      },
      paste: () => {
        if (!s.clipboard.length) return;
        // Into the selected container, else after the selected node, else into the selected scene's root.
        let place: Place | null = null;
        if (sel.kind === 'node' && scene) {
          const target = findNode(scene.root, sel.ids[0]);
          if (target && specOf(target.type).container) place = { parent: target.id, slot: null, index: target.children?.length ?? 0 };
          else {
            const at = placeOf(scene.root, sel.ids[0]);
            if (at) place = { ...at, index: at.index + 1 };
          }
        } else if (scene) place = { parent: scene.root.id, slot: null, index: scene.root.children?.length ?? 0 };
        if (!place) return;
        const copies = s.clipboard.map((n) => cloneNode(n));
        let next = s.doc;
        copies.forEach((c, i) => { next = ops.insertAt(next, { ...place!, index: place!.index + i }, c); });
        run(() => next, true, nodeSel(copies.map((c) => c.id), next));
      },
      embed: (ids, axis) => {
        const [next, stack] = ops.embedIn(s.doc, ids, axis);
        if (stack) run(() => next, true, nodeSel([stack], next));
      },
      load: (doc) => dispatch({ t: 'load', doc }),
      undo: () => dispatch({ t: 'undo' }),
      redo: () => dispatch({ t: 'redo' }),
    };
  }, [s]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
