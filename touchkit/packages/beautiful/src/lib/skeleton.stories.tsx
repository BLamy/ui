import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton, SkeletonAvatar, SkeletonText } from './skeleton';
import { SkeletonDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Skeleton> = {
  title: 'Atoms/Skeleton',
  component: Skeleton,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Block: Story = { args: { w: 220, h: 14 } };
export const Text: Story = {
  render: () => (
    <div style={{ width: 260 }}>
      <SkeletonText lines={3} />
    </div>
  ),
};
export const Avatar: Story = { render: () => <SkeletonAvatar size={32} /> };
export const Auto: Story = { render: () => <SkeletonDemo /> };
