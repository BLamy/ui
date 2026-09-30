/* Toolbar pieces shared by the columns at every width: tinted bar buttons, the Move / Reply / Mark
   pull-down menus, and the translucent bottom bar. */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { IconSwap } from '@/components/ui/icon-swap';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { MOVE_TARGETS, type Message } from './data';
import type { MailState } from './use-mail';

/** A tinted, borderless toolbar button: a glyph, or a text label like "Edit". */
export function BarButton({ label, children, onPress, isDisabled, className }: {
  label: string; children?: ReactNode; onPress?: () => void; isDisabled?: boolean; className?: string;
}) {
  const text = children == null;
  return (
    <Button variant="ghost" aria-label={label} onPress={onPress} isDisabled={isDisabled}
      className={cn('h-9 rounded-[10px] text-primary data-hovered:bg-secondary', text ? 'px-2.5 text-[17px] font-normal' : 'w-10 px-0', className)}>
      {children ?? label}
    </Button>
  );
}

export function FlagButton({ mail, m }: { mail: MailState; m: Message }) {
  return (
    <BarButton label={m.flagged ? 'Unflag' : 'Flag'} onPress={() => mail.toggleFlag(m.id)} className={m.flagged ? 'text-warning' : undefined}>
      <IconSwap id={m.flagged ? 'on' : 'off'}><Icon name={m.flagged ? 'flag-fill' : 'flag'} /></IconSwap>
    </BarButton>
  );
}

/** "Move to…" menu of folders. */
export function MoveMenu({ mail, ids, children, isDisabled, onMoved }: {
  mail: MailState; ids: string[]; children?: ReactNode; isDisabled?: boolean; onMoved?: () => void;
}) {
  return (
    <DropdownMenu>
      {children ?? <BarButton label="Move to…" isDisabled={isDisabled}><Icon name="folder" /></BarButton>}
      <DropdownMenuContent aria-label="Move to" onAction={(key) => { mail.moveTo(ids, String(key)); onMoved?.(); }} disabledKeys={[mail.boxId]}>
        {MOVE_TARGETS.map((b) => (
          <DropdownMenuItem key={b.id} id={b.id} icon={<Icon name={b.icon} size={20} />}>{b.title}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReplyMenu({ mail, m }: { mail: MailState; m: Message }) {
  return (
    <DropdownMenu>
      <BarButton label="Reply"><Icon name="reply" /></BarButton>
      <DropdownMenuContent aria-label="Reply" placement="bottom end"
        onAction={(key) => mail.compose(key as 'reply' | 'replyAll' | 'forward', m)}>
        <DropdownMenuItem id="reply" icon={<Icon name="reply" size={20} />}>Reply</DropdownMenuItem>
        <DropdownMenuItem id="replyAll" icon={<Icon name="reply-all" size={20} />}>Reply All</DropdownMenuItem>
        <DropdownMenuItem id="forward" icon={<Icon name="arrow-forward" size={20} />}>Forward</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="print" isDisabled icon={<Icon name="doc" size={20} />}>Print</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Translucent bar pinned to the bottom of a column or screen. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="mail-bottom-bar" className={cn(
      'absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-[inset_0_1px_0_var(--border)] backdrop-blur-[20px] backdrop-saturate-[1.8]',
      className,
    )}>{children}</div>
  );
}

/** The message list's bottom bar: filter · status · compose, or Mark · Move · Trash while editing. */
export function ListBar({ mail }: { mail: MailState }) {
  const ids = [...mail.checked];
  if (mail.editing) {
    return (
      <BottomBar>
        <DropdownMenu>
          <BarButton label="Mark" isDisabled={!ids.length} />
          <DropdownMenuContent aria-label="Mark" placement="top start" onAction={(k) => mail.markChecked(k === 'unread')}>
            <DropdownMenuItem id="read" icon={<Icon name="envelope-open" size={20} />}>Mark as Read</DropdownMenuItem>
            <DropdownMenuItem id="unread" icon={<Icon name="envelope-badge" size={20} />}>Mark as Unread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        <MoveMenu mail={mail} ids={ids}><BarButton label="Move" isDisabled={!ids.length} /></MoveMenu>
        <span className="flex-1" />
        <BarButton label={mail.boxId === 'trash' ? 'Delete' : 'Trash'} isDisabled={!ids.length} onPress={() => mail.trash(ids)} />
      </BottomBar>
    );
  }
  const unread = mail.list.filter((m) => m.unread).length;
  return (
    <BottomBar>
      <BarButton label={mail.unreadOnly ? 'Show all mail' : 'Filter by unread'} onPress={mail.toggleUnreadFilter}>
        <IconSwap id={mail.unreadOnly ? 'on' : 'off'}><Icon name={mail.unreadOnly ? 'filter-circle-fill' : 'filter-circle'} size={24} /></IconSwap>
      </BarButton>
      <div className="min-w-0 flex-1 text-center leading-[1.25]" aria-live="polite">
        {mail.unreadOnly ? (
          <>
            <div className="truncate text-[12px] text-foreground">Filtered by:</div>
            <div className="truncate text-[12px] font-medium text-primary">Unread</div>
          </>
        ) : (
          <>
            <div className="truncate text-[12px] text-foreground">Updated Just Now</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{unread ? `${unread} Unread` : ' '}</div>
          </>
        )}
      </div>
      <BarButton label="New message" onPress={() => mail.compose('new')}><Icon name="compose" size={24} /></BarButton>
    </BottomBar>
  );
}
