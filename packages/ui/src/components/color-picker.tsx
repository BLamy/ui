'use client';
import { useContext, type ReactNode } from 'react';
import {
  ColorArea as AriaColorArea, type ColorAreaProps as AriaColorAreaProps,
  ColorPicker as AriaColorPicker, type ColorPickerProps as AriaColorPickerProps,
  ColorPickerStateContext,
  ColorSlider as AriaColorSlider, type ColorSliderProps as AriaColorSliderProps,
  ColorSwatchPicker as AriaColorSwatchPicker, type ColorSwatchPickerProps as AriaColorSwatchPickerProps,
  ColorSwatchPickerItem as AriaColorSwatchPickerItem, type ColorSwatchPickerItemProps as AriaColorSwatchPickerItemProps,
  ColorThumb as AriaColorThumb, type ColorThumbProps as AriaColorThumbProps,
  Dialog as AriaDialog,
  SliderOutput,
  SliderTrack,
  composeRenderProps,
} from 'react-aria-components';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch, ColorSwatch } from '@/components/ui/color-field';
import { Label } from '@/components/ui/label';
import { Popover, type PopoverProps } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/* ══ ColorPicker — react-aria's color editing parts, drawn as iOS. ColorPicker itself draws nothing: it holds the color
   (`value` / `defaultValue` / `onChange`, any CSS color string or a parseColor() object) and hands it to the parts inside:
   a ColorArea (two channels at once), ColorSliders (one channel), a ColorSwatchPicker (presets), a ColorField (hex) and
   the ColorSwatch / ColorPickerTrigger that show it. Every part is keyboard-operable (arrows, Page Up/Down, Home/End).
   <ColorPicker defaultValue="hsl(262, 83%, 66%)">
     <PopoverTrigger>
       <ColorPickerTrigger />
       <ColorPickerContent swatches={['hsl(4, 100%, 61%)', 'hsl(135, 70%, 50%)']} />
     </PopoverTrigger>
   </ColorPicker> ══ */

export const ColorPicker = AriaColorPicker;
export type ColorPickerProps = AriaColorPickerProps;

export interface ColorThumbProps extends AriaColorThumbProps {}

/** The draggable handle of a ColorArea or ColorSlider; it is filled with the color it sits on. */
export function ColorThumb({ className, ...props }: ColorThumbProps) {
  return (
    <AriaColorThumb
      data-slot="color-thumb"
      className={composeRenderProps(className, (cls) =>
        cn(
          'box-border size-6 rounded-full border-2 border-white shadow-md outline-none transition-[width,height] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
          'data-dragging:size-7 data-focus-visible:size-7 data-focus-visible:ring-2 data-focus-visible:ring-ring',
          cls,
        ),
      )}
      {...props}
    />
  );
}

export interface ColorAreaProps extends AriaColorAreaProps {}

/** A square of two channels (saturation across, brightness up by default). The background is the color space itself, so it
    sets its own `style`; size it with `className` (`h-40 w-full`). */
export function ColorArea({ className, colorSpace = 'hsb', xChannel = 'saturation', yChannel = 'brightness', ...props }: ColorAreaProps) {
  return (
    <AriaColorArea
      data-slot="color-area"
      colorSpace={colorSpace}
      xChannel={xChannel}
      yChannel={yChannel}
      className={composeRenderProps(className, (cls) => cn('size-48 shrink-0 rounded-panel data-disabled:opacity-50', cls))}
      {...props}
    >
      <ColorThumb />
    </AriaColorArea>
  );
}

export interface ColorSliderProps extends AriaColorSliderProps {
  /** Text above the track, naming the channel. Without it, pass `aria-label`. */
  label?: ReactNode;
  /** Show the channel's value opposite the label. */
  showValue?: boolean;
}

/** One channel as a gradient track (`channel="hue"`, `"alpha"`, `"saturation"` …; `colorSpace` picks the model). The alpha
    track sits on a checkerboard. */
export function ColorSlider({ className, label, showValue, ...props }: ColorSliderProps) {
  const alpha = props.channel === 'alpha';
  return (
    <AriaColorSlider
      data-slot="color-slider"
      className={composeRenderProps(className, (cls) => cn('group flex w-full flex-col gap-1.5 data-disabled:opacity-50', cls))}
      {...props}
    >
      {label || showValue ? (
        <div className="flex items-center justify-between text-footnote">
          {label ? <Label variant="field">{label}</Label> : <span />}
          {showValue ? <SliderOutput className="px-1 text-foreground/70 tabular-nums" /> : null}
        </div>
      ) : null}
      <SliderTrack
        className="h-6 w-full rounded-full"
        // RAC's default style is the channel's gradient; the alpha channel's goes over a checkerboard.
        style={({ defaultStyle }) => (alpha
          ? { ...defaultStyle, background: `${defaultStyle.background}, repeating-conic-gradient(var(--secondary-strong) 0% 25%, var(--background) 0% 50%) 50% / 12px 12px` }
          : defaultStyle)}
      >
        <ColorThumb className="top-1/2" />
      </SliderTrack>
    </AriaColorSlider>
  );
}

export interface ColorSwatchPickerProps extends AriaColorSwatchPickerProps {}

/** A row of preset colors; one at a time is selected. Fill it with ColorSwatchPickerItems. */
export function ColorSwatchPicker({ className, ...props }: ColorSwatchPickerProps) {
  return (
    <AriaColorSwatchPicker
      data-slot="color-swatch-picker"
      className={composeRenderProps(className, (cls) => cn('flex flex-wrap gap-2', cls))}
      {...props}
    />
  );
}

export interface ColorSwatchPickerItemProps extends Omit<AriaColorSwatchPickerItemProps, 'children'> {}

export function ColorSwatchPickerItem({ className, ...props }: ColorSwatchPickerItemProps) {
  return (
    <AriaColorSwatchPickerItem
      data-slot="color-swatch-picker-item"
      className={composeRenderProps(className, (cls) =>
        cn(
          'size-7 cursor-pointer rounded-full outline-none transition-transform duration-spring-snappy ease-spring-snappy data-hovered:scale-110 motion-reduce:transition-none',
          'data-selected:ring-2 data-selected:ring-ring data-selected:ring-offset-2 data-selected:ring-offset-popover data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-focus-visible:ring-offset-popover',
          cls,
        ),
      )}
      {...props}
    >
      <ColorSwatch className="size-full" />
    </AriaColorSwatchPickerItem>
  );
}

export interface ColorPickerTriggerProps extends Omit<ButtonProps, 'variant' | 'size' | 'children'> {
  size?: 'sm' | 'default' | 'lg';
  /** Show the hex value beside the swatch. Default: true. */
  showValue?: boolean;
}

const triggerSize = { sm: 'h-8 rounded-lg text-subhead', default: 'h-11 rounded-ctl text-body', lg: 'h-[50px] rounded-xl text-body' } as const;

/** A filled button showing the current color (and its hex, with the opacity when it is below 1); press it to open the ColorPickerContent beside it. */
export function ColorPickerTrigger({ className, size = 'default', showValue = true, ...props }: ColorPickerTriggerProps) {
  const state = useContext(ColorPickerStateContext);
  return (
    <Button
      data-slot="color-picker-trigger"
      variant="secondary"
      className={composeRenderProps(className, (cls) =>
        cn('w-full justify-start bg-input px-3 font-normal text-foreground data-hovered:bg-secondary aria-expanded:ring-[1.5px] aria-expanded:ring-primary aria-expanded:ring-inset', triggerSize[size], cls),
      )}
      {...props}
    >
      <ColorSwatch />
      {showValue && state?.color ? <span className="tabular-nums">{state.color.toString(state.color.getChannelValue('alpha') < 1 ? 'hexa' : 'hex')}</span> : null}
    </Button>
  );
}

export interface ColorPickerContentProps extends Omit<PopoverProps, 'children'> {
  /** Preset colors shown as a row of swatches under the sliders. */
  swatches?: readonly string[];
  /** Add an opacity slider. Default: false. */
  alpha?: boolean;
  /** Replace the default area, hue slider, hex field and swatches. */
  children?: ReactNode;
}

/** The popover: a ColorArea, a hue slider, an optional opacity slider, a hex field and optional swatches. */
export function ColorPickerContent({ swatches, alpha, children, className, placement = 'bottom start', ...props }: ColorPickerContentProps) {
  return (
    <Popover data-slot="color-picker-content" placement={placement} className={composeRenderProps(className, (cls) => cn('w-64 min-w-0', cls))} {...props}>
      <AriaDialog aria-label="Color picker" className="flex flex-col gap-3 p-3 outline-none">
        {children ?? (
          <>
            <ColorArea className="h-40 w-full" />
            <ColorSlider colorSpace="hsb" channel="hue" aria-label="Hue" />
            {alpha ? <ColorSlider channel="alpha" aria-label="Opacity" /> : null}
            <ColorField aria-label="Hex color">
              <ColorFieldGroup size="sm">
                <ColorFieldSwatch className="size-5" />
                <ColorFieldInput />
              </ColorFieldGroup>
            </ColorField>
            {swatches?.length ? (
              <ColorSwatchPicker aria-label="Preset colors">
                {swatches.map((c) => <ColorSwatchPickerItem key={c} color={c} />)}
              </ColorSwatchPicker>
            ) : null}
          </>
        )}
      </AriaDialog>
    </Popover>
  );
}
