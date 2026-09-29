import { useState, type ReactNode } from 'react'
import {
  AssistantMessage,
  Conversation,
  ConversationComposer,
  ConversationMessages,
  Icon,
  MessageMarkdown,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  SidebarWorkspace,
  TerminalBody,
  TerminalHeader,
  useWorkbenchShell,
  UserMessage,
  WorkbenchActions,
  WorkbenchComposer,
  WorkbenchDock,
  WorkbenchDockClose,
  WorkbenchDockTrigger,
  WorkbenchHeader,
  WorkbenchMain,
  WorkbenchShell,
  WorkbenchSidebar,
  WorkbenchSidebarClose,
  WorkbenchSidebarTrigger,
  WorkbenchTitle,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const BUILD_LOG = [
  { t: 'pnpm build', p: true },
  { t: 'vite v8.2.1 building for production…' },
  { t: '✓ 214 modules transformed.', c: '#7EE0B8' },
  { t: 'dist/index.js  182.4 kB │ gzip: 58.1 kB' },
]

// A fixed-size, rounded window.
function Frame({
  width,
  height,
  children,
}: {
  width?: number
  height: number
  children: ReactNode
}) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: width,
        height,
        margin: '0 auto',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      {children}
    </div>
  )
}

// The thread list, from the generic Sidebar parts: on a phone it is the
// hamburger drawer, and picking a thread closes it.
function Threads() {
  const shell = useWorkbenchShell()
  const [current, setCurrent] = useState('ship the build')
  const item = (title: string, meta: string) => (
    <SidebarItem
      icon={<Icon name="bubble-left" size={15} sw={1.8} />}
      label={title}
      badge={meta}
      active={title === current}
      onPress={() => {
        setCurrent(title)
        shell.setSidebarOpen(false)
      }}
    />
  )
  return (
    <nav aria-label="Threads" className="flex h-full flex-col bg-sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SidebarWorkspace name="Workbench" />
          </div>
          <WorkbenchSidebarClose />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection title="Active">
          {item('ship the build', 'now')}
          {item('triage flaky tests', '4m')}
        </SidebarSection>
      </SidebarContent>
    </nav>
  )
}

function PhoneWorkbench() {
  return (
    <Frame width={390} height={680}>
      <WorkbenchShell defaultDockOpen>
        <WorkbenchSidebar>
          <Threads />
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
              <UserMessage key="u1">
                Build it and tell me the bundle size.
              </UserMessage>
              <AssistantMessage key="a1">
                <MessageMarkdown
                  markdown={
                    'Building now — the log is in the terminal sheet. ' +
                    'Drag it down to dismiss, or up for more.'
                  }
                />
              </AssistantMessage>
            </ConversationMessages>
            <ConversationComposer>
              <WorkbenchComposer
                options={false}
                checkout={false}
                onSubmit={() => {}}
              />
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
    </Frame>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function PhoneWorkbenchExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <PhoneWorkbench />
    </WorkbenchTheme>
  )
}
