import { useState } from 'react'
import { ConversationAssistantMessage, Conversation, ConversationComposer, ConversationEmpty, ConversationMessages, ConversationSuggestions, ConversationMarkdown, ConversationSuggestion, ConversationUserMessage } from '@/components/ui/conversation'
import { ThemeScope } from '@/lib/theme'
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
          <ConversationEmpty
              title="What are we building?"
              description="Start a thread — ask anything about this workspace." />
          <ConversationMessages threadKey="new">
            {messages.map((m) =>
              m.role === 'user' ? (
                <ConversationUserMessage key={m.id}>{m.text}</ConversationUserMessage>
              ) : (
                <ConversationAssistantMessage key={m.id}>
                  <ConversationMarkdown markdown={m.text} />
                </ConversationAssistantMessage>
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
              <ConversationSuggestion key={s} onClick={() => send(s)}>
                {s}
              </ConversationSuggestion>
            ))}
          </ConversationSuggestions>
        </Conversation>
      </div>
    </div>
  )
}

// A `workbench` ThemeScope follows the app's light / dark appearance.
export default function NewThreadExample() {
  return (
    <ThemeScope scope="workbench" style={{ padding: 18 }}>
      <NewThread />
    </ThemeScope>
  )
}
