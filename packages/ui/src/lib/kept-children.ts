'use client';
import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* ══ useKeptChildren — children that survive a change of presentation ══
   A region that moves between a column, a drawer and a pushed page (AdaptivePane, Sidebar), or a chat that moves
   between a docked column and a floating sheet (ArtifactChatContainer), renders its children once, through a
   portal, into a detached element, and each presentation docks that element where it shows them: the same React
   tree and the same DOM nodes, so fields, a caret, selection, scroll, a streaming reply and subscriptions carry
   over. Until hydration the children render in the dock itself, so the server's markup matches. This is the kit's
   one way to keep children mounted across homes.

     const kept = useKeptChildren(children)
     <>{kept.portal}{wide ? <aside ref={kept.dock}>{kept.inline}</aside> : <Drawer><div ref={kept.dock}>{kept.inline}</div></Drawer>}</>

   The dock ref only claims the children (a dock that unmounts leaves them where they are, still mounted, until
   another claims them), so a leaving presentation never takes them back from the one arriving. A part that is
   not the dock's owner (a compound component's slot) can hand `kept.dock` up through context. ══ */

const subscribeNothing = () => () => undefined;

export interface KeptChildren {
  /** A ref for the element the children show in now. */
  dock: (el: HTMLElement | null) => void;
  /** Render once, anywhere under the component, at a stable place: the children's one home in the React tree. */
  portal: ReactNode;
  /** Render inside the dock: the children before hydration, else nothing. */
  inline: ReactNode;
}

export interface KeptChildrenOptions {
  /** `data-slot` of the detached element (a styling hook; it lays out as `display: contents`). */
  slot?: string;
}

export function useKeptChildren(children: ReactNode, { slot }: KeptChildrenOptions = {}): KeptChildren {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [node] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    if (slot) el.setAttribute('data-slot', slot);
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
