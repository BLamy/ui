import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { AvatarGroup } from '@/components/ui/avatar-group'

const PEOPLE = ['Ada', 'Miles', 'Noor', 'Theo', 'Hana', 'Chidi', 'June', 'Ezra', 'Lin', 'Amelia', 'Wei', 'Anya', 'Sam', 'Priya', 'Omar']
const TINTS = ['#0A84FF', '#BF5AF2', '#FF9F0A', '#32D74B', '#5E5CE6', '#FF375F']

// A plain stack by default; past `max` (5) the rest fold into a "+N" bubble.
// With `menu` the stack is one button that lists everyone, and `onAction`
// receives the chosen avatar's key.
export default function Group() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="mx-auto grid max-w-md gap-6 p-2">
      <AvatarGroup menu aria-label="Everyone" onAction={(name) => setPicked(name)}>
        {PEOPLE.map((name, i) => (
          <Avatar key={name} name={name} tint={TINTS[i % TINTS.length]} />
        ))}
      </AvatarGroup>

      <div className="flex items-center gap-4">
        <AvatarGroup size={24} max={3} aria-label="Owners">
          {PEOPLE.slice(0, 3).map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
        <AvatarGroup size={44} max={4} overlap={14} aria-label="Team">
          {PEOPLE.slice(0, 7).map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
        <AvatarGroup aria-label="Reviewers" size={28} max={2}>
          {PEOPLE.slice(0, 4).map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
      </div>

      <p className="text-subhead text-foreground/70">{picked ? `You picked ${picked}.` : 'Press the first stack to see everyone.'}</p>
    </div>
  )
}
