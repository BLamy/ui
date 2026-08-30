/* Core TouchKit / Workbench live blocks — ported from the prototype's DocsLive LIVE registry
   (project/workbench.jsx), rebuilt on the @touchkit/* package public APIs. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Avatar, Credenza, Haptics, Icon, IndexBar, NavigationStack, Segmented, SideDrawer, SplitView, Spinner,
  Switch as TKSwitch, TabBar, List as TKList, ListSection as TKSection, ListRow as TKRow,
  type Screen,
} from '@touchkit/ui';
import { ChatDemo } from '@touchkit/chatkit';
import {
  Composer, MarkdownView, MessageScroller, REPLY_SERVERS, SurfaceDiff, SurfaceFiles, SurfacePanel, TermBody, TermHeader, WFONT, WorkbenchDemo,
  type SurfaceKind,
} from '@touchkit/workbench';
import { DemoBtn, TKDK, TKFrame, TKL, type LiveSpec } from './frame';

function ScaledShell({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const resize = () => setScale(Math.min(1, el.clientWidth / width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);
  return <div ref={host} style={{ width: '100%', height: height * scale, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
  </div>;
}

export const LIVE_CORE: Record<string, LiveSpec> = {
  chatshell: {
    title: 'ChatShell · responsive composition', theme: 'tk', h: 580,
    code: 'import { ChatShell } from "@touchkit/chatkit"\n\nexport default function Chat() {\n  return (\n    <ChatShell breakpoint={880}>\n      <ChatShell.Rail><WorkspaceRail /></ChatShell.Rail>\n      <ChatShell.Nav><ChannelNav /></ChatShell.Nav>\n      <ChatShell.Main><ChannelMain /></ChatShell.Main>\n    </ChatShell>\n  )\n}',
    Render: function ChatShellLive() {
      const [mode, setMode] = useState('wide');
      const compact = mode === 'compact';
      const width = compact ? 430 : 1040;
      return <div>
        <div style={{ width: 260, margin: '0 auto 12px' }}>
          <Segmented aria-label="ChatShell width" value={mode} onChange={setMode} options={[{ id: 'wide', label: 'Wide' }, { id: 'compact', label: 'Compact' }]} />
        </div>
        <ScaledShell width={width} height={520}>
          <ChatDemo initialThread={null} style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
        </ScaledShell>
        <div style={{ fontSize: 12, color: 'var(--tk-label2)', textAlign: 'center', marginTop: 8 }}>
          {compact ? 'Compact: open the hamburger to reveal the rail and channels.' : 'Wide: the workspace rail and channel navigation stay docked.'}
        </div>
      </div>;
    },
  },
  workbenchshell: {
    title: 'WorkbenchShell · responsive composition', theme: 'wb', h: 590,
    code: 'import { WorkbenchShell } from "@touchkit/workbench"\n\nexport default function Workbench() {\n  return (\n    <WorkbenchShell>\n      <WorkbenchShell.Sidebar><ThreadList /></WorkbenchShell.Sidebar>\n      <WorkbenchShell.Main><Conversation /></WorkbenchShell.Main>\n      <WorkbenchShell.Dock><TerminalDock /></WorkbenchShell.Dock>\n      <WorkbenchShell.Panel><SurfacePanel /></WorkbenchShell.Panel>\n      <WorkbenchShell.TabBar><SurfaceTabs /></WorkbenchShell.TabBar>\n    </WorkbenchShell>\n  )\n}',
    Render: function WorkbenchShellLive() {
      const [mode, setMode] = useState('regular');
      const compact = mode === 'compact';
      const width = compact ? 430 : 1180;
      return <div>
        <div style={{ ...TKDK, width: 280, margin: '0 auto 12px' } as CSSProperties}>
          <Segmented aria-label="WorkbenchShell width" value={mode} onChange={setMode} options={[{ id: 'regular', label: 'Regular' }, { id: 'compact', label: 'Compact' }]} />
        </div>
        <ScaledShell width={width} height={560}>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12 }}><WorkbenchDemo terminal /></div>
        </ScaledShell>
        <div style={{ fontSize: 12, color: 'var(--wb-label2)', textAlign: 'center', marginTop: 8 }}>
          {compact ? 'Compact: sidebar, terminal, and surfaces move into sheets and tabs.' : 'Regular: sidebar, terminal dock, and surface panel share the workspace.'}
        </div>
      </div>;
    },
  },
  row: {
    title: 'TKList · TKSection · TKRow', theme: 'tk', h: 340,
    code: 'import { TKList, TKSection, TKRow, Avatar, TKSwitch, Haptics } from "./touchkit.tsx"\n\nexport default function App() {\n  const [dnd, setDnd] = React.useState(true)\n  const people = [\n    { f: "Maya", l: "Lindqvist", role: "Industrial design" },\n    { f: "Jonas", l: "Ito", role: "Haptics engineering" },\n  ]\n  return (\n    <TKList inset>\n      <TKSection title="Team" footer="Rows are real buttons — arrow keys work too.">\n        {people.map(p => (\n          <TKRow key={p.l} leading={<Avatar c={p} size={36}/>}\n            title={p.f + " " + p.l} subtitle={p.role}\n            accessory="chevron" onPress={() => Haptics.impact("light")}/>\n        ))}\n        <TKRow title="Do Not Disturb" divider={false}\n          trailing={<TKSwitch checked={dnd} onChange={setDnd}/>}/>\n      </TKSection>\n    </TKList>\n  )\n}',
    Render: function RowLive() {
      const [dnd, setDnd] = useState(true);
      const people = [{ f: 'Maya', l: 'Lindqvist', role: 'Industrial design' }, { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' }];
      return <div style={{ maxWidth: 430, margin: '0 auto' }}><TKList inset>
        <TKSection title="Team" footer="Rows are real buttons — arrow keys work too.">
          {people.map((p) => <TKRow key={p.l} leading={<Avatar c={p} size={36} />} title={p.f + ' ' + p.l} subtitle={p.role} accessory="chevron" onPress={() => Haptics.impact('light')} />)}
          <TKRow title="Do Not Disturb" divider={false} trailing={<TKSwitch aria-label="Do Not Disturb" checked={dnd} onChange={setDnd} />} />
        </TKSection>
      </TKList></div>;
    },
  },
  credenza: {
    title: 'Credenza', theme: 'tk', h: 340,
    code: 'import { Credenza, TKRow, Icon, Haptics } from "./touchkit.tsx"\n\nexport default function App() {\n  const [view, setView] = React.useState(null)\n  const done = () => { Haptics.notification("success"); setView("done") }\n  return (\n    <div style={{ display: "grid", placeItems: "center", minHeight: 220 }}>\n      <button onClick={() => { Haptics.impact("light"); setView("menu") }}>\n        Share Contact…\n      </button>\n      <Credenza open={!!view} view={view || "menu"}\n        title={view === "done" ? "Shared" : "Share Contact"}\n        canBack={view === "done"} onBack={() => setView("menu")}\n        onClose={() => setView(null)}>\n        {view === "done"\n          ? <p style={{ textAlign: "center", padding: 24 }}>Contact shared ✓</p>\n          : <div>\n              <TKRow leading={<Icon name="qr" size={20}/>} title="Show QR code" onPress={done}/>\n              <TKRow leading={<Icon name="doc" size={20}/>} title="Copy vCard" divider={false} onPress={done}/>\n            </div>}\n      </Credenza>\n    </div>\n  )\n}',
    Render: function CredLive() {
      const [view, setView] = useState<string | null>(null);
      const done = () => { Haptics.notification('success'); setView('done'); };
      return <div style={{ display: 'grid', placeItems: 'center', minHeight: 210 }}>
        <button onClick={() => { Haptics.impact('light'); setView('menu'); }}
          style={{ border: 0, borderRadius: 11, background: 'var(--tk-tint)', color: '#fff', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, padding: '11px 20px', cursor: 'pointer' }}>Share Contact…</button>
        <Credenza open={!!view} view={view || 'menu'} title={view === 'done' ? 'Shared' : 'Share Contact'}
          canBack={view === 'done'} onBack={() => setView('menu')} onClose={() => setView(null)}>
          {view === 'done'
            ? <div style={{ textAlign: 'center', padding: '26px 18px' }}>
                <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(52,199,89,.15)', display: 'inline-grid', placeItems: 'center', color: 'var(--tk-green)' }}><Icon name="check" size={24} sw={2.4} /></span>
                <div style={{ fontWeight: 650, fontSize: 16, marginTop: 10 }}>Contact shared</div>
                <div style={{ fontSize: 13, color: 'var(--tk-label2)', marginTop: 3 }}>The card spring-morphs its height to each state.</div>
              </div>
            : <div style={{ padding: '4px 6px 8px' }}>
                <TKRow leading={<Icon name="layers" size={20} />} title="Show QR code" onPress={done} />
                <TKRow leading={<Icon name="mail" size={20} />} title="Copy vCard" divider={false} onPress={done} />
              </div>}
        </Credenza>
      </div>;
    },
  },
  composer: {
    title: 'Composer · Docstream editor', theme: 'wb', h: 400,
    code: 'import { Composer, MarkdownView } from "@touchkit/workbench"\n\nexport default function App() {\n  const [sent, setSent] = React.useState("")\n  const [streaming, setStreaming] = React.useState(false)\n  const send = markdown => {\n    setSent(markdown); setStreaming(true)\n    setTimeout(() => setStreaming(false), 1600)\n  }\n  return (\n    <div style={{ maxWidth: 560, margin: "0 auto" }}>\n      <Composer wide defaultValue={"## Ship checklist\\n\\n- Highlight code\\n- Publish package"}\n        onSend={send} streaming={streaming}\n        onStop={() => setStreaming(false)}/>\n      {sent && <MarkdownView markdown={sent}/>}\n    </div>\n  )\n}',
    Render: function CompLive() {
      const [sent, setSent] = useState<string | null>(null);
      const [streaming, setStreaming] = useState(false);
      const t = useRef<any>(null);
      useEffect(() => () => clearTimeout(t.current), []);
      return <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Composer wide defaultValue={'## Ship checklist\n\n- Highlight code\n- Publish package'} onSend={(text) => { setSent(text); setStreaming(true); clearTimeout(t.current); t.current = setTimeout(() => setStreaming(false), 1600); }}
          streaming={streaming} onStop={() => { clearTimeout(t.current); setStreaming(false); }} />
        {sent ? <div style={{ fontSize: 12, color: 'var(--wb-label)', marginTop: 10 }}><MarkdownView markdown={sent} /></div> : null}
      </div>;
    },
  },
  controls: {
    title: 'Segmented · TKSwitch · Spinner · Avatar', theme: 'tk', h: 300,
    code: 'import { Segmented, TKSwitch, Spinner, Avatar, Haptics } from "./touchkit.tsx"\n\nexport default function App() {\n  const [range, setRange] = React.useState("day")\n  const [on, setOn] = React.useState(true)\n  return (\n    <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>\n      <Segmented value={range} onChange={setRange} options={[\n        { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" },\n      ]}/>\n      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>\n        <Avatar c={{ f: "Ada", l: "Lovelace" }} size={40}/>\n        <TKSwitch checked={on} onChange={setOn}/>\n        <Spinner/>\n      </div>\n    </div>\n  )\n}',
    Render: function CtlLive() {
      const [range, setRange] = useState('day');
      const [on, setOn] = useState(true);
      return <div style={{ display: 'grid', gap: 16, justifyItems: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ width: 280 }}><Segmented value={range} onChange={setRange} options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} /></div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={40} />
          <TKSwitch aria-label="Demo switch" checked={on} onChange={setOn} />
          <Spinner />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--tk-label2)' }}>@touchkit/ui is live — every control ticks.</div>
      </div>;
    },
  },
  theming: {
    title: 'Theme tokens', theme: 'tk', h: 330,
    code: 'import { TKList, TKSection, TKRow, TKSwitch, Icon } from "./touchkit.tsx"\n\nexport default function App() {\n  const [dark, setDark] = React.useState(false)\n  const [tint, setTint] = React.useState("#0A84FF")\n  return (\n    <div style={{ ...(dark ? DARK_TOKENS : LIGHT_TOKENS), "--tk-tint": tint }}>\n      {/* every component reads the nearest --tk-* tokens */}\n      <TKList inset>\n        <TKSection title="Appearance">\n          <TKRow leading={<Icon name="bell" size={20}/>} title="Dark Mode" divider={false}\n            trailing={<TKSwitch checked={dark} onChange={setDark}/>}/>\n        </TKSection>\n      </TKList>\n    </div>\n  )\n}',
    Render: function ThemeLive() {
      const [dark, setDark] = useState(false);
      const [tint, setTint] = useState('#0A84FF');
      return <div style={{ ...(dark ? TKDK : TKL), '--tk-tint': tint, background: 'var(--tk-bg2)', borderRadius: 14, padding: 16, colorScheme: dark ? 'dark' : 'light', color: 'var(--tk-label)', maxWidth: 430, margin: '0 auto', transition: 'background .25s' } as any}>
        <div style={{ display: 'flex', gap: 9, marginBottom: 12, justifyContent: 'center' }}>
          {['#0A84FF', '#5E5CE6', '#34C759', '#FF9F0A', '#FF375F'].map((c) => <button key={c} onClick={() => { setTint(c); Haptics.selection(); }} aria-label={'Tint ' + c}
            style={{ width: 23, height: 23, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0, border: '1px solid rgba(0,0,0,.1)', outline: tint === c ? '2.5px solid ' + c : 'none', outlineOffset: 2 }} />)}
        </div>
        <TKList inset>
          <TKSection title="Appearance">
            <TKRow leading={<Icon name="bell" size={20} />} title="Dark Mode" divider={false} trailing={<TKSwitch aria-label="Dark Mode" checked={dark} onChange={setDark} />} />
          </TKSection>
        </TKList>
        <DemoBtn label="Tinted action" onPress={() => Haptics.impact('light')} style={{ display: 'block', margin: '12px auto 0' }} />
      </div>;
    },
  },
  nav: {
    title: 'NavigationStack', theme: 'tk', h: 420,
    code: 'import { NavigationStack, TKList, TKSection, TKRow, Icon } from "./touchkit.tsx"\n\nexport default function App() {\n  const [sel, setSel] = React.useState(null)\n  const screens = [\n    { key: "root", title: "Teams", grouped: true, content:\n      <TKList inset><TKSection>\n        {["Design", "Engineering", "Research"].map((t, i) => (\n          <TKRow key={t} leading={<Icon name="person" size={20}/>} title={t}\n            accessory="chevron" divider={i < 2} onPress={() => setSel(t)}/>\n        ))}\n      </TKSection></TKList> },\n  ]\n  if (sel) screens.push({ key: "detail", title: sel, grouped: true,\n    content: <p style={{ padding: 24 }}>Pushed — back chevron or edge-swipe pops.</p> })\n  return <NavigationStack screens={screens} onPop={() => setSel(null)}/>\n}',
    Render: function NavLive() {
      const [sel, setSel] = useState<string | null>(null);
      const screens: Screen[] = [{ key: 'root', title: 'Teams', grouped: true, content:
        <TKList inset><TKSection>
          {['Design', 'Engineering', 'Research'].map((t, i) => <TKRow key={t} leading={<Icon name="person" size={20} />} title={t}
            accessory="chevron" divider={i < 2} onPress={() => { Haptics.impact('light'); setSel(t); }} />)}
        </TKSection></TKList> }];
      if (sel) screens.push({ key: 'detail', title: sel, grouped: true, content:
        <div style={{ padding: '28px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 650 }}>{sel}</div>
          <div style={{ fontSize: 13, color: 'var(--tk-label2)', marginTop: 5, lineHeight: 1.5 }}>Pushed screen — use the back chevron, or drag from the left edge to pop interactively.</div>
        </div> });
      return <TKFrame h={330}><NavigationStack screens={screens} onPop={() => setSel(null)} /></TKFrame>;
    },
  },
  tabs: {
    title: 'TabBar', theme: 'tk', h: 420,
    code: 'import { TabBar, Icon } from "./touchkit.tsx"\n\nexport default function App() {\n  const [tab, setTab] = React.useState("contacts")\n  return (\n    <div style={{ position: "relative", height: 320 }}>\n      <main style={{ position: "absolute", inset: "0 0 62px" }}>{/* per-tab content */}</main>\n      <TabBar selected={tab} onSelect={setTab} items={[\n        { id: "contacts", icon: "person", label: "Contacts" },\n        { id: "recents",  icon: "clock",  label: "Recents" },\n        { id: "settings", icon: "gear",   label: "Settings" },\n      ]}/>\n    </div>\n  )\n}',
    Render: function TabsLive() {
      const [tab, setTab] = useState('contacts');
      const items = [{ id: 'contacts', icon: 'person', title: 'Contacts' }, { id: 'recents', icon: 'clock', title: 'Recents' }, { id: 'settings', icon: 'sliders', title: 'Settings' }];
      const blurb: Record<string, string> = { contacts: 'Each tab keeps its own stack — pushes slide under this bar.', recents: 'Tab state survives switching away and back.', settings: 'Every selection fires Haptics.selection().' };
      const cur = items.find((i) => i.id === tab)!;
      return <TKFrame h={330} bg="var(--tk-bg)">
        <div style={{ position: 'absolute', inset: '0 0 62px', display: 'grid', placeItems: 'center', padding: '0 28px', textAlign: 'center' }}>
          <div>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 46, height: 46, borderRadius: 13, background: 'var(--tk-fill)', color: 'var(--tk-tint)' }}><Icon name={cur.icon as any} size={25} /></span>
            <div style={{ fontSize: 16.5, fontWeight: 650, marginTop: 10 }}>{cur.title}</div>
            <div style={{ fontSize: 13, color: 'var(--tk-label2)', marginTop: 4, lineHeight: 1.5 }}>{blurb[tab]}</div>
          </div>
        </div>
        <TabBar items={items} selected={tab} onSelect={setTab} />
      </TKFrame>;
    },
  },
  split: {
    title: 'SplitView', theme: 'tk', h: 470,
    code: 'import { SplitView } from "./touchkit.tsx"\n\nexport default function App() {\n  const [wc, setWc] = React.useState("regular")  // measure your container for real\n  return (\n    <SplitView wc={wc}\n      sidebar={<Folders/>}\n      master={<NoteList/>}\n      detail={<Note/>}\n      drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}/>\n  )\n}',
    Render: function SplitLive() {
      const [wc, setWc] = useState('regular');
      const [drawer, setDrawer] = useState(false);
      const mini = (name: string, rows: string[]) => <div style={{ height: '100%', overflowY: 'auto' }}><TKList>
        <TKSection title={name}>{rows.map((t, i) => <TKRow key={t} title={t} divider={i < rows.length - 1} />)}</TKSection>
      </TKList></div>;
      return <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 290 }}><Segmented value={wc} onChange={(id) => { setWc(id); setDrawer(false); }}
            options={[{ id: 'regular', label: 'Regular' }, { id: 'medium', label: 'Medium' }, { id: 'compact', label: 'Compact' }]} /></div>
          {wc !== 'regular' ? <DemoBtn label="Sidebar" onPress={() => setDrawer(true)} style={{ padding: '6px 12px', fontSize: 12.5 }} /> : null}
        </div>
        <TKFrame h={330} bg="var(--tk-bg)">
          <SplitView wc={wc} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}
            sidebar={<div style={{ height: '100%', background: 'var(--tk-side)', overflowY: 'auto' }}>{mini('Folders', ['All Notes', 'Shared', 'Archive'])}</div>}
            master={mini('Notes', ['Springs — stiffness 620', 'IndexBar scrub ticks', 'Credenza height morph'])}
            detail={<div style={{ height: '100%', display: 'grid', placeItems: 'center', background: 'var(--tk-bg2)', textAlign: 'center', padding: 22 }}>
              <div><div style={{ fontWeight: 650 }}>Detail</div>
              <div style={{ fontSize: 12.5, color: 'var(--tk-label2)', marginTop: 5, lineHeight: 1.5 }}>regular: 3 columns · medium: sidebar becomes a drawer · compact: collapses into the stack</div></div>
            </div>} />
        </TKFrame>
      </div>;
    },
  },
  indexbar: {
    title: 'IndexBar', theme: 'tk', h: 470,
    code: 'import { IndexBar, TKList, TKSection, TKRow } from "./touchkit.tsx"\n\nexport default function App() {\n  const sc = React.useRef(null), els = React.useRef({})\n\n  // Any jump points you like — key is yours, preview is what the bubble shows\n  const stops = turns\n    .filter(t => t.role === "user")\n    .map(t => ({ key: t.id, preview: t.text, caption: "You" }))   // no label → a dot on the rail\n\n  return (\n    <div style={{ position: "relative", height: 340 }}>\n      <div ref={sc} style={{ position: "absolute", inset: 0, overflowY: "auto" }}>\n        {turns.map(t => <Turn key={t.id} t={t} ref={el => els.current[t.id] = el}/>)}\n      </div>\n      <IndexBar items={stops} top={8} bottom={8}\n        onJump={(key, stop) => sc.current.scrollTop = els.current[key].offsetTop - 8}/>\n    </div>\n  )\n}\n\n// Pass no items and it falls back to the UIKit A–Z form:\n// <IndexBar avail={new Set(["A","B","C"])} onLetter={L => jumpTo(L)}/>',
    Render: function IdxLive() {
      const sc = useRef<HTMLDivElement | null>(null);
      const els = useRef<Record<string, HTMLElement>>({});
      const [mode, setMode] = useState('stops');
      const TURNS = [
        { id: 'q1', role: 'user', text: 'Why is the workbench build slow after the docs split?' },
        { id: 'a1', role: 'assistant', text: 'Two things: the docs registry re-transpiles on every nav, and the playground boots almost-node eagerly.' },
        { id: 'q2', role: 'user', text: 'Can we cache the transpile per page?' },
        { id: 'a2', role: 'assistant', text: 'Yes — key the cache by page id and keep it on window so navigation is free.' },
        { id: 'q3', role: 'user', text: 'What about the terminal dock — is it doing layout work while hidden?' },
        { id: 'a3', role: 'assistant', text: 'It was. It now unmounts below the compact breakpoint and lives in the SnapSheet instead.' },
        { id: 'q4', role: 'user', text: 'Ship it, then add the jump rail to the thread view.' },
        { id: 'a4', role: 'assistant', text: 'Done. The rail takes arbitrary stops, so each user turn becomes one dot with its text as the preview.' },
      ];
      const data: Record<string, string[]> = { A: ['Ada', 'Avi'], B: ['Bea', 'Ben'], C: ['Cal', 'Cy'], D: ['Dot', 'Dev'], E: ['Eli', 'Eva'], F: ['Fay'], G: ['Gus', 'Gia'] };
      const letters = Object.keys(data);
      const stops = TURNS.filter((t) => t.role === 'user').map((t) => ({ key: t.id, preview: t.text, caption: 'You' }));
      const jump = (key: string) => { const el = els.current[key]; if (el && sc.current) sc.current.scrollTop = Math.max(0, el.offsetTop - 8); };
      return <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 250 }}><Segmented value={mode} onChange={setMode}
            options={[{ id: 'stops', label: 'Custom stops' }, { id: 'az', label: 'A–Z fallback' }]} /></div>
        </div>
        <TKFrame h={340} bg="var(--tk-bg)">
          <div ref={sc} style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingRight: 26 }}>
            {mode === 'az'
              ? <TKList>
                  {letters.map((L) => <div key={L} ref={(el) => { if (el) els.current[L] = el; }}>
                    <TKSection title={L} sticky>{data[L].map((n, i) => <TKRow key={n} title={n} divider={i < data[L].length - 1} />)}</TKSection>
                  </div>)}
                </TKList>
              : <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {TURNS.map((t) => <div key={t.id} ref={(el) => { if (el) els.current[t.id] = el; }}
                    style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '80%', padding: '9px 13px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.4, textWrap: 'pretty',
                      background: t.role === 'user' ? 'var(--tk-tint)' : 'var(--tk-card)',
                      color: t.role === 'user' ? '#fff' : 'var(--tk-label)',
                      boxShadow: t.role === 'user' ? 'none' : '0 0 0 1px var(--tk-sep)' } as any}>{t.text}</div>
                  </div>)}
                  <div style={{ height: 120 }} />
                </div>}
          </div>
          {mode === 'az'
            ? <IndexBar avail={new Set(letters)} top={8} bottom={8} onLetter={jump} />
            : <IndexBar items={stops} top={10} bottom={10} onJump={jump} label="Jump to a turn" />}
        </TKFrame>
        <div style={{ fontSize: 12, color: 'var(--tk-label2)', textAlign: 'center', marginTop: 8 }}>
          {mode === 'stops' ? 'Hover a dot to peek the turn · drag to scrub with a tick per stop' : 'No items → the A–Z rail, unchanged'}
        </div>
      </div>;
    },
  },
  sidedrawer: {
    title: 'SideDrawer', theme: 'tk', h: 460,
    code: 'import { SideDrawer } from "./touchkit.tsx"\n\nexport default function App() {\n  const [mode, setMode] = React.useState("overlay")  // or "fixed"\n  const [open, setOpen] = React.useState(false)\n  return (\n    <div style={{ position: "relative", display: "flex", height: 330 }}>\n      <main style={{ flex: 1 }}>\n        <button onClick={() => setOpen(true)}>Show Activity</button>\n      </main>\n      <SideDrawer mode={mode} open={open} onClose={() => setOpen(false)}\n        title="Activity" width={230}>\n        {/* same children in every presentation */}\n      </SideDrawer>\n    </div>\n  )\n}',
    Render: function DrawerLive() {
      const [mode, setMode] = useState<'overlay' | 'fixed'>('overlay');
      const [open, setOpen] = useState(false);
      const rows = ['Outgoing call · 2 min', 'iMessage · yesterday', 'FaceTime · Mon', 'Mail · Re: schedule'];
      return <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 230 }}><Segmented value={mode} onChange={(id) => { setMode(id as any); setOpen(id === 'fixed'); }}
            options={[{ id: 'overlay', label: 'Overlay' }, { id: 'fixed', label: 'Fixed' }]} /></div>
        </div>
        <TKFrame h={330} bg="var(--tk-bg)">
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
              <div>
                <div style={{ fontWeight: 650, fontSize: 15.5 }}>Detail view</div>
                {mode === 'overlay'
                  ? <DemoBtn label="Show Activity" onPress={() => { Haptics.impact('light'); setOpen(true); }} style={{ marginTop: 12, fontSize: 13, padding: '8px 14px' }} />
                  : <div style={{ fontSize: 12.5, color: 'var(--tk-label2)', marginTop: 6, lineHeight: 1.5 }}>Docked column — no scrim,<br />part of the layout.</div>}
              </div>
            </div>
            <SideDrawer mode={mode} open={open} onClose={() => setOpen(false)} title="Activity" width={230}>
              {rows.map((t) => <div key={t} style={{ padding: '11px 16px', fontSize: 13, borderBottom: '1px solid var(--tk-sep)', color: 'var(--tk-label2)' }}>{t}</div>)}
            </SideDrawer>
          </div>
        </TKFrame>
      </div>;
    },
  },
  scroller: {
    title: 'MessageScroller', theme: 'wb', h: 440,
    code: 'import { MessageScroller } from "./workbench.tsx"\n\nexport default function App() {\n  const [msgs, setMsgs] = React.useState(seed)\n  const items = msgs.map(m => ({\n    id: m.id,\n    anchor: m.role === "user",   // rows that start a turn\n    node: <Message m={m}/>,\n  }))\n  return (\n    <div style={{ display: "flex", flexDirection: "column", height: 340 }}>\n      <MessageScroller items={items} streaming={false} threadKey="demo"/>\n      <button onClick={addTurn}>Send a turn</button>\n    </div>\n  )\n}',
    Render: function ScrollLive() {
      const [msgs, setMsgs] = useState([
        { id: 'u1', role: 'user', text: 'How does anchoring work?' },
        { id: 'a1', role: 'assistant', text: 'Each new turn scrolls near the top of the viewport with a peek of the previous one — the reply streams into the room below without moving your view.' }]);
      const n = useRef(1);
      const add = () => {
        n.current++;
        const uid = 'u' + n.current, aid = 'a' + n.current;
        setMsgs((m) => [...m, { id: uid, role: 'user', text: 'Turn ' + n.current + ' — watch me anchor to the top.' }]);
        setTimeout(() => setMsgs((m) => [...m, { id: aid, role: 'assistant', text: 'Replies grow into the reserved room below the anchor. Scroll up mid-reply and following stops; the pill at the bottom jumps back to the live edge.' }]), 380);
      };
      const items = msgs.map((m) => ({ id: m.id, anchor: m.role === 'user', node:
        m.role === 'user'
          ? <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}><div style={{ maxWidth: '80%', background: 'var(--wb-fill2)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 13.5 }}>{m.text}</div></div>
          : <div style={{ margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>{m.text}</div> }));
      return <div style={{ display: 'flex', flexDirection: 'column', height: 340, borderRadius: 12, overflow: 'hidden', background: 'var(--wb-bg)', border: '1px solid var(--wb-sep)' }}>
        <MessageScroller items={items} streaming={false} threadKey="live" />
        <div style={{ padding: 10, borderTop: '1px solid var(--wb-sep)', flexShrink: 0 }}>
          <button className="wb-btn" onClick={add} style={{ width: '100%', border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '9px 0', cursor: 'pointer' }}>Send a turn</button>
        </div>
      </div>;
    },
  },
  terminal: {
    title: 'TermHeader · TermBody', theme: 'wb', h: 400,
    code: 'import { TermBody } from "./workbench.tsx"\n\nexport default function App() {\n  return (\n    <div style={{ display: "flex", flexDirection: "column", height: 300, background: "#0C0C10" }}>\n      <TermBody seed={[{ t: "npm run dev", p: true }]}/>\n    </div>\n  )\n}\n// desktop: <TerminalDock h={h} setH={setH}/> · mobile: wrap in <SnapSheet snaps={[0.52, 0.93]}>',
    Render: function TermLive() {
      return <div style={{ display: 'flex', flexDirection: 'column', height: 300, borderRadius: 12, overflow: 'hidden', background: '#0C0C10', border: '1px solid var(--wb-sep)' }}>
        <TermHeader onClose={() => undefined} />
        <TermBody seed={[{ t: 'help', p: true }, { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' }]} />
      </div>;
    },
  },
  surfaces: {
    title: 'SurfacePanel', theme: 'wb', h: 480,
    code: 'import { SurfacePanel } from "./workbench.tsx"\n\nexport default function App() {\n  const [kind, setKind] = React.useState(null)  // null shows the surface picker\n  return (\n    <div style={{ height: 380 }}>\n      <SurfacePanel kind={kind} compact\n        onOpen={k => setKind(k)}\n        onClose={() => setKind(null)}\n        full={false} onFull={() => {}}/>\n    </div>\n  )\n}',
    Render: function SurfLive() {
      const [kind, setKind] = useState<SurfaceKind | null>(null);
      return <div style={{ height: 380, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)' }}>
        <SurfacePanel kind={kind} compact onOpen={(k) => setKind(k)} onClose={() => setKind(null)} full={false} onFull={() => undefined} />
      </div>;
    },
  },
  filetree: {
    title: 'File tree · @pierre/trees', theme: 'wb', h: 430,
    code: 'import { FileTree, useFileTree } from "@pierre/trees/react"\n\nconst paths = [\n  "src/App.tsx",\n  "src/components/Composer.tsx",\n  "package.json",\n]\n\nexport default function ProjectFiles() {\n  const { model } = useFileTree({ paths, search: true, initialExpansion: "open" })\n  return <FileTree model={model} style={{ height: 320 }}/>\n}',
    Render: () => <div style={{ height: 330, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)' }}><SurfaceFiles /></div>,
  },
  diff: {
    title: 'Code diff · @pierre/diffs', theme: 'wb', h: 430,
    code: 'import { MultiFileDiff } from "@pierre/diffs/react"\n\nexport default function Change() {\n  return <MultiFileDiff\n    oldFile={{ name: "src/haptics.ts", contents: before }}\n    newFile={{ name: "src/haptics.ts", contents: after }}\n    options={{ diffStyle: "unified", themeType: "dark" }}\n  />\n}',
    Render: () => <div style={{ height: 330, borderRadius: 12, overflow: 'auto', border: '1px solid var(--wb-sep)' }}><SurfaceDiff /></div>,
  },
  stream: {
    title: 'MarkdownView · Docstream renderer', theme: 'tk', h: 480,
    code: 'import { MarkdownView } from "@touchkit/workbench"\n\nexport default function App() {\n  const [text, setText] = React.useState("")\n  const [live, setLive] = React.useState(false)\n  // feed the accumulated string as chunks arrive:\n  //   setText(partial); setLive(true)  …  setLive(false) when done\n  return <MarkdownView markdown={text} streaming={live}/>\n}',
    Render: function StreamLive() {
      const [txt, setTxt] = useState(REPLY_SERVERS);
      const [live, setLive] = useState(false);
      const t = useRef<any>(null);
      useEffect(() => () => clearInterval(t.current), []);
      const replay = () => {
        clearInterval(t.current);
        const words = REPLY_SERVERS.split(' '); let i = 0;
        setLive(true); setTxt('');
        t.current = setInterval(() => {
          i += 4;
          if (i >= words.length) { clearInterval(t.current); setTxt(REPLY_SERVERS); setLive(false); }
          else setTxt(words.slice(0, i).join(' '));
        }, 95);
      };
      return <div style={{ fontFamily: WFONT }}>
        <DemoBtn label={live ? 'Streaming…' : 'Replay stream'} onPress={replay} style={{ marginBottom: 10, background: '#0A84FF' }} />
        <div style={{ border: '1px solid rgba(20,20,40,.1)', borderRadius: 12, padding: '6px 16px', minHeight: 280, background: '#fff' }}>
          <MarkdownView markdown={txt} streaming={live} />
        </div>
      </div>;
    },
  },
};
