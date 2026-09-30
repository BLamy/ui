import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import CodexClone from './page';

const meta: Meta<typeof CodexClone> = {
  title: 'Blocks/Codex Clone',
  component: CodexClone,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof CodexClone>;

/** The block fills whatever box it's given; these stories give it a wide desktop (where the outline rail has room in the margin), tablet or phone-sized frame. */
function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="mx-auto overflow-hidden border border-border" style={{ width, height }}>
      {children}
    </div>
  );
}

export const Desktop: Story = { render: (args) => <Frame width={1600} height={760}><CodexClone {...args} /></Frame> };

/** The sidebar without the inbox: Projects — folders of threads — and Recents. */
export const NoInbox: Story = { args: { inbox: false }, render: (args) => <Frame width={1600} height={760}><CodexClone {...args} /></Frame> };

/** A project thread: a wide transcript with the turn rail (hover a dash for the message), and the thread's panel. */
export const Thread: Story = { args: { inbox: false, initialChat: 'stack-merge' }, render: (args) => <Frame width={1600} height={760}><CodexClone {...args} /></Frame> };

/** Another chat: its own document, its own outline. */
export const LoopQa: Story = { args: { initialChat: 'loopqa' }, render: (args) => <Frame width={1600} height={760}><CodexClone {...args} /></Frame> };

export const Tablet: Story = { render: (args) => <Frame width={834} height={760}><CodexClone {...args} /></Frame> };

export const Phone: Story = { render: (args) => <Frame width={390} height={720}><CodexClone {...args} /></Frame> };

export const Light: Story = {
  render: (args) => (
    <AppearanceProvider value="light">
      <Frame width={1600} height={760}><CodexClone {...args} /></Frame>
    </AppearanceProvider>
  ),
};
