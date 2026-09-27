/* WorkbenchShell page examples (Workbench --wb-* tokens). Each `// #region` is shown verbatim as the example's
   code; the frames around them (scaling, fixed heights) are docs chrome. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AssistantMessage,
  Conversation,
  ConversationComposer,
  ConversationEmpty,
  ConversationGreeting,
  ConversationMessages,
  ConversationSuggestions,
  MessageMarkdown,
  SnapSheet,
  Suggestion,
  SurfaceAgents,
  SurfaceDiff,
  SurfaceFiles,
  SurfacePicker,
  SurfaceTerminal,
  SurfaceBrowser,
  SurfaceAppPreview,
  SURFACES,
  TerminalAction,
  TerminalBody,
  TerminalHeader,
  ThreadGroup,
  ThreadItem,
  ThreadList,
  ThreadSidebar,
  ThreadSidebarBrand,
  ThreadSidebarFooter,
  ThreadSidebarHeader,
  SidebarUser,
  ToolCall,
  UserMessage,
  WorkbenchAction,
  WorkbenchActions,
  WorkbenchComposer,
  WorkbenchDock,
  WorkbenchDockClose,
  WorkbenchDockTrigger,
  WorkbenchHeader,
  WorkbenchMain,
  WorkbenchPanel,
  WorkbenchPanelClose,
  WorkbenchPanelFullscreen,
  WorkbenchPanelHeader,
  WorkbenchPanelTitle,
  WorkbenchPanelTrigger,
  WorkbenchShell,
  WorkbenchSidebar,
  WorkbenchSidebarClose,
  WorkbenchSidebarTrigger,
  WorkbenchTheme,
  WorkbenchTitle,
  WorkLog,
  stripAttachmentRefs,
  useAppearance,
  type SurfaceKind,
} from '@brett_lamy/ui'
import T3Clone from '@brett_lamy/registry/blocks/t3-clone/page'
import t3Source from '@brett_lamy/registry/blocks/t3-clone/page.tsx?raw'
import raw from './workbench-shell.tsx?raw'
import { examples } from './chrome'
import type { LiveSpec } from '../frame'

/* Docs chrome: lays a composition out at its design width, scaled down (never up) to fit the column. */
function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const host = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const resize = () => setScale(Math.min(1, el.clientWidth / width))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={host} style={{ width: '100%', maxWidth: width, margin: '0 auto', height: height * scale, position: 'relative', overflow: 'hidden', borderRadius: 12, boxShadow: '0 0 0 1px var(--wb-sep)' }}>
      <div style={{ position: 'absolute', width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}
/* Docs chrome: a fixed-size window. */
function Frame({ width, height, children }: { width?: number; height: number; children: ReactNode }) {
  return <div style={{ width: '100%', maxWidth: width, height, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px var(--wb-sep)' }}>{children}</div>
}

// #region workbench_chat
const RECENT = ['Onboarding checklist', 'Rename the billing events', 'Why is CI slow?']

export function ChatOnly() {
  const [current, setCurrent] = useState(RECENT[0])
  const [messages, setMessages] = useState([
    { id: 'u1', role: 'user', text: 'Draft an onboarding checklist for new engineers.' },
    { id: 'a1', role: 'assistant', text: '1. **Day one** — laptop, accounts, and a first PR\n2. **Week one** — pair on a small feature\n3. **Month one** — own an on-call shift' },
  ])
  const send = (text: string) =>
    setMessages((m) => [
      ...m,
      { id: 'u' + m.length, role: 'user', text },
      { id: 'a' + m.length, role: 'assistant', text: 'Noted — I’ll fold that into the checklist.' },
    ])
  return (
    <WorkbenchShell>
      <WorkbenchSidebar width={220}>
        <ThreadSidebar>
          <ThreadSidebarHeader>
            <ThreadSidebarBrand>Assistant</ThreadSidebarBrand>
            <WorkbenchSidebarClose />
          </ThreadSidebarHeader>
          <ThreadList>
            <ThreadGroup label="Recent">
              {RECENT.map((t) => (
                <ThreadItem key={t} active={t === current} onPress={() => setCurrent(t)}>
                  {t}
                </ThreadItem>
              ))}
            </ThreadGroup>
          </ThreadList>
          <ThreadSidebarFooter>
            <SidebarUser name="Ada Lovelace" detail="Pro plan" />
          </ThreadSidebarFooter>
        </ThreadSidebar>
      </WorkbenchSidebar>
      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchSidebarTrigger />
          <WorkbenchTitle>{current}</WorkbenchTitle>
        </WorkbenchHeader>
        <Conversation>
          <ConversationMessages threadKey={current}>
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id}>{m.text}</UserMessage>
              ) : (
                <AssistantMessage key={m.id}>
                  <MessageMarkdown markdown={m.text} />
                </AssistantMessage>
              ),
            )}
          </ConversationMessages>
          <ConversationComposer>
            <WorkbenchComposer options={false} checkout={false} onSubmit={(md) => send(stripAttachmentRefs(md))} />
          </ConversationComposer>
        </Conversation>
      </WorkbenchMain>
    </WorkbenchShell>
  )
}
// #endregion

// #region workbench_inspector
const BEFORE = `export function total(items) {
  return items.reduce((sum, i) => sum + i.price, 0)
}`
const AFTER = `export function total(items: Item[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}`

export function ChatWithDiff() {
  return (
    <WorkbenchShell defaultPanelOpen>
      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchTitle project="shop">fix cart totals</WorkbenchTitle>
          <WorkbenchActions>
            <WorkbenchPanelTrigger />
          </WorkbenchActions>
        </WorkbenchHeader>
        <Conversation>
          <ConversationMessages threadKey="cart">
            <UserMessage key="u1">Totals ignore quantity — can you fix it?</UserMessage>
            <AssistantMessage key="a1">
              <WorkLog summary="Worked for 18s" defaultOpen>
                <ToolCall title="Read src/cart.ts" />
                <ToolCall title="Ran the cart tests" detail="12 passed" code="pnpm test cart" />
              </WorkLog>
              <MessageMarkdown markdown="`total()` now multiplies by `qty`, and the items are typed. The change is in the inspector →" />
            </AssistantMessage>
          </ConversationMessages>
          <ConversationComposer>
            <WorkbenchComposer checkout={false} onSubmit={() => {}} />
          </ConversationComposer>
        </Conversation>
      </WorkbenchMain>
      <WorkbenchPanel>
        <WorkbenchPanelHeader>
          <WorkbenchPanelTitle icon="diff">Changes</WorkbenchPanelTitle>
          <WorkbenchPanelFullscreen />
          <WorkbenchPanelClose />
        </WorkbenchPanelHeader>
        <SurfaceDiff oldFile={{ name: 'src/cart.ts', contents: BEFORE }} newFile={{ name: 'src/cart.ts', contents: AFTER }} />
      </WorkbenchPanel>
    </WorkbenchShell>
  )
}
// #endregion

// #region workbench_phone
const BUILD_LOG = [
  { t: 'pnpm build', p: true },
  { t: 'vite v8.2.1 building for production…' },
  { t: '✓ 214 modules transformed.', c: '#7EE0B8' },
  { t: 'dist/index.js  182.4 kB │ gzip: 58.1 kB' },
]

export function PhoneWorkbench() {
  return (
    <WorkbenchShell defaultDockOpen>
      <WorkbenchSidebar>
        <ThreadSidebar>
          <ThreadSidebarHeader>
            <ThreadSidebarBrand>Workbench</ThreadSidebarBrand>
            <WorkbenchSidebarClose />
          </ThreadSidebarHeader>
          <ThreadList>
            <ThreadGroup label="Active">
              <ThreadItem active status="running" meta="now">
                ship the build
              </ThreadItem>
              <ThreadItem status="unread" meta="4m">
                triage flaky tests
              </ThreadItem>
            </ThreadGroup>
          </ThreadList>
        </ThreadSidebar>
      </WorkbenchSidebar>
      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchSidebarTrigger />
          <WorkbenchTitle>ship the build</WorkbenchTitle>
          <WorkbenchActions>
            <WorkbenchDockTrigger />
          </WorkbenchActions>
        </WorkbenchHeader>
        <Conversation>
          <ConversationMessages threadKey="build" streaming>
            <UserMessage key="u1">Build it and tell me the bundle size.</UserMessage>
            <AssistantMessage key="a1">
              <MessageMarkdown markdown="Building now — the log is in the terminal sheet. Drag it down to dismiss, or up for more." />
            </AssistantMessage>
          </ConversationMessages>
          <ConversationComposer>
            <WorkbenchComposer options={false} checkout={false} onSubmit={() => {}} />
          </ConversationComposer>
        </Conversation>
        {/* compact width: the dock is a SnapSheet over the whole shell */}
        <WorkbenchDock>
          <TerminalHeader title="zsh — web">
            <WorkbenchDockClose />
          </TerminalHeader>
          <TerminalBody seed={BUILD_LOG} cwd="web" />
        </WorkbenchDock>
      </WorkbenchMain>
    </WorkbenchShell>
  )
}
// #endregion

// #region workbench_console
const RUNS = [
  { name: 'migrate-db', status: 'passed', detail: '3 migrations · 12s' },
  { name: 'deploy-api', status: 'running', detail: 'rolling 2/4 pods · 48s' },
  { name: 'smoke-tests', status: 'queued', detail: 'waiting on deploy-api' },
]

export function AgentConsole() {
  return (
    <WorkbenchShell defaultDockOpen defaultPanelOpen>
      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchTitle icon="bot" project="ops">
            release 2.14
          </WorkbenchTitle>
          <WorkbenchActions>
            <WorkbenchAction icon="stop" label="Stop run" />
            <WorkbenchDockTrigger />
            <WorkbenchPanelTrigger />
          </WorkbenchActions>
        </WorkbenchHeader>
        <Conversation>
          <ConversationMessages threadKey="release" streaming>
            <AssistantMessage key="plan">
              <WorkLog summary="Running for 1m 2s" defaultOpen>
                <ToolCall title="Applied database migrations" detail="3 files" />
                <ToolCall title="Deploying the API" detail="2 of 4 pods" status="running" />
                <ToolCall icon="clock" title="Smoke tests" detail="queued" />
              </WorkLog>
              <MessageMarkdown markdown="Deploying **api@2.14**. I’ll run the smoke tests once every pod is healthy." />
            </AssistantMessage>
          </ConversationMessages>
          <ConversationComposer>
            <WorkbenchComposer options={false} checkout={false} placeholder="Steer the run…" onSubmit={() => {}} />
          </ConversationComposer>
        </Conversation>
        <WorkbenchDock>
          <TerminalHeader title="deploy-api — logs" />
          <TerminalBody seed={[{ t: 'kubectl rollout status deploy/api', p: true }, { t: 'Waiting for rollout: 2 of 4 updated replicas are available…' }]} cwd="ops" />
        </WorkbenchDock>
      </WorkbenchMain>
      <WorkbenchPanel>
        <WorkbenchPanelHeader>
          <WorkbenchPanelTitle icon="bot">Runs</WorkbenchPanelTitle>
          <WorkbenchPanelClose />
        </WorkbenchPanelHeader>
        <SurfaceAgents agents={RUNS} />
      </WorkbenchPanel>
    </WorkbenchShell>
  )
}
// #endregion

// #region workbench_first_message
export function NewThread() {
  const [messages, setMessages] = useState<{ id: string; role: string; text: string }[]>([])
  const empty = messages.length === 0
  const send = (text: string) =>
    setMessages((m) => [
      ...m,
      { id: 'u' + m.length, role: 'user', text },
      { id: 'a' + m.length, role: 'assistant', text: `Here’s the plan for **${text}**:\n\n1. Read the relevant files\n2. Make the change\n3. Run the checks` },
    ])
  return (
    <Conversation empty={empty}>
      <ConversationEmpty>
        <ConversationGreeting title="What are we building?" description="Start a thread — ask anything about this workspace." />
      </ConversationEmpty>
      <ConversationMessages threadKey="new">
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserMessage key={m.id}>{m.text}</UserMessage>
          ) : (
            <AssistantMessage key={m.id}>
              <MessageMarkdown markdown={m.text} />
            </AssistantMessage>
          ),
        )}
      </ConversationMessages>
      <ConversationComposer>
        <WorkbenchComposer autoFocus={empty} onSubmit={(md) => send(stripAttachmentRefs(md))} />
      </ConversationComposer>
      <ConversationSuggestions>
        {['Add a dark mode toggle', 'Write tests for the cart'].map((s) => (
          <Suggestion key={s} onPress={() => send(s)}>
            {s}
          </Suggestion>
        ))}
      </ConversationSuggestions>
    </Conversation>
  )
}
// #endregion

// #region workbench_snapsheet
export function TerminalSheet() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="wb-btn" onClick={() => setOpen(true)}>
        Open terminal
      </button>
      <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.5, 0.92]} bg="var(--wb-term)" className="wb-term">
        <TerminalHeader title="zsh — cookbook">
          <TerminalAction icon="trash" label="Close terminal" onPress={() => setOpen(false)} />
        </TerminalHeader>
        <TerminalBody seed={[{ t: 'npm run dev', p: true }, { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' }]} />
      </SnapSheet>
    </>
  )
}
// #endregion

// #region terminal
export function Terminal() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 300 }} className="wb-term">
      <TerminalHeader title="zsh">
        <TerminalAction icon="split" label="Split terminal" />
        <TerminalAction icon="plus" label="New terminal" />
      </TerminalHeader>
      <TerminalBody seed={[{ t: 'help', p: true }, { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' }]} />
    </div>
  )
}
// #endregion

// #region surfaces
export function Surfaces() {
  // null shows the surface picker
  const [kind, setKind] = useState<SurfaceKind | null>(null)
  const meta = SURFACES.find((s) => s.k === kind)
  return (
    <WorkbenchPanel>
      <WorkbenchPanelHeader>
        <WorkbenchPanelTitle icon={meta?.icon}>{meta?.name ?? 'Surfaces'}</WorkbenchPanelTitle>
        <WorkbenchPanelClose onPress={() => setKind(null)} />
      </WorkbenchPanelHeader>
      {kind === 'browser' ? (
        <SurfaceBrowser url="http://localhost:3000">
          <SurfaceAppPreview name="app-builder" detail="serving on :3000" />
        </SurfaceBrowser>
      ) : kind === 'terminal' ? (
        <SurfaceTerminal>
          <TerminalBody />
        </SurfaceTerminal>
      ) : kind === 'files' ? (
        <SurfaceFiles paths={['src/App.tsx', 'src/main.tsx', 'package.json']} />
      ) : kind === 'diff' ? (
        <SurfaceDiff oldFile={{ name: 'a.ts', contents: 'let a = 1\n' }} newFile={{ name: 'a.ts', contents: 'const a = 1\n' }} />
      ) : kind === 'agents' ? (
        <SurfaceAgents agents={[{ name: 'lint', status: 'passed', detail: 'no issues · 4s' }]} />
      ) : (
        <SurfacePicker onPick={setKind} />
      )}
    </WorkbenchPanel>
  )
}
// #endregion

// #region filetree
const PATHS = [
  'cookbook/src/components/Credenza.tsx',
  'cookbook/src/components/SideDrawer.tsx',
  'cookbook/src/haptics.ts',
  'cookbook/src/App.tsx',
  'cookbook/package.json',
  'cookbook/vite.config.js',
]

export function Files() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 330 }}>
      <SurfaceFiles paths={PATHS} selected={['cookbook/src/App.tsx']} />
    </div>
  )
}
// #endregion

// #region diff
export function Change() {
  return (
    <div style={{ height: 330, overflow: 'auto' }}>
      <SurfaceDiff
        oldFile={{ name: 'src/haptics.ts', contents: "export async function bootHaptics() {\n  if (navigator.vibrate) return\n  await import('ios-vibrator-pro-max')\n}" }}
        newFile={{ name: 'src/haptics.ts', contents: "export async function bootHaptics() {\n  if (isBlockingStub(navigator.vibrate)) delete navigator.vibrate\n  await import('ios-vibrator-pro-max@3.0.3')\n}" }}
      />
    </div>
  )
}
// #endregion

/* The snap-sheet example needs a phone-sized, positioned host; the terminal stays dark in light mode. */
function SheetHost() {
  const [open, setOpen] = useState(false)
  const light = useAppearance() === 'light'
  return (
    <WorkbenchTheme style={{ position: 'relative', width: 390, maxWidth: '100%', height: 460, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px var(--wb-sep)' }}>
      <div style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>cookbook · main</div>
        <div style={{ fontSize: 13, color: 'var(--wb-label2)', lineHeight: 1.5 }}>
          Open the terminal, then drag its handle: a slow drag settles at the nearest snap, a flick carries on to the next — or down past the lowest to close.
        </div>
        <button
          type="button"
          className="wb-btn"
          onClick={() => setOpen(true)}
          style={{ justifySelf: 'start', border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', font: 'inherit', fontWeight: 600, fontSize: 13, padding: '8px 14px', cursor: 'pointer' }}
        >
          Open terminal
        </button>
      </div>
      <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.5, 0.92]} bg={light ? '#1C1C23' : 'var(--wb-term)'} className="wb-term">
        <TerminalHeader title="zsh — cookbook">
          <TerminalAction icon="trash" label="Close terminal" onPress={() => setOpen(false)} />
        </TerminalHeader>
        <TerminalBody seed={[{ t: 'npm run dev', p: true }, { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' }]} />
      </SnapSheet>
    </WorkbenchTheme>
  )
}

const T3_WIDTHS: Record<string, [number, number]> = { regular: [1240, 640], medium: [900, 620], compact: [390, 680] }

export const WORKBENCH_SHELL_LIVE: Record<string, LiveSpec> = {
  workbench_t3: {
    title: 'The t3-clone block · every part at once',
    theme: 'wb',
    h: 660,
    bleed: true,
    variants: [
      { id: 'regular', label: 'Desktop' },
      { id: 'medium', label: 'Tablet' },
      { id: 'compact', label: 'Phone' },
    ],
    code: t3Source,
    Render: ({ variant }) => {
      const [w, h] = T3_WIDTHS[variant] ?? T3_WIDTHS.regular
      return (
        <div style={{ padding: 16 }}>
          <Scaled key={variant} width={w} height={h}>
            <T3Clone terminal={variant === 'compact' ? false : undefined} />
          </Scaled>
        </div>
      )
    },
  },
  ...examples(raw, [
    { id: 'workbench_chat', title: 'Chat only · sidebar and conversation', theme: 'wb', h: 480, Render: () => <Scaled width={980} height={480}><ChatOnly /></Scaled> },
    { id: 'workbench_inspector', title: 'Chat + diff inspector', theme: 'wb', h: 520, Render: () => <Scaled width={1160} height={520}><ChatWithDiff /></Scaled> },
    { id: 'workbench_phone', title: 'Phone · hamburger sidebar, terminal sheet', theme: 'wb', h: 680, Render: () => <Frame width={390} height={680}><PhoneWorkbench /></Frame> },
    { id: 'workbench_console', title: 'Agent console · runs, logs, steering', theme: 'wb', h: 540, Render: () => <Scaled width={1160} height={540}><AgentConsole /></Scaled> },
    {
      id: 'workbench_first_message',
      title: 'Conversation · the first message',
      theme: 'wb',
      h: 480,
      Render: () => (
        <Frame height={460}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--wb-bg)' }}>
            <NewThread />
          </div>
        </Frame>
      ),
    },
    { id: 'workbench_snapsheet', title: 'SnapSheet · the compact terminal', theme: 'wb', h: 480, Render: () => <SheetHost /> },
    {
      id: 'terminal',
      title: 'TerminalHeader · TerminalBody',
      theme: 'wb',
      h: 320,
      Render: () => (
        <div style={{ borderRadius: 12, overflow: 'hidden', background: 'var(--wb-term)', boxShadow: '0 0 0 1px var(--wb-sep)' }}>
          <Terminal />
        </div>
      ),
    },
    { id: 'surfaces', title: 'WorkbenchPanel · surfaces', theme: 'wb', h: 400, Render: () => <Frame height={380}><Surfaces /></Frame> },
    { id: 'filetree', title: 'File tree · @pierre/trees', theme: 'wb', h: 340, Render: () => <Frame height={330}><Files /></Frame> },
    { id: 'diff', title: 'Code diff · @pierre/diffs', theme: 'wb', h: 340, Render: () => <Frame height={330}><Change /></Frame> },
  ]),
}
