import type { Meta, StoryObj } from '@storybook/react-vite';
import { AgentBoard } from './agent-board';
import { AgentBoardDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof AgentBoard> = {
  title: 'Organisms/AgentBoard',
  component: AgentBoard,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof AgentBoard>;

export const Live: Story = { render: () => <AgentBoardDemo /> };
export const AllStates: Story = {
  render: () => (
    <AgentBoard>
      <AgentBoard.Agent name="Researcher" task="Scanning supplier catalogs" state="running" progress={0.4} />
      <AgentBoard.Agent name="Analyst" task="Scoring stockout risk" state="running" />
      <AgentBoard.Agent name="Writer" task="Drafted 2 supplier emails" state="done" />
      <AgentBoard.Agent name="Checker" task="Cold-chain cert lookup failed" state="failed" />
      <AgentBoard.Agent name="Scheduler" task="Waiting on plan approval" state="idle" />
    </AgentBoard>
  ),
};
