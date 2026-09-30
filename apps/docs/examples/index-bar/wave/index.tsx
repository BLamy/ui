import { useRef, useState } from 'react'
import { IndexBar, type IndexBarItem } from '@/components/ui/index-bar'

const sections = [
  { id: 'overview', title: 'Overview', level: 1 },
  { id: 'install', title: 'Installation', level: 1 },
  { id: 'cli', title: 'Command line', level: 2 },
  { id: 'npm', title: 'npm package', level: 2 },
  { id: 'usage', title: 'Usage', level: 1 },
  { id: 'props', title: 'Props', level: 2 },
  { id: 'theming', title: 'Theming', level: 2 },
  { id: 'faq', title: 'FAQ', level: 1 },
]

const stops: IndexBarItem<string>[] = sections.map((s) => ({
  key: s.id,
  caption: s.title,
  level: s.level,
}))

// `variant="wave"` draws a dash per stop that swells around the pointer, like
// the macOS Dock. `panel` swaps the single-stop card for an outline of every
// stop (`level` indents nested ones), and `value` marks the section in view.
export default function Wave() {
  const scroller = useRef<HTMLDivElement>(null)
  const heads = useRef<Record<string, HTMLElement | null>>({})
  const [current, setCurrent] = useState('overview')
  return (
    <div className="relative mx-auto h-[420px] max-w-lg overflow-hidden rounded-card bg-card shadow-hairline">
      <div
        ref={scroller}
        className="absolute inset-0 overflow-y-auto py-5 pr-6 pl-14"
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop + 40
          let id = sections[0].id
          for (const s of sections) {
            if ((heads.current[s.id]?.offsetTop ?? Infinity) <= top) id = s.id
          }
          setCurrent(id)
        }}
      >
        {sections.map((s) => (
          <section
            key={s.id}
            ref={(el) => {
              heads.current[s.id] = el
            }}
            className="pb-16"
          >
            {s.level === 1 ? (
              <h2 className="m-0 text-title font-bold">{s.title}</h2>
            ) : (
              <h3 className="m-0 text-body font-semibold">{s.title}</h3>
            )}
            <p className="mt-2 text-subhead text-muted-foreground">
              Notes for the {s.title.toLowerCase()} section. Scroll, or hover the
              dashes on the left and pick a heading from the outline.
            </p>
          </section>
        ))}
      </div>
      <IndexBar
        variant="wave"
        side="left"
        panel
        panelTitle="On this page"
        label="Sections"
        items={stops}
        value={current}
        top={16}
        bottom={16}
        onJump={(id) => {
          const el = heads.current[id]
          if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 12
        }}
      />
    </div>
  )
}
