import { useEffect, useRef, useState } from 'react'
import { MarkdownView } from '@/components/ui/markdown-view'
import { program } from '../keyboard/program'

const answer = ['Here is an interactive terminal counter. Run it, focus the terminal, and press Left or Right.', '', '```typescript tui', program, '```'].join('\n')

export default function AiResponse() {
  const [length, setLength] = useState(answer.length)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const streaming = length < answer.length
  useEffect(() => () => clearInterval(timer.current), [])

  function stream() {
    clearInterval(timer.current)
    setLength(0)
    timer.current = setInterval(() => setLength((current) => {
      const next = Math.min(answer.length, current + 40)
      if (next === answer.length) clearInterval(timer.current)
      return next
    }), 30)
  }

  return <div style={{ width: '100%' }}>
    <button type="button" onClick={stream} disabled={streaming}>{streaming ? 'Streaming response…' : 'Stream response'}</button>
    <MarkdownView
      markdown={answer.slice(0, length)}
      streaming={streaming}
      tui={{ runtimeUrl: import.meta.env.VITE_OPENTUI_RUNTIME_URL, height: 300 }}
    />
  </div>
}
