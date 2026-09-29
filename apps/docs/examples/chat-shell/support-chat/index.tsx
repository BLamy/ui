import { useState, type ReactNode } from 'react'
import {
  Avatar,
  ChatShell,
  ChatShellDescription,
  ChatShellFooter,
  ChatShellHeader,
  ChatShellHeaderAction,
  ChatShellHeaderActions,
  ChatShellMain,
  ChatShellTitle,
  Composer,
  ComposerCard,
  ComposerFooter,
  ComposerInput,
  ComposerSend,
  ComposerSpacer,
  Icon,
} from '@brett_lamy/ui'

type Person = { f: string; l: string }

const agent: Person = { f: 'Juniper', l: 'Hale' }
const you: Person = { f: 'You', l: '' }

// One transcript row: avatar, name, text.
function Line({ who, children }: { who: Person; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 px-4 py-1.5">
      <Avatar c={who} size={28} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-foreground">
          {who.f}
        </div>
        <p className="m-0 text-[13.5px] leading-normal text-foreground">
          {children}
        </p>
      </div>
    </div>
  )
}

// A rounded, hairline-bordered window with the page background; `width` caps
// it, centered.
function Window({ width, children }: { width?: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

// The smallest shell: no navigation at all — a support widget in the product's
// accent.
export default function SupportChat() {
  const [log, setLog] = useState([
    { from: agent, text: 'Hi! What can I help with today?' },
  ])
  const [typing, setTyping] = useState(false)
  const send = (text: string) => {
    if (!text) return
    setLog((l) => [...l, { from: you, text }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setLog((l) => [
        ...l,
        { from: agent, text: 'Thanks — looking into that now.' },
      ])
    }, 1500)
  }
  return (
    <Window width={380}>
      <div style={{ height: 440, display: 'flex' }}>
        <ChatShell tint="#30B06E">
          <ChatShellMain>
            <ChatShellHeader>
              <Avatar c={agent} size={24} />
              <ChatShellTitle>Support</ChatShellTitle>
              <ChatShellDescription>
                Replies in a few minutes
              </ChatShellDescription>
              <ChatShellHeaderActions>
                <ChatShellHeaderAction aria-label="Close">
                  <Icon name="xmark-large" size={15} sw={1.9} />
                </ChatShellHeaderAction>
              </ChatShellHeaderActions>
            </ChatShellHeader>
            <div
              role="log"
              aria-live="polite"
              className="min-h-0 flex-1 overflow-y-auto py-3"
            >
              {log.map((m, i) => (
                <Line key={i} who={m.from}>
                  {m.text}
                </Line>
              ))}
              {typing && (
                <div className="px-4 py-1 text-[12px] text-muted-foreground">
                  Juniper is typing…
                </div>
              )}
            </div>
            <ChatShellFooter>
              <Composer onSubmit={send}>
                <ComposerCard>
                  <ComposerInput placeholder="Write a message…" />
                  <ComposerFooter>
                    <ComposerSpacer />
                    <ComposerSend />
                  </ComposerFooter>
                </ComposerCard>
              </Composer>
            </ChatShellFooter>
          </ChatShellMain>
        </ChatShell>
      </div>
    </Window>
  )
}
