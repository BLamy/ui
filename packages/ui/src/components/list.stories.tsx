import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState as EmptyStateView } from '@/components/ui/empty-state';
import { Toolbar, ToolbarButton, ToolbarText } from '@/components/ui/toolbar';
import { IndexBar, alphabetItems } from '@/components/ui/index-bar';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { Switch } from '@/components/ui/switch';
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackLeading,
  NavigationStackPage,
  NavigationStackSubheader,
  NavigationStackTitle,
  NavigationStackTrailing,
} from '@/components/ui/navigation-stack';
import { SearchInput } from '@/components/ui/search-input';
import { Icon } from '@/lib/icon';
import { BARH } from '@/lib/utils';
import { Pad, Phone } from '../stories/frame';

const meta: Meta<typeof List> = {
  title: 'Organisms/List',
  component: List,
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'inset'] },
    density: { control: 'inline-radio', options: ['compact', 'default', 'comfortable'] },
  },
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

const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
    const s = el.closest('.bl-scroll'); if (!s) return;
    s.scrollTop = s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top - BARH + 1;
  };
  const togglePick = (id: string) => {
    const n = new Set(pick); if (n.has(id)) n.delete(id); else n.add(id); setPick(n);
  };
  const exitEdit = () => { setEdit(false); setPick(new Set()); };
  const selN = pick.size;
  const content = (
    <List variant={grouped ? 'inset' : 'plain'}
      emptyState={<EmptyStateView size="sm" icon={<Icon name="magnifyingglass" />} title="No Results" description={ql ? `No contacts match “${q}”.` : 'No contacts.'} />}>
      {sections.map((s) => (
        <ListSection key={s.L} sticky={!grouped} title={s.L} ref={(el) => { if (el) secEls.current[s.L] = el; }}>
          {s.items.map((c, i) => (
            <ListRow key={c.id}
              title={<span>{c.f} <span style={{ fontWeight: 600 }}>{c.l}</span></span>}
              description={c.role + (c.com ? ' · ' + c.com : '')}
              icon={<Avatar name={`${c.f} ${c.l}`} />}
              trailing={favs.has(c.id) ? <Icon name="starF" size={13} className="text-warning" /> : null}
              accessory={edit ? undefined : 'chevron'}
              editing={edit} checked={pick.has(c.id)}
              onClick={() => { if (edit) togglePick(c.id); }}
              trailingActions={[{ label: 'Delete', destructive: true, onAction: () => setGone((g) => new Set([...g, c.id])) }]}
              divider={i < s.items.length - 1} />
          ))}
        </ListSection>
      ))}
      {sections.length ? (
        <div style={{ padding: '16px 0 4px', textAlign: 'center', fontSize: 14.5, color: 'var(--muted-foreground)' }}>
          {visible.length} Contact{visible.length === 1 ? '' : 's'}{gone.size ? ' · pull down to restore ' + gone.size + ' deleted' : ''}
        </div>
      ) : null}
    </List>
  );
  return (
    <>
      <NavigationStack pages={['list']}>
        <NavigationStackPage value="list" variant={grouped ? "grouped" : "plain"}>
          <NavigationStackBar>
            <NavigationStackTitle>{edit ? (selN ? selN + ' Selected' : 'Select Contacts') : 'Contacts'}</NavigationStackTitle>
            <NavigationStackTrailing>
              <button className="bl-btn" onClick={() => { if (edit) exitEdit(); else setEdit(true); }}
                style={{
                  border: 0, background: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit', fontSize: 17,
                  fontWeight: edit ? 700 : 400, padding: '8px 10px',
                }}>{edit ? 'Done' : 'Select'}</button>
            </NavigationStackTrailing>
          </NavigationStackBar>
          <NavigationStackContent onRefresh={() => { if (gone.size) { setGone(new Set()); } }}>
            <NavigationStackLargeTitle />
            <NavigationStackSubheader>
              <SearchInput value={q} onValueChange={setQ} aria-label="Search contacts" />
            </NavigationStackSubheader>
            {content}
          </NavigationStackContent>
          <IndexBar items={alphabetItems(avail)} onJump={jump} className="top-14 bottom-2.5" />
        </NavigationStackPage>
      </NavigationStack>
      {edit ? (
        <Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0 z-130">
          <ToolbarButton disabled={!selN}
            onClick={() => {
              const all = [...pick].every((id) => favs.has(id)); const n = new Set(favs);
              pick.forEach((id) => { if (all) n.delete(id); else n.add(id); }); setFavs(n);
            }}>
            {selN > 0 && [...pick].every((id) => favs.has(id)) ? 'Unfavorite' : 'Favorite'}
          </ToolbarButton>
          <ToolbarText aria-live="polite">{selN ? `${selN} selected` : 'Select items'}</ToolbarText>
          <ToolbarButton tone="destructive" disabled={!selN}
            onClick={() => { setGone((g) => new Set([...g, ...pick])); setPick(new Set()); }}>Delete</ToolbarButton>
        </Toolbar>
      ) : null}
    </>
  );
}

/** Flagship: plain sticky sections + wired IndexBar (scrub or click a letter to jump),
 *  sticky large-title search subheader, swipe-to-delete rows, Select → edit mode with a `bar` Toolbar,
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
        <div className="bl-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--background)' }}>
          <List header={<div style={{ padding: '10px 16px' }}><SearchInput value={q} onValueChange={setQ} /></div>}>
            {sections.map((s) => (
              <ListSection key={s.L} sticky title={s.L}>
                {s.items.map((c, i) => (
                  <ListRow key={c.id} title={c.f + ' ' + c.l} description={c.role} icon={<Avatar name={`${c.f} ${c.l}`} size={34} />}
                    divider={i < s.items.length - 1} />
                ))}
              </ListSection>
            ))}
          </List>
        </div>
      </Phone>
    );
  },
};

/** Drag a row left: past 55% width commits; a slower release past half the action width parks Delete open. */
export const SwipeToDelete: Story = {
  render: function SwipeToDeleteStory() {
    const [gone, setGone] = useState<Set<string>>(() => new Set());
    const items = CONTACTS.slice(0, 8).filter((c) => !gone.has(c.id));
    return (
      <Phone h={560}>
        <NavigationStack pages={['swipe']}>
          <NavigationStackPage value="swipe">
            <NavigationStackBar><NavigationStackTitle>Swipe to Delete</NavigationStackTitle></NavigationStackBar>
            <NavigationStackContent>
            <NavigationStackLargeTitle />
            <List>
              <ListSection sticky title="Contacts">
                {items.map((c, i) => (
                  <ListRow key={c.id} title={c.f + ' ' + c.l} description={c.role} icon={<Avatar name={`${c.f} ${c.l}`} />}
                    trailingActions={[{ label: 'Delete', destructive: true, onAction: () => setGone((g) => new Set([...g, c.id])) }]} divider={i < items.length - 1} />
                ))}
              </ListSection>
            </List>
            </NavigationStackContent>
          </NavigationStackPage>
        </NavigationStack>
      </Phone>
    );
  },
};

/** Edit mode: rows animate open a check gutter; a `bar` Toolbar drives bulk favorite / delete. */
export const EditModeWithToolbar: Story = {
  render: function EditModeStory() {
    const [pick, setPick] = useState<Set<string>>(() => new Set(['weichen']));
    const [gone, setGone] = useState<Set<string>>(() => new Set());
    const items = CONTACTS.slice(0, 9).filter((c) => !gone.has(c.id));
    const toggle = (id: string) => {
      const n = new Set(pick); if (n.has(id)) n.delete(id); else n.add(id); setPick(n);
    };
    return (
      <Phone h={560}>
        <NavigationStack pages={['edit']}>
          <NavigationStackPage value="edit">
            <NavigationStackBar>
              <NavigationStackTitle>{pick.size ? pick.size + ' Selected' : 'Select Contacts'}</NavigationStackTitle>
            </NavigationStackBar>
            <NavigationStackContent>
            <NavigationStackLargeTitle />
            <List>
              <ListSection sticky title="Contacts">
                {items.map((c, i) => (
                  <ListRow key={c.id} title={c.f + ' ' + c.l} description={c.role} icon={<Avatar name={`${c.f} ${c.l}`} />}
                    editing checked={pick.has(c.id)} onClick={() => toggle(c.id)} divider={i < items.length - 1} />
                ))}
              </ListSection>
            </List>
            </NavigationStackContent>
          </NavigationStackPage>
        </NavigationStack>
        <Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0 z-130">
          <ToolbarButton disabled={!pick.size}>Favorite</ToolbarButton>
          <ToolbarText aria-live="polite">{pick.size ? `${pick.size} selected` : 'Select items'}</ToolbarText>
          <ToolbarButton tone="destructive" disabled={!pick.size}
            onClick={() => { setGone((g) => new Set([...g, ...pick])); setPick(new Set()); }}>Delete</ToolbarButton>
        </Toolbar>
      </Phone>
    );
  },
};

/** `emptyState`: the list shows it when no section has rows (here a search that matches nothing). It defaults to a
 *  small `EmptyState` titled "No items". */
export const EmptyState: Story = {
  render: () => (
    <Phone h={480}>
      <NavigationStack pages={['empty']}>
        <NavigationStackPage value="empty">
          <NavigationStackBar><NavigationStackTitle>Contacts</NavigationStackTitle></NavigationStackBar>
          <NavigationStackContent>
            <NavigationStackLargeTitle />
            <NavigationStackSubheader>
              <SearchInput aria-label="Search contacts" value="zzzz" onValueChange={() => undefined} />
            </NavigationStackSubheader>
            <List emptyState={<EmptyStateView size="sm" icon={<Icon name="magnifyingglass" />} title="No Results" description="No contacts match “zzzz”." />}>
              <ListSection sticky title="Z">{[]}</ListSection>
            </List>
          </NavigationStackContent>
        </NavigationStackPage>
      </NavigationStack>
    </Phone>
  ),
};

const tile = (glyph: string, bg: string) => (
  <span aria-hidden className="grid size-[29px] place-items-center rounded-md text-white" style={{ background: bg }}>
    <Icon name={glyph} size={17} sw={2.2} />
  </span>
);

/** An iOS Settings screen: `variant="inset"` sections with grouped titles and footers, icon tiles, values,
 *  switches, a disabled row and a centered destructive button row. */
function SettingsDemo({ density }: { density?: 'compact' | 'default' | 'comfortable' }) {
  const [airplane, setAirplane] = useState(false);
  return (
    <List variant="inset" density={density}>
      <ListSection title="Connectivity">
        <ListRow icon={tile('airplane', 'var(--warning)')} title="Airplane Mode"
          accessory={<Switch checked={airplane} onCheckedChange={setAirplane} />} />
        <ListRow icon={tile('wifi', 'var(--primary)')} title="Wi-Fi" trailing={<span className="text-muted-foreground">Home</span>}
          accessory="chevron" onClick={() => undefined} />
        <ListRow icon={tile('hotspot', 'var(--success)')} title="Personal Hotspot" description="Not available on this plan"
          accessory="chevron" onClick={() => undefined} disabled divider={false} />
      </ListSection>
      <ListSection title="Contacts table view"
        footer="UITableView styles: .plain keeps sticky letter headers; .insetGrouped floats each letter section as a card.">
        {CONTACTS.slice(0, 3).map((c, i) => (
          <ListRow key={c.id} title={c.f + ' ' + c.l} description={c.role} icon={<Avatar name={`${c.f} ${c.l}`} size={34} />}
            accessory="chevron" onClick={() => undefined} current={i === 0} divider={i < 2} />
        ))}
      </ListSection>
      <ListSection>
        <ListRow title="Sign Out" justify="center" tone="destructive" onClick={() => undefined} divider={false} />
      </ListSection>
    </List>
  );
}

function SettingsScreen({ density }: { density?: 'compact' | 'default' | 'comfortable' }) {
  return (
    <NavigationStack pages={['settings']}>
      <NavigationStackPage value="settings" variant="grouped">
        <NavigationStackBar><NavigationStackTitle>Settings</NavigationStackTitle></NavigationStackBar>
        <NavigationStackContent>
          <NavigationStackLargeTitle />
          <SettingsDemo density={density} />
        </NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>
  );
}

/** Section titles and footers, a `current` row, a `disabled` row, and a centered `tone="destructive"` button row. */
export const WithFooter: Story = { render: () => <Phone h={760}><SettingsScreen /></Phone> };
export const WithFooterDark: Story = { render: () => <Phone h={760} dark><SettingsScreen /></Phone> };

/** `density`: `compact` 36px rows, `default` 46px, `comfortable` 56px. */
export const Density: Story = {
  render: () => (
    <Pad w={1000}><div className="grid grid-cols-3 gap-2">
      {(['compact', 'default', 'comfortable'] as const).map((d) => (
        <div key={d}>
          <div className="mb-2 px-4 text-footnote text-muted-foreground">{d}</div>
          <List variant="inset" density={d}>
            <ListSection>
              <ListRow icon={tile('wifi', 'var(--primary)')} title="Wi-Fi" trailing={<span className="text-muted-foreground">Home</span>} accessory="chevron" onClick={() => undefined} />
              <ListRow icon={tile('bluetooth', 'var(--primary)')} title="Bluetooth" trailing={<span className="text-muted-foreground">On</span>} accessory="chevron" onClick={() => undefined} divider={false} />
            </ListSection>
          </List>
        </div>
      ))}
    </div></Pad>
  ),
};

/** Controls: `variant` and `density` on a small list. */
export const Playground: Story = {
  args: { variant: 'inset', density: 'default' },
  render: (args) => (
    <Pad w={420}>
      <List {...args}>
        <ListSection title="General" footer="Rows press, drill in, or hold a control.">
          <ListRow icon={tile('gear', 'var(--muted-foreground)')} title="About" accessory="chevron" onClick={() => undefined} />
          <ListRow icon={tile('arrow-clockwise', 'var(--muted-foreground)')} title="Software Update" description="iOS 26.1" accessory="chevron" onClick={() => undefined} />
          <ListRow icon={tile('moon', 'var(--primary)')} title="Dark Appearance" accessory={<Switch defaultChecked />} divider={false} />
        </ListSection>
      </List>
    </Pad>
  ),
};

/* ── Animated insert / remove / reorder ── */

const PLAYLIST = ['Golden Hour', 'Nightcall', 'Midnight City', 'Heat Waves', 'Dreams', 'Cruel Summer', 'Redbone', 'Motion Sickness'];

function ReorderDemo({ startEditing = true }: { startEditing?: boolean }) {
  const [songs, setSongs] = useState(PLAYLIST.slice(0, 5));
  const [edit, setEdit] = useState(startEditing);
  const move = (from: number, to: number) => setSongs((s) => { const n = [...s]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
  const add = () => setSongs((s) => { const next = PLAYLIST.find((t) => !s.includes(t)); return next ? [next, ...s] : s; });
  const bar = (label: string, on: () => void) => (
    <button className="bl-btn" onClick={on}
      style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--primary)', fontFamily: 'inherit', fontSize: 17, padding: '8px 10px' }}>{label}</button>
  );
  return (
    <NavigationStack pages={['up-next']}>
      <NavigationStackPage value="up-next" variant="grouped">
        <NavigationStackBar>
          <NavigationStackLeading>{bar('Add', add)}</NavigationStackLeading>
          <NavigationStackTitle>Up Next</NavigationStackTitle>
          <NavigationStackTrailing>{bar(edit ? 'Done' : 'Edit', () => setEdit(!edit))}</NavigationStackTrailing>
        </NavigationStackBar>
        <NavigationStackContent>
        <NavigationStackLargeTitle />
        <List variant="inset">
          <ListSection animate onOrderChange={edit ? (_, { from, to }) => move(from, to) : undefined}
            footer={edit ? 'Drag a grip, or focus it and press Space, ↑/↓, Space.' : 'Add inserts at the top; swipe a row to remove it.'}>
            {songs.map((t, i) => (
              <ListRow key={t} title={t} description={`Track ${PLAYLIST.indexOf(t) + 1}`}
                icon={<span aria-hidden style={{ width: 34, height: 34, borderRadius: 7, background: `hsl(${PLAYLIST.indexOf(t) * 45} 70% 60%)` }} />}
                trailingActions={edit ? undefined : [{ label: 'Remove', icon: 'trash', destructive: true, onAction: () => setSongs((s) => s.filter((x) => x !== t)) }]}
                divider={i < songs.length - 1} />
            ))}
          </ListSection>
        </List>
        </NavigationStackContent>
      </NavigationStackPage>
    </NavigationStack>
  );
}

/** `ListSection animate`: keyed rows grow in, collapse out and slide on reorder. `onOrderChange` adds a grip to
 *  every row — drag it, or focus it and press Space, ↑/↓, Space. */
export const AnimatedReorder: Story = { render: () => <Phone h={600}><ReorderDemo /></Phone> };
export const AnimatedReorderDark: Story = { render: () => <Phone h={600} dark><ReorderDemo /></Phone> };
