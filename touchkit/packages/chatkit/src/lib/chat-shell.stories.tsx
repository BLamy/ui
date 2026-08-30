import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChannelList } from './channel-list';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { ChatShell, useChatShell } from './chat-shell';
import { chatTokens as K, KFONT } from './chat-tokens';
import { ChatUsersProvider } from './chat-users';
import { WorkspaceRail } from './workspace-rail';
import { seed, USERS } from '../demos/chat-demo';
import '../styles.css';

interface FrameArgs {
  width: number;
  height: number;
  defaultNavOpen?: boolean;
}

function DemoMain() {
  const { w, compact, setNavOpen } = useChatShell();
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', fontFamily: KFONT }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 16px',
          height: 46,
          borderBottom: '1px solid ' + K.sep,
          flexShrink: 0,
        }}
      >
        {compact && (
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Channels"
            style={{ border: 0, background: 'none', color: K.mut, cursor: 'pointer', padding: 4, display: 'grid' }}
          >
            <ChatIcon d={chatIconPaths.menu} size={17} sw={2} />
          </button>
        )}
        <span style={{ fontSize: 14, fontWeight: 750 }}>Main slot</span>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: K.mut, fontSize: 13 }}>
        container width {w}px · {compact ? 'compact (drawer nav)' : 'wide (docked rail + nav)'}
      </div>
    </div>
  );
}

function DemoNav({ cur, setCur }: { cur: string; setCur: (id: string) => void }) {
  const { compact, setNavOpen } = useChatShell();
  return (
    <ChannelList
      chans={seed()}
      cur={cur}
      tint="#0A84FF"
      onClose={compact ? () => setNavOpen(false) : null}
      onPick={(id) => {
        setCur(id);
        setNavOpen(false);
      }}
    />
  );
}

function ShellDemo({ width, height, defaultNavOpen }: FrameArgs) {
  const [cur, setCur] = useState('dev');
  return (
    <ChatUsersProvider users={USERS}>
      <div style={{ width, height, overflow: 'hidden' }}>
        <ChatShell breakpoint={880} defaultNavOpen={defaultNavOpen}>
          <ChatShell.Rail>
            <WorkspaceRail tint="#0A84FF" />
          </ChatShell.Rail>
          <ChatShell.Nav>
            <DemoNav cur={cur} setCur={setCur} />
          </ChatShell.Nav>
          <ChatShell.Main>
            <DemoMain />
          </ChatShell.Main>
        </ChatShell>
      </div>
    </ChatUsersProvider>
  );
}

const meta: Meta<FrameArgs> = {
  title: 'Templates/ChatShell',
  render: (args) => <ShellDemo {...args} />,
};
export default meta;
type Story = StoryObj<FrameArgs>;

export const Wide: Story = {
  args: { width: 1100, height: 640 },
};

export const Compact: Story = {
  args: { width: 480, height: 640 },
};

/** Compact shell with the hamburger drawer OPEN — rail + nav slide in over the scrim. */
export const CompactNavOpen: Story = {
  args: { width: 480, height: 640, defaultNavOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          'Below the breakpoint, Rail + Nav collapse into a hamburger drawer (translateX slide, .38s cubic-bezier(.32,.72,0,1), dimmed scrim). Shown here open via defaultNavOpen.',
      },
    },
  },
};
