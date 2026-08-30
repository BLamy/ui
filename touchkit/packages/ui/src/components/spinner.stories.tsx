import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './spinner';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Spinner> = {
  title: 'Atoms/Spinner',
  component: Spinner,
  decorators: [(Story) => <Pad><div style={{ color: 'var(--tk-label2)' }}><Story /></div></Pad>],
};
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Spinning: Story = { args: { spin: true } };
export const Idle: Story = { args: { spin: false } };
export const Large: Story = { args: { spin: true, size: 36 } };
