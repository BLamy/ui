import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

/* ══ NowPlayingBars — the equaliser that bounces beside the track that is playing ══
   A few bars scale from the bottom on staggered, slightly different periods, so they never fall into step.
   Paused, they settle to a still, uneven skyline (the same heights every time). Under reduced motion they stay
   still while playing too — the color and the `aria-label` still say which row is playing. Colored with
   `currentColor`. */

export interface NowPlayingBarsProps {
  /** Bouncing (true) or still (false). */
  playing?: boolean;
  /** Number of bars (default 4). */
  bars?: number;
  /** Height in px (default 14). Bar width and gap scale with it unless set. */
  size?: number;
  /** Bar width in px. */
  barWidth?: number;
  /** Gap between bars in px. */
  gap?: number;
  /** Seconds for one bounce of the first bar (default 0.7); the others run a little slower. */
  speed?: number;
  /** Accessible label; omit to hide it from assistive tech (the row usually says "Now playing" itself). */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** Resting heights (fractions of the box): an uneven skyline, repeated for more than four bars. */
const REST = [0.9, 0.5, 0.75, 0.35, 0.62, 0.44];

export function NowPlayingBars({
  playing = true, bars = 4, size = 14, barWidth, gap, speed = 0.7, className, style, 'aria-label': label,
}: NowPlayingBarsProps) {
  const w = barWidth ?? Math.max(2, Math.round(size * 0.22));
  const g = gap ?? Math.max(1, Math.round(size * 0.14));
  return (
    <span
      data-slot="now-playing-bars"
      data-playing={playing || undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-flex shrink-0 items-end', className)}
      style={{ height: size, gap: g, ...style }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="bl-eq-bar block origin-bottom rounded-[1px] bg-current"
          style={{
            width: w,
            height: `${REST[i % REST.length] * 100}%`,
            '--bl-eq-dur': `${speed + i * 0.13}s`,
            '--bl-eq-delay': `${i * -0.2}s`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
