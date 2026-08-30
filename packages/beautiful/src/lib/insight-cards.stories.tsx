import type { Meta, StoryObj } from '@storybook/react-vite';
import { INSIGHTS_DEMO, InsightCards, Spark } from './insight-cards';
import { C } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof InsightCards> = {
  title: 'Organisms/InsightCards',
  component: InsightCards,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof InsightCards>;

export const Default: Story = {};
export const SingleInsight: Story = {
  args: { insights: [INSIGHTS_DEMO[2]], count: 1 },
};
export const SparkOnly: Story = {
  render: () => (
    <div style={{ width: 200 }}>
      <Spark pts={[18, 20, 19, 23, 22, 26, 25, 29, 31]} tone={C.green} />
    </div>
  ),
};
