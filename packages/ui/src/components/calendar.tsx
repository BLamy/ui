'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
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
import { useSizeClassScope } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import { CalendarMonthsContext } from '@/lib/calendar-months';

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

/* The month and year selects read as iOS header pop-up buttons: as wide as their text, with the kit's up-down glyph
   in place of the native arrow. */
const headerSelect =
  'h-8 min-w-0 cursor-pointer appearance-none rounded-lg border-0 bg-transparent ps-1.5 pe-5 [font-family:inherit] text-subhead font-semibold text-foreground outline-none field-sizing-content transition-colors duration-spring-snappy ease-spring-snappy hover:not-data-disabled:bg-secondary focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-default data-disabled:opacity-40';

/** The native select inside a span that carries the glyph (a select can't hold one). */
function withGlyph(props: ComponentProps<'select'>) {
  return (
    <span data-slot="calendar-select" className="relative inline-flex min-w-0 items-center">
      <select {...props} />
      <Icon name="chevron-up-down" size={12} sw={2.2} className="pointer-events-none absolute end-1.5 text-muted-foreground" />
    </span>
  );
}

/** A native select of the months, to jump straight to one (a birthday). Use it in place of the heading's text. */
export function CalendarMonthSelect({ className, render = withGlyph, ...props }: ComponentProps<typeof SdkCalendarMonthSelect>) {
  return <SdkCalendarMonthSelect className={cx(headerSelect, className)} render={render} {...props} />;
}

/** A native select of the years from `min` to `max` (ten either side of the year on show without them). */
export function CalendarYearSelect({ className, render = withGlyph, ...props }: ComponentProps<typeof SdkCalendarYearSelect>) {
  return <SdkCalendarYearSelect className={cx(headerSelect, className)} render={render} {...props} />;
}

/** The row over the grids: previous and next around the month and year. Pass children to lay out your own
    (a CalendarMonthSelect and a CalendarYearSelect, say); keep a CalendarHeading in it so the grids stay named. */
export function CalendarHeader({ className, children, ...props }: ComponentProps<'header'>) {
  return (
    // In a compact scope months always stack (two 308px grids need 640px, where compact ends), so the header keeps to
    // one grid's width, centred over the column, and Previous and Next stay beside the month they change.
    <header data-slot="calendar-header" className={cn('flex w-full items-center gap-1 pb-2 in-data-[size-class=compact]:mx-auto in-data-[size-class=compact]:max-w-77', className)} {...props}>
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

/** Whether an ISO date is the first or the last day of its month. */
function monthEdge(date: unknown): 'start' | 'end' | undefined {
  if (typeof date !== 'string') return undefined;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  if (d === 1) return 'start';
  return new Date(Date.UTC(y, m - 1, d + 1)).getUTCDate() === 1 ? 'end' : undefined;
}

/** One day. A range's ends are filled and the days between are joined by a band (half a cell at each end, none
    on a one-day range); today is tinted, and an unavailable day is struck through. */
export function CalendarDay({ className, children, ...props }: CalendarDayProps) {
  const edge = monthEdge(props.value);
  return (
    <SdkCalendarDay
      data-month-start={edge === 'start' ? '' : undefined}
      data-month-end={edge === 'end' ? '' : undefined}
      className={cx(
        [
          // 36px days; in a compact (phone) container, a seventh of the grid's width: 44px touch targets while they fit.
          'group/day relative size-9 cursor-default p-0 text-center text-subhead outline-none in-data-[size-class=compact]:size-auto',
          'data-outside:text-muted-foreground data-disabled:not-data-unavailable:opacity-30',
          'before:absolute before:inset-0 before:hidden before:bg-primary/15 data-range-start:before:block data-range-middle:before:block data-range-end:before:block data-range-start:before:start-1/2 data-range-end:before:end-1/2',
          // The band is rounded where a week row cuts it, and an end at a row's edge has no half-cell tab beside it.
          'first:before:rounded-s-full last:before:rounded-e-full first:data-range-end:before:hidden last:data-range-start:before:hidden',
          // So is it where a month ends: a range across two stacked months reads as two rounded runs, not a cut.
          'data-month-start:before:rounded-s-full data-month-end:before:rounded-e-full data-month-start:data-range-end:before:hidden data-month-end:data-range-start:before:hidden',
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
              'in-data-[size-class=compact]:mx-auto in-data-[size-class=compact]:aspect-square in-data-[size-class=compact]:size-auto in-data-[size-class=compact]:w-full in-data-[size-class=compact]:max-w-11',
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

/* In a compact (phone-sized) scope a month is as wide as seven 44px touch days (308px), and no wider than the room
   it has: its columns share that width, so in a narrow sidebar or a 320px phone the days shrink toward 36px
   instead of running past the card's edge. */
const compactGrid = 'border-separate border-spacing-0 in-data-[size-class=compact]:w-77 in-data-[size-class=compact]:max-w-full in-data-[size-class=compact]:table-fixed';

/** Whether the grids show their own month caption: CalendarMonths turns it on when it draws more than one. */
const CalendarGridHeadingContext = createContext(false);

/** A month's caption over its grid, like "October 2026". CalendarMonths draws one over each grid when it shows more
    than one month, visible while the months stack (it sets `data-stacked` when they wrap onto rows, whatever the size
    class), so every stacked month is labelled on screen.
    Hidden from screen readers: the grid is already named by its month. */
export function CalendarGridHeading({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="calendar-grid-heading"
      aria-hidden="true"
      className={cn('hidden px-2 pt-1 pb-1.5 text-start text-subhead font-semibold in-data-stacked:table-caption', className)}
      {...props}
    />
  );
}

/** A month: the weekday row and its days (and its CalendarGridHeading when the months stack). `offset` picks which
    of the months on show it is, from 0. */
export function CalendarGrid({ className, children, ...props }: ComponentProps<typeof SdkCalendarGrid>) {
  const heading = useContext(CalendarGridHeadingContext);
  return (
    <SdkCalendarGrid className={cx(compactGrid, className)} {...props}>
      {children ?? ((state) => (
        <>
          {heading ? <CalendarGridHeading>{state.label}</CalendarGridHeading> : null}
          <CalendarWeekdays />
          <CalendarWeeks />
        </>
      ))}
    </SdkCalendarGrid>
  );
}


export interface CalendarMonthsProps extends ComponentProps<'div'> {
  /** How many grids. Default: the `months` of the Calendar or DatePicker it is in. */
  months?: number;
}

/** The month grids on show, one CalendarGrid per month, side by side while they fit and wrapping onto rows,
    centred under the header, in a narrow container (a phone, a sidebar) rather than running past its edge. Stacked
    months each carry their own caption (CalendarGridHeading). */
export function CalendarMonths({ months, className, ref, ...props }: CalendarMonthsProps) {
  const fromCalendar = useContext(CalendarMonthsContext);
  const shown = Math.max(1, Math.floor(months ?? fromCalendar));
  const [box, stacked] = useStacked(shown > 1, ref);
  return (
    <CalendarGridHeadingContext.Provider value={shown > 1}>
      <div ref={box} data-slot="calendar-months" data-stacked={stacked ? '' : undefined} className={cn('flex flex-wrap justify-center gap-x-6 gap-y-3', className)} {...props}>
        {Array.from({ length: shown }, (_, offset) => <CalendarGrid key={offset} offset={offset} />)}
      </div>
    </CalendarGridHeadingContext.Provider>
  );
}

/** Whether the grids have wrapped onto more than one row: a grid starts lower than the first. Measured from the layout
    (a narrow sidebar on a wide page stacks too), again whenever the box resizes. */
function useStacked(watch: boolean, ref: Ref<HTMLDivElement> | undefined): [(el: HTMLDivElement | null) => void, boolean] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [stacked, setStacked] = useState(false);
  const outer = useRef(ref);
  outer.current = ref;
  const box = useCallback((node: HTMLDivElement | null) => {
    setEl(node);
    const r = outer.current;
    if (typeof r === 'function') r(node);
    else if (r) r.current = node;
  }, []);
  useEffect(() => {
    if (!el || !watch) return setStacked(false);
    const measure = () => {
      const grids = [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
      setStacked(grids.some((g) => g.offsetTop > grids[0].offsetTop));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, watch]);
  return [box, stacked];
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
  // The size class it sits in (the day cells grow to touch size in a compact one).
  const sizeClass = useSizeClassScope();
  return (
    <CalendarMonthsContext.Provider value={months}>
      <SdkCalendar data-size-class={sizeClass} months={months} showOutsideDays={showOutsideDays} weekdayFormat={weekdayFormat} className={cx(calendarVariants({ variant }), className)} {...(props as SdkCalendarProps)}>
        {children ?? (
          <>
            <CalendarHeader />
            <CalendarMonths />
          </>
        )}
      </SdkCalendar>
    </CalendarMonthsContext.Provider>
  );
}

export { createCalendarController } from '@ui-sdk/react/calendar';
export type { CalendarController, CalendarDayState, CalendarGridCell, CalendarMode, CalendarValue, DateMatcher, DateMatchers } from '@ui-sdk/react/calendar';
