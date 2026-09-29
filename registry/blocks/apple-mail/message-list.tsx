/* The message list: unread dots and flags in the leading gutter, sender · time, subject, a two-line preview,
   swipe actions on every row (ListRow's leading / trailing actions; a long swipe fires the outermost), and an
   edit mode whose check circles slide in from the leading edge. Rows spring in and collapse out as mail
   arrives, moves or gets filtered; the selection highlight glides between rows. */
import { useRef } from 'react';
import { Haptics, Icon, ListRow, cn, springs, useMotion, useSplitView } from '@brett_lamy/ui';
import { preview, relativeTime, type Message } from './data';
import type { MailState } from './use-mail';

/* ListRow draws a full-bleed card row; Mail's rows sit on the column (transparent) with a 32px gutter for the
   unread dot, which narrows while the edit circles are showing. */
const ROW = cn(
  '[&>[data-slot=list-row-content]]:bg-transparent [&>[data-slot=list-row-content]]:transition-[padding]',
  '[&>[data-slot=list-row-content]]:duration-spring-snappy [&>[data-slot=list-row-content]]:ease-spring-snappy',
);

function MessageRow({ mail, m, selected, chevron, isEdge, onOpen }: {
  mail: MailState; m: Message; selected: boolean; chevron?: boolean; isEdge?: (x: number) => boolean; onOpen: (id: string) => void;
}) {
  const { motion } = useMotion();
  const on = selected && !mail.editing;
  return (
    <ListRow edit={mail.editing} checked={mail.checked.has(m.id)} divider={false} isEdge={isEdge}
      className={cn(ROW, mail.editing ? '[&>[data-slot=list-row-content]]:pl-2' : '[&>[data-slot=list-row-content]]:pl-8')}
      onPress={() => { if (mail.editing) mail.toggleChecked(m.id); else { Haptics.selection(); onOpen(m.id); } }}
      // Index 0 is the outermost action: the one a long swipe fires.
      leadingActions={[{ label: m.unread ? 'Read' : 'Unread', icon: m.unread ? 'envelope-open' : 'envelope-badge', onAction: () => mail.toggleRead(m.id) }]}
      trailingActions={[
        { label: 'Trash', icon: 'trash', destructive: true, onAction: () => mail.trash([m.id]) },
        { label: 'Archive', icon: 'archivebox', tint: '#AF52DE', onAction: () => mail.archive([m.id]) },
        { label: m.flagged ? 'Unflag' : 'Flag', icon: 'flag-fill', tint: '#FF9F0A', onAction: () => mail.toggleFlag(m.id) },
      ]}
      title={<>
        {/* Positioned against the row body (which starts where the text does). */}
        {on ? (
          <motion.span layoutId="mail-selection" transition={springs.snappy} aria-hidden="true"
            className="absolute inset-y-[2px] -right-2 -left-6 rounded-[10px] bg-primary" />
        ) : null}
        <span aria-hidden="true" className={cn('absolute top-4 right-full flex flex-col items-center gap-[7px]', mail.editing ? 'w-5' : 'w-7')}>
          <span className={cn('size-[10px] rounded-full transition-[scale,opacity] duration-spring-snappy ease-spring-bouncy',
            m.unread ? 'scale-100 opacity-100' : 'scale-0 opacity-0', on ? 'bg-primary-foreground' : 'bg-primary')} />
          {m.flagged ? <Icon name="flag-fill" size={13} weight="medium" className={on ? 'text-primary-foreground' : 'text-[#FF9F0A]'} /> : null}
        </span>
        <span className={cn('relative block py-0.5 whitespace-normal', on && 'text-primary-foreground')}>
          <span className="sr-only">{m.unread ? 'Unread, ' : ''}{m.flagged ? 'Flagged, ' : ''}</span>
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[16px] leading-[1.3] font-semibold tracking-[-.2px]">{m.from.name}</span>
            {m.attachments?.length ? <Icon name="paperclip" size={14} weight="medium" className={on ? 'opacity-80' : 'text-muted-foreground'} /> : null}
            <span className={cn('shrink-0 text-[14px] tabular-nums', on ? 'opacity-85' : 'text-muted-foreground')}>{relativeTime(m.date)}</span>
            {chevron ? <Icon name="chevron-right" size={13} sw={2.6} className="text-tertiary-foreground" /> : null}
          </span>
          <span className="block truncate text-[15px] leading-[1.35]">{m.subject}</span>
          <span className={cn('line-clamp-2 text-[14.5px] leading-[1.35]', on ? 'opacity-80' : 'text-muted-foreground')}>{preview(m)}</span>
        </span>
        <span aria-hidden="true" className={cn('absolute -right-4 bottom-0 left-0 h-px bg-border', on && 'opacity-0')} />
      </>} />
  );
}

/** The rows. Wide layouts draw the selection; on the phone rows show a chevron and push the message. */
export function MessageList({ mail, onOpen }: { mail: MailState; onOpen: (id: string) => void }) {
  const { motion, AnimatePresence, LayoutGroup } = useMotion();
  const s = useSplitView();
  const list = useRef<HTMLDivElement | null>(null);
  // On the phone the leading edge belongs to the back swipe.
  const isEdge = s.collapsed ? (x: number) => x - (list.current?.getBoundingClientRect().left ?? 0) < 28 : undefined;
  return (
    <div className="pb-16">
      <LayoutGroup id={`mail-${mail.boxId}`}>
        <div ref={list} key={mail.boxId} role="list" aria-label={mail.box.title}>
          <AnimatePresence initial={false}>
            {mail.list.map((m) => (
              <motion.div key={m.id} role="listitem" className="overflow-hidden"
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ height: springs.smooth, opacity: { duration: 0.18 } }}>
                <MessageRow mail={mail} m={m} selected={!s.collapsed && mail.selectedId === m.id} chevron={s.collapsed}
                  isEdge={isEdge} onOpen={onOpen} />
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
