'use client';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ══ Waveform — audio peaks drawn across a stretch of media time ══
   Give it peaks (the loudest sample of each slice, 0…1, `rate` slices per second, e.g. from `useMediaPeaks`) and the
   range it stands for (`from`…`to`, a clip's in and out points). It draws one bar per device pixel on a canvas, in the
   text colour (`text-…` classes tint it), mirrored around the middle or rising from the bottom, scaled by `gain` (a
   clip's volume). Decorative: it is hidden from assistive tech; the clip it sits in carries the label. ══ */

export const waveformVariants = cva('relative block h-full w-full', {
  variants: {
    tone: {
      default: 'text-foreground/55',
      primary: 'text-primary',
      success: 'text-success',
      muted: 'text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'default' },
});

export interface WaveformProps extends VariantProps<typeof waveformVariants> {
  /** The loudest |sample| of each slice, 0…1. */
  peaks: ArrayLike<number>;
  /** Slices per second. */
  rate: number;
  /** The media time at the left edge. Default 0. */
  from?: number;
  /** The media time at the right edge. Default: the end of the peaks. */
  to?: number;
  /** Scales the bars (a clip's volume). Default 1. */
  gain?: number;
  /** `mirror` grows from the middle; `bottom` rises from the floor. Default `mirror`. */
  variant?: 'mirror' | 'bottom';
  className?: string;
  style?: CSSProperties;
}

export function Waveform({ peaks, rate, from = 0, to, gain = 1, variant = 'mirror', tone, className, style }: WaveformProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const end = to ?? peaks.length / Math.max(1e-6, rate);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const draw = () => {
      const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const g = canvas.getContext('2d');
      if (!g) return;
      g.clearRect(0, 0, w, h);
      g.fillStyle = getComputedStyle(canvas).color;
      const span = end - from;
      if (!(span > 0) || !peaks.length) return;
      for (let x = 0; x < w; x++) {
        // The slices this pixel column covers; at least one, so a zoomed-in strip stays continuous.
        const a = Math.floor((from + (x / w) * span) * rate);
        const b = Math.max(a + 1, Math.floor((from + ((x + 1) / w) * span) * rate));
        let v = 0;
        for (let i = Math.max(0, a); i < Math.min(peaks.length, b); i++) if (peaks[i] > v) v = peaks[i];
        const bar = Math.max(dpr, Math.min(1, v * gain) * h);
        if (variant === 'bottom') g.fillRect(x, h - bar, 1, bar);
        else g.fillRect(x, (h - bar) / 2, 1, bar);
      }
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [peaks, rate, from, end, gain, variant, tone, className]);
  return <canvas ref={ref} data-slot="waveform" aria-hidden className={cn(waveformVariants({ tone }), className)} style={style} />;
}
