import type { Meta, StoryObj } from '@storybook/react-vite';
import { BChip, BIcon, C, P } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof BChip> = {
  title: 'Atoms/Chip',
  component: BChip,
  decorators: [darkDecorator],
  args: { children: 'Seasonal' },
};
export default meta;
type Story = StoryObj<typeof BChip>;

export const Default: Story = {};
export const Active: Story = { args: { active: true, children: 'Active chip' } };
export const Toned: Story = {
  args: { tone: C.teal },
  render: (args) => (
    <BChip {...args}>
      <BIcon d={P['globe']} size={12} />
      scoopdata.io
    </BChip>
  ),
};
export const Pressable: Story = {
  args: { onPress: () => undefined, children: 'Press me' },
};
export const Row: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <BChip active>All</BChip>
      <BChip>To do</BChip>
      <BChip>In Progress</BChip>
      <BChip tone={C.green}>Completed</BChip>
    </div>
  ),
};
