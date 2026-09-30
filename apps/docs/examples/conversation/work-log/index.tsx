import { useState } from 'react'
import {
  AssistantMessage,
  ConversationTyping,
  MessageMarkdown,
  SettledBanner,
  ToolCall,
  UserMessage,
  WorkLog,
} from '@/components/ui/conversation'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'
import { Button } from '@/components/ui/button'

// The transcript parts standing alone: a user turn with an image, a WorkLog
// whose tool calls are done, running and failed, the typing dots, and the
// banner a settled thread shows above its composer.
const SHOT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><rect width="420" height="220" fill="#1f2937"/><rect x="24" y="24" width="220" height="14" rx="7" fill="#64748b"/><rect x="24" y="52" width="320" height="10" rx="5" fill="#475569"/><rect x="24" y="72" width="280" height="10" rx="5" fill="#475569"/><rect x="24" y="130" width="120" height="64" rx="10" fill="#ef4444"/></svg>',
  )

export default function WorkLogExample() {
  const [settled, setSettled] = useState(true)
  return (
    <WorkbenchTheme className="rounded-card p-5">
      <div className="mx-auto grid max-w-[620px] gap-1">
        <UserMessage images={[SHOT]}>
          The checkout button is clipped on mobile, can you fix it?
        </UserMessage>
        <AssistantMessage>
          <WorkLog summary="Worked for 1m 4s" defaultOpen>
            <ToolCall icon="doc-text" title="Read" detail="checkout/button.tsx" />
            <ToolCall
              icon="doc-text"
              title="Edited"
              detail="checkout/button.tsx"
              code={'- className="w-[420px]"\n+ className="w-full max-w-[420px]"'}
            />
            <ToolCall status="running" title="Running" detail="pnpm nx test checkout" />
            <ToolCall status="error" title="Type check failed" detail="2 errors" />
          </WorkLog>
          <MessageMarkdown markdown="The button had a fixed **420px** width. It is now `w-full` with a max width, so it shrinks inside narrow screens." />
        </AssistantMessage>
        <UserMessage>Thanks. Anything else?</UserMessage>
        <AssistantMessage>
          <ConversationTyping />
        </AssistantMessage>

        <div className="mt-4">
          {settled ? (
            <SettledBanner onUnsettle={() => setSettled(false)} />
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2.5 text-footnote text-muted-foreground">
              Back to Active.
              <Button size="sm" variant="secondary" onPress={() => setSettled(true)}>
                Settle again
              </Button>
            </div>
          )}
        </div>
      </div>
    </WorkbenchTheme>
  )
}
