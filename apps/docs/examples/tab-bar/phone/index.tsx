import { useEffect, useRef, useState } from 'react'
import { TabBar, type TabBarItem } from '@/components/ui/tab-bar'
import { chromeStore } from '@/lib/theme'

const items: TabBarItem[] = [
  { id: 'favorites', title: 'Favorites', icon: 'star' },
  { id: 'recents', title: 'Recents', icon: 'clock' },
  { id: 'contacts', title: 'Contacts', icon: 'person' },
  { id: 'voicemail', title: 'Voicemail', icon: 'wave' },
]

const calls = [
  'Maya Lindqvist', 'Jonas Ito', 'Priya Raman', 'Leo Okafor', 'Noor Haddad',
  'Theo Marsh', 'Ines Duarte', 'Sam Whitlock', 'Aiko Tanabe', 'Omar Khalil',
  'Freya Nilsen', 'Diego Ramos',
]

// A TabBar is only the bar: it is absolutely positioned at the bottom of the
// nearest positioned ancestor, and you render the screen behind it. Scrolling
// down hides it — the screen publishes that through `chromeStore` (a
// NavigationStack page does this for you) — and scrolling up brings it back.
export default function Phone() {
  const [tab, setTab] = useState('recents')
  const last = useRef(0)
  useEffect(() => () => chromeStore.set(false), [])
  const title = items.find((i) => i.id === tab)?.title
  return (
    <div className="relative mx-auto h-[440px] max-w-sm overflow-hidden rounded-card bg-background shadow-hairline">
      <div
        className="absolute inset-0 overflow-y-auto pb-20"
        onScroll={(e) => {
          const y = e.currentTarget.scrollTop
          const dy = y - last.current
          last.current = y
          if (y < 40 || dy < -5) chromeStore.set(false)
          else if (dy > 5) chromeStore.set(true)
        }}
      >
        <h2 className="m-0 px-5 pt-5 pb-3 text-title font-bold">{title}</h2>
        {tab === 'recents' ? (
          <ul className="m-0 list-none p-0">
            {calls.map((name, i) => (
              <li
                key={name}
                className="flex items-baseline justify-between px-5 py-3 shadow-hairline-b"
              >
                <span className={i % 4 === 1 ? 'text-destructive' : 'text-foreground'}>
                  {name}
                </span>
                <span className="text-footnote text-muted-foreground">
                  {i < 3 ? `${9 - i}:41 AM` : 'Yesterday'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 px-5 py-10 text-center text-muted-foreground">
            Nothing in {title} yet.
          </p>
        )}
      </div>
      <TabBar items={items} selected={tab} onSelect={setTab} />
    </div>
  )
}
