import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  MessageScroller,
  type MessageScrollerItem,
  WorkbenchTheme,
} from '@brett_lamy/ui'

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}
    >
      <div
        style={{
          maxWidth: '80%',
          background: 'var(--wb-fill2)',
          borderRadius: '12px 12px 4px 12px',
          padding: '8px 12px',
          fontSize: 13.5,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Items that arrive after the thread opened rise into place — the user's turn
// up from the composer, the reply beneath it. The ones the thread opened with
// are simply there.
function TurnsRise() {
  const [msgs, setMsgs] = useState([
    { id: 'u0', user: true, text: 'Opened with this turn — no animation.' },
    {
      id: 'a0',
      user: false,
      text: 'Messages already in a thread are just there when it opens.',
    },
  ])
  const n = useRef(0)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (t.current) clearTimeout(t.current)
    },
    [],
  )
  const send = () => {
    n.current++
    const k = n.current
    setMsgs((m) => [
      ...m,
      {
        id: 'u' + k,
        user: true,
        text: `Turn ${k}: rising up from the composer.`,
      },
    ])
    t.current = setTimeout(
      () =>
        setMsgs((m) => [
          ...m,
          {
            id: 'a' + k,
            user: false,
            text: 'And the reply settles in beneath it.',
          },
        ]),
      420,
    )
  }
  const items: MessageScrollerItem[] = msgs.map((m) => ({
    id: m.id,
    anchor: m.user,
    node: m.user ? (
      <UserBubble>{m.text}</UserBubble>
    ) : (
      <div style={{ margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>
        {m.text}
      </div>
    ),
  }))
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 340,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--wb-bg)',
        border: '1px solid var(--wb-sep)',
      }}
    >
      <MessageScroller items={items} threadKey="turns" />
      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--wb-sep)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="wb-btn"
          onClick={send}
          style={{
            width: '100%',
            border: 0,
            borderRadius: 9,
            background: 'var(--wb-tint)',
            color: '#fff',
            font: 'inherit',
            fontWeight: 600,
            fontSize: 13,
            padding: '9px 0',
            cursor: 'pointer',
          }}
        >
          Send a turn
        </button>
      </div>
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function TurnsRiseExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <TurnsRise />
    </WorkbenchTheme>
  )
}
