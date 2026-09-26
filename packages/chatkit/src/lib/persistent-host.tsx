import { createContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ComposerOutlet, type ComposerOutletProps } from '@brett_lamy/workbench';

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

/* ── The composer outlet, reported by whichever layout is showing ── */
export type OutletValue = Pick<ComposerOutletProps, 'parts' | 'renderCard' | 'className'> | null;

export interface OutletStore {
  get: () => OutletValue;
  set: (value: OutletValue) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createOutletStore(): OutletStore {
  let value: OutletValue = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Provided by ArtifactChatContainer to its FloatingChat: dock the shared composer and transcript here. */
export interface ChatHostContextValue {
  outlet: OutletStore;
  /** Where the composer lives in this layout. */
  composerDock: (el: HTMLElement | null) => void;
  /** Where the transcript lives in this layout. */
  chatDock: (el: HTMLElement | null) => void;
}
export const ChatHostContext = createContext<ChatHostContextValue | null>(null);

/** Renders the composer once, into its host, wrapped in the outlet the current layout reported. */
export function ComposerPortal({ store, host, children }: { store: OutletStore; host: HTMLElement | null; children?: ReactNode }) {
  const value = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!host) return null;
  return createPortal(
    <ComposerOutlet parts={value?.parts} renderCard={value?.renderCard} className={value?.className}>
      {children}
    </ComposerOutlet>,
    host,
  );
}
