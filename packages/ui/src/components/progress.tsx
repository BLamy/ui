'use client';
import type { ComponentProps, ReactNode } from 'react';
import {
  Progress as SdkProgress, ProgressIndicator as SdkProgressIndicator, ProgressLabel as SdkProgressLabel,
  ProgressTrack as SdkProgressTrack, ProgressValue as SdkProgressValue,
} from '@ui-sdk/react/progress';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { NumberMorph } from '@/components/ui/number-morph';

/* ══ Progress — UI SDK's Progress (role=progressbar, aria-valuenow / valuetext), iOS progress view look ══
   `value` between `min` and `max` (0 and 100); leave it out for the sliding indeterminate bar. `format` takes
   Intl.NumberFormat options or a function. Name it with `label` or `aria-label`.

   <Progress label="Uploading" showValue value={38} />

   With no children it renders the composition below from its props; pass the parts yourself to rearrange them:

   <Progress value={38}>
     <ProgressLabel>Uploading</ProgressLabel>
     <ProgressValue />
     <ProgressTrack><ProgressIndicator /></ProgressTrack>
   </Progress>

   The fill springs to each new value and the default percentage rolls its digits (NumberMorph). Under reduced
   motion the indeterminate bar is a dim full-width fill rather than a still 40% bar, which would read as "40% done".
   For a level in a range (storage, battery) use UI SDK's Meter: `progressVariants` styles it the same way. */
export const progressVariants = cva('relative w-full overflow-hidden rounded-full bg-secondary-strong', {
  variants: {
    size: {
      sm: 'h-1',
      default: 'h-1.5',
      lg: 'h-2.5',
    },
  },
  defaultVariants: { size: 'default' },
});

// The fill grows from the inline start, and the indeterminate bar travels toward the inline end (`--bl-progress-dir`
// is -1 in right-to-left text). Under reduced motion the indeterminate bar is a dim full fill. One string, so the
// docs' recipe table reads as a class list.
export const progressIndicatorVariants = cva(
  'absolute inset-y-0 start-0 rounded-full transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none rtl:[--bl-progress-dir:-1] data-indeterminate:w-2/5 data-indeterminate:animate-bl-progress data-indeterminate:transition-none motion-reduce:data-indeterminate:w-full motion-reduce:data-indeterminate:animate-none motion-reduce:data-indeterminate:opacity-35',
  {
    variants: {
      tone: {
        default: 'bg-primary',
        success: 'bg-success',
        warning: 'bg-warning',
        destructive: 'bg-destructive',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);

export type ProgressProps = ComponentProps<typeof SdkProgress> & VariantProps<typeof progressVariants> & VariantProps<typeof progressIndicatorVariants> & {
  /** A visible label, which names the bar. */
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
};

export function Progress({ className, size, tone, label, showValue, children, ...props }: ProgressProps) {
  // A custom format shows UI SDK's text as is; the default percentage rolls.
  const plainPercent = props.format == null;
  return (
    <SdkProgress className={cx('grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5', className)} {...props}>
      {children ?? (
        <>
          {label ? <ProgressLabel>{label}</ProgressLabel> : null}
          {showValue ? (
            <ProgressValue className="col-start-2">
              {plainPercent ? (state) => <NumberMorph value={(state.percent ?? 0) / 100} format={{ style: 'percent' }} locale={props.locale} /> : undefined}
            </ProgressValue>
          ) : null}
          <ProgressTrack size={size} className="col-span-2">
            <ProgressIndicator tone={tone} />
          </ProgressTrack>
        </>
      )}
    </SdkProgress>
  );
}

/** The bar's visible name. */
export function ProgressLabel({ className, ...props }: ComponentProps<typeof SdkProgressLabel>) {
  return <SdkProgressLabel className={cx('text-subhead font-medium text-foreground', className)} {...props} />;
}

/** The formatted value, like "38%" (nothing while indeterminate). Children replace it. */
export function ProgressValue({ className, ...props }: ComponentProps<typeof SdkProgressValue>) {
  return <SdkProgressValue className={cx('text-subhead text-muted-foreground tabular-nums data-indeterminate:hidden', className)} {...props} />;
}

/** The rail the indicator fills. */
export function ProgressTrack({ className, size, ...props }: ComponentProps<typeof SdkProgressTrack> & VariantProps<typeof progressVariants>) {
  return <SdkProgressTrack className={cx(progressVariants({ size }), className)} {...props} />;
}

/** The filled part, as wide as the value; a sliding bar while indeterminate. */
export function ProgressIndicator({ className, tone, ...props }: ComponentProps<typeof SdkProgressIndicator> & VariantProps<typeof progressIndicatorVariants>) {
  return <SdkProgressIndicator className={cx(progressIndicatorVariants({ tone }), className)} {...props} />;
}
