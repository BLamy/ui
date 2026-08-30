import type { Meta, StoryObj } from '@storybook/react-vite';
import { StateDot } from './task-rows';
import { mut } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof StateDot> = {
  title: 'Atoms/StateDot',
  component: StateDot,
  decorators: [darkDecorator],
  args: { s: 'run' },
  argTypes: { s: { control: 'radio', options: ['done', 'run', 'wait'] } },
};
export default meta;
type Story = StoryObj<typeof StateDot>;

export const Running: Story = { args: { s: 'run' } };
export const Done: Story = { args: { s: 'done' } };
export const Waiting: Story = { args: { s: 'wait' } };
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, fontSize: 12.5, color: mut }}>
      {(['done', 'run', 'wait'] as const).map((s) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StateDot s={s} />
          {s}
        </div>
      ))}
    </div>
  ),
};
