import { useEffect, useState, type ReactNode } from 'react'
import {
  MarkdownView,
  MessageScroller,
  type MessageScrollerItem,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const answer =
  'The scroller anchors each new turn near the top, then **follows the live ' +
  'edge** only while you are there.\n\n' +
  '- Scroll up mid-reply and following stops.\n- The jump pill rises in and ' +
  'widens to say a reply is streaming.\n- Tap it and the view glides back ' +
  'to the newest line on a spring — interruptible, so a scroll catches ' +
  'it.\n\n' +
  'New turns rise into place rather than appearing, and a thread you open is ' +
  'simply there: nothing replays.\n\n' +
  Array.from(
    { length: 6 },
    (_, i) =>
      `${i + 1}. A line of the streamed answer, long enough to push ` +
      'the live edge below the fold.',
  ).join('\n')

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div
      style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}
    >
      <div
        style={{
          maxWidth: '80%',
          background: 'var(--secondary-strong)',
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

// While `streaming`, the scroller follows the live edge. Scroll up and it lets
// go; the jump pill rises in ("Streaming ↓"), and tapping it springs the view
// back down.
function StreamingJumpPill() {
  const [shown, setShown] = useState(0)
  const [run, setRun] = useState(0)
  useEffect(() => {
    // Reduced motion: the whole answer at once
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(answer.length)
      return
    }
    setShown(0)
    const id = setInterval(
      () => setShown((n) => (n >= answer.length ? n : n + 6)),
      60,
    )
    return () => clearInterval(id)
  }, [run])
  const done = shown >= answer.length
  const items: MessageScrollerItem[] = [
    {
      id: 'u1',
      anchor: true,
      node: <UserBubble>Explain how the scroller follows a reply.</UserBubble>,
    },
    {
      id: 'a1',
      node: (
        <div style={{ margin: '4px 0 12px' }}>
          <MarkdownView markdown={answer.slice(0, shown)} streaming={!done} />
        </div>
      ),
    },
  ]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 360,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--background)',
        border: '1px solid var(--border)',
      }}
    >
      <MessageScroller
        items={items}
        streaming={!done}
        threadKey={'stream' + run}
      />
      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          fontSize: 12,
          color: 'var(--muted-foreground)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ flex: 1 }}>
          {done ? 'Done.' : 'Streaming — scroll up to let go of the live edge.'}
        </span>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          style={{
            border: 0,
            borderRadius: 8,
            background: 'var(--secondary-strong)',
            color: 'var(--foreground)',
            font: 'inherit',
            fontSize: 12,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Replay
        </button>
      </div>
    </div>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function StreamingJumpPillExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <StreamingJumpPill />
    </WorkbenchTheme>
  )
}
