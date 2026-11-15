import { useState } from 'react'
import {
  ConversationAssistantMessage,
  ConversationTyping,
  ConversationMarkdown,
  ConversationToolCall,
  ConversationUserMessage,
  ConversationWorkLog,
} from '@/components/ui/conversation'
import { ThemeScope } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { SettledBanner } from '@/components/blocks/t3-clone/components/settled-banner'

// The transcript parts standing alone: a user turn with an image, a ConversationWorkLog
// whose tool calls are done, running and failed, the typing dots, and the
// banner a settled thread shows above its composer (T3 Code's SettledBanner, from
// the t3-clone block).
const SHOT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><rect width="420" height="220" fill="#1f2937"/><rect x="24" y="24" width="220" height="14" rx="7" fill="#64748b"/><rect x="24" y="52" width="320" height="10" rx="5" fill="#475569"/><rect x="24" y="72" width="280" height="10" rx="5" fill="#475569"/><rect x="24" y="130" width="120" height="64" rx="10" fill="#ef4444"/></svg>',
  )

export default function WorkLogExample() {
  const [settled, setSettled] = useState(true)
  return (
    <ThemeScope scope="workbench" className="rounded-card p-5">
      <div className="mx-auto grid max-w-[620px] gap-1">
        <ConversationUserMessage attachments={[{ id: 'shot', name: 'checkout.png', src: SHOT, kind: 'image' }]}>
          The checkout button is clipped on mobile, can you fix it?
        </ConversationUserMessage>
        <ConversationAssistantMessage>
          <ConversationWorkLog summary="Worked for 1m 4s" defaultOpen>
            <ConversationToolCall icon="doc-text" title="Read" description="checkout/button.tsx" />
            <ConversationToolCall
              icon="doc-text"
              title="Edited"
              description="checkout/button.tsx"
              code={'- className="w-[420px]"\n+ className="w-full max-w-[420px]"'}
            />
            <ConversationToolCall status="running" title="Running" description="pnpm nx test checkout" />
            <ConversationToolCall status="error" title="Type check failed" description="2 errors" />
          </ConversationWorkLog>
          <ConversationMarkdown markdown="The button had a fixed **420px** width. It is now `w-full` with a max width, so it shrinks inside narrow screens." />
        </ConversationAssistantMessage>
        <ConversationUserMessage>Thanks. Anything else?</ConversationUserMessage>
        <ConversationAssistantMessage>
          <ConversationTyping />
        </ConversationAssistantMessage>

        <div className="mt-4">
          {settled ? (
            <SettledBanner onUnsettle={() => setSettled(false)} />
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2.5 text-footnote text-muted-foreground">
              Back to Active.
              <Button size="sm" variant="secondary" onClick={() => setSettled(true)}>
                Settle again
              </Button>
            </div>
          )}
        </div>
      </div>
    </ThemeScope>
  )
}
