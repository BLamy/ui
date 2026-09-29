import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AssistantMessage,
  Conversation,
  ConversationComposer,
  ConversationMessages,
  Icon,
  MessageMarkdown,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  SidebarWorkspace,
  stripAttachmentRefs,
  useWorkbenchShell,
  UserMessage,
  WorkbenchComposer,
  WorkbenchHeader,
  WorkbenchMain,
  WorkbenchShell,
  WorkbenchSidebar,
  WorkbenchSidebarClose,
  WorkbenchSidebarTrigger,
  WorkbenchTitle,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const RECENT = [
  'Onboarding checklist',
  'Rename the billing events',
  'Why is CI slow?',
]

// Lays the shell out at its design width, scaled down (never up) to fit.
function Scaled({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
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
    <div
      ref={host}
      style={{
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        height: height * scale,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// The thread list, from the generic Sidebar parts. Picking a thread closes the
// compact drawer.
function Threads({
  current,
  onPick,
}: {
  current: string
  onPick: (title: string) => void
}) {
  const shell = useWorkbenchShell()
  return (
    <nav aria-label="Threads" className="flex h-full flex-col bg-sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SidebarWorkspace name="Assistant" />
          </div>
          <WorkbenchSidebarClose />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection title="Recent">
          {RECENT.map((t) => (
            <SidebarItem
              key={t}
              icon={<Icon name="bubble-left" size={15} sw={1.8} />}
              label={t}
              active={t === current}
              onPress={() => {
                onPick(t)
                if (shell.compact) shell.setSidebarOpen(false)
              }}
            />
          ))}
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <SidebarWorkspace name="Ada Lovelace" detail="Pro plan" initial="AL" />
      </SidebarFooter>
    </nav>
  )
}

function ChatOnly() {
  const [current, setCurrent] = useState(RECENT[0])
  const [messages, setMessages] = useState([
    {
      id: 'u1',
      role: 'user',
      text: 'Draft an onboarding checklist for new engineers.',
    },
    {
      id: 'a1',
      role: 'assistant',
      text:
        '1. **Day one** — laptop, accounts, and a first PR\n2. **Week ' +
        'one** — pair on a small feature\n3. **Month one** — own an on-call ' +
        'shift',
    },
  ])
  const send = (text: string) =>
    setMessages((m) => [
      ...m,
      { id: 'u' + m.length, role: 'user', text },
      {
        id: 'a' + m.length,
        role: 'assistant',
        text: 'Noted — I’ll fold that into the checklist.',
      },
    ])
  return (
    <Scaled width={980} height={480}>
      <WorkbenchShell>
        <WorkbenchSidebar width={220}>
          <Threads current={current} onPick={setCurrent} />
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
              <WorkbenchComposer
                options={false}
                checkout={false}
                onSubmit={(md) => send(stripAttachmentRefs(md))}
              />
            </ConversationComposer>
          </Conversation>
        </WorkbenchMain>
      </WorkbenchShell>
    </Scaled>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function ChatOnlyExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <ChatOnly />
    </WorkbenchTheme>
  )
}
