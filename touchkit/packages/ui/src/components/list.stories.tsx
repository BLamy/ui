import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './avatar';
import { EditBar } from './edit-bar';
import { IndexBar, AL } from './index-bar';
import { List } from './list';
import { NavigationStack } from './navigation-stack';
import { SearchField } from './search-field';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { BARH } from '../lib/utils';
import { Phone } from '../stories/frame';

const meta: Meta<typeof List> = {
  title: 'Organisms/List',
  component: List,
};
export default meta;
type Story = StoryObj<typeof List>;

/* Contacts-style demo data — surname-sorted across many letter sections (same shape as the prototype App). */
const RAW: [string, string, string, string][] = [
  ['Amelia', 'Adler', 'Producer', 'Northlake Studio'],
  ['Tunde', 'Abara', 'Data Engineer', 'Fielder Labs'],
  ['Sofia', 'Alvarez', 'Pediatrician', 'Bayview Clinic'],
  ['Marcus', 'Bishop', 'Architect', 'Form & Field'],
  ['Elena', 'Barros', 'Chef', 'Copper Kitchen'],
  ['Rowan', 'Blackwood', 'Novelist', ''],
  ['June', 'Calloway', 'Illustrator', 'Inkwell Co'],
  ['Wei', 'Chen', 'iOS Engineer', 'Parallel'],
  ['Mateus', 'Costa', 'Physiotherapist', 'Motionworks'],
  ['Yara', 'Delacroix', 'Curator', 'MOAD'],
  ['Rafael', 'Duarte', 'Barista', 'Cortado'],
  ['Nia', 'Ellery', 'Attorney', 'Ellery & Park'],
  ['Vivian', 'Eng', 'Product Designer', 'Parallel'],
  ['Cole', 'Farrow', 'Photographer', ''],
  ['Margaux', 'Fontaine', 'Sommelier', 'Vin Petit'],
  ['Declan', 'Gallagher', 'Contractor', 'Gallagher Bros'],
  ['Lian', 'Guo', 'Research Lead', 'Fielder Labs'],
  ['Imogen', 'Hale', 'Violinist', 'City Symphony'],
  ['Theo', 'Holloway', 'Teacher', 'Lakeside High'],
  ['Camila', 'Ibarra', 'Landscape Architect', 'Terrafirma'],
  ['Freya', 'Jansen', 'Pilot', 'Meridian Air'],
  ['Anya', 'Kowalski', 'Climbing Coach', 'Boulder Barn'],
  ['Omar', 'Khan', 'Journalist', 'The Ledger'],
  ['Astrid', 'Lindqvist', 'UX Researcher', 'Parallel'],
  ['Camille', 'Laurent', 'Pastry Chef', 'Mille-Feuille'],
  ['Colette', 'Moreau', 'Editor', 'Gullwing Press'],
  ['Jasper', 'Mercer', 'Bartender', 'The Alcove'],
  ['Kenji', 'Nakamura', 'Woodworker', 'Grain Studio'],
  ['Chidi', 'Okafor', 'Founder', 'Lattice Health'],
  ['Dmitri', 'Petrov', 'Chess Coach', ''],
  ['Saoirse', 'Quinn', 'Marine Biologist', 'Coastal Institute'],
  ['Ezra', 'Rhodes', 'Sound Engineer', 'Northlake Studio'],
  ['Hana', 'Sato', 'Animator', 'Pixelfold'],
  ['Aiko', 'Tanaka', 'Ceramicist', 'Kiln House'],
  ['Rin', 'Ueda', 'Concept Artist', 'Pixelfold'],
  ['Miriam', 'Vance', 'Librarian', 'Central Library'],
  ['Clara', 'Winters', 'Veterinarian', 'Paws Clinic'],
  ['Lin', 'Yang', 'Route Setter', 'Boulder Barn'],
  ['Nadia', 'Zhang', 'VC Partner', 'Crescent Capital'],
];
interface Contact { id: string; f: string; l: string; role: string; com: string }
const CONTACTS: Contact[] = RAW.map(([f, l, role, com]) => ({ id: (f + l).toLowerCase(), f, l, role, com }));
const FAVS = new Set(['ameliaadler', 'weichen', 'anyakowalski', 'hanasato', 'linyang']);

/* Flagship contacts screen: 39 rows across 24 letter sections, sticky headers, IndexBar overlaid and wired.
   The jump uses the same logic as the prototype App: closest available letter, scroller offset by list top. */
function ContactsDemo({ grouped }: { grouped?: boolean }) {
  const secEls = useRef<Record<string, HTMLDivElement | null>>({});
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState<Set<string>>(() => new Set());
  const [favs, setFavs] = useState<Set<string>>(() => new Set(FAVS));
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const visible = CONTACTS.filter((c) => !gone.has(c.id))
    .filter((c) => !ql || (c.f + ' ' + c.l + ' ' + c.com + ' ' + c.role).toLowerCase().includes(ql));
  const sections = AL.map((L) => ({ L, items: visible.filter((c) => c.l[0].toUpperCase() === L) })).filter((s) => s.items.length);
  const avail = new Set(sections.map((s) => s.L));
  const jump = (L: string) => {
    const i = AL.indexOf(L); let t: string | null = null;
    for (let j = i; j >= 0; j--) if (avail.has(AL[j])) { t = AL[j]; break; }
    if (!t) for (let j = i + 1; j < AL.length; j++) if (avail.has(AL[j])) { t = AL[j]; break; }
    const el = t && secEls.current[t]; if (!el) return;
    const s = el.closest('.tk-scroll'); if (!s) return;
    s.scrollTop = s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top - BARH + 1;
  };
  const togglePick = (id: string) => {
    const n = new Set(pick); n.has(id) ? n.delete(id) : n.add(id); setPick(n); Haptics.selection();
  };
  const exitEdit = () => { setEdit(false); setPick(new Set()); };
  const selN = pick.size;
  const content = (
    <div style={{ padding: grouped ? '0 16px' : 0 }}>
      {sections.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--tk-label2)', fontSize: 15 }}>
          No results{ql ? ' for “' + q + '”' : ''}
        </div>
      ) : null}
      {sections.map((s) => (
        <List.Section key={s.L} sticky={!grouped} title={s.L} innerRef={(el) => { if (el) secEls.current[s.L] = el; }}>
          {s.items.map((c, i) => (
            <List.Row key={c.id} rowRole="option"
              title={<span>{c.f} <span style={{ fontWeight: 600 }}>{c.l}</span></span>}
              subtitle={c.role + (c.com ? ' · ' + c.com : '')}
              leading={<Avatar c={c} />}
              trailing={favs.has(c.id) ? <Icon name="starF" size={13} style={{ color: '#FF9F0A' }} /> : null}
              accessory={edit ? undefined : 'chevron'}
              edit={edit} checked={pick.has(c.id)}
              onPress={() => { if (edit) togglePick(c.id); else Haptics.selection(); }}
              onDelete={edit ? undefined : () => setGone((g) => new Set([...g, c.id]))}
              divider={i < s.items.length - 1} />
          ))}
        </List.Section>
      ))}
      {sections.length ? (
        <div style={{ padding: '16px 0 4px', textAlign: 'center', fontSize: 14.5, color: 'var(--tk-label2)' }}>
          {visible.length} Contact{visible.length === 1 ? '' : 's'}{gone.size ? ' · pull down to restore ' + gone.size + ' deleted' : ''}
        </div>
      ) : null}
    </div>
  );
  return (
    <>
      <NavigationStack onPop={() => undefined} screens={[{
        key: 'list',
        title: edit ? (selN ? selN + ' Selected' : 'Select Contacts') : 'Contacts',
        largeTitle: true, grouped,
        subheader: <SearchField q={q} setQ={setQ} aria-label="Search contacts" />,
        trailing: (
          <button className="tk-btn" onClick={() => { edit ? exitEdit() : setEdit(true); Haptics.impact('light'); }}
            style={{
              border: 0, background: 'none', cursor: 'pointer', color: 'var(--tk-tint)', fontFamily: 'inherit', fontSize: 17,
              fontWeight: edit ? 700 : 400, padding: '8px 10px',
            }}>{edit ? 'Done' : 'Select'}</button>
        ),
        content,
        overlay: <IndexBar avail={avail} onLetter={jump} top={BARH + 4} bottom={10} />,
        onRefresh: () => { if (gone.size) { setGone(new Set()); Haptics.notification('success'); } },
      }]} />
      {edit ? (
        <EditBar count={selN} allFav={selN > 0 && [...pick].every((id) => favs.has(id))}
          onFav={() => {
            const all = [...pick].every((id) => favs.has(id)); const n = new Set(favs);
            pick.forEach((id) => { all ? n.delete(id) : n.add(id); }); setFavs(n); Haptics.impact('light');
          }}
          onDelete={() => { setGone((g) => new Set([...g, ...pick])); setPick(new Set()); Haptics.notification('warning'); }} />
      ) : null}
    </>
  );
}

/** Flagship: plain sticky sections + wired IndexBar (scrub or click a letter to jump — with a haptic tick),
 *  sticky large-title search subheader, swipe-to-delete rows, Select → edit mode with EditBar,
 *  pull-to-refresh restores deleted rows. */
export const ContactsWithIndexBar: Story = {
  render: () => <Phone><ContactsDemo /></Phone>,
};

export const ContactsWithIndexBarDark: Story = {
  render: () => <Phone dark><ContactsDemo /></Phone>,
};

/** UITableView .insetGrouped: each letter section floats as a card; IndexBar still jumps. */
export const InsetGrouped: Story = {
  render: () => <Phone><ContactsDemo grouped /></Phone>,
};

/** List `header` prop: the list measures its own header and keeps it sticky under whatever chrome is above,
 *  offsetting section headers below it. */
export const StickySearchHeader: Story = {
  render: function StickySearchHeaderStory() {
    const [q, setQ] = useState('');
    const ql = q.trim().toLowerCase();
    const visible = CONTACTS.filter((c) => !ql || (c.f + ' ' + c.l).toLowerCase().includes(ql));
    const sections = AL.map((L) => ({ L, items: visible.filter((c) => c.l[0].toUpperCase() === L) })).filter((s) => s.items.length);
    return (
      <Phone>
        <div className="tk-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--tk-bg)' }}>
          <List header={<div style={{ padding: '10px 16px' }}><SearchField q={q} setQ={setQ} /></div>}>
            {sections.map((s) => (
              <List.Section key={s.L} sticky title={s.L}>
                {s.items.map((c, i) => (
                  <List.Row key={c.id} title={c.f + ' ' + c.l} subtitle={c.role} leading={<Avatar c={c} size={34} />}
                    divider={i < s.items.length - 1} />
                ))}
              </List.Section>
            ))}
          </List>
        </div>
      </Phone>
    );
  },
};

/** Drag a row left: past 55% width commits (medium tick), release past 64px parks the Delete action. */
export const SwipeToDelete: Story = {
  render: function SwipeToDeleteStory() {
    const [gone, setGone] = useState<Set<string>>(() => new Set());
    const items = CONTACTS.slice(0, 8).filter((c) => !gone.has(c.id));
    return (
      <Phone h={560}>
        <NavigationStack onPop={() => undefined} screens={[{
          key: 'swipe', title: 'Swipe to Delete', largeTitle: true,
          content: (
            <List>
              <List.Section sticky title="Contacts">
                {items.map((c, i) => (
                  <List.Row key={c.id} title={c.f + ' ' + c.l} subtitle={c.role} leading={<Avatar c={c} />}
                    onDelete={() => setGone((g) => new Set([...g, c.id]))} divider={i < items.length - 1} />
                ))}
              </List.Section>
            </List>
          ),
        }]} />
      </Phone>
    );
  },
};

/** Edit mode: rows animate open a check gutter; the EditBar drives bulk favorite / delete. */
export const EditModeWithEditBar: Story = {
  render: function EditModeStory() {
    const [pick, setPick] = useState<Set<string>>(() => new Set(['weichen']));
    const [gone, setGone] = useState<Set<string>>(() => new Set());
    const items = CONTACTS.slice(0, 9).filter((c) => !gone.has(c.id));
    const toggle = (id: string) => {
      const n = new Set(pick); n.has(id) ? n.delete(id) : n.add(id); setPick(n); Haptics.selection();
    };
    return (
      <Phone h={560}>
        <NavigationStack onPop={() => undefined} screens={[{
          key: 'edit', title: pick.size ? pick.size + ' Selected' : 'Select Contacts', largeTitle: true,
          content: (
            <List>
              <List.Section sticky title="Contacts">
                {items.map((c, i) => (
                  <List.Row key={c.id} title={c.f + ' ' + c.l} subtitle={c.role} leading={<Avatar c={c} />}
                    edit checked={pick.has(c.id)} onPress={() => toggle(c.id)} divider={i < items.length - 1} />
                ))}
              </List.Section>
            </List>
          ),
        }]} />
        <EditBar count={pick.size} allFav={false}
          onFav={() => Haptics.impact('light')}
          onDelete={() => { setGone((g) => new Set([...g, ...pick])); setPick(new Set()); Haptics.notification('warning'); }} />
      </Phone>
    );
  },
};

/** Empty state: no sections, centered "No results" message (search for anything to reproduce live). */
export const EmptyState: Story = {
  render: () => (
    <Phone h={480}>
      <NavigationStack onPop={() => undefined} screens={[{
        key: 'empty', title: 'Contacts', largeTitle: true,
        subheader: <SearchField q="zzzz" setQ={() => undefined} />,
        content: (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--tk-label2)', fontSize: 15 }}>
            No results for &ldquo;zzzz&rdquo;
          </div>
        ),
      }]} />
    </Phone>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Phone h={480}>
      <NavigationStack onPop={() => undefined} screens={[{
        key: 'footer', title: 'Settings', largeTitle: true, grouped: true,
        content: (
          <List inset>
            <List.Section title="Contacts table view" footer="UITableView styles: .plain keeps sticky letter headers; .insetGrouped floats each letter section as a card.">
              {CONTACTS.slice(0, 3).map((c, i) => (
                <List.Row key={c.id} title={c.f + ' ' + c.l} subtitle={c.role} leading={<Avatar c={c} size={34} />}
                  accessory="chevron" onPress={() => undefined} divider={i < 2} />
              ))}
            </List.Section>
          </List>
        ),
      }]} />
    </Phone>
  ),
};
