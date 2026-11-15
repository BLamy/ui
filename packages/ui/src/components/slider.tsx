'use client';
import { createContext, use, useId, type ComponentProps, type ReactNode } from 'react';
import {
  Slider as SdkSlider, SliderControl as SdkSliderControl, SliderIndicator as SdkSliderIndicator,
  SliderThumb as SdkSliderThumb, SliderTrack as SdkSliderTrack, SliderValue as SdkSliderValue,
} from '@ui-sdk/react/slider';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';
import { themeScopeClass } from '@/lib/theme';
import { useRowLabel } from '@/lib/row-label';
import { Label } from '@/components/ui/label';

/* ══ Slider — UI SDK's Slider with the iOS look of `.bl-range`: 4px track, tint fill, 26px white thumb ══
   `value` / `defaultValue` / `onValueChange(value, details)` (every step of a drag) and `onValueCommit` (once,
   when the interaction ends); `min`, `max`, `step`, `format`; a number for one thumb, an array for a range.
   Arrow keys, Page keys, Home and End come from UI SDK. `orientation="vertical"` stands it up (a mixer channel):
   it fills its parent's height, so give the parent one.

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

/** Root layout plus the variant's track / fill colors, as the `--bl-slider-track`, `--bl-slider-fill` and
    `--bl-slider-thumb` knobs the parts read. Set a knob yourself for any other color:
    `className="[--bl-slider-fill:var(--success)]"`. */
export const sliderVariants = cva(
  [
    'group/slider grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40',
    // Stood up: the label and value over a control that takes the rest of the parent's height.
    'data-[orientation=vertical]:flex data-[orientation=vertical]:h-full data-[orientation=vertical]:w-fit data-[orientation=vertical]:flex-col',
  ],
  {
    variants: {
      variant: {
        default: '',
        /** Translucent, monochrome: the media look over artwork, video or glass. White on a dark scheme, black on a
            light one (`light-dark()` follows the nearest `color-scheme`: the page's, or the slider's `appearance`). */
        overlay: '[--bl-slider-track:light-dark(--alpha(black/14%),--alpha(white/22%))] [--bl-slider-fill:light-dark(--alpha(black/72%),--alpha(white/88%))]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type SliderVariant = NonNullable<VariantProps<typeof sliderVariants>['variant']>;

export type SliderProps<Value extends number | number[] = number | number[]> = ComponentProps<typeof SdkSlider<Value>> & {
  /** A visible label. It names the thumb (or, for a range, the group). */
  label?: ReactNode;
  /** Show the formatted value opposite the label. */
  showValue?: boolean;
  /** Names for a range's thumbs, in order (default "Minimum" and "Maximum"). */
  thumbLabels?: string[];
  /** The look of the track and fill. `default`: the tint on the fill color. `overlay`: translucent and monochrome,
      for media controls over artwork, video or glass (Music's scrubber and volume). */
  variant?: SliderVariant | null;
  /** The color scheme of what the slider sits on. `auto` (default) follows the page; `dark` or `light` sets it for
      the slider alone, as over artwork that is dark in both schemes (then `overlay` draws white). */
  appearance?: 'auto' | 'light' | 'dark';
  /** `default`: the 26px iOS thumb. `sm`: a 12px thumb on a 20px-tall hit area that grows while dragging (scrubbers). */
  size?: 'default' | 'sm' | null;
};

type SliderName = { 'aria-label'?: string; 'aria-labelledby'?: string };

/** The name of a one-thumb slider. The thumb's range input is the control, so its thumb takes the name. */
const SliderNameContext = createContext<SliderName | null>(null);

const thumbName = (count: number, index: number, labels?: string[]) =>
  labels?.[index] ?? (count === 2 ? ['Minimum', 'Maximum'][index] : `Thumb ${index + 1}`);

export function Slider<Value extends number | number[] = number | number[]>({
  className, label, showValue, thumbLabels, children, variant = 'default', appearance = 'auto', size = 'default', id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...props
}: SliderProps<Value>) {
  const generatedId = useId();
  const rootId = id ?? generatedId;
  const rowLabel = useRowLabel({ 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy });
  // A visible label names the slider before the row it sits in does.
  const name: SliderName = { 'aria-label': ariaLabel, 'aria-labelledby': label ? ariaLabelledBy : rowLabel };
  // A range is a group, which takes the name, around thumbs with names of their own.
  const shape = props.value ?? props.defaultValue;
  const range = Array.isArray(shape) && shape.length > 1;
  return (
    <SliderNameContext value={range ? null : name}>
      <SdkSlider<Value>
        id={rootId}
        data-variant={variant === 'default' ? undefined : variant}
        data-appearance={appearance === 'auto' ? undefined : appearance}
        data-size={size === 'default' ? undefined : size}
        className={cx(cn(sliderVariants({ variant }), appearance !== 'auto' && themeScopeClass(appearance)), className)}
        {...(range ? name : null)}
        {...props}
      >
        {children ?? ((state) => {
          const count = Array.isArray(state.value) ? state.value.length : 1;
          return (
            <>
              {/* The whole slider dims when disabled, its label with it (the root is a named group, so the label's own
                  disabled dimming doesn't match it a second time). */}
              {label ? <Label htmlFor={rootId}>{label}</Label> : null}
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

/** Where presses land: a 28px-wide band around the 4px track, inset by half a thumb so the thumb never overhangs
    (like a native range). Vertical, it is a column that takes the slider's remaining height. */
export function SliderControl({ className, ...props }: ComponentProps<typeof SdkSliderControl>) {
  return (
    <SdkSliderControl
      className={cx(
        [
          'mx-[13px] flex h-7 cursor-pointer items-center group-data-[size=sm]/slider:mx-[6px] group-data-[size=sm]/slider:h-5 data-disabled:cursor-default',
          'data-[orientation=vertical]:mx-0 data-[orientation=vertical]:my-[13px] data-[orientation=vertical]:h-auto data-[orientation=vertical]:min-h-24 data-[orientation=vertical]:w-7 data-[orientation=vertical]:flex-1 data-[orientation=vertical]:justify-center',
          'data-[orientation=vertical]:group-data-[size=sm]/slider:mx-0 data-[orientation=vertical]:group-data-[size=sm]/slider:my-[6px] data-[orientation=vertical]:group-data-[size=sm]/slider:h-auto data-[orientation=vertical]:group-data-[size=sm]/slider:w-5',
        ],
        className,
      )}
      {...props}
    />
  );
}

/** The rail the thumbs move along. */
export function SliderTrack({ className, ...props }: ComponentProps<typeof SdkSliderTrack>) {
  return (
    <SdkSliderTrack
      className={cx('h-1 w-full rounded-full bg-[var(--bl-slider-track,var(--secondary-strong,var(--accent)))] data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1', className)}
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
          'group-data-[size=sm]/slider:size-3 group-data-[size=sm]/slider:shadow-[0_0_0_.5px_--alpha(black/18%),0_1px_2px_--alpha(black/18%)] group-data-[size=sm]/slider:data-dragging:scale-150',
          'transition-[scale,box-shadow] duration-spring-snappy ease-spring-snappy data-dragging:scale-110 motion-reduce:transition-none',
          // The kit's solid focus ring (the native range input inside takes focus).
          'has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background',
        ],
        className,
      )}
      {...props}
    />
  );
}

export { createSliderController } from '@ui-sdk/react/slider';
