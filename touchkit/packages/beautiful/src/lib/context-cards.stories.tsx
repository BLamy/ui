import type { Meta, StoryObj } from '@storybook/react-vite';
import { ContextCards } from './context-cards';
import { C } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof ContextCards> = {
  title: 'Organisms/ContextCards',
  component: ContextCards,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof ContextCards>;

export const Default: Story = {};
export const SingleChunk: Story = {
  args: {
    title: 'Top match',
    count: 1,
    chunks: [
      {
        t: 'Cold-chain policy',
        n: '180 characters',
        body: 'All dairy shipments must stay below 4°C door to door.',
        file: 'Logistics Handbook.pdf',
        kind: 'PDF',
        tone: C.red,
      },
    ],
  },
};
