import type { Meta, StoryObj } from '@storybook/react-vite';
import { RecordsTable, Strength } from './records-table';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof RecordsTable> = {
  title: 'Organisms/RecordsTable',
  component: RecordsTable,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof RecordsTable>;

export const Default: Story = {};
export const StrengthScale: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <Strength key={v} v={v} />
      ))}
    </div>
  ),
};
