import { useRef } from 'react'
import { IndexBar, type IndexBarItem } from '@/components/ui/index-bar'
import { cn } from '@/lib/utils'

const turns = [
  { id: 101, who: 'You', text: 'The nightly build went from 4 minutes to 11 overnight.' },
  { id: 102, who: 'Assistant', text: 'Two things changed: the cache key now includes the lockfile hash, and the test step runs serially.' },
  { id: 103, who: 'You', text: 'Why is the cache key changing on every run?' },
  { id: 104, who: 'Assistant', text: 'The hash includes a generated timestamp line. Strip it before hashing.' },
  { id: 105, who: 'You', text: 'That fixed the cache. Tests are still slow.' },
  { id: 106, who: 'Assistant', text: 'Re-enable the shard matrix; it was commented out in the same commit.' },
  { id: 107, who: 'You', text: 'Back to 4 minutes. Thanks.' },
]

// Custom stops: `key` is handed back to onJump untouched (a number here),
// `label` prints on the rail (leave it out for a dot), `caption` names the
// stop for screen readers and heads the bubble, `preview` is what the bubble
// shows while you hover or scrub. `dim` only softens a stop; it stays
// reachable.
const stops: IndexBarItem<number>[] = turns.map((t, i) => ({
  key: t.id,
  label: i % 3 === 0 ? String(i + 1) : undefined,
  caption: t.who,
  preview: t.text,
  dim: t.who === 'Assistant',
}))

export default function Turns() {
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useRef<Record<number, HTMLDivElement | null>>({})
  return (
    <div className="relative mx-auto h-[400px] max-w-md overflow-hidden rounded-card bg-card shadow-hairline">
      <div ref={scroller} className="absolute inset-0 grid content-start gap-3 overflow-y-auto py-4 pr-10 pl-4">
        {turns.map((t) => (
          <div
            key={t.id}
            ref={(el) => {
              rows.current[t.id] = el
            }}
            className="grid pb-16"
          >
            <div
              className={cn(
                'max-w-[85%] rounded-card px-3.5 py-2.5 text-subhead',
                t.who === 'You'
                  ? 'justify-self-end bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground',
              )}
            >
              {t.text}
            </div>
          </div>
        ))}
      </div>
      <IndexBar
        label="Jump to turn"
        items={stops}
        top={12}
        bottom={12}
        onJump={(id) => {
          const el = rows.current[id]
          if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 16
        }}
      />
    </div>
  )
}
