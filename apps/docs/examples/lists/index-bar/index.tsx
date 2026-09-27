import { useRef, type CSSProperties, type ReactNode } from 'react'
import { IndexBar, List, ListRow, ListSection } from '@brett_lamy/ui'

const turns = [
  { id: 'q1', role: 'user', text: 'Why is the workbench build slow after the docs split?' },
  {
    id: 'a1',
    role: 'assistant',
    text: 'Two things: the docs registry re-transpiles on every nav, and the playground boots almost-node eagerly.',
  },
  { id: 'q2', role: 'user', text: 'Can we cache the transpile per page?' },
  {
    id: 'a2',
    role: 'assistant',
    text: 'Yes — key the cache by page id and keep it on window so navigation is free.',
  },
  {
    id: 'q3',
    role: 'user',
    text: 'What about the terminal dock — is it doing layout work while hidden?',
  },
  {
    id: 'a3',
    role: 'assistant',
    text: 'It was. It now unmounts below the compact breakpoint and lives in the SnapSheet instead.',
  },
  { id: 'q4', role: 'user', text: 'Ship it, then add the jump rail to the thread view.' },
  {
    id: 'a4',
    role: 'assistant',
    text: 'Done. The rail takes arbitrary stops, so each user turn becomes one dot with its text as the preview.',
  },
]

// One stop per user turn; the preview fills the hover bubble
const stops = turns
  .filter((t) => t.role === 'user')
  .map((t) => ({ key: t.id, preview: t.text, caption: 'You' }))
const waveStops = turns.map((t) => ({
  key: t.id,
  preview: t.text,
  caption: t.role === 'user' ? 'You' : 'Assistant',
}))

const contacts: Record<string, string[]> = {
  A: ['Ada', 'Avi'],
  B: ['Bea', 'Ben'],
  C: ['Cal', 'Cy'],
  D: ['Dot', 'Dev'],
  E: ['Eli', 'Eva'],
  F: ['Fay'],
  G: ['Gus', 'Gia'],
}
const letters = Object.keys(contacts)

const hints: Record<string, string> = {
  stops: 'Hover a dot to peek the turn · drag to scrub with a tick per stop',
  wave: 'variant="wave" side="left" · the dashes swell under the pointer, one tick per turn',
  az: 'No items → the A–Z rail, unchanged',
}

// A fixed-height, rounded host the scroller and rail sit in
function Frame({ h, bg, children }: { h: number; bg: string; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        height: h,
        borderRadius: 12,
        overflow: 'hidden',
        background: bg,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)',
      }}
    >
      {children}
    </div>
  )
}

export default function IndexBarExample({ variant = 'stops' }: { variant?: string }) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const rows = useRef<Record<string, HTMLElement>>({})
  const jump = (key: string) => {
    const row = rows.current[key]
    if (row && scroller.current) scroller.current.scrollTop = Math.max(0, row.offsetTop - 8)
  }
  const track = (key: string) => (el: HTMLElement | null) => {
    if (el) rows.current[key] = el
  }
  return (
    <div>
      <Frame h={340} bg="var(--bl-bg)">
        <div
          ref={scroller}
          style={
            variant === 'wave'
              ? { position: 'absolute', inset: 0, overflowY: 'auto', paddingLeft: 40 }
              : { position: 'absolute', inset: 0, overflowY: 'auto', paddingRight: 26 }
          }
        >
          {variant === 'az' ? (
            <List>
              {letters.map((letter) => (
                <div key={letter} ref={track(letter)}>
                  <ListSection title={letter} sticky>
                    {contacts[letter].map((name, i) => (
                      <ListRow
                        key={name}
                        title={name}
                        divider={i < contacts[letter].length - 1}
                      />
                    ))}
                  </ListSection>
                </div>
              ))}
            </List>
          ) : (
            <div
              style={{
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {turns.map((t) => (
                <div
                  key={t.id}
                  ref={track(t.id)}
                  style={{
                    display: 'flex',
                    justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={
                      {
                        maxWidth: '80%',
                        padding: '9px 13px',
                        borderRadius: 16,
                        fontSize: 13.5,
                        lineHeight: 1.4,
                        textWrap: 'pretty',
                        background: t.role === 'user' ? 'var(--bl-tint)' : 'var(--bl-card)',
                        color: t.role === 'user' ? '#fff' : 'var(--bl-label)',
                        boxShadow: t.role === 'user' ? 'none' : '0 0 0 1px var(--bl-sep)',
                      } as CSSProperties
                    }
                  >
                    {t.text}
                  </div>
                </div>
              ))}
              <div style={{ height: 120 }} />
            </div>
          )}
        </div>
        {variant === 'az' ? (
          // No items: the UIKit A–Z rail
          <IndexBar avail={new Set(letters)} top={8} bottom={8} onLetter={jump} />
        ) : variant === 'wave' ? (
          // Dashes that swell under the pointer, with a title + preview card
          <IndexBar
            variant="wave"
            side="left"
            items={waveStops}
            top={10}
            bottom={10}
            onJump={jump}
            label="Jump to a turn"
          />
        ) : (
          // No label on a stop: it renders as a dot
          <IndexBar
            items={stops}
            top={10}
            bottom={10}
            onJump={jump}
            label="Jump to a turn"
          />
        )}
      </Frame>
      <div
        style={{
          fontSize: 12,
          color: 'var(--bl-label2)',
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        {hints[variant] ?? hints.az}
      </div>
    </div>
  )
}
