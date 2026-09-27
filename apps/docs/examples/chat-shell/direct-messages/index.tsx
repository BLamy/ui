import { useState, type ReactNode } from 'react'
import {
  ChannelGroup,
  ChannelItem,
  ChannelList,
  ChatAvatar,
  ChatComposer,
  ChatShell,
  ChatShellFooter,
  ChatShellHeader,
  ChatShellMain,
  ChatShellNav,
  ChatShellNavTrigger,
  ChatShellSidebar,
  ChatShellTitle,
  ChatUsersProvider,
  Message,
  MessageAuthor,
  MessageAvatar,
  MessageBody,
  MessageContent,
  MessageHeader,
  MessageList,
  MessageTimestamp,
  ServerHeader,
  type ChatUser,
} from '@brett_lamy/ui'

const people: Record<string, ChatUser> = {
  maya: { name: 'Maya', c: '#FF375F', role: '#FF8FA8' },
  jonas: { name: 'Jonas', c: '#30B0C7', role: '#7FD6E6' },
  priya: { name: 'Priya', c: '#FF9F0A', role: '#FFC46B' },
  me: { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' },
}

const history: Record<string, [string, string][]> = {
  maya: [['maya', 'Did the morph land?'], ['me', 'Spring on transform, not layout. Buttery.'], ['maya', 'Ship it 🚢']],
  jonas: [['jonas', 'Can you review the rail PR?']],
  priya: [['priya', 'Lunch Thursday?']],
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
        background: 'var(--bl-bg)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

// No rail: a DM list in the sidebar and one conversation. Below 640px the list becomes a drawer.
export default function DirectMessages() {
  const [who, setWho] = useState('maya')
  return (
    <Window>
      <div style={{ height: 420, display: 'flex' }}>
        <ChatUsersProvider users={people}>
          <ChatShell breakpoint={640}>
            <ChatShellNav>
              <ChatShellSidebar>
                <ServerHeader>Direct messages</ServerHeader>
                <ChannelList selectedKey={who} onSelectionChange={setWho}>
                  <ChannelGroup label="Recent">
                    {['maya', 'jonas', 'priya'].map((id) => (
                      <ChannelItem
                        key={id}
                        id={id}
                        icon={<ChatAvatar user={people[id]} size={18} />}
                        mentions={id === 'jonas' ? 1 : undefined}
                      >
                        {people[id].name}
                      </ChannelItem>
                    ))}
                  </ChannelGroup>
                </ChannelList>
              </ChatShellSidebar>
            </ChatShellNav>
            <ChatShellMain>
              <ChatShellHeader>
                <ChatShellNavTrigger />
                <ChatAvatar user={people[who]} size={22} />
                <ChatShellTitle>{people[who].name}</ChatShellTitle>
              </ChatShellHeader>
              <MessageList scrollKey={who}>
                {history[who].map(([from, text], i) => (
                  <Message key={i} user={people[from]}>
                    <MessageAvatar />
                    <MessageBody>
                      <MessageHeader>
                        <MessageAuthor />
                        <MessageTimestamp>Today</MessageTimestamp>
                      </MessageHeader>
                      <MessageContent>{text}</MessageContent>
                    </MessageBody>
                  </Message>
                ))}
              </MessageList>
              <ChatShellFooter>
                <ChatComposer placeholder={'Message ' + people[who].name} onSend={() => {}} />
              </ChatShellFooter>
            </ChatShellMain>
          </ChatShell>
        </ChatUsersProvider>
      </div>
    </Window>
  )
}
