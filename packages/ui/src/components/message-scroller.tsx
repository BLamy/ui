'use client';
import * as React from 'react';
import { useRef } from 'react';
import { createParts } from '@ui-sdk/react/primitive';
import { cn, pressable } from '@/lib/utils';
import { Icon } from '@/lib/icon';
import { messageScroller } from '@/lib/message-scroller-primitive';

/* ══ MessageScroller — shadcn message-scroller semantics ══
   Anchors new turns near the top (peek of the previous item), follows the live edge only while the
   reader is there (UI SDK's createStickToBottom), releases on scroll intent, jump-to-latest button,
   opens threads at last anchor. The behavior is `lib/message-scroller-primitive.ts`. */
export interface MessageScrollerItem {
  id: string;
  anchor?: boolean;
  node: React.ReactNode;
}
export interface MessageScrollerProps {
  items: MessageScrollerItem[];
  streaming?: boolean;
  threadKey?: string | null;
  peek?: number;
  className?: string;
  style?: React.CSSProperties;
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

export function MessageScroller({ items, streaming, threadKey, peek, className, style }: MessageScrollerProps) {
  // Messages that arrive while the thread is open rise in; the ones it opened with are just there.
  const known = useRef<{ thread: string | null | undefined; ids: Set<string> }>({ thread: undefined, ids: new Set() });
  if (known.current.thread !== threadKey) known.current = { thread: threadKey, ids: new Set(items.map((i) => i.id)) };
  const seen = known.current.ids;
  React.useEffect(() => {
    for (const i of items) seen.add(i.id);
  }, [items, seen]);
  const ids = items.map((i) => i.id);
  const anchors = items.filter((i) => i.anchor).map((i) => i.id);
  return (
    <parts.Root
      ids={ids}
      anchors={anchors}
      threadKey={threadKey}
      streaming={!!streaming}
      peek={peek}
      className={cn('relative min-h-0 flex-1', className)}
      style={style}
    >
      <parts.Viewport className="wb-scroll absolute inset-0 flex flex-col overflow-y-auto overscroll-contain outline-none">
        <parts.Content
          className={cn(
            'mx-auto box-border w-full max-w-[780px] shrink-0 px-[22px] pt-4 pb-1',
            // Peeking, a short thread sits on the bottom edge (the part that shows), not at the top.
            'data-resting:mt-auto',
          )}
        >
          {items.map((it) => (
            <parts.Item
              key={it.id}
              value={it.id}
              anchor={!!it.anchor}
              arriving={!seen.has(it.id)}
              className="[contain-intrinsic-size:auto_48px] [content-visibility:auto]"
            >
              {/* A new turn rises into place (a sent message up from the composer, a reply under it). */}
              <div
                className={cn(
                  'transition-[opacity,translate,scale] duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 motion-reduce:transition-none',
                  it.anchor
                    ? 'origin-bottom-right data-starting-style:translate-y-[18px] data-starting-style:scale-98'
                    : 'origin-top-left data-starting-style:translate-y-2.5',
                )}
              >
                {it.node}
              </div>
            </parts.Item>
          ))}
          <parts.Spacer />
        </parts.Content>
      </parts.Viewport>
      {/* The jump pill rises in when the reader is away from the latest, and widens to say a reply is streaming. */}
      <parts.Jump className="absolute bottom-3 left-1/2 z-2 -translate-x-1/2 transition-[opacity,translate,scale] duration-spring-snappy ease-spring-snappy data-closed:pointer-events-none data-closed:translate-y-3.5 data-closed:scale-85 data-closed:opacity-0 motion-reduce:transition-none">
        <parts.JumpButton
          className={cn(
            pressable,
            'group/jump flex cursor-pointer items-center overflow-hidden rounded-[99px] border border-border bg-card p-[7px] text-[12.5px] font-semibold text-foreground shadow-[0_4px_16px_black] shadow-black/8 dark:shadow-black/35',
          )}
        >
          <span className="grid grid-cols-[0fr] opacity-0 transition-[grid-template-columns,opacity] duration-spring-snappy ease-spring-snappy group-data-streaming/jump:grid-cols-[1fr] group-data-streaming/jump:opacity-100 motion-reduce:transition-none">
            <span className="flex min-w-0 items-center gap-[7px] overflow-hidden whitespace-nowrap">
              <span className="ml-1.5 size-[7px] shrink-0 animate-[wbPulse_1.1s_infinite] rounded-[50%] bg-primary motion-reduce:animate-none" />
              <span className="pr-[7px]">Streaming</span>
            </span>
          </span>
          <Icon name="chevron-down-wide" size={15} sw={2.2} />
        </parts.JumpButton>
      </parts.Jump>
    </parts.Root>
  );
}
