import { useEffect, useRef, useState } from 'react'
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerStop } from '@/components/ui/composer/composer'
import { ComposerQueue } from '@/components/ui/composer/composer-cards'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'

interface Message {
  id: number
  role: 'user' | 'agent'
  text: string
}

// Send a message: the agent "replies" for three seconds. Anything you send in
// the meantime becomes a card that morphs out of the top of the composer. When
// the reply ends the first card merges back in and is sent, and so on. Cards
// can be edited (back into the draft), sent now (stops the reply) or removed.
function Queue() {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: 'agent', text: 'Hi! Send a few messages in a row.' }])
  const [streaming, setStreaming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seq = useRef(1)
  useEffect(() => () => clearTimeout(timer.current), [])
  const add = (role: Message['role'], text: string) => setMessages((m) => [...m, { id: seq.current++, role, text }])

  return (
    <div className="mx-auto flex h-[460px] max-w-[540px] flex-col gap-3 py-6">
      <div role="log" aria-label="Conversation" className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto px-1">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'max-w-[80%] self-end rounded-2xl bg-primary px-3 py-1.5 text-detail text-white' : 'max-w-[80%] self-start rounded-2xl bg-secondary px-3 py-1.5 text-detail text-foreground'}
          >
            {m.text}
          </div>
        ))}
        {streaming ? <div className="self-start px-1 text-footnote text-foreground/70">Thinking…</div> : null}
      </div>
      <Composer
        streaming={streaming}
        onSubmit={(markdown) => {
          add('user', markdown)
          setStreaming(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            add('agent', `Done with “${markdown.slice(0, 40)}”.`)
            setStreaming(false)
          }, 3000)
        }}
        onStop={() => {
          clearTimeout(timer.current)
          setStreaming(false)
        }}
      >
        <ComposerQueue />
        <ComposerCard>
          <ComposerInput placeholder={streaming ? 'Queue a follow-up…' : 'Message the agent'} />
          <ComposerFooter>
            <ComposerSpacer />
            <ComposerStop />
            <ComposerSend morph={false} />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </div>
  )
}

export default function QueueExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <Queue />
    </WorkbenchTheme>
  )
}
