import { useState } from 'react'
import { AssistantMessage, Conversation, ConversationComposer, ConversationEmpty, ConversationGreeting, ConversationMessages, ConversationSuggestions, MessageMarkdown, Suggestion, UserMessage } from '@/components/ui/conversation'
import { WorkbenchTheme } from '@/components/ui/workbench-theme'
import { stripAttachmentRefs, WorkbenchComposer } from '@/components/blocks/t3-clone/components/workbench/workbench-composer'

function NewThread() {
  const [messages, setMessages] = useState<
    { id: string; role: string; text: string }[]
  >([])
  const empty = messages.length === 0
  const send = (text: string) =>
    setMessages((m) => [
      ...m,
      { id: 'u' + m.length, role: 'user', text },
      {
        id: 'a' + m.length,
        role: 'assistant',
        text:
          `Here’s the plan for **${text}**:\n\n` +
          '1. Read the relevant files\n2. Make the change\n3. Run the checks',
      },
    ])
  return (
    // a fixed-height, rounded window on the workbench background
    <div
      style={{
        width: '100%',
        height: 460,
        margin: '0 auto',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--background)',
        }}
      >
        <Conversation empty={empty}>
          <ConversationEmpty>
            <ConversationGreeting
              title="What are we building?"
              description="Start a thread — ask anything about this workspace."
            />
          </ConversationEmpty>
          <ConversationMessages threadKey="new">
            {messages.map((m) =>
              m.role === 'user' ? (
                <UserMessage key={m.id}>{m.text}</UserMessage>
              ) : (
                <AssistantMessage key={m.id}>
                  <MessageMarkdown markdown={m.text} />
                </AssistantMessage>
              ),
            )}
          </ConversationMessages>
          <ConversationComposer>
            <WorkbenchComposer
              autoFocus={empty}
              onSubmit={(md) => send(stripAttachmentRefs(md))}
            />
          </ConversationComposer>
          <ConversationSuggestions>
            {['Add a dark mode toggle', 'Write tests for the cart'].map((s) => (
              <Suggestion key={s} onPress={() => send(s)}>
                {s}
              </Suggestion>
            ))}
          </ConversationSuggestions>
        </Conversation>
      </div>
    </div>
  )
}

// WorkbenchTheme is a `workbench` theme scope; it follows the app's light / dark
// appearance.
export default function NewThreadExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <NewThread />
    </WorkbenchTheme>
  )
}
