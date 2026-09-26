/* SplitView compositions shared by the stories and the docs: Mail (three columns), Notes (two columns),
   Settings (sidebar + detail) and a frame you can drag to resize. Each is a plain composition of the
   public SplitView parts — nothing here reaches into the component. */
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useMove, useFocusRing, mergeProps } from 'react-aria';
import { Avatar } from '../components/avatar';
import { ListRow, ListSection } from '../components/list';
import { SearchField } from '../components/search-field';
import {
  SplitView, SplitViewContent, SplitViewDetail, SplitViewEmpty, SplitViewHeader, SplitViewItem, SplitViewSidebar,
  SplitViewSupplementary, SplitViewToggle, useSplitView, type SplitViewProps,
} from '../components/split-view';
import { Switch } from '../components/switch';
import { SIDEBAR_ICONS } from '../components/sidebar';
import { cn } from '../lib/utils';
import { useContainerWidth } from '../lib/container';

const EXTRA_ICONS: Record<string, string> = {
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
};
const PATHS = { ...SIDEBAR_ICONS, ...EXTRA_ICONS };

/** Stroke glyph from the demo icon set. */
export function DemoGlyph({ name, size = 20, sw = 1.9 }: { name: string; size?: number; sw?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.doc} />
    </svg>
  );
}

function BarButton({ label, children, onPress }: { label: string; children: ReactNode; onPress?: () => void }) {
  return (
    <AriaButton aria-label={label} onPress={onPress}
      className="bl-btn grid cursor-pointer place-items-center rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-primary outline-none transition-[background,transform] duration-150 data-[hovered]:bg-bl-fill data-[pressed]:scale-[.94] data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring">
      {children}
    </AriaButton>
  );
}

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-3 pt-4 pb-1.5 text-[13px] font-semibold tracking-[-.1px] text-muted-foreground">{children}</div>
);

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
    { id: 'm5', from: ['Luca', 'Moretti'], subject: 'Re: Haptics on Android', preview: 'Vibration patterns are fine but selection ticks feel mushy below 10ms. Numbers attached.', time: 'Yesterday' },
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
      <SplitViewHeader title="Mailboxes" trailing={<BarButton label="Edit mailboxes"><span className="text-[17px]">Edit</span></BarButton>} />
      <SplitViewContent className="px-2.5 pb-4">
        <SectionLabel>iCloud</SectionLabel>
        <div className="flex flex-col gap-px">
          {MAILBOXES.map((m) => (
            <SplitViewItem key={m.id} id={m.id} title={m.title} icon={<DemoGlyph name={m.icon} />} badge={m.count} />
          ))}
        </div>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}

function MailList() {
  const s = useSplitView();
  const box = MAILBOXES.find((m) => m.id === s.selection.sidebar) ?? MAILBOXES[0];
  const [q, setQ] = useState('');
  const msgs = (MAIL[box.id] ?? []).filter((m) => !q || (m.subject + m.preview + m.from.join(' ')).toLowerCase().includes(q.toLowerCase()));
  return (
    <SplitViewSupplementary aria-label={box.title}>
      <SplitViewHeader title={box.title} leading={<SplitViewToggle />}
        trailing={<BarButton label="New message"><DemoGlyph name="compose" size={21} /></BarButton>} />
      <SplitViewContent>
        <div className="px-4 pt-2.5 pb-2"><SearchField q={q} setQ={setQ} /></div>
        {msgs.length === 0 ? <SplitViewEmpty className="h-48" title="No Mail" description={q ? `Nothing matches “${q}”` : undefined} /> : null}
        {msgs.map((m) => (
          <SplitViewItem key={m.id} id={m.id} className="items-start py-3 pl-7">
            {m.unread ? <span aria-label="Unread" className="absolute top-[18px] left-2.5 size-[9px] rounded-full bg-primary" /> : null}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{m.from.join(' ')}</span>
                {m.flagged ? <span className="text-[#FF9F0A]"><DemoGlyph name="flag" size={13} sw={2.4} /></span> : null}
                <span className="shrink-0 text-[14px] text-muted-foreground">{m.time}</span>
              </span>
              <span className="mt-0.5 block truncate text-[15px]">{m.subject}</span>
              <span className="mt-0.5 line-clamp-2 text-[14.5px] leading-[1.35] text-muted-foreground">{m.preview}</span>
            </span>
          </SplitViewItem>
        ))}
      </SplitViewContent>
    </SplitViewSupplementary>
  );
}

function MailMessage() {
  const s = useSplitView();
  const all = Object.values(MAIL).flat();
  const m = all.find((x) => x.id === s.selection.supplementary);
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
              <Avatar c={{ f: m.from[0], l: m.from[1] }} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[17px] font-semibold">{m.from.join(' ')}</span>
                  <span className="shrink-0 text-[14px] text-muted-foreground">{m.time}</span>
                </div>
                <div className="truncate text-[14px] text-muted-foreground">To: Brett Lamy</div>
              </div>
            </div>
            <h2 className="mt-5 mb-4 border-0 text-[24px] leading-[1.2] font-bold tracking-[-.4px]">{m.subject}</h2>
            <div className="flex flex-col gap-3.5 text-[16px] leading-[1.55]">
              <p className="m-0">Hi Brett,</p>
              <p className="m-0">{m.preview}</p>
              <p className="m-0">I tried it at every size: tiled at regular, floating over the list at medium, and as a stack on the phone. The column I was reading stays where it is and just changes shape, so nothing flashes and the scroll position survives.</p>
              <p className="m-0">Let me know if you want me to record a pass at half speed for the review.</p>
              <p className="m-0 text-muted-foreground">— {m.from[0]}</p>
            </div>
          </article>
        </SplitViewContent>
      ) : (
        <SplitViewEmpty icon={<DemoGlyph name="inbox" size={48} sw={1.2} />} title="No Message Selected" />
      )}
    </SplitViewDetail>
  );
}

/** Mail: mailboxes · message list · message. */
export function SplitViewMailDemo({ defaultSelection, ...props }: DemoProps) {
  return (
    <SplitView aria-label="Mail" defaultSelection={defaultSelection ?? { sidebar: 'inbox', supplementary: 'm2' }} {...props}>
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
export function SplitViewNotesDemo({ defaultSelection, listWidth = 300, ...props }: DemoProps & { listWidth?: number }) {
  return (
    <SplitView aria-label="Notes" defaultSelection={defaultSelection ?? { sidebar: 'n1' }} defaultCompactColumn="sidebar" {...props}>
      <SplitViewSidebar aria-label="Notes" width={listWidth} minWidth={Math.min(200, listWidth)} className="bg-background">
        <SplitViewHeader title="Notes" trailing={<BarButton label="New note"><DemoGlyph name="compose" size={21} /></BarButton>} />
        <SplitViewContent className="px-2.5 pt-1 pb-4">
          <SectionLabel>Today</SectionLabel>
          <div className="flex flex-col gap-0.5">{NOTES.map((n) => (
            <SplitViewItem key={n.id} id={n.id} variant="pill" title={<span className="font-semibold">{n.title}</span>}
              subtitle={<><span className="mr-1.5">{n.date}</span>{n.body}</>} className="py-2" />
          ))}</div>
        </SplitViewContent>
      </SplitViewSidebar>
      <NotesEditor />
    </SplitView>
  );
}

function NotesEditor() {
  const s = useSplitView();
  const n = NOTES.find((x) => x.id === s.selection.sidebar);
  return (
    <SplitViewDetail aria-label="Note">
      <SplitViewHeader leading={<SplitViewToggle />} trailing={<BarButton label="Share"><DemoGlyph name="send" /></BarButton>} />
      {n ? (
        <SplitViewContent>
          <div className="mx-auto max-w-[680px] px-7 pt-4 pb-10">
            <div className="text-center text-[13px] text-muted-foreground">{n.date}</div>
            <h2 className="mt-3 mb-3 text-[28px] leading-[1.15] font-bold tracking-[-.5px]">{n.title}</h2>
            <p className="m-0 text-[17px] leading-[1.55]">{n.body}</p>
          </div>
        </SplitViewContent>
      ) : <SplitViewEmpty icon={<DemoGlyph name="note" size={48} sw={1.2} />} title="No Note Selected" />}
    </SplitViewDetail>
  );
}

/* ── Settings: sidebar · detail ── */
const SETTINGS = [
  { id: 'wifi', title: 'Wi-Fi', icon: 'wifi', color: '#0A84FF', value: 'Studio' },
  { id: 'notifications', title: 'Notifications', icon: 'bell', color: '#FF3B30' },
  { id: 'sounds', title: 'Sounds & Haptics', icon: 'sound', color: '#FF2D55' },
  { id: 'focus', title: 'Focus', icon: 'moon', color: '#5E5CE6' },
  { id: 'display', title: 'Display & Brightness', icon: 'display', color: '#0A84FF' },
  { id: 'privacy', title: 'Privacy & Security', icon: 'lock', color: '#34C759' },
];
const Tile = ({ icon, color }: { icon: string; color: string }) => (
  <span className="grid size-[28px] place-items-center rounded-[7px] text-white" style={{ background: color }}><DemoGlyph name={icon} size={17} sw={2.1} /></span>
);

function SettingsPane() {
  const s = useSplitView();
  const cur = SETTINGS.find((x) => x.id === s.selection.sidebar);
  const [on, setOn] = useState<Record<string, boolean>>({ a: true, b: false, c: true });
  const flip = (k: string) => (v: boolean) => setOn((o) => ({ ...o, [k]: v }));
  return (
    <SplitViewDetail aria-label={cur?.title ?? 'Settings'} className="bg-muted">
      <SplitViewHeader title={cur?.title} leading={<SplitViewToggle />} className="bg-muted" />
      {cur ? (
        <SplitViewContent>
          <div className="mx-auto max-w-[620px] px-5 pt-5 pb-10">
            <div className="mb-6 flex flex-col items-center rounded-[14px] bg-card px-6 py-6 text-center">
              <span className="grid size-[58px] place-items-center rounded-[14px] text-white" style={{ background: cur.color }}><DemoGlyph name={cur.icon} size={32} sw={1.9} /></span>
              <div className="mt-3 text-[22px] font-bold tracking-[-.3px]">{cur.title}</div>
              <div className="mt-1 max-w-[360px] text-[14px] leading-[1.4] text-muted-foreground">Adjust how {cur.title.toLowerCase()} behaves on this device and everywhere you’re signed in.</div>
            </div>
            <ListSection>
              <ListRow title={cur.title} trailing={<Switch checked={on.a} onChange={flip('a')} aria-label={cur.title} />} />
              <ListRow title="Show Previews" trailing={<Switch checked={on.b} onChange={flip('b')} aria-label="Show previews" />} />
              <ListRow title="Allow on Lock Screen" trailing={<Switch checked={on.c} onChange={flip('c')} aria-label="Allow on lock screen" />} divider={false} />
            </ListSection>
            <ListSection title="Options" footer="Changes sync to your other devices.">
              <ListRow title="Schedule" accessory="chevron" onPress={() => undefined} />
              <ListRow title="Customize" accessory="chevron" onPress={() => undefined} divider={false} />
            </ListSection>
          </div>
        </SplitViewContent>
      ) : <SplitViewEmpty title="Choose a setting" />}
    </SplitViewDetail>
  );
}

/** Settings: sidebar sections, grouped detail. */
export function SplitViewSettingsDemo({ defaultSelection, ...props }: DemoProps) {
  return (
    <SplitView aria-label="Settings" defaultSelection={defaultSelection ?? { sidebar: 'notifications' }} defaultCompactColumn="sidebar" {...props}>
      <SplitViewSidebar aria-label="Settings" width={300}>
        <SplitViewHeader title="Settings" />
        <SplitViewContent className="px-2.5 pb-4">
          <div className="my-3 flex items-center gap-3 rounded-[12px] bg-card px-3 py-2.5">
            <Avatar c={{ f: 'Brett', l: 'Lamy' }} size={44} />
            <div className="min-w-0"><div className="truncate text-[16px] font-semibold">Brett Lamy</div><div className="truncate text-[13px] text-muted-foreground">Account, iCloud, Media</div></div>
          </div>
          <div className="flex flex-col gap-px">
            {SETTINGS.map((x) => <SplitViewItem key={x.id} id={x.id} title={x.title} icon={<Tile icon={x.icon} color={x.color} />} badge={x.value} />)}
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
/** A frame with a drag handle on its trailing edge; the readout shows the width and size class. */
export function SplitViewResizableDemo({ children, initial = 900, min = 320, max = 1200, height = 520, breakpoints = { medium: 640, regular: 1024 } }: SplitViewResizableDemoProps) {
  const [host, hostW] = useContainerWidth<HTMLDivElement>(max + 20);
  const hi = Math.max(min, Math.min(max, hostW - 20));
  const [raw, setW] = useState(initial);
  const w = Math.min(raw, hi);
  const acc = useRef(w);
  const [dragging, setDragging] = useState(false);
  const { moveProps } = useMove({
    onMoveStart() { acc.current = w; setDragging(true); },
    onMove(e) { acc.current += e.pointerType === 'keyboard' ? e.deltaX * (e.shiftKey ? 80 : 20) : e.deltaX; acc.current = Math.max(min, Math.min(hi, acc.current)); setW(acc.current); },
    onMoveEnd() { setDragging(false); },
  });
  const { focusProps, isFocusVisible } = useFocusRing();
  const wc = w >= breakpoints.regular ? 'regular' : w >= breakpoints.medium ? 'medium' : 'compact';
  return (
    <div ref={host} data-slot="split-view-resizable-demo" className="flex w-full flex-col items-start gap-2.5">
      <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground tabular-nums">
        {(['compact', 'medium', 'regular'] as const).map((c) => (
          <span key={c} className={cn('rounded-full px-2.5 py-1 font-semibold transition-colors duration-200', c === wc ? 'bg-primary text-primary-foreground' : 'bg-bl-fill')}>{c}</span>
        ))}
        <span className="ml-1">{Math.round(w)}px</span>
      </div>
      <div className="relative flex max-w-full">
        <div className="relative overflow-hidden rounded-[14px] shadow-[0_0_0_1px_var(--bl-sep),0_10px_30px_rgba(0,0,0,.12)]" style={{ width: w, height }}>
          {children}
        </div>
        <div role="separator" aria-orientation="vertical" aria-label="Resize frame" aria-valuenow={Math.round(w)} aria-valuemin={min} aria-valuemax={hi}
          tabIndex={0} {...mergeProps(moveProps, focusProps)}
          className="group grid w-5 shrink-0 cursor-col-resize touch-none place-items-center outline-none">
          <span className={cn('h-12 w-[5px] rounded-full transition-[background,transform] duration-150',
            dragging || isFocusVisible ? 'scale-y-110 bg-primary' : 'bg-bl-label3 group-hover:bg-bl-label2')} />
        </div>
      </div>
    </div>
  );
}
