'use client';
/* @internal: the Composer's own wiring, shared by its modules and by ArtifactChatContainer. Registry installs copy it
   with the Composer; it has no npm entry (tools/registry/package-exports.mjs skips modules marked `@internal`). */
import * as React from 'react';
import type { GitbookEditorProps } from '@brett_lamy/ui/docstream-editor/editor';
import type { ComposerAttachment, ComposerContextValue } from '@/components/ui/composer/composer';

/** How a ComposerQueue takes a draft sent while a reply streams: `false` when its `onItemsChange` refused it. */
export type ComposerQueueTake = (markdown: string, attachments: ComposerAttachment[], event?: Event) => boolean;

/** The Docstream editor behind ComposerInput. */
export type ComposerEditor = NonNullable<Parameters<NonNullable<GitbookEditorProps['onEditorReady']>>[0]>;

/** What the Composer's own parts read beside the public value: registrations and the outlet's hooks. */
export interface ComposerInternals extends ComposerContextValue {
  /** A ComposerQueue registers where queued drafts go. */
  setQueue: (queue: ComposerQueueTake | null) => void;
  /** ComposerInput registers its editor here. */
  setEditor: (editor: ComposerEditor | null) => void;
  /** Set by a ComposerOutlet above the root. */
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  /** Where ComposerOptions move to while compact. */
  optionsOutlet: HTMLElement | null;
  setOptionsOutlet: (el: HTMLElement | null) => void;
  /** The FAB the card folds into, when this composer can fold. */
  fab: { icon?: React.ReactNode; restore: (event?: React.MouseEvent) => void } | null;
}

export const ComposerContext = React.createContext<ComposerInternals | null>(null);

/** The Composer's parts' own view of it (not public). */
export function useComposerInternals(): ComposerInternals {
  const ctx = React.useContext(ComposerContext);
  if (!ctx) throw new Error('useComposer must be used within <Composer>');
  return ctx;
}

/* ── Outlet ── */
export interface ComposerOutletProps {
  /** Parts added to the Composer below this outlet, as if they were its first children (e.g. a top bump). */
  parts?: React.ReactNode;
  /** Wraps (or replaces) the Composer's card, e.g. to swap it for a status while an agent works. */
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  /** Classes merged into the Composer root. */
  className?: string;
  children?: React.ReactNode;
}
export interface ComposerOutletValue {
  parts?: React.ReactNode;
  renderCard?: (card: React.ReactNode) => React.ReactNode;
  className?: string;
}
export const ComposerOutletContext = React.createContext<ComposerOutletValue | null>(null);

/** Lets an ancestor contribute parts to the nearest Composer inside it. The Composer consumes it, so
    Composers nested in those parts are unaffected. */
export function ComposerOutlet({ parts, renderCard, className, children }: ComposerOutletProps) {
  const value = React.useMemo(() => ({ parts, renderCard, className }), [parts, renderCard, className]);
  return <ComposerOutletContext.Provider value={value}>{children}</ComposerOutletContext.Provider>;
}
