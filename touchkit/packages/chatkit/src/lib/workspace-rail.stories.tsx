import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatTokens } from './chat-tokens';
import { WorkspaceRail } from './workspace-rail';
import '../styles.css';

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
