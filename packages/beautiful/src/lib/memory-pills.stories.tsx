import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryPills } from './memory-pills';
import { MemoryPillsDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof MemoryPills> = {
  title: 'Molecules/MemoryPills',
  component: MemoryPills,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof MemoryPills>;

export const Default: Story = { render: () => <MemoryPillsDemo /> };
export const Static: Story = {
  render: () => (
    <MemoryPills label="Session memory">
      <MemoryPills.Pill icon="user">Prefers metric units</MemoryPills.Pill>
      <MemoryPills.Pill icon="cal">Reorders run Tuesdays</MemoryPills.Pill>
    </MemoryPills>
  ),
};
