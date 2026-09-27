import type { CSSProperties, ReactNode } from 'react';
import { Button } from 'react-aria-components';
import { ChatAvatar } from './chat-avatar';
import { ChatIcon, chatIconPaths } from '../../lib/chat/chat-icon';
import type { ChatChannel, ChatChannels } from '../../lib/chat/chat-users';
import { cn } from '../../lib/utils';
import { kvib } from '../../lib/chat/kvib';

export interface ChannelListProps {
  chans: ChatChannels;
  cur: string;
  onPick: (id: string, threadId?: string) => void;
  tint: string;
  onClose?: (() => void) | null;
  /** header title slot — default matches the prototype's "BL UI HQ" */
  title?: ReactNode;
  /** footer slot — default matches the prototype's Ada "online" footer */
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const defaultFooterUser = { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' };

function DefaultFooter() {
  return (
    <div className="flex items-center gap-[8px] border-t border-ck-sep px-[12px] py-[9px]">
      <ChatAvatar user={defaultFooterUser} size={26} />
      <div className="flex-1 leading-[1.1]">
        <div className="text-[12px] font-bold text-ck-label">Ada</div>
        <div className="text-[10px] font-semibold text-ck-green">● online</div>
      </div>
      <span className="grid text-ck-mut3">
        <ChatIcon d={chatIconPaths.bell} size={14} />
      </span>
    </div>
  );
}

export function ChannelList({
  chans,
  cur,
  onPick,
  tint,
  onClose,
  title = 'BL UI HQ',
  footer,
  className,
  style,
}: ChannelListProps) {
  const secs: { name: string; items: [string, ChatChannel][] }[] = [];
  Object.entries(chans).forEach(([id, ch]) => {
    let s = secs.find((x) => x.name === ch.section);
    if (!s) {
      s = { name: ch.section, items: [] };
      secs.push(s);
    }
    s.items.push([id, ch]);
  });
  return (
    <div
      data-slot="channel-list"
      className={cn(
        'box-border flex h-full w-[222px] shrink-0 flex-col border-r border-ck-sep bg-ck-side font-ios',
        className,
      )}
      style={{ '--ck-tint': tint, ...style } as CSSProperties}
    >
      <div className="flex items-center gap-[8px] border-b border-ck-sep px-[14px] pt-[13px] pb-[9px]">
        <span className="flex-1 text-[13.5px] font-extrabold tracking-[-.1px] text-ck-label">{title}</span>
        {onClose ? (
          <Button
            onPress={onClose}
            aria-label="Close channels"
            className="grid cursor-pointer border-0 bg-transparent p-[4px] text-ck-mut3"
          >
            <ChatIcon d={chatIconPaths.x} size={14} />
          </Button>
        ) : (
          <span className="grid text-ck-mut3">
            <ChatIcon d={chatIconPaths.chev} size={13} className="[transform:rotate(90deg)]" />
          </span>
        )}
      </div>
      <div className="ck-scroll min-h-0 flex-1 overflow-y-auto px-[8px] py-[6px]">
        {secs.map((s) => (
          <div key={s.name}>
            <div className="px-[8px] pt-[11px] pb-[4px] text-[10px] font-bold tracking-[.7px] text-ck-mut3 uppercase">
              {s.name}
            </div>
            {s.items.map(([id, ch]) => {
              const on = id === cur;
              const threads = ch.msgs.filter((m) => m.thread);
              return (
                <div key={id}>
                  <Button
                    onPress={() => {
                      kvib([5]);
                      onPick(id);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-[7px] rounded-[8px] border-0 px-[8px] py-[5px] text-left font-ios text-[13.5px]',
                      on ? 'bg-ck-fill2' : 'bg-transparent',
                      on || ch.unread ? 'font-[650] text-ck-label' : 'font-normal text-ck-mut',
                    )}
                  >
                    <span className="grid text-ck-mut3">
                      <ChatIcon d={chatIconPaths.hash} size={13} sw={2} />
                    </span>
                    <span className="flex-1 truncate">{ch.label}</span>
                    {ch.unread && !on && <span className="size-[7px] rounded-[50%] bg-(--ck-tint)" />}
                  </Button>
                  {on &&
                    threads.map((m) => (
                      <Button
                        key={m.id}
                        onPress={() => {
                          kvib([4]);
                          onPick(id, m.id);
                        }}
                        className="flex w-full cursor-pointer items-center gap-[6px] rounded-[7px] border-0 bg-transparent py-[3px] pr-[8px] pl-[24px] text-left font-ios text-[12px] text-ck-mut3"
                      >
                        <span className="-mt-[6px] size-[8px] shrink-0 rounded-[0_0_0_4px] border-b-[1.5px] border-l-[1.5px] border-ck-sep" />
                        <span className="truncate">{m.thread?.title}</span>
                      </Button>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {footer === undefined ? <DefaultFooter /> : footer}
    </div>
  );
}
