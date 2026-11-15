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
     <ProgressStepperItem icon={<Icon name="bag" />} label="Placed" description="12:04" />
     <ProgressStepperItem>
       <ProgressStepperItemIcon><Spinner size={16} /></ProgressStepperItemIcon>
       <ProgressStepperItemTrack />
       <ProgressStepperItemLabel>Preparing</ProgressStepperItemLabel>
     </ProgressStepperItem>
   </ProgressStepper>

   Each segment is the Progress rail (`progressVariants`), so a stepper and a bar on one page read as one system.
   The accent is `--stepper-accent` (the tint) and the rail `--stepper-track`. */

export type ProgressStepperItemState = 'complete' | 'current' | 'upcoming';

export interface ProgressStepperStep {
  id: string;
  /** Shown under the icon when `labels` is on; always the step's accessible name. */
  label: string;
  icon?: ReactNode;
  /** A second line under the label (a time, a place). */
  description?: ReactNode;
}

type Variant = 'bars' | 'line';

export interface ProgressStepperProps extends ComponentProps<'ol'> {
  /** The steps, as data. Leave out and pass `ProgressStepperItem` children instead. */
  steps?: ProgressStepperStep[];
  /** Index of the step in progress. Everything before it is complete, everything after it upcoming; pass the step
   *  count when every step is complete. */
  current: number;
  /** `bars` draws a segment under each icon that fills as it completes; `line` joins the icons. */
  variant?: Variant;
  /** Whether the current segment shimmers while it waits. */
  animated?: boolean;
  /** Show the labels (and descriptions) under the icons; otherwise they are read by screen readers only. A label
   *  wraps to two lines before it is cut. */
  labels?: boolean;
  /** What a complete step adds to its name for screen readers (", completed"), in your app's language. */
  completedLabel?: string;
}

export const progressStepperVariants = cva(
  'm-0 flex list-none p-0 [--stepper-accent:var(--primary)] [--stepper-track:var(--secondary-strong)]',
  { variants: { variant: { bars: 'gap-1.5', line: 'gap-0' } }, defaultVariants: { variant: 'bars' } },
);

/* `bars`: icon, segment and label stacked and centred. `line`: two rows, the icon and the segment that joins it to
   the next step on the first, the label and description under them, start-aligned, on the second. */
const stepVariants = cva('group/step min-w-0 flex-1', {
  variants: {
    variant: {
      bars: 'flex flex-col items-center gap-2',
      // The last step is as wide as its icon (its label at most 7rem, end-aligned), so the joined line ends on it.
      line: 'grid grid-cols-[auto_minmax(0,1fr)] content-start items-center gap-y-1.5 last:max-w-28 last:flex-none last:grid-cols-[auto] last:justify-items-end',
    },
  },
  defaultVariants: { variant: 'bars' },
});

interface StepperCtx { variant: Variant; animated: boolean; labels: boolean; current: number; completedLabel: string }
const StepperContext = createContext<StepperCtx>({ variant: 'bars', animated: true, labels: false, current: 0, completedLabel: 'completed' });
const StepContext = createContext<{ index: number; state: ProgressStepperItemState }>({ index: 0, state: 'upcoming' });

const stateOf = (index: number, current: number): ProgressStepperItemState =>
  index < current ? 'complete' : index === current ? 'current' : 'upcoming';

export function ProgressStepper({
  steps,
  current,
  variant = 'bars',
  animated = true,
  labels = false,
  completedLabel = 'completed',
  className,
  children,
  'aria-label': ariaLabel,
  ...rest
}: ProgressStepperProps) {
  const items = steps
    ? steps.map((s) => <ProgressStepperItem key={s.id} label={s.label} icon={s.icon} description={s.description} />)
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
      <StepperContext.Provider value={{ variant, animated, labels, current, completedLabel }}>
        {items.map((item, index) => (
          <StepContext.Provider key={item.key ?? index} value={{ index, state: stateOf(index, current) }}>
            {item}
          </StepContext.Provider>
        ))}
      </StepperContext.Provider>
    </ol>
  );
}

export interface ProgressStepperItemProps extends ComponentProps<'li'> {
  /** The step's name (shorthand for a `ProgressStepperItemLabel`). */
  label?: ReactNode;
  /** The step's glyph (shorthand for a `ProgressStepperItemIcon`). */
  icon?: ReactNode;
  /** A second line (shorthand for a `ProgressStepperItemDescription`). */
  description?: ReactNode;
}

/** One milestone. With no children it renders its icon, segment, label and description from its props. */
export function ProgressStepperItem({ label, icon, description, className, children, ...props }: ProgressStepperItemProps) {
  const { variant, completedLabel } = useContext(StepperContext);
  const { state } = useContext(StepContext);
  return (
    <li
      data-slot="progress-stepper-item"
      data-state={state}
      aria-current={state === 'current' ? 'step' : undefined}
      {...props}
      className={cn(stepVariants({ variant }), className)}
    >
      {children ?? (
        <>
          <ProgressStepperItemIcon>{icon}</ProgressStepperItemIcon>
          <ProgressStepperItemTrack />
          {label != null || description != null ? (
            <span className={cn('flex min-w-0 max-w-full flex-col', variant === 'line' ? 'col-span-2 items-start pe-2 group-last/step:col-span-1 group-last/step:items-end group-last/step:pe-0' : 'items-center')}>
              {label != null ? <ProgressStepperItemLabel>{label}</ProgressStepperItemLabel> : null}
              {description != null ? <ProgressStepperItemDescription>{description}</ProgressStepperItemDescription> : null}
            </span>
          ) : null}
        </>
      )}
      {state === 'complete' ? <span className="sr-only">, {completedLabel}</span> : null}
    </li>
  );
}

/** The step's glyph, in the accent once reached; a complete step wears a small check badge. */
export function ProgressStepperItemIcon({ className, children, ...props }: ComponentProps<'span'>) {
  const { state } = useContext(StepContext);
  return (
    <span
      data-slot="progress-stepper-item-icon"
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
        <span data-slot="progress-stepper-item-check" className="absolute -right-0.5 -bottom-0.5 grid size-3 place-items-center rounded-full bg-(--stepper-accent) text-primary-foreground ring-2 ring-background">
          <Icon name="check" size={8} sw={3.4} />
        </span>
      ) : null}
    </span>
  );
}

/** The current segment's shimmer sweeps a gradient; under reduced motion it is a still, partial bar. */
function fillClass(state: ProgressStepperItemState, animated: boolean) {
  if (state === 'current' && animated) {
    return 'left-[-100%] w-full bg-[linear-gradient(90deg,transparent,var(--stepper-accent)_40%,var(--stepper-accent)_60%,transparent)] [transform:none] animate-[bl-stepper-sweep_1.6s_ease-in-out_infinite] motion-reduce:left-0 motion-reduce:animate-none motion-reduce:bg-(color:--stepper-accent) motion-reduce:bg-none motion-reduce:[transform:scaleX(.45)]';
  }
  return cn(
    'bg-(color:--stepper-accent)',
    state === 'complete' ? '[transform:scaleX(1)]' : state === 'current' ? '[transform:scaleX(.45)]' : '[transform:scaleX(0)]',
  );
}

/** The step's segment: the Progress rail (`progressVariants({ size: 'sm' })`), filled as the step completes. */
export function ProgressStepperItemTrack({ className, ...props }: ComponentProps<'span'>) {
  const { variant, animated } = useContext(StepperContext);
  const { state } = useContext(StepContext);
  return (
    <span
      data-slot="progress-stepper-item-track"
      aria-hidden="true"
      {...props}
      className={cn(progressVariants({ size: 'sm' }), 'block bg-(--stepper-track)', variant === 'line' && 'mx-1.5 w-auto group-last/step:hidden', className)}
    >
      <span
        data-slot="progress-stepper-item-fill"
        className={cn(
          'absolute inset-0 origin-[left_center] rounded-[inherit] [transition:transform_var(--duration-spring-smooth)_var(--ease-spring-smooth),background-color_var(--duration-spring-smooth)_var(--ease-spring-smooth)] motion-reduce:transition-none',
          fillClass(state, animated),
        )}
      />
    </span>
  );
}

/** The step's name: visible under the icon when the stepper has `labels`, read by screen readers always. */
export function ProgressStepperItemLabel({ className, ...props }: ComponentProps<'span'>) {
  const { labels, variant } = useContext(StepperContext);
  const { state } = useContext(StepContext);
  return (
    <span
      data-slot="progress-stepper-item-label"
      {...props}
      className={cn(
        // Two lines before an ellipsis: "Order placed" and "Being prepared" keep their meaning on a phone.
        labels ? 'line-clamp-2 max-w-full text-caption2 font-semibold break-words text-balance' : 'sr-only',
        labels && (variant === 'line' ? 'col-span-2 text-start group-last/step:col-span-1 group-last/step:text-end' : 'text-center'),
        labels && (state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'),
        className,
      )}
    />
  );
}

/** A second line under the label (a time, a place); shown with the labels. */
export function ProgressStepperItemDescription({ className, ...props }: ComponentProps<'span'>) {
  const { labels, variant } = useContext(StepperContext);
  return (
    <span
      data-slot="progress-stepper-item-description"
      {...props}
      className={cn(labels ? 'max-w-full truncate text-caption2 text-muted-foreground tabular-nums' : 'sr-only', labels && variant === 'line' && 'col-span-2 group-last/step:col-span-1', className)}
    />
  );
}
