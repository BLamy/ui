import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AssistantMessage, Conversation, ConversationComposer, ConversationMessages, MessageMarkdown, ToolCall, UserMessage, WorkLog } from '@/components/ui/conversation'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'
import { SurfaceDiff } from '@/components/blocks/t3-clone/components/workbench/surfaces'
import { WorkbenchActions, WorkbenchHeader, WorkbenchMain, WorkbenchPanel, WorkbenchPanelClose, WorkbenchPanelFullscreen, WorkbenchPanelHeader, WorkbenchPanelTitle, WorkbenchPanelTrigger, WorkbenchShell, WorkbenchTitle } from '@/components/blocks/t3-clone/components/workbench/workbench-shell'
import { WorkbenchComposer } from '@/components/blocks/t3-clone/components/workbench/workbench-composer'

const BEFORE = `export function total(items) {
  return items.reduce((sum, i) => sum + i.price, 0)
}`
const AFTER = `export function total(items: Item[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}`

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

function ChatWithDiff() {
  return (
    <Scaled width={1160} height={520}>
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
              <UserMessage key="u1">
                Totals ignore quantity — can you fix it?
              </UserMessage>
              <AssistantMessage key="a1">
                <WorkLog summary="Worked for 18s" defaultOpen>
                  <ToolCall title="Read src/cart.ts" />
                  <ToolCall
                    title="Ran the cart tests"
                    detail="12 passed"
                    code="pnpm test cart"
                  />
                </WorkLog>
                <MessageMarkdown
                  markdown={
                    '`total()` now multiplies by `qty`, and the items are ' +
                    'typed. The change is in the inspector →'
                  }
                />
              </AssistantMessage>
            </ConversationMessages>
            <ConversationComposer>
              <WorkbenchComposer checkout={false} onSubmit={() => {}} />
            </ConversationComposer>
          </Conversation>
        </WorkbenchMain>
        <WorkbenchPanel>
          <WorkbenchPanelHeader>
            <WorkbenchPanelTitle icon="doc-text">Changes</WorkbenchPanelTitle>
            <WorkbenchPanelFullscreen />
            <WorkbenchPanelClose />
          </WorkbenchPanelHeader>
          <SurfaceDiff
            oldFile={{ name: 'src/cart.ts', contents: BEFORE }}
            newFile={{ name: 'src/cart.ts', contents: AFTER }}
          />
        </WorkbenchPanel>
      </WorkbenchShell>
    </Scaled>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function ChatWithDiffExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <ChatWithDiff />
    </WorkbenchTheme>
  )
}
