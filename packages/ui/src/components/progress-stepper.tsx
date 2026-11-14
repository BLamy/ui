'use client';
import { Children, createContext, isValidElement, useContext, type ComponentProps, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icon';
import { progressVariants } from '@/components/ui/progress';

/* ══ ProgressStepper — a row of milestones for a multi-step process (an order, a checkout, a deploy) ══
   An ordered list (`<ol>`), not a progressbar: each step is an item, the step in progress has
   `aria-current="step"`, and the completed ones say so to screen readers. Steps before `current` are complete,
   the one at `current` is under way, the rest are upcoming (UI SDK Timeline's words for an order's progress).

   <ProgressStepper current={1} steps={[{ id: 'placed', label: 'Placed', icon: … }, …]} labels />

   `steps` is the shorthand; pass the parts to give a step a description, a class or a marker of its own:

   <ProgressStepper current={1} labels>
     <ProgressStep icon={<Icon name="bag" />} label="Placed" description="12:04" />
     <ProgressStep>
       <ProgressStepIcon><Spinner size={16} /></ProgressStepIcon>
       <ProgressStepTrack />
       <ProgressStepLabel>Preparing</ProgressStepLabel>
     </ProgressStep>
   </ProgressStepper>

   Each segment is the Progress rail (`progressVariants`), so a stepper and a bar on one page read as one system.
   The accent is `--stepper-accent` (the tint) and the rail `--stepper-track`. */

export type ProgressStepState = 'complete' | 'current' | 'upcoming';

export interface ProgressStepItem {
  id: string;
  /** Shown under the icon when `labels` is on; always the step's accessible name. */
  label: string;
  icon?: ReactNode;
  /** A second line under the label (a time, a place). */
  description?: ReactNode;
}

type Variant = 'bars' | 'line';

export interface ProgressStepperProps extends ComponentProps<'ol'> {
  /** The steps, as data. Leave out and pass `ProgressStep` children instead. */
  steps?: ProgressStepItem[];
  /** Index of the step in progress. Everything before it is complete, everything after it upcoming; pass the step
   *  count when every step is complete. */
  current: number;
  /** `bars` draws a segment under each icon that fills as it completes; `line` joins the icons. */
  variant?: Variant;
  /** Whether the current segment shimmers while it waits. */
  animated?: boolean;
  /** Show the labels (and descriptions) under the icons; otherwise they are read by screen readers only. */
  labels?: boolean;
}

export const progressStepperVariants = cva(
  'm-0 flex list-none p-0 [--stepper-accent:var(--primary)] [--stepper-track:var(--secondary-strong)]',
  { variants: { variant: { bars: 'gap-1.5', line: 'gap-0' } }, defaultVariants: { variant: 'bars' } },
);

const stepVariants = cva('group/step flex min-w-0 flex-1 items-center', {
  variants: { variant: { bars: 'flex-col gap-2', line: 'flex-row gap-0' } },
  defaultVariants: { variant: 'bars' },
});

interface StepperCtx { variant: Variant; animated: boolean; labels: boolean; current: number }
const StepperContext = createContext<StepperCtx>({ variant: 'bars', animated: true, labels: false, current: 0 });
const StepContext = createContext<{ index: number; state: ProgressStepState }>({ index: 0, state: 'upcoming' });

const stateOf = (index: number, current: number): ProgressStepState =>
  index < current ? 'complete' : index === current ? 'current' : 'upcoming';

export function ProgressStepper({
  steps,
  current,
  variant = 'bars',
  animated = true,
  labels = false,
  className,
  children,
  'aria-label': ariaLabel,
  ...rest
}: ProgressStepperProps) {
  const items = steps
    ? steps.map((s) => <ProgressStep key={s.id} label={s.label} icon={s.icon} description={s.description} />)
    : Children.toArray(children).filter(isValidElement);
  return (
    <ol
      data-slot="progress-stepper"
      data-variant={variant}
      data-animated={animated || undefined}
      aria-label={ariaLabel ?? (rest['aria-labelledby'] ? undefined : 'Progress')}
      {...rest}
      className={cn(progressStepperVariants({ variant }), className)}
    >
      <StepperContext.Provider value={{ variant, animated, labels, current }}>
        {items.map((item, index) => (
          <StepContext.Provider key={item.key ?? index} value={{ index, state: stateOf(index, current) }}>
            {item}
          </StepContext.Provider>
        ))}
      </StepperContext.Provider>
    </ol>
  );
}

export interface ProgressStepProps extends ComponentProps<'li'> {
  /** The step's name (shorthand for a `ProgressStepLabel`). */
  label?: ReactNode;
  /** The step's glyph (shorthand for a `ProgressStepIcon`). */
  icon?: ReactNode;
  /** A second line (shorthand for a `ProgressStepDescription`). */
  description?: ReactNode;
}

/** One milestone. With no children it renders its icon, segment, label and description from its props. */
export function ProgressStep({ label, icon, description, className, children, ...props }: ProgressStepProps) {
  const { variant } = useContext(StepperContext);
  const { state } = useContext(StepContext);
  return (
    <li
      data-slot="progress-step"
      data-state={state}
      aria-current={state === 'current' ? 'step' : undefined}
      {...props}
      className={cn(stepVariants({ variant }), className)}
    >
      {children ?? (
        <>
          <ProgressStepIcon>{icon}</ProgressStepIcon>
          <ProgressStepTrack />
          {label != null || description != null ? (
            <span className="flex min-w-0 max-w-full flex-col items-center">
              {label != null ? <ProgressStepLabel>{label}</ProgressStepLabel> : null}
              {description != null ? <ProgressStepDescription>{description}</ProgressStepDescription> : null}
            </span>
          ) : null}
        </>
      )}
      {state === 'complete' ? <span className="sr-only">, completed</span> : null}
    </li>
  );
}

/** The step's glyph, in the accent once reached; a complete step wears a small check badge. */
export function ProgressStepIcon({ className, children, ...props }: ComponentProps<'span'>) {
  const { state } = useContext(StepContext);
  return (
    <span
      data-slot="progress-step-icon"
      aria-hidden="true"
      {...props}
      className={cn(
        'relative grid size-7 shrink-0 place-items-center [transition:color_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-bouncy)_var(--ease-spring-bouncy)] motion-reduce:transition-none',
        state === 'upcoming' ? 'text-tertiary-foreground' : 'text-(--stepper-accent)',
        state === 'current' && 'scale-110',
        className,
      )}
    >
      {children}
      {state === 'complete' && children != null ? (
        <span data-slot="progress-step-check" className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center rounded-full bg-(--stepper-accent) text-primary-foreground ring-2 ring-background">
          <Icon name="check" size={8} sw={3.4} />
        </span>
      ) : null}
    </span>
  );
}

/** The current segment's shimmer sweeps a gradient; under reduced motion it is a still, partial bar. */
function fillClass(state: ProgressStepState, animated: boolean) {
  if (state === 'current' && animated) {
    return 'left-[-100%] w-full bg-[linear-gradient(90deg,transparent,var(--stepper-accent)_40%,var(--stepper-accent)_60%,transparent)] [transform:none] animate-[bl-stepper-sweep_1.6s_ease-in-out_infinite] motion-reduce:left-0 motion-reduce:animate-none motion-reduce:bg-(color:--stepper-accent) motion-reduce:bg-none motion-reduce:[transform:scaleX(.45)]';
  }
  return cn(
    'bg-(color:--stepper-accent)',
    state === 'complete' ? '[transform:scaleX(1)]' : state === 'current' ? '[transform:scaleX(.45)]' : '[transform:scaleX(0)]',
  );
}

/** The step's segment: the Progress rail (`progressVariants({ size: 'sm' })`), filled as the step completes. */
export function ProgressStepTrack({ className, ...props }: ComponentProps<'span'>) {
  const { variant, animated } = useContext(StepperContext);
  const { state } = useContext(StepContext);
  return (
    <span
      data-slot="progress-step-track"
      aria-hidden="true"
      {...props}
      className={cn(progressVariants({ size: 'sm' }), 'block bg-(--stepper-track)', variant === 'line' && 'group-last/step:hidden', className)}
    >
      <span
        data-slot="progress-step-fill"
        className={cn(
          'absolute inset-0 origin-[left_center] rounded-[inherit] [transition:transform_var(--duration-spring-smooth)_var(--ease-spring-smooth),background-color_var(--duration-spring-smooth)_var(--ease-spring-smooth)] motion-reduce:transition-none',
          fillClass(state, animated),
        )}
      />
    </span>
  );
}

/** The step's name: visible under the icon when the stepper has `labels`, read by screen readers always. */
export function ProgressStepLabel({ className, ...props }: ComponentProps<'span'>) {
  const { labels } = useContext(StepperContext);
  const { state } = useContext(StepContext);
  return (
    <span
      data-slot="progress-step-label"
      {...props}
      className={cn(
        labels ? 'max-w-full truncate text-caption2 font-semibold' : 'sr-only',
        labels && (state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'),
        className,
      )}
    />
  );
}

/** A second line under the label (a time, a place); shown with the labels. */
export function ProgressStepDescription({ className, ...props }: ComponentProps<'span'>) {
  const { labels } = useContext(StepperContext);
  return (
    <span
      data-slot="progress-step-description"
      {...props}
      className={cn(labels ? 'max-w-full truncate text-caption2 text-muted-foreground tabular-nums' : 'sr-only', className)}
    />
  );
}
