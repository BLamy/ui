import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatLightTokens, chatTokens, chatVars } from '../../lib/chat/chat-tokens';
import { WorkspaceRail, WorkspaceRailAction, WorkspaceRailHome, WorkspaceRailItem, WorkspaceRailList, WorkspaceRailSeparator } from './workspace-rail';
import '../../styles.css';

const meta: Meta = {
  title: 'Organisms/WorkspaceRail',
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
type Story = StoryObj;

interface RailWorkspace {
  id: string;
  label: string;
  color?: string;
  title: string;
  unread?: boolean;
  mentions?: number;
}

/** The parts, from data: WorkspaceRail › WorkspaceRailList (WorkspaceRailHome, WorkspaceRailSeparator,
    WorkspaceRailItem…) · WorkspaceRailAction. */
function Rail({ workspaces, home, defaultSelectedKey }: { workspaces: RailWorkspace[]; home?: { mentions?: number }; defaultSelectedKey: string }) {
  return (
    <WorkspaceRail defaultSelectedKey={defaultSelectedKey}>
      <WorkspaceRailList>
        {home && <WorkspaceRailHome mentions={home.mentions} />}
        {home && <WorkspaceRailSeparator />}
        {workspaces.map((w) => (
          <WorkspaceRailItem key={w.id} {...w} />
        ))}
      </WorkspaceRailList>
      <WorkspaceRailAction aria-label="Add workspace" />
    </WorkspaceRail>
  );
}

export const Default: Story = {
  render: () => (
    <Rail
      defaultSelectedKey="blui"
      workspaces={[
        { id: 'blui', label: 'T', title: 'BL UI HQ' },
        { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery' },
      ]}
    />
  ),
};

export const CustomWorkspaces: Story = {
  render: () => (
    <Rail
      defaultSelectedKey="hq"
      workspaces={[
        { id: 'hq', label: 'H', color: '#FF9F0A', title: 'HQ' },
        { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs' },
        { id: 'ops', label: 'O', color: '#FF453A', title: 'Ops' },
      ]}
    />
  ),
};

const discord: RailWorkspace[] = [
  { id: 'blui', label: 'T', color: '#0A84FF', title: 'BL UI HQ' },
  { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
  { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs', mentions: 4 },
  { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', unread: true, mentions: 12 },
];

/** Home tab over a separator, unread nubs, mention badges — the vertical TabView composition. Up/Down arrows
    move between tiles (the separator and "Add workspace" are skipped). */
export const DiscordStyle: Story = {
  render: () => <Rail defaultSelectedKey="blui" home={{ mentions: 2 }} workspaces={discord} />,
};

/** The same rail on the light chat tokens (`chatVars('light')`). */
export const DiscordStyleLight: Story = {
  render: () => <Rail defaultSelectedKey="blui" home={{ mentions: 2 }} workspaces={discord} />,
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
