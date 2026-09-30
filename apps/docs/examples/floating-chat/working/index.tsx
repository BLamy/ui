import { useEffect, useRef, useState } from 'react'
import { FloatingChat, useFloatingChat } from '@/components/ui/floating-chat'
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer'

// Reads the chat's live state from inside its transcript.
function Readout() {
  const { open, progress, composing, minimized } = useFloatingChat()
  return (
    <dl className="m-0 grid h-full grid-cols-[6rem_1fr] content-end gap-x-4 gap-y-1 p-[18px] text-footnote tabular-nums">
      {(
        [
          ['open', String(open)],
          ['progress', progress.toFixed(2)],
          ['composing', String(composing)],
          ['minimized', String(minimized)],
        ] as const
      ).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="m-0 font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// While the agent works, the composer card collapses into a tappable status.
// Tapping it (onAdd) or dragging the chat open brings the composer back. The
// reply here finishes after three seconds on its own.
export default function Working() {
  const [working, setWorking] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const start = () => {
    setWorking(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setWorking(false), 3000)
  }
  return (
    <div className="mx-auto max-w-[460px]">
      <div className="relative h-[460px] overflow-hidden rounded-card border border-border bg-background text-foreground">
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-footnote text-muted-foreground">
          Send a message: the card becomes a status pill for three seconds.
        </div>
        <FloatingChat
          working={working}
          workingLabel="Updating the dashboard…"
          onAdd={() => setWorking(false)}
          peek={88}
          fabPosition="bottom-right"
          hideOnScroll={false}
        >
          <FloatingChat.Chat>
            <Readout />
          </FloatingChat.Chat>
          <FloatingChat.Composer>
            <Composer onSubmit={start} streaming={working}>
              <ComposerCard>
                <ComposerInput placeholder="Ask for a change" />
                <ComposerFooter>
                  <ComposerSpacer />
                  <ComposerSend />
                </ComposerFooter>
              </ComposerCard>
            </Composer>
          </FloatingChat.Composer>
        </FloatingChat>
      </div>
    </div>
  )
}
