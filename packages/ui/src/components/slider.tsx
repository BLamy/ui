'use client';
import { createContext, use, useId, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import {
  Slider as SdkSlider, SliderControl as SdkSliderControl, SliderIndicator as SdkSliderIndicator,
  SliderThumb as SdkSliderThumb, SliderTrack as SdkSliderTrack, SliderValue as SdkSliderValue,
} from '@ui-sdk/react/slider';
import { cva } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { useRowLabel } from '@/lib/row-label';
import { Label } from '@/components/ui/label';

/* ══ Slider — UI SDK's Slider with the iOS look of `.bl-range`: 4px track, tint fill, 26px white thumb ══
   `value` / `defaultValue` / `onValueChange(value, details)` (every step of a drag) and `onValueCommit` (once,
   when the interaction ends); `min`, `max`, `step`, `format`; a number for one thumb, an array for a range.
   Arrow keys, Page keys, Home and End come from UI SDK.

   <Slider label="Volume" showValue defaultValue={50} />

   With no children it renders the composition below from its props; pass the parts yourself to rearrange them:

   <Slider defaultValue={[20, 80]} aria-label="Price">
     <SliderValue />
     <SliderControl>
       <SliderTrack>
         <SliderIndicator />
         <SliderThumb index={0} aria-label="Lowest price" />
         <SliderThumb index={1} aria-label="Highest price" />
       </SliderTrack>
     </SliderControl>
   </Slider> */

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

export type SliderTone = 'default' | 'onDark' | 'onLight';

export type SliderProps<Value extends number | number[] = number | number[]> = ComponentProps<typeof SdkSlider<Value>> & {
  /** A visible label. It names the thumb (or, for a range, the group). */
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
  /** Names for a range's thumbs, in order (default "Minimum" and "Maximum"). */
  thumbLabels?: string[];
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
};

type SliderName = { 'aria-label'?: string; 'aria-labelledby'?: string };

/** The name of a one-thumb slider. The thumb's range input is the control, so its thumb takes the name. */
const SliderNameContext = createContext<SliderName | null>(null);

const thumbName = (count: number, index: number, labels?: string[]) =>
  labels?.[index] ?? (count === 2 ? ['Minimum', 'Maximum'][index] : `Thumb ${index + 1}`);

export function Slider<Value extends number | number[] = number | number[]>({
  className, style, label, showValue, thumbLabels, children, tone = 'default', size = 'default',
  trackColor, fillColor, thumbColor, id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...props
}: SliderProps<Value>) {
  const generatedId = useId();
  const rootId = id ?? generatedId;
  const rowLabel = useRowLabel({ 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy });
  // A visible label names the slider before the row it sits in does.
  const name: SliderName = { 'aria-label': ariaLabel, 'aria-labelledby': label ? ariaLabelledBy : rowLabel };
  // A range is a group, which takes the name, around thumbs with names of their own.
  const shape = props.value ?? props.defaultValue;
  const range = Array.isArray(shape) && shape.length > 1;
  // Caller-picked colors are runtime values, fed in as the --bl-slider-* knobs.
  const knobs = {
    ...(trackColor ? { '--bl-slider-track': trackColor } : null),
    ...(fillColor ? { '--bl-slider-fill': fillColor } : null),
    ...(thumbColor ? { '--bl-slider-thumb': thumbColor } : null),
  } as CSSProperties;
  return (
    <SliderNameContext value={range ? null : name}>
      <SdkSlider<Value>
        id={rootId}
        data-tone={tone === 'default' ? undefined : tone}
        data-size={size === 'default' ? undefined : size}
        className={cx(sliderVariants({ tone, size }), className)}
        style={typeof style === 'function' ? (state) => ({ ...knobs, ...style(state) }) : { ...knobs, ...style }}
        {...(range ? name : null)}
        {...props}
      >
        {children ?? ((state) => {
          const count = Array.isArray(state.value) ? state.value.length : 1;
          return (
            <>
              {/* The whole slider dims when disabled, its label with it: not twice. */}
              {label ? <Label htmlFor={rootId} className="group-data-disabled:opacity-100">{label}</Label> : null}
              {showValue ? <SliderValue className="col-start-2" /> : null}
              <SliderControl className="col-span-2">
                <SliderTrack>
                  <SliderIndicator />
                  {Array.from({ length: count }, (_, index) => (
                    <SliderThumb key={index} index={index} aria-label={count > 1 ? thumbName(count, index, thumbLabels) : undefined} />
                  ))}
                </SliderTrack>
              </SliderControl>
            </>
          );
        })}
      </SdkSlider>
    </SliderNameContext>
  );
}

/** The formatted value (a range joined with an en dash). Children replace it. */
export function SliderValue({ className, ...props }: ComponentProps<typeof SdkSliderValue>) {
  return <SdkSliderValue className={cx('text-subhead text-muted-foreground tabular-nums', className)} {...props} />;
}

/** Where presses land: a 28px-tall hit area around the 4px track, inset by half a thumb so the thumb never
    overhangs (like a native range). */
export function SliderControl({ className, ...props }: ComponentProps<typeof SdkSliderControl>) {
  return (
    <SdkSliderControl
      className={cx('mx-[13px] flex h-7 cursor-pointer items-center group-data-[size=sm]:mx-[6px] group-data-[size=sm]:h-5 data-disabled:cursor-default', className)}
      {...props}
    />
  );
}

/** The rail the thumbs move along. */
export function SliderTrack({ className, ...props }: ComponentProps<typeof SdkSliderTrack>) {
  return (
    <SdkSliderTrack
      className={cx('h-1 w-full rounded-full bg-[var(--bl-slider-track,var(--secondary-strong,var(--accent)))]', className)}
      {...props}
    />
  );
}

/** The filled part of the track: up to a single thumb, or between a range's first and last. */
export function SliderIndicator({ className, ...props }: ComponentProps<typeof SdkSliderIndicator>) {
  return <SdkSliderIndicator className={cx('rounded-full bg-[var(--bl-slider-fill,var(--primary))]', className)} {...props} />;
}

/** A thumb; `index` picks its value in a range. Its `aria-label` names the native range input inside it, which
    is what takes focus; a single thumb with no name of its own takes the slider's. */
export function SliderThumb({ className, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...props }: ComponentProps<typeof SdkSliderThumb>) {
  const slider = use(SliderNameContext);
  const named = ariaLabel != null || ariaLabelledBy != null;
  return (
    <SdkSliderThumb
      aria-label={named ? ariaLabel : slider?.['aria-label']}
      aria-labelledby={named ? ariaLabelledBy : slider?.['aria-labelledby']}
      className={cx(
        [
          'size-[26px] rounded-full bg-[var(--bl-slider-thumb,white)] shadow-[0_1px_4px_--alpha(black/28%),0_0_1px_--alpha(black/22%)] outline-none',
          'group-data-[size=sm]:size-3 group-data-[size=sm]:shadow-[0_0_0_.5px_--alpha(black/18%),0_1px_2px_--alpha(black/18%)] group-data-[size=sm]:data-dragging:scale-150',
          'transition-[scale,box-shadow] duration-spring-snappy ease-spring-snappy data-dragging:scale-110 motion-reduce:transition-none',
          'has-focus-visible:shadow-[0_1px_4px_--alpha(black/28%),0_0_0_4px_color-mix(in_oklab,var(--primary)_45%,transparent)]',
        ],
        className,
      )}
      {...props}
    />
  );
}

export { createSliderController } from '@ui-sdk/react/slider';
