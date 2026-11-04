import { CodeEditor } from '@/components/ui/code-editor'

const source = `import { useEffect, useState } from 'react'

/** Poll a URL every \`ms\` milliseconds. */
export function usePoll<T>(url: string, ms = 5_000): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const tick = async () => {
      const res = await fetch(url)
      if (live && res.ok) setData(await res.json())
    }
    void tick()
    const id = setInterval(tick, ms)
    return () => { live = false; clearInterval(id) }
  }, [url, ms])
  return data
}
`

// Type, paste, undo, select: it's an editor, and nothing here says so, because that's the default.
export default function Editable() {
  return (
    <div className="mx-auto h-96 w-full max-w-2xl">
      <CodeEditor defaultValue={source} language="ts" title="use-poll.ts" showCopy />
    </div>
  )
}
