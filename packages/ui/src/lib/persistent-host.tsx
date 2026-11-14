'use client';
import { useLayoutEffect, useState } from 'react';

/* ══ Persistent hosts — one element, many homes ══
   ArtifactChatContainer moves its chat between a docked column and a floating sheet. Rendering the composer
   (and transcript) inside each layout would remount them — the draft, the caret, a streaming reply all lost —
   and cut between two copies. Instead each is rendered once, through a portal, into a detached host element,
   and that host is re-attached to whichever dock the current layout provides. The same DOM, the same React
   state; the container animates the host from its old place to its new one. */

/** A stable, detached element to portal into (display: contents, so it adds no box). */
export function usePersistentHost(slot: string): HTMLElement | null {
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.setAttribute('data-slot', slot);
    el.style.display = 'contents';
    return el;
  });
  return host;
}

/** Moves `host` into `dock` whenever the dock changes. */
export function useAttachHost(host: HTMLElement | null, dock: HTMLElement | null) {
  useLayoutEffect(() => {
    if (host && dock && host.parentNode !== dock) dock.appendChild(host);
  }, [host, dock]);
  useLayoutEffect(() => () => host?.remove(), [host]);
}
