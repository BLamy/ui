import { useRef, useState } from 'react'
import { MessageScroller } from '@brett_lamy/ui'

export default function TurnAnchoring() {
  const [msgs, setMsgs] = useState([
    { id: 'u1', role: 'user', text: 'How does anchoring work?' },
    {
      id: 'a1',
      role: 'assistant',
      text: 'Each new turn scrolls near the top of the viewport with a peek of the previous one — the reply streams into the room below without moving your view.',
    },
  ])
  const n = useRef(1)
  const add = () => {
    n.current++
    const uid = 'u' + n.current
    const aid = 'a' + n.current
    setMsgs((m) => [
      ...m,
      { id: uid, role: 'user', text: 'Turn ' + n.current + ' — watch me anchor to the top.' },
    ])
    // The reply lands a beat later, into the room reserved below the anchored turn
    setTimeout(
      () =>
        setMsgs((m) => [
          ...m,
          {
            id: aid,
            role: 'assistant',
            text: 'Replies grow into the reserved room below the anchor. Scroll up mid-reply and following stops; the pill at the bottom jumps back to the live edge.',
          },
        ]),
      380,
    )
  }
  const items = msgs.map((m) => ({
    id: m.id,
    anchor: m.role === 'user', // a user message starts a turn
    node:
      m.role === 'user' ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
          <div
            style={{
              maxWidth: '80%',
              background: 'var(--wb-fill2)',
              borderRadius: '12px 12px 4px 12px',
              padding: '8px 12px',
              fontSize: 13.5,
            }}
          >
            {m.text}
          </div>
        </div>
      ) : (
        <div style={{ margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>{m.text}</div>
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
      <MessageScroller items={items} streaming={false} threadKey="live" />
      <div style={{ padding: 10, borderTop: '1px solid var(--wb-sep)', flexShrink: 0 }}>
        <button
          className="wb-btn"
          onClick={add}
          style={{
            width: '100%',
            border: 0,
            borderRadius: 9,
            background: 'var(--wb-tint)',
            color: '#fff',
            fontFamily: 'inherit',
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
