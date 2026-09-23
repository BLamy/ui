import type { CSSProperties, ReactNode } from 'react';
import { Label, ProgressBar, type ProgressBarProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ Progress — react-aria's ProgressBar (role=progressbar, aria-valuenow / valuetext), iOS progress view look.
   Omit `value` or pass `isIndeterminate` for the sliding bar. ══ */
export const progressVariants = cva('relative w-full overflow-hidden rounded-full bg-bl-fill2', {
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
  return (
    <ProgressBar
      data-slot="progress"
      className={composeRenderProps(className, (cls) => cn('grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5', cls))}
      {...props}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          {label ? <Label className="text-[15px] font-medium text-foreground">{label}</Label> : null}
          {showValue && !isIndeterminate ? <span className="col-start-2 text-[15px] text-muted-foreground tabular-nums">{valueText}</span> : null}
          <div data-slot="progress-track" className={cn(progressVariants({ size }), 'col-span-2')}>
            <div
              data-slot="progress-indicator"
              className={cn(
                progressIndicatorVariants({ tone }),
                isIndeterminate ? 'w-2/5 animate-bl-progress' : 'w-(--pct) transition-[width] duration-300 ease-ios',
              )}
              style={isIndeterminate ? undefined : ({ '--pct': `${percentage ?? 0}%` } as CSSProperties)}
            />
          </div>
        </>
      )}
    </ProgressBar>
  );
}
