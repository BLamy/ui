/* Mailboxes: Favorites, Smart Mailboxes and the iCloud account, each a collapsible section with unread
   counts that roll when they change. The split layout draws them as sidebar pills; the phone as an inset
   grouped list that pushes the message list. */
import { useState } from 'react';
import {
  AnimatedHeight, Chevron, Haptics, ListRow, ListSection, NumberMorph, SplitViewContent, SplitViewHeader, SplitViewItem,
  SplitViewSidebar, cn,
} from '@brett_lamy/ui';
import { FAVORITES, ICLOUD, SMART, type Mailbox } from './data';
import { G } from './glyphs';
import { BarButton } from './parts';
import type { MailState } from './use-mail';

const SECTIONS = [
  { id: 'favorites', title: 'Favorites', boxes: FAVORITES },
  { id: 'smart', title: 'Smart Mailboxes', boxes: SMART },
  { id: 'icloud', title: 'iCloud', boxes: ICLOUD },
];

function useCollapsed() {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return {
    isOpen: (id: string) => !closed[id],
    toggle: (id: string) => { setClosed((c) => ({ ...c, [id]: !c[id] })); Haptics.selection(); },
  };
}

function SectionToggle({ title, open, onToggle, className }: { title: string; open: boolean; onToggle: () => void; className?: string }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle}
      className={cn('bl-btn group/sec flex w-full cursor-pointer items-center border-0 bg-transparent [font-family:inherit] outline-none', className)}>
      <span className="flex-1 text-left">{title}</span>
      <Chevron direction={open ? 'down' : 'right'} size={14} sw={2.6} className="text-primary" />
    </button>
  );
}

const Count = ({ n }: { n: number }) => (n ? <NumberMorph value={n} /> : null);

export function MailboxesSidebar({ mail }: { mail: MailState }) {
  const sec = useCollapsed();
  return (
    <SplitViewSidebar aria-label="Mailboxes" width={260} minWidth={220}>
      <SplitViewHeader title="Mailboxes" trailing={<BarButton label="Edit" />} />
      <SplitViewContent className="px-2.5 pb-6">
        {SECTIONS.map((s) => (
          <div key={s.id}>
            <SectionToggle title={s.title} open={sec.isOpen(s.id)} onToggle={() => sec.toggle(s.id)}
              className="px-2.5 pt-4 pb-1.5 text-[13px] font-semibold text-muted-foreground" />
            <AnimatedHeight>
              {sec.isOpen(s.id) ? (
                <div className="flex flex-col gap-px">
                  {s.boxes.map((b) => (
                    <SplitViewItem key={b.id} id={b.id} title={b.title} icon={<G name={b.glyph} size={21} />}
                      badge={<Count n={mail.count(b)} />} />
                  ))}
                </div>
              ) : null}
            </AnimatedHeight>
          </div>
        ))}
      </SplitViewContent>
    </SplitViewSidebar>
  );
}

/** Phone: inset grouped sections; pressing a mailbox pushes its list. */
export function MailboxesList({ mail, onOpen }: { mail: MailState; onOpen: (b: Mailbox) => void }) {
  const sec = useCollapsed();
  return (
    <div className="px-4 pt-2">
      {SECTIONS.map((s) => (
        <ListSection key={s.id} title={
          <SectionToggle title={s.title} open={sec.isOpen(s.id)} onToggle={() => sec.toggle(s.id)}
            className="pt-2 text-[20px] font-bold tracking-[-.3px] text-foreground normal-case" />
        }>
          <AnimatedHeight>
            {sec.isOpen(s.id) ? (
              <div>
                {s.boxes.map((b, i) => (
                  <ListRow key={b.id} title={b.title} accessory="chevron" divider={i < s.boxes.length - 1}
                    leading={<span className="text-primary"><G name={b.glyph} size={24} /></span>}
                    trailing={<span className="text-[17px] text-muted-foreground tabular-nums"><Count n={mail.count(b)} /></span>}
                    onPress={() => { Haptics.selection(); mail.openBox(b.id); onOpen(b); }} />
                ))}
              </div>
            ) : null}
          </AnimatedHeight>
        </ListSection>
      ))}
    </div>
  );
}
