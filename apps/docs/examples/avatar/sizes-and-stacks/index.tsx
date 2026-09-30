import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const TOTAL = 11
const PEOPLE = [
  { f: 'Amelia', l: 'Adler' },
  { f: 'Wei', l: 'Chen' },
  { f: 'Chidi', l: 'Okafor' },
  { f: 'Hana', l: 'Sato' },
  { f: 'June', l: 'Calloway' },
]

// The colour is hashed from the name, so a person keeps theirs everywhere.
// `size` is px; the initials scale with it.
export default function SizesAndStacks() {
  const shown = PEOPLE.slice(0, 4)
  return (
    <div className="mx-auto grid max-w-md gap-6 p-2">
      <div className="flex items-end gap-4">
        {[24, 34, 40, 56, 92].map((s) => (
          <Avatar key={s} c={{ f: 'Wei', l: 'Chen' }} size={s} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {PEOPLE.map((c) => (
          <Avatar key={c.f} c={c} />
        ))}
      </div>

      {/* A stack: overlap with negative margin and ring each avatar in the surface colour. */}
      <div className="flex items-center gap-3">
        <div role="img" aria-label="Amelia, Wei, Chidi and Hana" className="flex">
          {shown.map((c, i) => (
            <Avatar key={c.f} c={c} size={34} className={cn('ring-2 ring-background', i > 0 && '-ml-2.5')} />
          ))}
          <span className="-ml-2.5 grid size-[34px] place-items-center rounded-full bg-secondary text-footnote font-semibold text-secondary-foreground ring-2 ring-background">
            +{TOTAL - shown.length}
          </span>
        </div>
        <span className="text-subhead text-muted-foreground">{TOTAL} people in this thread</span>
      </div>

      {/* A presence dot, positioned over the corner of a relative wrapper. */}
      <div className="flex items-center gap-3">
        <span className="relative">
          <Avatar c={{ f: 'June', l: 'Calloway' }} size={44} />
          <span className="absolute right-0 bottom-0 size-3 rounded-full bg-success ring-2 ring-background" />
        </span>
        <div className="grid">
          <span className="text-body text-foreground">June Calloway</span>
          <span className="text-footnote text-muted-foreground">Active now</span>
        </div>
      </div>
    </div>
  )
}
