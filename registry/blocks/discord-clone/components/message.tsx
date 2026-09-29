import { createContext, useContext, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Button, ToggleButton, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChatAvatar } from './chat-avatar';
import { RichText } from './rich-text';
import type { ChatUser } from './chat-users';
import { Haptics, cn } from '@brett_lamy/ui';

/* ══ Message — one row of a transcript, from parts ══
   <Message user={ada}>
     <MessageAvatar />
     <MessageBody>
       <MessageHeader><MessageAuthor /><MessageTimestamp>9:12 AM</MessageTimestamp></MessageHeader>
       <MessageContent>Morning @noor!</MessageContent>
       <MessageReactions><MessageReaction emoji="🎉" count={2} /></MessageReactions>
       <ThreadPreview … />
     </MessageBody>
     <MessageActions><MessageAction label="Add 👍">👍</MessageAction></MessageActions>
   </Message>
   The row provides its author to the parts, so MessageAvatar / MessageAuthor need no props. */

interface MessageContextValue {
  user?: ChatUser;
  variant: 'default' | 'continued';
}
const MessageContext = createContext<MessageContextValue>({ variant: 'default' });

/** react-aria's Button drops `title`, so the tooltip goes on through a ref. */
const titleRef = (title: string) => (el: HTMLElement | null) => {
  if (el) el.title = title;
};

export const messageVariants = cva(
  'group/message relative flex gap-[11px] px-[18px] font-ios [&:hover]:bg-accent',
  {
    variants: {
      variant: {
        default: 'py-[7px]',
        /** a follow-up from the same author: no avatar or header, tighter rows */
        continued: 'py-[2px]',
      },
      /** rise into place (new messages) */
      appear: {
        true: 'animate-[ck-in_var(--duration-spring-smooth)_var(--ease-spring-smooth)_both] motion-reduce:animate-none',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', appear: false },
  },
);

export interface MessageProps extends ComponentProps<'div'>, VariantProps<typeof messageVariants> {
  /** the author, read by MessageAvatar and MessageAuthor */
  user?: ChatUser;
}

export function Message({ user, variant, appear, className, style, ...props }: MessageProps) {
  return (
    <MessageContext.Provider value={{ user, variant: variant ?? 'default' }}>
      <div
        data-slot="message"
        data-variant={variant ?? 'default'}
        className={cn(messageVariants({ variant, appear }), className)}
        style={{ '--ck-role': user?.role, ...style } as CSSProperties}
        {...props}
      />
    </MessageContext.Provider>
  );
}

export interface MessageAvatarProps {
  user?: ChatUser;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** The author's avatar (bots get a rounded square). In a continued row it keeps the gutter empty. */
export function MessageAvatar({ user: userProp, size = 36, className, style }: MessageAvatarProps) {
  const { user: ctxUser, variant } = useContext(MessageContext);
  const user = userProp ?? ctxUser;
  if (variant === 'continued' || !user) {
    return <span data-slot="message-avatar" aria-hidden className={cn('shrink-0', className)} style={{ width: size, ...style }} />;
  }
  return <ChatAvatar user={user} size={size} square={user.bot} className={className} style={style} />;
}

export function MessageBody({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-body" className={cn('min-w-0 flex-1', className)} {...props} />;
}

export function MessageHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-header" className={cn('flex items-baseline gap-[7px]', className)} {...props} />;
}

/** The author's name in their role color; defaults to the row's user. */
export function MessageAuthor({ className, children, ...props }: ComponentProps<'span'>) {
  const { user } = useContext(MessageContext);
  return (
    <span data-slot="message-author" className={cn('ck-role text-[13.5px] font-bold text-(--ck-role)', className)} {...props}>
      {children ?? user?.name}
    </span>
  );
}

/** A small tag after the name ("APP", "BOT", "MOD"). */
export function MessageBadge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="message-badge"
      className={cn('rounded-[4px] bg-primary px-[5px] py-px text-[9px] font-extrabold tracking-[.4px] text-white', className)}
      {...props}
    />
  );
}

export function MessageTimestamp({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="message-timestamp" className={cn('text-[10.5px] text-tertiary-foreground', className)} {...props} />;
}

/** The message text. A string child is rendered as RichText (so @mentions become chips). */
export function MessageContent({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="message-content" className={cn('mt-px text-[13.5px] leading-[1.55] wrap-break-word text-foreground', className)} {...props}>
      {typeof children === 'string' ? <RichText text={children} /> : children}
    </div>
  );
}

export function MessageReactions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-reactions" className={cn('mt-[6px] flex flex-wrap gap-[5px]', className)} {...props} />;
}

/** A reaction pill; your own reaction is tinted. */
export const messageReactionVariants = cva(
  'inline-flex cursor-pointer items-center gap-[5px] rounded-[999px] border px-[8px] py-[2px] font-ios text-[12px] text-foreground',
  {
    variants: {
      mine: { true: 'border-primary bg-primary/10 dark:bg-primary/14', false: 'border-border bg-secondary' },
    },
    defaultVariants: { mine: false },
  },
);

export interface MessageReactionProps extends Omit<ComponentProps<typeof ToggleButton>, 'children' | 'isSelected'> {
  emoji: ReactNode;
  count: number;
  /** your own reaction: tinted outline */
  mine?: boolean;
}

/** A reaction pill; a toggle (react-aria ToggleButton) that is on when it's yours. */
export function MessageReaction({ emoji, count, mine, className, onChange, ...props }: MessageReactionProps) {
  return (
    <ToggleButton
      data-slot="message-reaction"
      isSelected={!!mine}
      onChange={(v) => {
        Haptics.impact('light');
        onChange?.(v);
      }}
      className={composeRenderProps(className, (c) =>
        cn(messageReactionVariants({ mine: !!mine }), c),
      )}
      {...props}
    >
      {emoji}
      <span className={cn('text-[11px]', mine ? 'text-link' : 'text-muted-foreground')}>{count}</span>
    </ToggleButton>
  );
}

/** The floating action bar on the row's top-right corner: shown on hover and on keyboard focus. */
export function MessageActions({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="message-actions"
      className={cn(
        'absolute -top-[10px] right-[16px] flex gap-[2px] rounded-[9px] border border-border bg-card p-[2px] opacity-0 [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-hover/message:opacity-100 has-data-focus-visible:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

export interface MessageActionProps extends ComponentProps<typeof Button> {
  /** accessible name and tooltip */
  label: string;
}

export function MessageAction({ label, className, onPress, ...props }: MessageActionProps) {
  return (
    <Button
      data-slot="message-action"
      aria-label={label}
      ref={titleRef(label)}
      onPress={(e) => {
        Haptics.impact('light');
        onPress?.(e);
      }}
      className={composeRenderProps(className, (c) =>
        cn('grid cursor-pointer place-items-center rounded-[7px] border-0 bg-transparent px-[6px] py-[3px] text-[13px] text-muted-foreground data-hovered:bg-secondary', c),
      )}
      {...props}
    />
  );
}
