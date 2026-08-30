import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreamingText } from './streaming-text';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof StreamingText> = {
  title: 'Molecules/StreamingText',
  component: StreamingText,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof StreamingText>;

export const Default: Story = {};
export const CustomText: Story = {
  args: {
    text: 'Vanilla holds steady while sorbet demand doubles every heatwave — pre-batch on Fridays.',
    sourcesLabel: '3 sources',
    followUps: ['Which sorbets move fastest'],
  },
};
