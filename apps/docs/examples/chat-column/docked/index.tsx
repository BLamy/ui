import { useState } from 'react'
import { ChatColumn, ChatColumnComposer, ChatColumnTranscript } from '@/components/ui/chat-column'
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer'
import { ThemeScope } from '@/lib/theme'

interface Line {
  who: 'You' | 'BL UI'
  text: string
}

const START: Line[] = [
  { who: 'You', text: 'Which region moved the most against last month?' },
  { who: 'BL UI', text: 'Northeast, up 6.1 points. I highlighted it in the chart.' },
]

// ChatColumn is only the frame: a bordered, card-coloured column. The
// transcript takes the remaining height and scrolls; the composer is pinned
// under it. Everything in them is yours.
export default function Docked() {
  const [lines, setLines] = useState<Line[]>(START)
  const send = (text: string) => {
    if (!text) return
    setLines((l) => [
      ...l,
      { who: 'You', text },
      { who: 'BL UI', text: 'Noted. I will check that and update the chart.' },
    ])
  }
  return (
    <div className="flex h-[440px] overflow-hidden rounded-card border border-border bg-background text-foreground">
      <ChatColumn className="w-[320px] shrink-0">
        <ChatColumnTranscript className="overflow-y-auto">
          <ul className="m-0 flex min-h-full list-none flex-col justify-end gap-3.5 p-[18px]">
            {lines.map((l, i) => (
              <li key={i}>
                <div className={l.who === 'You' ? 'text-caption font-bold text-muted-foreground' : 'text-caption font-bold text-primary'}>
                  {l.who}
                </div>
                <div className="mt-0.5 text-detail leading-[1.5]">{l.text}</div>
              </li>
            ))}
          </ul>
        </ChatColumnTranscript>
        <ChatColumnComposer className="p-2">
          <ThemeScope scope="glass" className="min-w-0">
            <Composer onSubmit={send}>
              <ComposerCard>
                <ComposerInput placeholder="Reply…" />
                <ComposerFooter>
                  <ComposerSpacer />
                  <ComposerSend />
                </ComposerFooter>
              </ComposerCard>
            </Composer>
          </ThemeScope>
        </ChatColumnComposer>
      </ChatColumn>
      <div className="grid min-w-0 flex-1 place-items-center p-6">
        <div className="flex h-44 w-full max-w-[280px] items-end gap-3 rounded-card border border-border bg-card p-4">
          {[55, 92, 68, 44, 78].map((h, i) => (
            <div key={i} className={i === 1 ? 'flex-1 rounded-t-md bg-primary' : 'flex-1 rounded-t-md bg-secondary-strong'} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
