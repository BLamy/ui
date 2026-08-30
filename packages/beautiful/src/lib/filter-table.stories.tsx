import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterTable } from './filter-table';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof FilterTable> = {
  title: 'Organisms/FilterTable',
  component: FilterTable,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof FilterTable>;

export const Default: Story = {};
