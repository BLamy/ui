import type { Meta, StoryObj } from '@storybook/react-vite';
import { TaskRows } from './task-rows';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof TaskRows> = {
  title: 'Organisms/TaskRows',
  component: TaskRows,
  decorators: [darkDecorator],
  argTypes: { defaultMode: { control: 'radio', options: ['capsules', 'list'] } },
};
export default meta;
type Story = StoryObj<typeof TaskRows>;

export const Capsules: Story = { args: { defaultMode: 'capsules' } };
export const List: Story = { args: { defaultMode: 'list' } };
