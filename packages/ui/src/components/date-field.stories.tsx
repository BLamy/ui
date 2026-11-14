import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateField, TimeField } from '@/components/ui/date-field';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Panel } from '../stories/primitive-frame';

/* The locale is pinned so the order (month, day, year) and the 12-hour clock are the same in any browser. */
const meta: Meta<typeof DateField> = {
  title: 'Molecules/DateField',
  component: DateField,
  args: { locale: 'en-US', variant: 'field', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['field', 'bare'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    granularity: { control: 'inline-radio', options: ['day', 'hour', 'minute', 'second'] },
  },
  decorators: [(Story) => <Panel w={360}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof DateField>;

export const Default: Story = {
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Birthday</FieldLabel>
      <DateField {...args} defaultValue="2026-09-09" />
      <FieldDescription>Month, day, then year — type or use the arrow keys.</FieldDescription>
    </Field>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Due</FieldLabel>
      <DateField {...args} />
    </Field>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <DateField key={s} {...args} aria-label={s} size={s} defaultValue="2026-09-09" />
      ))}
    </>
  ),
};

export const WithTime: Story = {
  name: 'Date and time',
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Starts</FieldLabel>
      <DateField {...args} granularity="minute" defaultValue="2026-09-09T09:30" />
    </Field>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <Field invalid>
      <FieldLabel variant="field">Due</FieldLabel>
      <DateField {...args} defaultValue="2026-09-09" />
      <FieldError>Pick a date after today.</FieldError>
    </Field>
  ),
};

export const OutOfRange: Story = {
  name: 'Before min',
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Check-in</FieldLabel>
      <DateField {...args} defaultValue="2026-08-20" min="2026-09-01" />
      <FieldDescription>From 1 September 2026.</FieldDescription>
    </Field>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Field disabled>
      <FieldLabel variant="field">Due</FieldLabel>
      <DateField {...args} defaultValue="2026-09-09" />
    </Field>
  ),
};

export const TimeOnly: Story = {
  render: ({ size, variant }) => (
    <Field>
      <FieldLabel variant="field">Alarm</FieldLabel>
      <TimeField locale="en-US" size={size} variant={variant} defaultValue="09:30" />
    </Field>
  ),
};

export const TimeWithSeconds: Story = {
  name: 'Time, 24-hour with seconds',
  render: ({ size, variant }) => (
    <Field>
      <FieldLabel variant="field">Departure</FieldLabel>
      <TimeField locale="en-US" size={size} variant={variant} hourCycle={24} granularity="second" defaultValue="14:45:10" />
    </Field>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={360} dark><Story /></Panel>],
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Birthday</FieldLabel>
      <DateField {...args} defaultValue="2026-09-09" />
    </Field>
  ),
};
