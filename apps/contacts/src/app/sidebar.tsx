/* The lists column: the library lists and the groups, with live counts. Picking one selects it in the
   SplitView — on a phone that pushes the contact list. */
import type { ReactNode } from 'react';
import { Icon, SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSidebar } from '@brett_lamy/ui';
import { LISTS, type ContactsState } from './use-contacts';

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="m-0 px-2.5 pt-4 pb-1.5 text-[13px] font-semibold text-muted-foreground">{children}</h2>;
}

export function ListsSidebar({ contacts }: { contacts: ContactsState }) {
  return (
    <SplitViewSidebar aria-label="Lists" width={264} minWidth={220} maxWidth={340}>
      <SplitViewHeader title="Lists" />
      <SplitViewContent className="px-2.5 pb-4">
        <SectionLabel>Library</SectionLabel>
        <div className="flex flex-col gap-px">
          {LISTS.map((l) => (
            <SplitViewItem key={l.id} id={l.id} title={l.title} icon={<Icon name={l.icon} size={19} sw={2} />} badge={contacts.count(l.id)} />
          ))}
        </div>
        <SectionLabel>Groups</SectionLabel>
        <div className="flex flex-col gap-px">
          {contacts.groups.map((g) => (
            <SplitViewItem key={g.name} id={g.name} title={g.name} badge={contacts.count(g.name)}
              icon={<span className="size-[11px] rounded-full" style={{ background: g.color }} />} />
          ))}
        </div>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}
