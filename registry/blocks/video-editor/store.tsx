import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { Timeline, TimelineFormat } from '@/lib/video-timeline';

/* The editor's state: the project (name, format, timeline) with undo history, the media library and the selection.
   Each `commit` is one undo step; commits that share a `coalesce` key within a second (a slider being dragged) fold
   into one. Media files never enter the history: a clip refers to its media by id. */

export interface MediaItem {
  id: string;
  name: string;
  file: Blob;
  /** An object URL the preview plays. */
  url: string;
  kind: 'video' | 'audio' | 'image';
  /** Seconds (a still has none of its own; it lasts as long as its clip). */
  duration: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
  status: 'loading' | 'ready' | 'error';
  error?: string;
}

export interface Project {
  name: string;
  format: TimelineFormat;
  /** What shows behind and between clips. */
  background: string;
  timeline: Timeline;
}

interface State {
  project: Project;
  past: Project[];
  future: Project[];
  /** The last commit's coalesce key and when it was made. */
  last: { key: string; at: number } | null;
  media: Record<string, MediaItem>;
  order: string[];
  selection: string[];
}

type Action =
  | { type: 'commit'; next: Project | ((p: Project) => Project); coalesce?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; ids: string[] }
  | { type: 'media'; item: MediaItem }
  | { type: 'media-patch'; id: string; patch: Partial<MediaItem> }
  | { type: 'media-remove'; id: string };

const HISTORY = 100;

function reduce(s: State, a: Action): State {
  switch (a.type) {
    case 'commit': {
      const next = typeof a.next === 'function' ? a.next(s.project) : a.next;
      if (next === s.project) return s;
      const now = Date.now();
      const fold = !!a.coalesce && s.last?.key === a.coalesce && now - s.last.at < 1000;
      return {
        ...s,
        project: next,
        past: fold ? s.past : [...s.past, s.project].slice(-HISTORY),
        future: [],
        last: a.coalesce ? { key: a.coalesce, at: now } : null,
      };
    }
    case 'undo':
      if (!s.past.length) return s;
      return { ...s, project: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.project, ...s.future], last: null };
    case 'redo':
      if (!s.future.length) return s;
      return { ...s, project: s.future[0], past: [...s.past, s.project], future: s.future.slice(1), last: null };
    case 'select':
      return { ...s, selection: a.ids };
    case 'media':
      return { ...s, media: { ...s.media, [a.item.id]: a.item }, order: s.order.includes(a.item.id) ? s.order : [...s.order, a.item.id] };
    case 'media-patch': {
      const m = s.media[a.id];
      return m ? { ...s, media: { ...s.media, [a.id]: { ...m, ...a.patch } } } : s;
    }
    case 'media-remove': {
      const media = { ...s.media };
      delete media[a.id];
      return { ...s, media, order: s.order.filter((id) => id !== a.id) };
    }
  }
}

export interface Editor {
  project: Project;
  media: Record<string, MediaItem>;
  /** Media ids in the order they were added. */
  order: string[];
  selection: string[];
  canUndo: boolean;
  canRedo: boolean;
  commit: (next: Project | ((p: Project) => Project), coalesce?: string) => void;
  /** Changes the timeline (one undo step, or folded into the last with the same `coalesce` key). */
  edit: (fn: (t: Timeline) => Timeline, coalesce?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (ids: string[]) => void;
  addMedia: (item: MediaItem) => void;
  patchMedia: (id: string, patch: Partial<MediaItem>) => void;
  removeMedia: (id: string) => void;
}

const Ctx = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const e = useContext(Ctx);
  if (!e) throw new Error('useEditor needs an <EditorProvider>');
  return e;
}

export function EditorProvider({ project, children }: { project: Project; children?: ReactNode }) {
  const [s, dispatch] = useReducer(reduce, project, (p): State => ({ project: p, past: [], future: [], last: null, media: {}, order: [], selection: [] }));
  const commit: Editor['commit'] = (next, coalesce) => dispatch({ type: 'commit', next, coalesce });
  const editor: Editor = {
    project: s.project,
    media: s.media,
    order: s.order,
    selection: s.selection,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0,
    commit,
    edit: (fn, coalesce) => commit((p) => {
      const timeline = fn(p.timeline);
      return timeline === p.timeline ? p : { ...p, timeline };
    }, coalesce),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    select: (ids) => dispatch({ type: 'select', ids }),
    addMedia: (item) => dispatch({ type: 'media', item }),
    patchMedia: (id, patch) => dispatch({ type: 'media-patch', id, patch }),
    removeMedia: (id) => dispatch({ type: 'media-remove', id }),
  };
  return <Ctx.Provider value={editor}>{children}</Ctx.Provider>;
}
