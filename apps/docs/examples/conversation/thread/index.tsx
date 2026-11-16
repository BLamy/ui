import { useEffect, useRef, useState } from 'react'
import {
  ConversationAssistantMessage,
  Conversation,
  ConversationComposer,
  ConversationEmpty,
  ConversationMessages,
  ConversationSuggestions,
  ConversationMarkdown,
  ConversationSuggestion,
  ConversationToolCall,
  ConversationUserMessage,
  ConversationWorkLog,
} from '@/components/ui/conversation'
import {
  Composer,
  ComposerCard,
  ComposerFooter,
  ComposerInput,
  ComposerSend,
  ComposerSpacer,
} from '@/components/ui/composer'
import { ThemeScope } from '@/lib/theme'
import { Button } from '@/components/ui/button'

interface Turn {
  id: string
  prompt: string
  reply: string
  worked: string
}

const REPLY =
  'The **`ConversationComposer`** is one element in both states, so the ' +
  'draft and the caret survive the move.\n\n' +
  '- Empty: the greeting sits above a centred composer\n' +
  '- After the first send: the greeting leaves and the composer flies to its dock\n' +
  '- New turns anchor near the top; the reply streams in below'

const SUGGESTIONS = [
  'Summarise the last release',
  'Find slow queries in the orders service',
  'Draft a migration plan',
]

// Empty, the greeting and the suggestions surround a centred composer. The
// first message turns the same composer into the thread's dock. Streaming is
// simulated: the typing dots show until the first token, then the reply grows.
function Thread() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [reply, setReply] = useState('')
  const [streaming, setStreaming] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const count = useRef(0)

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current)
    },
    [],
  )

  const send = (prompt: string) => {
    const text = prompt.trim()
    if (!text || streaming) return
    const id = `t${++count.current}`
    setTurns((t) => [...t, { id, prompt: text, reply: '', worked: 'Worked for 4s' }])
    setReply('')
    setStreaming(true)
    let i = 0
    // The first ~700ms is "thinking": the typing dots, no text yet.
    const started = Date.now()
    timer.current = setInterval(() => {
      if (Date.now() - started < 700) return
      i += 6
      setReply(REPLY.slice(0, i))
      if (i >= REPLY.length) {
        if (timer.current) clearInterval(timer.current)
        setStreaming(false)
        setTurns((t) => t.map((x) => (x.id === id ? { ...x, reply: REPLY } : x)))
      }
    }, 40)
  }

  const empty = turns.length === 0
  const last = turns[turns.length - 1]

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-card border border-border bg-background">
      <Conversation empty={empty}>
        <ConversationEmpty
            title="What are we building?"
            description="Ask about your code, or start from a suggestion." />
        <ConversationMessages threadKey="demo" streaming={streaming}>
          {turns.map((t) => [
            <ConversationUserMessage key={`${t.id}-u`}>{t.prompt}</ConversationUserMessage>,
            <ConversationAssistantMessage key={`${t.id}-a`}>
              <ConversationWorkLog summary={t.worked}>
                <ConversationToolCall icon="doc-text" title="Read" description="src/app.tsx" />
                <ConversationToolCall title="Ran" code="pnpm nx test ui" description="42 passed" />
              </ConversationWorkLog>
              <ConversationMarkdown
                markdown={t === last && streaming ? reply : t.reply}
                streaming={t === last && streaming}
              />
            </ConversationAssistantMessage>,
          ])}
        </ConversationMessages>
        <ConversationComposer>
          <Composer onSubmit={send} streaming={streaming}>
            <ComposerCard>
              <ComposerInput placeholder="Ask anything" />
              <ComposerFooter>
                <ComposerSpacer />
                <ComposerSend />
              </ComposerFooter>
            </ComposerCard>
          </Composer>
        </ConversationComposer>
        <ConversationSuggestions>
          {SUGGESTIONS.map((s) => (
            <ConversationSuggestion key={s} onClick={() => send(s)}>
              {s}
            </ConversationSuggestion>
          ))}
        </ConversationSuggestions>
      </Conversation>
    </div>
  )
}

export default function ThreadExample() {
  const [key, setKey] = useState(0)
  return (
    <ThemeScope scope="workbench" className="rounded-card p-4">
      <div className="mx-auto grid max-w-[720px] gap-3">
        <Thread key={key} />
        <div className="flex items-center justify-between text-footnote text-muted-foreground">
          <span>Send a message or press a suggestion to watch the composer dock.</span>
          <Button size="sm" variant="secondary" onClick={() => setKey((k) => k + 1)}>
            Start over
          </Button>
        </div>
      </div>
    </ThemeScope>
  )
}
