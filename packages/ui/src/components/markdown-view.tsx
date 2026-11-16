'use client';
import * as React from 'react';
import { GitbookStreamdown, type GitbookStreamdownProps, type CodeBlockRenderDetails } from '@brett_lamy/ui/docstream/streamdown';
import { DocstreamRefContext, type DocstreamRefContextValue } from '@brett_lamy/ui/docstream/reference';
import type { CodeBlockNode, ReferenceNode } from '@brett_lamy/ui/docstream/gitbook';
import '@brett_lamy/ui/docstream/styles.css';
import { cn } from '@/lib/utils';

export type { CodeBlockNode, CodeBlockRenderDetails, ReferenceNode };

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
  /** Draw a code fence yourself (a CodeEditor, your own highlighter); return `null` to fall back to Docstream's.
   *  `details.placement` is `block` (a whole fence) or `tab` (one tab's body); `details.highlighted` is Docstream's
   *  own highlighted `<code>`, to frame. Widget fences (tui, mermaid, strudel, live demos) never reach it; a `capnp` fence
   *  does, and a workerd config it declines is drawn as its Cloudflare services. */
  renderCode?: (block: CodeBlockNode, details: CodeBlockRenderDetails) => React.ReactNode | null | undefined;
}

export function MarkdownView({
  markdown,
  streaming,
  demoResolver,
  sourceRenderer,
  tui,
  onReferenceClick,
  renderReference,
  renderCode,
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
      <GitbookStreamdown markdown={markdown ?? ''} isStreaming={streaming} demoResolver={demoResolver} sourceRenderer={sourceRenderer} tui={tui} renderCode={renderCode} />
    </div>
  );
  if (!onReferenceClick && !renderReference) return view;
  return <DocstreamRefContext.Provider value={refCtx}>{view}</DocstreamRefContext.Provider>;
}
