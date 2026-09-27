import { useRef, type ReactNode } from 'react'
import { IndexBar, List, ListRow, ListSection } from '@brett_lamy/ui'

const people = [
  'Ada Lovelace',
  'Alan Turing',
  'Barbara Liskov',
  'Bjarne Stroustrup',
  'Claude Shannon',
  'Donald Knuth',
  'Edsger Dijkstra',
  'Frances Allen',
  'Grace Hopper',
  'Guido van Rossum',
  'Hedy Lamarr',
  'John McCarthy',
  'Katherine Johnson',
  'Ken Thompson',
  'Linus Torvalds',
  'Margaret Hamilton',
]
const byLetter: Record<string, string[]> = {}
for (const name of people) {
  const letter = name.split(' ').pop()![0] // by last name
  byLetter[letter] = [...(byLetter[letter] ?? []), name]
}
const letters = Object.keys(byLetter).sort()

function ContactsList() {
  const scroller = useRef<HTMLDivElement>(null)
  const sections = useRef<Record<string, HTMLDivElement | null>>({})
  const jump = (letter: string) => {
    const el = sections.current[letter]
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop
  }
  return (
    <div style={{ position: 'relative', height: 400, background: 'var(--bl-card)' }}>
      <div
        ref={scroller}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingRight: 22 }}
      >
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
              {byLetter[letter].map((name, i) => {
                const [f, ...rest] = name.split(' ')
                return (
                  <ListRow
                    key={name}
                    title={
                      <>
                        <span>{f} </span>
                        <strong>{rest.join(' ')}</strong>
                      </>
                    }
                    divider={i < byLetter[letter].length - 1}
                    onPress={() => {}}
                  />
                )
              })}
            </ListSection>
          ))}
        </List>
      </div>
      <IndexBar avail={new Set(letters)} onLetter={jump} top={8} bottom={8} />
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it, centered.
function Window({
  width,
  bg = 'var(--bl-bg)',
  children,
}: {
  width?: number
  bg?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function Contacts() {
  return (
    <Window width={430}>
      <ContactsList />
    </Window>
  )
}
