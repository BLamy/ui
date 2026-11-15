import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConversationAssistantMessage, Conversation, ConversationComposer, ConversationMessages, ConversationMarkdown, ConversationUserMessage } from '@/components/ui/conversation'
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarItem, SidebarSection, SidebarAccount } from '@/components/ui/sidebar'
import { ThemeScope } from '@/lib/theme'
import { stripAttachmentRefs, WorkbenchComposer } from '@/components/blocks/t3-clone/components/workbench/workbench-composer'
import { useWorkbenchShell, WorkbenchContent, WorkbenchHeader, WorkbenchMain, WorkbenchShell, WorkbenchSidebar, WorkbenchSidebarClose, WorkbenchSidebarTrigger, WorkbenchTitle } from '@/components/blocks/t3-clone/components/workbench/workbench-shell'

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
    <div className="flex h-full flex-col bg-sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SidebarAccount title="Assistant" />
          </div>
          <WorkbenchSidebarClose />
        </div>
      </SidebarHeader>
      <SidebarContent aria-label="Threads">
        <SidebarSection title="Recent">
          {RECENT.map((t) => (
            <SidebarItem
              key={t}
              icon="bubble-left"
              title={t}
              current={t === current}
              onClick={() => {
                onPick(t)
                if (shell.compact) shell.setSidebarOpen(false)
              }}
            />
          ))}
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <SidebarAccount title="Ada Lovelace" description="Pro plan" />
      </SidebarFooter>
    </div>
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
          <WorkbenchContent>
            <Conversation>
              <ConversationMessages threadKey={current}>
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <ConversationUserMessage key={m.id}>{m.text}</ConversationUserMessage>
                  ) : (
                    <ConversationAssistantMessage key={m.id}>
                      <ConversationMarkdown markdown={m.text} />
                    </ConversationAssistantMessage>
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
          </WorkbenchContent>
        </WorkbenchMain>
      </WorkbenchShell>
    </Scaled>
  )
}

// A `workbench` ThemeScope follows the app's light / dark appearance.
export default function ChatOnlyExample() {
  return (
    <ThemeScope scope="workbench" style={{ padding: 18 }}>
      <ChatOnly />
    </ThemeScope>
  )
}
