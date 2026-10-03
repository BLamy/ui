'use client';
import {
  DateField as AriaDateField, type DateFieldProps as AriaDateFieldProps,
  DateInput as AriaDateInput, type DateInputProps as AriaDateInputProps,
  DateSegment as AriaDateSegment, type DateSegmentProps as AriaDateSegmentProps,
  TimeField as AriaTimeField, type TimeFieldProps as AriaTimeFieldProps,
  composeRenderProps,
  type DateValue, type TimeValue,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ DateField / TimeField — react-aria's segmented fields: each part of the date (month, day, year, hour …) is its own
   spin-button, edited by typing or Up/Down, with Left/Right moving between them. Locale decides the order and
   separators. Inside a field a Label, the DateInput, a FieldDescription and a FieldError are wired automatically.
   <DateField defaultValue={parseDate('2026-09-09')}>
     <Label variant="field">Birthday</Label>
     <DateInput />
     <FieldError />
   </DateField> ══ */

export interface DateFieldProps<T extends DateValue> extends AriaDateFieldProps<T> {}

export function DateField<T extends DateValue>({ className, ...props }: DateFieldProps<T>) {
  return (
    <AriaDateField<T>
      data-slot="date-field"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

export interface TimeFieldProps<T extends TimeValue> extends AriaTimeFieldProps<T> {}

export function TimeField<T extends TimeValue>({ className, ...props }: TimeFieldProps<T>) {
  return (
    <AriaTimeField<T>
      data-slot="time-field"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

export const dateInputVariants = cva('flex min-w-0 items-center text-foreground [font-family:inherit] whitespace-nowrap', {
  variants: {
    /** `field`: the filled iOS field (what DateField shows). `bare`: just the segments, for a field you draw yourself
        around them (DatePickerField puts a calendar button beside them). */
    variant: {
      field: [
        'box-border w-full rounded-ctl bg-input px-3 outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
        'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset',
        'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50',
      ],
      bare: 'flex-1',
    },
    size: {
      sm: 'text-subhead',
      default: 'text-body',
      lg: 'text-body',
    },
  },
  compoundVariants: [
    { variant: 'field', size: 'sm', class: 'h-8' },
    { variant: 'field', size: 'default', class: 'h-11' },
    { variant: 'field', size: 'lg', class: 'h-[50px] rounded-xl' },
  ],
  defaultVariants: { variant: 'field', size: 'default' },
});

export interface DateInputProps extends Omit<AriaDateInputProps, 'children' | 'size'>, VariantProps<typeof dateInputVariants> {}

/** The row of segments (month / day / year …). Use `variant="bare"` inside a DatePickerField. */
export function DateInput({ className, variant, size, ...props }: DateInputProps) {
  return (
    <AriaDateInput
      data-slot="date-input"
      className={composeRenderProps(className, (cls) => cn(dateInputVariants({ variant, size }), cls))}
      {...props}
    >
      {(segment) => <DateSegment segment={segment} />}
    </AriaDateInput>
  );
}

/** One editable part of the date. The one being edited is filled with the tint; an empty one shows its name dimmed. */
export function DateSegment({ className, ...props }: AriaDateSegmentProps) {
  return (
    <AriaDateSegment
      data-slot="date-segment"
      className={composeRenderProps(className, (cls) =>
        cn(
          // 24px at least each way (WCAG target size); the literals between them ("/", ":") stay narrow.
          'min-h-6 min-w-6 rounded-sm px-0.5 text-center tabular-nums caret-transparent outline-none',
          'data-placeholder:text-foreground/60 data-[type=literal]:min-w-0 data-[type=literal]:px-0 data-[type=literal]:text-muted-foreground',
          'data-focused:bg-primary data-focused:text-primary-foreground data-focused:data-placeholder:text-primary-foreground',
          'data-disabled:cursor-not-allowed',
          selectableText,
          cls,
        ),
      )}
      {...props}
    />
  );
}
