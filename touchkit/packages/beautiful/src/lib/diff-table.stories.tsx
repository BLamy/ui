import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiffTable } from './diff-table';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof DiffTable> = {
  title: 'Organisms/DiffTable',
  component: DiffTable,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof DiffTable>;

export const Default: Story = {};
