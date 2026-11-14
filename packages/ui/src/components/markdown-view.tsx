'use client';
import * as React from 'react';
import { GitbookStreamdown, type GitbookStreamdownProps } from '@brett_lamy/docstream/streamdown';
import { DocstreamRefContext, type DocstreamRefContextValue } from '@brett_lamy/docstream/reference';
import type { ReferenceNode } from '@brett_lamy/docstream/gitbook';
import '@brett_lamy/docstream/styles.css';
import { cn } from '@/lib/utils';

export type { ReferenceNode };

/* ══ MarkdownView — Docstream-rendered GitBook-flavored Markdown, read-only ══
   Headings, lists, tables, hints, tabs, highlighted code fences, live demos and @mention / #tag / citation chips,
   streamed or whole. The editable sibling is MarkdownEditor. Chip clicks go through `onReferenceClick` /
   `renderReference`, so a host never imports Docstream itself. */

export interface MarkdownViewProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** The Markdown source. */
  markdown?: string;
  /** The text is still arriving (an AI reply): Docstream keeps an unfinished block open and marks the region busy. */
  streaming?: boolean;
  /** Resolve live demo blocks (`{% demo %}`) and their source files. */
  demoResolver?: GitbookStreamdownProps['demoResolver'];
  /** Render mounted component or Storybook source references. */
  sourceRenderer?: GitbookStreamdownProps['sourceRenderer'];
  /** Configure the sandboxed WASM terminal used by `tui` code fences, or `false` to render them as plain code. */
  tui?: GitbookStreamdownProps['tui'];
  /** Called when an @mention / #tag / citation chip is clicked. */
  onReferenceClick?: (ref: ReferenceNode) => void;
  /** Override chip rendering; return `null` to fall back to the default chip. */
  renderReference?: (ref: ReferenceNode) => React.ReactNode | null;
}

export function MarkdownView({
  markdown,
  streaming,
  demoResolver,
  sourceRenderer,
  tui,
  onReferenceClick,
  renderReference,
  className,
  ...props
}: MarkdownViewProps) {
  const refCtx = React.useMemo<DocstreamRefContextValue>(
    () => ({
      ...(onReferenceClick ? { onReferenceClick } : {}),
      ...(renderReference ? { renderReference } : {}),
    }),
    [onReferenceClick, renderReference],
  );
  const view = (
    <div data-slot="markdown-view" data-renderer="docstream" data-streaming={streaming ? '' : undefined} {...props} className={cn('wb-md', className)}>
      <GitbookStreamdown markdown={markdown ?? ''} isStreaming={streaming} demoResolver={demoResolver} sourceRenderer={sourceRenderer} tui={tui} />
    </div>
  );
  if (!onReferenceClick && !renderReference) return view;
  return <DocstreamRefContext.Provider value={refCtx}>{view}</DocstreamRefContext.Provider>;
}
