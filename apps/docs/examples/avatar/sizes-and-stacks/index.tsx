import { Avatar } from '@/components/ui/avatar'
import { AvatarGroup } from '@/components/ui/avatar-group'

const TOTAL = 11
const PEOPLE = ['Amelia Adler', 'Wei Chen', 'Chidi Okafor', 'Hana Sato', 'June Calloway']

// The colour is hashed from the name, so a person keeps theirs everywhere.
// `size` is px; the initials scale with it.
export default function SizesAndStacks() {
  return (
    <div className="mx-auto grid max-w-md gap-6 p-2">
      <div className="flex items-end gap-4">
        {[24, 34, 40, 56, 92].map((s) => (
          <Avatar key={s} name="Wei Chen" size={s} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {PEOPLE.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </div>

      {/* A stack: AvatarGroup overlaps, rings and counts them; with `menu`, press it for everyone. */}
      <div className="flex items-center gap-3">
        <AvatarGroup menu size={34} max={4} label={`${TOTAL} people in this thread`}>
          {[...PEOPLE, ...Array.from({ length: TOTAL - PEOPLE.length }, (_, i) => `Guest ${i + 1}`)].map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
        <span className="text-subhead text-foreground/70">{TOTAL} people in this thread</span>
      </div>

      {/* A presence dot, ringed in the surface colour. The name is beside it, so the avatar is aria-hidden. */}
      <div className="flex items-center gap-3">
        <Avatar name="June Calloway" size={44} status="online" aria-hidden />
        <div className="grid">
          <span className="text-body text-foreground">June Calloway</span>
          <span className="text-footnote text-foreground/70">Active now</span>
        </div>
      </div>
    </div>
  )
}
