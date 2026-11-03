import { useState } from 'react'
import { CodeViewer } from '@/components/ui/code-viewer'
import { Switch } from '@/components/ui/switch'
import { splitCodeLines } from '@/lib/code-viewer'

const LINES = splitCodeLines(`export function formatTitle(todo, width = 40) {
  const mark = todo.done ? '[x]' : '[ ]';
  const title = \`\${mark} \${todo.text}\`;
  return title.length > width ? title.slice(0, width - 1) + '…' : title.padEnd(width, ' ');
}

store.dispatch({ type: ADD_TODO, text: 'Scrub back to the render that dropped a row, and find out which action it was' });`)

// Phone width. With wrapping off the code scrolls sideways behind the gutter. With it on,
// a line takes as many rows as it needs, and only its first has a line number.
export default function Wrapping() {
  const [wrap, setWrap] = useState(false)
  return (
    <div className="mx-auto w-[390px] max-w-full">
      <label className="mb-2 flex items-center gap-2 text-footnote text-foreground">
        <Switch checked={wrap} onChange={setWrap} aria-label="Wrap" />
        Wrap
      </label>
      <div className="h-56 overflow-hidden rounded-card border border-border">
        <CodeViewer lines={LINES} wrap={wrap} aria-label="titles.js" />
      </div>
    </div>
  )
}
