import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ProgressBar, type ProgressBarProps } from 'react-aria-components';
import { cn } from '../lib/utils';
import { NumberMorph } from './number-morph';

/* ══ ProgressRing / CountdownRing — circular progress, iOS style ══
   ProgressRing is react-aria's ProgressBar (role=progressbar, aria-valuenow / valuetext) drawn as a ring: a
   track circle and a round-capped arc that springs to each new value, starting at 12 o'clock and running
   clockwise. Omit `value` (or pass `isIndeterminate`) for a spinning quarter arc.

   CountdownRing is the verification-code ring: seconds remaining out of a period, the arc draining linearly one
   second at a time (it is a clock, so it runs at constant speed rather than on a spring), the label rolling its
   digits, and both turning the warning color for the last few seconds. When the period restarts the arc jumps
   back to full instead of spinning backwards through the turnover. `useCountdown` drives one. */

type RingSize = 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<RingSize, { px: number; stroke: number; font: number }> = {
  sm: { px: 20, stroke: 2.2, font: 0 },
  md: { px: 28, stroke: 2.6, font: 10.5 },
  lg: { px: 44, stroke: 3.5, font: 13 },
  xl: { px: 72, stroke: 5, font: 20 },
};
const TONES = {
  default: 'var(--bl-tint)',
  success: 'var(--bl-green)',
  warning: 'var(--bl-orange, #FF9F0A)',
  destructive: 'var(--bl-red)',
} as const;
export type ProgressRingTone = keyof typeof TONES;

function dims(size: RingSize | number | undefined, thickness: number | undefined) {
  const s = typeof size === 'number' ? { px: size, stroke: Math.max(2, size / 12), font: size >= 26 ? size * 0.36 : 0 } : SIZES[size ?? 'md'];
  const stroke = thickness ?? s.stroke;
  const r = (s.px - stroke) / 2;
  return { ...s, stroke, r, c: 2 * Math.PI * r };
}

interface RingSvgProps {
  px: number; stroke: number; r: number; c: number; fraction: number; color: string;
  trackColor?: string; transition: string; spin?: boolean;
}

function RingSvg({ px, stroke, r, c, fraction, color, trackColor, transition, spin }: RingSvgProps) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true"
      className={cn('block -rotate-90', spin && 'animate-spin [animation-duration:900ms] motion-reduce:animate-none')}>
      <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke={trackColor ?? 'var(--bl-fill2)'} strokeWidth={stroke} />
      <circle
        data-slot="progress-ring-arc"
        cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
        stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - f)}
        // A zero-length round cap still draws a dot; hide the arc when empty.
        opacity={f <= 0 ? 0 : 1}
        style={{ transition }}
      />
    </svg>
  );
}

export interface ProgressRingProps extends Omit<ProgressBarProps, 'children' | 'className' | 'style'> {
  /** `sm` 20 · `md` 28 · `lg` 44 · `xl` 72 px, or a number of px. */
  size?: RingSize | number;
  /** Stroke width in px (defaults scale with the size). */
  thickness?: number;
  tone?: ProgressRingTone;
  /** Any CSS color for the arc (overrides `tone`). */
  color?: string;
  /** Any CSS color for the track. */
  trackColor?: string;
  /** Show the percentage in the middle (rolling digits). Needs `md` or larger. */
  showValue?: boolean;
  /** Custom content in the middle (an icon, a stop button…). */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ProgressRing({
  size, thickness, tone = 'default', color, trackColor, showValue, children, className, style, ...props
}: ProgressRingProps) {
  const d = dims(size, thickness);
  const plainPercent = props.valueLabel == null && props.formatOptions == null;
  return (
    <ProgressBar
      data-slot="progress-ring"
      {...props}
      className={cn('relative inline-grid shrink-0 place-items-center align-middle', className)}
      style={{ width: d.px, height: d.px, ...style }}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          <RingSvg
            {...d}
            fraction={isIndeterminate ? 0.25 : (percentage ?? 0) / 100}
            color={color ?? TONES[tone]}
            trackColor={trackColor}
            spin={isIndeterminate}
            transition="stroke-dashoffset var(--duration-spring-smooth) var(--ease-spring-smooth), stroke .3s, opacity .15s"
          />
          {children != null || (showValue && !isIndeterminate && d.font) ? (
            <span className="absolute inset-0 grid place-items-center font-semibold tabular-nums text-foreground"
              style={{ fontSize: d.font || undefined }}>
              {children ?? (plainPercent ? <NumberMorph value={(percentage ?? 0) / 100} format={{ style: 'percent' }} /> : valueText)}
            </span>
          ) : null}
        </>
      )}
    </ProgressBar>
  );
}

export interface CountdownRingProps {
  /** Seconds left. */
  remaining: number;
  /** Seconds in a full period (default 30). */
  duration?: number;
  /** Turn the warning color at or below this many seconds (default 5; 0 never). */
  warnAt?: number;
  /** `sm` 20 · `md` 28 · `lg` 44 · `xl` 72 px, or a number of px. */
  size?: RingSize | number;
  thickness?: number;
  /** The arc color while not warning (default the tint). */
  color?: string;
  /** The arc and label color while warning (default red). */
  warnColor?: string;
  trackColor?: string;
  /** Seconds in the middle (default true when the ring is `md` or larger). */
  showLabel?: boolean;
  /** Accessible label; default "N seconds left". */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

export function CountdownRing({
  remaining, duration = 30, warnAt = 5, size, thickness, color, warnColor, trackColor, showLabel, className, style,
  'aria-label': label,
}: CountdownRingProps) {
  const d = dims(size, thickness);
  const left = Math.max(0, Math.ceil(remaining));
  const warn = warnAt > 0 && left <= warnAt;
  const prev = useRef(left);
  // Counting up means the period restarted: jump, don't drain backwards through the turnover.
  const jump = left > prev.current;
  useEffect(() => { prev.current = left; }, [left]);
  const warnC = warnColor ?? 'var(--bl-red)';
  const label_ = showLabel ?? d.font > 0;
  return (
    <span
      data-slot="countdown-ring"
      data-warning={warn || undefined}
      role="timer"
      aria-label={label ?? `${left} second${left === 1 ? '' : 's'} left`}
      className={cn('relative inline-grid shrink-0 place-items-center align-middle', className)}
      style={{ width: d.px, height: d.px, ...style }}
    >
      <RingSvg
        {...d}
        fraction={left / duration}
        color={warn ? warnC : color ?? 'var(--bl-tint)'}
        trackColor={trackColor}
        transition={jump ? 'none' : 'stroke-dashoffset 1s linear, stroke .3s'}
      />
      {label_ ? (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-semibold tabular-nums transition-colors duration-300"
          style={{ fontSize: d.font || Math.max(9, d.px * 0.36), color: warn ? warnC : 'var(--bl-label2)' }}>
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
  /** Called each time it reaches zero. */
  onEnd?: () => void;
}

/** Whole seconds left in a `duration`-second countdown, ticking once a second. */
export function useCountdown(duration: number, { running = true, loop = true, onEnd }: UseCountdownOptions = {}) {
  const [left, setLeft] = useState(duration);
  const cur = useRef(duration);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (cur.current <= 0) return;
      let next = cur.current - 1;
      if (next <= 0) {
        end.current?.();
        next = loop ? duration : 0;
      }
      cur.current = next;
      setLeft(next);
    }, 1000);
    return () => clearInterval(id);
  }, [running, loop, duration]);
  const reset = () => { cur.current = duration; setLeft(duration); };
  return { remaining: left, reset };
}
