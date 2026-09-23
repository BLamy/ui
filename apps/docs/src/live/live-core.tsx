/* Core BL UI / Workbench live blocks — ported from the prototype's DocsLive LIVE registry
   (project/workbench.jsx), rebuilt on the @brett_lamy/* package public APIs. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  AdaptivePane, Avatar, Credenza, EdgeDrawer, Haptics, Icon, IndexBar, SidebarDemo, NavigationStack, Segmented, SideDrawer, SplitView, Spinner,
  Switch as BLSwitch, TabBar, List as BLList, ListSection as BLSection, ListRow as BLRow,
  type AdaptivePaneMode, type Screen,
} from '@brett_lamy/ui';
import { ArtifactChatContainer, ChatDemo, DeliveryTrackingDemo, FloatingSheet, MapChatDemo, ProgressStepper, type FloatingSheetAppearance } from '@brett_lamy/chatkit';
import {
  Composer, ComposerAttach, ComposerAttachments, ComposerBump, ComposerBumpContent, ComposerBumpHandle, ComposerCard, ComposerExpand,
  ComposerFooter, ComposerInput, ComposerSelect, ComposerSend, ComposerSeparator, ComposerSpacer, ComposerStop, ComposerText,
  ModelPicker, WORKBENCH_MODELS, WORKBENCH_PROVIDERS, MarkdownView, MessageScroller, REPLY_SERVERS, SurfaceDiff, SurfaceFiles, SurfacePanel, TermBody, TermHeader, WFONT, WorkbenchDemo,
  type SurfaceKind,
} from '@brett_lamy/workbench';
import { DemoBtn, BLDK, BLFrame, BLL, type LiveSpec } from './frame';

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
  sidebar: {
    title: 'Sidebar · docked, rail, float, overlay', theme: 'wb', h: 420,
    code: 'import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from "@brett_lamy/ui"\n\nexport default function App() {\n  return (\n    <SidebarProvider defaultOpen breakpoint={560}>\n      <Sidebar variant="rail">  {/* docked | rail | float | overlay */}\n        <Sidebar.Header>\n          <Sidebar.Workspace name="Creamery Ops" detail="Production"/>\n        </Sidebar.Header>\n        <Sidebar.Content>\n          <Sidebar.Search/>\n          <Sidebar.Section title="Workspace">\n            <Sidebar.Item icon="home" label="Home" active/>\n            <Sidebar.Item icon="bolt" label="Agent tasks" badge={4}/>\n            <Sidebar.Item icon="inbox" label="Inbox"/>\n          </Sidebar.Section>\n        </Sidebar.Content>\n      </Sidebar>\n      <SidebarInset>\n        <SidebarTrigger/>  {/* hamburger — toggles any variant */}\n        …main content…\n      </SidebarInset>\n    </SidebarProvider>\n  )\n}',
    Render: () => <SidebarDemo />,
  },
  adaptivepane: {
    title: 'AdaptivePane · column, drawer, cover, hidden', theme: 'bl', h: 380,
    code: 'import { AdaptivePane, useContainerWidth } from "@brett_lamy/ui"\n\nexport default function Shell() {\n  const [ref, width] = useContainerWidth()\n  const [open, setOpen] = useState(false)\n  return (\n    <div ref={ref} style={{ position: "relative", display: "flex" }}>\n      <AdaptivePane mode={width < 760 ? "drawer" : "column"} open={open}\n        onClose={() => setOpen(false)} columnWidth={240} drawerWidth={280}>\n        <Navigation />\n      </AdaptivePane>\n      <main style={{ flex: 1 }}>…</main>\n    </div>\n  )\n}',
    Render: function AdaptivePaneLive() {
      const [mode, setMode] = useState<AdaptivePaneMode>('column');
      const [open, setOpen] = useState(true);
      const [drawer, setDrawer] = useState(false);
      return (
        <BLFrame h={340}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <AdaptivePane mode={mode} open={open} onClose={() => setOpen(false)} columnWidth={200} drawerWidth={240} zIndex={20}
              columnStyle={{ borderRight: '1px solid var(--bl-sep)' }}>
              <div style={{ height: '100%', padding: 16, boxSizing: 'border-box', background: 'var(--bl-card)', fontSize: 13.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Pane</div>
                <div style={{ color: 'var(--bl-label2)' }}>Same children, mode: {mode}</div>
                {mode === 'cover' ? <div style={{ marginTop: 14 }}><DemoBtn label="Restore" onPress={() => setMode('column')} /></div> : null}
              </div>
            </AdaptivePane>
            <div style={{ flex: 1, minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Segmented options={['column', 'drawer', 'cover', 'hidden'].map((m) => ({ id: m, label: m }))} value={mode}
                onChange={(v) => { setMode(v as AdaptivePaneMode); setOpen(true); }} />
              <div style={{ fontSize: 13, color: 'var(--bl-label2)', lineHeight: 1.5 }}>A shell picks the mode from its measured width; the pane never remounts its children within a mode.</div>
              <div><DemoBtn label="Open EdgeDrawer" onPress={() => setDrawer(true)} /></div>
            </div>
            <EdgeDrawer side="right" open={drawer} onClose={() => setDrawer(false)} width={240} zIndex={40}>
              <div style={{ height: '100%', padding: 16, boxSizing: 'border-box', background: 'var(--bl-card)', fontSize: 13.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>EdgeDrawer</div>
                <div style={{ color: 'var(--bl-label2)' }}>Headless scrim + panel. Tap the scrim to close.</div>
              </div>
            </EdgeDrawer>
          </div>
        </BLFrame>
      );
    },
  },
  artifactchat: {
    title: 'ArtifactChatContainer · split to floating chat', theme: 'bl', h: 620,
    code: "import { ArtifactChatContainer, Composer, ComposerCard, ComposerInput, ComposerFooter,\n  ComposerAttach, ComposerSpacer, ComposerSend } from \"@brett_lamy/ui\"\n\nexport default function ArtifactWorkspace() {\n  return (\n    <ArtifactChatContainer breakpoint={760} working={isWorking}\n      hideOnScroll fabPosition=\"bottom-center\"\n      onAdd={() => setIsWorking(false)}>\n      <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>\n      <ArtifactChatContainer.Composer>\n        {/* Floating: the transcript hangs off a draggable top bump of this Composer. */}\n        <Composer onSubmit={send}>\n          <ComposerCard>\n            <ComposerInput placeholder=\"Do anything\" />\n            <ComposerFooter>\n              <ComposerAttach /><ComposerSpacer /><ComposerSend />\n            </ComposerFooter>\n          </ComposerCard>\n        </Composer>\n      </ArtifactChatContainer.Composer>\n      <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>\n    </ArtifactChatContainer>\n  )\n}",
    Render: function ArtifactChatLive() {
      const [mode, setMode] = useState('wide');
      const [working, setWorking] = useState(false);
      const compact = mode === 'compact';
      const width = compact ? 430 : 1040;
      const transcript = <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 18px 14px', background: '#131318', color: '#EDEDF2' }}>
        {[['You', 'Compare conversion by region.'], ['BL UI', 'I added the regional breakdown. West is leading at 34%.'], ['You', 'Which region moved most against last month?'], ['BL UI', 'Northeast — up 6.1 points. I highlighted it in the chart.'], ['You', 'Call out the largest change.']].map(([author, copy], index) => <div key={copy} style={{ marginBottom: 18 }}>
          <div style={{ color: index % 2 ? '#68A7FF' : 'rgba(235,235,245,.6)', fontSize: 11, fontWeight: 700 }}>{author}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{copy}</div>
        </div>)}
      </div>;
      const artifact = <div style={{ minHeight: '100%', boxSizing: 'border-box', padding: compact ? 20 : 28, background: '#F6F7FA', color: '#15161A' }}>
        <div style={{ color: '#777B84', fontSize: 11, fontWeight: 750, letterSpacing: '.08em' }}>LIVE ARTIFACT</div>
        <h2 style={{ fontSize: compact ? 23 : 28, margin: '8px 0 22px' }}>Quarterly performance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
          {[['Revenue', '$1.84M'], ['Conversion', '28.4%'], ['Retention', '91.2%']].map(([label, value]) => <div key={label} style={{ minWidth: 0, border: '1px solid #E1E3E8', borderRadius: 13, padding: compact ? 11 : 17, background: '#fff' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: '#777B84', fontSize: 11 }}>{label}</div><strong style={{ display: 'block', marginTop: 7, fontSize: compact ? 15 : 21 }}>{value}</strong>
          </div>)}
        </div>
        <div style={{ marginTop: 14, height: 235, border: '1px solid #E1E3E8', borderRadius: 13, padding: 17, background: '#fff' }}>
          <strong style={{ fontSize: 14 }}>Conversion by region</strong>
          <div style={{ height: 180, display: 'flex', alignItems: 'end', gap: 14, paddingTop: 12 }}>
            {[55, 92, 68, 44, 78].map((height, index) => <div key={index} style={{ flex: 1, height: `${height}%`, borderRadius: '6px 6px 2px 2px', background: index === 1 ? '#0A84FF' : '#B7D7FF' }} />)}
          </div>
        </div>
        <div style={{ marginTop: 14, border: '1px solid #E1E3E8', borderRadius: 13, background: '#fff', overflow: 'hidden' }}>
          {[['Northeast', '34.1%', '+6.1'], ['West', '31.8%', '+2.4'], ['Midwest', '27.2%', '-0.8'], ['South', '24.6%', '+1.2']].map(([region, rate, delta], index) => <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 17px', borderTop: index ? '1px solid #EEF0F4' : 0, fontSize: 13 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{region}</span><strong>{rate}</strong>
            <span style={{ width: 42, textAlign: 'right', color: delta.startsWith('-') ? '#C7362F' : '#1B873F' }}>{delta}</span>
          </div>)}
        </div>
      </div>;
      return <div>
        <div style={{ width: 300, margin: '0 auto 12px' }}>
          <Segmented aria-label="Artifact chat width" value={mode} onChange={setMode} options={[{ id: 'wide', label: 'Split' }, { id: 'compact', label: 'Floating' }]} />
        </div>
        <ScaledShell width={width} height={555}>
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: 12 }}>
            <ArtifactChatContainer breakpoint={760} working={working} workingLabel="Working on the artifact…" onAdd={() => setWorking(false)}>
              <ArtifactChatContainer.Chat>{transcript}</ArtifactChatContainer.Chat>
              <ArtifactChatContainer.Composer>
                <div style={{ padding: 8, background: 'transparent' }}>
                  <Composer onSubmit={() => setWorking(true)}>
                    <ComposerCard>
                      <ComposerExpand />
                      <ComposerAttachments />
                      <ComposerInput placeholder="Do anything" />
                      <ComposerFooter><ComposerAttach /><ComposerSpacer /><ComposerSend /></ComposerFooter>
                    </ComposerCard>
                  </Composer>
                </div>
              </ArtifactChatContainer.Composer>
              <ArtifactChatContainer.Content>{artifact}</ArtifactChatContainer.Content>
            </ArtifactChatContainer>
          </div>
        </ScaledShell>
        <div style={{ textAlign: 'center', marginTop: 8 }}><button type="button" onClick={() => setWorking((value) => !value)} style={{ border: 0, background: 'none', color: 'var(--bl-tint)', font: 'inherit', fontSize: 12, cursor: 'pointer' }}>{working ? 'Show composer state' : 'Preview working state'}</button></div>
      </div>;
    },
  },
  floatingsheet: {
    title: 'FloatingSheet · glass or docked sheet', theme: 'bl', h: 640,
    code: 'import { FloatingSheet, ProgressStepper } from "@brett_lamy/chatkit"\n\nexport default function OrderCard() {\n  return (\n    <div style={{ position: "relative" }}>\n      <Page />\n      <FloatingSheet appearance="sheet" tone="light" gutter={0} peek={300} bodyAlign="start" minimizable={false}>\n        <FloatingSheet.Body>\n          <h2>Preparing your order</h2>\n          <ProgressStepper steps={steps} current={1} labels />\n          …\n        </FloatingSheet.Body>\n        <FloatingSheet.Foot><Button>Continue</Button></FloatingSheet.Foot>\n      </FloatingSheet>\n    </div>\n  )\n}',
    Render: function FloatingSheetLive() {
      const [appearance, setAppearance] = useState<FloatingSheetAppearance>('glass');
      const glass = appearance === 'glass';
      return <div>
        <div style={{ width: 260, margin: '0 auto 12px' }}>
          <Segmented aria-label="Appearance" value={appearance} onChange={(v) => setAppearance(v as FloatingSheetAppearance)} options={[{ id: 'glass', label: 'Glass' }, { id: 'sheet', label: 'Docked sheet' }]} />
        </div>
        <ScaledShell width={430} height={560}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', background: glass ? 'radial-gradient(circle at 30% 20%, #2b2f4a, #0f1017 60%)' : 'radial-gradient(circle at 30% 20%, #fff4e6, #e8ecf3 60%)', color: glass ? '#f5f5f7' : '#1c1c1e', fontFamily: 'var(--bl-font)' }}>
            <div style={{ padding: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', opacity: .6 }}>HOST CONTENT</div>
              <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Anything positioned</h2>
              <p style={{ margin: 0, maxWidth: 300, lineHeight: 1.5, opacity: .75, fontSize: 14 }}>Drag the cap up to grow the sheet into the full page{glass ? ', or down to fold it into a FAB' : ''}.</p>
            </div>
            <FloatingSheet key={appearance} appearance={appearance} tone={glass ? 'dark' : 'light'} gutter={glass ? 20 : 0} radius={glass ? 28 : 20} peek={glass ? 120 : 250} bodyAlign="start" minimizable={glass} label="Order">
              <FloatingSheet.Body>
                <div style={{ padding: '2px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 21 }}>Preparing your order</h3>
                  <ProgressStepper current={1} labels steps={[{ id: 'a', label: 'Placed' }, { id: 'b', label: 'Preparing' }, { id: 'c', label: 'Ready' }, { id: 'd', label: 'Picked up' }]} />
                  {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ height: 64, borderRadius: 14, background: 'rgba(120,120,128,.14)' }} />)}
                </div>
              </FloatingSheet.Body>
              <FloatingSheet.Foot>
                <div style={{ padding: '8px 16px 16px' }}>
                  <button type="button" style={{ width: '100%', height: 44, border: 0, borderRadius: 999, background: 'var(--bl-tint)', color: '#fff', fontWeight: 700, font: 'inherit', fontSize: 15 }}>Continue</button>
                </div>
              </FloatingSheet.Foot>
            </FloatingSheet>
          </div>
        </ScaledShell>
      </div>;
    },
  },
  mapchat: {
    title: 'MapChat · always-floating chat with map tools', theme: 'bl', h: 760,
    code: 'import { ArtifactChatContainer, TileMap } from "@brett_lamy/chatkit"\n\n<ArtifactChatContainer layout="floating" peek={236} working={busy} hideOnScroll={false}>\n  <ArtifactChatContainer.Content>\n    <TileMap view={view} pins={pins} route={route} controls onPinClick={focusPlace} />\n  </ArtifactChatContainer.Content>\n  <ArtifactChatContainer.Chat><Transcript turns={turns} /></ArtifactChatContainer.Chat>\n  <ArtifactChatContainer.Composer>\n    <Composer wide onSend={send} streaming={busy} onStop={stop} />\n  </ArtifactChatContainer.Composer>\n</ArtifactChatContainer>',
    Render: function MapChatLive() {
      return <ScaledShell width={430} height={720}>
        <MapChatDemo style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
      </ScaledShell>;
    },
  },
  delivery: {
    title: 'DeliveryTracking · map under a docked sheet', theme: 'bl', h: 820,
    code: 'import { FloatingSheet, ProgressStepper, TileMap, cartoVoyagerTiles } from "@brett_lamy/chatkit"\n\n<div style={{ position: "relative" }}>\n  <TileMap view={route} pins={[store, car]} route={path} tileUrl={cartoVoyagerTiles} scheme="light" />\n  <FloatingSheet appearance="sheet" tone="light" gutter={0} peek={344} bodyAlign="start" minimizable={false} scrim={false}>\n    <FloatingSheet.Body>\n      <h2>Preparing your order</h2>\n      <ProgressStepper steps={steps} current={stage} />\n      …\n    </FloatingSheet.Body>\n  </FloatingSheet>\n</div>',
    Render: function DeliveryLive() {
      return <ScaledShell width={430} height={780}>
        <DeliveryTrackingDemo style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
      </ScaledShell>;
    },
  },
  chatshell: {
    title: 'ChatShell · responsive composition', theme: 'bl', h: 580,
    code: 'import { ChatShell } from "@brett_lamy/chatkit"\n\nexport default function Chat() {\n  return (\n    <ChatShell breakpoint={880}>\n      <ChatShell.Rail><WorkspaceRail /></ChatShell.Rail>\n      <ChatShell.Nav><ChannelNav /></ChatShell.Nav>\n      <ChatShell.Main><ChannelMain /></ChatShell.Main>\n    </ChatShell>\n  )\n}',
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
        <div style={{ fontSize: 12, color: 'var(--bl-label2)', textAlign: 'center', marginTop: 8 }}>
          {compact ? 'Compact: open the hamburger to reveal the rail and channels.' : 'Wide: the workspace rail and channel navigation stay docked.'}
        </div>
      </div>;
    },
  },
  workbenchshell: {
    title: 'WorkbenchShell · responsive composition', theme: 'wb', h: 590,
    code: 'import { WorkbenchShell } from "@brett_lamy/workbench"\n\nexport default function Workbench() {\n  return (\n    <WorkbenchShell>\n      <WorkbenchShell.Sidebar><ThreadList /></WorkbenchShell.Sidebar>\n      <WorkbenchShell.Main><Conversation /></WorkbenchShell.Main>\n      <WorkbenchShell.Dock><TerminalDock /></WorkbenchShell.Dock>\n      <WorkbenchShell.Panel><SurfacePanel /></WorkbenchShell.Panel>\n      <WorkbenchShell.TabBar><SurfaceTabs /></WorkbenchShell.TabBar>\n    </WorkbenchShell>\n  )\n}',
    Render: function WorkbenchShellLive() {
      const [mode, setMode] = useState('regular');
      const compact = mode === 'compact';
      const width = compact ? 430 : 1180;
      return <div>
        <div style={{ ...BLDK, width: 280, margin: '0 auto 12px' } as CSSProperties}>
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
    title: 'BLList · BLSection · BLRow', theme: 'bl', h: 340,
    code: 'import { BLList, BLSection, BLRow, Avatar, BLSwitch, Haptics } from "./blui.tsx"\n\nexport default function App() {\n  const [dnd, setDnd] = React.useState(true)\n  const people = [\n    { f: "Maya", l: "Lindqvist", role: "Industrial design" },\n    { f: "Jonas", l: "Ito", role: "Haptics engineering" },\n  ]\n  return (\n    <BLList inset>\n      <BLSection title="Team" footer="Rows are real buttons — arrow keys work too.">\n        {people.map(p => (\n          <BLRow key={p.l} leading={<Avatar c={p} size={36}/>}\n            title={p.f + " " + p.l} subtitle={p.role}\n            accessory="chevron" onPress={() => Haptics.impact("light")}/>\n        ))}\n        <BLRow title="Do Not Disturb" divider={false}\n          trailing={<BLSwitch checked={dnd} onChange={setDnd}/>}/>\n      </BLSection>\n    </BLList>\n  )\n}',
    Render: function RowLive() {
      const [dnd, setDnd] = useState(true);
      const people = [{ f: 'Maya', l: 'Lindqvist', role: 'Industrial design' }, { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' }];
      return <div style={{ maxWidth: 430, margin: '0 auto' }}><BLList inset>
        <BLSection title="Team" footer="Rows are real buttons — arrow keys work too.">
          {people.map((p) => <BLRow key={p.l} leading={<Avatar c={p} size={36} />} title={p.f + ' ' + p.l} subtitle={p.role} accessory="chevron" onPress={() => Haptics.impact('light')} />)}
          <BLRow title="Do Not Disturb" divider={false} trailing={<BLSwitch aria-label="Do Not Disturb" checked={dnd} onChange={setDnd} />} />
        </BLSection>
      </BLList></div>;
    },
  },
  credenza: {
    title: 'Credenza', theme: 'bl', h: 340,
    code: 'import { Credenza, BLRow, Icon, Haptics } from "./blui.tsx"\n\nexport default function App() {\n  const [view, setView] = React.useState(null)\n  const done = () => { Haptics.notification("success"); setView("done") }\n  return (\n    <div style={{ display: "grid", placeItems: "center", minHeight: 220 }}>\n      <button onClick={() => { Haptics.impact("light"); setView("menu") }}>\n        Share Contact…\n      </button>\n      <Credenza open={!!view} view={view || "menu"}\n        title={view === "done" ? "Shared" : "Share Contact"}\n        canBack={view === "done"} onBack={() => setView("menu")}\n        onClose={() => setView(null)}>\n        {view === "done"\n          ? <p style={{ textAlign: "center", padding: 24 }}>Contact shared ✓</p>\n          : <div>\n              <BLRow leading={<Icon name="qr" size={20}/>} title="Show QR code" onPress={done}/>\n              <BLRow leading={<Icon name="doc" size={20}/>} title="Copy vCard" divider={false} onPress={done}/>\n            </div>}\n      </Credenza>\n    </div>\n  )\n}',
    Render: function CredLive() {
      const [view, setView] = useState<string | null>(null);
      const done = () => { Haptics.notification('success'); setView('done'); };
      return <div style={{ display: 'grid', placeItems: 'center', minHeight: 210 }}>
        <button onClick={() => { Haptics.impact('light'); setView('menu'); }}
          style={{ border: 0, borderRadius: 11, background: 'var(--bl-tint)', color: '#fff', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 600, padding: '11px 20px', cursor: 'pointer' }}>Share Contact…</button>
        <Credenza open={!!view} view={view || 'menu'} title={view === 'done' ? 'Shared' : 'Share Contact'}
          canBack={view === 'done'} onBack={() => setView('menu')} onClose={() => setView(null)}>
          {view === 'done'
            ? <div style={{ textAlign: 'center', padding: '26px 18px' }}>
                <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(52,199,89,.15)', display: 'inline-grid', placeItems: 'center', color: 'var(--bl-green)' }}><Icon name="check" size={24} sw={2.4} /></span>
                <div style={{ fontWeight: 650, fontSize: 16, marginTop: 10 }}>Contact shared</div>
                <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 3 }}>The card spring-morphs its height to each state.</div>
              </div>
            : <div style={{ padding: '4px 6px 8px' }}>
                <BLRow leading={<Icon name="layers" size={20} />} title="Show QR code" onPress={done} />
                <BLRow leading={<Icon name="mail" size={20} />} title="Copy vCard" divider={false} onPress={done} />
              </div>}
        </Credenza>
      </div>;
    },
  },
  composer: {
    title: 'Composer · compositional parts', theme: 'wb', h: 340,
    code: "import {\n  Composer, ComposerBump, ComposerBumpHandle, ComposerBumpContent, ComposerCard,\n  ComposerAttachments, ComposerInput, ComposerExpand, ComposerFooter, ComposerSelect,\n  ComposerSeparator, ComposerSpacer, ComposerAttach, ComposerStop, ComposerSend,\n  ComposerText, ModelPicker, WORKBENCH_MODELS, WORKBENCH_PROVIDERS,\n} from \"@brett_lamy/ui\"\n\nexport default function App() {\n  const [streaming, setStreaming] = React.useState(false)\n  const send = (markdown, attachments) => {\n    console.log(markdown, attachments); setStreaming(true)\n    setTimeout(() => setStreaming(false), 1600)\n  }\n  return (\n    <Composer onSubmit={send} streaming={streaming} onStop={() => setStreaming(false)}\n      defaultValue={\"## Ship checklist\\n\\n- Highlight code\\n- Publish package\"}>\n      <ComposerBump side=\"top\" draggable maxReveal={160}>\n        <ComposerBumpContent><Log /></ComposerBumpContent>\n        <ComposerBumpHandle>\n          <ComposerText className=\"flex-1\">Monitoring \u00b7 pnpm dev</ComposerText>\n        </ComposerBumpHandle>\n      </ComposerBump>\n      <ComposerCard size=\"lg\">\n        <ComposerExpand />\n        <ComposerAttachments />\n        <ComposerInput placeholder=\"Ask anything, paste an image\" />\n        <ComposerFooter>\n          <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} />\n          <ComposerSeparator />\n          <ComposerSelect aria-label=\"Effort\" options={efforts} />\n          <ComposerSeparator />\n          <ComposerSelect aria-label=\"Access\" icon=\"lock\" options={access} />\n          <ComposerSpacer />\n          <ComposerAttach />\n          <ComposerStop variant=\"solid\" />\n          <ComposerSend morph={false} />\n        </ComposerFooter>\n      </ComposerCard>\n      <ComposerBump side=\"bottom\">\n        <ComposerBumpHandle>\n          <ComposerText icon=\"folder\" className=\"flex-1\">Local checkout</ComposerText>\n          <ComposerText icon=\"branch\">main</ComposerText>\n        </ComposerBumpHandle>\n      </ComposerBump>\n    </Composer>\n  )\n}",
    Render: function CompLive() {
      const [streaming, setStreaming] = useState(false);
      const t = useRef<any>(null);
      useEffect(() => () => clearTimeout(t.current), []);
      const efforts = [{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }];
      const access = [{ id: 'full', label: 'Full access' }, { id: 'read', label: 'Read only' }];
      return <div style={{ maxWidth: 580, margin: '0 auto', paddingTop: 24 }}>
        <Composer defaultValue={'## Ship checklist\n\n- Highlight code\n- Publish package'}
          onSubmit={() => { setStreaming(true); clearTimeout(t.current); t.current = setTimeout(() => setStreaming(false), 1600); }}
          streaming={streaming} onStop={() => { clearTimeout(t.current); setStreaming(false); }}>
          <ComposerBump side="top" draggable maxReveal={160}>
            <ComposerBumpContent label="Dev server log">
              <div style={{ padding: '10px 14px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, lineHeight: 1.6, opacity: 0.8 }}>
                <div>✓ ready in 412 ms</div><div>✓ 287 stories indexed</div><div>→ composer.tsx changed, HMR update</div>
              </div>
            </ComposerBumpContent>
            <ComposerBumpHandle>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--wb-green)' }} />
              <ComposerText className="flex-1">Monitoring · pnpm dev</ComposerText>
            </ComposerBumpHandle>
          </ComposerBump>
          <ComposerCard size="lg">
            <ComposerExpand />
            <ComposerAttachments />
            <ComposerInput placeholder="Ask anything, paste an image" />
            <ComposerFooter>
              <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} defaultValue="claude-opus-5-5" />
              <ComposerSeparator />
              <ComposerSelect aria-label="Effort" options={efforts} defaultValue="medium" />
              <ComposerSeparator />
              <ComposerSelect aria-label="Access" icon="lock" options={access} />
              <ComposerSpacer />
              <ComposerAttach />
              <ComposerStop variant="solid" />
              <ComposerSend morph={false} />
            </ComposerFooter>
          </ComposerCard>
          <ComposerBump side="bottom">
            <ComposerBumpHandle>
              <ComposerText icon="folder" className="flex-1">Local checkout</ComposerText>
              <ComposerText icon="branch">main</ComposerText>
            </ComposerBumpHandle>
          </ComposerBump>
        </Composer>
      </div>;
    },
  },
  controls: {
    title: 'Segmented · BLSwitch · Spinner · Avatar', theme: 'bl', h: 300,
    code: 'import { Segmented, BLSwitch, Spinner, Avatar, Haptics } from "./blui.tsx"\n\nexport default function App() {\n  const [range, setRange] = React.useState("day")\n  const [on, setOn] = React.useState(true)\n  return (\n    <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>\n      <Segmented value={range} onChange={setRange} options={[\n        { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" },\n      ]}/>\n      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>\n        <Avatar c={{ f: "Ada", l: "Lovelace" }} size={40}/>\n        <BLSwitch checked={on} onChange={setOn}/>\n        <Spinner/>\n      </div>\n    </div>\n  )\n}',
    Render: function CtlLive() {
      const [range, setRange] = useState('day');
      const [on, setOn] = useState(true);
      return <div style={{ display: 'grid', gap: 16, justifyItems: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ width: 280 }}><Segmented value={range} onChange={setRange} options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} /></div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={40} />
          <BLSwitch aria-label="Demo switch" checked={on} onChange={setOn} />
          <Spinner />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--bl-label2)' }}>@brett_lamy/ui is live — every control ticks.</div>
      </div>;
    },
  },
  theming: {
    title: 'Theme tokens', theme: 'bl', h: 330,
    code: 'import { BLList, BLSection, BLRow, BLSwitch, Icon } from "./blui.tsx"\n\nexport default function App() {\n  const [dark, setDark] = React.useState(false)\n  const [tint, setTint] = React.useState("#0A84FF")\n  return (\n    <div style={{ ...(dark ? DARK_TOKENS : LIGHT_TOKENS), "--bl-tint": tint }}>\n      {/* every component reads the nearest --bl-* tokens */}\n      <BLList inset>\n        <BLSection title="Appearance">\n          <BLRow leading={<Icon name="bell" size={20}/>} title="Dark Mode" divider={false}\n            trailing={<BLSwitch checked={dark} onChange={setDark}/>}/>\n        </BLSection>\n      </BLList>\n    </div>\n  )\n}',
    Render: function ThemeLive() {
      const [dark, setDark] = useState(false);
      const [tint, setTint] = useState('#0A84FF');
      return <div style={{ ...(dark ? BLDK : BLL), '--bl-tint': tint, background: 'var(--bl-bg2)', borderRadius: 14, padding: 16, colorScheme: dark ? 'dark' : 'light', color: 'var(--bl-label)', maxWidth: 430, margin: '0 auto', transition: 'background .25s' } as any}>
        <div style={{ display: 'flex', gap: 9, marginBottom: 12, justifyContent: 'center' }}>
          {['#0A84FF', '#5E5CE6', '#34C759', '#FF9F0A', '#FF375F'].map((c) => <button key={c} onClick={() => { setTint(c); Haptics.selection(); }} aria-label={'Tint ' + c}
            style={{ width: 23, height: 23, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0, border: '1px solid rgba(0,0,0,.1)', outline: tint === c ? '2.5px solid ' + c : 'none', outlineOffset: 2 }} />)}
        </div>
        <BLList inset>
          <BLSection title="Appearance">
            <BLRow leading={<Icon name="bell" size={20} />} title="Dark Mode" divider={false} trailing={<BLSwitch aria-label="Dark Mode" checked={dark} onChange={setDark} />} />
          </BLSection>
        </BLList>
        <DemoBtn label="Tinted action" onPress={() => Haptics.impact('light')} style={{ display: 'block', margin: '12px auto 0' }} />
      </div>;
    },
  },
  nav: {
    title: 'NavigationStack', theme: 'bl', h: 420,
    code: 'import { NavigationStack, BLList, BLSection, BLRow, Icon } from "./blui.tsx"\n\nexport default function App() {\n  const [sel, setSel] = React.useState(null)\n  const screens = [\n    { key: "root", title: "Teams", grouped: true, content:\n      <BLList inset><BLSection>\n        {["Design", "Engineering", "Research"].map((t, i) => (\n          <BLRow key={t} leading={<Icon name="person" size={20}/>} title={t}\n            accessory="chevron" divider={i < 2} onPress={() => setSel(t)}/>\n        ))}\n      </BLSection></BLList> },\n  ]\n  if (sel) screens.push({ key: "detail", title: sel, grouped: true,\n    content: <p style={{ padding: 24 }}>Pushed — back chevron or edge-swipe pops.</p> })\n  return <NavigationStack screens={screens} onPop={() => setSel(null)}/>\n}',
    Render: function NavLive() {
      const [sel, setSel] = useState<string | null>(null);
      const screens: Screen[] = [{ key: 'root', title: 'Teams', grouped: true, content:
        <BLList inset><BLSection>
          {['Design', 'Engineering', 'Research'].map((t, i) => <BLRow key={t} leading={<Icon name="person" size={20} />} title={t}
            accessory="chevron" divider={i < 2} onPress={() => { Haptics.impact('light'); setSel(t); }} />)}
        </BLSection></BLList> }];
      if (sel) screens.push({ key: 'detail', title: sel, grouped: true, content:
        <div style={{ padding: '28px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 650 }}>{sel}</div>
          <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 5, lineHeight: 1.5 }}>Pushed screen — use the back chevron, or drag from the left edge to pop interactively.</div>
        </div> });
      return <BLFrame h={330}><NavigationStack screens={screens} onPop={() => setSel(null)} /></BLFrame>;
    },
  },
  tabs: {
    title: 'TabBar', theme: 'bl', h: 420,
    code: 'import { TabBar, Icon } from "./blui.tsx"\n\nexport default function App() {\n  const [tab, setTab] = React.useState("contacts")\n  return (\n    <div style={{ position: "relative", height: 320 }}>\n      <main style={{ position: "absolute", inset: "0 0 62px" }}>{/* per-tab content */}</main>\n      <TabBar selected={tab} onSelect={setTab} items={[\n        { id: "contacts", icon: "person", label: "Contacts" },\n        { id: "recents",  icon: "clock",  label: "Recents" },\n        { id: "settings", icon: "gear",   label: "Settings" },\n      ]}/>\n    </div>\n  )\n}',
    Render: function TabsLive() {
      const [tab, setTab] = useState('contacts');
      const items = [{ id: 'contacts', icon: 'person', title: 'Contacts' }, { id: 'recents', icon: 'clock', title: 'Recents' }, { id: 'settings', icon: 'sliders', title: 'Settings' }];
      const blurb: Record<string, string> = { contacts: 'Each tab keeps its own stack — pushes slide under this bar.', recents: 'Tab state survives switching away and back.', settings: 'Every selection fires Haptics.selection().' };
      const cur = items.find((i) => i.id === tab)!;
      return <BLFrame h={330} bg="var(--bl-bg)">
        <div style={{ position: 'absolute', inset: '0 0 62px', display: 'grid', placeItems: 'center', padding: '0 28px', textAlign: 'center' }}>
          <div>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 46, height: 46, borderRadius: 13, background: 'var(--bl-fill)', color: 'var(--bl-tint)' }}><Icon name={cur.icon as any} size={25} /></span>
            <div style={{ fontSize: 16.5, fontWeight: 650, marginTop: 10 }}>{cur.title}</div>
            <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 4, lineHeight: 1.5 }}>{blurb[tab]}</div>
          </div>
        </div>
        <TabBar items={items} selected={tab} onSelect={setTab} />
      </BLFrame>;
    },
  },
  split: {
    title: 'SplitView', theme: 'bl', h: 470,
    code: 'import { SplitView } from "./blui.tsx"\n\nexport default function App() {\n  const [wc, setWc] = React.useState("regular")  // measure your container for real\n  return (\n    <SplitView wc={wc}\n      sidebar={<Folders/>}\n      master={<NoteList/>}\n      detail={<Note/>}\n      drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}/>\n  )\n}',
    Render: function SplitLive() {
      const [wc, setWc] = useState('regular');
      const [drawer, setDrawer] = useState(false);
      const mini = (name: string, rows: string[]) => <div style={{ height: '100%', overflowY: 'auto' }}><BLList>
        <BLSection title={name}>{rows.map((t, i) => <BLRow key={t} title={t} divider={i < rows.length - 1} />)}</BLSection>
      </BLList></div>;
      return <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ width: 290 }}><Segmented value={wc} onChange={(id) => { setWc(id); setDrawer(false); }}
            options={[{ id: 'regular', label: 'Regular' }, { id: 'medium', label: 'Medium' }, { id: 'compact', label: 'Compact' }]} /></div>
          {wc !== 'regular' ? <DemoBtn label="Sidebar" onPress={() => setDrawer(true)} style={{ padding: '6px 12px', fontSize: 12.5 }} /> : null}
        </div>
        <BLFrame h={330} bg="var(--bl-bg)">
          <SplitView wc={wc} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}
            sidebar={<div style={{ height: '100%', background: 'var(--bl-side)', overflowY: 'auto' }}>{mini('Folders', ['All Notes', 'Shared', 'Archive'])}</div>}
            master={mini('Notes', ['Springs — stiffness 620', 'IndexBar scrub ticks', 'Credenza height morph'])}
            detail={<div style={{ height: '100%', display: 'grid', placeItems: 'center', background: 'var(--bl-bg2)', textAlign: 'center', padding: 22 }}>
              <div><div style={{ fontWeight: 650 }}>Detail</div>
              <div style={{ fontSize: 12.5, color: 'var(--bl-label2)', marginTop: 5, lineHeight: 1.5 }}>regular: 3 columns · medium: sidebar becomes a drawer · compact: collapses into the stack</div></div>
            </div>} />
        </BLFrame>
      </div>;
    },
  },
  indexbar: {
    title: 'IndexBar', theme: 'bl', h: 470,
    code: 'import { IndexBar, BLList, BLSection, BLRow } from "./blui.tsx"\n\nexport default function App() {\n  const sc = React.useRef(null), els = React.useRef({})\n\n  // Any jump points you like — key is yours, preview is what the bubble shows\n  const stops = turns\n    .filter(t => t.role === "user")\n    .map(t => ({ key: t.id, preview: t.text, caption: "You" }))   // no label → a dot on the rail\n\n  return (\n    <div style={{ position: "relative", height: 340 }}>\n      <div ref={sc} style={{ position: "absolute", inset: 0, overflowY: "auto" }}>\n        {turns.map(t => <Turn key={t.id} t={t} ref={el => els.current[t.id] = el}/>)}\n      </div>\n      <IndexBar items={stops} top={8} bottom={8}\n        onJump={(key, stop) => sc.current.scrollTop = els.current[key].offsetTop - 8}/>\n    </div>\n  )\n}\n\n// Pass no items and it falls back to the UIKit A–Z form:\n// <IndexBar avail={new Set(["A","B","C"])} onLetter={L => jumpTo(L)}/>\n\n// Or the wave rail — dashes that swell under the pointer, with a title + preview card:\n// <IndexBar variant="wave" side="left" items={stops} value={turnInView} onJump={jump}/>',
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
      const waveStops = TURNS.map((t) => ({ key: t.id, preview: t.text, caption: t.role === 'user' ? 'You' : 'Assistant' }));
      const jump = (key: string) => { const el = els.current[key]; if (el && sc.current) sc.current.scrollTop = Math.max(0, el.offsetTop - 8); };
      return <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 330 }}><Segmented value={mode} onChange={setMode}
            options={[{ id: 'stops', label: 'Custom stops' }, { id: 'az', label: 'A–Z fallback' }, { id: 'wave', label: 'Wave' }]} /></div>
        </div>
        <BLFrame h={340} bg="var(--bl-bg)">
          <div ref={sc} style={mode === 'wave'
            ? { position: 'absolute', inset: 0, overflowY: 'auto', paddingLeft: 40 }
            : { position: 'absolute', inset: 0, overflowY: 'auto', paddingRight: 26 }}>
            {mode === 'az'
              ? <BLList>
                  {letters.map((L) => <div key={L} ref={(el) => { if (el) els.current[L] = el; }}>
                    <BLSection title={L} sticky>{data[L].map((n, i) => <BLRow key={n} title={n} divider={i < data[L].length - 1} />)}</BLSection>
                  </div>)}
                </BLList>
              : <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {TURNS.map((t) => <div key={t.id} ref={(el) => { if (el) els.current[t.id] = el; }}
                    style={{ display: 'flex', justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '80%', padding: '9px 13px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.4, textWrap: 'pretty',
                      background: t.role === 'user' ? 'var(--bl-tint)' : 'var(--bl-card)',
                      color: t.role === 'user' ? '#fff' : 'var(--bl-label)',
                      boxShadow: t.role === 'user' ? 'none' : '0 0 0 1px var(--bl-sep)' } as any}>{t.text}</div>
                  </div>)}
                  <div style={{ height: 120 }} />
                </div>}
          </div>
          {mode === 'az'
            ? <IndexBar avail={new Set(letters)} top={8} bottom={8} onLetter={jump} />
            : mode === 'wave'
            ? <IndexBar variant="wave" side="left" items={waveStops} top={10} bottom={10} onJump={jump} label="Jump to a turn" />
            : <IndexBar items={stops} top={10} bottom={10} onJump={jump} label="Jump to a turn" />}
        </BLFrame>
        <div style={{ fontSize: 12, color: 'var(--bl-label2)', textAlign: 'center', marginTop: 8 }}>
          {mode === 'stops' ? 'Hover a dot to peek the turn · drag to scrub with a tick per stop'
            : mode === 'wave' ? 'variant="wave" side="left" · the dashes swell under the pointer, one tick per turn'
            : 'No items → the A–Z rail, unchanged'}
        </div>
      </div>;
    },
  },
  sidedrawer: {
    title: 'SideDrawer', theme: 'bl', h: 460,
    code: 'import { SideDrawer } from "./blui.tsx"\n\nexport default function App() {\n  const [mode, setMode] = React.useState("overlay")  // or "fixed"\n  const [open, setOpen] = React.useState(false)\n  return (\n    <div style={{ position: "relative", display: "flex", height: 330 }}>\n      <main style={{ flex: 1 }}>\n        <button onClick={() => setOpen(true)}>Show Activity</button>\n      </main>\n      <SideDrawer mode={mode} open={open} onClose={() => setOpen(false)}\n        title="Activity" width={230}>\n        {/* same children in every presentation */}\n      </SideDrawer>\n    </div>\n  )\n}',
    Render: function DrawerLive() {
      const [mode, setMode] = useState<'overlay' | 'fixed'>('overlay');
      const [open, setOpen] = useState(false);
      const rows = ['Outgoing call · 2 min', 'iMessage · yesterday', 'FaceTime · Mon', 'Mail · Re: schedule'];
      return <div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ width: 230 }}><Segmented value={mode} onChange={(id) => { setMode(id as any); setOpen(id === 'fixed'); }}
            options={[{ id: 'overlay', label: 'Overlay' }, { id: 'fixed', label: 'Fixed' }]} /></div>
        </div>
        <BLFrame h={330} bg="var(--bl-bg)">
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
              <div>
                <div style={{ fontWeight: 650, fontSize: 15.5 }}>Detail view</div>
                {mode === 'overlay'
                  ? <DemoBtn label="Show Activity" onPress={() => { Haptics.impact('light'); setOpen(true); }} style={{ marginTop: 12, fontSize: 13, padding: '8px 14px' }} />
                  : <div style={{ fontSize: 12.5, color: 'var(--bl-label2)', marginTop: 6, lineHeight: 1.5 }}>Docked column — no scrim,<br />part of the layout.</div>}
              </div>
            </div>
            <SideDrawer mode={mode} open={open} onClose={() => setOpen(false)} title="Activity" width={230}>
              {rows.map((t) => <div key={t} style={{ padding: '11px 16px', fontSize: 13, borderBottom: '1px solid var(--bl-sep)', color: 'var(--bl-label2)' }}>{t}</div>)}
            </SideDrawer>
          </div>
        </BLFrame>
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
    title: 'MarkdownView · Docstream renderer', theme: 'bl', h: 480,
    code: 'import { MarkdownView } from "@brett_lamy/workbench"\n\nexport default function App() {\n  const [text, setText] = React.useState("")\n  const [live, setLive] = React.useState(false)\n  // feed the accumulated string as chunks arrive:\n  //   setText(partial); setLive(true)  …  setLive(false) when done\n  return <MarkdownView markdown={text} streaming={live}/>\n}',
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
        <div style={{ border: '1px solid var(--bl-sep)', borderRadius: 12, padding: '6px 16px', minHeight: 280, background: 'var(--bl-card)', color: 'var(--bl-label)' }}>
          <MarkdownView markdown={txt} streaming={live} />
        </div>
      </div>;
    },
  },
};
