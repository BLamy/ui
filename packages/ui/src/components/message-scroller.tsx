'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import { createParts } from '@ui-sdk/react/primitive';
import { cn, pressable } from '@/lib/utils';
import { Chevron } from '@/lib/icon';
import { pressableFocusRing } from '@/lib/primitives';
import { messageScroller } from '@/lib/message-scroller-primitive';

/* ══ MessageScroller — a chat transcript that anchors turns and follows the live edge ══
   <MessageScroller threadKey={thread.id} streaming={busy} aria-label="Thread">
     <MessageScrollerItem value="u1" anchor>…the user's turn…</MessageScrollerItem>
     <MessageScrollerItem value="a1">…the reply…</MessageScrollerItem>
   </MessageScroller>

   New turns (anchor items) scroll near the top with a peek of the one before, the reply grows below without moving
   the view, the scroller follows the live edge only while the reader is there (UI SDK's createStickToBottom) and
   lets go on scroll intent; a jump pill brings the reader back (and says when a reply is streaming); a thread opens
   at its last anchor. Items can sit anywhere under the scroller (ConversationUserMessage and ConversationAssistantMessage are items), so a
   wrapped message still anchors. The behavior is `lib/message-scroller-primitive.ts`.
   The column is `--message-column-width` wide (780px) with `--message-gutter` (22px) at its sides: set them on the
   scroller (or any ancestor) to fit it to a narrower or wider host. */

interface ScrollerContextValue {
  /** The open thread has committed once: items that mount after that are arriving (they rise in). */
  opened: React.RefObject<boolean>;
}
const ScrollerContext = React.createContext<ScrollerContextValue | null>(null);

/** Whether an element is inside a MessageScroller (ConversationUserMessage / ConversationAssistantMessage render as items there). */
export function useInMessageScroller(): boolean {
  return React.useContext(ScrollerContext) !== null;
}

export interface MessageScrollerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Identifies the thread; switching it re-opens the scroller at the last anchor. */
  threadKey?: string | null;
  /** A reply is streaming: the log is `aria-busy` and the jump pill says so while the reader is away. */
  streaming?: boolean;
  /** Pixels of the previous turn left showing above a new anchor (default 52). */
  peek?: number;
  /** The scroll region's name (default "Messages"): name each one when a page shows two transcripts. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** MessageScrollerItems (or parts that render one, such as ConversationUserMessage and ConversationAssistantMessage). */
  children?: React.ReactNode;
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;
}

const parts = createParts(messageScroller, {
  root: 'div',
  viewport: 'div',
  content: 'div',
  item: 'div',
  spacer: 'div',
  jump: 'div',
  'jump-button': 'button',
});

/** The ids and anchors of the items in a log, in document order (items of a nested scroller excluded). */
function readItems(log: HTMLElement | null) {
  const ids: string[] = [];
  const anchors: string[] = [];
  log?.querySelectorAll<HTMLElement>('[data-mid]').forEach((el) => {
    if (el.parentElement?.closest('[role="log"]') !== log) return;
    const id = el.getAttribute('data-mid') ?? '';
    ids.push(id);
    if (el.hasAttribute('data-anchor')) anchors.push(id);
  });
  return { ids, anchors };
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

interface ItemOrder {
  ids: string[];
  anchors: string[];
  thread: string | null | undefined;
}
/** Before the first read: a thread no caller uses, so the first real one opens like a new thread. */
const UNREAD = '\u0000unread';
const UNREAD_ORDER: ItemOrder = { ids: [], anchors: [], thread: UNREAD };

export function MessageScroller({
  threadKey,
  streaming,
  peek,
  'aria-label': ariaLabel = 'Messages',
  'aria-labelledby': ariaLabelledBy,
  className,
  style,
  children,
  ref,
  ...props
}: MessageScrollerProps) {
  const log = useRef<HTMLDivElement | null>(null);
  // The items are read from the log after each commit (before paint), so any element can be (or render) an item.
  // The primitive hears a thread only together with its items: a new thread opens at its last anchor at once,
  // rather than seeing its turns arrive one commit later.
  const [order, setOrder] = useState<ItemOrder>(UNREAD_ORDER);
  React.useLayoutEffect(() => {
    const next = readItems(log.current);
    setOrder((prev) =>
      prev !== UNREAD_ORDER && prev.thread === threadKey && same(prev.ids, next.ids) && same(prev.anchors, next.anchors)
        ? prev
        : { ...next, thread: threadKey },
    );
  });
  // Items that mount after the thread has first committed rise in; the ones it opened with are just there.
  const opened = useRef(false);
  const thread = useRef(threadKey);
  if (thread.current !== threadKey) {
    thread.current = threadKey;
    opened.current = false;
  }
  React.useLayoutEffect(() => {
    opened.current = true;
  });
  const ctx = React.useMemo(() => ({ opened }), []);
  return (
    <ScrollerContext.Provider value={ctx}>
      <parts.Root
        ref={ref}
        ids={order.ids}
        anchors={order.anchors}
        threadKey={order === UNREAD_ORDER ? UNREAD : order.thread}
        streaming={!!streaming}
        peek={peek}
        className={cn('relative min-h-0 flex-1', className)}
        style={style}
        {...props}
      >
        <parts.Viewport
          aria-label={ariaLabelledBy ? undefined : ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="wb-scroll absolute inset-0 flex flex-col overflow-y-auto overscroll-contain outline-none"
        >
          <parts.Content
            ref={log}
            className={cn(
              'mx-auto box-border w-full max-w-(--message-column-width,780px) shrink-0 px-(--message-gutter,22px) pt-4 pb-1',
              // Peeking, a short thread sits on the bottom edge (the part that shows), not at the top.
              'data-resting:mt-auto',
            )}
          >
            {children}
            <parts.Spacer />
          </parts.Content>
        </parts.Viewport>
        {/* The jump pill rises in when the reader is away from the latest, and widens to say a reply is streaming. */}
        <parts.Jump className="absolute bottom-3 left-1/2 z-2 -translate-x-1/2 transition-[opacity,translate,scale] duration-spring-snappy ease-spring-snappy data-closed:pointer-events-none data-closed:translate-y-3.5 data-closed:scale-85 data-closed:opacity-0 motion-reduce:transition-none">
          <parts.JumpButton
            className={cn(
              pressable,
              pressableFocusRing,
              'group/jump flex cursor-pointer items-center overflow-hidden rounded-full border border-border bg-card p-[7px] text-caption font-semibold text-foreground shadow-popover',
            )}
          >
            <span aria-hidden="true" className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-spring-snappy ease-spring-snappy group-data-streaming/jump:grid-cols-[1fr] group-data-streaming/jump:opacity-100 motion-reduce:transition-none">
              <span className="flex min-w-0 items-center gap-[7px] overflow-hidden whitespace-nowrap">
                <span className="ml-1.5 size-[7px] shrink-0 animate-[wbPulse_1.1s_infinite] rounded-full bg-primary motion-reduce:animate-none" />
                <span className="pr-[7px]">Streaming</span>
              </span>
            </span>
            <Chevron direction="down" size={15} strokeWidth={2.2} />
          </parts.JumpButton>
        </parts.Jump>
      </parts.Root>
    </ScrollerContext.Provider>
  );
}

export interface MessageScrollerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The item's id, unique in the thread (default: a stable generated one). */
  value?: string;
  /** The item starts a turn (a user's message): it scrolls near the top when it arrives. */
  anchor?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/** One message (or any block) in a MessageScroller. A new one rises into place: an anchor up from the composer, a
    reply under it. */
export function MessageScrollerItem({ value, anchor = false, className, children, ref, ...props }: MessageScrollerItemProps) {
  const scroller = React.useContext(ScrollerContext);
  const generated = React.useId();
  // Read once, as the item mounts: it arrives if the thread was already open.
  const [arriving] = useState(() => !!scroller?.opened.current);
  return (
    <parts.Item
      ref={ref}
      value={value ?? generated}
      anchor={anchor}
      arriving={arriving}
      className={cn('[contain-intrinsic-size:auto_48px] [content-visibility:auto]', className)}
      {...props}
    >
      <div
        className={cn(
          'transition-[opacity,translate,scale] duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 motion-reduce:transition-none',
          anchor
            ? 'origin-bottom-right data-starting-style:translate-y-[18px] data-starting-style:scale-98'
            : 'origin-top-left data-starting-style:translate-y-2.5',
        )}
      >
        {children}
      </div>
    </parts.Item>
  );
}
