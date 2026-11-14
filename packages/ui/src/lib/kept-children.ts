'use client';
import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* ══ useKeptChildren — children that survive a change of presentation ══
   A region that moves between a column, a drawer and a pushed page (AdaptivePane, Sidebar) renders its children
   once, through a portal, into a detached element, and each presentation docks that element where it shows them:
   the same React tree and the same DOM nodes, so fields, selection, scroll and subscriptions carry over. Until
   hydration the children render in the dock itself, so the server's markup matches.

     const kept = useKeptChildren(children)
     <>{kept.portal}{wide ? <aside ref={kept.dock}>{kept.inline}</aside> : <Drawer><div ref={kept.dock}>{kept.inline}</div></Drawer>}</>
   ══ */

const subscribeNothing = () => () => undefined;

export interface KeptChildren {
  /** A ref for the element the children show in now. */
  dock: (el: HTMLElement | null) => void;
  /** Render once, anywhere under the component, at a stable place: the children's one home in the React tree. */
  portal: ReactNode;
  /** Render inside the dock: the children before hydration, else nothing. */
  inline: ReactNode;
}

export function useKeptChildren(children: ReactNode): KeptChildren {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [node] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.style.display = 'contents';
    return el;
  });
  const kept = hydrated && node != null;
  const dock = useCallback((el: HTMLElement | null) => {
    if (el && node && node.parentNode !== el) el.appendChild(node);
  }, [node]);
  useLayoutEffect(() => () => node?.remove(), [node]);
  return {
    dock,
    portal: kept ? createPortal(children, node) : null,
    inline: kept ? null : children,
  };
}
