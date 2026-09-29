/* Contacts — lists · contacts · contact in a SplitView. Regular width tiles all three columns; medium floats
   the lists over the other two; compact is a stack (Lists → Contacts → contact) with back buttons and the edge
   swipe. Sharing morphs through a Credenza; the contact's Activity is a SideDrawer. */
import { useState } from 'react';
import { BLProvider, SplitView, useAppearance } from '@brett_lamy/ui';
import { ContactDetail } from './contact-detail';
import { ContactList } from './contact-list';
import { ShareSheet, type ShareView } from './share-sheet';
import { ListsSidebar } from './sidebar';
import { useContacts } from './use-contacts';

export function ContactsApp() {
  const dark = useAppearance() === 'dark';
  const contacts = useContacts();
  const [share, setShare] = useState<ShareView | null>(null);
  const [activity, setActivity] = useState(false);
  const [compact, setCompact] = useState(false);

  return (
    <BLProvider dark={dark}>
      <SplitView
        aria-label="Contacts"
        selection={{
          sidebar: contacts.listId,
          supplementary: contacts.selectedId,
        }}
        onSelectionChange={(sel) => {
          if (sel.sidebar && sel.sidebar !== contacts.listId) {
            contacts.setListId(sel.sidebar);
            contacts.setEditing(false);
          }
          contacts.setSelectedId(sel.supplementary ?? null);
        }}
        onWidthClassChange={(wc) => setCompact(wc === 'compact')}
      >
        <ListsSidebar contacts={contacts} />
        <ContactList contacts={contacts} />
        <ContactDetail
          contacts={contacts}
          activity={activity}
          onActivity={setActivity}
          onShare={() => setShare('menu')}
        />
      </SplitView>
      <ShareSheet
        contact={contacts.selected}
        view={share}
        onViewChange={setShare}
        compact={compact}
      />
    </BLProvider>
  );
}
