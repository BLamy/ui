'use client';
import type { ComponentProps, ReactNode } from 'react';
import {
  Calendar as SdkCalendar,
  CalendarDay as SdkCalendarDay,
  CalendarGrid as SdkCalendarGrid,
  CalendarHeading as SdkCalendarHeading,
  CalendarMonthSelect as SdkCalendarMonthSelect,
  CalendarNext as SdkCalendarNext,
  CalendarPrevious as SdkCalendarPrevious,
  CalendarWeekday as SdkCalendarWeekday,
  CalendarWeekdays as SdkCalendarWeekdays,
  CalendarWeeks as SdkCalendarWeeks,
  CalendarYearSelect as SdkCalendarYearSelect,
  type CalendarDayState,
  type CalendarMode,
  type CalendarValue,
} from '@ui-sdk/react/calendar';
import { cva, type VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';

/* ══ Calendar — UI SDK's Calendar (month grids with one tab stop, arrow-key and PageUp/PageDown navigation, locale
   week starts, min/max, unavailable dates) drawn as iOS: round day cells, a tint-filled selection, and for a range a
   soft band joining its two ends. Dates are ISO strings ("2026-09-09", no time, no zone); `mode` picks one date,
   several, or a range.
   <Calendar defaultValue="2026-09-09" />
   <Calendar mode="range" months={2} defaultValue={['2026-09-08', '2026-09-13']} />
   It renders a header and its month grids; pass children to compose your own from CalendarHeader / CalendarGrid.
   The same parts work inside a DatePickerContent. ══ */

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

const stepButton = cn(buttonVariants({ variant: 'quiet', size: 'icon' }), 'size-8');

/** Shows the month before. Named "Previous month"; pass `aria-label` in another language. */
export function CalendarPrevious({ className, children, ...props }: ComponentProps<typeof SdkCalendarPrevious>) {
  return (
    <SdkCalendarPrevious className={cx(stepButton, className)} {...props}>
      {children ?? <Icon name="chevron-left" size={16} className="rtl:-scale-x-100" />}
    </SdkCalendarPrevious>
  );
}

/** Shows the month after. Named "Next month"; pass `aria-label` in another language. */
export function CalendarNext({ className, children, ...props }: ComponentProps<typeof SdkCalendarNext>) {
  return (
    <SdkCalendarNext className={cx(stepButton, className)} {...props}>
      {children ?? <Icon name="chevron-right" size={16} className="rtl:-scale-x-100" />}
    </SdkCalendarNext>
  );
}

/** The months on show, like "September 2026". Screen readers hear it change. Its block margins (an h2's .83em)
    set the header's height. */
export function CalendarHeading({ className, ...props }: ComponentProps<typeof SdkCalendarHeading>) {
  return <SdkCalendarHeading className={cx('mx-0 my-[.83em] min-w-0 flex-1 truncate text-center text-subhead font-semibold', className)} {...props} />;
}

const headerSelect =
  'h-8 min-w-0 cursor-pointer rounded-lg border-0 bg-transparent px-1.5 [font-family:inherit] text-subhead font-semibold text-foreground outline-none transition-colors duration-spring-snappy ease-spring-snappy hover:not-data-disabled:bg-secondary focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-default data-disabled:opacity-40';

/** A native select of the months, to jump straight to one (a birthday). Use it in place of the heading's text. */
export function CalendarMonthSelect({ className, ...props }: ComponentProps<typeof SdkCalendarMonthSelect>) {
  return <SdkCalendarMonthSelect className={cx(headerSelect, className)} {...props} />;
}

/** A native select of the years from `min` to `max` (ten either side of the year on show without them). */
export function CalendarYearSelect({ className, ...props }: ComponentProps<typeof SdkCalendarYearSelect>) {
  return <SdkCalendarYearSelect className={cx(headerSelect, className)} {...props} />;
}

/** The row over the grids: previous and next around the month and year. Pass children to lay out your own
    (a CalendarMonthSelect and a CalendarYearSelect, say); keep a CalendarHeading in it so the grids stay named. */
export function CalendarHeader({ className, children, ...props }: ComponentProps<'header'>) {
  return (
    <header data-slot="calendar-header" className={cn('flex items-center gap-1 pb-2', className)} {...props}>
      {children ?? (
        <>
          <CalendarPrevious />
          <CalendarHeading />
          <CalendarNext />
        </>
      )}
    </header>
  );
}

/** A weekday's column header. Shows its name in `weekdayFormat`; screen readers hear the full name. */
export function CalendarWeekday({ className, ...props }: ComponentProps<typeof SdkCalendarWeekday>) {
  return <SdkCalendarWeekday className={cx('h-8 p-0 text-center text-caption font-medium text-muted-foreground', className)} {...props} />;
}

/** The header row. Its children can be a function of the column's index, to render your own CalendarWeekday. */
export function CalendarWeekdays({ children, ...props }: ComponentProps<typeof SdkCalendarWeekdays>) {
  return <SdkCalendarWeekdays {...props}>{children ?? ((index) => <CalendarWeekday index={index} />)}</SdkCalendarWeekdays>;
}

export type CalendarDayProps = Omit<ComponentProps<typeof SdkCalendarDay>, 'children'> & {
  /** Replaces the number inside the circle (a price under it, a dot). A function receives the day's state. */
  children?: ReactNode | ((day: CalendarDayState) => ReactNode);
};

/** One day. A range's ends are filled and the days between are joined by a band (half a cell at each end, none
    on a one-day range); today is tinted, and an unavailable day is struck through. */
export function CalendarDay({ className, children, ...props }: CalendarDayProps) {
  return (
    <SdkCalendarDay
      className={cx(
        [
          'group/day relative size-9 cursor-default p-0 text-center text-subhead outline-none',
          'data-outside:text-muted-foreground data-disabled:not-data-unavailable:opacity-30',
          'before:absolute before:inset-0 before:hidden before:bg-primary/15 data-range-start:before:block data-range-middle:before:block data-range-end:before:block data-range-start:before:start-1/2 data-range-end:before:end-1/2',
        ],
        className,
      )}
      {...props}
    >
      {(day: CalendarDayState) => {
        const filled = day.selected && (!day.inRange || day.rangeStart || day.rangeEnd);
        return (
          <span
            className={cn(
              'relative z-1 grid size-9 place-items-center rounded-full tabular-nums transition-colors duration-spring-snappy ease-spring-snappy',
              'cursor-pointer not-group-data-selected/day:not-group-data-disabled/day:group-hover/day:bg-secondary-strong group-focus-visible/day:ring-2 group-focus-visible/day:ring-ring',
              'group-data-unavailable/day:text-destructive group-data-unavailable/day:line-through group-data-disabled/day:cursor-default',
              day.today && 'font-semibold text-primary',
              filled && 'bg-primary text-primary-foreground',
            )}
          >
            {typeof children === 'function' ? children(day) : (children ?? day.label)}
          </span>
        );
      }}
    </SdkCalendarDay>
  );
}

/** The week rows. Its children can be a function of a cell, to render your own CalendarDay for `cell.date`. */
export function CalendarWeeks({ children, ...props }: ComponentProps<typeof SdkCalendarWeeks>) {
  return <SdkCalendarWeeks {...props}>{children ?? ((cell) => <CalendarDay value={cell.date} />)}</SdkCalendarWeeks>;
}

/** A month: the weekday row and its days. `offset` picks which of the months on show it is, from 0. */
export function CalendarGrid({ className, children, ...props }: ComponentProps<typeof SdkCalendarGrid>) {
  return (
    <SdkCalendarGrid className={cx('border-separate border-spacing-0', className)} {...props}>
      {children ?? (
        <>
          <CalendarWeekdays />
          <CalendarWeeks />
        </>
      )}
    </SdkCalendarGrid>
  );
}

type SdkCalendarProps = ComponentProps<typeof SdkCalendar>;

/** UI SDK's Calendar props, with `value`, `defaultValue` and `onValueChange` narrowed to the `mode`: a date or
    `null`, a sorted list of dates, or a `[start, end]` pair or `null`. */
export type CalendarProps<Mode extends CalendarMode = 'single'> = Omit<SdkCalendarProps, 'mode' | 'value' | 'defaultValue' | 'onValueChange'> &
  VariantProps<typeof calendarVariants> & {
    /** How many dates it selects: `single` (default), `multiple`, or a `range` from a start to an end. */
    mode?: Mode;
    value?: CalendarValue<Mode>;
    defaultValue?: CalendarValue<Mode>;
    onValueChange?: (value: CalendarValue<Mode>, details: Parameters<NonNullable<SdkCalendarProps['onValueChange']>>[1]) => void;
  };

export function Calendar<Mode extends CalendarMode = 'single'>({
  className,
  variant,
  months = 1,
  // The days of the months around stay hidden unless asked for: each grid shows its own month only.
  showOutsideDays = false,
  // One letter per weekday, as iOS shows them; screen readers still hear the full name.
  weekdayFormat = 'narrow',
  children,
  ...props
}: CalendarProps<Mode>) {
  return (
    <SdkCalendar months={months} showOutsideDays={showOutsideDays} weekdayFormat={weekdayFormat} className={cx(calendarVariants({ variant }), className)} {...(props as SdkCalendarProps)}>
      {children ?? (
        <>
          <CalendarHeader />
          <div className="flex gap-6">
            {Array.from({ length: Math.max(1, Math.floor(months)) }, (_, offset) => <CalendarGrid key={offset} offset={offset} />)}
          </div>
        </>
      )}
    </SdkCalendar>
  );
}

export { createCalendarController } from '@ui-sdk/react/calendar';
export type { CalendarController, CalendarDayState, CalendarGridCell, CalendarMode, CalendarValue, DateMatcher, DateMatchers } from '@ui-sdk/react/calendar';
