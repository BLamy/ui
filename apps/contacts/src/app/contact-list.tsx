/* The contact list column: search, A–Z sections with sticky letter headers and an index rail, swipe to
   delete, and a Select mode with a Favorite / Delete bar. Pressing a contact selects it in the SplitView —
   on a phone that pushes the contact. */
import { useRef } from 'react';
import {
  Avatar, Button, EditBar, Haptics, Icon, IndexBar, ListRow, ListSection, SearchField,
  SplitViewContent, SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView,
} from '@brett_lamy/ui';
import { AL } from './data';
import { listTitle, type ContactsState } from './use-contacts';

export function ContactList({ contacts }: { contacts: ContactsState }) {
  const s = useSplitView();
  const sectionEls = useRef<Record<string, HTMLElement | null>>({});
  const { sections, visible, editing, checked, query } = contacts;
  const title = listTitle(contacts.listId);
  const avail = new Set(sections.map((sec) => sec.letter));

  // Jump to the letter, or the nearest one before it that has contacts (then the nearest after).
  const jump = (letter: string) => {
    const i = AL.indexOf(letter);
    const target = AL.slice(0, i + 1).reverse().find((L) => avail.has(L)) ?? AL.slice(i + 1).find((L) => avail.has(L));
    if (target) sectionEls.current[target]?.scrollIntoView({ block: 'start' });
  };

  return (
    <SplitViewSupplementary aria-label={title} width={370} minWidth={300} maxWidth={460}>
      <SplitViewHeader
        title={editing ? (checked.size ? `${checked.size} Selected` : 'Select Contacts') : title}
        leading={<SplitViewToggle />}
        trailing={
          <Button variant="ghost" onPress={() => { contacts.setEditing(!editing); Haptics.impact('light'); }}
            className="px-2.5 text-[17px] font-normal text-primary data-hovered:bg-bl-fill">
            {editing ? 'Done' : 'Select'}
          </Button>
        } />
      <SplitViewContent className={editing ? 'pb-[62px]' : undefined}>
        <div className="px-4 pt-2.5 pb-2">
          <SearchField value={query} onChange={contacts.setQuery} aria-label={`Search ${title}`} />
        </div>
        {sections.map((sec) => (
          <ListSection key={sec.letter} sticky title={sec.letter} innerRef={(el) => { sectionEls.current[sec.letter] = el; }}>
            {sec.items.map((c, i) => (
              <ListRow key={c.id} rowRole="option"
                title={<>{c.f} <span className="font-semibold">{c.l}</span></>}
                subtitle={c.com ? `${c.role} · ${c.com}` : c.role}
                leading={<Avatar c={c} />}
                trailing={contacts.isFavorite(c.id) ? <Icon name="starF" size={13} className="text-[#FF9F0A]" /> : null}
                accessory={editing ? undefined : 'chevron'}
                edit={editing} checked={checked.has(c.id)}
                selected={!editing && s.isSelected('supplementary', c.id)}
                onPress={() => {
                  if (editing) return contacts.toggleChecked(c.id);
                  Haptics.selection();
                  s.select('supplementary', c.id);
                }}
                onDelete={editing ? undefined : () => contacts.remove([c.id])}
                divider={i < sec.items.length - 1} />
            ))}
          </ListSection>
        ))}
        {sections.length ? (
          <p className="m-0 px-4 pt-4 pb-6 text-center text-[14.5px] text-muted-foreground">
            {visible.length} Contact{visible.length === 1 ? '' : 's'}
            {contacts.deletedCount ? (
              <>
                {' · '}
                <Button variant="link" onPress={contacts.restore} className="text-[14.5px] font-normal">
                  Restore {contacts.deletedCount} deleted
                </Button>
              </>
            ) : null}
          </p>
        ) : (
          <p className="m-0 px-6 py-16 text-center text-[15px] text-muted-foreground">
            No results{query ? ` for “${query}”` : ''}
          </p>
        )}
      </SplitViewContent>
      <IndexBar avail={avail} onLetter={jump} top={60} bottom={editing ? 70 : 10} />
      {editing ? (
        <EditBar count={checked.size} allFav={checked.size > 0 && [...checked].every(contacts.isFavorite)}
          onFav={contacts.favoriteChecked} onDelete={contacts.deleteChecked} />
      ) : null}
    </SplitViewSupplementary>
  );
}
