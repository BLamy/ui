import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FONT, MarkdownView } from '@brett_lamy/ui'

const reply = `Both servers are now running detached and won't be killed by the
tool's session limits.

| App | URL | PID | Log |
| --- | --- | --- | --- |
| app-builder | http://localhost:3000 | 5229 | app-builder.log |
| agent-kanban | http://localhost:3001 | 7099 | agent-kanban.log |

To stop them later:

\`\`\`bash
kill 5229 7099
# or
lsof -ti :3000 :3001 | xargs kill
\`\`\`

Both apps hot-reload — edit \`src/\` and the browser surface refreshes on save.`

function DemoButton({
  label,
  onPress,
  style,
}: {
  label: string
  onPress?: () => void
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onPress}
      style={{
        border: 0,
        borderRadius: 10,
        background: 'var(--primary)',
        color: '#fff',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: 13.5,
        padding: '9px 16px',
        cursor: 'pointer',
        ...style,
      }}
    >
      {label}
    </button>
  )
}

export default function StreamedReply() {
  const [text, setText] = useState(reply)
  const [live, setLive] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(timer.current), [])

  // Reveal the reply four words at a time; `streaming` keeps half-open Markdown
  // (tables, fences) stable.
  const replay = () => {
    clearInterval(timer.current)
    const words = reply.split(' ')
    let i = 0
    setLive(true)
    setText('')
    timer.current = setInterval(() => {
      i += 4
      if (i >= words.length) {
        clearInterval(timer.current)
        setText(reply)
        setLive(false)
      } else setText(words.slice(0, i).join(' '))
    }, 95)
  }

  return (
    <div style={{ fontFamily: FONT }}>
      <DemoButton
        label={live ? 'Streaming…' : 'Replay stream'}
        onPress={replay}
        style={{ marginBottom: 10, background: '#0A84FF' }}
      />
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '6px 16px',
          minHeight: 280,
          background: 'var(--card)',
          color: 'var(--foreground)',
        }}
      >
        <MarkdownView markdown={text} streaming={live} />
      </div>
    </div>
  )
}
