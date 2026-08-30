import type { Meta, StoryObj } from '@storybook/react-vite';
import { FineTuneCard } from './fine-tune-card';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof FineTuneCard> = {
  title: 'Organisms/FineTuneCard',
  component: FineTuneCard,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof FineTuneCard>;

export const Default: Story = {};
export const CustomLabels: Story = {
  args: { title: 'Hero banner', previewLabel: 'Rocky Road' },
};
