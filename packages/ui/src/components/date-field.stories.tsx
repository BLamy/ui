import type { Meta, StoryObj } from '@storybook/react-vite';
import { I18nProvider } from 'react-aria-components';
import { parseDate, parseDateTime, Time } from '@internationalized/date';
import { DateField, DateInput, TimeField } from '@/components/ui/date-field';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldError } from '@/components/ui/text-field';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof DateField> = {
  title: 'Molecules/DateField',
  component: DateField,
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={360}><Story /></Panel></I18nProvider>],
};
export default meta;
type Story = StoryObj<typeof DateField>;

export const Default: Story = {
  render: (args) => (
    <DateField {...args} defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Birthday</Label>
      <DateInput />
      <FieldDescription>Month, day, then year — type or use the arrow keys.</FieldDescription>
    </DateField>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <DateField {...args}>
      <Label variant="field">Due</Label>
      <DateInput />
    </DateField>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <DateField key={s} {...args} aria-label={s} defaultValue={parseDate('2026-09-09')}><DateInput size={s} /></DateField>
      ))}
    </>
  ),
};

export const WithTime: Story = {
  name: 'Date and time',
  render: (args) => (
    <DateField {...args} granularity="minute" defaultValue={parseDateTime('2026-09-09T09:30')}>
      <Label variant="field">Starts</Label>
      <DateInput />
    </DateField>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <DateField {...args} isInvalid defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Due</Label>
      <DateInput />
      <FieldError>Pick a date after today.</FieldError>
    </DateField>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <DateField {...args} isDisabled defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Due</Label>
      <DateInput />
    </DateField>
  ),
};

export const TimeOnly: Story = {
  render: () => (
    <TimeField defaultValue={new Time(9, 30)}>
      <Label variant="field">Alarm</Label>
      <DateInput />
    </TimeField>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={360} dark><Story /></Panel></I18nProvider>],
  render: (args) => (
    <DateField {...args} defaultValue={parseDate('2026-09-09')}>
      <Label variant="field">Birthday</Label>
      <DateInput />
    </DateField>
  ),
};
