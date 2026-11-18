import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Button as SdkButton } from '@brett_lamy/ui/sdk/react/button';
import { Icon } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import { useOptionalChatShell } from './chat-shell-context';
import { cva } from 'class-variance-authority';

/* ══ Channel navigation ══
   <ChannelList value onValueChange>
     <ChannelGroup label="Team">
       <ChannelItem value="general">general</ChannelItem>
       <ChannelItem value="dev" unread mentions={2}>dev</ChannelItem>
       <ChannelThreadItem onClick={…}>Repo connect spawning…</ChannelThreadItem>
   Picking a channel (or a thread row) inside a compact ChatShell also closes its navigation drawer. */

interface ChannelListContextValue {
  value?: string | null;
  onValueChange?: (value: string) => void;
}
const ChannelListContext = createContext<ChannelListContextValue>({});

export interface ChannelListProps extends Omit<ComponentProps<'nav'>, 'onChange'> {
  /** the current channel (its ChannelItem's `value`) */
  value?: string | null;
  /** a ChannelItem was picked */
  onValueChange?: (value: string) => void;
}

/** The scrolling channel list: a navigation landmark whose current row carries `aria-current="page"`. Owns the
    value its ChannelItems read. */
export function ChannelList({ value, onValueChange, className, children, ...props }: ChannelListProps) {
  return (
    <ChannelListContext.Provider value={{ value, onValueChange }}>
      <nav
        data-slot="channel-list"
        aria-label="Channels"
        className={cn('ck-scroll min-h-0 flex-1 overflow-y-auto px-[8px] py-[6px]', className)}
        {...props}
      >
        {children}
      </nav>
    </ChannelListContext.Provider>
  );
}

export interface ChannelGroupProps extends ComponentProps<'div'> {
  label: ReactNode;
}

/** A labelled section of channels ("Team", "Direct messages"). */
export function ChannelGroup({ label, className, children, ...props }: ChannelGroupProps) {
  return (
    <div data-slot="channel-group" role="group" aria-label={typeof label === 'string' ? label : undefined} className={className} {...props}>
      <div className="px-[8px] pt-[11px] pb-[4px] text-[10px] font-bold tracking-[.7px] text-tertiary-foreground uppercase">{label}</div>
      {children}
    </div>
  );
}

function MentionPill({ n }: { n: number }) {
  return (
    <span
      data-slot="channel-item-mentions"
      className="box-border flex h-[16px] min-w-[16px] shrink-0 items-center justify-center rounded-full bg-destructive px-[4px] text-[10px] leading-none font-bold text-white"
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

/** A channel row: the selected one on the stronger fill; selected or unread rows bold. */
export const channelItemVariants = cva(
  'flex w-full cursor-pointer items-center gap-[7px] rounded-lg border-0 px-[8px] py-[5px] text-left font-sans text-[13.5px] [transition:background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:transition-none',
  {
    variants: {
      current: { true: 'bg-secondary-strong', false: 'bg-transparent hover:bg-accent' },
      emphasized: { true: 'font-[650] text-foreground', false: 'font-normal text-muted-foreground' },
    },
    defaultVariants: { current: false, emphasized: false },
  },
);

/** An indented thread row under its channel. */
export const channelThreadItemVariants = cva(
  'flex w-full cursor-pointer items-center gap-[6px] rounded-[7px] border-0 py-[3px] pr-[8px] pl-[24px] text-left font-sans text-caption',
  {
    variants: {
      current: { true: 'bg-secondary font-semibold text-foreground', false: 'bg-transparent text-tertiary-foreground hover:text-muted-foreground' },
    },
    defaultVariants: { current: false },
  },
);

export interface ChannelItemProps extends Omit<ComponentProps<typeof SdkButton>, 'value' | 'children'> {
  /** the channel this row opens; the list's `value` when it is current */
  value: string;
  children?: ReactNode;
  /** leading glyph; a # by default (pass an Avatar for a DM) */
  icon?: ReactNode;
  /** new activity: bold label and a tint dot (hidden while selected) */
  unread?: boolean;
  /** mention count: a red pill (replaces the dot) */
  mentions?: number;
  /** overrides the list's value: whether this row is the current one */
  current?: boolean;
}

export function ChannelItem({ value, icon, unread, mentions, current, className, children, onClick, ...props }: ChannelItemProps) {
  const list = useContext(ChannelListContext);
  const shell = useOptionalChatShell();
  const on = current ?? list.value === value;
  return (
    <SdkButton
      data-unread={unread || undefined}
      aria-current={on ? 'page' : undefined}
      onClick={(e, details) => {
        onClick?.(e, details);
        if (e.defaultPrevented) return;
        list.onValueChange?.(value);
        shell?.setNavOpen(false);
      }}
      className={cx(channelItemVariants({ current: on, emphasized: on || !!unread }), className)}
      {...props}
    >
      <span className="grid text-tertiary-foreground">{icon ?? <Icon name="number" size={13} sw={2} />}</span>
      <span className="flex-1 truncate">{children}</span>
      {mentions ? <MentionPill n={mentions} /> : unread && !on && <span className="size-[7px] rounded-[50%] bg-primary" />}
    </SdkButton>
  );
}

export interface ChannelThreadItemProps extends Omit<ComponentProps<typeof SdkButton>, 'children'> {
  children?: ReactNode;
  /** the thread is open (full view) */
  current?: boolean;
}

/** An indented thread row under its channel, with an elbow connector. */
export function ChannelThreadItem({ current, className, children, onClick, ...props }: ChannelThreadItemProps) {
  const shell = useOptionalChatShell();
  return (
    <SdkButton
      aria-current={current ? 'page' : undefined}
      onClick={(e, details) => {
        onClick?.(e, details);
        if (!e.defaultPrevented) shell?.setNavOpen(false);
      }}
      className={cx(channelThreadItemVariants({ current: !!current }), className)}
      {...props}
    >
      <span className="-mt-[6px] size-[8px] shrink-0 rounded-[0_0_0_4px] border-b-[1.5px] border-l-[1.5px] border-border" />
      <span className="truncate">{children}</span>
    </SdkButton>
  );
}
