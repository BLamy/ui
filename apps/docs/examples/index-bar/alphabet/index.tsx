import { useRef } from 'react'
import { IndexBar } from '@/components/ui/index-bar'
import { List, ListRow, ListSection } from '@/components/ui/list'

const people = [
  'Aiko Tanabe', 'Amara Nwosu', 'Bruno Carvalho', 'Chloe Martin', 'Dev Patel',
  'Elena Petrova', 'Emeka Obi', 'Farah Haddad', 'Gustav Holm', 'Hana Kim',
  'Ines Duarte', 'Jonas Ito', 'Kofi Mensah', 'Leo Okafor', 'Maya Lindqvist',
  'Noor Haddad', 'Omar Khalil', 'Priya Raman', 'Sam Whitlock', 'Theo Marsh',
  'Uma Iyer', 'Yuki Sato',
]

const byLetter: Record<string, string[]> = {}
for (const name of people) byLetter[name[0]] = [...(byLetter[name[0]] ?? []), name]
const letters = Object.keys(byLetter)

// With no `items`, IndexBar is the UIKit A–Z rail. `avail` says which letters
// have a section — the rest are dimmed but still reachable — and `onLetter`
// fires as the pointer (or the arrow keys) crosses a letter. Hover shows the
// letter without jumping; press and drag to scrub.
export default function Alphabet() {
  const scroller = useRef<HTMLDivElement>(null)
  const sections = useRef<Record<string, HTMLDivElement | null>>({})
  return (
    <div className="relative mx-auto h-[420px] max-w-sm overflow-hidden rounded-card bg-card shadow-hairline">
      <div ref={scroller} className="absolute inset-0 overflow-y-auto">
        <List>
          {letters.map((letter) => (
            <ListSection
              key={letter}
              title={letter}
              sticky
              innerRef={(el) => {
                sections.current[letter] = el
              }}
            >
              {byLetter[letter].map((name, i) => (
                <ListRow
                  key={name}
                  title={name}
                  accessory="chevron"
                  divider={i < byLetter[letter].length - 1}
                  onPress={() => {}}
                />
              ))}
            </ListSection>
          ))}
        </List>
      </div>
      <IndexBar
        label="Jump to letter"
        avail={new Set(letters)}
        top={8}
        bottom={8}
        onLetter={(letter) => {
          const el = sections.current[letter]
          if (el && scroller.current) scroller.current.scrollTop = el.offsetTop
        }}
      />
    </div>
  )
}
