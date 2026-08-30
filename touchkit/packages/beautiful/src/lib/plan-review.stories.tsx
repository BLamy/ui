import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanReview } from './plan-review';
import { PlanReviewDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof PlanReview> = {
  title: 'Organisms/PlanReview',
  component: PlanReview,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof PlanReview>;

export const Default: Story = { render: () => <PlanReviewDemo /> };
export const Approved: Story = {
  render: () => (
    <PlanReview approved>
      <PlanReview.Step n={1} detail="3 files · read-only">
        Pull POS exports
      </PlanReview.Step>
      <PlanReview.Step n={2} detail="7 SKUs">
        Score stockout risk
      </PlanReview.Step>
    </PlanReview>
  ),
};
