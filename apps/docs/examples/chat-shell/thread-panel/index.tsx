import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer'
import { Icon } from '@/lib/icon'
import { ChatShell, ChatShellDescription, ChatShellFooter, ChatShellHeader, ChatShellHeaderIcon, ChatShellMain, ChatShellPanel, ChatShellTitle } from '@/components/blocks/discord-clone/components/chat-shell'

type Person = { f: string; l: string; bot?: boolean }

const team: Record<string, Person> = {
  noor: { f: 'Noor', l: 'Haddad' },
  theo: { f: 'Theo', l: 'Marsh' },
  bot: { f: 'Stitch', l: 'Bot', bot: true },
}

// One transcript row: avatar, name (+ an APP tag for bots) and time, text.
function Line({
  who,
  time,
  children,
}: {
  who: Person
  time: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 px-4 py-1.5">
      <Avatar c={who} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-semibold text-foreground">
            {who.f}
          </span>
          {who.bot && (
            <span className="rounded-[4px] bg-primary px-1 text-[9.5px] font-bold text-primary-foreground">
              APP
            </span>
          )}
          <span className="text-[11px] text-tertiary-foreground">{time}</span>
        </div>
        <div className="text-[13.5px] leading-normal text-foreground">
          {children}
        </div>
      </div>
    </div>
  )
}

function Reply({ placeholder }: { placeholder: string }) {
  return (
    <Composer>
      <ComposerCard>
        <ComposerInput placeholder={placeholder} />
        <ComposerFooter>
          <ComposerSpacer />
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  )
}

// A rounded, hairline-bordered window with the page background.
function Window({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

// The thread opens in a ChatShellPanel: docked beside the channel on wide
// shells, over it on narrow ones.
export default function ThreadPanel() {
  const [open, setOpen] = useState(true)
  return (
    <Window>
      <div style={{ height: 400, display: 'flex' }}>
        <ChatShell>
          <ChatShellMain>
            <ChatShellHeader>
              <ChatShellHeaderIcon />
              <ChatShellTitle>deploys</ChatShellTitle>
              <ChatShellDescription>Every push to main</ChatShellDescription>
            </ChatShellHeader>
            <div
              role="log"
              aria-live="polite"
              className="min-h-0 flex-1 overflow-y-auto py-3"
            >
              <Line who={team.bot} time="7:02 AM">
                Deploy docs@4f21c9 → prod failed a smoke check.
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="mt-1.5 flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-border bg-muted px-2.5 py-1.5 font-sans text-[12px] text-foreground"
                >
                  <Icon name="text-bubble" size={13} sw={1.9} />
                  <span className="font-semibold">Smoke check: /chat-shell</span>
                  <span className="text-primary">2 replies</span>
                </button>
              </Line>
            </div>
            <ChatShellFooter>
              <Reply placeholder="Message #deploys" />
            </ChatShellFooter>
          </ChatShellMain>
          <ChatShellPanel
            open={open}
            onOpenChange={setOpen}
            dockWidth={600}
            width={300}
          >
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-3">
                <header className="px-4 pb-2">
                  <div className="text-[15px] font-bold text-foreground">
                    Smoke check: /chat-shell
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Started by Stitch in #deploys
                  </div>
                </header>
                <div className="mx-4 mb-1.5 border-t border-border pt-1.5 text-[11px] text-tertiary-foreground">
                  2 replies
                </div>
                <Line who={team.noor} time="7:05 AM">
                  Flaky font load, I think.
                </Line>
                <Line who={team.theo} time="7:09 AM">
                  Re-ran it, green now.
                </Line>
              </div>
              <ChatShellFooter className="px-3">
                <Reply placeholder="Reply in thread" />
              </ChatShellFooter>
            </div>
          </ChatShellPanel>
        </ChatShell>
      </div>
    </Window>
  )
}
