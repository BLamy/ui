import { createChange, createController, definePrimitive, type ChangeDetails, type ChangeOptions } from '@ui-sdk/core';
import {
  NOTHING_SELECTED, addConnection, checkConnection, deleteItems, indexDiagram, moveEdgeEnd, moveNodes,
  type DiagramConnection, type DiagramEdge, type DiagramNode, type DiagramSelection,
} from '@/lib/diagram-model';

/* ══ The diagram primitive: a diagram's data, its selection and its history ══
   What a diagram *is*, apart from how it's drawn and pointed at: the nodes and edges (`data`, controlled or its own),
   what's selected (`selection`), and the changes that can be undone. Every change asks first, through `createChange`:
   `onDataChange(data, details)` and `onSelectionChange(selection, details)` hear why (`move`, `delete`, `connect`,
   `undo`…, and `press`, `marquee`, `keyboard`… for a selection), and `details.cancel()` refuses one, which leaves
   the data as it was and history where it was. A controlled diagram's history moves once the data it asked for comes
   back; data that changes for reasons of its own clears it, as undoing to what it was would lose that change.

   The same methods drive it from a controller (`createDiagramController`) and an agent: select, select all, clear,
   delete what's selected, undo, redo, connect two nodes, move nodes. Pointer gestures and keyboard focus are the
   component's (`components/diagram.tsx`, on `lib/diagram-gesture` and `lib/diagram-keyboard`), and they end here
   too. No React. */

/** A diagram's nodes and edges. */
export interface DiagramData<N = unknown, E = unknown> {
  nodes: readonly DiagramNode<N>[];
  edges: readonly DiagramEdge<E>[];
}

/** Why the data changed: a drag or a nudge (`move`), Delete, a new connection, an edge's end moved, undo, redo, or a
 *  controller's `moveNodes` / `connect` / `deleteSelection` with the same reasons. */
export type DiagramDataChangeReason = 'move' | 'delete' | 'connect' | 'reconnect' | 'undo' | 'redo';
export type DiagramDataChangeDetails = ChangeDetails<DiagramDataChangeReason>;

/** Why the selection changed: a press (with or without Shift or ⌘), a marquee, Enter or Shift+Enter, ⌘A, Escape, a
 *  delete taking it away, or a controller. */
export type DiagramSelectionChangeReason = 'press' | 'marquee' | 'keyboard' | 'select-all' | 'escape-key' | 'delete' | 'imperative';
export type DiagramSelectionChangeDetails = ChangeDetails<DiagramSelectionChangeReason>;

/** How many changes undo reaches back. */
const DIAGRAM_HISTORY_LIMIT = 100;

export interface DiagramOptions<N = unknown, E = unknown> {
  /** The data, to control it. */
  data?: DiagramData<N, E>;
  defaultData?: DiagramData<N, E>;
  onDataChange?: (data: DiagramData<N, E>, details: DiagramDataChangeDetails) => void;
  selection?: DiagramSelection;
  defaultSelection?: DiagramSelection;
  onSelectionChange?: (selection: DiagramSelection, details: DiagramSelectionChangeDetails) => void;
  /** Whether things can be selected at all. */
  selectable?: boolean;
  /** Whether the data can change: moves, deletes, connections. */
  editable?: boolean;
  /** Whether the diagram keeps its own history: undo and redo. */
  undoable?: boolean;
  /** Whether a connection is allowed: true, or the reason it isn't. Default `checkConnection`. */
  isValidConnection?: (connection: DiagramConnection) => boolean | string;
  /** Makes the edge for a new connection. */
  createEdge?: (connection: DiagramConnection) => DiagramEdge<E>;
  controller?: DiagramController<N, E>;
}

interface DiagramState {
  data: DiagramData<any, any>;
  selection: DiagramSelection;
  /** How far undo and redo reach: what a toolbar's buttons read. */
  past: number;
  future: number;
  /** From the options, for the root's attributes. */
  editable: boolean;
  selectable: boolean;
}

/** What a diagram controller and `useDiagram()` can do. Each change goes through `onDataChange` or
 *  `onSelectionChange`, which can refuse it; each returns whether it happened. */
export type DiagramController<N = unknown, E = unknown> = {
  getData: () => DiagramData<N, E>;
  getSelection: () => DiagramSelection;
  select: (selection: DiagramSelection, options?: ChangeOptions<DiagramSelectionChangeReason>) => boolean;
  selectAll: () => boolean;
  clearSelection: () => boolean;
  /** Deletes what's selected, and what goes with it (a node's edges and children). */
  deleteSelection: () => boolean;
  /** Moves nodes by `dx`, `dy` board units, with what they hold and the routes between them. */
  moveNodes: (ids: readonly string[], dx: number, dy: number) => boolean;
  /** Adds an edge, or moves an end of `connection.edge`, if `isValidConnection` allows it. Returns the reason it
   *  doesn't, in words, when it doesn't. */
  connect: (connection: DiagramConnection) => true | string;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

/** A handle for a diagram: pass it as `controller`, then select, delete, connect or undo from anywhere. */
export function createDiagramController<N = unknown, E = unknown>() {
  return createController<DiagramController<N, E>>();
}

const EMPTY: DiagramData = { nodes: [], edges: [] };
const sameData = (a: DiagramData<any, any>, b: DiagramData<any, any>) => a.nodes === b.nodes && a.edges === b.edges;

export const diagram = definePrimitive({
  name: 'diagram',
  options: {
    data: 'value', defaultData: 'value', onDataChange: 'callback',
    selection: 'value', defaultSelection: 'value', onSelectionChange: 'callback',
    selectable: 'boolean', editable: 'boolean', undoable: 'boolean',
    isValidConnection: 'action', createEdge: 'action', controller: 'value',
  },
  controlled: ['data', 'selection'],
  state: (options: DiagramOptions<any, any>): DiagramState => ({
    data: options.data ?? options.defaultData ?? EMPTY,
    selection: options.selection ?? options.defaultSelection ?? NOTHING_SELECTED,
    past: 0,
    future: 0,
    editable: !!options.editable,
    selectable: options.selectable !== false,
  }),
  sync: (options) => ({
    ...(options.data ? { data: options.data } : null),
    ...(options.selection ? { selection: options.selection } : null),
    editable: !!options.editable,
    selectable: options.selectable !== false,
  }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const history: { past: DiagramData<any, any>[]; future: DiagramData<any, any>[] } = { past: [], future: [] };
    /** A change asked of a controlled diagram, until its data comes back. */
    let pending: { asked: DiagramData<any, any>; before: DiagramData<any, any>; mode: 'edit' | 'undo' | 'redo' } | null = null;
    const counts = () => store.set({ past: history.past.length, future: history.future.length });
    const settle = (before: DiagramData<any, any>, mode: 'edit' | 'undo' | 'redo') => {
      if (mode === 'edit') {
        history.past.push(before);
        if (history.past.length > DIAGRAM_HISTORY_LIMIT) history.past.shift();
        history.future = [];
      } else if (mode === 'undo') {
        history.past.pop();
        history.future.push(before);
      } else {
        history.future.pop();
        history.past.push(before);
      }
      counts();
    };
    // The owner's data, as it arrives: what was asked for moves history, anything else clears it.
    context.onOptions((_options, synced) => {
      const next = synced?.data;
      const now = store.get().data;
      if (!next || sameData(next, now)) return;
      const asked = pending;
      pending = null;
      if (asked && sameData(asked.asked, next)) settle(asked.before, asked.mode);
      else if (history.past.length || history.future.length) {
        history.past = [];
        history.future = [];
        counts();
      }
    });

    /** Asks for new data. Returns whether it was taken. */
    function commit(next: DiagramData<any, any>, reason: DiagramDataChangeReason, event?: Event): boolean {
      const before = store.get().data;
      if (sameData(before, next)) return false;
      const mode = reason === 'undo' || reason === 'redo' ? reason : 'edit';
      const controlled = context.options().data !== undefined;
      if (controlled) pending = { asked: next, before, mode };
      const accepted = change('data', next, { reason, event });
      if (!accepted) {
        pending = null;
        return false;
      }
      if (!controlled && context.options().undoable !== false) settle(before, mode);
      return true;
    }

    /** Deletes `selection` and what goes with it, then clears the selection. */
    function remove(selection: DiagramSelection, event?: Event): boolean {
      if (context.options().editable === false) return false;
      const { data } = store.get();
      if (!selection.nodes.length && !selection.edges.length) return false;
      const index = indexDiagram(data.nodes);
      const next = deleteItems(data.nodes, data.edges, { nodes: selection.nodes.filter((id) => index.byId.get(id)?.kind !== 'root'), edges: selection.edges }, index);
      if (next.nodes.length === data.nodes.length && next.edges.length === data.edges.length) return false;
      if (!commit(next, 'delete', event)) return false;
      change('selection', NOTHING_SELECTED, { reason: 'delete', event });
      return true;
    }

    const select = (selection: DiagramSelection, { reason = 'imperative', event }: ChangeOptions<DiagramSelectionChangeReason> = {}) =>
      context.options().selectable === false ? false : change('selection', selection, { reason, event });

    const check = (c: DiagramConnection): true | string => {
      const { data } = store.get();
      const own = context.options().isValidConnection;
      if (!own) return checkConnection(c, indexDiagram(data.nodes), data.edges);
      const verdict = own(c);
      return verdict === true ? true : verdict === false ? 'That can’t connect there.' : verdict;
    };

    const api = {
      getData: () => store.get().data,
      getSelection: () => store.get().selection,
      select,
      selectAll: () => {
        const { data } = store.get();
        return select({ nodes: data.nodes.filter((n) => n.kind !== 'root').map((n) => n.id), edges: data.edges.map((e) => e.id) }, { reason: 'select-all' });
      },
      clearSelection: () => select(NOTHING_SELECTED),
      deleteSelection: (event?: Event) => remove(store.get().selection, event),
      moveNodes: (ids: readonly string[], dx: number, dy: number, event?: Event) => {
        if (context.options().editable === false || !ids.length || (!dx && !dy)) return false;
        const { data } = store.get();
        return commit(moveNodes(data.nodes, data.edges, ids, dx, dy), 'move', event);
      },
      connect: (connection: DiagramConnection, event?: Event): true | string => {
        if (context.options().editable === false) return 'This diagram can’t be changed.';
        const verdict = check(connection);
        if (verdict !== true) return verdict;
        const { data } = store.get();
        const taken = connection.edge
          ? commit({ nodes: data.nodes, edges: moveEdgeEnd(data.edges, connection as DiagramConnection & { edge: string }) }, 'reconnect', event)
          : commit({ nodes: data.nodes, edges: addConnection(data.edges, connection, context.options().createEdge) }, 'connect', event);
        return taken ? true : 'The change was refused.';
      },
      undo: (event?: Event) => {
        const to = history.past[history.past.length - 1];
        return !!to && context.options().undoable !== false && commit(to, 'undo', event);
      },
      redo: (event?: Event) => {
        const to = history.future[history.future.length - 1];
        return !!to && context.options().undoable !== false && commit(to, 'redo', event);
      },
      canUndo: () => context.options().undoable !== false && history.past.length > 0,
      canRedo: () => context.options().undoable !== false && history.future.length > 0,
      /** What the component needs: data a gesture or a key made, with its reason and event. */
      internal: { commit, check, remove },
    };
    return api;
  },
  slots: (slot) => ({
    // The diagram, named for people and agents: a group around its board, whose canvas is the one tab stop.
    root: slot<object, { editable: boolean; selectable: boolean; empty: boolean }>({
      role: 'group',
      attrs: (state) => ({
        'aria-roledescription': 'diagram',
        'data-editable': state.editable ? '' : undefined,
        'data-selectable': state.selectable ? '' : undefined,
        'data-empty': state.data.nodes.length ? undefined : '',
      }),
      state: (state) => ({ editable: state.editable, selectable: state.selectable, empty: !state.data.nodes.length }),
    }),
  }),
  agent: { actions: ['getData', 'getSelection', 'select', 'selectAll', 'clearSelection', 'deleteSelection', 'moveNodes', 'connect', 'undo', 'redo'] },
});

export type { DiagramConnection, DiagramSelection };
