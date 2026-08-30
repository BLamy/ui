import type { Meta, StoryObj } from '@storybook/react-vite';
import { C, Meter } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Meter> = {
  title: 'Atoms/Meter',
  component: Meter,
  decorators: [darkDecorator],
  args: { v: 0.68 },
  argTypes: { v: { control: { type: 'range', min: 0, max: 1, step: 0.01 } } },
};
export default meta;
type Story = StoryObj<typeof Meter>;

export const Default: Story = {};
export const Green: Story = { args: { v: 0.88, tone: C.green } };
export const Orange: Story = { args: { v: 0.45, tone: C.orange } };
export const Scale: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Meter v={0.15} tone={C.red} />
      <Meter v={0.45} tone={C.orange} />
      <Meter v={0.68} />
      <Meter v={0.88} tone={C.green} />
    </div>
  ),
};
