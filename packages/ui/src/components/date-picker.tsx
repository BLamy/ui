'use client';
import type { ReactNode } from 'react';
import {
  DatePicker as AriaDatePicker, type DatePickerProps as AriaDatePickerProps,
  DateRangePicker as AriaDateRangePicker, type DateRangePickerProps as AriaDateRangePickerProps,
  Dialog as AriaDialog,
  Group,
  composeRenderProps,
  type DateValue,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Calendar, RangeCalendar, type CalendarProps, type RangeCalendarProps } from '@/components/ui/calendar';
import { DateInput } from '@/components/ui/date-field';
import { Popover, type PopoverProps } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ DatePicker / DateRangePicker — a DateField with a calendar button that opens a Calendar (or RangeCalendar) in a
   Popover. Typing into the segments and picking from the calendar edit the same value; the popover closes when a day
   (or a range) is chosen, Esc closes it and focus returns to the button. `granularity="minute"` adds the time segments.
   <DatePicker defaultValue={parseDate('2026-09-09')}>
     <Label variant="field">Date</Label>
     <DatePickerField />
     <FieldDescription>…</FieldDescription>
     <FieldError />
     <DatePickerContent />
   </DatePicker> ══ */

export const datePickerFieldVariants = cva(
  [
    'flex min-w-0 items-center gap-1 bg-input pl-3 pr-1.5 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
    'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset',
    'group-data-open:bg-transparent group-data-open:ring-[1.5px] group-data-open:ring-primary group-data-open:ring-inset',
    'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 rounded-lg text-subhead',
        default: 'h-11 rounded-ctl text-body',
        lg: 'h-[50px] rounded-xl text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

interface FieldProps extends VariantProps<typeof datePickerFieldVariants> {
  className?: string;
}

/** The calendar button at the end of a picker's field: opens the popover. react-aria names it ("Calendar", localized). */
function CalendarButton() {
  return (
    <Button variant="quiet" size="icon" className="size-8 shrink-0">
      <Icon name="calendar" size={18} />
    </Button>
  );
}

/** The filled field: the date's segments and the calendar button. */
export function DatePickerField({ className, size }: FieldProps) {
  return (
    <Group data-slot="date-picker-field" className={cn(datePickerFieldVariants({ size }), className)}>
      <DateInput variant="bare" size={size} />
      <CalendarButton />
    </Group>
  );
}

/** The filled field of a DateRangePicker: start and end segments with a dash between, and the calendar button. */
export function DateRangePickerField({ className, size }: FieldProps) {
  return (
    <Group data-slot="date-range-picker-field" className={cn(datePickerFieldVariants({ size }), className)}>
      <DateInput variant="bare" size={size} slot="start" className="flex-none" />
      <span aria-hidden="true" className="px-1 text-muted-foreground">–</span>
      <DateInput variant="bare" size={size} slot="end" />
      <CalendarButton />
    </Group>
  );
}

export interface DatePickerContentProps<T extends DateValue> extends Omit<PopoverProps, 'children'> {
  /** Props for the Calendar inside (`visibleMonths`, `variant` …). Ignored when you pass `children`. */
  calendarProps?: Omit<CalendarProps<T>, 'value' | 'defaultValue' | 'onChange'>;
  /** Replace the Calendar, e.g. to add presets beside it. */
  children?: ReactNode;
}

function PickerDialog({ children }: { children: ReactNode }) {
  return <AriaDialog className="p-3 outline-none">{children}</AriaDialog>;
}

/** The popover with the Calendar. Place it anywhere inside the DatePicker. */
export function DatePickerContent<T extends DateValue>({ calendarProps, children, placement = 'bottom start', className, ...props }: DatePickerContentProps<T>) {
  return (
    <Popover data-slot="date-picker-content" placement={placement} {...props} className={composeRenderProps(className, (cls) => cn('min-w-0', cls))}>
      <PickerDialog>{children ?? <Calendar<T> {...(calendarProps as CalendarProps<T>)} />}</PickerDialog>
    </Popover>
  );
}

export interface DateRangePickerContentProps<T extends DateValue> extends Omit<PopoverProps, 'children'> {
  /** Props for the RangeCalendar inside (`visibleMonths`, `variant` …). Ignored when you pass `children`. */
  calendarProps?: Omit<RangeCalendarProps<T>, 'value' | 'defaultValue' | 'onChange'>;
  children?: ReactNode;
}

/** The popover with the RangeCalendar. Place it anywhere inside the DateRangePicker. */
export function DateRangePickerContent<T extends DateValue>({ calendarProps, children, placement = 'bottom start', className, ...props }: DateRangePickerContentProps<T>) {
  return (
    <Popover data-slot="date-range-picker-content" placement={placement} {...props} className={composeRenderProps(className, (cls) => cn('min-w-0', cls))}>
      <PickerDialog>{children ?? <RangeCalendar<T> {...(calendarProps as RangeCalendarProps<T>)} />}</PickerDialog>
    </Popover>
  );
}

export interface DatePickerProps<T extends DateValue> extends AriaDatePickerProps<T> {}

export function DatePicker<T extends DateValue>({ className, ...props }: DatePickerProps<T>) {
  return (
    <AriaDatePicker<T>
      data-slot="date-picker"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

export interface DateRangePickerProps<T extends DateValue> extends AriaDateRangePickerProps<T> {}

export function DateRangePicker<T extends DateValue>({ className, ...props }: DateRangePickerProps<T>) {
  return (
    <AriaDateRangePicker<T>
      data-slot="date-range-picker"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}
