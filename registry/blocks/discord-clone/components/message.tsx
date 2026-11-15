import { createContext, useContext, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Avatar } from '@/components/ui/avatar';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { MarkdownView } from '@/components/ui/markdown-view';
import { Toolbar, ToolbarButton } from '@/components/ui/toolbar';
import { chatUserAvatar, useChatUsers, type ChatUser } from './chat-users';
import { UserCard } from './user-card';
import { cn, cx } from '@/lib/utils';

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
   The row provides its author to the parts, so MessageAvatar / MessageAuthor need no props. Message text is Markdown.
   The avatar, the author's name and every @mention show that user's profile (UserCard) as a hover card. */

interface MessageContextValue {
  user?: ChatUser;
  variant: 'default' | 'continued';
}
const MessageContext = createContext<MessageContextValue>({ variant: 'default' });

export const messageVariants = cva(
  'group/message relative flex gap-[11px] px-[18px] font-sans [&:hover]:bg-accent',
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
  return <Avatar {...chatUserAvatar(user, size)} card={<UserCard user={user} />} className={className} style={style} />;
}

export function MessageBody({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-body" className={cn('min-w-0 flex-1', className)} {...props} />;
}

export function MessageHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-header" className={cn('flex items-baseline gap-[7px]', className)} {...props} />;
}

/* A card's trigger in running text: a button that reads like the words around it. */
const inlineTrigger = 'cursor-default border-0 bg-transparent p-0 align-baseline [font-family:inherit] text-[length:inherit] leading-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/45';

/** The author's name in their role color; defaults to the row's user. */
export function MessageAuthor({ className, children, ...props }: ComponentProps<'span'>) {
  const { user } = useContext(MessageContext);
  const authorClass = cn('ck-role text-[13.5px] font-bold text-(--ck-role)', user && 'cursor-default hover:underline', className);
  if (!user) {
    return (
      <span data-slot="message-author" className={authorClass} {...props}>
        {children}
      </span>
    );
  }
  return (
    <HoverCard>
      {/* A button, so a keyboard reaches the card too (focus opens it, like a hover). */}
      <HoverCardTrigger render={<button type="button" className={cn(inlineTrigger, authorClass)} {...(props as ComponentProps<'button'>)} />}>{children ?? user.name}</HoverCardTrigger>
      <HoverCardContent side="end" align="start" sideOffset={10}>
        <UserCard user={user} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** A small tag after the name ("APP", "BOT", "MOD"). */
export function MessageBadge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="message-badge"
      className={cn('rounded-sm bg-primary px-[5px] py-px text-[9px] font-extrabold tracking-[.4px] text-white', className)}
      {...props}
    />
  );
}

export function MessageTimestamp({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="message-timestamp" className={cn('text-[10.5px] text-tertiary-foreground', className)} {...props} />;
}

/** The message text: Markdown, rendered by Docstream (a string child). `@id` mentions become chips for the chat's
 *  users; anything else you pass renders as given. */
export function MessageContent({ className, children, ...props }: ComponentProps<'div'>) {
  const users = useChatUsers();
  return (
    <div data-slot="message-content" className={cn('mt-px text-[13.5px] leading-[1.55] wrap-break-word text-foreground', className)} {...props}>
      {typeof children === 'string' ? (
        <MarkdownView
          markdown={children}
          renderReference={(ref) => {
            const user = ref.kind === 'mention' ? users[ref.id] : undefined;
            return user ? (
              <HoverCard>
                <HoverCardTrigger
                  render={<button type="button" className={cn(inlineTrigger, 'rounded-sm bg-primary/12 dark:bg-primary/16 px-[3px] py-0 font-semibold text-link hover:bg-primary/20')} />}
                >
                  @{user.name}
                </HoverCardTrigger>
                <HoverCardContent side="top" align="start">
                  <UserCard user={user} />
                </HoverCardContent>
              </HoverCard>
            ) : null;
          }}
        />
      ) : (
        children
      )}
    </div>
  );
}

export function MessageReactions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="message-reactions" className={cn('mt-[6px] flex flex-wrap gap-[5px]', className)} {...props} />;
}

/** A reaction pill; your own reaction is tinted. */
export const messageReactionVariants = cva(
  'inline-flex cursor-pointer items-center gap-[5px] rounded-[999px] border px-[8px] py-[2px] font-sans text-caption text-foreground',
  {
    variants: {
      mine: { true: 'border-primary bg-primary/10 dark:bg-primary/14', false: 'border-border bg-secondary' },
    },
    defaultVariants: { mine: false },
  },
);

export interface MessageReactionProps extends Omit<ComponentProps<typeof SdkToggle>, 'children' | 'pressed' | 'defaultPressed'> {
  emoji: ReactNode;
  count: number;
  /** your own reaction: tinted outline, and the toggle is on */
  mine?: boolean;
}

/** A reaction pill; a toggle (UI SDK Toggle, `aria-pressed`) that is on when it's yours. Toggle it with
    `onPressedChange(pressed, details)`. */
export function MessageReaction({ emoji, count, mine, className, ...props }: MessageReactionProps) {
  return (
    <SdkToggle pressed={!!mine} className={cx(messageReactionVariants({ mine: !!mine }), className)} {...props}>
      {emoji}
      <span className={cn('text-caption2', mine ? 'text-link' : 'text-muted-foreground')}>{count}</span>
    </SdkToggle>
  );
}

/** The floating action bar on the row's top-right corner: shown on hover and on keyboard focus. A UI SDK Toolbar
    ("Message actions" unless named otherwise): one Tab stop per message, the arrow keys move between its actions. */
export function MessageActions({ className, ...props }: ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      variant="floating"
      size="sm"
      aria-label="Message actions"
      className={cx(
        'absolute -top-[10px] right-[16px] gap-0.5 rounded-panel bg-card p-0.5 opacity-0 shadow-hairline [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-hover/message:opacity-100 has-focus-visible:opacity-100',
        className,
      )}
      {...props}
    />
  );
}

export type MessageActionProps = ComponentProps<typeof ToolbarButton> & {
  /** accessible name and tooltip */
  label: string;
};

export function MessageAction({ label, className, ...props }: MessageActionProps) {
  return (
    <ToolbarButton
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cx('h-6 w-auto rounded-md px-1.5 text-footnote', className)}
      {...props}
    />
  );
}
