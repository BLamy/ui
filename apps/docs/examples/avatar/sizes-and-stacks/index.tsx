import { Avatar, AvatarGroup } from '@/components/ui/avatar'

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

      {/* A stack: AvatarGroup overlaps, rings and counts them; press it for a menu of everyone. */}
      <div className="flex items-center gap-3">
        <AvatarGroup size={34} max={4} label={`${TOTAL} people in this thread`}>
          {[...PEOPLE, ...Array.from({ length: TOTAL - PEOPLE.length }, (_, i) => ({ f: 'Guest', l: String(i + 1) }))].map((c) => (
            <Avatar key={c.f + c.l} c={c} />
          ))}
        </AvatarGroup>
        <span className="text-subhead text-foreground/70">{TOTAL} people in this thread</span>
      </div>

      {/* A presence dot, ringed in the surface colour. */}
      <div className="flex items-center gap-3">
        <Avatar c={{ f: 'June', l: 'Calloway' }} size={44} status="online" />
        <div className="grid">
          <span className="text-body text-foreground">June Calloway</span>
          <span className="text-footnote text-foreground/70">Active now</span>
        </div>
      </div>
    </div>
  )
}
