import { createContext, useContext, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  createHoverCardController,
  type HoverCardController,
} from '@/components/ui/hover-card';
import type { ChatPresence } from './user-panel';
import { chatUserAvatar, type ChatUser } from './chat-users';
import { UserCard } from './user-card';
import { cn } from '@/lib/utils';

/* ══ Member list — who's in the channel, usually inside a ChatShellAside ══
   <MemberList>
     <MemberGroup label="Online" count={3}>
       <MemberItem user={ada} status="online" />
       <MemberItem user={stitch} />            // bots get an APP badge
     </MemberGroup>
   </MemberList>
   Resting on a member shows their profile (UserCard) to the left of the list, like Discord's popout. The list holds
   one card for every row, so it moves from member to member as the pointer sweeps down the list. */

/** The APP tag beside a bot member (a fixed brand indigo, like Discord's). */
const MEMBER_TAG_COLOR = '#5E5CE6';

const MemberCardsContext = createContext<HoverCardController<ChatUser> | null>(null);

/** The profile card beside a member row: one per list, or per row outside a list. */
function MemberCard({ controller }: { controller?: HoverCardController<ChatUser> }) {
  return (
    <HoverCard controller={controller}>
      <HoverCardContent<ChatUser> side="left" align="start" sideOffset={14}>
        {({ payload }) => (payload ? <UserCard user={payload} /> : null)}
      </HoverCardContent>
    </HoverCard>
  );
}

export function MemberList({ className, children, ...props }: ComponentProps<'div'>) {
  const [cards] = useState(() => createHoverCardController<ChatUser>());
  return (
    <MemberCardsContext.Provider value={cards}>
      <div data-slot="member-list" className={cn('ck-scroll box-border h-full overflow-y-auto p-3', className)} {...props}>
        {children}
      </div>
      <MemberCard controller={cards} />
    </MemberCardsContext.Provider>
  );
}

export interface MemberGroupProps extends ComponentProps<'div'> {
  label: ReactNode;
  /** shown after the label: "Team — 5" */
  count?: number;
}

export function MemberGroup({ label, count, className, children, ...props }: MemberGroupProps) {
  return (
    <div data-slot="member-group" role="group" className={cn('[&+&]:mt-4', className)} {...props}>
      <div className="mb-2 text-[10px] font-bold tracking-[.7px] text-tertiary-foreground uppercase">
        {label}
        {count != null && <> — {count}</>}
      </div>
      {children}
    </div>
  );
}

export interface MemberItemProps extends Omit<ComponentProps<'button'>, 'children'> {
  user: ChatUser;
  /** presence dot on the avatar; `offline` also dims the row */
  status?: ChatPresence;
  /** a tag after the name; bots default to "APP" (pass null for none) */
  badge?: ReactNode;
  /** replaces the name */
  children?: ReactNode;
}

export function MemberItem({ user, status, badge, className, style, children, ...props }: MemberItemProps) {
  const tag = badge === undefined ? (user.bot ? 'APP' : null) : badge;
  const shared = useContext(MemberCardsContext);
  const [own] = useState(() => createHoverCardController<ChatUser>());
  const cards = shared ?? own;
  return (
    <>
      <HoverCardTrigger
        controller={cards}
        payload={user}
        render={
          // A button, so a keyboard reaches the member's card too (focus opens it, like a hover).
          <button
            type="button"
            data-status={status}
            className={cn(
              'flex w-full cursor-default items-center gap-2 rounded-md border-0 bg-transparent px-0 py-1 text-left [font-family:inherit] text-inherit outline-none focus-visible:ring-2 focus-visible:ring-ring/45',
              status === 'offline' && 'opacity-45',
              className,
            )}
            style={style}
            {...props}
          />
        }
      >
        <Avatar {...chatUserAvatar(user, 24)} status={status} />
        <span
          className="ck-role flex-1 overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap text-(--ck-role)"
          style={{ '--ck-role': user.role } as CSSProperties}
        >
          {children ?? user.name}
        </span>
        {tag != null && (
          <span className="rounded-sm bg-(--member-tag) px-1 py-px text-[8.5px] font-extrabold text-white" style={{ '--member-tag': MEMBER_TAG_COLOR } as CSSProperties}>
            {tag}
          </span>
        )}
      </HoverCardTrigger>
      {shared ? null : <MemberCard controller={own} />}
    </>
  );
}
