import type { CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

export interface ProgressStep {
  id: string;
  /** Shown under the icon when `labels` is on; always used as the accessible name. */
  label: string;
  icon?: ReactNode;
}

export type ProgressStepState = 'done' | 'active' | 'todo';

export interface ProgressStepperProps {
  steps: ProgressStep[];
  /** Index of the step in progress. Everything before it is done, everything after is to do. */
  current: number;
  /** `bars` draws a segment under each icon that fills as it completes; `line` joins the icons. */
  variant?: 'bars' | 'line';
  /** Whether the active segment shimmers while it waits. */
  animated?: boolean;
  labels?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const progressStepperVariants = cva(
  'm-0 flex list-none p-0 [--ck-stepper-accent:var(--primary)] [--ck-stepper-idle:var(--secondary)]',
  { variants: { variant: { bars: 'gap-[6px]', line: 'gap-0' } }, defaultVariants: { variant: 'bars' } },
);

const stepVariants = cva('group/step flex min-w-0 flex-1 items-center', {
  variants: { variant: { bars: 'flex-col gap-[8px]', line: 'flex-row gap-0' } },
});

const trackVariants = cva('relative w-full overflow-hidden rounded-[999px] bg-(--ck-stepper-idle)', {
  variants: { variant: { bars: 'h-[5px]', line: 'h-[3px] group-last/step:hidden' } },
});

/** The fill segment per state; the animated active segment sweeps a gradient (a still, partial bar under reduced motion). */
function fillClass(state: ProgressStepState, animated: boolean) {
  if (state === 'active' && animated) {
    return 'left-[-100%] w-full bg-[linear-gradient(90deg,transparent,var(--ck-stepper-accent)_40%,var(--ck-stepper-accent)_60%,transparent)] [transform:none] animate-[ck-stepper-sweep_1.6s_ease-in-out_infinite] motion-reduce:left-0 motion-reduce:animate-none motion-reduce:bg-(color:--ck-stepper-accent) motion-reduce:bg-none motion-reduce:[transform:scaleX(.45)]';
  }
  return cn(
    'bg-(color:--ck-stepper-accent)',
    state === 'done' ? '[transform:scaleX(1)]' : state === 'active' ? '[transform:scaleX(.45)]' : '[transform:scaleX(0)]',
  );
}

/**
 * A row of milestones for a multi-step process (an order, a checkout, a deploy). Each step
 * exposes `data-state="done|active|todo"` so hosts can restyle any of the three, and the
 * accent follows `--ck-stepper-accent` (defaults to the host tint).
 */
export function ProgressStepper({
  steps,
  current,
  variant = 'bars',
  animated = true,
  labels = false,
  className,
  style,
}: ProgressStepperProps) {
  return (
    <ol
      data-slot="progress-stepper"
      data-variant={variant}
      data-animated={animated || undefined}
      className={cn(progressStepperVariants({ variant }), className)}
      style={style}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const state: ProgressStepState = index < current ? 'done' : index === current ? 'active' : 'todo';
        return (
          <li
            key={step.id}
            data-slot="progress-step"
            className={stepVariants({ variant })}
            data-state={state}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span
              data-slot="progress-step-icon"
              className={cn(
                'grid size-[28px] place-items-center [transition:color_var(--duration-spring-smooth)_var(--ease-spring-smooth),transform_var(--duration-spring-bouncy)_var(--ease-spring-bouncy)] motion-reduce:transition-none',
                state === 'todo' ? 'text-tertiary-foreground' : 'text-(--ck-stepper-accent)',
                state === 'active' && '[transform:scale(1.1)]',
              )}
              aria-hidden="true"
            >
              {step.icon}
            </span>
            <span data-slot="progress-step-track" className={trackVariants({ variant })} aria-hidden="true">
              <span
                data-slot="progress-step-fill"
                className={cn(
                  'absolute inset-0 origin-[left_center] rounded-[inherit] [transition:transform_var(--duration-spring-smooth)_var(--ease-spring-smooth),background-color_var(--duration-spring-smooth)_var(--ease-spring-smooth)] motion-reduce:transition-none',
                  fillClass(state, animated),
                )}
              />
            </span>
            <span
              className={
                labels
                  ? cn(
                      'max-w-full truncate text-[11px] font-semibold',
                      state === 'active' ? 'text-foreground' : 'text-muted-foreground',
                    )
                  : 'sr-only'
              }
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
