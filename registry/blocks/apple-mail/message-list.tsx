/* The message list: unread dots and flags in the leading gutter, sender · time, subject, a two-line preview,
   swipe actions on every row, and an edit mode whose check circles slide in from the leading edge. Rows spring
   in and collapse out as mail arrives, moves or gets filtered; the selection highlight glides between rows. */
import type { ReactNode } from 'react';
import { Haptics, Icon, cn, springCss, springs, useMotion } from '@brett_lamy/ui';
import { preview, relativeTime, type Message } from './data';
import { G } from './glyphs';
import { SwipeRow } from './swipe-row';
import type { MailState } from './use-mail';

export function MessageRow({ mail, m, selected, chevron, onOpen }: {
  mail: MailState; m: Message; selected: boolean; chevron?: boolean; onOpen: (id: string) => void;
}) {
  const { motion } = useMotion();
  const checked = mail.checked.has(m.id);
  const on = selected && !mail.editing;
  return (
    <SwipeRow disabled={mail.editing}
      leading={[{
        label: m.unread ? 'Read' : 'Unread', color: 'var(--bl-tint)', onAction: () => mail.toggleRead(m.id),
        icon: <G name={m.unread ? 'envelopeOpen' : 'envelopeBadge'} size={22} />,
      }]}
      trailing={[
        { label: m.flagged ? 'Unflag' : 'Flag', color: '#FF9F0A', icon: <G name="flagFill" size={22} />, onAction: () => mail.toggleFlag(m.id) },
        { label: 'Archive', color: '#AF52DE', icon: <G name="archive" size={22} />, onAction: () => mail.archive([m.id]) },
        { label: 'Trash', color: 'var(--bl-red)', icon: <G name="trash" size={22} />, onAction: () => mail.trash([m.id]) },
      ]}>
      <button type="button" data-message-row="" aria-current={on || undefined}
        aria-label={`${m.unread ? 'Unread, ' : ''}${m.flagged ? 'Flagged, ' : ''}${m.from.name}, ${m.subject}, ${relativeTime(m.date)}`}
        onClick={() => { if (mail.editing) mail.toggleChecked(m.id); else { Haptics.selection(); onOpen(m.id); } }}
        className="bl-btn group/row relative flex w-full cursor-pointer items-stretch border-0 bg-transparent py-[9px] pr-4 pl-1 text-left [font-family:inherit] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        {on ? (
          <motion.span layoutId="mail-selection" transition={springs.snappy} aria-hidden="true"
            className="absolute inset-x-2 inset-y-[2px] rounded-[10px] bg-primary" />
        ) : null}
        <span aria-hidden="true" className={cn('relative flex shrink-0 items-center justify-center overflow-hidden', mail.editing ? 'w-9 opacity-100' : 'w-0 opacity-0')}
          style={{ transition: springCss(['width', 'opacity'], 'snappy') }}>
          <span className={cn('grid size-[22px] place-items-center rounded-full', checked ? 'bg-primary text-primary-foreground' : 'shadow-[inset_0_0_0_1.6px_var(--bl-label3)]')}
            style={{ transition: springCss('background-color', 'snappy') }}>
            {checked ? <Icon name="check" size={13} sw={3} /> : null}
          </span>
        </span>
        <span aria-hidden="true" className="relative flex w-7 shrink-0 flex-col items-center gap-[7px] pt-[7px]">
          <span className={cn('size-[10px] rounded-full transition-[scale,opacity] duration-spring-snappy ease-spring-bouncy',
            m.unread ? 'scale-100 opacity-100' : 'scale-0 opacity-0', on ? 'bg-primary-foreground' : 'bg-primary')} />
          {m.flagged ? <G name="flagFill" size={13} sw={2} className={on ? 'text-primary-foreground' : 'text-[#FF9F0A]'} /> : null}
        </span>
        <span className={cn('relative min-w-0 flex-1', on && 'text-primary-foreground')}>
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[16px] leading-[1.3] font-semibold tracking-[-.2px]">{m.from.name}</span>
            {m.attachments?.length ? <G name="paperclip" size={14} sw={2} className={on ? 'opacity-80' : 'text-muted-foreground'} /> : null}
            <span className={cn('shrink-0 text-[14px] tabular-nums', on ? 'opacity-85' : 'text-muted-foreground')}>{relativeTime(m.date)}</span>
            {chevron ? <Icon name="chev" size={13} sw={2.6} className="text-bl-label3" /> : null}
          </span>
          <span className="block truncate text-[15px] leading-[1.35]">{m.subject}</span>
          <span className={cn('line-clamp-2 text-[14.5px] leading-[1.35]', on ? 'opacity-80' : 'text-muted-foreground')}>{preview(m)}</span>
        </span>
        <span aria-hidden="true" className={cn('absolute right-0 bottom-0 left-8 h-px bg-border', on && 'opacity-0')} />
      </button>
    </SwipeRow>
  );
}

/** Large title, search, and the rows. `selectable` draws the selection (split layout); the phone pushes instead. */
export function MessageList({ mail, onOpen, selectable, largeTitle = true, search }: {
  mail: MailState; onOpen: (id: string) => void; selectable: boolean; largeTitle?: boolean; search?: ReactNode;
}) {
  const { motion, AnimatePresence, LayoutGroup } = useMotion();
  return (
    <div className="pb-16">
      {largeTitle ? <h1 className="m-0 px-4 pt-1 pb-2 text-[30px] leading-[1.15] font-bold tracking-[-.5px]">{mail.box.title}</h1> : null}
      {search}
      <LayoutGroup id={`mail-${mail.boxId}`}>
        <div key={mail.boxId} role="list" aria-label={mail.box.title}>
          <AnimatePresence initial={false}>
            {mail.list.map((m) => (
              <motion.div key={m.id} role="listitem" className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ height: springs.smooth, opacity: { duration: 0.18 } }}>
                <MessageRow mail={mail} m={m} selected={selectable && mail.selectedId === m.id} chevron={!selectable} onOpen={onOpen} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </LayoutGroup>
      {mail.list.length === 0 ? (
        <div className="px-6 pt-16 text-center">
          <div className="text-[20px] font-semibold">{mail.query ? 'No Results' : 'No Mail'}</div>
          <div className="mt-1 text-[14px] text-muted-foreground">
            {mail.query ? `No messages match “${mail.query}”.` : mail.unreadOnly ? 'You’ve read everything here.' : 'This mailbox is empty.'}
          </div>
        </div>
      ) : null}
    </div>
  );
}
