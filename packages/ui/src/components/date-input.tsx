'use client';
import type { ComponentProps } from 'react';
import { DateInput as SdkDateInput, DateInputSegment as SdkDateInputSegment } from '@ui-sdk/react/date-input';
import { TimeInput as SdkTimeInput, TimeInputSegment as SdkTimeInputSegment } from '@ui-sdk/react/time-input';
import { cva, type VariantProps } from 'class-variance-authority';
import { fieldSurfaceVariants } from '@/components/ui/input';
import { selectableText } from '@/lib/primitives';
import { cx } from '@/lib/utils';

/* ══ DateInput / TimeInput — UI SDK's Date Input and Time Input: each part of the value (month, day, year, hour …) is
   its own small input, a spin button filled by typing or stepped with Up/Down, with Left/Right moving between them.
   The locale decides the order, the separators and the clock. Values are ISO strings: "2026-09-09", with a time
   `granularity` "2026-09-09T09:30", and "09:30" for a TimeInput; `null` until every part is filled. Put one in a
   Field for its label, description and error:
   <Field>
     <FieldLabel>Birthday</FieldLabel>
     <DateInput defaultValue="2026-09-09" />
     <FieldError />
   </Field> ══ */

const fieldSizes = ['sm', 'default', 'lg'] as const;

export const dateInputVariants = cva('flex min-w-0 items-center text-foreground tabular-nums [font-family:inherit] whitespace-nowrap', {
  variants: {
    /** `default`: the kit's filled field (`fieldSurfaceVariants`, the box every text-shaped control shares). `plain`: just
        the segments, no chrome, for a field you draw yourself around them. */
    variant: {
      default: 'w-full',
      plain: 'flex-1',
    },
    size: {
      sm: 'text-subhead',
      default: 'text-body',
      lg: 'text-body',
    },
  },
  // The segments sit side by side: the surface's gap would space them apart.
  compoundVariants: fieldSizes.map((size) => ({ variant: 'default' as const, size, class: [fieldSurfaceVariants({ size }), 'gap-0'] })),
  defaultVariants: { variant: 'default', size: 'default' },
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

/** One part of a DateInput, from the root's `segments`: an input you type or step, or the text between two. */
export function DateInputSegment({ className, segment, ...props }: SegmentProps) {
  return <SdkDateInputSegment segment={segment} className={segmentClass({ segment, className })} {...props} />;
}

/** One part of a TimeInput, from the root's `segments`. */
export function TimeInputSegment({ className, segment, ...props }: ComponentProps<typeof SdkTimeInputSegment>) {
  return <SdkTimeInputSegment segment={segment} className={segmentClass({ segment, className })} {...props} />;
}

/* The root is a group, which can't be `disabled` the way an input is: a disabled field also says so with
   aria-disabled, so assistive tech hears the group (and its label) as inactive, not only each part. */
const groupElement = (props: Record<string, unknown>, state: { disabled: boolean }) => (
  <div {...props} aria-disabled={state.disabled ? true : undefined} />
);

export type DateInputProps = ComponentProps<typeof SdkDateInput> & VariantProps<typeof dateInputVariants>;

/** A date (and, with a time `granularity`, a time) typed part by part. It renders its segments; pass a function of
    its state as children to render `state.segments` yourself with DateInputSegment. */
export function DateInput({ className, variant, size, children, render = groupElement, ...props }: DateInputProps) {
  return (
    <SdkDateInput className={cx(dateInputVariants({ variant, size }), className)} render={render} {...props}>
      {children ?? ((state) => state.segments.map((segment) => <DateInputSegment key={segment.key} segment={segment} />))}
    </SdkDateInput>
  );
}

export type TimeInputProps = ComponentProps<typeof SdkTimeInput> & VariantProps<typeof dateInputVariants>;

/** A time of day typed part by part: hours and minutes, with seconds and AM/PM when shown. The value is 24-hour
    ("14:30") whatever clock the field shows. This is UI SDK's `TimeInput`; the kit's `NaturalTimeInput`
    (`@/components/ui/natural-time-input`) is a different thing, a natural-language text field ("tomorrow at 3pm"). */
export function TimeInput({ className, variant, size, children, render = groupElement, ...props }: TimeInputProps) {
  return (
    <SdkTimeInput className={cx(dateInputVariants({ variant, size }), className)} render={render} {...props}>
      {children ?? ((state) => state.segments.map((segment) => <TimeInputSegment key={segment.key} segment={segment} />))}
    </SdkTimeInput>
  );
}

export { createDateInputController, type DateInputController } from '@ui-sdk/react/date-input';
export { createTimeInputController, type TimeInputController } from '@ui-sdk/react/time-input';
export type { DateInputSegmentData, DateInputState } from '@ui-sdk/react/date-input';
