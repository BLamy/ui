'use client';
import type { ComponentProps } from 'react';
import { DateInput as SdkDateInput, DateInputSegment as SdkDateInputSegment } from '@ui-sdk/react/date-input';
import { TimeInput as SdkTimeInput, TimeInputSegment as SdkTimeInputSegment } from '@ui-sdk/react/time-input';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cx } from '@/lib/utils';

/* ══ DateField / TimeField — UI SDK's Date Input and Time Input: each part of the value (month, day, year, hour …) is
   its own small input, a spin button filled by typing or stepped with Up/Down, with Left/Right moving between them.
   The locale decides the order, the separators and the clock. Values are ISO strings: "2026-09-09", with a time
   `granularity` "2026-09-09T09:30", and "09:30" for a TimeField; `null` until every part is filled. Put one in a
   Field for its label, description and error:
   <Field>
     <FieldLabel variant="field">Birthday</FieldLabel>
     <DateField defaultValue="2026-09-09" />
     <FieldError />
   </Field> ══ */

export const dateFieldVariants = cva('flex min-w-0 items-center text-foreground tabular-nums [font-family:inherit] whitespace-nowrap', {
  variants: {
    /** `field`: the filled iOS field. `bare`: just the segments, for a field you draw yourself around them. */
    variant: {
      field: [
        'box-border w-full rounded-ctl bg-input px-3 outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
        'focus-within:bg-transparent focus-within:ring-[1.5px] focus-within:ring-primary focus-within:ring-inset',
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

/* An editable part is a real input, 24px at least each way (WCAG target size) and as wide as its digits; the one
   being edited is filled with the tint, and an empty one shows dimmed dashes. The kit's unlayered placeholder
   color outranks a plain utility, hence the `!`. */
const editableSegment = [
  'box-content h-6 w-[2ch] min-w-5 rounded-sm border-0 bg-transparent px-0.5 py-0 text-center [font:inherit] text-inherit tabular-nums caret-transparent outline-none',
  'data-[type=year]:w-[4ch] data-[type=dayPeriod]:w-[2.6ch]',
  'placeholder:text-foreground/60! selection:bg-transparent focus:bg-primary focus:text-primary-foreground focus:placeholder:text-primary-foreground!',
  'data-disabled:cursor-not-allowed',
  selectableText,
];
/* The text between parts ("/", ":", ", ") stays narrow and keeps its spaces. */
const literalSegment = 'whitespace-pre text-muted-foreground';

type SegmentProps = ComponentProps<typeof SdkDateInputSegment>;
const segmentClass = ({ segment, className }: Pick<SegmentProps, 'segment' | 'className'>) =>
  cx(segment.editable ? editableSegment : literalSegment, className);

/** One part of a DateField, from the root's `segments`: an input you type or step, or the text between two. */
export function DateFieldSegment({ className, segment, ...props }: SegmentProps) {
  return <SdkDateInputSegment segment={segment} className={segmentClass({ segment, className })} {...props} />;
}

/** One part of a TimeField, from the root's `segments`. */
export function TimeFieldSegment({ className, segment, ...props }: ComponentProps<typeof SdkTimeInputSegment>) {
  return <SdkTimeInputSegment segment={segment} className={segmentClass({ segment, className })} {...props} />;
}

/* The root is a group, which can't be `disabled` the way an input is: a disabled field also says so with
   aria-disabled, so assistive tech hears the group (and its label) as inactive, not only each part. */
const groupElement = (props: Record<string, unknown>, state: { disabled: boolean }) => (
  <div {...props} aria-disabled={state.disabled ? true : undefined} />
);

export type DateFieldProps = ComponentProps<typeof SdkDateInput> & VariantProps<typeof dateFieldVariants>;

/** A date (and, with a time `granularity`, a time) typed part by part. It renders its segments; pass a function of
    its state as children to render `state.segments` yourself with DateFieldSegment. */
export function DateField({ className, variant, size, children, render = groupElement, ...props }: DateFieldProps) {
  return (
    <SdkDateInput className={cx(dateFieldVariants({ variant, size }), className)} render={render} {...props}>
      {children ?? ((state) => state.segments.map((segment) => <DateFieldSegment key={segment.key} segment={segment} />))}
    </SdkDateInput>
  );
}

export type TimeFieldProps = ComponentProps<typeof SdkTimeInput> & VariantProps<typeof dateFieldVariants>;

/** A time of day typed part by part: hours and minutes, with seconds and AM/PM when shown. The value is 24-hour
    ("14:30") whatever clock the field shows. This is UI SDK's `TimeInput`; the kit's own `TimeInput`
    (`@/components/ui/time-input`) is a different thing, a natural-language text field ("tomorrow at 3pm"). */
export function TimeField({ className, variant, size, children, render = groupElement, ...props }: TimeFieldProps) {
  return (
    <SdkTimeInput className={cx(dateFieldVariants({ variant, size }), className)} render={render} {...props}>
      {children ?? ((state) => state.segments.map((segment) => <TimeFieldSegment key={segment.key} segment={segment} />))}
    </SdkTimeInput>
  );
}

export { createDateInputController as createDateFieldController, type DateInputController as DateFieldController } from '@ui-sdk/react/date-input';
export { createTimeInputController as createTimeFieldController, type TimeInputController as TimeFieldController } from '@ui-sdk/react/time-input';
export type { DateInputSegmentData as DateFieldSegmentData, DateInputState as DateFieldState } from '@ui-sdk/react/date-input';
