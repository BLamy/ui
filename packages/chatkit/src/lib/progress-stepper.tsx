import type { CSSProperties, ReactNode } from 'react';
import { cn } from './cn';

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
      className={cn('ck-stepper', className)}
      style={style}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const state: ProgressStepState = index < current ? 'done' : index === current ? 'active' : 'todo';
        return (
          <li
            key={step.id}
            className="ck-stepper__step"
            data-state={state}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className="ck-stepper__icon" aria-hidden="true">
              {step.icon}
            </span>
            <span className="ck-stepper__track" aria-hidden="true">
              <span className="ck-stepper__fill" />
            </span>
            <span className={labels ? 'ck-stepper__label' : 'ck-sr-only'}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
