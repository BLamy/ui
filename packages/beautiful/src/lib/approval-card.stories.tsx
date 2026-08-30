import type { Meta, StoryObj } from '@storybook/react-vite';
import { ApprovalCard } from './approval-card';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof ApprovalCard> = {
  title: 'Molecules/ApprovalCard',
  component: ApprovalCard,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof ApprovalCard>;

export const Default: Story = {};
export const TwoOptions: Story = {
  args: {
    question: 'Ship the reorder plan now?',
    options: ['Yes, send it', 'Hold for review'],
  },
};
