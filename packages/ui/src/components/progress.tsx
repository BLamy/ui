import type { CSSProperties, ReactNode } from 'react';
import { Label, ProgressBar, type ProgressBarProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { NumberMorph } from '@/components/ui/number-morph';

/* ══ Progress — react-aria's ProgressBar (role=progressbar, aria-valuenow / valuetext), iOS progress view look.
   Omit `value` or pass `isIndeterminate` for the sliding bar. The fill springs to each new value and the
   default percentage label rolls its digits (NumberMorph). ══ */
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

export const progressIndicatorVariants = cva('absolute inset-y-0 left-0 rounded-full', {
  variants: {
    tone: {
      default: 'bg-primary',
      success: 'bg-success',
      destructive: 'bg-destructive',
    },
  },
  defaultVariants: { tone: 'default' },
});

export interface ProgressProps extends ProgressBarProps, VariantProps<typeof progressVariants>, VariantProps<typeof progressIndicatorVariants> {
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
}

export function Progress({ className, size, tone, label, showValue, ...props }: ProgressProps) {
  // A custom label or format gets react-aria's text as is; the default percentage rolls.
  const plainPercent = props.valueLabel == null && props.formatOptions == null;
  return (
    <ProgressBar
      data-slot="progress"
      className={composeRenderProps(className, (cls) => cn('grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5', cls))}
      {...props}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          {label ? <Label className="text-[15px] font-medium text-foreground">{label}</Label> : null}
          {showValue && !isIndeterminate ? (
            <span className="col-start-2 text-[15px] text-muted-foreground tabular-nums">
              {plainPercent ? <NumberMorph value={(percentage ?? 0) / 100} format={{ style: 'percent' }} /> : valueText}
            </span>
          ) : null}
          <div data-slot="progress-track" className={cn(progressVariants({ size }), 'col-span-2')}>
            <div
              data-slot="progress-indicator"
              className={cn(
                progressIndicatorVariants({ tone }),
                isIndeterminate ? 'w-2/5 animate-bl-progress motion-reduce:animate-none' : 'w-(--pct) transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
              )}
              style={isIndeterminate ? undefined : ({ '--pct': `${percentage ?? 0}%` } as CSSProperties)}
            />
          </div>
        </>
      )}
    </ProgressBar>
  );
}
