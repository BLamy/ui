/* SplitView compositions shared by the stories and the docs: Mail (three columns), Notes (two columns),
   Settings (sidebar + detail), Reminders (tinted rows, shared-selection sections, large titles), Library (a
   nested push/pop stack in the detail), Notes gallery (the supplementary column steps aside) and a frame you
   can drag to resize (UI SDK's Resizable). Each is a plain composition of the public SplitView parts — nothing
   here reaches into the component. Hover cards preview what a press opens, as the real apps do: a sender's
   contact card on their avatar, a reminders list's first items on its sidebar row (`SplitViewItem preview`), an
   album's tracks on its cover. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card';
import { ListRow, ListSection } from '@/components/ui/list';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackLeading, NavigationStackPage, NavigationStackTitle,
  NavigationStackTrailing, useNavigationStack,
} from '@/components/ui/navigation-stack';
import { SplitView, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, SplitViewSupplementary, SplitViewSidebarTrigger, useSplitView, type SplitViewProps } from '@/components/ui/split-view';
import { Switch } from '@/components/ui/switch';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/** iOS system colors the demo's app icons and lists are painted in (content, fixed in both appearances). */
const SYSTEM = {
  blue: '#0A84FF', blueClassic: '#007AFF', red: '#FF3B30', pink: '#FF2D55', indigo: '#5E5CE6', purple: '#5856D6',
  green: '#34C759', orange: '#FF9500',
} as const;

/** The demo's stroke glyphs (24×24 paths), keyed by name. */
const DEMO_ICONS: Record<string, string> = {
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.2-4.2',
  plus: 'M12 5v14M5 12h14',
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1.5 2h3L15 13h5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  bell: 'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.6-2.5 15.4 0 18c2.5-2.6 2.5-15.4 0-18',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  draft: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  folder: 'M3 6h6l2 2h10v11H3z',
  note: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4',
  wifi: 'M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  sound: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11',
  display: 'M3 4h18v12H3zM8 20h8M12 16v4',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 018 0v4',
  reply: 'M10 9V5l-7 7 7 7v-4c5 0 8 1.5 11 5-1-5-4-10-11-11z',
  compose: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4M14 20h6',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM20 16a3 3 0 11-6 0 3 3 0 016 0z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  album: 'M3 3h18v18H3zM12 12m-4 0a4 4 0 108 0 4 4 0 10-8 0M12 12h.01',
};
const PATHS = DEMO_ICONS;

/** Stroke glyph from the demo icon set. */
export function DemoGlyph({ name, size = 20, sw = 1.9 }: { name: string; size?: number; sw?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.doc} />
    </svg>
  );
}

function BarButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <Button variant="plain" size="icon-sm" aria-label={label} onClick={onClick}
      className="rounded-ctl px-2.5 py-2 transition-[background,scale] duration-150 hover:bg-secondary hover:not-data-disabled:opacity-100 active:not-aria-expanded:not-data-disabled:scale-[.94] focus-visible:ring-offset-0">
      {children}
    </Button>
  );
}

type DemoProps = Omit<SplitViewProps, 'children'> & { className?: string; style?: CSSProperties };

/* ── Mail: sidebar · list · message ── */
interface Msg { id: string; from: [string, string]; subject: string; preview: string; time: string; unread?: boolean; flagged?: boolean }
const MAILBOXES = [
  { id: 'inbox', title: 'Inbox', icon: 'inbox', count: 4 },
  { id: 'vip', title: 'VIP', icon: 'user' },
  { id: 'flagged', title: 'Flagged', icon: 'flag', count: 2 },
  { id: 'drafts', title: 'Drafts', icon: 'draft', count: 1 },
  { id: 'sent', title: 'Sent', icon: 'send' },
  { id: 'archive', title: 'Archive', icon: 'archive' },
  { id: 'trash', title: 'Trash', icon: 'trash' },
];
const MAIL: Record<string, Msg[]> = {
  inbox: [
    { id: 'm1', from: ['Amelia', 'Adler'], subject: 'Spring presets, round two', preview: 'I sampled the smooth preset into linear() and it matches framer to within a pixel. Want to swap the drawer over?', time: '9:41', unread: true, flagged: true },
    { id: 'm2', from: ['Wei', 'Chen'], subject: 'SplitView review', preview: 'Columns persist between size classes now — the detail slides into the stack instead of remounting.', time: '9:12', unread: true },
    { id: 'm3', from: ['Anya', 'Kowalski'], subject: 'Dark mode hairlines', preview: 'Separators at 48% read a touch heavy on the sidebar tint. Could we try the fill token instead?', time: '8:03', unread: true },
    { id: 'm4', from: ['Hana', 'Sato'], subject: 'Offsite agenda', preview: 'Tuesday is prototyping, Wednesday is the motion review. Bring your gnarliest interruptions.', time: 'Yesterday', unread: true },
    { id: 'm5', from: ['Luca', 'Moretti'], subject: 'Re: Animation timing on Android', preview: 'Spring curves are fine but the settle feels mushy below 10ms. Numbers attached.', time: 'Yesterday' },
    { id: 'm6', from: ['Noor', 'Haddad'], subject: 'Docs screenshots', preview: 'Light and dark captures for every live example are in the shared folder.', time: 'Mon' },
    { id: 'm7', from: ['Tomás', 'Ruiz'], subject: 'Keyboard support', preview: 'Arrow keys resize the dividers now, Home and End snap to the limits.', time: 'Sun' },
  ],
  vip: [
    { id: 'v1', from: ['Amelia', 'Adler'], subject: 'Spring presets, round two', preview: 'I sampled the smooth preset into linear()…', time: '9:41', flagged: true },
  ],
  flagged: [
    { id: 'f1', from: ['Amelia', 'Adler'], subject: 'Spring presets, round two', preview: 'I sampled the smooth preset into linear()…', time: '9:41', flagged: true },
    { id: 'f2', from: ['Iris', 'Lindqvist'], subject: 'Contract renewal', preview: 'Signed copy attached, thanks for turning it around so fast.', time: 'Fri', flagged: true },
  ],
  drafts: [{ id: 'd1', from: ['Brett', 'Lamy'], subject: 'Continuity notes', preview: 'An element that persists between states stays in place and morphs…', time: 'Thu' }],
  sent: [{ id: 's1', from: ['Brett', 'Lamy'], subject: 'Re: SplitView review', preview: 'Agreed — the sidebar should tile at regular and float at medium.', time: '9:20' }],
  archive: [], trash: [],
};

function MailSidebar() {
  return (
    <SplitViewSidebar aria-label="Mailboxes">
      <SplitViewHeader title="Mailboxes" trailing={<BarButton label="Edit mailboxes"><span className="text-body">Edit</span></BarButton>} />
      <SplitViewContent className="px-2.5 pb-4">
        <SplitViewSection title="iCloud">
          {MAILBOXES.map((m) => (
            <SplitViewItem key={m.id} value={m.id} title={m.title} icon={<DemoGlyph name={m.icon} />} trailing={m.count} />
          ))}
        </SplitViewSection>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}

function MailList() {
  const s = useSplitView();
  const box = MAILBOXES.find((m) => m.id === s.value.sidebar) ?? MAILBOXES[0];
  const [q, setQ] = useState('');
  const msgs = (MAIL[box.id] ?? []).filter((m) => !q || (m.subject + m.preview + m.from.join(' ')).toLowerCase().includes(q.toLowerCase()));
  return (
    <SplitViewSupplementary aria-label={box.title}>
      <SplitViewHeader title={box.title} leading={<SplitViewSidebarTrigger />}
        trailing={<BarButton label="New message"><DemoGlyph name="compose" size={21} /></BarButton>} />
      <SplitViewContent>
        <div className="px-4 pt-2.5 pb-2"><SearchInput value={q} onValueChange={setQ} /></div>
        {msgs.length === 0 ? <EmptyState className="h-48" title="No Mail" description={q ? `Nothing matches “${q}”` : undefined} /> : null}
        {msgs.map((m) => (
          <SplitViewItem key={m.id} value={m.id} className="items-start py-3 pl-7">
            {m.unread ? <span aria-label="Unread" className="absolute top-[18px] left-2.5 size-[9px] rounded-full bg-primary" /> : null}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-callout font-semibold">{m.from.join(' ')}</span>
                {m.flagged ? <span className="text-warning"><DemoGlyph name="flag" size={13} sw={2.4} /></span> : null}
                <span className="shrink-0 text-detail text-muted-foreground">{m.time}</span>
              </span>
              <span className="mt-0.5 block truncate text-subhead">{m.subject}</span>
              <span className="mt-0.5 line-clamp-2 text-[14.5px] leading-[1.35] text-muted-foreground">{m.preview}</span>
            </span>
          </SplitViewItem>
        ))}
      </SplitViewContent>
    </SplitViewSupplementary>
  );
}

/** A sender's contact card: who they are and what else they've sent. */
function SenderCard({ from }: { from: [string, string] }) {
  const theirs = [...new Map(Object.values(MAIL).flat().filter((m) => m.from.join() === from.join()).map((m) => [m.subject, m])).values()];
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader icon={<Avatar name={`${from[0]} ${from[1]}`} size={44} />} title={from.join(' ')}
        description={`${from[0].toLowerCase()}.${from[1].toLowerCase()}@icloud.com`} />
      <div className="flex flex-col gap-1">
        <div className="text-footnote font-semibold text-muted-foreground">{theirs.length} {theirs.length === 1 ? 'message' : 'messages'}</div>
        {theirs.slice(0, 3).map((m) => (
          <div key={m.id} className="flex items-baseline gap-2 text-footnote">
            <span className="min-w-0 flex-1 truncate">{m.subject}</span>
            <span className="shrink-0 text-muted-foreground">{m.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MailMessage() {
  const s = useSplitView();
  const all = Object.values(MAIL).flat();
  const m = all.find((x) => x.id === s.value.supplementary);
  return (
    <SplitViewDetail aria-label="Message">
      <SplitViewHeader
        trailing={m ? <>
          <BarButton label="Flag"><DemoGlyph name="flag" /></BarButton>
          <BarButton label="Archive"><DemoGlyph name="archive" /></BarButton>
          <BarButton label="Reply"><DemoGlyph name="reply" /></BarButton>
        </> : null} />
      {m ? (
        <SplitViewContent>
          <article className="mx-auto max-w-[680px] px-6 pt-5 pb-10">
            <div className="flex items-center gap-3">
              <Avatar name={`${m.from[0]} ${m.from[1]}`} size={44} card={<SenderCard from={m.from} />} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">{m.from.join(' ')}</span>
                  <span className="shrink-0 text-detail text-muted-foreground">{m.time}</span>
                </div>
                <div className="truncate text-detail text-muted-foreground">To: Brett Lamy</div>
              </div>
            </div>
            <h2 className="mt-5 mb-4 border-0 text-[24px] leading-[1.2] font-bold tracking-[-.4px]">{m.subject}</h2>
            <div className="flex flex-col gap-3.5 text-callout leading-[1.55]">
              <p className="m-0">Hi Brett,</p>
              <p className="m-0">{m.preview}</p>
              <p className="m-0">I tried it at every size: tiled at regular, floating over the list at medium, and as a stack on the phone. The column I was reading stays where it is and just changes shape, so nothing flashes and the scroll position survives.</p>
              <p className="m-0">Let me know if you want me to record a pass at half speed for the review.</p>
              <p className="m-0 text-muted-foreground">— {m.from[0]}</p>
            </div>
          </article>
        </SplitViewContent>
      ) : (
        <EmptyState icon={<DemoGlyph name="inbox" sw={1.2} />} title="No Message Selected" />
      )}
    </SplitViewDetail>
  );
}

/** Mail: mailboxes · message list · message. */
export function SplitViewMailDemo({ defaultValue, ...props }: DemoProps) {
  return (
    <SplitView aria-label="Mail" defaultValue={defaultValue ?? { sidebar: 'inbox', supplementary: 'm2' }} {...props}>
      <MailSidebar />
      <MailList />
      <MailMessage />
    </SplitView>
  );
}

/* ── Notes: list · editor (two columns) ── */
const NOTES = [
  { id: 'n1', title: 'Family Values', date: '9:02', body: 'Simplicity, fluidity, delight. Things fly, they never teleport. Direction follows the gesture. An element that persists between two states stays put and morphs.' },
  { id: 'n2', title: 'Spring presets', date: 'Yesterday', body: 'snappy 620/48 for small controls · smooth 380/40 for layout · tray 520/44 for sheets · bouncy 520/26 for rare, celebratory moments only.' },
  { id: 'n3', title: 'Gradual revelation', date: 'Mon', body: 'Show the fundamentals, reveal the rest when it becomes relevant. The sidebar hides at medium width and floats in when asked for.' },
  { id: 'n4', title: 'Groceries', date: 'Sun', body: 'Oat milk, lemons, sourdough, basil, parmesan, coffee beans.' },
  { id: 'n5', title: 'Reading list', date: 'Sat', body: 'Designing Fluid Interfaces (WWDC 2018) · The Shape of Design · Family Values.' },
];

/** Notes: a two-column split — the list is the sidebar, the toggle hides it for a full-width editor. */
export function SplitViewNotesDemo({ defaultValue, listWidth = 300, ...props }: DemoProps & { listWidth?: number }) {
  return (
    <SplitView aria-label="Notes" defaultValue={defaultValue ?? { sidebar: 'n1' }} defaultCompactColumn="sidebar" {...props}>
      <SplitViewSidebar aria-label="Notes" width={listWidth} minWidth={Math.min(200, listWidth)} className="bg-background">
        <SplitViewHeader title="Notes" trailing={<BarButton label="New note"><DemoGlyph name="compose" size={21} /></BarButton>} />
        <SplitViewContent className="px-2.5 pt-1 pb-4">
          <SplitViewSection title="Today">{NOTES.map((n) => (
            <SplitViewItem key={n.id} value={n.id} variant="pill" title={<span className="font-semibold">{n.title}</span>}
              description={<><span className="mr-1.5">{n.date}</span>{n.body}</>} className="py-2" />
          ))}</SplitViewSection>
        </SplitViewContent>
      </SplitViewSidebar>
      <NotesEditor />
    </SplitView>
  );
}

function NotesEditor() {
  const s = useSplitView();
  const n = NOTES.find((x) => x.id === s.value.sidebar);
  return (
    <SplitViewDetail aria-label="Note">
      <SplitViewHeader leading={<SplitViewSidebarTrigger />} trailing={<BarButton label="Share"><DemoGlyph name="send" /></BarButton>} />
      {n ? (
        <SplitViewContent>
          <div className="mx-auto max-w-[680px] px-7 pt-4 pb-10">
            <div className="text-center text-footnote text-muted-foreground">{n.date}</div>
            <h2 className="mt-3 mb-3 text-[28px] leading-[1.15] font-bold tracking-[-.5px]">{n.title}</h2>
            <p className="m-0 text-body leading-[1.55]">{n.body}</p>
          </div>
        </SplitViewContent>
      ) : <EmptyState icon={<DemoGlyph name="note" sw={1.2} />} title="No Note Selected" />}
    </SplitViewDetail>
  );
}

/* ── Settings: sidebar · detail ── */
const SETTINGS = [
  { id: 'wifi', title: 'Wi-Fi', icon: 'wifi', color: SYSTEM.blue, value: 'Studio' },
  { id: 'notifications', title: 'Notifications', icon: 'bell', color: SYSTEM.red },
  { id: 'sounds', title: 'Sounds', icon: 'sound', color: SYSTEM.pink },
  { id: 'focus', title: 'Focus', icon: 'moon', color: SYSTEM.indigo },
  { id: 'display', title: 'Display & Brightness', icon: 'display', color: SYSTEM.blue },
  { id: 'privacy', title: 'Privacy & Security', icon: 'lock', color: SYSTEM.green },
];
const Tile = ({ icon, color }: { icon: string; color: string }) => (
  <span className="grid size-[28px] place-items-center rounded-[7px] bg-(--tile) text-white" style={{ '--tile': color } as CSSProperties}><DemoGlyph name={icon} size={17} sw={2.1} /></span>
);

function SettingsPane() {
  const s = useSplitView();
  const cur = SETTINGS.find((x) => x.id === s.value.sidebar);
  const [on, setOn] = useState<Record<string, boolean>>({ a: true, b: false, c: true });
  const flip = (k: string) => (v: boolean) => setOn((o) => ({ ...o, [k]: v }));
  return (
    <SplitViewDetail aria-label={cur?.title ?? 'Settings'} className="bg-muted">
      <SplitViewHeader title={cur?.title} leading={<SplitViewSidebarTrigger />} className="bg-muted" />
      {cur ? (
        <SplitViewContent>
          <div className="mx-auto max-w-[620px] px-5 pt-5 pb-10">
            <div className="mb-6 flex flex-col items-center rounded-card bg-card px-6 py-6 text-center">
              <span className="grid size-[58px] place-items-center rounded-card bg-(--tile) text-white" style={{ '--tile': cur.color } as CSSProperties}><DemoGlyph name={cur.icon} size={32} sw={1.9} /></span>
              <div className="mt-3 text-[22px] font-bold tracking-[-.3px]">{cur.title}</div>
              <div className="mt-1 max-w-[360px] text-detail leading-[1.4] text-muted-foreground">Adjust how {cur.title.toLowerCase()} behaves on this device and everywhere you’re signed in.</div>
            </div>
            <ListSection>
              <ListRow title={cur.title} trailing={<Switch checked={on.a} onCheckedChange={flip('a')} aria-label={cur.title} />} />
              <ListRow title="Show Previews" trailing={<Switch checked={on.b} onCheckedChange={flip('b')} aria-label="Show previews" />} />
              <ListRow title="Allow on Lock Screen" trailing={<Switch checked={on.c} onCheckedChange={flip('c')} aria-label="Allow on lock screen" />} divider={false} />
            </ListSection>
            <ListSection title="Options" footer="Changes sync to your other devices.">
              <ListRow title="Schedule" accessory="chevron" onClick={() => undefined} />
              <ListRow title="Customize" accessory="chevron" onClick={() => undefined} divider={false} />
            </ListSection>
          </div>
        </SplitViewContent>
      ) : <EmptyState title="Choose a setting" />}
    </SplitViewDetail>
  );
}

/** Settings: sidebar sections, grouped detail. */
export function SplitViewSettingsDemo({ defaultValue, ...props }: DemoProps) {
  return (
    <SplitView aria-label="Settings" defaultValue={defaultValue ?? { sidebar: 'notifications' }} defaultCompactColumn="sidebar" {...props}>
      <SplitViewSidebar aria-label="Settings" width={300}>
        <SplitViewHeader title="Settings" />
        <SplitViewContent className="px-2.5 pb-4">
          <div className="my-3 flex items-center gap-3 rounded-panel bg-card px-3 py-2.5">
            <Avatar name="Brett Lamy" size={44} />
            <div className="min-w-0"><div className="truncate text-callout font-semibold">Brett Lamy</div><div className="truncate text-footnote text-muted-foreground">Account, iCloud, Media</div></div>
          </div>
          <div className="flex flex-col gap-px">
            {SETTINGS.map((x) => <SplitViewItem key={x.id} value={x.id} title={x.title} icon={<Tile icon={x.icon} color={x.color} />} trailing={x.value} />)}
          </div>
        </SplitViewContent>
      </SplitViewSidebar>
      <SettingsPane />
    </SplitView>
  );
}

/* ── Resizable frame: drag the handle and watch the split morph between size classes ── */
export interface SplitViewResizableDemoProps {
  children: ReactNode;
  /** Starting width, px. */
  initial?: number;
  min?: number;
  max?: number;
  height?: number;
  /** Breakpoints the child SplitView uses, so the readout can name the class. */
  breakpoints?: { medium: number; regular: number };
}
/** A frame with a drag handle on its trailing edge (UI SDK's Resizable: drag it, or focus it and use the arrows);
 *  the readout shows the width and size class. */
export function SplitViewResizableDemo({ children, initial = 900, min = 320, max = 1200, height = 520, breakpoints = { medium: 640, regular: 1024 } }: SplitViewResizableDemoProps) {
  const [host, hostW] = useContainerWidth<HTMLDivElement>(max + 20);
  const [share, setShare] = useState<number | null>(null);
  const w = share == null ? Math.min(initial, hostW) : (share / 100) * hostW;
  const wc = w >= breakpoints.regular ? 'regular' : w >= breakpoints.medium ? 'medium' : 'compact';
  return (
    <div data-slot="split-view-resizable-demo" className="flex w-full flex-col items-start gap-2.5">
      <div className="flex items-center gap-2 text-[12.5px] text-foreground/70 tabular-nums">
        {(['compact', 'medium', 'regular'] as const).map((c) => (
          <span key={c} className={cn('rounded-full px-2.5 py-1 font-semibold transition-colors duration-200', c === wc ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>{c}</span>
        ))}
        <span className="ml-1">{Math.round(w)}px</span>
      </div>
      <div ref={host} className="w-full">
        <Resizable onLayoutChange={(layout) => setShare(layout[0] ?? null)} className="flex h-(--frame-h) w-full"
          style={{ '--frame-h': height + 'px' } as CSSProperties}>
          <ResizablePanel defaultSize={`${initial}px`} minSize={`${min}px`} maxSize={`${max}px`}
            className="relative overflow-hidden rounded-card shadow-[0_0_0_1px_var(--border),0_10px_30px_--alpha(black/12%)]">
            {children}
          </ResizablePanel>
          <ResizableHandle aria-label="Resize frame" className="group grid w-5 shrink-0 cursor-col-resize place-items-center outline-none">
            <span className={cn('h-12 w-[5px] rounded-full bg-tertiary-foreground transition-[background,scale] duration-150 group-hover:bg-muted-foreground',
              'group-focus-visible:scale-y-110 group-focus-visible:bg-primary group-data-dragging:scale-y-110 group-data-dragging:bg-primary')} />
          </ResizableHandle>
          <ResizablePanel />
        </Resizable>
      </div>
    </div>
  );
}

/* ── Reminders: tinted rows, one list in two sections, large titles ── */
interface RList { title: string; color: string; icon: string; items: string[] }
const RLISTS: Record<string, RList> = {
  today: { title: 'Today', color: SYSTEM.blueClassic, icon: 'cal', items: ['Book the cabin ferry', 'Call Mom back', 'Review SplitView PR', 'Water the ferns'] },
  scheduled: { title: 'Scheduled', color: SYSTEM.red, icon: 'clock', items: ['Dentist — Thu 9:30', 'Renew passport', 'Offsite prep'] },
  flagged: { title: 'Flagged', color: SYSTEM.orange, icon: 'flag', items: ['Contract renewal', 'Spring presets, round two'] },
  groceries: {
    title: 'Groceries', color: SYSTEM.green, icon: 'list',
    items: ['Oat milk', 'Lemons', 'Sourdough', 'Basil', 'Parmesan', 'Coffee beans', 'Olive oil', 'Tomatoes', 'Garlic', 'Rigatoni', 'Sparkling water', 'Dark chocolate', 'Eggs', 'Butter', 'Honey', 'Yogurt'],
  },
  work: { title: 'Work', color: SYSTEM.purple, icon: 'list', items: ['Motion review notes', 'Docs screenshots', 'Latency numbers', 'Hiring loop'] },
  travel: { title: 'Travel', color: SYSTEM.pink, icon: 'list', items: ['Adapter', 'Tokyo rail pass', 'Hotel confirmation'] },
};

/** A list's first few reminders, beside its sidebar row. */
function RListCard({ l }: { l: RList }) {
  const more = l.items.length - 5;
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader
        icon={<span className="grid size-9 place-items-center rounded-full bg-(--c) text-white" style={{ '--c': l.color } as CSSProperties}><DemoGlyph name={l.icon} size={19} sw={2.4} /></span>}
        title={l.title} description={`${l.items.length} reminders`} />
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {l.items.slice(0, 5).map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-footnote">
            <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--c)]" style={{ '--c': l.color } as CSSProperties} />
            <span className="min-w-0 flex-1 truncate">{t}</span>
          </li>
        ))}
        {more > 0 ? <li className="pl-6 text-footnote text-muted-foreground">{more} more</li> : null}
      </ul>
    </div>
  );
}

function RListItem({ id }: { id: string }) {
  const l = RLISTS[id];
  return (
    <SplitViewItem value={id} tint={l.color} title={l.title} trailing={l.items.length} preview={<RListCard l={l} />}
      icon={
        <span className="grid size-[26px] place-items-center rounded-full bg-(--split-item-tint) text-white transition-colors duration-150 group-data-current/item:bg-white group-data-current/item:text-(--split-item-tint)">
          <DemoGlyph name={l.icon} size={15} sw={2.4} />
        </span>
      } />
  );
}

function RemindersList({ scrolled }: { scrolled?: boolean }) {
  const s = useSplitView();
  const id = s.value.sidebar ?? 'today';
  const l = RLISTS[id] ?? RLISTS.today;
  const marker = useRef<HTMLDivElement | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // After the frame's layout, so the large title is already at the top of the scroll.
    const sc = marker.current?.parentElement;
    if (!scrolled || !sc) return;
    const frame = requestAnimationFrame(() => { sc.scrollTop = 160; });
    return () => cancelAnimationFrame(frame);
  }, [scrolled]);
  return (
    <SplitViewDetail aria-label={l.title}>
      <SplitViewHeader title={l.title} largeTitle leading={<SplitViewSidebarTrigger />}
        trailing={<BarButton label="Add reminder"><DemoGlyph name="plus" size={22} /></BarButton>} />
      <SplitViewContent key={id} className="text-(--list-color)" style={{ '--list-color': l.color } as CSSProperties}>
        <div ref={marker} className="pb-8 text-foreground">
          {l.items.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-3 pl-4">
              {/* The kit's round Checkbox, filled with the list's colour once checked; the label's text names it. */}
              <Checkbox checked={!!done[t]} onCheckedChange={(checked) => setDone((d) => ({ ...d, [t]: checked === true }))}
                className="peer border-0 shadow-[inset_0_0_0_1.6px_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))] focus-visible:ring-2 focus-visible:ring-ring data-checked:bg-(--c) data-checked:shadow-none"
                style={{ '--c': l.color } as CSSProperties}>
                {done[t] ? <span className="size-2 rounded-full bg-white" /> : null}
              </Checkbox>
              <span className="min-w-0 flex-1 truncate py-[11px] pr-4 text-body shadow-hairline-b peer-data-checked:text-muted-foreground">{t}</span>
            </label>
          ))}
        </div>
      </SplitViewContent>
    </SplitViewDetail>
  );
}

/** Reminders: each list selects in its own colour (`tint`), Groceries sits in Pinned *and* My Lists and
 *  highlights in both, and both columns use large titles that fold into the bar as you scroll. */
export function SplitViewRemindersDemo({ defaultValue, scrolled, ...props }: DemoProps & { scrolled?: boolean }) {
  return (
    <SplitView aria-label="Reminders" defaultValue={defaultValue ?? { sidebar: 'groceries' }} defaultCompactColumn="sidebar"
      defaultSidebarOpen={{ medium: true }} sidebarBehavior="tile" {...props}>
      <SplitViewSidebar aria-label="Lists" width={290} className="bg-muted">
        <SplitViewHeader title="Lists" largeTitle className="bg-muted" trailing={<BarButton label="Add list"><DemoGlyph name="plus" size={22} /></BarButton>} />
        <SplitViewContent>
          <div className="px-2.5 pb-4">
            <SplitViewSection title="Pinned">{['today', 'groceries'].map((id) => <RListItem key={id} id={id} />)}</SplitViewSection>
            <SplitViewSection title="Smart Lists" collapsible>{['scheduled', 'flagged'].map((id) => <RListItem key={id} id={id} />)}</SplitViewSection>
            <SplitViewSection title="My Lists" collapsible>{['groceries', 'work', 'travel'].map((id) => <RListItem key={id} id={id} />)}</SplitViewSection>
          </div>
        </SplitViewContent>
      </SplitViewSidebar>
      <RemindersList scrolled={scrolled} />
    </SplitView>
  );
}

/* ── Library: a push/pop stack inside the detail column ── */
interface Album { id: string; title: string; artist: string; year: number; hue: number; tracks: string[] }
const ALBUMS: Album[] = [
  { id: 'tidewater', title: 'Neon Tidewater', artist: 'The Paper Moons', year: 2025, hue: 196, tracks: ['Low Tide Radio', 'Glass Harbour', 'Undertow', 'Salt Lines', 'Lighthouse Hum'] },
  { id: 'orchard', title: 'Quiet Orchard', artist: 'Mara Vell', year: 2024, hue: 32, tracks: ['First Frost', 'Windfall', 'Cider House', 'Long Rows'] },
  { id: 'static', title: 'Soft Static', artist: 'Kilo & The Hum', year: 2025, hue: 280, tracks: ['Dial Tone', 'Night Bus', 'Carrier Wave', 'Hiss', 'Last Station', 'Off Air'] },
  { id: 'meridian', title: 'Meridian', artist: 'Ottoline', year: 2023, hue: 350, tracks: ['Noon', 'Equator', 'Parallax', 'Dusk Line'] },
  { id: 'fernweh', title: 'Fernweh', artist: 'Lumen Drift', year: 2024, hue: 140, tracks: ['Departure Board', 'Border Towns', 'Ferry', 'Home Again'] },
];
const SECTIONS_LIB = [
  { id: 'recent', title: 'Recently Added Albums', short: 'Recently Added', icon: 'clock' },
  { id: 'albums', title: 'Albums', short: 'Albums', icon: 'album' },
  { id: 'songs', title: 'Songs', short: 'Songs', icon: 'music' },
];
const Cover = ({ a, className }: { a: Album; className?: string }) => (
  <span aria-hidden="true" className={cn('block shrink-0 rounded-lg shadow-[0_2px_10px_black] shadow-black/18', className)}
    style={{ background: `linear-gradient(135deg, hsl(${a.hue} 80% 62%), hsl(${a.hue + 40} 70% 38%))` }} />
);

/** An album's cover, credits line and first tracks, over its tile in the grid. */
function AlbumCard({ a }: { a: Album }) {
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader icon={<Cover a={a} className="size-12" />} title={a.title} description={`${a.artist} · ${a.year} · ${a.tracks.length} songs`} />
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {a.tracks.slice(0, 4).map((t, i) => (
          <li key={t} className="flex items-baseline gap-2.5 text-footnote">
            <span className="w-3 text-right text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{t}</span>
          </li>
        ))}
      </ol>
      {a.tracks.length > 4 ? <div className="pl-[22px] text-footnote text-muted-foreground">{a.tracks.length - 4} more</div> : null}
    </div>
  );
}

/** A page of the detail column's stack, by key: `album:<id>`, or `credits:<id>:<track>`. */
function LibraryPage({ page }: { page: string }) {
  const [kind, id, track] = page.split(':');
  const a = ALBUMS.find((x) => x.id === id);
  if (!a) return null;
  return kind === 'credits' ? <TrackPage value={page} a={a} track={a.tracks[Number(track)] ?? ''} /> : <AlbumPage value={page} a={a} />;
}

function TrackPage({ value, a, track }: { value: string; a: Album; track: string }) {
  return (
    <NavigationStackPage value={value}>
      <NavigationStackBar><NavigationStackTitle>Credits</NavigationStackTitle></NavigationStackBar>
      <NavigationStackContent>
        <div className="mx-auto max-w-[560px] px-6 pt-4 pb-10">
          <div className="text-[22px] font-bold tracking-[-.3px]">{track}</div>
          <div className="mt-1 mb-2 text-subhead text-muted-foreground">{a.artist} · {a.title}</div>
          <ListSection title="Performed by">
            <ListRow title={a.artist} />
            <ListRow title="Strings — The Harbour Quartet" divider={false} />
          </ListSection>
          <ListSection title="Written by">
            <ListRow title="M. Vell, K. Osei" divider={false} />
          </ListSection>
        </div>
      </NavigationStackContent>
    </NavigationStackPage>
  );
}

function AlbumPage({ value, a }: { value: string; a: Album }) {
  const stack = useNavigationStack();
  return (
    <NavigationStackPage value={value}>
      <NavigationStackBar>
        <NavigationStackTitle showOnScroll>{a.title}</NavigationStackTitle>
        <NavigationStackTrailing><BarButton label="Favourite"><DemoGlyph name="star" /></BarButton></NavigationStackTrailing>
      </NavigationStackBar>
      <NavigationStackContent>
        <div className="mx-auto max-w-[620px] px-6 pt-4 pb-10">
          <div className="flex items-end gap-5">
            <Cover a={a} className="size-[132px]" />
            <div className="min-w-0 pb-1">
              <div className="truncate text-[26px] leading-[1.15] font-bold tracking-[-.4px]">{a.title}</div>
              <div className="mt-1 truncate text-[18px] text-primary">{a.artist}</div>
              <div className="mt-1 text-footnote text-muted-foreground">{a.year} · {a.tracks.length} songs</div>
            </div>
          </div>
          <div className="mt-6">
            {a.tracks.map((t, i) => (
              <Button key={t} variant="plain" onClick={(event) => stack.push(`credits:${a.id}:${i}`, { reason: 'trigger-press', event: event.nativeEvent })}
                className="flex h-auto w-full justify-start gap-4 rounded-none px-1 py-3 text-left text-callout font-normal whitespace-normal text-foreground shadow-hairline-b active:not-aria-expanded:not-data-disabled:scale-100 active:bg-accent focus-visible:ring-offset-0">
                <span className="w-5 text-right text-detail text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{t}</span>
                <Icon name="chev" size={14} sw={2.6} className="text-tertiary-foreground" />
              </Button>
            ))}
          </div>
        </div>
      </NavigationStackContent>
    </NavigationStackPage>
  );
}

/** The stack's first page: the section the sidebar picked, as a grid of albums. */
function LibraryRoot({ value }: { value: string }) {
  const s = useSplitView();
  const stack = useNavigationStack();
  const sec = SECTIONS_LIB.find((x) => x.id === s.value.sidebar) ?? SECTIONS_LIB[0];
  return (
    <NavigationStackPage value={value}>
      <NavigationStackBar>
        <NavigationStackLeading><SplitViewSidebarTrigger /></NavigationStackLeading>
        <NavigationStackTitle>{sec.title}</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-5 px-5 pt-3 pb-10">
          {ALBUMS.map((a) => (
            <HoverCard key={a.id}>
              <HoverCardTrigger
                render={<Button variant="plain" onClick={(event) => stack.push(`album:${a.id}`, { reason: 'trigger-press', event: event.nativeEvent })}
                  className="flex h-auto w-full flex-col items-stretch justify-start gap-1.5 rounded-ctl text-left font-normal whitespace-normal text-foreground focus-visible:ring-offset-0" />}>
                <Cover a={a} className="aspect-square w-full" />
                <span className="mt-0.5 truncate text-detail font-medium">{a.title}</span>
                <span className="-mt-1 truncate text-footnote text-muted-foreground">{a.artist}</span>
              </HoverCardTrigger>
              <HoverCardContent side="end" align="start" className="w-64"><AlbumCard a={a} /></HoverCardContent>
            </HoverCard>
          ))}
        </div>
      </NavigationStackContent>
    </NavigationStackPage>
  );
}

/** The detail column pushes pages, so it holds a NavigationStack: the column is its parent (collapsed, the first
 *  page goes back to the sidebar), `resetKey` pops it when the sidebar picks another section, and `renderPage` draws
 *  the album and credits pages from their keys. */
function LibraryDetail({ initialAlbum }: { initialAlbum?: string }) {
  const s = useSplitView();
  return (
    <SplitViewDetail aria-label="Albums">
      <NavigationStack defaultPages={initialAlbum ? ['root', `album:${initialAlbum}`] : ['root']} resetKey={s.value.sidebar}
        renderPage={(page) => <LibraryPage page={page} />}>
        <LibraryRoot value="root" />
      </NavigationStack>
    </SplitViewDetail>
  );
}

/** Library: the sidebar picks a section; albums push onto a NavigationStack inside the detail column (album →
 *  credits). A pushed page's back button names the page below: its title, "Back", or the chevron alone. */
export function SplitViewLibraryDemo({ defaultValue, initialAlbum, ...props }: DemoProps & { initialAlbum?: string }) {
  return (
    <SplitView aria-label="Library" defaultValue={defaultValue ?? { sidebar: 'recent' }} defaultCompactColumn="sidebar" {...props}>
      <SplitViewSidebar aria-label="Library" width={250}>
        <SplitViewHeader title="Library" />
        <SplitViewContent className="px-2.5 pt-2 pb-4">
          <SplitViewSection>
            {SECTIONS_LIB.map((x) => <SplitViewItem key={x.id} value={x.id} title={x.short} icon={<DemoGlyph name={x.icon} />} />)}
          </SplitViewSection>
        </SplitViewContent>
      </SplitViewSidebar>
      <LibraryDetail initialAlbum={initialAlbum} />
    </SplitView>
  );
}

/* ── Notes gallery: the list column steps aside and the detail takes its space ── */
const FOLDERS = [
  { id: 'all', title: 'All iCloud', icon: 'folder' },
  { id: 'notes', title: 'Notes', icon: 'folder' },
  { id: 'ideas', title: 'Ideas', icon: 'folder' },
];

function ViewSwitch() {
  const s = useSplitView();
  const gallery = !s.supplementaryOpen;
  return (
    <BarButton label={gallery ? 'View as list' : 'View as gallery'} onClick={() => s.setSupplementaryOpen(gallery)}>
      <DemoGlyph name={gallery ? 'list' : 'grid'} size={21} />
    </BarButton>
  );
}

function GalleryDetail() {
  const s = useSplitView();
  const gallery = !s.supplementaryOpen;
  const n = NOTES.find((x) => x.id === s.value.supplementary);
  return (
    <SplitViewDetail aria-label={gallery ? 'Gallery' : 'Note'}>
      <SplitViewHeader title={gallery ? 'Notes' : undefined} leading={gallery ? <SplitViewSidebarTrigger /> : null}
        trailing={<>{gallery ? <ViewSwitch /> : null}<BarButton label="New note"><DemoGlyph name="compose" size={21} /></BarButton></>} />
      {gallery ? (
        <SplitViewContent>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4 px-5 pt-5 pb-10">
            {NOTES.map((x) => (
              <Button key={x.id} variant="plain" onClick={() => { s.select('supplementary', x.id); s.setSupplementaryOpen(true); }}
                className="flex h-auto flex-col items-stretch justify-start gap-2 rounded-panel p-0 text-left font-normal whitespace-normal text-foreground active:not-aria-expanded:not-data-disabled:scale-100 focus-visible:ring-offset-0">
                <span className={cn('block h-[150px] overflow-hidden rounded-panel bg-card p-3 text-caption2 leading-[1.45] text-muted-foreground',
                  x.id === s.value.supplementary ? 'shadow-[0_0_0_2.5px_var(--primary)]' : 'shadow-[0_0_0_1px_var(--border)]')}>
                  <span className="mb-1 block text-caption font-semibold text-foreground">{x.title}</span>{x.body}
                </span>
                <span className="px-1 text-center">
                  <span className="block truncate text-footnote font-semibold">{x.title}</span>
                  <span className="block text-caption text-muted-foreground">{x.date}</span>
                </span>
              </Button>
            ))}
          </div>
        </SplitViewContent>
      ) : n ? (
        <SplitViewContent>
          <div className="mx-auto max-w-[680px] px-7 pt-4 pb-10">
            <div className="text-center text-footnote text-muted-foreground">{n.date}</div>
            <h2 className="mt-3 mb-3 text-[28px] leading-[1.15] font-bold tracking-[-.5px]">{n.title}</h2>
            <p className="m-0 text-body leading-[1.55]">{n.body}</p>
          </div>
        </SplitViewContent>
      ) : <EmptyState icon={<DemoGlyph name="note" sw={1.2} />} title="No Note Selected" />}
    </SplitViewDetail>
  );
}

/** Notes with a gallery: the grid button closes the supplementary column (`setSupplementaryOpen(false)`):
 *  it slides away and the detail springs across to fill its space; opening a card brings the list back. */
export function SplitViewGalleryDemo({ defaultValue, ...props }: DemoProps) {
  return (
    <SplitView aria-label="Notes" defaultValue={defaultValue ?? { sidebar: 'all', supplementary: 'n1' }} {...props}>
      <SplitViewSidebar aria-label="Folders" width={230}>
        <SplitViewHeader title="Folders" />
        <SplitViewContent className="px-2.5 pb-4">
          <SplitViewSection title="iCloud">
            {FOLDERS.map((f) => <SplitViewItem key={f.id} value={f.id} title={f.title} icon={<DemoGlyph name={f.icon} />} trailing={NOTES.length} />)}
          </SplitViewSection>
        </SplitViewContent>
      </SplitViewSidebar>
      <SplitViewSupplementary aria-label="Notes" width={320}>
        <SplitViewHeader title="Notes" leading={<SplitViewSidebarTrigger />} trailing={<ViewSwitch />} />
        <SplitViewContent className="px-2.5 pt-1 pb-4">
          <div className="flex flex-col gap-0.5">{NOTES.map((n) => (
            <SplitViewItem key={n.id} value={n.id} variant="pill" title={<span className="font-semibold">{n.title}</span>}
              description={<><span className="mr-1.5">{n.date}</span>{n.body}</>} className="py-2" />
          ))}</div>
        </SplitViewContent>
      </SplitViewSupplementary>
      <GalleryDetail />
    </SplitView>
  );
}
