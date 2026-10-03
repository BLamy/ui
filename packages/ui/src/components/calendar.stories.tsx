import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { I18nProvider, type DateValue } from 'react-aria-components';
import { CalendarDate, isWeekend, parseDate } from '@internationalized/date';
import { Calendar, RangeCalendar } from '@/components/ui/calendar';
import { Caption, Panel } from '../stories/primitive-frame';

/* The locale and every date are pinned (September 2026) so these look the same on any day, in any browser. */
const meta: Meta<typeof Calendar> = {
  title: 'Molecules/Calendar',
  component: Calendar,
  args: { 'aria-label': 'Appointment', defaultFocusedValue: parseDate('2026-09-09'), visibleMonths: 1, variant: 'plain' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'card'] },
    visibleMonths: { control: 'inline-radio', options: [1, 2, 3] },
  },
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={340}><Story /></Panel></I18nProvider>],
};
export default meta;
type Story = StoryObj<typeof Calendar>;

export const Default: Story = { args: { defaultValue: parseDate('2026-09-09') } };

export const Card: Story = { args: { variant: 'card', defaultValue: parseDate('2026-09-16') } };

export const Empty: Story = {};

export const MinMax: Story = {
  name: 'Min and max',
  args: { defaultValue: parseDate('2026-09-15'), minValue: parseDate('2026-09-08'), maxValue: parseDate('2026-09-24') },
};

export const Unavailable: Story = {
  name: 'Unavailable weekends',
  args: { defaultValue: parseDate('2026-09-09'), isDateUnavailable: (d: DateValue) => isWeekend(d, 'en-US') },
};

export const Disabled: Story = { args: { isDisabled: true, defaultValue: parseDate('2026-09-09') } };

export const TwoMonths: Story = {
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={600}><Story /></Panel></I18nProvider>],
  args: { visibleMonths: 2, defaultValue: parseDate('2026-09-30') },
};

export const Controlled: Story = {
  render: (args) => {
    const [value, setValue] = useState<DateValue | null>(new CalendarDate(2026, 9, 21));
    return (
      <>
        <Calendar {...args} value={value} onChange={setValue} />
        <Caption>{value ? value.toString() : 'No date'}</Caption>
      </>
    );
  },
};

const stay = { start: parseDate('2026-09-08'), end: parseDate('2026-09-13') };

export const Range: Story = { render: ({ variant, visibleMonths }) => <RangeCalendar variant={variant} visibleMonths={visibleMonths} aria-label="Stay" defaultValue={stay} /> };

export const RangeCard: Story = { render: ({ visibleMonths }) => <RangeCalendar visibleMonths={visibleMonths} variant="card" aria-label="Stay" defaultValue={stay} /> };

export const RangeOneDay: Story = {
  name: 'Range, one day',
  render: ({ variant, visibleMonths }) => <RangeCalendar variant={variant} visibleMonths={visibleMonths} aria-label="Stay" defaultValue={{ start: parseDate('2026-09-10'), end: parseDate('2026-09-10') }} />,
};

export const RangeTwoMonths: Story = {
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={600}><Story /></Panel></I18nProvider>],
  render: ({ variant }) => <RangeCalendar variant={variant} visibleMonths={2} aria-label="Stay" defaultValue={{ start: parseDate('2026-09-24'), end: parseDate('2026-10-06') }} />,
};

export const Dark: Story = {
  decorators: [(Story) => <I18nProvider locale="en-US"><Panel w={340} dark><Story /></Panel></I18nProvider>],
  render: ({ variant, visibleMonths }) => <RangeCalendar variant={variant} visibleMonths={visibleMonths} aria-label="Stay" defaultValue={stay} />,
};
