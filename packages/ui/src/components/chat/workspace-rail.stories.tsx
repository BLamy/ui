import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkspaceRail, WorkspaceRailAction, WorkspaceRailHome, WorkspaceRailItem, WorkspaceRailList, WorkspaceRailSeparator } from './workspace-rail';
import { ChatFrame } from './chat.fixtures';
import '../../styles.css';

const meta: Meta = {
  title: 'Organisms/WorkspaceRail',
  decorators: [
    (Story) => (
      <ChatFrame className="flex h-[480px] w-[200px] overflow-hidden">
        <Story />
      </ChatFrame>
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

/** The same rail in the light chat scope. */
export const DiscordStyleLight: Story = {
  render: () => <Rail defaultSelectedKey="blui" home={{ mentions: 2 }} workspaces={discord} />,
  decorators: [
    (Story) => (
      <ChatFrame appearance="light" className="flex h-[480px] w-[200px]">
        <Story />
      </ChatFrame>
    ),
  ],
};
