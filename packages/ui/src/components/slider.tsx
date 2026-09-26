import { useRef, type CSSProperties, type ReactNode } from 'react';
import {
  Label,
  Slider as AriaSlider, type SliderProps as AriaSliderProps,
  SliderOutput,
  SliderThumb as AriaSliderThumb, type SliderThumbProps,
  SliderTrack as AriaSliderTrack, type SliderTrackProps,
  composeRenderProps,
} from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ Slider — react-aria's Slider with the iOS look of `.bl-range`: 4px track, tint fill, 26px white thumb.
   Arrow keys / Page keys / Home / End from react-aria; one or two thumbs (pass an array for a range).
   Haptics: a selection tick at each detent — every step when there are ≤ 16, else sixteenths of the range. ══ */

export interface SliderProps<T extends number | number[]> extends AriaSliderProps<T> {
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
}

export function Slider<T extends number | number[]>({
  className, label, showValue, children, onChange, minValue = 0, maxValue = 100, step = 1, ...props
}: SliderProps<T>) {
  const detents = Math.max(1, Math.min(16, Math.round((maxValue - minValue) / step)));
  const last = useRef<number[] | null>(null);
  const detentOf = (v: number) => Math.round(((v - minValue) / (maxValue - minValue || 1)) * detents);
  return (
    <AriaSlider<T>
      data-slot="slider"
      minValue={minValue}
      maxValue={maxValue}
      step={step}
      onChange={(v) => {
        const d = ((Array.isArray(v) ? v : [v]) as number[]).map(detentOf);
        if (last.current && d.some((x, i) => x !== last.current![i])) Haptics.selection();
        last.current = d;
        onChange?.(v);
      }}
      className={composeRenderProps(className, (cls) =>
        cn('group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40', cls))}
      {...props}
    >
      {composeRenderProps(children, (kids, { state }) => {
        if (last.current == null) last.current = state.values.map(detentOf);
        return kids ?? (
          <>
            {label ? <Label className="text-[15px] font-medium text-foreground">{label}</Label> : null}
            {showValue ? <SliderOutput className="col-start-2 text-[15px] text-muted-foreground tabular-nums" /> : null}
            <SliderTrack className="col-span-2">
              {state.values.map((_, i) => <SliderThumb key={i} index={i} />)}
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
      data-haptic-drag=""
      className={composeRenderProps(className, (cls) => cn('relative mx-[13px] h-7 cursor-pointer data-disabled:cursor-default', cls))}
      {...props}
    >
      {composeRenderProps(children, (kids, { state }) => {
        const range = state.values.length > 1;
        const start = range ? state.getThumbPercent(0) : 0;
        const end = state.getThumbPercent(range ? state.values.length - 1 : 0);
        return (
          <>
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-bl-fill2" />
            <span
              aria-hidden="true"
              data-slot="slider-range"
              className="absolute top-1/2 left-(--start) h-1 w-(--len) -translate-y-1/2 rounded-full bg-primary"
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
        'top-1/2 size-[26px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.28),0_0_1px_rgba(0,0,0,.22)] outline-none',
        'transition-[scale,box-shadow] duration-spring-snappy ease-spring-snappy data-dragging:scale-110 motion-reduce:transition-none',
        'data-focus-visible:shadow-[0_1px_4px_rgba(0,0,0,.28),0_0_0_4px_color-mix(in_oklab,var(--bl-tint)_45%,transparent)]',
        cls,
      ))}
      {...props}
    />
  );
}
