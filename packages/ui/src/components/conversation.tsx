'use client';
import * as React from 'react';
import { animate } from 'framer-motion';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger, type CollapsibleOptions } from '@ui-sdk/react/collapsible';
import { Button, type ButtonProps } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MarkdownView, type MarkdownViewProps } from '@/components/ui/markdown-view';
import { MessageScroller, MessageScrollerItem, useInMessageScroller, type MessageScrollerProps } from '@/components/ui/message-scroller';
import type { ComposerAttachment } from '@/components/ui/composer/composer';
import { attachmentKind } from '@/components/ui/composer/composer-files';
import { formatFileSize } from '@/lib/file-size';
import { cn, pressable, brandTile } from '@/lib/utils';
import { Chevron, Icon, type IconName } from '@/lib/icon';
import { springs } from '@/lib/motion';
import { usePresence } from '@/lib/presence';
import { prefersReducedMotion } from '@/lib/reduced-motion';

/* ══ Conversation — an agent thread around one composer ══
   <Conversation empty={!thread}>
     <ConversationEmpty title="What are we building?" description="Ask anything about this workspace." />
     <ConversationMessages threadKey={thread.id} streaming={busy}>
       <ConversationUserMessage key="u1">…</ConversationUserMessage>
       <ConversationAssistantMessage key="a1"><ConversationWorkLog summary="Worked for 42s">…</ConversationWorkLog><ConversationMarkdown markdown="…" /></ConversationAssistantMessage>
     </ConversationMessages>
     <ConversationComposer><Composer>…</Composer></ConversationComposer>
     <ConversationSuggestions><ConversationSuggestion>…</ConversationSuggestion></ConversationSuggestions>
   </Conversation>

   Empty, the title sits above a centred composer with suggestions under it. The first message turns it into the
   thread *around the same composer*: the empty state leaves, the composer flies down to its dock (draft and focus
   intact), and the first turn rises in. Keep the children in this order. For a transcript without the empty state
   and the dock, use MessageScroller; to place a chat beside or over other content, ArtifactChatContainer. */

const ConversationContext = React.createContext<{ empty: boolean }>({ empty: false });

/** The column the empty state, the suggestions and the docked composer share (the transcript's is MessageScroller's). */
const COLUMN = 'mx-auto w-full max-w-(--conversation-width,620px)';

export interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  /** No thread yet: show the empty state, the centred composer and the suggestions. */
  empty?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export function Conversation({ empty = false, className, ref, children, ...props }: ConversationProps) {
  const value = React.useMemo(() => ({ empty }), [empty]);
  return (
    <ConversationContext.Provider value={value}>
      <div
        ref={ref}
        data-slot="conversation"
        data-empty={empty || undefined}
        className={cn('relative flex min-h-0 flex-1 flex-col', empty && 'wb-scroll overflow-y-auto px-5 py-7', className)}
        {...props}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  );
}

export interface ConversationEmptyProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** The prompt, as a heading ("What are we building?"). With it, the slot draws the kit's EmptyState. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Replaces the tinted asterisk tile; `null` shows none. */
  icon?: React.ReactNode;
  /** A button (or a row of them) under the text. */
  action?: React.ReactNode;
  /** The title's heading level (default 2). */
  headingLevel?: 1 | 2 | 3;
  ref?: React.Ref<HTMLDivElement>;
}

/** The asterisk tile above the empty conversation's title. */
const SPARK = (
  <span className={cn(brandTile, 'inline-grid size-10 place-items-center rounded-panel')}>
    <Icon name="asterisk" size={21} sw={2.1} className="size-[21px]! text-white" />
  </span>
);

/**
 * Above the composer while the conversation is empty; leaves upward when the thread starts. Give it a `title`
 * (and `description`, `icon`, `action`) for the kit's EmptyState, or children for anything else.
 */
export function ConversationEmpty({ title, description, icon, action, headingLevel = 2, className, children, ref, ...props }: ConversationEmptyProps) {
  const { empty } = React.useContext(ConversationContext);
  const presence = usePresence<HTMLDivElement>(empty);
  const Heading = `h${headingLevel}` as const;
  return (
    <div ref={ref} data-slot="conversation-empty" className={cn('relative flex min-h-0 flex-col justify-end', empty ? 'flex-1' : 'flex-none')} {...props}>
      {presence.mounted ? (
        <div
          ref={presence.ref}
          className={cn(
            COLUMN,
            'transition-[opacity,translate,scale,filter] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
            'data-starting-style:-translate-y-3 data-starting-style:opacity-0',
            'data-ending-style:-translate-y-6 data-ending-style:scale-97 data-ending-style:opacity-0 data-ending-style:blur-xs',
            // Leaving, it's out of the flow, so the composer below moves at once.
            presence.leaving && 'absolute inset-x-0 top-0',
            className,
          )}
        >
          {title != null || description != null ? (
            <EmptyState
              icon={icon === undefined ? SPARK : icon}
              title={title != null ? <Heading className="m-0 [font:inherit]">{title}</Heading> : undefined}
              description={description}
              action={action}
              className="h-auto px-0 pt-0 pb-[18px]"
            />
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface ConversationMessagesProps extends MessageScrollerProps {}

/** The thread's messages in a MessageScroller (new turns anchor near the top, replies grow below); it fades in
    when the first message starts the thread. UserMessages anchor; every message is a scroller item. */
export function ConversationMessages({ className, ...props }: ConversationMessagesProps) {
  const { empty } = React.useContext(ConversationContext);
  // The thread fades in when the first message starts it; it has no exit.
  const presence = usePresence<HTMLDivElement>(!empty);
  return (
    <div data-slot="conversation-messages" className={cn('relative flex min-h-0 flex-col', empty ? 'flex-none' : 'flex-1')}>
      {!empty ? (
        <div ref={presence.ref} className="flex min-h-0 flex-1 flex-col transition-opacity duration-200 data-starting-style:opacity-0 motion-reduce:transition-none">
          <MessageScroller className={className} {...props} />
        </div>
      ) : null}
    </div>
  );
}

export interface ConversationComposerProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

/** Docks the composer: centred while empty, at the bottom of the thread after. The same element in both
    states, so it FLIPs from one place to the other. */
export function ConversationComposer({ className, ref, children, ...props }: ConversationComposerProps) {
  const { empty } = React.useContext(ConversationContext);
  const dock = React.useRef<HTMLDivElement | null>(null);
  const before = React.useRef<DOMRect | null>(null);
  const last = React.useRef(empty);
  if (last.current !== empty && !before.current && dock.current) before.current = dock.current.getBoundingClientRect();
  React.useLayoutEffect(() => {
    last.current = empty;
    const from = before.current;
    before.current = null;
    const el = dock.current;
    if (!from || !el || prefersReducedMotion()) return;
    const to = el.getBoundingClientRect();
    animate(
      el,
      { x: [from.left - to.left, 0], y: [from.top - to.top, 0], width: [from.width, to.width] },
      { ...springs.smooth, onComplete: () => ((el.style.width = ''), (el.style.transform = '')) },
    );
  }, [empty]);
  return (
    <div
      ref={(el) => {
        dock.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      data-slot="conversation-composer"
      className={cn(
        'mx-auto box-border w-full shrink-0',
        empty ? 'max-w-(--conversation-width,620px)' : 'max-w-(--message-column-width,780px) px-(--message-gutter,22px) pt-2 pb-3.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface ConversationSuggestionsProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

/** ConversationSuggestion chips under the empty composer; they leave with the empty state. */
export function ConversationSuggestions({ className, ref, children, ...props }: ConversationSuggestionsProps) {
  const { empty } = React.useContext(ConversationContext);
  const presence = usePresence<HTMLDivElement>(empty);
  return (
    <div ref={ref} data-slot="conversation-suggestions" className={cn('relative min-h-0', empty ? 'flex-1' : 'flex-none')} {...props}>
      {presence.mounted ? (
        <div
          ref={presence.ref}
          className={cn(
            COLUMN,
            'mt-3.5 flex flex-wrap justify-center gap-[7px] transition-[opacity,translate] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
            'data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:translate-y-3 data-ending-style:opacity-0',
            presence.leaving && 'absolute inset-x-0 top-0',
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type ConversationSuggestionProps = Omit<ButtonProps, 'variant' | 'size'>;

/** A suggestion chip: the kit's `outline` Button, small and round (it takes `onClick`, `disabled` and the rest). */
export function ConversationSuggestion({ className, ...props }: ConversationSuggestionProps) {
  return <Button variant="outline" size="sm" className={cn('rounded-full font-normal text-muted-foreground', className)} {...props} />;
}

/* ── Messages ── */
/** A message's own root: a scroller item inside a MessageScroller (so it anchors and rises in), else a div. */
function MessageRoot({
  value,
  anchor,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: string; anchor: boolean; ref?: React.Ref<HTMLDivElement> }) {
  const message = <div {...props} />;
  return useInMessageScroller() ? (
    <MessageScrollerItem value={value} anchor={anchor}>
      {message}
    </MessageScrollerItem>
  ) : (
    message
  );
}

export interface ConversationAssistantMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The message's id in the thread (default: a stable generated one). */
  value?: string;
  /** Whether the message starts a turn: it scrolls near the top when it arrives (default `false`; a user message's is `true`). */
  anchor?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

export interface ConversationUserMessageProps extends ConversationAssistantMessageProps {
  /** What was sent with it (a Composer's `onSubmit` attachments): images show as thumbnails, other files as chips. */
  attachments?: ComposerAttachment[];
}

/** The user's turn: a right-aligned bubble, its attachments above it. */
export function ConversationUserMessage({ attachments, anchor = true, className, children, ...props }: ConversationUserMessageProps) {
  const images = attachments?.filter((a) => a.src && (a.kind ?? attachmentKind(a.type, a.name)) === 'image') ?? [];
  const files = attachments?.filter((a) => !images.includes(a)) ?? [];
  return (
    <MessageRoot data-slot="user-message" anchor={anchor} className={cn('my-2.5 flex justify-end', className)} {...props}>
      <div className="grid max-w-[78%] justify-items-end gap-1.5">
        {images.length || files.length ? (
          <div className="flex flex-wrap items-end justify-end gap-1.5">
            {images.map((a) => (
              <img key={a.id} src={a.src} alt={a.name} className="h-[110px] max-w-[210px] rounded-xl border border-border object-cover" />
            ))}
            {files.map((a) => (
              <span key={a.id} className="flex max-w-[210px] min-w-0 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-caption">
                <Icon name="doc" size={14} sw={1.9} className="shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{a.name}</span>
                {a.size != null ? <span className="shrink-0 text-tertiary-foreground">{formatFileSize(a.size)}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
        {children != null && children !== '' ? (
          <div className="rounded-card rounded-br-sm bg-secondary-strong px-[13px] py-[9px] text-detail leading-[1.5] whitespace-pre-wrap">{children}</div>
        ) : null}
      </div>
    </MessageRoot>
  );
}

/** The agent's turn: its work log, its reply. */
export function ConversationAssistantMessage({ anchor = false, className, ...props }: ConversationAssistantMessageProps) {
  return <MessageRoot data-slot="assistant-message" anchor={anchor} className={cn('mt-1 mb-3.5', className)} {...props} />;
}

/* The three typing dots: a soft wave, staggered by .18s. */
const DOT_ANIM = ['animate-[wbPulse_1s_0s_infinite]', 'animate-[wbPulse_1s_0.18s_infinite]', 'animate-[wbPulse_1s_0.36s_infinite]'];

export interface ConversationTypingProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>;
}

/** "Thinking": three dots, until the first token of a reply. ConversationMarkdown shows them while `streaming` has no text yet. */
export function ConversationTyping({ className, ...props }: ConversationTypingProps) {
  return (
    <div data-slot="typing-indicator" role="status" aria-label="Thinking" className={cn('flex gap-[5px] py-1.5', className)} {...props}>
      {DOT_ANIM.map((anim, j) => (
        <span key={j} className={cn('size-1.5 rounded-full bg-tertiary-foreground motion-reduce:animate-none', anim)} />
      ))}
    </div>
  );
}

export interface ConversationMarkdownProps extends Omit<MarkdownViewProps, 'markdown' | 'streaming'> {
  markdown?: string;
  /** The reply is still arriving: the view renders it as it streams, and the typing dots show until the first token. */
  streaming?: boolean;
}

/** The reply body: a MarkdownView (it takes MarkdownView's props, `className` and `ref`), and the typing dots until the first token. */
export function ConversationMarkdown({ markdown = '', streaming, ...props }: ConversationMarkdownProps) {
  return (
    <>
      <MarkdownView markdown={markdown} streaming={streaming} {...props} />
      {streaming && !markdown ? <ConversationTyping /> : null}
    </>
  );
}

/* ── Work log ── */
export interface ConversationWorkLogProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'onToggle'> {
  /** The collapsed row, e.g. "Worked for 1m 4s". */
  summary: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: CollapsibleOptions['onOpenChange'];
  /** ConversationToolCall rows; with none the row is static (no chevron, not a button). */
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}

/** "Worked for Ns" — a UI SDK Collapsible that opens (on a spring) into the tool calls behind the reply. */
export function ConversationWorkLog({ summary, defaultOpen = false, open, onOpenChange, children, className, ref, ...props }: ConversationWorkLogProps) {
  const has = React.Children.count(children) > 0;
  const row = 'flex items-center gap-[5px] text-caption text-tertiary-foreground';
  if (!has) {
    return (
      <div ref={ref} data-slot="work-log" className={cn('mt-0.5 mb-1.5', className)} {...props}>
        <div className={row}>
          <Icon name="clock-dial" size={12.5} sw={2} />
          {summary}
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} data-slot="work-log" className={cn('mt-0.5 mb-1.5', className)} {...props}>
      <Collapsible defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className={cn(row, pressable, 'group/work-log cursor-pointer rounded-sm border-0 bg-transparent p-0 leading-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
          <Icon name="clock-dial" size={12.5} sw={2} />
          {summary}
          <span className="grid transition-[rotate] duration-spring-snappy ease-spring-snappy group-data-open/work-log:rotate-90 motion-reduce:transition-none">
            <Chevron direction="right" size={11} strokeWidth={2.4} />
          </span>
        </CollapsibleTrigger>
        <CollapsiblePanel className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-spring-smooth ease-spring-smooth data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 motion-reduce:transition-none">
          <div className="mt-1.5 mb-1 ml-[5px] grid gap-1.5 border-l border-border pl-3">{children}</div>
        </CollapsiblePanel>
      </Collapsible>
    </div>
  );
}

export interface ConversationToolCallProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: IconName | (string & {});
  /** What the agent did. */
  title: React.ReactNode;
  /** Secondary text: a URL, a path, a count. */
  description?: React.ReactNode;
  /** A command or snippet, shown in a mono well. */
  code?: string;
  status?: 'done' | 'running' | 'error';
  ref?: React.Ref<HTMLDivElement>;
}

/** One step in a ConversationWorkLog. */
export function ConversationToolCall({ icon = 'checkmark', title, description, code, status = 'done', className, ref, ...props }: ConversationToolCallProps) {
  return (
    <div ref={ref} data-slot="tool-call" data-status={status} className={cn('grid gap-1 text-caption text-muted-foreground', className)} {...props}>
      <div className="flex min-w-0 items-center gap-2">
        {status === 'running' ? (
          <span role="img" aria-label="Running" className="grid size-[13px] shrink-0 place-items-center">
            <span className="size-[7px] animate-[wbPulse_1.2s_infinite] rounded-full bg-primary motion-reduce:animate-none" />
          </span>
        ) : status === 'error' ? (
          <Icon name="xmark-large" size={13} sw={2} aria-label="Failed" className="text-destructive" />
        ) : (
          <Icon name={icon} size={13} sw={2} className="text-tertiary-foreground" />
        )}
        <span className="min-w-0 truncate">{title}</span>
        {description != null ? <span className="min-w-0 truncate text-caption2 text-tertiary-foreground">{description}</span> : null}
      </div>
      {code ? <pre className="wb-scroll m-0 overflow-x-auto rounded-lg bg-muted px-2.5 py-2 font-mono text-caption2 leading-[1.55] text-muted-foreground">{code}</pre> : null}
    </div>
  );
}
