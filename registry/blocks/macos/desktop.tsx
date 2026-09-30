/* The desktop's window manager: one window per app (opening a running app brings it forward), a stacking order,
   and the frontmost app the menu bar shows. Geometry is stored unzoomed; a zoomed window fills the desktop. */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { appById, type DesktopApp } from './apps';

export interface Rect { x: number; y: number; w: number; h: number }
export interface WindowState extends Rect {
  app: string;
  z: number;
  minimized: boolean;
  zoomed: boolean;
}
export interface Area { width: number; height: number }

interface State { windows: WindowState[]; z: number; front: string | null }
type Action =
  | { type: 'open'; app: string; area: Area }
  | { type: 'focus'; app: string }
  | { type: 'close'; app: string }
  | { type: 'minimize'; app: string }
  | { type: 'zoom'; app: string }
  | { type: 'rect'; app: string; rect: Rect }
  | { type: 'blur' };

/** Room the dock takes at the desktop's bottom edge. */
export const DOCK_RESERVE = 88;
const MARGIN = 16;
export const MIN_W = 340;
export const MIN_H = 240;

/** Where a new window opens: its app's size (shrunk to fit), cascaded by how many windows are already open. */
export function initialRect(app: DesktopApp, open: number, area: Area): Rect {
  const w = Math.min(app.size.w, area.width - MARGIN * 2);
  const h = Math.min(app.size.h, area.height - MARGIN - DOCK_RESERVE);
  const step = (open % 6) * 26;
  return {
    w, h,
    x: Math.max(MARGIN / 2, Math.min(area.width - w - MARGIN / 2, Math.round((area.width - w) / 2) - 78 + step)),
    y: Math.max(8, Math.min(area.height - h - 8, 14 + step)),
  };
}

const topOf = (windows: WindowState[]) => windows.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.app ?? null;

function reduce(s: State, a: Action): State {
  const patch = (app: string, f: (w: WindowState) => Partial<WindowState>) => s.windows.map((w) => (w.app === app ? { ...w, ...f(w) } : w));
  switch (a.type) {
    case 'open': {
      const meta = appById(a.app);
      if (!meta) return s;
      const z = s.z + 1;
      if (s.windows.some((w) => w.app === a.app)) return { windows: patch(a.app, () => ({ minimized: false, z })), z, front: a.app };
      const win: WindowState = { app: a.app, z, minimized: false, zoomed: false, ...initialRect(meta, s.windows.length, a.area) };
      return { windows: [...s.windows, win], z, front: a.app };
    }
    case 'focus': {
      if (s.front === a.app) return s;
      const z = s.z + 1;
      return { windows: patch(a.app, () => ({ z })), z, front: a.app };
    }
    case 'close': {
      const windows = s.windows.filter((w) => w.app !== a.app);
      return { ...s, windows, front: s.front === a.app ? topOf(windows) : s.front };
    }
    case 'minimize': {
      const windows = patch(a.app, () => ({ minimized: true }));
      return { ...s, windows, front: s.front === a.app ? topOf(windows) : s.front };
    }
    case 'zoom': return { ...s, windows: patch(a.app, (w) => ({ zoomed: !w.zoomed })) };
    case 'rect': return { ...s, windows: patch(a.app, () => ({ ...a.rect })) };
    case 'blur': return s.front === null ? s : { ...s, front: null };
  }
}

export interface Desktop {
  windows: WindowState[];
  /** The frontmost app's id, or null when the desktop itself is frontmost (the menu bar reads Finder). */
  front: string | null;
  isOpen: (app: string) => boolean;
  open: (app: string) => void;
  focus: (app: string) => void;
  close: (app: string) => void;
  minimize: (app: string) => void;
  toggleZoom: (app: string) => void;
  setRect: (app: string, rect: Rect) => void;
  blur: () => void;
  area: Area;
}

const Ctx = createContext<Desktop | null>(null);

export function useDesktop(): Desktop {
  const d = useContext(Ctx);
  if (!d) throw new Error('useDesktop must be used inside <DesktopProvider>');
  return d;
}

export function DesktopProvider({ area, initialApps = [], children }: { area: Area; initialApps?: string[]; children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, { area, initialApps }, ({ area: a, initialApps: apps }) =>
    apps.reduce<State>((s, app) => reduce(s, { type: 'open', app, area: a }), { windows: [], z: 0, front: null }));
  const value = useMemo<Desktop>(() => ({
    windows: state.windows,
    front: state.front,
    isOpen: (app) => state.windows.some((w) => w.app === app),
    open: (app) => dispatch({ type: 'open', app, area }),
    focus: (app) => dispatch({ type: 'focus', app }),
    close: (app) => dispatch({ type: 'close', app }),
    minimize: (app) => dispatch({ type: 'minimize', app }),
    toggleZoom: (app) => dispatch({ type: 'zoom', app }),
    setRect: (app, rect) => dispatch({ type: 'rect', app, rect }),
    blur: () => dispatch({ type: 'blur' }),
    area,
  }), [state, area]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
