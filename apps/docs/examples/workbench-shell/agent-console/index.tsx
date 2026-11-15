import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConversationAssistantMessage, Conversation, ConversationComposer, ConversationMessages, ConversationMarkdown, ConversationToolCall, ConversationWorkLog } from '@/components/ui/conversation'
import { ThemeScope } from '@/lib/theme'
import { SurfaceAgents } from '@/components/blocks/t3-clone/components/workbench/surfaces'
import { TerminalBody, TerminalHeader } from '@/components/blocks/t3-clone/components/workbench/terminal'
import { WorkbenchAction, WorkbenchActions, WorkbenchContent, WorkbenchDock, WorkbenchDockTrigger, WorkbenchHeader, WorkbenchMain, WorkbenchPanel, WorkbenchPanelClose, WorkbenchPanelHeader, WorkbenchPanelTitle, WorkbenchPanelTrigger, WorkbenchShell, WorkbenchTitle } from '@/components/blocks/t3-clone/components/workbench/workbench-shell'
import { WorkbenchComposer } from '@/components/blocks/t3-clone/components/workbench/workbench-composer'

const RUNS = [
  { name: 'migrate-db', status: 'passed', detail: '3 migrations · 12s' },
  { name: 'deploy-api', status: 'running', detail: 'rolling 2/4 pods · 48s' },
  { name: 'smoke-tests', status: 'queued', detail: 'waiting on deploy-api' },
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

function AgentConsole() {
  return (
    <Scaled width={1160} height={540}>
      <WorkbenchShell defaultDockOpen defaultPanelOpen>
        <WorkbenchMain>
          <WorkbenchHeader>
            <WorkbenchTitle icon="robot" project="ops">
              release 2.14
            </WorkbenchTitle>
            <WorkbenchActions>
              <WorkbenchAction icon="stop-square" label="Stop run" />
              <WorkbenchDockTrigger />
              <WorkbenchPanelTrigger />
            </WorkbenchActions>
          </WorkbenchHeader>
          <WorkbenchContent>
            <Conversation>
              <ConversationMessages threadKey="release" streaming>
                <ConversationAssistantMessage key="plan">
                  <ConversationWorkLog summary="Running for 1m 2s" defaultOpen>
                    <ConversationToolCall
                      title="Applied database migrations"
                      description="3 files"
                    />
                    <ConversationToolCall
                      title="Deploying the API"
                      description="2 of 4 pods"
                      status="running"
                    />
                    <ConversationToolCall icon="clock-dial" title="Smoke tests" description="queued" />
                  </ConversationWorkLog>
                  <ConversationMarkdown
                    markdown={
                      'Deploying **api@2.14**. I’ll run the smoke tests once ' +
                      'every pod is healthy.'
                    }
                  />
                </ConversationAssistantMessage>
              </ConversationMessages>
              <ConversationComposer>
                <WorkbenchComposer
                  options={false}
                  checkout={false}
                  placeholder="Steer the run…"
                  onSubmit={() => {}}
                />
              </ConversationComposer>
            </Conversation>
          </WorkbenchContent>
          <WorkbenchDock>
            <TerminalHeader title="deploy-api — logs" />
            <TerminalBody
              seed={[
                { t: 'kubectl rollout status deploy/api', p: true },
                {
                  t:
                    'Waiting for rollout: 2 of 4 updated replicas are ' +
                    'available…',
                },
              ]}
              cwd="ops"
            />
          </WorkbenchDock>
        </WorkbenchMain>
        <WorkbenchPanel>
          <WorkbenchPanelHeader>
            <WorkbenchPanelTitle icon="robot">Runs</WorkbenchPanelTitle>
            <WorkbenchPanelClose />
          </WorkbenchPanelHeader>
          <SurfaceAgents agents={RUNS} />
        </WorkbenchPanel>
      </WorkbenchShell>
    </Scaled>
  )
}

// A `workbench` ThemeScope follows the app's light / dark appearance.
export default function AgentConsoleExample() {
  return (
    <ThemeScope scope="workbench" style={{ padding: 18 }}>
      <AgentConsole />
    </ThemeScope>
  )
}
