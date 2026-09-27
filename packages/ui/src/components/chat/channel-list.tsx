import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Button, composeRenderProps } from 'react-aria-components';
import { ChatIcon, chatIconPaths } from '../../lib/chat/chat-icon';
import { useOptionalChatShell } from '../../lib/chat/chat-shell-context';
import { Haptics } from '../../lib/haptics';
import { cn } from '../../lib/utils';

/* ══ Channel navigation ══
   <ChannelList selectedKey onSelectionChange>
     <ChannelGroup label="Team">
       <ChannelItem id="general">general</ChannelItem>
       <ChannelItem id="dev" unread mentions={2}>dev</ChannelItem>
       <ChannelThreadItem onPress={…}>Repo connect spawning…</ChannelThreadItem>
   Picking a channel (or a thread row) inside a compact ChatShell also closes its navigation drawer. */

interface ChannelListContextValue {
  selectedKey?: string | null;
  onSelectionChange?: (id: string) => void;
}
const ChannelListContext = createContext<ChannelListContextValue>({});

export interface ChannelListProps extends Omit<ComponentProps<'nav'>, 'onChange'> {
  /** the current channel */
  selectedKey?: string | null;
  onSelectionChange?: (id: string) => void;
}

/** The scrolling channel list. Owns the selection its ChannelItems read. */
export function ChannelList({ selectedKey, onSelectionChange, className, children, ...props }: ChannelListProps) {
  return (
    <ChannelListContext.Provider value={{ selectedKey, onSelectionChange }}>
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
      <div className="px-[8px] pt-[11px] pb-[4px] text-[10px] font-bold tracking-[.7px] text-ck-mut3 uppercase">{label}</div>
      {children}
    </div>
  );
}

function MentionPill({ n }: { n: number }) {
  return (
    <span
      data-slot="channel-item-mentions"
      className="box-border flex h-[16px] min-w-[16px] shrink-0 items-center justify-center rounded-full bg-ck-red px-[4px] text-[10px] leading-none font-bold text-white"
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}

export interface ChannelItemProps extends Omit<ComponentProps<typeof Button>, 'id' | 'children'> {
  id: string;
  children?: ReactNode;
  /** leading glyph; a # by default (pass a ChatAvatar for a DM) */
  icon?: ReactNode;
  /** new activity: bold label and a tint dot (hidden while selected) */
  unread?: boolean;
  /** mention count: a red pill (replaces the dot) */
  mentions?: number;
  /** overrides the list's selection */
  isActive?: boolean;
}

export function ChannelItem({ id, icon, unread, mentions, isActive, className, children, onPress, ...props }: ChannelItemProps) {
  const list = useContext(ChannelListContext);
  const shell = useOptionalChatShell();
  const on = isActive ?? list.selectedKey === id;
  return (
    <Button
      data-slot="channel-item"
      data-active={on || undefined}
      data-unread={unread || undefined}
      aria-current={on ? 'page' : undefined}
      onPress={(e) => {
        Haptics.selection();
        list.onSelectionChange?.(id);
        onPress?.(e);
        shell?.setNavOpen(false);
      }}
      className={composeRenderProps(className, (c) =>
        cn(
          'flex w-full cursor-pointer items-center gap-[7px] rounded-[8px] border-0 px-[8px] py-[5px] text-left font-ios text-[13.5px] [transition:background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] motion-reduce:transition-none',
          on ? 'bg-ck-fill2' : 'bg-transparent data-hovered:bg-ck-hover',
          on || unread ? 'font-[650] text-ck-label' : 'font-normal text-ck-mut',
          c,
        ),
      )}
      {...props}
    >
      <span className="grid text-ck-mut3">{icon ?? <ChatIcon d={chatIconPaths.hash} size={13} sw={2} />}</span>
      <span className="flex-1 truncate">{children}</span>
      {mentions ? <MentionPill n={mentions} /> : unread && !on && <span className="size-[7px] rounded-[50%] bg-ck-tint" />}
    </Button>
  );
}

export interface ChannelThreadItemProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  children?: ReactNode;
  /** the thread is open (full view) */
  isActive?: boolean;
}

/** An indented thread row under its channel, with an elbow connector. */
export function ChannelThreadItem({ isActive, className, children, onPress, ...props }: ChannelThreadItemProps) {
  const shell = useOptionalChatShell();
  return (
    <Button
      data-slot="channel-thread-item"
      data-active={isActive || undefined}
      aria-current={isActive ? 'page' : undefined}
      onPress={(e) => {
        Haptics.selection();
        onPress?.(e);
        shell?.setNavOpen(false);
      }}
      className={composeRenderProps(className, (c) =>
        cn(
          'flex w-full cursor-pointer items-center gap-[6px] rounded-[7px] border-0 py-[3px] pr-[8px] pl-[24px] text-left font-ios text-[12px]',
          isActive ? 'bg-ck-fill font-semibold text-ck-label' : 'bg-transparent text-ck-mut3 data-hovered:text-ck-mut',
          c,
        ),
      )}
      {...props}
    >
      <span className="-mt-[6px] size-[8px] shrink-0 rounded-[0_0_0_4px] border-b-[1.5px] border-l-[1.5px] border-ck-sep" />
      <span className="truncate">{children}</span>
    </Button>
  );
}
