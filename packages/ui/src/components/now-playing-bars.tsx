import type { ComponentProps, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/* ══ NowPlayingBars — the equaliser that bounces beside the track that is playing ══
   A few bars scale from the bottom on staggered, slightly different periods, so they never fall into step.
   Paused, they settle to a still, uneven skyline (the same heights every time). Under reduced motion they stay
   still while playing too — the color and the `aria-label` still say which row is playing. Colored with
   `currentColor`. It is a media state, not a loading indicator: for "something is loading" use Spinner. The two
   share `speed` (a multiplier, bigger is faster); NowPlayingBars says `playing` where Spinner says `paused`,
   because a track's natural state is playing or not. */

export interface NowPlayingBarsProps extends Omit<ComponentProps<'span'>, 'children'> {
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
  /** Playback speed, like Spinner's: a multiplier, 0.25–3 (default 1, a 0.7s bounce for the first bar; the
   *  others run a little slower). */
  speed?: number;
  /** An accessible name ("Now playing"); omit it to hide the bars from assistive tech (the row usually says
   *  "Now playing" itself). */
  'aria-label'?: string;
}

/** Resting heights (fractions of the box): an uneven skyline, repeated for more than four bars. */
const REST = [0.9, 0.5, 0.75, 0.35, 0.62, 0.44];

export function NowPlayingBars({
  playing = true, bars = 4, size = 14, barWidth, gap, speed = 1, className, style, 'aria-label': label, ...props
}: NowPlayingBarsProps) {
  const k = Math.min(3, Math.max(0.25, speed));
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
      {...props}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="bl-eq-bar block origin-bottom rounded-[1px] bg-current"
          style={{
            width: w,
            height: `${REST[i % REST.length] * 100}%`,
            '--bl-eq-dur': `${(0.7 + i * 0.13) / k}s`,
            '--bl-eq-delay': `${i * -0.2}s`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
