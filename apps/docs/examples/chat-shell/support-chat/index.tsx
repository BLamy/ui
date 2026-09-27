import { useState, type ReactNode } from 'react'
import {
  ChatAvatar,
  ChatComposer,
  ChatIcon,
  chatIconPaths,
  ChatShell,
  ChatShellDescription,
  ChatShellFooter,
  ChatShellHeader,
  ChatShellHeaderAction,
  ChatShellHeaderActions,
  ChatShellMain,
  ChatShellTitle,
  Message,
  MessageAuthor,
  MessageAvatar,
  MessageBody,
  MessageContent,
  MessageHeader,
  MessageList,
  TypingIndicator,
  type ChatUser,
} from '@brett_lamy/ui'

const agent: ChatUser = { name: 'Juniper', c: '#30B06E', role: '#30B06E' }
const you: ChatUser = { name: 'You', c: '#8E8E93', role: '#8E8E93' }

// A rounded, hairline-bordered window with the page background; `width` caps it, centered.
function Window({ width, children }: { width?: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
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

// The smallest shell: no navigation at all — a support widget in the product's accent.
export default function SupportChat() {
  const [log, setLog] = useState([{ from: agent, text: 'Hi! What can I help with today?' }])
  const [typing, setTyping] = useState(false)
  const send = (text: string) => {
    setLog((l) => [...l, { from: you, text }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setLog((l) => [...l, { from: agent, text: 'Thanks — looking into that now.' }])
    }, 1500)
  }
  return (
    <Window width={380}>
      <div style={{ height: 440, display: 'flex' }}>
        <ChatShell tint="#30B06E">
          <ChatShellMain>
            <ChatShellHeader>
              <ChatAvatar user={agent} size={24} status="online" />
              <ChatShellTitle>Support</ChatShellTitle>
              <ChatShellDescription>Replies in a few minutes</ChatShellDescription>
              <ChatShellHeaderActions>
                <ChatShellHeaderAction aria-label="Close">
                  <ChatIcon d={chatIconPaths.x} size={15} />
                </ChatShellHeaderAction>
              </ChatShellHeaderActions>
            </ChatShellHeader>
            <MessageList>
              {log.map((m, i) => (
                <Message key={i} user={m.from} appear={i > 0}>
                  <MessageAvatar size={28} />
                  <MessageBody>
                    <MessageHeader>
                      <MessageAuthor />
                    </MessageHeader>
                    <MessageContent>{m.text}</MessageContent>
                  </MessageBody>
                </Message>
              ))}
              {typing && <TypingIndicator>Juniper is typing…</TypingIndicator>}
            </MessageList>
            <ChatShellFooter>
              <ChatComposer placeholder="Write a message…" onSend={send} />
            </ChatShellFooter>
          </ChatShellMain>
        </ChatShell>
      </div>
    </Window>
  )
}
