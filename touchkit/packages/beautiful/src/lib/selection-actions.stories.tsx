import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectionActions } from './selection-actions';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof SelectionActions> = {
  title: 'Molecules/SelectionActions',
  component: SelectionActions,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof SelectionActions>;

export const Default: Story = {};
export const CustomActions: Story = {
  args: {
    actions: ['Summarize', 'Translate'],
    children:
      'Kumo Creamery wants a vegan line by spring. Their Tokyo cafe traffic doubles during cherry-blossom season, so timing the launch matters.',
  },
};
