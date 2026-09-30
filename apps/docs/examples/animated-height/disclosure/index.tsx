import { useState } from 'react'
import { AnimatedHeight } from '@/components/ui/animated-height'
import { Button } from '@/components/ui/button'

const rows = ['Build cache restored', 'Dependencies installed', 'Type check passed', 'Bundle size: 184 kB', 'Deployed to preview']

// AnimatedHeight follows whatever its content does, so nothing has to be
// told the new height: a ResizeObserver feeds it. Here the log grows by a row
// at a time, then collapses back.
export default function Disclosure() {
  const [count, setCount] = useState(2)
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <AnimatedHeight className="rounded-card bg-card shadow-hairline">
        <ul className="m-0 list-none p-2">
          {rows.slice(0, count).map((r) => (
            <li key={r} className="rounded-ctl px-3 py-2 text-subhead">
              {r}
            </li>
          ))}
        </ul>
      </AnimatedHeight>
      <p className="text-footnote text-muted-foreground">The content below the tray moves with it.</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          isDisabled={count >= rows.length}
          onPress={() => setCount((c) => c + 1)}
        >
          Add row
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={count <= 1}
          onPress={() => setCount((c) => c - 1)}
        >
          Remove row
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setCount(2)}>
          Reset
        </Button>
      </div>
    </div>
  )
}
