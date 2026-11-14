'use client';
import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { Progress as SdkProgress, ProgressValue as SdkProgressValue } from '@ui-sdk/react/progress';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';
import { NumberMorph } from '@/components/ui/number-morph';

/* ══ ProgressRing / CountdownRing — circular progress, iOS style ══
   ProgressRing is UI SDK's Progress (role=progressbar, aria-valuenow / valuetext) drawn as a ring: a track
   circle and a round-capped arc that springs to each new value, starting at 12 o'clock and running clockwise.
   Leave `value` out for a spinning quarter arc (under reduced motion: a still, dim full ring, so it never reads as
   "25% done"). Name it with `aria-label`.

   CountdownRing is the verification-code ring: seconds remaining out of a period, the arc draining linearly one
   second at a time (it is a clock, so it runs at constant speed rather than on a spring), the label rolling its
   digits, and both turning the urgent color (red) for the last few seconds. When the period restarts the arc jumps
   back to full instead of spinning backwards through the turnover. `useCountdown` drives one. */

export type ProgressRingSize = 'sm' | 'default' | 'lg' | 'xl';
const SIZES: Record<ProgressRingSize, { px: number; stroke: number; font: number }> = {
  sm: { px: 20, stroke: 2.2, font: 0 },
  default: { px: 28, stroke: 2.6, font: 10.5 },
  lg: { px: 44, stroke: 3.5, font: 13 },
  xl: { px: 72, stroke: 5, font: 20 },
};
/** A percentage needs room inside the stroke: "100%" overflows anything smaller than `lg`. */
const VALUE_MIN_PX = 40;

/** The ring's box and arc color. Geometry (px, stroke, font) is computed and fed in as --ring-* variables; a
 *  `color` / `trackColor` prop overrides --ring-color / --ring-track. */
export const progressRingVariants = cva(
  'relative inline-grid size-(--ring-px) shrink-0 place-items-center align-middle',
  {
    variants: {
      tone: {
        default: '[--ring-color:var(--primary)]',
        success: '[--ring-color:var(--color-success)]',
        warning: '[--ring-color:var(--color-warning)]',
        destructive: '[--ring-color:var(--destructive)]',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);
export type ProgressRingTone = NonNullable<VariantProps<typeof progressRingVariants>['tone']>;

/** Runtime ring geometry and caller colors as CSS variables. */
const ringVars = (d: { px: number; font: number }, color?: string, trackColor?: string, style?: CSSProperties) => ({
  '--ring-px': d.px + 'px',
  ...(d.font ? { '--ring-font': d.font + 'px' } : null),
  ...(color ? { '--ring-color': color } : null),
  ...(trackColor ? { '--ring-track': trackColor } : null),
  ...style,
}) as CSSProperties;

function dims(size: ProgressRingSize | number | undefined, thickness: number | undefined) {
  const s = typeof size === 'number' ? { px: size, stroke: Math.max(2, size / 12), font: size >= 26 ? size * 0.36 : 0 } : SIZES[size ?? 'default'];
  const stroke = thickness ?? s.stroke;
  const r = (s.px - stroke) / 2;
  return { ...s, stroke, r, c: 2 * Math.PI * r };
}

interface RingSvgProps {
  px: number; stroke: number; r: number; c: number; fraction: number;
  /** Classes for the arc's transition. */
  transition: string; spin?: boolean;
}

/* Indeterminate under reduced motion: no spin, and the whole ring dimly drawn instead of a still quarter arc. */
const stillIndeterminate = 'motion-reduce:[stroke-dashoffset:0] motion-reduce:opacity-35';

function RingSvg({ px, stroke, r, c, fraction, transition, spin }: RingSvgProps) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true"
      className={cn('block -rotate-90', spin && 'animate-spin [animation-duration:900ms] motion-reduce:animate-none')}>
      <circle cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-(--ring-track,var(--secondary-strong,var(--accent)))" />
      <circle
        data-slot="progress-ring-arc"
        cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - f)}
        // A zero-length round cap still draws a dot; hide the arc when empty.
        opacity={f <= 0 ? 0 : 1}
        className={cn('stroke-(--ring-color)', transition, spin && stillIndeterminate)}
      />
    </svg>
  );
}

export type ProgressRingProps = Omit<ComponentProps<typeof SdkProgress>, 'children' | 'style'> & VariantProps<typeof progressRingVariants> & {
  /** `sm` 20 · `default` 28 · `lg` 44 · `xl` 72 px, or a number of px. */
  size?: ProgressRingSize | number;
  /** Stroke width in px (defaults scale with the size). */
  thickness?: number;
  /** Any CSS color for the arc (overrides `tone`). */
  color?: string;
  /** Any CSS color for the track. */
  trackColor?: string;
  /** Show the value in the middle (the default percentage rolls its digits). Needs `lg` (or 40px) or larger:
   *  smaller rings have no room for "100%" inside the stroke, and ignore it. */
  showValue?: boolean;
  /** Custom content in the middle (an icon, a stop button…). */
  children?: ReactNode;
  style?: CSSProperties;
};

const ringCenter = 'absolute inset-0 grid place-items-center font-semibold tabular-nums text-foreground';

export function ProgressRing({
  size, thickness, tone, color, trackColor, showValue, children, className, style, ...props
}: ProgressRingProps) {
  const d = dims(size, thickness);
  // A custom format shows UI SDK's text as is; the default percentage rolls.
  const plainPercent = props.format == null;
  const sized = d.font ? 'text-(length:--ring-font)' : '';
  return (
    <SdkProgress
      {...props}
      className={cx(progressRingVariants({ tone }), className)}
      style={ringVars(d, color, trackColor, style)}
    >
      {(state) => {
        const indeterminate = state.status === 'indeterminate';
        return (
          <>
            <RingSvg
              {...d}
              fraction={indeterminate ? 0.25 : (state.percent ?? 0) / 100}
              spin={indeterminate}
              transition="[transition:stroke-dashoffset_var(--duration-spring-smooth)_var(--ease-spring-smooth),stroke_.3s,opacity_.15s]"
            />
            {children != null ? (
              <span className={cn(ringCenter, sized)}>{children}</span>
            ) : showValue && !indeterminate && d.font && d.px >= VALUE_MIN_PX ? (
              <SdkProgressValue className={cn(ringCenter, sized)}>
                {plainPercent ? (value) => <NumberMorph value={(value.percent ?? 0) / 100} format={{ style: 'percent' }} locale={props.locale} /> : undefined}
              </SdkProgressValue>
            ) : null}
          </>
        );
      }}
    </SdkProgress>
  );
}

/** CountdownRing's seconds label, sized by the ring (--ring-font); `urgent` turns it the urgent color. */
export const countdownRingLabelVariants = cva(
  'absolute inset-0 grid place-items-center font-semibold tabular-nums text-(length:--ring-font) transition-colors duration-300',
  {
    variants: {
      urgent: { false: 'text-muted-foreground', true: 'text-(--ring-urgent)' },
    },
    defaultVariants: { urgent: false },
  },
);

export interface CountdownRingProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'color'> {
  /** Seconds left. */
  remaining: number;
  /** Seconds in a full period (default 30). */
  duration?: number;
  /** Turn the urgent color at or below this many seconds (default 5; 0 never). */
  urgentAt?: number;
  /** `sm` 20 · `default` 28 · `lg` 44 · `xl` 72 px, or a number of px. */
  size?: ProgressRingSize | number;
  thickness?: number;
  /** The arc color while not urgent (default the tint). */
  color?: string;
  /** The arc and label color for the last seconds (default `--destructive`, red). */
  urgentColor?: string;
  trackColor?: string;
  /** Seconds in the middle (default: when the ring is 26px or larger). */
  showLabel?: boolean;
  /** Accessible label; default "N seconds left". */
  'aria-label'?: string;
  ref?: Ref<HTMLSpanElement>;
}

export function CountdownRing({
  remaining, duration = 30, urgentAt = 5, size, thickness, color, urgentColor, trackColor, showLabel, className, style,
  'aria-label': label, ...props
}: CountdownRingProps) {
  const d = dims(size, thickness);
  const left = Math.max(0, Math.ceil(remaining));
  const urgent = urgentAt > 0 && left <= urgentAt;
  const prev = useRef(left);
  // Counting up means the period restarted: jump, don't drain backwards through the turnover.
  const jump = left > prev.current;
  useEffect(() => { prev.current = left; }, [left]);
  const label_ = showLabel ?? d.font > 0;
  return (
    <span
      {...props}
      data-slot="countdown-ring"
      data-urgent={urgent || undefined}
      role="timer"
      aria-label={label ?? `${left} second${left === 1 ? '' : 's'} left`}
      className={cn(
        progressRingVariants(),
        '[--ring-urgent:var(--destructive)] data-urgent:[--ring-color:var(--ring-urgent)]',
        className,
      )}
      style={ringVars({ px: d.px, font: d.font || Math.max(9, d.px * 0.36) }, color,
        trackColor, urgentColor ? { '--ring-urgent': urgentColor, ...style } as CSSProperties : style)}
    >
      <RingSvg
        {...d}
        fraction={left / duration}
        transition={jump ? '[transition:none]' : '[transition:stroke-dashoffset_1s_linear,stroke_.3s]'}
      />
      {label_ ? (
        <span aria-hidden="true" className={countdownRingLabelVariants({ urgent })}>
          <NumberMorph value={left} />
        </span>
      ) : null}
    </span>
  );
}

export interface UseCountdownOptions {
  /** Running (default true). Pausing freezes the remaining time. */
  running?: boolean;
  /** Start again from `duration` when it reaches zero (default true: a TOTP-style period). */
  loop?: boolean;
  /** Called each time it reaches zero (once per period that ended, even if the page was throttled meanwhile). */
  onEnd?: () => void;
  /** Seconds already elapsed when it starts, e.g. to align a TOTP period with a clock (default 0). */
  offset?: number;
}

export interface Countdown {
  /** Whole seconds left in the current period (`duration` … 1 while looping; down to 0 when not). */
  remaining: number;
  /** Periods completed so far (0 at the start); a TOTP code's window is its start window + `period`. */
  period: number;
  /** Whole seconds elapsed, `offset` included. */
  elapsed: number;
  /** Start over from `offset` (period 0). */
  reset: () => void;
}

/** A `duration`-second countdown on the wall clock: it reads `Date.now()` (so throttled or delayed timers catch up
 *  instead of drifting, and a frozen clock freezes it) and re-renders only when the whole second changes. */
export function useCountdown(duration: number, { running = true, loop = true, onEnd, offset = 0 }: UseCountdownOptions = {}): Countdown {
  // Milliseconds run before the current stretch, and when the current stretch started (null while paused).
  const acc = useRef(0);
  const since = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(offset);
  const seen = useRef(-1);
  const end = useRef(onEnd);
  end.current = onEnd;
  const read = () => offset + Math.floor((acc.current + (since.current == null ? 0 : Date.now() - since.current)) / 1000);
  const periodOf = (e: number) => (loop ? Math.floor(e / duration) : Math.min(1, Math.floor(e / duration)));
  if (seen.current < 0) seen.current = periodOf(offset);
  const sync = () => {
    const e = read();
    const p = periodOf(e);
    for (; seen.current < p; seen.current++) end.current?.();
    setElapsed(e);
  };
  useEffect(() => {
    if (!running) return;
    since.current = Date.now();
    const id = setInterval(sync, 250);
    return () => {
      clearInterval(id);
      acc.current += Date.now() - (since.current ?? Date.now());
      since.current = null;
    };
  }, [running, loop, duration, offset]);
  const reset = () => {
    acc.current = 0;
    if (since.current != null) since.current = Date.now();
    seen.current = periodOf(offset);
    setElapsed(offset);
  };
  const period = periodOf(elapsed) - periodOf(offset);
  const remaining = loop ? duration - (elapsed % duration) : Math.max(0, duration - elapsed);
  return { remaining, period, elapsed, reset };
}
