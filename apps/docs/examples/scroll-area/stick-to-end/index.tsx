import { useEffect, useState } from 'react'
import {
  ScrollArea, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaScrollToEnd, ScrollAreaViewport,
} from '@/components/ui/scroll-area'

const STEPS = ['resolve', 'compile', 'bundle', 'typecheck', 'test', 'upload']

export default function StickToEnd() {
  const [lines, setLines] = useState(() => Array.from({ length: 12 }, (_, i) => i))
  useEffect(() => {
    const id = setInterval(() => setLines((l) => (l.length > 400 ? l : [...l, l.length])), 900)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-card bg-card shadow-hairline">
      <ScrollArea stickToEnd className="h-64">
        <ScrollAreaViewport
          role="log"
          aria-label="Build output"
          className={[
            'data-overflow-y:[mask-image:linear-gradient(to_bottom,transparent,black_var(--fade-top,0px),black_calc(100%-var(--fade-bottom,0px)),transparent)]',
            'data-overflow-y:not-data-at-y-start:[--fade-top:24px] data-overflow-y:not-data-at-y-end:[--fade-bottom:24px]',
          ].join(' ')}
        >
          <ScrollAreaContent className="py-2 font-mono text-caption">
            {lines.map((n) => (
              <div key={n} className="px-4 py-0.5 text-foreground">
                <span className="text-muted-foreground">{String(n).padStart(3, '0')}</span> {STEPS[n % STEPS.length]} done
              </div>
            ))}
          </ScrollAreaContent>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar />
        <ScrollAreaScrollToEnd>Jump to latest</ScrollAreaScrollToEnd>
      </ScrollArea>
    </div>
  )
}
