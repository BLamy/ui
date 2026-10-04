import { useState } from 'react'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'

const PEOPLE = ['Ada', 'Miles', 'Noor', 'Theo', 'Hana', 'Chidi', 'June', 'Ezra', 'Lin', 'Amelia', 'Wei', 'Anya', 'Sam', 'Priya', 'Omar']
const COLORS = ['#0A84FF', '#BF5AF2', '#FF9F0A', '#32D74B', '#5E5CE6', '#FF375F']

// Past `max` (5 by default) the rest fold into a "+N" bubble. Pressing the group opens a menu of everyone.
export default function Group() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <div className="mx-auto grid max-w-md gap-6 p-2">
      <AvatarGroup onSelect={(i) => setPicked(PEOPLE[i])}>
        {PEOPLE.map((name, i) => (
          <Avatar key={name} name={name} color={COLORS[i % COLORS.length]} />
        ))}
      </AvatarGroup>

      <div className="flex items-center gap-4">
        <AvatarGroup size={24} max={3}>
          {PEOPLE.slice(0, 3).map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
        <AvatarGroup size={44} max={4} overlap={14}>
          {PEOPLE.slice(0, 7).map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
        {/* menu={false}: a plain, non-interactive stack */}
        <AvatarGroup menu={false} label="Reviewers" size={28} max={2}>
          {PEOPLE.slice(0, 4).map((name) => (
            <Avatar key={name} name={name} />
          ))}
        </AvatarGroup>
      </div>

      <p className="text-subhead text-foreground/70">{picked ? `You picked ${picked}.` : 'Press a stack to see everyone.'}</p>
    </div>
  )
}
