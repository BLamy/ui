import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Conversation,
  ConversationEmpty,
  ConversationGreeting,
  ConversationMessages,
  ConversationComposer,
  ConversationSuggestions,
  Suggestion,
  UserMessage,
  AssistantMessage,
  MessageMarkdown,
  WorkLog,
  ToolCall,
  SettledBanner,
} from './chat';
import { WorkbenchComposer } from './workbench-composer';
import { WorkbenchTheme } from '../../lib/workbench/theme';
import { SUGGESTIONS, THREADS, type Thread as ThreadData } from './fixtures';
import '../../styles.css';

const meta: Meta<typeof Conversation> = {
  title: 'Organisms/ChatView',
  component: Conversation,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Conversation>;

function Frame({ children, height = 640 }: { children: React.ReactNode; height?: number }) {
  return (
    <WorkbenchTheme style={{ padding: 24, display: 'grid', placeItems: 'center', minHeight: height + 48 }}>
      <div style={{ width: 720, maxWidth: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--background)' }}>
        {children}
      </div>
    </WorkbenchTheme>
  );
}

/* The Conversation parts over a Thread record, as the t3-clone block composes them. */
function ThreadDemo({ thread, streaming, onUnsettle }: { thread: ThreadData | null; streaming?: boolean; onUnsettle?: () => void }) {
  return (
    <Conversation empty={!thread}>
      <ConversationEmpty>
        <ConversationGreeting title="What are we building?" description="Start a thread — ask anything about this workspace." />
      </ConversationEmpty>
      <ConversationMessages threadKey={thread?.id} streaming={streaming}>
        {thread?.messages.map((m) =>
          m.role === 'user' ? (
            <UserMessage key={m.id}>{m.text}</UserMessage>
          ) : (
            <AssistantMessage key={m.id}>
              {m.summary ? <WorkLog summary={m.summary}>{m.steps?.map((s, i) => <ToolCall key={i} {...s} />)}</WorkLog> : null}
              <MessageMarkdown markdown={m.text} streaming={m.live} />
            </AssistantMessage>
          ),
        )}
      </ConversationMessages>
      <ConversationComposer>
        {thread?.settled && onUnsettle ? <SettledBanner onUnsettle={onUnsettle} /> : null}
        <WorkbenchComposer onSubmit={() => {}} streaming={!!thread && streaming} onStop={() => {}} autoFocus={!thread} />
      </ConversationComposer>
      <ConversationSuggestions>
        {SUGGESTIONS.map((s) => (
          <Suggestion key={s}>{s}</Suggestion>
        ))}
      </ConversationSuggestions>
    </Conversation>
  );
}

/* a thread with markdown replies + "Worked for" rows */
export const Thread: Story = { render: () => <Frame><ThreadDemo thread={THREADS[0]} /></Frame> };

/* settled thread — SettledBanner above the composer; Un-settle removes it */
function SettledDemo() {
  const [thread, setThread] = useState<ThreadData>(THREADS[1]);
  return <ThreadDemo thread={thread} onUnsettle={() => setThread((t) => ({ ...t, settled: false }))} />;
}
export const Settled: Story = { render: () => <Frame><SettledDemo /></Frame> };

/* no thread — greeting, centred composer, suggestions */
export const Empty: Story = { render: () => <Frame><ThreadDemo thread={null} /></Frame> };

/* live reply streaming in — thinking dots before the first token, stop ring in the composer */
export const Streaming: Story = {
  render: () => (
    <Frame>
      <ThreadDemo
        streaming
        thread={{
          id: 'live',
          title: 'streaming reply',
          age: 'now',
          settled: false,
          messages: [
            { id: 'u1', role: 'user', text: 'kick off the build and stream me the log summary' },
            { id: 'a1', role: 'assistant', text: '', live: true },
          ],
        }}
      />
    </Frame>
  ),
};

/* the standalone SettledBanner + WorkLog rows (static, and with tool calls behind it) */
export const BannerAndTrace: Story = {
  render: () => (
    <WorkbenchTheme style={{ minHeight: 320, padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 560, maxWidth: '100%', display: 'grid', gap: 18 }}>
        <SettledBanner onUnsettle={() => {}} />
        <WorkLog summary="Worked for 1m 4s">{THREADS[0].messages[1].steps?.map((s, i) => <ToolCall key={i} {...s} />)}</WorkLog>
        <WorkLog summary="Stopped" />
      </div>
    </WorkbenchTheme>
  ),
};

/* the empty state with a streaming composer */
export const EmptyThreadStreaming: Story = {
  render: () => (
    <Frame height={520}>
      <Conversation empty>
        <ConversationEmpty>
          <ConversationGreeting title="What are we building?" description="Start a thread — ask anything about this workspace." />
        </ConversationEmpty>
        <ConversationComposer>
          <WorkbenchComposer onSubmit={() => {}} streaming onStop={() => {}} />
        </ConversationComposer>
        <ConversationSuggestions>
          {SUGGESTIONS.map((s) => (
            <Suggestion key={s}>{s}</Suggestion>
          ))}
        </ConversationSuggestions>
      </Conversation>
    </Frame>
  ),
};

/* WorkLog expanded: the tool calls behind a reply — titles, details, and command wells */
export const WorkLogOpen: Story = {
  render: () => (
    <WorkbenchTheme style={{ minHeight: 420, padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 560, maxWidth: '100%' }}>
        <WorkLog summary="Worked for 1m 4s" defaultOpen>
          {THREADS[0].messages[1].steps?.map((s, i) => <ToolCall key={i} {...s} />)}
          <ToolCall icon="globe" title="Opened the browser surface" detail="localhost:3000" status="running" />
          <ToolCall title="Ran the e2e suite" detail="2 failed" status="error" />
        </WorkLog>
      </div>
    </WorkbenchTheme>
  ),
};
