import type { ReactNode } from 'react'
import {
  AssistantMessage,
  Conversation,
  ConversationComposer,
  ConversationMessages,
  MessageMarkdown,
  TerminalBody,
  TerminalHeader,
  ThreadGroup,
  ThreadItem,
  ThreadList,
  ThreadSidebar,
  ThreadSidebarBrand,
  ThreadSidebarHeader,
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

function PhoneWorkbench() {
  return (
    <Frame width={390} height={680}>
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
