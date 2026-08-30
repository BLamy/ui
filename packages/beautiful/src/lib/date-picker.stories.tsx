import type { Meta, StoryObj } from '@storybook/react-vite';
import { DatePicker } from './date-picker';
import { DatePickerDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof DatePicker> = {
  title: 'Molecules/DatePicker',
  component: DatePicker,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = { render: () => <DatePickerDemo /> };
export const WithValue: Story = {
  args: { value: new Date(2026, 7, 17) },
};
