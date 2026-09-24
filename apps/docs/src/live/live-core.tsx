/* Core BL UI / Workbench live blocks — ported from the prototype's DocsLive LIVE registry
   (project/workbench.jsx), rebuilt on the @brett_lamy/* package public APIs.
   Each `code` is a copy-pasteable sample against the public package (@brett_lamy/ui); DocsLive rewrites any
   internal workspace package name to it. `variants` render as a switch in the card header. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AdaptivePane, Avatar, BLProvider, Button, Credenza, EdgeDrawer, Haptics, Icon, IndexBar, SidebarDemo, NavigationStack, Segmented,
  SideDrawer, SplitView, Spinner, Switch, TabView, TabViewBar, TabViewList, TabViewPanel, TabViewPanels, TabViewTab,
  List, ListSection, ListRow, useAppearance,
  type AdaptivePaneMode, type Screen,
} from '@brett_lamy/ui';
import {
  ArtifactChatContainer, ChatDemo, DeliveryTrackingDemo, FloatingSheet, MapChatDemo, ProgressStepper, WorkspaceRail, useFloatingSheet,
  type FloatingSheetAppearance,
} from '@brett_lamy/chatkit';
import {
  Composer, ComposerAttach, ComposerAttachments, ComposerBump, ComposerBumpContent, ComposerBumpHandle, ComposerCard, ComposerExpand,
  ComposerFooter, ComposerInput, ComposerOptions, ComposerOptionsOutlet, ComposerSelect, ComposerSend, ComposerSeparator, ComposerSpacer, ComposerStop, ComposerText,
  ModelPicker, WORKBENCH_MODELS, WORKBENCH_PROVIDERS, MarkdownView, MessageScroller, REPLY_SERVERS, SurfaceDiff, SurfaceFiles, SurfacePanel, TermBody, TermHeader, WFONT, WorkbenchDemo,
  type SurfaceKind,
} from '@brett_lamy/workbench';
import { DemoBtn, BLFrame, type LiveSpec } from './frame';

/** Lays a fixed-size composition out at its design width, scaled down (never up) to fit, centered. */
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
  return <div ref={host} style={{ width: '100%', maxWidth: width, margin: '0 auto', height: height * scale, position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
  </div>;
}

/* ── FloatingSheet presets (the FloatingSheet page) ── */
const SHEET_STEPS = [{ id: 'placed', label: 'Placed' }, { id: 'preparing', label: 'Preparing' }, { id: 'ready', label: 'Ready' }, { id: 'picked', label: 'Picked up' }];
interface SheetPreset { appearance: FloatingSheetAppearance; gutter: number; radius: number; peek: number; minimizable: boolean; foot: boolean; defaultOpen?: boolean; note: string }
const SHEET_PRESETS: Record<string, SheetPreset> = {
  glass: { appearance: 'glass', gutter: 20, radius: 28, peek: 0, minimizable: true, foot: true, note: 'Rests on its foot. Drag the cap up to grow it, or down to fold it into a FAB.' },
  peeking: { appearance: 'glass', gutter: 20, radius: 28, peek: 190, minimizable: true, foot: true, note: 'peek keeps the top of the body visible above the foot while resting.' },
  card: { appearance: 'sheet', gutter: 14, radius: 26, peek: 150, minimizable: true, foot: true, note: 'An opaque card that floats inside a gutter.' },
  docked: { appearance: 'sheet', gutter: 0, radius: 20, peek: 250, minimizable: false, foot: false, note: 'gutter={0} docks it edge to edge like a system sheet; it cannot be folded away.' },
  open: { appearance: 'glass', gutter: 20, radius: 28, peek: 0, minimizable: true, foot: true, defaultOpen: true, note: 'Fully grown: the cap meets the top edge and the host dims behind it.' },
};
const composerCode = (variant: string) => {
  const collapse = variant === 'compact' ? ' defaultCollapsed="compact"' : variant === 'scroll' ? ' collapseOnScroll={scrollerRef} collapseTo="fab"' : '';
  const top = variant === 'full' ? `
      <ComposerBump side="top" draggable maxReveal={160}>
        <ComposerBumpContent><Log /></ComposerBumpContent>
        <ComposerBumpHandle>
          <ComposerText className="flex-1">Monitoring · pnpm dev</ComposerText>
        </ComposerBumpHandle>
      </ComposerBump>` : '';
  return `import {
  Composer, ComposerBump, ComposerBumpHandle, ComposerBumpContent, ComposerCard,
  ComposerAttachments, ComposerInput, ComposerFooter, ComposerOptions, ComposerOptionsOutlet,
  ComposerSelect, ComposerSeparator, ComposerSpacer, ComposerAttach, ComposerStop, ComposerSend,
  ComposerText, ModelPicker, WORKBENCH_MODELS, WORKBENCH_PROVIDERS,
} from "@brett_lamy/ui"

// Options live in the footer; when the composer is compact they move into the bottom bump's outlet.
export default function App() {
  return (
    <Composer onSubmit={send} streaming={streaming} onStop={stop}${collapse}>${top}
      <ComposerCard size="lg">
        <ComposerAttachments />
        <ComposerInput placeholder="Ask anything, paste an image" />
        <ComposerFooter>
          <ComposerOptions>
            <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} />
            <ComposerSeparator />
            <ComposerSelect aria-label="Effort" options={efforts} />
            <ComposerSeparator />
            <ComposerSelect aria-label="Access" icon="lock" options={access} />
          </ComposerOptions>
          <ComposerSpacer />
          <ComposerAttach />
          <ComposerStop variant="solid" />
          <ComposerSend morph={false} />
        </ComposerFooter>
      </ComposerCard>
      <ComposerBump side="bottom">
        <ComposerBumpHandle>
          <ComposerText icon="folder">Local checkout</ComposerText>
          <ComposerOptionsOutlet />
          <ComposerSpacer />
          <ComposerText icon="branch">main</ComposerText>
        </ComposerBumpHandle>
      </ComposerBump>
    </Composer>
  )
}`;
};

const sheetCode = (variant: string) => {
  const p = SHEET_PRESETS[variant] ?? SHEET_PRESETS.glass;
  const props = [
    `appearance="${p.appearance}"`,
    `gutter={${p.gutter}}`,
    `radius={${p.radius}}`,
    p.peek ? `peek={${p.peek}}` : null,
    p.minimizable ? null : 'minimizable={false}',
    p.defaultOpen ? 'defaultOpen' : null,
    'label="Order"',
  ].filter(Boolean).map((l) => '        ' + l).join('\n');
  const foot = p.foot
    ? `\n        <FloatingSheet.Foot>\n          <div style={{ padding: '8px 16px 16px' }}>\n            <Button size="pill">Continue</Button>\n          </div>\n        </FloatingSheet.Foot>`
    : '';
  return `import { Button, FloatingSheet, ProgressStepper } from '@brett_lamy/ui'

const steps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
]

export default function OrderSheet() {
  return (
    <div style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
      <p style={{ padding: 22 }}>Any positioned content — a map, a canvas, a page.</p>
      <FloatingSheet
${props}
      >
        <FloatingSheet.Body>
          <div style={{ padding: '4px 20px 24px' }}>
            <h3>Preparing your order</h3>
            <ProgressStepper steps={steps} current={1} labels />
          </div>
        </FloatingSheet.Body>${foot}
      </FloatingSheet>
    </div>
  )
}`;
};

/** A host with enough colour and texture that the glass visibly blurs it; follows the docs appearance. */
function SheetHost({ note, children }: { note: string; children?: ReactNode }) {
  const dark = useAppearance() === 'dark';
  return <ScaledShell width={430} height={560}>
    <div style={{
      position: 'relative', width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', fontFamily: 'var(--bl-font)',
      background: dark ? 'radial-gradient(circle at 30% 20%, #2b2f4a, #0f1017 62%)' : 'radial-gradient(circle at 30% 20%, #fff4e6, #e8ecf3 62%)',
      color: dark ? '#f5f5f7' : '#1c1c1e', boxShadow: 'inset 0 0 0 1px var(--bl-sep)',
    }}>
      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', opacity: 0.6 }}>HOST CONTENT</div>
        <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Anything positioned</h2>
        <p style={{ margin: 0, maxWidth: 330, lineHeight: 1.5, opacity: 0.78, fontSize: 14 }}>{note}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
          {['#0A84FF', '#FF9F0A', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF'].map((c) => (
            <div key={c} style={{ height: 70, borderRadius: 14, background: c, opacity: dark ? 0.75 : 0.6 }} />
          ))}
        </div>
      </div>
      {children}
    </div>
  </ScaledShell>;
}

function SheetReadout() {
  const { open, progress, minimized, peek } = useFloatingSheet();
  const row = (k: string, v: string) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(128,128,128,.18)' }}><span style={{ opacity: 0.7 }}>{k}</span><strong style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</strong></div>;
  return <div style={{ padding: '2px 20px 20px', fontSize: 13.5 }}>
    <div style={{ fontSize: 17, fontWeight: 700, margin: '2px 0 8px' }}>useFloatingSheet()</div>
    {row('open', String(open))}
    {row('progress', Math.round(progress * 100) + '%')}
    {row('peek', peek + 'px')}
    {row('minimized', String(minimized))}
  </div>;
}

function SheetActions() {
  const { open, setOpen, setMinimized } = useFloatingSheet();
  return <div style={{ display: 'flex', gap: 8, padding: '8px 16px 16px' }}>
    <Button className="flex-1" onPress={() => setOpen(!open)}>{open ? 'Close' : 'Open'}</Button>
    <Button className="flex-1" variant="secondary" onPress={() => { setOpen(false); setMinimized(true); }}>Minimize</Button>
  </div>;
}

export const LIVE_CORE: Record<string, LiveSpec> = {
  sidebar: {
    title: 'Sidebar · docked, rail, float, overlay', theme: 'wb', h: 420, bleed: true,
    code: `import {
  Sidebar, SidebarInset, SidebarProvider, SidebarTrigger,
} from '@brett_lamy/ui'

export default function App() {
  return (
    <SidebarProvider defaultOpen breakpoint={560}>
      {/* variant: docked | rail | float | overlay */}
      <Sidebar variant="rail">
        <Sidebar.Header>
          <Sidebar.Workspace name="Creamery Ops" detail="Production" />
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Search />
          <Sidebar.Section title="Workspace">
            <Sidebar.Item icon="home" label="Home" active />
            <Sidebar.Item icon="bolt" label="Agent tasks" badge={4} />
            <Sidebar.Item icon="inbox" label="Inbox" />
          </Sidebar.Section>
        </Sidebar.Content>
      </Sidebar>
      <SidebarInset>
        {/* the hamburger toggles every variant */}
        <SidebarTrigger />
        <main>Main content</main>
      </SidebarInset>
    </SidebarProvider>
  )
}`,
    Render: () => <SidebarDemo />,
  },
  adaptivepane: {
    title: 'AdaptivePane · column, drawer, cover, hidden', theme: 'bl', h: 380,
    variants: ['column', 'drawer', 'cover', 'hidden'].map((m) => ({ id: m, label: m })), variantsWidth: 300,
    code: `import { useState } from 'react'
import { AdaptivePane, Button, useContainerWidth } from '@brett_lamy/ui'

export default function Shell() {
  const [ref, width] = useContainerWidth()
  const [open, setOpen] = useState(false)
  const compact = width < 760
  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', height: 360 }}>
      <AdaptivePane
        mode={compact ? 'drawer' : 'column'} // or 'cover' | 'hidden'
        open={open}
        onClose={() => setOpen(false)}
        columnWidth={240}
        drawerWidth={280}
      >
        <nav style={{ padding: 16 }}>Navigation</nav>
      </AdaptivePane>
      <main style={{ flex: 1, padding: 16 }}>
        {compact && <Button onPress={() => setOpen(true)}>Menu</Button>}
      </main>
    </div>
  )
}`,
    Render: function AdaptivePaneLive({ variant }) {
      const mode = (variant || 'column') as AdaptivePaneMode;
      const [open, setOpen] = useState(true);
      const [drawer, setDrawer] = useState(false);
      useEffect(() => { setOpen(true); }, [mode]);
      return (
        <BLFrame h={340}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <AdaptivePane mode={mode} open={open} onClose={() => setOpen(false)} columnWidth={200} drawerWidth={240} zIndex={20}
              columnStyle={{ borderRight: '1px solid var(--bl-sep)' }}>
              <div style={{ height: '100%', padding: 16, boxSizing: 'border-box', background: 'var(--bl-card)', fontSize: 13.5 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Pane</div>
                <div style={{ color: 'var(--bl-label2)' }}>Same children, mode: {mode}</div>
              </div>
            </AdaptivePane>
            <div style={{ flex: 1, minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--bl-label2)', lineHeight: 1.5 }}>A shell picks the mode from its measured width; the pane never remounts its children within a mode. Switch modes in the header.</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {mode === 'drawer' ? <DemoBtn label="Open pane" onPress={() => setOpen(true)} /> : null}
                <DemoBtn label="Open EdgeDrawer" onPress={() => setDrawer(true)} />
              </div>
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
    variants: [{ id: 'wide', label: 'Split' }, { id: 'compact', label: 'Floating' }], variantsWidth: 220,
    code: "import { ArtifactChatContainer, Composer, ComposerCard, ComposerInput, ComposerFooter,\n  ComposerAttach, ComposerSpacer, ComposerSend } from \"@brett_lamy/ui\"\n\nexport default function ArtifactWorkspace() {\n  return (\n    <ArtifactChatContainer breakpoint={760} working={isWorking}\n      hideOnScroll fabPosition=\"bottom-center\"\n      onAdd={() => setIsWorking(false)}>\n      <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>\n      <ArtifactChatContainer.Composer>\n        {/* Floating: the transcript hangs off a draggable top bump of this Composer. */}\n        <Composer onSubmit={send}>\n          <ComposerCard>\n            <ComposerInput placeholder=\"Do anything\" />\n            <ComposerFooter>\n              <ComposerAttach /><ComposerSpacer /><ComposerSend />\n            </ComposerFooter>\n          </ComposerCard>\n        </Composer>\n      </ArtifactChatContainer.Composer>\n      <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>\n    </ArtifactChatContainer>\n  )\n}",
    Render: function ArtifactChatLive({ variant: mode }) {
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
    title: 'FloatingSheet · appearances', theme: 'bl', h: 650,
    variants: [{ id: 'glass', label: 'Glass' }, { id: 'peeking', label: 'Peeking' }, { id: 'card', label: 'Card' }, { id: 'docked', label: 'Docked' }, { id: 'open', label: 'Open' }],
    variantsWidth: 370,
    code: sheetCode('glass'),
    codeFor: sheetCode,
    Render: function FloatingSheetLive({ variant }) {
      const p = SHEET_PRESETS[variant] ?? SHEET_PRESETS.glass;
      return <SheetHost note={p.note}>
        <FloatingSheet key={variant} appearance={p.appearance} gutter={p.gutter} radius={p.radius} peek={p.peek}
          minimizable={p.minimizable} defaultOpen={p.defaultOpen} label="Order" hideOnScroll={false}>
          <FloatingSheet.Body>
            <div style={{ padding: '2px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 21 }}>Preparing your order</h3>
              <ProgressStepper current={1} labels steps={SHEET_STEPS} />
              {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ height: 64, borderRadius: 14, background: 'rgba(120,120,128,.14)' }} />)}
            </div>
          </FloatingSheet.Body>
          {p.foot ? <FloatingSheet.Foot>
            <div style={{ padding: '8px 16px 16px' }}><Button size="pill">Continue</Button></div>
          </FloatingSheet.Foot> : null}
        </FloatingSheet>
      </SheetHost>;
    },
  },
  sheetdrag: {
    title: 'FloatingSheet · drag, snap, minimize', theme: 'bl', h: 650,
    code: `import { useState } from 'react'
import { Button, FloatingSheet, useFloatingSheet } from '@brett_lamy/ui'

function Readout() {
  const { open, progress, minimized } = useFloatingSheet()
  return (
    <p style={{ padding: '4px 20px' }}>
      {open ? 'Open' : 'Resting'} · {Math.round(progress * 100)}% grown
      {minimized && ' · minimized'}
    </p>
  )
}

function Actions() {
  const { open, setOpen, setMinimized } = useFloatingSheet()
  const minimize = () => {
    setOpen(false)
    setMinimized(true)
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 16px 16px' }}>
      <Button onPress={() => setOpen(!open)}>{open ? 'Close' : 'Open'}</Button>
      <Button variant="secondary" onPress={minimize}>Minimize</Button>
    </div>
  )
}

export default function DragDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
      <FloatingSheet open={open} onOpenChange={setOpen} peek={96} label="Status">
        <FloatingSheet.Body>
          <Readout />
        </FloatingSheet.Body>
        <FloatingSheet.Foot>
          <Actions />
        </FloatingSheet.Foot>
      </FloatingSheet>
    </div>
  )
}`,
    Render: function SheetDragLive() {
      const [open, setOpen] = useState(false);
      const [log, setLog] = useState<string[]>([]);
      return <SheetHost note={'Drag the cap: it tracks the pointer, then snaps open past 35% of the travel. Drag below the resting height to fold into the FAB. Tap the cap to toggle; Escape or the scrim closes. Last events: ' + (log.length ? log.join(', ') : 'none yet')}>
        <FloatingSheet open={open} onOpenChange={(next) => { setOpen(next); setLog((l) => [...l.slice(-2), `onOpenChange(${next})`]); }}
          peek={150} label="Status" hideOnScroll={false}>
          <FloatingSheet.Body><SheetReadout /></FloatingSheet.Body>
          <FloatingSheet.Foot><SheetActions /></FloatingSheet.Foot>
        </FloatingSheet>
      </SheetHost>;
    },
  },
  mapchat: {
    title: 'MapChat · always-floating chat with map tools', theme: 'bl', h: 760, status: 'needs network',
    code: `import { useState } from 'react'
import {
  ArtifactChatContainer, Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer,
  MarkdownView, PLACES, TileMap, USER_POSITION, type MapPin,
} from '@brett_lamy/ui'

const view = { center: USER_POSITION, zoom: 14 }
const pins: MapPin[] = PLACES.slice(0, 6).map((place) => ({
  id: place.id,
  position: place.position,
  label: place.name,
}))

export default function MapChat() {
  const [reply, setReply] = useState('Ask for coffee, pizza, or a walking route.')
  return (
    <div style={{ position: 'relative', height: 720 }}>
      <ArtifactChatContainer layout="floating" peek={120} hideOnScroll={false}>
        <ArtifactChatContainer.Content>
          <TileMap view={view} pins={pins} controls />
        </ArtifactChatContainer.Content>
        <ArtifactChatContainer.Chat>
          <MarkdownView markdown={reply} />
        </ArtifactChatContainer.Chat>
        <ArtifactChatContainer.Composer>
          <Composer onSubmit={(text) => setReply(\`Searching for **\${text}**…\`)}>
            <ComposerCard>
              <ComposerInput placeholder="Ask about the map" />
              <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
            </ComposerCard>
          </Composer>
        </ArtifactChatContainer.Composer>
      </ArtifactChatContainer>
    </div>
  )
}`,
    Render: function MapChatLive() {
      return <ScaledShell width={430} height={720}>
        <MapChatDemo style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
      </ScaledShell>;
    },
  },
  delivery: {
    title: 'DeliveryTracking · map under a docked sheet', theme: 'bl', h: 820, status: 'needs network',
    code: `import {
  FloatingSheet, ProgressStepper, TileMap, esriLightGrayTiles, type MapPin,
} from '@brett_lamy/ui'

const store = { lat: 40.7295, lng: -73.9965 }
const car = { lat: 40.7352, lng: -73.9911 }
const pins: MapPin[] = [
  { id: 'store', position: store, label: 'Store' },
  { id: 'car', position: car, callout: '8 min' },
]
const steps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
]

export default function Delivery() {
  return (
    <div style={{ position: 'relative', height: 780 }}>
      <TileMap
        view={{ center: store, zoom: 15 }}
        pins={pins}
        route={{ points: [car, store] }}
        tileUrl={esriLightGrayTiles}
        scheme="light"
      />
      <FloatingSheet appearance="sheet" tone="light" gutter={0} radius={20}
        peek={344} minimizable={false} scrim={false} label="Order">
        <FloatingSheet.Body>
          <div style={{ padding: '4px 20px' }}>
            <h2>Preparing your order</h2>
            <ProgressStepper steps={steps} current={1} />
          </div>
        </FloatingSheet.Body>
      </FloatingSheet>
    </div>
  )
}`,
    Render: function DeliveryLive() {
      return <ScaledShell width={430} height={780}>
        <DeliveryTrackingDemo style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
      </ScaledShell>;
    },
  },
  chatshell: {
    title: 'ChatShell · responsive composition', theme: 'bl', h: 580,
    variants: [{ id: 'wide', label: 'Wide' }, { id: 'compact', label: 'Compact' }],
    code: `import { ChatShell } from '@brett_lamy/ui'

// Below the breakpoint the rail and channel list move into a hamburger drawer.
export default function Chat() {
  return (
    <div style={{ position: 'relative', height: 520 }}>
      <ChatShell breakpoint={880}>
        <ChatShell.Rail>
          <nav>Workspaces</nav>
        </ChatShell.Rail>
        <ChatShell.Nav>
          <nav>Channels</nav>
        </ChatShell.Nav>
        <ChatShell.Main>
          <main>Conversation</main>
        </ChatShell.Main>
      </ChatShell>
    </div>
  )
}`,
    Render: function ChatShellLive({ variant }) {
      const compact = variant === 'compact';
      const width = compact ? 430 : 1040;
      return <div>
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
    variants: [{ id: 'regular', label: 'Regular' }, { id: 'compact', label: 'Compact' }],
    code: `import { WorkbenchShell } from '@brett_lamy/ui'

// The shell measures itself: compact widths move the sidebar, terminal,
// and surfaces into sheets and a bottom tab bar.
export default function Workbench() {
  return (
    <div style={{ position: 'relative', height: 560 }}>
      <WorkbenchShell terminal>
        <WorkbenchShell.Sidebar><nav>Threads</nav></WorkbenchShell.Sidebar>
        <WorkbenchShell.Main><main>Conversation</main></WorkbenchShell.Main>
        <WorkbenchShell.Dock><div>Terminal</div></WorkbenchShell.Dock>
        <WorkbenchShell.Panel><aside>Surfaces</aside></WorkbenchShell.Panel>
        <WorkbenchShell.TabBar><div>Surface tabs</div></WorkbenchShell.TabBar>
      </WorkbenchShell>
    </div>
  )
}`,
    Render: function WorkbenchShellLive({ variant }) {
      const compact = variant === 'compact';
      const width = compact ? 430 : 1180;
      return <div>
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
    title: 'List · ListSection · ListRow', theme: 'bl', h: 340,
    code: `import { useState } from 'react'
import { Avatar, Haptics, List, ListRow, ListSection, Switch } from '@brett_lamy/ui'

const people = [
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' },
]

export default function Team() {
  const [dnd, setDnd] = useState(true)
  return (
    <List inset>
      <ListSection title="Team" footer="Rows are real buttons — arrow keys work too.">
        {people.map((p) => (
          <ListRow
            key={p.l}
            leading={<Avatar c={p} size={36} />}
            title={\`\${p.f} \${p.l}\`}
            subtitle={p.role}
            accessory="chevron"
            onPress={() => Haptics.impact('light')}
          />
        ))}
        <ListRow
          title="Do Not Disturb"
          divider={false}
          trailing={
            <Switch aria-label="Do Not Disturb" checked={dnd} onChange={setDnd} />
          }
        />
      </ListSection>
    </List>
  )
}`,
    Render: function RowLive() {
      const [dnd, setDnd] = useState(true);
      const people = [{ f: 'Maya', l: 'Lindqvist', role: 'Industrial design' }, { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' }];
      return <div style={{ maxWidth: 430, margin: '0 auto' }}><List inset>
        <ListSection title="Team" footer="Rows are real buttons — arrow keys work too.">
          {people.map((p) => <ListRow key={p.l} leading={<Avatar c={p} size={36} />} title={p.f + ' ' + p.l} subtitle={p.role} accessory="chevron" onPress={() => Haptics.impact('light')} />)}
          <ListRow title="Do Not Disturb" divider={false} trailing={<Switch aria-label="Do Not Disturb" checked={dnd} onChange={setDnd} />} />
        </ListSection>
      </List></div>;
    },
  },
  credenza: {
    title: 'Credenza', theme: 'bl', h: 340,
    code: `import { useState } from 'react'
import { Button, Credenza, Haptics, Icon, ListRow } from '@brett_lamy/ui'

export default function ShareContact() {
  const [view, setView] = useState<'menu' | 'done' | null>(null)
  const done = () => {
    Haptics.notification('success')
    setView('done')
  }
  return (
    <>
      <Button onPress={() => setView('menu')}>Share Contact…</Button>
      <Credenza
        open={view !== null}
        view={view ?? 'menu'}
        title={view === 'done' ? 'Shared' : 'Share Contact'}
        canBack={view === 'done'}
        onBack={() => setView('menu')}
        onClose={() => setView(null)}
      >
        {view === 'done' ? (
          <p style={{ textAlign: 'center', padding: 24 }}>Contact shared</p>
        ) : (
          <>
            <ListRow
              leading={<Icon name="layers" size={20} />}
              title="Show QR code"
              onPress={done}
            />
            <ListRow
              leading={<Icon name="mail" size={20} />}
              title="Copy vCard"
              divider={false}
              onPress={done}
            />
          </>
        )}
      </Credenza>
    </>
  )
}`,
    Render: function CredLive() {
      const [view, setView] = useState<string | null>(null);
      const done = () => { Haptics.notification('success'); setView('done'); };
      return <div style={{ display: 'grid', placeItems: 'center', minHeight: 210 }}>
        <Button onPress={() => { Haptics.impact('light'); setView('menu'); }}>Share Contact…</Button>
        <Credenza open={!!view} view={view || 'menu'} title={view === 'done' ? 'Shared' : 'Share Contact'}
          canBack={view === 'done'} onBack={() => setView('menu')} onClose={() => setView(null)}>
          {view === 'done'
            ? <div style={{ textAlign: 'center', padding: '26px 18px' }}>
                <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(52,199,89,.15)', display: 'inline-grid', placeItems: 'center', color: 'var(--bl-green)' }}><Icon name="check" size={24} sw={2.4} /></span>
                <div style={{ fontWeight: 650, fontSize: 16, marginTop: 10 }}>Contact shared</div>
                <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 3 }}>The card spring-morphs its height to each state.</div>
              </div>
            : <div style={{ padding: '4px 6px 8px' }}>
                <ListRow leading={<Icon name="layers" size={20} />} title="Show QR code" onPress={done} />
                <ListRow leading={<Icon name="mail" size={20} />} title="Copy vCard" divider={false} onPress={done} />
              </div>}
        </Credenza>
      </div>;
    },
  },
  composer: {
    title: 'Composer · compositional parts', theme: 'wb', h: 380,
    variants: [{ id: 'full', label: 'Full' }, { id: 'compact', label: 'Compact' }, { id: 'scroll', label: 'Scroll → FAB' }], variantsWidth: 300,
    code: composerCode('full'), codeFor: composerCode,
    Render: function CompLive({ variant = 'full' }) {
      const [streaming, setStreaming] = useState(false);
      const t = useRef<any>(null);
      const scroller = useRef<HTMLDivElement>(null);
      useEffect(() => () => clearTimeout(t.current), []);
      const efforts = [{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }];
      const access = [{ id: 'full', label: 'Full access' }, { id: 'read', label: 'Read only' }];
      const full = variant === 'full';
      const composer = <Composer key={variant} defaultValue={full ? '## Ship checklist\n\n- Highlight code\n- Publish package' : ''}
        defaultCollapsed={variant === 'compact' ? 'compact' : undefined}
        collapseOnScroll={variant === 'scroll' ? scroller : undefined} collapseTo="fab"
        onSubmit={() => { setStreaming(true); clearTimeout(t.current); t.current = setTimeout(() => setStreaming(false), 1600); }}
        streaming={streaming} onStop={() => { clearTimeout(t.current); setStreaming(false); }}>
        {full ? <ComposerBump side="top" draggable maxReveal={160}>
          <ComposerBumpContent label="Dev server log">
            <div style={{ padding: '10px 14px', fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11.5, lineHeight: 1.6, opacity: 0.8 }}>
              <div>✓ ready in 412 ms</div><div>✓ 287 stories indexed</div><div>→ composer.tsx changed, HMR update</div>
            </div>
          </ComposerBumpContent>
          <ComposerBumpHandle>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--wb-green)' }} />
            <ComposerText className="flex-1">Monitoring · pnpm dev</ComposerText>
          </ComposerBumpHandle>
        </ComposerBump> : null}
        <ComposerCard size="lg">
          {full ? <ComposerExpand /> : null}
          <ComposerAttachments />
          <ComposerInput placeholder="Ask anything, paste an image" />
          <ComposerFooter>
            <ComposerOptions>
              <ModelPicker models={WORKBENCH_MODELS} providers={WORKBENCH_PROVIDERS} defaultValue="claude-opus-5-5" />
              <ComposerSeparator />
              <ComposerSelect aria-label="Effort" options={efforts} defaultValue="medium" />
              <ComposerSeparator />
              <ComposerSelect aria-label="Access" icon="lock" options={access} />
            </ComposerOptions>
            <ComposerSpacer />
            <ComposerAttach />
            <ComposerStop variant="solid" />
            <ComposerSend morph={false} />
          </ComposerFooter>
        </ComposerCard>
        <ComposerBump side="bottom">
          <ComposerBumpHandle>
            <ComposerText icon="folder" className="shrink-0">Local checkout</ComposerText>
            <ComposerOptionsOutlet />
            <ComposerSpacer />
            <ComposerText icon="branch">main</ComposerText>
          </ComposerBumpHandle>
        </ComposerBump>
      </Composer>;
      if (variant !== 'scroll') return <div style={{ maxWidth: variant === 'compact' ? 720 : 580, margin: '0 auto', paddingTop: full ? 24 : 120 }}>{composer}</div>;
      return <div style={{ position: 'relative', height: 380, margin: '-16px' }}>
        <div ref={scroller} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '20px 20px 180px' }}>
          <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Thread · Fix the header overlap</div>
            {Array.from({ length: 14 }, (_, i) => <div key={i} style={{ padding: 14, borderRadius: 12, border: '1px solid var(--wb-sep)', background: 'var(--wb-card)', fontSize: 13, lineHeight: 1.55, color: 'var(--wb-label2)' }}>
              {i % 2 ? 'The sticky header sits at z-index 20 while the drawer uses 30, so the drawer wins on narrow widths.' : 'Scroll down: the composer folds to one row, then to a button. Scroll back up and it returns.'}
            </div>)}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 14 }}><div style={{ maxWidth: 620, margin: '0 auto' }}>{composer}</div></div>
      </div>;
    },
  },
  controls: {
    title: 'Segmented · Switch · Spinner · Avatar', theme: 'bl', h: 300,
    code: `import { useState } from 'react'
import { Avatar, Segmented, Spinner, Switch } from '@brett_lamy/ui'

const ranges = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

export default function Controls() {
  const [range, setRange] = useState('day')
  const [on, setOn] = useState(true)
  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
      <Segmented aria-label="Range" options={ranges} value={range}
        onChange={setRange} />
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={40} />
        <Switch aria-label="Notifications" checked={on} onChange={setOn} />
        <Spinner />
      </div>
    </div>
  )
}`,
    Render: function CtlLive() {
      const [range, setRange] = useState('day');
      const [on, setOn] = useState(true);
      return <div style={{ display: 'grid', gap: 16, justifyItems: 'center', maxWidth: 420, margin: '0 auto' }}>
        <div style={{ width: 280 }}><Segmented aria-label="Range" value={range} onChange={setRange} options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} /></div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={40} />
          <Switch aria-label="Demo switch" checked={on} onChange={setOn} />
          <Spinner />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--bl-label2)' }}>@brett_lamy/ui is live — every control ticks.</div>
      </div>;
    },
  },
  theming: {
    title: 'Theme tokens', theme: 'bl', h: 330,
    code: `import { useState } from 'react'
import { BLProvider, Icon, List, ListRow, ListSection, Switch } from '@brett_lamy/ui'

const tints = ['#0A84FF', '#5E5CE6', '#34C759', '#FF9F0A', '#FF375F']

// BLProvider sets the --bl-* tokens every component below it reads.
export default function Appearance() {
  const [dark, setDark] = useState(false)
  const [tint, setTint] = useState(tints[0])
  return (
    <BLProvider dark={dark} tint={tint} style={{ height: 260 }}>
      <List inset>
        <ListSection title="Appearance">
          <ListRow
            leading={<Icon name="bell" size={20} />}
            title="Dark Mode"
            trailing={
              <Switch aria-label="Dark Mode" checked={dark} onChange={setDark} />
            }
          />
        </ListSection>
        <ListSection title="Tint">
          {tints.map((t, i) => (
            <ListRow
              key={t}
              title={t}
              accessory={t === tint ? 'check' : undefined}
              divider={i < tints.length - 1}
              onPress={() => setTint(t)}
            />
          ))}
        </ListSection>
      </List>
    </BLProvider>
  )
}`,
    Render: function ThemeLive() {
      const [dark, setDark] = useState(useAppearance() === 'dark');
      const [tint, setTint] = useState('#0A84FF');
      return <div style={{ maxWidth: 430, height: 250, margin: '0 auto', borderRadius: 14, overflow: 'hidden', boxShadow: '0 0 0 1px var(--bl-sep)' }}>
        <BLProvider dark={dark} tint={tint}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 9, marginBottom: 12, justifyContent: 'center' }}>
              {['#0A84FF', '#5E5CE6', '#34C759', '#FF9F0A', '#FF375F'].map((c) => <button key={c} onClick={() => { setTint(c); Haptics.selection(); }} aria-label={'Tint ' + c}
                style={{ width: 23, height: 23, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0, border: '1px solid rgba(0,0,0,.1)', outline: tint === c ? '2.5px solid ' + c : 'none', outlineOffset: 2 }} />)}
            </div>
            <List inset>
              <ListSection title="Appearance">
                <ListRow leading={<Icon name="bell" size={20} />} title="Dark Mode" divider={false} trailing={<Switch aria-label="Dark Mode" checked={dark} onChange={setDark} />} />
              </ListSection>
            </List>
            <DemoBtn label="Tinted action" onPress={() => Haptics.impact('light')} style={{ display: 'block', margin: '12px auto 0' }} />
          </div>
        </BLProvider>
      </div>;
    },
  },
  nav: {
    title: 'NavigationStack', theme: 'bl', h: 420,
    code: `import { useState } from 'react'
import {
  Icon, List, ListRow, ListSection, NavigationStack, type Screen,
} from '@brett_lamy/ui'

const teams = ['Design', 'Engineering', 'Research']

export default function Teams() {
  const [team, setTeam] = useState<string | null>(null)
  const screens: Screen[] = [{
    key: 'root',
    title: 'Teams',
    grouped: true,
    content: (
      <List inset>
        <ListSection>
          {teams.map((t, i) => (
            <ListRow
              key={t}
              leading={<Icon name="person" size={20} />}
              title={t}
              accessory="chevron"
              divider={i < teams.length - 1}
              onPress={() => setTeam(t)}
            />
          ))}
        </ListSection>
      </List>
    ),
  }]
  // Push by adding a screen; the back chevron or an edge swipe calls onPop.
  if (team) screens.push({
    key: 'detail',
    title: team,
    grouped: true,
    content: <p style={{ padding: 24 }}>Pushed screen</p>,
  })
  return (
    <div style={{ position: 'relative', height: 330 }}>
      <NavigationStack screens={screens} onPop={() => setTeam(null)} />
    </div>
  )
}`,
    Render: function NavLive() {
      const [sel, setSel] = useState<string | null>(null);
      const screens: Screen[] = [{ key: 'root', title: 'Teams', grouped: true, content:
        <List inset><ListSection>
          {['Design', 'Engineering', 'Research'].map((t, i) => <ListRow key={t} leading={<Icon name="person" size={20} />} title={t}
            accessory="chevron" divider={i < 2} onPress={() => { Haptics.impact('light'); setSel(t); }} />)}
        </ListSection></List> }];
      if (sel) screens.push({ key: 'detail', title: sel, grouped: true, content:
        <div style={{ padding: '28px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 650 }}>{sel}</div>
          <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 5, lineHeight: 1.5 }}>Pushed screen — use the back chevron, or drag from the left edge to pop interactively.</div>
        </div> });
      return <BLFrame h={330}><NavigationStack screens={screens} onPop={() => setSel(null)} /></BLFrame>;
    },
  },
  tabs: {
    title: 'TabView · horizontal, vertical, Discord rail', theme: 'bl', h: 420,
    variants: [{ id: 'horizontal', label: 'Horizontal' }, { id: 'vertical', label: 'Vertical' }, { id: 'discord', label: 'Discord rail' }], variantsWidth: 300,
    code: "import {\n  TabView, TabViewBar, TabViewList, TabViewTab, TabViewIndicator,\n  TabViewSeparator, TabViewAction, TabViewPanels, TabViewPanel,\n} from \"@brett_lamy/ui\"\n\n// orientation=\"horizontal\": an iOS bar at the bottom. \"vertical\": a left rail.\nexport function Sections({ orientation = \"horizontal\" }) {\n  return (\n    <TabView orientation={orientation} defaultSelectedKey=\"contacts\">\n      <TabViewBar>\n        <TabViewList aria-label=\"Sections\">\n          <TabViewTab id=\"contacts\" icon=\"person\" title=\"Contacts\" />\n          <TabViewTab id=\"recents\" icon=\"clock\" title=\"Recents\" />\n          <TabViewTab id=\"settings\" icon=\"sliders\" title=\"Settings\" />\n        </TabViewList>\n      </TabViewBar>\n      <TabViewPanels>\n        <TabViewPanel id=\"contacts\"><ContactList /></TabViewPanel>\n        <TabViewPanel id=\"recents\"><Recents /></TabViewPanel>\n        <TabViewPanel id=\"settings\"><Settings /></TabViewPanel>\n      </TabViewPanels>\n    </TabView>\n  )\n}\n\n// A Discord server rail: the same parts, a plain bar, custom tiles.\nexport function ServerRail({ servers, selected, onSelect, onAdd }) {\n  return (\n    <TabView orientation=\"vertical\" selectedKey={selected} onSelectionChange={onSelect}>\n      <TabViewBar variant=\"plain\" className=\"w-[52px] items-center gap-2 py-2.5\">\n        <TabViewList aria-label=\"Servers\" className=\"w-full items-center gap-2\">\n          <TabViewTab id=\"home\" textValue=\"Direct Messages\" className=\"group flex w-full justify-center\">\n            <TabViewIndicator variant=\"pill\" />\n            <Tile icon=\"message\" />\n          </TabViewTab>\n          <TabViewSeparator className=\"h-0.5 w-5 rounded-full\" />\n          {servers.map((s) => (\n            <TabViewTab key={s.id} id={s.id} textValue={s.name} className=\"group flex w-full justify-center\">\n              <TabViewIndicator variant=\"pill\" attention={s.unread} />\n              <Tile label={s.label} color={s.color} mentions={s.mentions} />\n            </TabViewTab>\n          ))}\n        </TabViewList>\n        <TabViewAction aria-label=\"Add a server\" onPress={onAdd}><Tile icon=\"plus\" /></TabViewAction>\n      </TabViewBar>\n    </TabView>\n  )\n}",
    Render: function TabsLive({ variant }) {
      const mode = variant as 'horizontal' | 'vertical' | 'discord';
      const [tab, setTab] = useState('contacts');
      const [server, setServer] = useState('blui');
      const items = [{ id: 'contacts', icon: 'person', title: 'Contacts' }, { id: 'recents', icon: 'clock', title: 'Recents' }, { id: 'settings', icon: 'sliders', title: 'Settings' }];
      const blurb: Record<string, string> = { contacts: 'Each tab keeps its own stack — pushes slide under this bar.', recents: 'Tab state survives switching away and back.', settings: 'Every selection fires Haptics.selection().' };
      const servers = [
        { id: 'blui', label: 'T', color: '#0A84FF', title: 'BL UI HQ' },
        { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
        { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs', mentions: 4 },
        { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', unread: true, mentions: 12 },
      ];
      const panel = (id: string) => {
        const cur = items.find((i) => i.id === id)!;
        return <div style={{ position: 'absolute', inset: mode === 'horizontal' ? '0 0 62px' : 0, display: 'grid', placeItems: 'center', padding: '0 28px', textAlign: 'center' }}>
          <div>
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 46, height: 46, borderRadius: 13, background: 'var(--bl-fill)', color: 'var(--bl-tint)' }}><Icon name={cur.icon as any} size={25} /></span>
            <div style={{ fontSize: 16.5, fontWeight: 650, marginTop: 10 }}>{cur.title}</div>
            <div style={{ fontSize: 13, color: 'var(--bl-label2)', marginTop: 4, lineHeight: 1.5 }}>{blurb[id]}</div>
          </div>
        </div>;
      };
      const serverName = server === 'home' ? 'Direct Messages' : servers.find((s) => s.id === server)?.title;
      return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BLFrame h={330} bg="var(--bl-bg)">
          {mode === 'discord'
            ? <div style={{ position: 'absolute', inset: 0, display: 'flex', background: '#131318', color: '#EDEDF2' }}>
                <WorkspaceRail home={{ title: 'Direct Messages', mentions: 2 }} workspaces={servers} selectedKey={server} onSelect={setServer} />
                <div style={{ padding: '22px 24px', fontSize: 13, lineHeight: 1.5, color: 'rgba(235,235,245,.6)' }}>
                  <div style={{ fontSize: 16.5, fontWeight: 650, color: '#EDEDF2', marginBottom: 4 }}>{serverName}</div>
                  ChatKit's WorkspaceRail is a vertical TabView: tiles are tabs (Up/Down arrows), the pill marks unread / hover / selected, and Add is an action, not a tab.
                </div>
              </div>
            : <TabView key={mode} orientation={mode} selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} style={{ position: 'absolute', inset: 0 }}>
                <TabViewBar>
                  <TabViewList aria-label="Sections">
                    {items.map((it) => <TabViewTab key={it.id} id={it.id} icon={it.icon} title={it.title} />)}
                  </TabViewList>
                </TabViewBar>
                <TabViewPanels>
                  {items.map((it) => <TabViewPanel key={it.id} id={it.id}>{panel(it.id)}</TabViewPanel>)}
                </TabViewPanels>
              </TabView>}
        </BLFrame>
      </div>;
    },
  },
  split: {
    title: 'SplitView', theme: 'bl', h: 470,
    variants: [{ id: 'regular', label: 'Regular' }, { id: 'medium', label: 'Medium' }, { id: 'compact', label: 'Compact' }],
    variantsWidth: 280,
    code: `import { useState } from 'react'
import {
  List, ListRow, ListSection, SplitView, useContainerWidth,
} from '@brett_lamy/ui'

const column = (title: string, rows: string[]) => (
  <List>
    <ListSection title={title}>
      {rows.map((r, i) => <ListRow key={r} title={r} divider={i < rows.length - 1} />)}
    </ListSection>
  </List>
)

export default function Notes() {
  const [ref, width] = useContainerWidth()
  // Below 'regular' the sidebar becomes a drawer: open it with setDrawer(true).
  const [drawer, setDrawer] = useState(false)
  const wc = width >= 900 ? 'regular' : width >= 600 ? 'medium' : 'compact'
  return (
    <div ref={ref} style={{ position: 'relative', height: 330 }}>
      <SplitView
        wc={wc}
        sidebar={column('Folders', ['All Notes', 'Shared', 'Archive'])}
        master={column('Notes', ['Springs', 'IndexBar ticks', 'Credenza morph'])}
        detail={<p style={{ padding: 22 }}>Detail</p>}
        drawerOpen={drawer}
        onCloseDrawer={() => setDrawer(false)}
      />
    </div>
  )
}`,
    Render: function SplitLive({ variant }) {
      const wc = variant || 'regular';
      const [drawer, setDrawer] = useState(false);
      useEffect(() => { setDrawer(false); }, [wc]);
      const mini = (name: string, rows: string[]) => <div style={{ height: '100%', overflowY: 'auto' }}><List>
        <ListSection title={name}>{rows.map((t, i) => <ListRow key={t} title={t} divider={i < rows.length - 1} />)}</ListSection>
      </List></div>;
      return <div>
        {wc !== 'regular' ? <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <DemoBtn label="Show sidebar" onPress={() => setDrawer(true)} style={{ padding: '6px 12px', fontSize: 12.5 }} />
        </div> : null}
        {/* Laid out at a width that really is regular/medium/compact, scaled to fit. */}
        <ScaledShell width={wc === 'regular' ? 900 : wc === 'medium' ? 700 : 390} height={wc === 'regular' ? 420 : 380}>
        <BLFrame h={wc === 'regular' ? 420 : 380} bg="var(--bl-bg)">
          <SplitView wc={wc} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}
            sidebar={<div style={{ height: '100%', background: 'var(--bl-side)', overflowY: 'auto' }}>{mini('Folders', ['All Notes', 'Shared', 'Archive'])}</div>}
            master={mini('Notes', ['Springs — stiffness 620', 'IndexBar scrub ticks', 'Credenza height morph'])}
            detail={<div style={{ height: '100%', display: 'grid', placeItems: 'center', background: 'var(--bl-bg2)', textAlign: 'center', padding: 22 }}>
              <div><div style={{ fontWeight: 650 }}>Detail</div>
              <div style={{ fontSize: 12.5, color: 'var(--bl-label2)', marginTop: 5, lineHeight: 1.5 }}>regular: 3 columns · medium: sidebar becomes a drawer · compact: collapses into the stack</div></div>
            </div>} />
        </BLFrame>
        </ScaledShell>
      </div>;
    },
  },
  indexbar: {
    title: 'IndexBar', theme: 'bl', h: 470,
    variants: [{ id: 'stops', label: 'Custom stops' }, { id: 'az', label: 'A–Z' }, { id: 'wave', label: 'Wave' }],
    variantsWidth: 290,
    code: indexBarCode('stops'),
    codeFor: indexBarCode,
    Render: function IdxLive({ variant }) {
      const mode = variant || 'stops';
      const sc = useRef<HTMLDivElement | null>(null);
      const els = useRef<Record<string, HTMLElement>>({});
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
        <BLFrame h={340} bg="var(--bl-bg)">
          <div ref={sc} style={mode === 'wave'
            ? { position: 'absolute', inset: 0, overflowY: 'auto', paddingLeft: 40 }
            : { position: 'absolute', inset: 0, overflowY: 'auto', paddingRight: 26 }}>
            {mode === 'az'
              ? <List>
                  {letters.map((L) => <div key={L} ref={(el) => { if (el) els.current[L] = el; }}>
                    <ListSection title={L} sticky>{data[L].map((n, i) => <ListRow key={n} title={n} divider={i < data[L].length - 1} />)}</ListSection>
                  </div>)}
                </List>
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
    title: 'SideDrawer', theme: 'bl', h: 420,
    variants: [{ id: 'overlay', label: 'Overlay' }, { id: 'fixed', label: 'Fixed' }],
    code: sideDrawerCode('overlay'),
    codeFor: sideDrawerCode,
    Render: function DrawerLive({ variant }) {
      const mode = (variant || 'overlay') as 'overlay' | 'fixed';
      const [open, setOpen] = useState(mode === 'fixed');
      useEffect(() => { setOpen(mode === 'fixed'); }, [mode]);
      const rows = ['Outgoing call · 2 min', 'iMessage · yesterday', 'FaceTime · Mon', 'Mail · Re: schedule'];
      return <BLFrame h={330} bg="var(--bl-bg)">
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
      </BLFrame>;
    },
  },
  scroller: {
    title: 'MessageScroller', theme: 'wb', h: 440,
    code: `import { useState, type ReactNode } from 'react'
import { Button, MessageScroller } from '@brett_lamy/ui'

type Msg = { id: string; role: 'user' | 'assistant'; text: ReactNode }

export default function Thread() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 'u1', role: 'user', text: 'How does anchoring work?' },
  ])
  const send = () => {
    const n = msgs.length + 1
    setMsgs((m) => [
      ...m,
      { id: \`u\${n}\`, role: 'user', text: \`Turn \${n}\` },
      { id: \`a\${n}\`, role: 'assistant', text: 'Replies grow below the anchor.' },
    ])
  }
  const items = msgs.map((m) => ({
    id: m.id,
    anchor: m.role === 'user', // a user message starts a turn
    node: <p style={{ textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.text}</p>,
  }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 340 }}>
      <MessageScroller items={items} threadKey="demo" />
      <Button onPress={send}>Send a turn</Button>
    </div>
  )
}`,
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
    code: `import { TermBody, TermHeader } from '@brett_lamy/ui'

// Desktop: <TerminalDock h={h} setH={setH} />. Phones: wrap TermBody in a SnapSheet.
export default function Terminal() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 300 }}>
      <TermHeader title="zsh" />
      <TermBody seed={[{ t: 'help', p: true }]} autoFocus />
    </div>
  )
}`,
    Render: function TermLive() {
      return <div style={{ display: 'flex', flexDirection: 'column', height: 300, borderRadius: 12, overflow: 'hidden', background: '#0C0C10', border: '1px solid var(--wb-sep)' }}>
        <TermHeader onClose={() => undefined} />
        <TermBody seed={[{ t: 'help', p: true }, { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' }]} />
      </div>;
    },
  },
  surfaces: {
    title: 'SurfacePanel', theme: 'wb', h: 480,
    code: `import { useState } from 'react'
import { SurfacePanel, type SurfaceKind } from '@brett_lamy/ui'

export default function Surfaces() {
  // null shows the surface picker
  const [kind, setKind] = useState<SurfaceKind | null>(null)
  return (
    <div style={{ height: 380 }}>
      <SurfacePanel
        kind={kind}
        compact
        onOpen={setKind}
        onClose={() => setKind(null)}
      />
    </div>
  )
}`,
    Render: function SurfLive() {
      const [kind, setKind] = useState<SurfaceKind | null>(null);
      return <div style={{ height: 380, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)' }}>
        <SurfacePanel kind={kind} compact onOpen={(k) => setKind(k)} onClose={() => setKind(null)} full={false} onFull={() => undefined} />
      </div>;
    },
  },
  filetree: {
    title: 'File tree · @pierre/trees', theme: 'wb', h: 430,
    code: `import { SurfaceFiles } from '@brett_lamy/ui'

// The Workbench Files surface: a @pierre/trees FileTree with BL UI tokens.
export default function Files() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 330 }}>
      <SurfaceFiles />
    </div>
  )
}`,
    Render: () => <div style={{ height: 330, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)' }}><SurfaceFiles /></div>,
  },
  diff: {
    title: 'Code diff · @pierre/diffs', theme: 'wb', h: 430,
    code: `import { SurfaceDiff } from '@brett_lamy/ui'

// The Workbench Diff surface: @pierre/diffs, themed to the current appearance.
export default function Change() {
  return (
    <div style={{ height: 330, overflow: 'auto' }}>
      <SurfaceDiff />
    </div>
  )
}`,
    Render: () => <div style={{ height: 330, borderRadius: 12, overflow: 'auto', border: '1px solid var(--wb-sep)' }}><SurfaceDiff /></div>,
  },
  stream: {
    title: 'MarkdownView · Docstream renderer', theme: 'bl', h: 480,
    code: `import { useEffect, useState } from 'react'
import { MarkdownView } from '@brett_lamy/ui'

const answer = '## Servers\\n\\nThe **API** runs on \`:3000\`, the docs on \`:4206\`.'

export default function StreamedAnswer() {
  const [text, setText] = useState('')
  useEffect(() => {
    const words = answer.split(' ')
    let i = 0
    const timer = setInterval(() => {
      i += 4
      setText(words.slice(0, i).join(' '))
      if (i >= words.length) clearInterval(timer)
    }, 95)
    return () => clearInterval(timer)
  }, [])
  return <MarkdownView markdown={text} streaming={text !== answer} />
}`,
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

function indexBarCode(variant: string) {
  const rail = variant === 'az'
    ? `      {/* No items: the UIKit A–Z rail */}
      <IndexBar avail={new Set(['A', 'B', 'C'])} onLetter={jump} top={8} bottom={8} />`
    : variant === 'wave'
    ? `      {/* Dashes that swell under the pointer, with a title + preview card */}
      <IndexBar variant="wave" side="left" items={stops} onJump={jump} />`
    : `      {/* No label on a stop: it renders as a dot; preview fills the bubble */}
      <IndexBar items={stops} onJump={jump} label="Jump to a turn" top={10} bottom={10} />`;
  return `import { useRef } from 'react'
import { IndexBar } from '@brett_lamy/ui'

const turns = [
  { id: 'q1', role: 'user', text: 'Why is the build slow?' },
  { id: 'a1', role: 'assistant', text: 'The registry re-transpiles on every nav.' },
  { id: 'q2', role: 'user', text: 'Can we cache it per page?' },
  { id: 'a2', role: 'assistant', text: 'Yes: key the cache by page id.' },
]
const stops = turns
  .filter((t) => t.role === 'user')
  .map((t) => ({ key: t.id, preview: t.text, caption: 'You' }))

export default function Transcript() {
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useRef<Record<string, HTMLElement | null>>({})
  const jump = (key: string) => {
    const row = rows.current[key]
    if (row && scroller.current) scroller.current.scrollTop = row.offsetTop - 8
  }
  return (
    <div style={{ position: 'relative', height: 340 }}>
      <div ref={scroller} style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
        {turns.map((t) => (
          <p key={t.id} ref={(el) => { rows.current[t.id] = el }}>{t.text}</p>
        ))}
      </div>
${rail}
    </div>
  )
}`;
}

function sideDrawerCode(variant: string) {
  const fixed = variant === 'fixed';
  return `import { useState } from 'react'
import { Button, SideDrawer } from '@brett_lamy/ui'

export default function Detail() {
  const [open, setOpen] = useState(${fixed ? 'true' : 'false'})
  return (
    <div style={{ position: 'relative', display: 'flex', height: 330 }}>
      <main style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <Button onPress={() => setOpen(true)}>Show Activity</Button>
      </main>
      {/* ${fixed ? '"fixed" docks it as a layout column' : '"overlay" slides it over the detail with a scrim'} */}
      <SideDrawer
        mode="${variant === 'fixed' ? 'fixed' : 'overlay'}"
        open={open}
        onClose={() => setOpen(false)}
        title="Activity"
        width={230}
      >
        <p style={{ padding: 16 }}>Outgoing call · 2 min</p>
      </SideDrawer>
    </div>
  )
}`;
}
