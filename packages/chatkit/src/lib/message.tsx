import type { CSSProperties } from 'react';
import { Button } from 'react-aria-components';
import { ChatAvatar } from './chat-avatar';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { useChatUsers, type ChatMessageData, type ChatUsers } from './chat-users';
import { cn } from './cn';
import { kvib } from './kvib';
import { RichText } from './rich-text';
import { ThreadPreview } from './thread-preview';
import { titleRef } from './title-ref';

export interface MessageProps {
  m: ChatMessageData;
  tint: string;
  onReact: (id: string, i: number) => void;
  onOpenThread: (id: string) => void;
  onStartThread: (id: string) => void;
  users?: ChatUsers;
  className?: string;
  style?: CSSProperties;
}

export function Message({
  m,
  tint,
  onReact,
  onOpenThread,
  onStartThread,
  users,
  className,
  style,
}: MessageProps) {
  const ctxUsers = useChatUsers();
  const map = users ?? ctxUsers;
  const usr = map[m.u];
  return (
    <div
      data-slot="message"
      className={cn('relative flex gap-[11px] px-[18px] py-[7px] font-ios [&:hover]:bg-ck-hover', className)}
      style={{ '--ck-tint': tint, '--ck-role': usr.role, ...style } as CSSProperties}
    >
      <ChatAvatar user={usr} size={36} square={usr.bot} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-[7px]">
          <span className="ck-role text-[13.5px] font-bold text-(--ck-role)">{usr.name}</span>
          {usr.bot && (
            <span className="rounded-[4px] bg-(--ck-tint) px-[5px] py-px text-[9px] font-extrabold tracking-[.4px] text-white">
              APP
            </span>
          )}
          <span className="text-[10.5px] text-ck-mut3">{m.t}</span>
        </div>
        <div className="mt-px text-[13.5px] leading-[1.55] wrap-break-word text-ck-label">
          <RichText text={m.txt} users={map} />
        </div>
        {m.reacts.length > 0 && (
          <div className="mt-[6px] flex gap-[5px]">
            {m.reacts.map(([e, n, mine], i) => (
              <Button
                key={i}
                onPress={() => {
                  kvib([5]);
                  onReact(m.id, i);
                }}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-[5px] rounded-[999px] border px-[8px] py-[2px] font-ios text-[12px] text-ck-label',
                  mine
                    ? 'border-(--ck-tint) bg-ck-mine'
                    : 'border-ck-sep bg-ck-fill',
                )}
              >
                {e}
                <span className={cn('text-[11px]', mine ? 'text-ck-link' : 'text-ck-mut')}>{n}</span>
              </Button>
            ))}
          </div>
        )}
        {m.thread && (
          <ThreadPreview th={m.thread} tint={tint} users={map} onOpen={() => onOpenThread(m.id)} />
        )}
      </div>
      {/* Hover actions. Row hover never revealed them (inline opacity always won over the old .ck-row:hover rule), so they stay transparent; keyboard focus reveals them. */}
      <div className="absolute -top-[10px] right-[16px] flex gap-[2px] rounded-[9px] border border-ck-sep bg-ck-card p-[2px] opacity-0 [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy)] has-data-focus-visible:opacity-100">
        <Button
          onPress={() => {
            kvib([5]);
            onReact(m.id, -1);
          }}
          ref={titleRef('Add 👍')}
          className="cursor-pointer rounded-[7px] border-0 bg-transparent px-[6px] py-[3px] text-[13px]"
        >
          👍
        </Button>
        <Button
          onPress={() => {
            kvib([6]);
            m.thread ? onOpenThread(m.id) : onStartThread(m.id);
          }}
          ref={titleRef(m.thread ? 'Open thread' : 'Start thread')}
          className="grid cursor-pointer rounded-[7px] border-0 bg-transparent px-[6px] py-[3px] text-ck-mut"
        >
          <ChatIcon d={chatIconPaths.thread} size={14} />
        </Button>
      </div>
    </div>
  );
}
