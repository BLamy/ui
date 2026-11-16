'use client';
import { useCallback, useLayoutEffect, useRef, type CSSProperties, type Ref } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { skeletonVariants } from '@/components/ui/skeleton';
import { useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';

/* ══ Waveform — audio peaks drawn across a stretch of media time ══
   Give it peaks (the loudest sample of each slice, 0…1, `rate` slices per second, e.g. from `useMediaPeaks`) and the
   range it stands for (`from`…`to`, a clip's in and out points). It draws one bar per device pixel on a canvas, in the
   text colour, mirrored around the middle or rising from the bottom, scaled by `gain` (a clip's volume). `tone` picks a
   semantic colour; any `text-…` class tints it instead (`text-primary`), and the colour is read again when the
   appearance changes. While the peaks are loading (`loading`, by default while `peaks` is empty) it shows a flat
   shimmering band where the bars will be (`data-loading`), as Filmstrip shimmers its cells, so a clip keeps its look;
   with `loading={false}` and no peaks (silence, an FFmpeg error) it is empty. Decorative: it is hidden from assistive
   tech; the clip it sits in carries the label. ══ */

export const waveformVariants = cva('relative block h-full w-full', {
  variants: {
    /** Where the bars grow from (drawn on the canvas; written as `data-variant`). */
    variant: {
      mirror: '',
      bottom: '',
    },
    tone: {
      default: 'text-foreground/70',
      muted: 'text-muted-foreground/60',
      success: 'text-success',
      warning: 'text-warning',
      destructive: 'text-destructive',
    },
  },
  defaultVariants: { variant: 'mirror', tone: 'default' },
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
  /** Show the loading band instead of bars. Default: while `peaks` is empty. Pass the extraction's own state
   *  (`useMediaPeaks(…).loading`) so a failed or silent one stops shimmering. */
  loading?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLCanvasElement>;
}

/** The loading band: the bars' middle third (mirror) or bottom third (bottom), as a skeleton. */
const loadingBand = {
  mirror: '[mask-image:linear-gradient(to_bottom,transparent_36%,black_36%,black_64%,transparent_64%)]',
  bottom: '[mask-image:linear-gradient(to_top,black_28%,transparent_28%)]',
} as const;

export function Waveform({ peaks, rate, from = 0, to, gain = 1, loading: loadingProp, variant: variantProp, tone, className, style, ref: refProp }: WaveformProps) {
  const variant = variantProp ?? 'mirror';
  const loading = loadingProp ?? peaks.length === 0;
  const ref = useRef<HTMLCanvasElement | null>(null);
  const setRef = useCallback((el: HTMLCanvasElement | null) => {
    ref.current = el;
    if (typeof refProp === 'function') refProp(el);
    else if (refProp) refProp.current = el;
  }, [refProp]);
  const end = to ?? peaks.length / Math.max(1e-6, rate);
  // The canvas holds the colour it was drawn in, so a change of appearance draws it again. Without a provider to say
  // so, the host's class, `data-theme` or style on <html> is all there is to watch.
  const appearance = useAppearance();
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
      if (!(span > 0) || !peaks.length || loading) return;
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
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    ro?.observe(canvas);
    const watcher = appearance || typeof MutationObserver === 'undefined' ? null : new MutationObserver(draw);
    watcher?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => {
      ro?.disconnect();
      watcher?.disconnect();
    };
  }, [peaks, rate, from, end, gain, variant, tone, className, appearance, loading]);
  return (
    <canvas
      ref={setRef}
      data-slot="waveform"
      data-variant={variant}
      data-loading={loading ? '' : undefined}
      aria-hidden
      className={cn(waveformVariants({ variant, tone }), loading && [skeletonVariants({ shape: 'default' }), 'rounded-none', loadingBand[variant]], className)}
      style={style}
    />
  );
}
