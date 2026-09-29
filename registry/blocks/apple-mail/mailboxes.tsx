/* Mailboxes: Favorites, Smart Mailboxes and the iCloud account, each a collapsible section with unread counts
   that roll when they change. Tiled or floating beside the list on wide screens; on the phone it is the root
   of the stack (with a large title), and picking a mailbox pushes its list. */
import {
  Icon, NumberMorph, SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView,
} from '@brett_lamy/ui';
import { FAVORITES, ICLOUD, SMART } from './data';
import { BarButton } from './parts';
import type { MailState } from './use-mail';

const SECTIONS = [
  { title: 'Favorites', boxes: FAVORITES },
  { title: 'Smart Mailboxes', boxes: SMART },
  { title: 'iCloud', boxes: ICLOUD },
];

const Count = ({ n }: { n: number }) => (n ? <NumberMorph value={n} /> : null);

export function MailboxesSidebar({ mail }: { mail: MailState }) {
  const s = useSplitView();
  return (
    <SplitViewSidebar aria-label="Mailboxes" width={260} minWidth={220}>
      <SplitViewHeader title="Mailboxes" largeTitle={s.collapsed} trailing={<BarButton label="Edit" />} />
      <SplitViewContent>
        <div className="px-2.5 pb-6">
          {SECTIONS.map((sec) => (
            <SplitViewSection key={sec.title} title={sec.title} collapsible>
              {sec.boxes.map((b) => (
                <SplitViewItem key={b.id} id={b.id} title={b.title} icon={<Icon name={b.icon} size={21} />}
                  badge={<Count n={mail.count(b)} />} />
              ))}
            </SplitViewSection>
          ))}
        </div>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}
