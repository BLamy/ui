import { useState, type ReactNode } from 'react'
import {
  ChatComposer,
  ChatIcon,
  chatIconPaths,
  ChatShell,
  ChatShellDescription,
  ChatShellFooter,
  ChatShellHeader,
  ChatShellHeaderIcon,
  ChatShellMain,
  ChatShellPanel,
  ChatShellTitle,
  ChatUsersProvider,
  Message,
  MessageAction,
  MessageActions,
  MessageAuthor,
  MessageAvatar,
  MessageBadge,
  MessageBody,
  MessageContent,
  MessageDivider,
  MessageHeader,
  MessageList,
  MessageTimestamp,
  ThreadHeader,
  ThreadPreview,
  ThreadPreviewReply,
  type ChatUser,
} from '@brett_lamy/ui'

const team: Record<string, ChatUser> = {
  noor: { name: 'Noor', c: '#FF9F0A', role: '#FFC46B' },
  theo: { name: 'Theo', c: '#32D74B', role: '#8CE8A5' },
  bot: { name: 'Stitch', c: '#5E5CE6', role: '#A6A5F2', bot: true },
}

function Line({
  user,
  time,
  children,
}: {
  user: ChatUser
  time: string
  children: string
}) {
  return (
    <Message user={user}>
      <MessageAvatar />
      <MessageBody>
        <MessageHeader>
          <MessageAuthor />
          {user.bot && <MessageBadge>APP</MessageBadge>}
          <MessageTimestamp>{time}</MessageTimestamp>
        </MessageHeader>
        <MessageContent>{children}</MessageContent>
      </MessageBody>
    </Message>
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

// The thread opens in a ChatShellPanel: docked beside the channel on wide
// shells, over it on narrow ones.
export default function ThreadPanel() {
  const [open, setOpen] = useState(true)
  return (
    <Window>
      <div style={{ height: 400, display: 'flex' }}>
        <ChatUsersProvider users={team}>
          <ChatShell>
            <ChatShellMain>
              <ChatShellHeader>
                <ChatShellHeaderIcon />
                <ChatShellTitle>deploys</ChatShellTitle>
                <ChatShellDescription>Every push to main</ChatShellDescription>
              </ChatShellHeader>
              <MessageList>
                <Message user={team.bot}>
                  <MessageAvatar />
                  <MessageBody>
                    <MessageHeader>
                      <MessageAuthor />
                      <MessageBadge>APP</MessageBadge>
                      <MessageTimestamp>7:02 AM</MessageTimestamp>
                    </MessageHeader>
                    <MessageContent>
                      Deploy docs@4f21c9 → prod failed a smoke check.
                    </MessageContent>
                    <ThreadPreview
                      title="Smoke check: /chat-shell"
                      count={2}
                      onPress={() => setOpen(true)}
                    >
                      <ThreadPreviewReply user={team.theo}>
                        Re-ran it, green now.
                      </ThreadPreviewReply>
                    </ThreadPreview>
                  </MessageBody>
                  <MessageActions>
                    <MessageAction
                      label="Open thread"
                      onPress={() => setOpen(true)}
                    >
                      <ChatIcon d={chatIconPaths.thread} size={14} />
                    </MessageAction>
                  </MessageActions>
                </Message>
              </MessageList>
              <ChatShellFooter>
                <ChatComposer
                  placeholder="Message #deploys"
                  onSend={() => {}}
                />
              </ChatShellFooter>
            </ChatShellMain>
            <ChatShellPanel
              open={open}
              onOpenChange={setOpen}
              dockWidth={600}
              width={300}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                <MessageList className="pt-1">
                  <ThreadHeader
                    title="Smoke check: /chat-shell"
                    description="Started by Stitch in #deploys"
                  />
                  <MessageDivider>2 replies</MessageDivider>
                  <Line user={team.noor} time="7:05 AM">
                    Flaky font load, I think.
                  </Line>
                  <Line user={team.theo} time="7:09 AM">
                    Re-ran it, green now.
                  </Line>
                </MessageList>
                <ChatShellFooter className="px-3">
                  <ChatComposer
                    placeholder="Reply in thread"
                    onSend={() => {}}
                  />
                </ChatShellFooter>
              </div>
            </ChatShellPanel>
          </ChatShell>
        </ChatUsersProvider>
      </div>
    </Window>
  )
}
