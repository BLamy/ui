import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatView, EmptyThread, SettledBanner, WorkTrace } from './chat';
import { WorkbenchTheme } from './theme';
import type { WorkbenchThread } from './thread-sidebar';
import { SEED_THREADS } from '../demos/workbench-demo';
import '../styles.css';

const meta: Meta<typeof ChatView> = {
  title: 'Organisms/ChatView',
  component: ChatView,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof ChatView>;

function Frame({ children, height = 640 }: { children: React.ReactNode; height?: number }) {
  return (
    <WorkbenchTheme style={{ padding: 24, display: 'grid', placeItems: 'center', minHeight: height + 48 }}>
      <div style={{ width: 720, maxWidth: '100%', height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)', display: 'flex', flexDirection: 'column', background: 'var(--wb-bg)' }}>
        {children}
      </div>
    </WorkbenchTheme>
  );
}

/* a thread with markdown replies + "Worked for" rows */
export const Thread: Story = {
  render: () => (
    <Frame>
      <ChatView thread={SEED_THREADS[0]} onSend={() => {}} />
    </Frame>
  ),
};

/* settled thread — SettledBanner above the composer; Un-settle removes it */
function SettledDemo() {
  const [thread, setThread] = useState<WorkbenchThread>(SEED_THREADS[1]);
  return <ChatView thread={thread} onSend={() => {}} onUnsettle={() => setThread((t) => ({ ...t, settled: false }))} />;
}
export const Settled: Story = { render: () => <Frame><SettledDemo /></Frame> };

/* no thread — centered EmptyThread composer with suggestions */
export const Empty: Story = {
  render: () => (
    <Frame>
      <ChatView thread={null} onSend={() => {}} />
    </Frame>
  ),
};

/* live reply streaming in — thinking dots before the first token, stop ring in the composer */
export const Streaming: Story = {
  render: () => (
    <Frame>
      <ChatView
        thread={{
          id: 'live',
          title: 'streaming reply',
          age: 'now',
          settled: false,
          msgs: [
            { id: 'u1', role: 'user', md: 'kick off the build and stream me the log summary' },
            { id: 'a1', role: 'assistant', md: '', live: true },
          ],
        }}
        streaming
        onSend={() => {}}
        onStop={() => {}}
      />
    </Frame>
  ),
};

/* the standalone SettledBanner + WorkTrace rows */
export const BannerAndTrace: Story = {
  render: () => (
    <WorkbenchTheme style={{ minHeight: 320, padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 560, maxWidth: '100%', display: 'grid', gap: 18 }}>
        <SettledBanner onUnsettle={() => {}} />
        <WorkTrace meta="Worked for 1m 4s" trace={SEED_THREADS[0].msgs[1].trace} />
        <WorkTrace meta="Stopped" />
      </div>
    </WorkbenchTheme>
  ),
};

/* EmptyThread standalone, streaming variant of its wide composer */
export const EmptyThreadStreaming: Story = {
  render: () => (
    <Frame height={520}>
      <EmptyThread onSend={() => {}} streaming onStop={() => {}} />
    </Frame>
  ),
};
