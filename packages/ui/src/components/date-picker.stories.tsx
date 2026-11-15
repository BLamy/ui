import type { Meta, StoryObj } from '@storybook/react-vite';
import { CalendarGrid, CalendarHeader } from '@/components/ui/calendar';
import { TimeInput } from '@/components/ui/date-input';
import {
  DatePicker,
  DatePickerClear,
  DatePickerContent,
  DatePickerInputGroup,
  DatePickerHint,
  DatePickerInput,
  DatePickerPreset,
  DatePickerTrigger,
} from '@/components/ui/date-picker';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Panel } from '../stories/primitive-frame';

/* The locale, the month on show and "today" are pinned so the popup shows September 2026 on any day. */
const meta: Meta<typeof DatePicker> = {
  title: 'Molecules/DatePicker',
  component: DatePicker,
  args: { locale: 'en-US', defaultMonth: '2026-09', today: '2026-01-01' },
  // One frame for every story: `parameters.dark` and `parameters.height` (tall enough for the open popup) change it.
  decorators: [(Story, { parameters }) => (
    <Panel w={380} dark={parameters.dark}><div style={{ height: parameters.height ?? 420 }}><Story /></div></Panel>
  )],
};
export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  render: (args) => (
    <Field>
      <FieldLabel>Date</FieldLabel>
      <DatePicker {...args} defaultValue="2026-09-09">
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
      <FieldDescription>Type a date, or open the calendar.</FieldDescription>
    </Field>
  ),
};

export const Open: Story = {
  render: (args) => (
    <Field>
      <FieldLabel>Date</FieldLabel>
      <DatePicker {...args} defaultOpen defaultValue="2026-09-09">
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
    </Field>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Field>
      <FieldLabel>Due</FieldLabel>
      <DatePicker {...args} defaultOpen>
        <DatePickerInputGroup />
        <DatePickerHint />
        <DatePickerContent />
      </DatePicker>
    </Field>
  ),
};

export const WithTime: Story = {
  name: 'Date and time',
  render: (args) => (
    <div className="flex items-end gap-3">
      <Field className="min-w-0 flex-1">
        <FieldLabel>Starts</FieldLabel>
        <DatePicker {...args} defaultValue="2026-09-09">
          <DatePickerInputGroup />
          <DatePickerContent />
        </DatePicker>
      </Field>
      <TimeInput aria-label="Start time" locale="en-US" defaultValue="09:30" className="w-auto" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <DatePicker key={s} {...args} defaultValue="2026-09-09">
          <DatePickerInputGroup size={s}>
            <DatePickerInput aria-label={s} />
            <DatePickerTrigger />
          </DatePickerInputGroup>
          <DatePickerContent />
        </DatePicker>
      ))}
    </div>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <Field invalid>
      <FieldLabel>Due</FieldLabel>
      <DatePicker {...args} defaultValue="2026-09-09">
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
      <FieldError>Pick a date after today.</FieldError>
    </Field>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Field disabled>
      <FieldLabel>Due</FieldLabel>
      <DatePicker {...args} defaultValue="2026-09-09">
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
    </Field>
  ),
};

export const Clearable: Story = {
  render: (args) => (
    <Field>
      <FieldLabel>Due</FieldLabel>
      <DatePicker {...args} defaultValue="2026-09-09">
        <DatePickerInputGroup>
          <DatePickerInput />
          <DatePickerClear />
          <DatePickerTrigger />
        </DatePickerInputGroup>
        <DatePickerContent />
      </DatePicker>
    </Field>
  ),
};

export const Presets: Story = {
  parameters: { height: 520 },
  render: (args) => (
    <Field>
      <FieldLabel>Due</FieldLabel>
      <DatePicker {...args} defaultOpen defaultValue="2026-09-09">
        <DatePickerInputGroup />
        <DatePickerContent>
          <CalendarHeader />
          <CalendarGrid />
          <div className="flex flex-wrap gap-1 pt-2">
            <DatePickerPreset value="2026-09-09">Today</DatePickerPreset>
            <DatePickerPreset value="2026-09-10">Tomorrow</DatePickerPreset>
            <DatePickerPreset value="2026-09-16">In a week</DatePickerPreset>
          </div>
        </DatePickerContent>
      </DatePicker>
    </Field>
  ),
};

export const Range: Story = {
  args: { mode: 'range', defaultValue: ['2026-09-08', '2026-09-13'] },
  render: (args) => (
    <Field>
      <FieldLabel>Stay</FieldLabel>
      <DatePicker {...args}>
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
      <FieldDescription>Check-in to check-out.</FieldDescription>
    </Field>
  ),
};

export const RangeOpen: Story = {
  parameters: { height: 460 },
  args: { mode: 'range', defaultValue: ['2026-09-08', '2026-09-13'] },
  render: (args) => (
    <Field>
      <FieldLabel>Stay</FieldLabel>
      <DatePicker {...args} defaultOpen>
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
    </Field>
  ),
};

export const Dark: Story = {
  parameters: { dark: true },
  render: (args) => (
    <Field>
      <FieldLabel>Date</FieldLabel>
      <DatePicker {...args} defaultOpen defaultValue="2026-09-09">
        <DatePickerInputGroup />
        <DatePickerContent />
      </DatePicker>
    </Field>
  ),
};
