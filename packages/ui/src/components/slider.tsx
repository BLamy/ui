'use client';
import type { CSSProperties, ReactNode } from 'react';
import {
  Label,
  Slider as AriaSlider, type SliderProps as AriaSliderProps,
  SliderOutput,
  SliderThumb as AriaSliderThumb, type SliderThumbProps,
  SliderTrack as AriaSliderTrack, type SliderTrackProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useRowLabel } from '@/lib/row-label';

/* ══ Slider — react-aria's Slider with the iOS look of `.bl-range`: 4px track, tint fill, 26px white thumb.
   Arrow keys / Page keys / Home / End from react-aria; one or two thumbs (pass an array for a range). ══ */

/** Root layout plus the tone's track / fill colors (as --bl-slider-* knobs the track and thumb read). */
export const sliderVariants = cva('group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40', {
  variants: {
    tone: {
      default: '',
      onDark: '[--bl-slider-track:--alpha(white/22%)] [--bl-slider-fill:--alpha(white/88%)]',
      onLight: '[--bl-slider-track:--alpha(black/14%)] [--bl-slider-fill:--alpha(black/72%)]',
    },
    size: { default: '', sm: '' },
  },
  defaultVariants: { tone: 'default', size: 'default' },
});

export interface SliderProps<T extends number | number[]> extends AriaSliderProps<T>, VariantProps<typeof sliderVariants> {
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
  /** Color scheme of the track, fill and thumb. `default`: the tint on the fill color. `onDark`: translucent
      white for media controls over artwork or dark glass (Music's scrubber and volume). `onLight`: translucent
      black for light imagery. Fine-tune any of them with `trackColor` / `fillColor` / `thumbColor`. */
  tone?: SliderTone | null;
  /** `default`: the 26px iOS thumb. `sm`: a 12px thumb on a 20px-tall hit area that grows while dragging (scrubbers). */
  size?: 'default' | 'sm' | null;
  /** Any CSS color for the unfilled track. */
  trackColor?: string;
  /** Any CSS color for the filled part. */
  fillColor?: string;
  /** Any CSS color for the thumb. */
  thumbColor?: string;
}

export type SliderTone = 'default' | 'onDark' | 'onLight';

export function Slider<T extends number | number[]>({
  className, label, showValue, children, minValue = 0, maxValue = 100, step = 1,
  tone = 'default', size = 'default', trackColor, fillColor, thumbColor, style, ...props
}: SliderProps<T>) {
  const rowLabel = useRowLabel(props);
  return (
    <AriaSlider<T>
      data-slot="slider"
      data-tone={tone === 'default' ? undefined : tone}
      data-size={size === 'default' ? undefined : size}
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      className={composeRenderProps(className, (cls) => cn(sliderVariants({ tone, size }), cls))}
      // Caller-picked colors are runtime values, fed in as the --bl-slider-* knobs.
      style={composeRenderProps(style, (st) => {
        const vars = {
          ...(trackColor ? { '--bl-slider-track': trackColor } : null),
          ...(fillColor ? { '--bl-slider-fill': fillColor } : null),
          ...(thumbColor ? { '--bl-slider-thumb': thumbColor } : null),
        };
        return Object.keys(vars).length ? ({ ...vars, ...st } as CSSProperties) : st;
      })}
      {...props}
      aria-labelledby={label ? props['aria-labelledby'] : rowLabel}
    >
      {composeRenderProps(children, (kids, { state }) => {
        return kids ?? (
          <>
            {label ? <Label className="text-subhead font-medium text-foreground">{label}</Label> : null}
            {showValue ? <SliderOutput className="col-start-2 text-subhead text-muted-foreground tabular-nums" /> : null}
            <SliderTrack className="col-span-2">
              {/* A thumb names itself from the group's *content* plus its own `aria-labelledby`, so a label that comes from
                  outside the group (the row's title) has to be handed to each thumb. */}
              {state.values.map((_, i) => <SliderThumb key={i} index={i} {...(!label && rowLabel ? { 'aria-labelledby': rowLabel } : null)} />)}
            </SliderTrack>
          </>
        );
      })}
    </AriaSlider>
  );
}

/** 28px hit area with the 4px track and tint fill inside; inset by half a thumb so the thumb never overhangs
    (like a native range). Children are the thumbs. */
export function SliderTrack({ className, children, ...props }: SliderTrackProps) {
  return (
    <AriaSliderTrack
      data-slot="slider-track"
      className={composeRenderProps(className, (cls) => cn('relative mx-[13px] h-7 cursor-pointer group-data-[size=sm]:mx-[6px] group-data-[size=sm]:h-5 data-disabled:cursor-default', cls))}
      {...props}
    >
      {composeRenderProps(children, (kids, { state }) => {
        const range = state.values.length > 1;
        const start = range ? state.getThumbPercent(0) : 0;
        const end = state.getThumbPercent(range ? state.values.length - 1 : 0);
        return (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--bl-slider-track,var(--secondary-strong,var(--accent)))]" />
            <span
              aria-hidden="true"
              data-slot="slider-range"
              className="absolute top-1/2 left-(--start) h-1 w-(--len) -translate-y-1/2 rounded-full bg-[var(--bl-slider-fill,var(--primary))]"
              style={{ '--start': `${start * 100}%`, '--len': `${(end - start) * 100}%` } as CSSProperties}
            />
            {kids}
          </>
        );
      })}
    </AriaSliderTrack>
  );
}

export function SliderThumb({ className, ...props }: SliderThumbProps) {
  return (
    <AriaSliderThumb
      data-slot="slider-thumb"
      className={composeRenderProps(className, (cls) => cn(
        'top-1/2 size-[26px] rounded-full bg-[var(--bl-slider-thumb,white)] shadow-[0_1px_4px_--alpha(black/28%),0_0_1px_--alpha(black/22%)] outline-none',
        'group-data-[size=sm]:size-3 group-data-[size=sm]:shadow-[0_0_0_.5px_--alpha(black/18%),0_1px_2px_--alpha(black/18%)] group-data-[size=sm]:data-dragging:scale-150',
        'transition-[scale,box-shadow] duration-spring-snappy ease-spring-snappy data-dragging:scale-110 motion-reduce:transition-none',
        'data-focus-visible:shadow-[0_1px_4px_--alpha(black/28%),0_0_0_4px_color-mix(in_oklab,var(--primary)_45%,transparent)]',
        cls,
      ))}
      {...props}
    />
  );
}
