'use client';
import { useContext, type ComponentProps } from 'react';
import { getLocalTimeZone, isToday } from '@internationalized/date';
import {
  Calendar as AriaCalendar, type CalendarProps as AriaCalendarProps,
  CalendarCell as AriaCalendarCell, type CalendarCellProps as AriaCalendarCellProps,
  CalendarGrid as AriaCalendarGrid, type CalendarGridProps as AriaCalendarGridProps,
  CalendarGridBody, CalendarGridHeader, CalendarHeaderCell,
  RangeCalendar as AriaRangeCalendar, type RangeCalendarProps as AriaRangeCalendarProps,
  RangeCalendarStateContext,
  Heading,
  composeRenderProps,
  type DateValue,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ Calendar / RangeCalendar — react-aria's calendars (month grid, arrow-key and PageUp/PageDown navigation, locale
   week starts, min/max, unavailable dates) drawn as iOS: round day cells, a tint-filled selection, and for a range a
   soft band joining its two ends. Values are @internationalized/date objects (`parseDate("2026-09-09")`).
   <Calendar aria-label="Appointment" defaultValue={parseDate('2026-09-09')} />
   <RangeCalendar aria-label="Stay" visibleMonths={2} />
   Both render a header and the month grid(s); pass children to compose your own from CalendarHeader / CalendarGrid. ══ */

export const calendarVariants = cva('flex w-fit max-w-full flex-col text-foreground data-disabled:opacity-50', {
  variants: {
    /** `plain`: no surface (inside a popover or a sheet). `card`: sits on its own filled panel. */
    variant: {
      plain: '',
      card: 'rounded-panel bg-secondary p-3',
    },
  },
  defaultVariants: { variant: 'plain' },
});

/** Previous / next buttons around the month and year. Must sit inside a Calendar or RangeCalendar. */
export function CalendarHeader({ className, ...props }: ComponentProps<'header'>) {
  return (
    <header data-slot="calendar-header" className={cn('flex items-center gap-1 pb-2', className)} {...props}>
      <Button slot="previous" variant="quiet" size="icon" className="size-8">
        <Icon name="chevron-left" size={16} />
      </Button>
      <Heading className="min-w-0 flex-1 truncate text-center text-subhead font-semibold" />
      <Button slot="next" variant="quiet" size="icon" className="size-8">
        <Icon name="chevron-right" size={16} />
      </Button>
    </header>
  );
}

export interface CalendarCellProps extends Omit<AriaCalendarCellProps, 'children'> {}

/** One day. In a RangeCalendar the days between the ends are joined by a band; today is tinted. */
export function CalendarCell({ className, date, ...props }: CalendarCellProps) {
  const range = useContext(RangeCalendarStateContext) != null;
  const today = isToday(date, getLocalTimeZone());
  return (
    <AriaCalendarCell
      data-slot="calendar-cell"
      date={date}
      className={composeRenderProps(className, (cls) =>
        cn(
          'group/cell relative flex size-9 cursor-default items-center justify-center text-subhead outline-none data-outside-month:invisible data-disabled:opacity-30',
          // The band behind a range: full width between the ends, half a cell at each end, nothing on a one-day range.
          range && 'before:absolute before:inset-y-0 before:inset-x-0 before:hidden before:bg-primary/15 data-selected:before:block data-selection-start:before:left-1/2 data-selection-end:before:right-1/2',
          cls,
        ),
      )}
      {...props}
    >
      {({ formattedDate }) => (
        <span
          className={cn(
            'relative z-1 grid size-9 place-items-center rounded-full tabular-nums transition-colors duration-spring-snappy ease-spring-snappy',
            'cursor-pointer not-group-data-selected/cell:group-data-hovered/cell:bg-secondary-strong group-data-focus-visible/cell:ring-2 group-data-focus-visible/cell:ring-ring',
            'group-data-unavailable/cell:text-destructive group-data-unavailable/cell:line-through group-data-disabled/cell:cursor-default',
            today && 'font-semibold text-primary',
            range
              ? 'group-data-selection-start/cell:bg-primary group-data-selection-start/cell:text-primary-foreground group-data-selection-end/cell:bg-primary group-data-selection-end/cell:text-primary-foreground'
              : 'group-data-selected/cell:bg-primary group-data-selected/cell:text-primary-foreground',
          )}
        >
          {formattedDate}
        </span>
      )}
    </AriaCalendarCell>
  );
}

/** A month: the weekday row and its days. `offset` shifts it forward by months (for a multi-month calendar). */
export function CalendarGrid({ className, ...props }: Omit<AriaCalendarGridProps, 'children'>) {
  return (
    <AriaCalendarGrid data-slot="calendar-grid" className={cn('border-separate border-spacing-0', className)} {...props}>
      <CalendarGridHeader>
        {(day) => <CalendarHeaderCell className="h-8 text-center text-caption font-medium text-muted-foreground">{day}</CalendarHeaderCell>}
      </CalendarGridHeader>
      <CalendarGridBody>{(date) => <CalendarCell date={date} />}</CalendarGridBody>
    </AriaCalendarGrid>
  );
}

function Months({ count }: { count: number }) {
  return (
    <div className="flex gap-6">
      {Array.from({ length: count }, (_, i) => <CalendarGrid key={i} offset={{ months: i }} />)}
    </div>
  );
}

interface CalendarExtras extends VariantProps<typeof calendarVariants> {
  /** How many months to show side by side. Default: 1. */
  visibleMonths?: 1 | 2 | 3;
}

export interface CalendarProps<T extends DateValue> extends AriaCalendarProps<T>, CalendarExtras {}

export function Calendar<T extends DateValue>({ className, variant, visibleMonths = 1, children, ...props }: CalendarProps<T>) {
  return (
    <AriaCalendar<T>
      data-slot="calendar"
      visibleDuration={{ months: visibleMonths }}
      className={composeRenderProps(className, (cls) => cn(calendarVariants({ variant }), cls))}
      {...props}
    >
      {children ?? (
        <>
          <CalendarHeader />
          <Months count={visibleMonths} />
        </>
      )}
    </AriaCalendar>
  );
}

export interface RangeCalendarProps<T extends DateValue> extends AriaRangeCalendarProps<T>, CalendarExtras {}

export function RangeCalendar<T extends DateValue>({ className, variant, visibleMonths = 1, children, ...props }: RangeCalendarProps<T>) {
  return (
    <AriaRangeCalendar<T>
      data-slot="range-calendar"
      visibleDuration={{ months: visibleMonths }}
      className={composeRenderProps(className, (cls) => cn(calendarVariants({ variant }), cls))}
      {...props}
    >
      {children ?? (
        <>
          <CalendarHeader />
          <Months count={visibleMonths} />
        </>
      )}
    </AriaRangeCalendar>
  );
}
