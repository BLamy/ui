import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToolChips } from './tool-chips';
import { P } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof ToolChips> = {
  title: 'Molecules/ToolChips',
  component: ToolChips,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof ToolChips>;

export const Default: Story = {};
export const CustomTools: Story = {
  args: {
    summary: '2 tool calls',
    tools: [
      { icon: P['term'], name: 'run_forecast', detail: '1.2s', out: 'Forecasted demand for 7 SKUs.' },
      { icon: P['doc'], name: 'write plan.md', detail: 'draft', out: 'Drafted the plan.' },
    ],
  },
};
