import type { CSSProperties } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { chatUserAvatar, useChatUserInfo, type ChatUser } from './chat-users';
import { presenceLabel, userPanelStatusVariants } from './user-panel';
import { cn } from '@/lib/utils';

/* ══ UserCard — a chat user's profile, as the hover card over their avatar, name, @mention or member row ══
   <Avatar {...chatUserAvatar(ada)} card={<UserCard user={ada} />} />
   Discord's profile popout, read-only: a banner in their color, the avatar with its presence dot, their name in their
   role color over @handle (an APP tag for bots), the status line, then About me and Member since when the user
   carries them. The handle and presence come from ChatUsersProvider (`presence`). */

/** The APP tag on a bot's card (the member list's brand indigo). */
const CARD_TAG_COLOR = '#5E5CE6';

export interface UserCardProps {
  user: ChatUser;
  className?: string;
}

export function UserCard({ user, className }: UserCardProps) {
  const { id, status } = useChatUserInfo(user);
  return (
    // Full-bleed: cancels the HoverCard's padding so the banner reaches its rounded edges.
    <div data-slot="user-card" className={cn('-m-4 overflow-hidden rounded-[14px] font-sans', className)}
      style={{ '--ck-role': user.role, '--user-card-banner': user.c, '--member-tag': CARD_TAG_COLOR } as CSSProperties}>
      <div className="h-[56px] bg-(--user-card-banner)" />
      <div className="px-4 pb-4">
        <Avatar {...chatUserAvatar(user, 64)} status={status} className="-mt-8 rounded-full ring-[5px] ring-popover" />
        <div className="mt-2 flex items-center gap-1.5">
          <span className="ck-role truncate text-[17px] leading-tight font-bold text-(--ck-role)">{user.name}</span>
          {user.bot && <span className="rounded-sm bg-(--member-tag) px-1 py-px text-[8.5px] font-extrabold text-white">APP</span>}
        </div>
        {id && <div className="text-caption text-muted-foreground">@{id}</div>}
        {status && <div className={cn(userPanelStatusVariants({ status }), 'mt-1.5')}>● {presenceLabel[status]}</div>}
        {(user.about || user.since) && (
          <div className="mt-3 space-y-2.5 rounded-ctl bg-secondary px-3 py-2.5">
            {user.about && (
              <div>
                <div className="text-[10px] font-bold tracking-[.7px] text-tertiary-foreground uppercase">About me</div>
                <div className="mt-0.5 text-[12.5px] leading-[1.45] text-foreground">{user.about}</div>
              </div>
            )}
            {user.since && (
              <div>
                <div className="text-[10px] font-bold tracking-[.7px] text-tertiary-foreground uppercase">Member since</div>
                <div className="mt-0.5 text-[12.5px] text-foreground">{user.since}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
