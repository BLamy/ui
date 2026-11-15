'use client';
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Swap } from '@/components/ui/swap';

/* ══ The view flow of a modal surface, and its header's layout ══
   Dialog and Sheet both take a `view`: a key per step of a flow (pick a plan → confirm). SurfaceFlow works out the
   direction of each change (a new key travels forward, one seen before travels back) and carries the root's
   `dismissible`; the surface's parts read it to slide their view and title the same way, and to leave out the bare ×
   and the grabber of a surface that can't be dismissed. SurfaceHeaderContext tells a title and a × whether they sit
   in a stacked header or in the one-row `bar` header of a flow.
   Internal: the kit's surfaces render SurfaceFlow for you (Dialog `view`, Sheet `view`). ══ */

export interface SurfaceFlowValue {
  /** The root's `view`; undefined for a surface that isn't a flow. */
  view: string | undefined;
  /** Travel of the last view change: 1 forward, -1 back (a view seen before), 0 none. */
  direction: -1 | 0 | 1;
  dismissible: boolean;
}
const SurfaceFlowContext = createContext<SurfaceFlowValue>({ view: undefined, direction: 0, dismissible: true });

/** The flow around a surface's part: its `view`, the direction of the last change and `dismissible`. */
export function useSurfaceFlow(): SurfaceFlowValue {
  return useContext(SurfaceFlowContext);
}

/** The layout of the header a part is in: `default` (stacked), `bar` (one row), or null outside a header. */
export const SurfaceHeaderContext = createContext<'default' | 'bar' | null>(null);

export function useSurfaceHeader(): 'default' | 'bar' | null {
  return useContext(SurfaceHeaderContext);
}

/** The direction of each change of `view`: revisiting a view in the trail is going back. */
function useViewDirection(view: string | undefined): -1 | 0 | 1 {
  const trail = useRef<string[]>(view === undefined ? [] : [view]);
  const last = useRef<{ view: string | undefined; direction: -1 | 0 | 1 }>({ view, direction: 0 });
  if (last.current.view !== view && view !== undefined) {
    const at = trail.current.indexOf(view);
    if (at >= 0) {
      trail.current = trail.current.slice(0, at + 1);
      last.current = { view, direction: -1 };
    } else {
      trail.current = [...trail.current, view];
      last.current = { view, direction: 1 };
    }
  }
  return last.current.direction;
}

export interface SurfaceFlowProps {
  /** Key of the current view; undefined for a surface that isn't a flow. */
  view?: string;
  /** Whether the surface can be dismissed (the bare × and the grabber are left out when it can't). Default true. */
  dismissible?: boolean;
  children?: ReactNode;
}

/** Provides the flow to a surface's parts (Dialog and Sheet render it around their root). */
export function SurfaceFlow({ view, dismissible = true, children }: SurfaceFlowProps) {
  const direction = useViewDirection(view);
  const flow = useMemo(() => ({ view, direction, dismissible }), [view, direction, dismissible]);
  return <SurfaceFlowContext.Provider value={flow}>{children}</SurfaceFlowContext.Provider>;
}

/** A flow title's text: when the surface has a `view`, a new title travels in from the side its view comes from
    while the old one plays its exit. Outside a flow, the children as they are. */
export function SurfaceFlowTitle({ children }: { children?: ReactNode }) {
  const { view, direction } = useSurfaceFlow();
  if (view === undefined) return children;
  const key = typeof children === 'string' || typeof children === 'number' ? String(children) : view;
  return (
    <Swap value={key} direction={direction} distance={18} blur={3} inline className="grid w-full overflow-x-clip [overflow-clip-margin:8px]">
      <span className="justify-self-start">{children}</span>
    </Swap>
  );
}
