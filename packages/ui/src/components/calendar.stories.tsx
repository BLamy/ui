import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Calendar, CalendarGrid, CalendarHeader, CalendarHeading, CalendarMonthSelect, CalendarYearSelect, type CalendarValue } from '@/components/ui/calendar';
import { Caption, Panel } from '../stories/primitive-frame';

/* The locale, the month on show and "today" are pinned (September 2026, with today outside it) so these look the
   same on any day, in any browser. */
const meta: Meta<typeof Calendar> = {
  title: 'Molecules/Calendar',
  component: Calendar,
  args: { locale: 'en-US', defaultMonth: '2026-09', today: '2026-01-01', months: 1, variant: 'plain' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['plain', 'card'] },
    months: { control: 'inline-radio', options: [1, 2, 3] },
    mode: { control: 'inline-radio', options: ['single', 'multiple', 'range'] },
  },
  decorators: [(Story) => <Panel w={340}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Calendar>;

export const Default: Story = { args: { defaultValue: '2026-09-09' } };

export const Card: Story = { args: { variant: 'card', defaultValue: '2026-09-16' } };

export const Empty: Story = {};

export const Today: Story = { args: { today: '2026-09-16', defaultValue: '2026-09-09' } };

export const MinMax: Story = {
  name: 'Min and max',
  args: { defaultValue: '2026-09-15', min: '2026-09-08', max: '2026-09-24' },
};

export const Unavailable: Story = {
  name: 'Unavailable weekends',
  args: { defaultValue: '2026-09-09', unavailable: { weekday: [0, 6] } },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: '2026-09-09' } };

export const OutsideDays: Story = {
  name: 'Outside days, six weeks',
  args: { showOutsideDays: true, fixedWeeks: true, defaultValue: '2026-09-09' },
};

export const TwoMonths: Story = {
  decorators: [(Story) => <Panel w={600}><Story /></Panel>],
  args: { months: 2, defaultValue: '2026-09-30' },
};

export const MonthAndYearSelects: Story = {
  name: 'Month and year selects',
  args: { defaultValue: '1990-05-17', defaultMonth: '1990-05', min: '1950-01-01', max: '2026-12-31' },
  render: (args) => (
    <Calendar {...args}>
      <CalendarHeader>
        <CalendarHeading className="sr-only" />
        <CalendarMonthSelect className="flex-1" />
        <CalendarYearSelect />
      </CalendarHeader>
      <CalendarGrid />
    </Calendar>
  ),
};

export const Controlled: Story = {
  render: ({ variant, months, locale, defaultMonth, today }) => {
    const [value, setValue] = useState<CalendarValue<'single'>>('2026-09-21');
    return (
      <>
        <Calendar variant={variant} months={months} locale={locale} defaultMonth={defaultMonth} today={today} value={value} onValueChange={setValue} />
        <Caption>{value ?? 'No date'}</Caption>
      </>
    );
  },
};

export const Multiple: Story = { args: { mode: 'multiple', defaultValue: ['2026-09-03', '2026-09-09', '2026-09-22'] } };

const stay: CalendarValue<'range'> = ['2026-09-08', '2026-09-13'];

export const Range: Story = { args: { mode: 'range', defaultValue: stay } };

export const RangeCard: Story = { args: { mode: 'range', variant: 'card', defaultValue: stay } };

export const RangeOneDay: Story = {
  name: 'Range, one day',
  args: { mode: 'range', defaultValue: ['2026-09-10', '2026-09-10'] },
};

export const RangeTwoMonths: Story = {
  decorators: [(Story) => <Panel w={600}><Story /></Panel>],
  args: { mode: 'range', months: 2, defaultValue: ['2026-09-24', '2026-10-06'] },
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={340} dark><Story /></Panel>],
  args: { mode: 'range', defaultValue: stay },
};
