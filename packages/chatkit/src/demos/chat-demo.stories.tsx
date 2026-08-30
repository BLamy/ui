import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatDemo, type ChatThreadState } from './chat-demo';
import '../styles.css';

interface ChatPageArgs {
  width: number;
  height: number;
  tint: string;
  members: boolean;
  initialThread: ChatThreadState | null;
}

const meta: Meta<ChatPageArgs> = {
  title: 'Pages/Chat',
  args: { tint: '#0A84FF', members: true, initialThread: { id: 'd4', mode: 'drawer' } },
  render: ({ width, height, tint, members, initialThread }) => (
    <div style={{ width, height, overflow: 'hidden' }}>
      <ChatDemo tint={tint} members={members} initialThread={initialThread} />
    </div>
  ),
};
export default meta;
type Story = StoryObj<ChatPageArgs>;

export const Desktop: Story = {
  args: { width: 1280, height: 720 },
};

export const Compact: Story = {
  args: { width: 390, height: 720 },
};

/** ≥1180px container, thread mode 'drawer' → the SideDrawer docks as a FIXED column beside the channel. */
export const ThreadFixedDrawer: Story = {
  args: { width: 1280, height: 720, initialThread: { id: 'd4', mode: 'drawer' } },
  parameters: {
    docs: {
      description: {
        story:
          'Thread open as a fixed SideDrawer (container ≥1180px docks it; below that the same drawer overlays). The drawer composer autofocuses.',
      },
    },
  },
};

/** Below 1180px the same drawer-mode thread renders as an overlay SideDrawer. */
export const ThreadOverlayDrawer: Story = {
  args: { width: 1000, height: 720, initialThread: { id: 'd4', mode: 'drawer' } },
};

/** Thread mode 'full' — thread takes over the main column with the "Open as drawer" header button. */
export const ThreadFullView: Story = {
  args: { width: 1280, height: 720, initialThread: { id: 'd3', mode: 'full' } },
  parameters: {
    docs: {
      description: {
        story:
          'Full-thread view mode (also reached via the ChannelList thread sub-rows). The header shows a back-to-#channel button and "Open as drawer".',
      },
    },
  },
};
