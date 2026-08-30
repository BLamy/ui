import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingState } from './loading-state';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof LoadingState> = {
  title: 'Molecules/LoadingState',
  component: LoadingState,
  decorators: [darkDecorator],
  args: { variant: 'grid', label: 'Churning' },
  argTypes: { variant: { control: 'radio', options: ['grid', 'dots', 'orbit'] } },
};
export default meta;
type Story = StoryObj<typeof LoadingState>;

export const Grid: Story = { args: { variant: 'grid' } };
export const Dots: Story = { args: { variant: 'dots' } };
export const Orbit: Story = { args: { variant: 'orbit' } };
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
      <LoadingState variant="grid" />
      <LoadingState variant="dots" label="Streaming" />
      <LoadingState variant="orbit" label="Fetching" />
    </div>
  ),
};
