import { useState, type ReactNode } from 'react'
import { AssistantMessage, Conversation, ConversationComposer, ConversationMessages, MessageMarkdown, UserMessage } from '@/components/ui/conversation'
import { SidebarContent, SidebarHeader, SidebarItem, SidebarSection, SidebarWorkspace } from '@/components/ui/sidebar'
import { ThemeScope } from '@/lib/theme'
import { TerminalBody, TerminalHeader } from '@/components/blocks/t3-clone/components/workbench/terminal'
import { useWorkbenchShell, WorkbenchActions, WorkbenchContent, WorkbenchDock, WorkbenchDockClose, WorkbenchDockTrigger, WorkbenchHeader, WorkbenchMain, WorkbenchShell, WorkbenchSidebar, WorkbenchSidebarClose, WorkbenchSidebarTrigger, WorkbenchTitle } from '@/components/blocks/t3-clone/components/workbench/workbench-shell'
import { WorkbenchComposer } from '@/components/blocks/t3-clone/components/workbench/workbench-composer'

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
      icon="bubble-left"
      title={title}
      trailing={meta}
      current={title === current}
      onClick={() => {
        setCurrent(title)
        shell.setSidebarOpen(false)
      }}
    />
  )
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SidebarWorkspace title="Workbench" />
          </div>
          <WorkbenchSidebarClose />
        </div>
      </SidebarHeader>
      <SidebarContent aria-label="Threads">
        <SidebarSection title="Active">
          {item('ship the build', 'now')}
          {item('triage flaky tests', '4m')}
        </SidebarSection>
      </SidebarContent>
    </div>
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
          <WorkbenchContent>
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
          </WorkbenchContent>
          {/* compact width: the dock is a FloatingSheet (`collapse="hide"`) over the whole shell */}
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

// A `workbench` ThemeScope follows the app's light / dark appearance.
export default function PhoneWorkbenchExample() {
  return (
    <ThemeScope scope="workbench" style={{ padding: 18 }}>
      <PhoneWorkbench />
    </ThemeScope>
  )
}
