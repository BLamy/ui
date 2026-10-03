import type { Meta, StoryObj } from '@storybook/react-vite';
import { I18nProvider } from 'react-aria-components';
import { parseDate, parseDateTime } from '@internationalized/date';
import { DatePicker, DatePickerContent, DatePickerField, DateRangePicker, DateRangePickerContent, DateRangePickerField } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldError } from '@/components/ui/text-field';
import { Panel } from '../stories/primitive-frame';

/* Dates and locale are pinned so the popover shows September 2026 on any day. */
const meta: Meta<typeof DatePicker> = {
  title: 'Molecules/DatePicker',
  component: DatePicker,
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={380}><div className="h-[420px]"><Story /></div></Panel></I18nProvider>],
};
export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  render: (args) => (
    <DatePicker {...args} defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Date</Label>
      <DatePickerField />
      <FieldDescription>Type a date, or open the calendar.</FieldDescription>
      <DatePickerContent />
    </DatePicker>
  ),
};

export const Open: Story = {
  render: (args) => (
    <DatePicker {...args} defaultOpen defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Date</Label>
      <DatePickerField />
      <DatePickerContent />
    </DatePicker>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <DatePicker {...args} defaultOpen>
      <Label variant="field">Due</Label>
      <DatePickerField />
      <DatePickerContent calendarProps={{ defaultFocusedValue: parseDate('2026-09-09') }} />
    </DatePicker>
  ),
};

export const WithTime: Story = {
  name: 'Date and time',
  render: (args) => (
    <DatePicker {...args} granularity="minute" defaultValue={parseDateTime('2026-09-09T09:30')}>
      <Label variant="field">Starts</Label>
      <DatePickerField />
      <DatePickerContent />
    </DatePicker>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <DatePicker key={s} {...args} aria-label={s} defaultValue={parseDate('2026-09-09')}>
          <DatePickerField size={s} />
          <DatePickerContent />
        </DatePicker>
      ))}
    </div>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <DatePicker {...args} isInvalid defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Due</Label>
      <DatePickerField />
      <FieldError>Pick a date after today.</FieldError>
      <DatePickerContent />
    </DatePicker>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <DatePicker {...args} isDisabled defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Due</Label>
      <DatePickerField />
      <DatePickerContent />
    </DatePicker>
  ),
};

export const Range: Story = {
  render: () => (
    <DateRangePicker defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }}>
      <Label variant="field">Stay</Label>
      <DateRangePickerField />
      <FieldDescription>Check-in to check-out.</FieldDescription>
      <DateRangePickerContent />
    </DateRangePicker>
  ),
};

export const RangeOpen: Story = {
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={380}><div className="h-[460px]"><Story /></div></Panel></I18nProvider>],
  render: () => (
    <DateRangePicker defaultOpen defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }}>
      <Label variant="field">Stay</Label>
      <DateRangePickerField />
      <DateRangePickerContent />
    </DateRangePicker>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={380} dark><div className="h-[420px]"><Story /></div></Panel></I18nProvider>],
  render: (args) => (
    <DatePicker {...args} defaultOpen defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Date</Label>
      <DatePickerField />
      <DatePickerContent />
    </DatePicker>
  ),
};
