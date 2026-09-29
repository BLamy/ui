import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { ChatAvatar } from './chat-avatar';
import type { ChatPresence } from './user-panel';
import type { ChatUser } from '../../lib/chat/chat-users';
import { cn } from '../../lib/utils';

/* ══ Member list — who's in the channel, usually inside a ChatShellAside ══
   <MemberList>
     <MemberGroup label="Online" count={3}>
       <MemberItem user={ada} status="online" />
       <MemberItem user={stitch} />            // bots get an APP badge
     </MemberGroup>
   </MemberList> */

export function MemberList({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="member-list" className={cn('ck-scroll box-border h-full overflow-y-auto p-3', className)} {...props} />;
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

export interface MemberItemProps extends Omit<ComponentProps<'div'>, 'children'> {
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
  return (
    <div
      data-slot="member-item"
      data-status={status}
      className={cn('flex items-center gap-2 py-1', status === 'offline' && 'opacity-45', className)}
      style={style}
      {...props}
    >
      <ChatAvatar user={user} size={24} square={user.bot} status={status} />
      <span
        className="ck-role flex-1 overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap text-(--ck-role)"
        style={{ '--ck-role': user.role } as CSSProperties}
      >
        {children ?? user.name}
      </span>
      {tag != null && <span className="rounded-[4px] bg-[#5E5CE6] px-1 py-px text-[8.5px] font-extrabold text-white">{tag}</span>}
    </div>
  );
}
