import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer'
import { SidebarContent, SidebarHeader, SidebarItem, SidebarSection } from '@/components/ui/sidebar'
import { ChatShell, ChatShellFooter, ChatShellHeader, ChatShellMain, ChatShellNav, ChatShellNavTrigger, ChatShellSidebar, ChatShellTitle } from '@/components/blocks/discord-clone/components/chat-shell'
import { useChatShell } from '@/components/blocks/discord-clone/components/chat-shell-context'

type Person = { f: string; l: string }

const people: Record<string, Person> = {
  maya: { f: 'Maya', l: 'Lindqvist' },
  jonas: { f: 'Jonas', l: 'Brandt' },
  priya: { f: 'Priya', l: 'Raman' },
  me: { f: 'Ada', l: 'Lovelace' },
}

const history: Record<string, [string, string][]> = {
  maya: [
    ['maya', 'Did the morph land?'],
    ['me', 'Spring on transform, not layout. Buttery.'],
    ['maya', 'Ship it 🚢'],
  ],
  jonas: [['jonas', 'Can you review the rail PR?']],
  priya: [['priya', 'Lunch Thursday?']],
}

// One transcript row: avatar, name and time, text.
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
          <span className="text-[11px] text-tertiary-foreground">{time}</span>
        </div>
        <p className="m-0 text-[13.5px] leading-normal text-foreground">
          {children}
        </p>
      </div>
    </div>
  )
}

// The DM list. Picking a conversation also closes the compact drawer.
function Conversations({
  who,
  onPick,
}: {
  who: string
  onPick: (id: string) => void
}) {
  const shell = useChatShell()
  return (
    <ChatShellSidebar>
      <SidebarHeader>
        <div className="px-[9px] font-ios text-[14px] font-bold text-foreground">
          Direct messages
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection title="Recent">
          {['maya', 'jonas', 'priya'].map((id) => (
            <SidebarItem
              key={id}
              icon={<Avatar c={people[id]} size={18} />}
              label={people[id].f}
              active={who === id}
              badge={id === 'jonas' ? 1 : undefined}
              onPress={() => {
                onPick(id)
                shell.setNavOpen(false)
              }}
            />
          ))}
        </SidebarSection>
      </SidebarContent>
    </ChatShellSidebar>
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

// No rail: a DM list in the sidebar and one conversation. Below 640px the list
// becomes a drawer.
export default function DirectMessages() {
  const [who, setWho] = useState('maya')
  return (
    <Window>
      <div style={{ height: 420, display: 'flex' }}>
        <ChatShell breakpoint={640}>
          <ChatShellNav>
            <Conversations who={who} onPick={setWho} />
          </ChatShellNav>
          <ChatShellMain>
            <ChatShellHeader>
              <ChatShellNavTrigger />
              <Avatar c={people[who]} size={22} />
              <ChatShellTitle>{people[who].f}</ChatShellTitle>
            </ChatShellHeader>
            <div
              key={who}
              role="log"
              aria-live="polite"
              className="min-h-0 flex-1 overflow-y-auto py-3"
            >
              {history[who].map(([from, text], i) => (
                <Line key={i} who={people[from]} time="Today">
                  {text}
                </Line>
              ))}
            </div>
            <ChatShellFooter>
              <Composer>
                <ComposerCard>
                  <ComposerInput placeholder={'Message ' + people[who].f} />
                  <ComposerFooter>
                    <ComposerSpacer />
                    <ComposerSend />
                  </ComposerFooter>
                </ComposerCard>
              </Composer>
            </ChatShellFooter>
          </ChatShellMain>
        </ChatShell>
      </div>
    </Window>
  )
}
