/* Toolbar pieces shared by the columns at every width: tinted bar buttons, the Move / Reply / Mark
   pull-down menus, and the translucent bottom bar. */
import type { ReactElement, ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Swap } from '@/components/ui/swap';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { MOVE_TARGETS, type Message } from './data';
import type { MailState } from './use-mail';

/** A tinted, borderless toolbar button: a glyph, or a text label like "Edit". It takes every Button prop, so a menu
 *  trigger can render as one. */
export function BarButton({ label, children, className, ...props }: Omit<ButtonProps, 'className'> & { label: string; className?: string }) {
  const text = children == null;
  return (
    <Button variant="ghost" aria-label={label} {...props}
      className={cn('h-9 rounded-ctl text-primary hover:bg-secondary', text ? 'px-2.5 text-body font-normal' : 'w-10 px-0', className)}>
      {children ?? label}
    </Button>
  );
}

export function FlagButton({ mail, m }: { mail: MailState; m: Message }) {
  return (
    <BarButton label={m.flagged ? 'Unflag' : 'Flag'} onClick={() => mail.toggleFlag(m.id)} className={m.flagged ? 'text-warning' : undefined}>
      <Swap effect="pop" value={m.flagged ? 'on' : 'off'}><Icon name={m.flagged ? 'flag-fill' : 'flag'} /></Swap>
    </BarButton>
  );
}

/** "Move to…" menu of folders. `trigger` is the button it opens from (a folder glyph by default). */
export function MoveMenu({ mail, ids, trigger, disabled, onMoved }: {
  mail: MailState; ids: string[]; trigger?: ReactElement; disabled?: boolean; onMoved?: () => void;
}) {
  return (
    <DropdownMenu onAction={(value) => { mail.moveTo(ids, value); onMoved?.(); }}>
      <DropdownMenuTrigger disabled={disabled} render={trigger ?? <BarButton label="Move to…"><Icon name="folder" /></BarButton>} />
      <DropdownMenuContent>
        {MOVE_TARGETS.map((b) => (
          <DropdownMenuItem key={b.id} value={b.id} disabled={b.id === mail.boxId} icon={<Icon name={b.icon} size={20} />}>{b.title}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReplyMenu({ mail, m }: { mail: MailState; m: Message }) {
  return (
    <DropdownMenu onAction={(value) => mail.compose(value as 'reply' | 'replyAll' | 'forward', m)}>
      <DropdownMenuTrigger render={<BarButton label="Reply"><Icon name="reply" /></BarButton>} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem value="reply" icon={<Icon name="reply" size={20} />}>Reply</DropdownMenuItem>
        <DropdownMenuItem value="replyAll" icon={<Icon name="reply-all" size={20} />}>Reply All</DropdownMenuItem>
        <DropdownMenuItem value="forward" icon={<Icon name="arrow-forward" size={20} />}>Forward</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="print" disabled icon={<Icon name="doc" size={20} />}>Print</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Translucent bar pinned to the bottom of a column or screen. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="mail-bottom-bar" className={cn(
      'absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-hairline-t backdrop-blur-[20px] backdrop-saturate-[1.8]',
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
        <DropdownMenu onAction={(value) => mail.markChecked(value === 'unread')}>
          <DropdownMenuTrigger disabled={!ids.length} render={<BarButton label="Mark" />} />
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem value="read" icon={<Icon name="envelope-open" size={20} />}>Mark as Read</DropdownMenuItem>
            <DropdownMenuItem value="unread" icon={<Icon name="envelope-badge" size={20} />}>Mark as Unread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex-1" />
        <MoveMenu mail={mail} ids={ids} disabled={!ids.length} trigger={<BarButton label="Move" />} />
        <span className="flex-1" />
        <BarButton label={mail.boxId === 'trash' ? 'Delete' : 'Trash'} disabled={!ids.length} onClick={() => mail.trash(ids)} />
      </BottomBar>
    );
  }
  const unread = mail.list.filter((m) => m.unread).length;
  return (
    <BottomBar>
      <BarButton label={mail.unreadOnly ? 'Show all mail' : 'Filter by unread'} onClick={mail.toggleUnreadFilter}>
        <Swap effect="pop" value={mail.unreadOnly ? 'on' : 'off'}><Icon name={mail.unreadOnly ? 'filter-circle-fill' : 'filter-circle'} size={24} /></Swap>
      </BarButton>
      <div className="min-w-0 flex-1 text-center leading-[1.25]" aria-live="polite">
        {mail.unreadOnly ? (
          <>
            <div className="truncate text-caption text-foreground">Filtered by:</div>
            <div className="truncate text-caption font-medium text-primary">Unread</div>
          </>
        ) : (
          <>
            <div className="truncate text-caption text-foreground">Updated Just Now</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{unread ? `${unread} Unread` : ' '}</div>
          </>
        )}
      </div>
      <BarButton label="New message" onClick={() => mail.compose('new')}><Icon name="compose" size={24} /></BarButton>
    </BottomBar>
  );
}
