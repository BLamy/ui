import { useLayoutEffect, useRef, type ComponentProps, type ReactNode, type Ref } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ Transcript parts ══
   <MessageList scrollKey={channelId}>
     <ChannelIntro title="Welcome to #dev">…</ChannelIntro>
     <DateDivider>August 12, 2026</DateDivider>
     <Message …/> …
     <TypingIndicator>Stitch is typing…</TypingIndicator>
   </MessageList> */

export interface MessageListProps extends ComponentProps<'div'> {
  /** keep the list pinned to the newest message while the reader is at the bottom (default true) */
  autoScroll?: boolean;
  /** changing it (switching channels) snaps back to the bottom */
  scrollKey?: string | number;
}

/** The scrolling transcript (a `log` region). Pinned to the bottom until the reader scrolls up. */
export function MessageList({ autoScroll = true, scrollKey, className, onScroll, ref, ...props }: MessageListProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const key = useRef(scrollKey);
  useLayoutEffect(() => {
    if (key.current !== scrollKey) {
      key.current = scrollKey;
      stick.current = true;
    }
    if (autoScroll && stick.current && el.current) el.current.scrollTop = el.current.scrollHeight;
  });
  return (
    <div
      ref={(node) => {
        el.current = node;
        setRef(ref, node);
      }}
      data-slot="message-list"
      role="log"
      aria-live="polite"
      onScroll={(e) => {
        const t = e.currentTarget;
        stick.current = t.scrollHeight - t.scrollTop - t.clientHeight < 48;
        onScroll?.(e);
      }}
      className={cn('ck-scroll relative min-h-0 flex-1 overflow-y-auto py-3', className)}
      {...props}
    />
  );
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/** Consecutive messages from one author (the first a full Message, the rest `variant="continued"`). The rows
 *  sit on an even 2px rhythm inside the group's padding. */
export function MessageGroup({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-group" role="group" className={cn('py-[5px] [&>[data-slot=message]]:py-[2px]', className)} {...props} />;
}

export interface ChannelIntroProps extends Omit<ComponentProps<'div'>, 'title'> {
  title: ReactNode;
  /** the tile glyph; a # by default */
  icon?: ReactNode;
}

/** "Welcome to #channel" at the top of a transcript. */
export function ChannelIntro({ title, icon, className, children, ...props }: ChannelIntroProps) {
  return (
    <div data-slot="channel-intro" className={cn('px-[18px] pb-2.5', className)} {...props}>
      <div className="mb-2 grid size-10 place-items-center rounded-panel bg-secondary-strong text-muted-foreground">
        {icon ?? <Icon name="number" size={20} sw={2.2} />}
      </div>
      <div className="text-[15.5px] font-[750]">{title}</div>
      {children != null && <div className="mt-0.5 text-caption text-tertiary-foreground">{children}</div>}
    </div>
  );
}

export const messageDividerVariants = cva('flex items-center gap-2 px-[18px] text-[10.5px] text-tertiary-foreground', {
  variants: {
    variant: {
      /** a day boundary */
      date: 'pt-1 pb-2 font-semibold',
      /** a quieter rule ("3 replies", "New") */
      subtle: 'py-1.5',
    },
  },
  defaultVariants: { variant: 'subtle' },
});

export interface MessageDividerProps extends ComponentProps<'div'>, VariantProps<typeof messageDividerVariants> {}

/** A labelled rule across the transcript. */
export function MessageDivider({ variant, className, children, ...props }: MessageDividerProps) {
  return (
    <div data-slot="message-divider" className={cn(messageDividerVariants({ variant }), className)} {...props}>
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** `MessageDivider variant="date"`. */
export function DateDivider(props: Omit<MessageDividerProps, 'variant'>) {
  return <MessageDivider variant="date" {...props} />;
}

/** Placeholder text for an empty transcript or thread. */
export function MessageListEmpty({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-list-empty" className={cn('px-[18px] py-3.5 text-[12.5px] text-tertiary-foreground', className)} {...props} />;
}

/** "Stitch is typing…" with three dots taking turns. */
export function TypingIndicator({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="typing-indicator"
      role="status"
      className={cn(
        'flex items-center gap-[8px] px-[18px] py-1.5 text-[11.5px] text-muted-foreground animate-[ck-in_var(--duration-spring-smooth)_var(--ease-spring-smooth)_both] motion-reduce:animate-none',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="flex items-center gap-[3px] rounded-full bg-secondary px-[7px] py-[5px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-[5px] rounded-full bg-current animate-[ck-typing_1.2s_ease-in-out_infinite] motion-reduce:animate-none"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </span>
      <span>{children}</span>
    </div>
  );
}
