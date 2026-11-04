import { CodeEditor } from '@/components/ui/code-editor'
import { splitCodeLines } from '@/lib/code-editor'

const SOURCE = `import { useEffect, useState } from 'react'

/* Poll a URL every \`ms\` milliseconds,
   and hand back the latest answer. */
export function usePoll(url, ms = 5_000) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let live = true
    const tick = async () => {
      const res = await fetch(url)
      if (live && res.ok) setData(await res.json())
    }
    void tick()
    const id = setInterval(tick, ms)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [url, ms])
  return data // null until the first answer, which can take a while on a slow connection, so check for it where you use it
}
`

const LINES = splitCodeLines(SOURCE)

// Drag to select, double click for a word, three clicks for a line. Copying gets the
// code without the line numbers. The long line scrolls sideways, and the numbers stay.
export default function Basic() {
  return (
    <div className="mx-auto h-80 w-full max-w-2xl overflow-hidden rounded-card border border-border">
      <CodeEditor readOnly variant="ghost" lines={LINES} aria-label="use-poll.js" />
    </div>
  )
}
