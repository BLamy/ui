import { useRef, useState } from 'react'
import { FloatingChat } from '@/components/ui/floating-chat'
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer'
import { Segmented } from '@/components/ui/segmented'

const THREAD = [
  ['You', 'Summarise what changed in the last release.'],
  ['BL UI', 'Three things: the floating chat surface, a tile map, and the docs restructure.'],
  ['You', 'Which one needs a follow-up?'],
  ['BL UI', 'The map. Attribution and a light tile set are still open.'],
]

function Transcript() {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-[18px] pt-[18px] pb-3">
      {THREAD.map(([who, text], i) => (
        // The newest lines hug the composer, so they are what a `peek` would show while closed.
        <div key={text} className={i === 0 ? 'mt-auto mb-4' : 'mb-4'}>
          <div className={i % 2 ? 'mb-1 text-caption font-bold text-primary' : 'mb-1 text-caption font-bold'}>{who}</div>
          <div className="text-detail leading-[1.5]">{text}</div>
        </div>
      ))}
    </div>
  )
}

// The host is any positioned, sized element. FloatingChat fills it with a
// pointer-transparent layer, so the page behind stays scrollable; scrolling it
// down slides the composer away (hideOnScroll) and up brings it back.
export default function OverAPage() {
  const scroller = useRef<HTMLDivElement>(null)
  const [appearance, setAppearance] = useState<'glass' | 'sheet'>('glass')
  return (
    <div className="mx-auto grid max-w-[460px] gap-3">
      <Segmented
        aria-label="Appearance"
        value={appearance}
        onChange={(v) => setAppearance(v as 'glass' | 'sheet')}
        options={[
          { id: 'glass', label: 'Glass' },
          { id: 'sheet', label: 'Sheet' },
        ]}
      />
      <div className="relative h-[520px] overflow-hidden rounded-card border border-border bg-background text-foreground">
        <div ref={scroller} className="absolute inset-0 overflow-y-auto p-5 pb-40">
          <h3 className="m-0 mb-4 text-title font-bold">Release notes</h3>
          {['Floating chat', 'Tile map', 'Docs restructure', 'Token scales', 'Registry', 'Dark mode fixes', 'Theme scopes'].map((t, i) => (
            <div key={t} className="mb-3 rounded-card bg-secondary p-4">
              <div className="text-subhead font-semibold">{t}</div>
              <div className="mt-1 text-footnote text-muted-foreground">Change {i + 1} in this release. Scroll the page: the chat steps aside.</div>
            </div>
          ))}
        </div>
        <FloatingChat appearance={appearance} scrollRef={scroller} label="Release chat">
          <FloatingChat.Chat>
            <Transcript />
          </FloatingChat.Chat>
          <FloatingChat.Composer>
            <Composer>
              <ComposerCard>
                <ComposerInput placeholder="Ask about this page" />
                <ComposerFooter>
                  <ComposerSpacer />
                  <ComposerSend />
                </ComposerFooter>
              </ComposerCard>
            </Composer>
          </FloatingChat.Composer>
        </FloatingChat>
      </div>
      <p className="m-0 text-center text-footnote text-muted-foreground">
        Drag the grip up to open the transcript, down past rest to fold it into the button.
      </p>
    </div>
  )
}
