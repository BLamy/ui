import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatLightTokens, chatTokens, chatVars } from '../../lib/chat/chat-tokens';
import { WorkspaceRail } from './workspace-rail';
import '../../styles.css';

const meta: Meta<typeof WorkspaceRail> = {
  title: 'Organisms/WorkspaceRail',
  component: WorkspaceRail,
  decorators: [
    (Story) => (
      <div
        style={{
          width: 200,
          height: 480,
          background: chatTokens.bg,
          color: chatTokens.label,
          colorScheme: 'dark',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof WorkspaceRail>;

export const Default: Story = {
  args: { tint: '#0A84FF' },
};

export const CustomWorkspaces: Story = {
  args: {
    workspaces: [
      { id: 'hq', label: 'H', color: '#FF9F0A', active: true, title: 'HQ' },
      { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs' },
      { id: 'ops', label: 'O', color: '#FF453A', title: 'Ops' },
    ],
  },
};

const discord = {
  home: { title: 'Direct Messages', mentions: 2 },
  workspaces: [
    { id: 'blui', label: 'T', color: '#0A84FF', active: true, title: 'BL UI HQ' },
    { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
    { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs', mentions: 4 },
    { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', unread: true, mentions: 12 },
  ],
};

/** Home tab over a separator, unread nubs, mention badges — the vertical TabView composition. Up/Down arrows
    move between tiles (the separator and "Add workspace" are skipped). */
export const DiscordStyle: Story = { args: discord };

/** The same rail on the light chat tokens (`chatVars('light')`). */
export const DiscordStyleLight: Story = {
  args: discord,
  decorators: [
    (Story) => (
      <div
        data-appearance="light"
        style={{
          ...chatVars('light'),
          width: 200,
          height: 480,
          background: chatLightTokens.bg,
          color: chatLightTokens.label,
          colorScheme: 'light',
          display: 'flex',
        }}
      >
        <Story />
      </div>
    ),
  ],
};
