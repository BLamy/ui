import { CodeViewer, type CodeHighlight } from '@/components/ui/code-viewer'
import { splitCodeLines } from '@/lib/code-viewer'

const LINES = splitCodeLines(`# A log, not code
2026-11-03 09:41:07 INFO  started in 412 ms
2026-11-03 09:41:09 WARN  retrying request 3 of 5
2026-11-03 09:41:12 ERROR connection refused
2026-11-03 09:41:15 INFO  connected`)

// A highlighter gets a line and returns labelled pieces of it. `type` picks one of the
// library's token colors, and `className` can add anything else.
const highlightLog: CodeHighlight = (text) => {
  const match = /^(\S+ \S+) (INFO|WARN|ERROR)(.*)$/.exec(text)
  if (!match) return [{ text, type: 'comment' }]
  const [, time, level, rest] = match
  return [
    { text: `${time} `, type: 'number' },
    { text: level, type: level === 'INFO' ? 'string' : level === 'WARN' ? 'type' : 'constant' },
    { text: rest },
  ]
}

export default function Highlighting({ variant = 'default' }: { variant?: string }) {
  const highlight = variant === 'custom' ? highlightLog : variant === 'none' ? null : undefined
  return (
    <div className="mx-auto h-36 w-full max-w-2xl overflow-hidden rounded-card border border-border">
      <CodeViewer lines={LINES} highlight={highlight} aria-label="server.log" />
    </div>
  )
}
