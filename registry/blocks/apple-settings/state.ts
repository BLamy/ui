/* Settings state: every setting's value, the navigation path (panes pushed so far) and search. One context so
   any row can read or change a value, or push a pane. The layout follows the SplitView's width class. */
import { createContext, useContext, useMemo, useState } from 'react';
import { useSplitView, type SplitViewWidthClass } from '@/components/ui/split-view';
import { type Appearance } from '@/lib/theme';
import { DEFAULTS, type Value, type Values } from './data';

export type Layout = 'phone' | 'tablet' | 'desktop';

export interface SettingsApi {
  values: Values;
  set: (id: string, v: Value) => void;
  /** Pane ids from the top level down. Empty on the phone's root list. */
  path: string[];
  /** Direction of the last navigation: 1 push, -1 back, 0 jump. */
  dir: -1 | 0 | 1;
  canForward: boolean;
  open: (id: string) => void;
  openPath: (ids: string[]) => void;
  back: () => void;
  forward: () => void;
  query: string;
  setQuery: (q: string) => void;
  dark: boolean;
  setAppearance: (a: Appearance) => void;
}

export const SettingsCtx = createContext<SettingsApi | null>(null);
const LAYOUT: Record<SplitViewWidthClass, Layout> = { compact: 'phone', medium: 'tablet', regular: 'desktop' };

/** Settings state plus the layout in effect: macOS at regular width, iOS / iPadOS below. */
export function useSettings(): SettingsApi & { layout: Layout } {
  const { widthClass } = useSplitView();
  const s = useContext(SettingsCtx);
  if (!s) throw new Error('useSettings must be used inside <AppleSettings>');
  return { ...s, layout: LAYOUT[widthClass] };
}

/** Sidebar layouts always show a pane: the path, or Wi-Fi when nothing is open yet. */
export const trailOf = (path: string[]) => (path.length ? path : ['wifi']);

interface Nav { path: string[]; dir: -1 | 0 | 1; fwd: string[] }

export function useSettingsState(initialPath: string[], dark: boolean, setAppearance: (a: Appearance) => void): SettingsApi {
  const [values, setValues] = useState<Values>(DEFAULTS);
  const [nav, setNav] = useState<Nav>({ path: initialPath, dir: 0, fwd: [] });
  const [query, setQuery] = useState('');
  return useMemo<SettingsApi>(() => ({
    values,
    set: (id, v) => setValues((s) => ({ ...s, [id]: v })),
    path: nav.path,
    dir: nav.dir,
    canForward: nav.fwd.length > 0,
    open: (id) => setNav((n) => ({ path: [...n.path, id], dir: 1, fwd: [] })),
    openPath: (ids) => setNav((n) => (ids.join('/') === n.path.join('/') ? n : { path: ids, dir: 0, fwd: [] })),
    back: () => setNav((n) => (n.path.length ? { path: n.path.slice(0, -1), dir: -1, fwd: [n.path[n.path.length - 1], ...n.fwd] } : n)),
    forward: () => setNav((n) => (n.fwd.length ? { path: [...n.path, n.fwd[0]], dir: 1, fwd: n.fwd.slice(1) } : n)),
    query,
    setQuery,
    dark,
    setAppearance,
  }), [values, nav, query, dark, setAppearance]);
}
