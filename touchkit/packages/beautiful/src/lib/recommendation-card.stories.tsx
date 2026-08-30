import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecommendationCard } from './recommendation-card';
import { C } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof RecommendationCard> = {
  title: 'Molecules/RecommendationCard',
  component: RecommendationCard,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof RecommendationCard>;

export const Default: Story = {};
export const LowConfidence: Story = {
  args: {
    title: 'Retire Bubblegum this quarter?',
    description: 'Sales are below the retirement line, but the retro line drives foot traffic.',
    confidence: 0.35,
    confidenceTone: C.orange,
    confidenceLabel: 'Low confidence',
    acceptLabel: 'Retire it',
    acceptedLabel: '✓ Retired',
  },
};
