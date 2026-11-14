'use client';
import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { formatColor, type Color } from '@ui-sdk/core/color';
import {
  ColorPicker as SdkColorPicker,
  ColorPickerArea as SdkColorPickerArea,
  ColorPickerAreaCanvas as SdkColorPickerAreaCanvas,
  ColorPickerAreaThumb as SdkColorPickerAreaThumb,
  ColorPickerEyeDropper as SdkColorPickerEyeDropper,
  ColorPickerSlider as SdkColorPickerSlider,
  ColorPickerSliderThumb as SdkColorPickerSliderThumb,
  ColorPickerSwatches as SdkColorPickerSwatches,
  ColorPickerSwatchItem as SdkColorPickerSwatchItem,
  type ColorPickerSliderState,
  type ColorPickerState,
} from '@ui-sdk/react/color-picker';
import { renderElement } from '@ui-sdk/react/primitive';
import { buttonVariants } from '@/components/ui/button';
import { ColorFieldGroup, ColorFieldInput, ColorFieldSwatch } from '@/components/ui/color-field';
import { Label } from '@/components/ui/label';
import { PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { cx } from '@/lib/utils';

/* ══ ColorPicker — UI SDK's ColorPicker, drawn as iOS ══
   ColorPicker is a group that holds the color, a CSS color string (`value` / `defaultValue` /
   `onValueChange(value, details)` on every step of a drag, `onValueCommit` once it ends; `details.color` is the
   same color as data for `@ui-sdk/core/color`). `space` picks the channels the parts edit ("hsv" by default, "hsl",
   "srgb", "oklch") and `format` how the value is written (hex by default). Every part inside edits that color:
   a ColorPickerArea (two channels at once), ColorPickerSliders (one channel), ColorPickerSwatches (presets), the
   ColorFieldGroup / ColorFieldInput text field, a ColorPickerEyeDropper, and the ColorFieldSwatch that shows it.
   Thumbs take arrows, Shift+arrows, Page Up/Down and Home/End. In a popover:
   <ColorPicker defaultValue="hsl(262 83% 66%)">
     <Popover>
       <ColorPickerTrigger />
       <ColorPickerContent swatches={['hsl(4 100% 61%)', 'hsl(135 70% 50%)']} />
     </Popover>
   </ColorPicker> ══ */

/* The picker's state for the kit's parts that are not UI SDK parts of it (the trigger's value). */
const ColorPickerStateContext = createContext<ColorPickerState | null>(null);

/* What names the picker (its Field's label, or its own `aria-label` / `aria-labelledby`), so the trigger and the
   popover carry the field's name rather than the color's. */
interface ColorPickerName {
  labelledBy?: string;
  label?: string;
}
const ColorPickerNameContext = createContext<ColorPickerName>({});

export type ColorPickerProps = ComponentProps<typeof SdkColorPicker>;

export function ColorPicker({ children, ref, ...props }: ColorPickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const [labelledBy, setLabelledBy] = useState<string>();
  // The group's `aria-labelledby` is written by UI SDK (from the Field's label), so read it from the element.
  useLayoutEffect(() => {
    const next = root.current?.getAttribute('aria-labelledby') ?? undefined;
    if (next !== labelledBy) setLabelledBy(next);
  });
  return (
    <ColorPickerNameContext.Provider value={{ labelledBy, label: props['aria-label'] }}>
      <SdkColorPicker
        ref={(el: HTMLDivElement | null) => {
          root.current = el;
          if (typeof ref === 'function') return ref(el);
          if (ref) ref.current = el;
        }}
        {...props}
      >
        {(state) => (
          <ColorPickerStateContext.Provider value={state}>
            {typeof children === 'function' ? children(state) : children}
          </ColorPickerStateContext.Provider>
        )}
      </SdkColorPicker>
    </ColorPickerNameContext.Provider>
  );
}

export { createColorPickerController, type ColorPickerController } from '@ui-sdk/react/color-picker';

/* A thumb is centered on its point and filled with the color it sits on. It grows while its track is held and
   under keyboard focus. */
const thumb = [
  'box-border size-6 -translate-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-md outline-none forced-color-adjust-none transition-[width,height] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none rtl:translate-x-1/2',
  'group-active/track:size-7 focus-visible:size-7 focus-visible:ring-2 focus-visible:ring-ring',
];

type StyleProp<State> = CSSProperties | ((state: State) => CSSProperties | undefined) | undefined;

/** A thumb's `style`: the color under it as `--color-picker-color` (opaque, unless the thumb edits the opacity),
    then the caller's. The picker's own variable does not reach a thumb in a popover, which renders elsewhere. */
function thumbStyle<State extends { color: Color }>(style: StyleProp<State>, translucent?: (state: State) => boolean) {
  return (state: State) =>
    ({
      '--color-picker-color': formatColor(translucent?.(state) ? state.color : { ...state.color, alpha: 1 }),
      ...(typeof style === 'function' ? style(state) : style),
    }) as CSSProperties;
}

/** A surface for two channels: `x` across and `y` up (saturation and brightness by default). It draws itself where
    gradients can; for other channels (OKLCH, red by green …) put a ColorPickerAreaCanvas before the thumb. Size it
    with `className` (`h-40 w-full`). */
export function ColorPickerArea({ className, children, ...props }: ComponentProps<typeof SdkColorPickerArea>) {
  return (
    <SdkColorPickerArea
      className={cx('group/track size-48 shrink-0 rounded-panel bg-(image:--color-area-background) forced-color-adjust-none data-disabled:opacity-50', className)}
      {...props}
    >
      {children ?? <ColorPickerAreaThumb />}
    </SdkColorPickerArea>
  );
}

/** The area's handle: a slider screen readers hear as both channels. */
export function ColorPickerAreaThumb({ className, style, ...props }: ComponentProps<typeof SdkColorPickerAreaThumb>) {
  return <SdkColorPickerAreaThumb className={cx(thumb, className)} style={thumbStyle(style)} {...props} />;
}

/** Paints the area pixel by pixel, for channels no gradient draws. Colors outside the gamut stay clear. */
export function ColorPickerAreaCanvas({ className, ...props }: ComponentProps<typeof SdkColorPickerAreaCanvas>) {
  return <SdkColorPickerAreaCanvas className={cx('rounded-[inherit]', className)} {...props} />;
}

/* The track is the channel's gradient; the alpha channel's goes over a checkerboard. */
const track = [
  'group/track h-6 w-full rounded-full bg-(image:--color-slider-background) forced-color-adjust-none data-[orientation=vertical]:h-48 data-[orientation=vertical]:w-6',
  'data-[channel=alpha]:[background:var(--color-slider-background),repeating-conic-gradient(var(--secondary-strong)_0%_25%,var(--background)_0%_50%)_50%/12px_12px]',
];

/** A channel's value as people read it: degrees for a hue, a percentage, or the bare number. */
function channelText({ channel, channelValue, space }: ColorPickerSliderState) {
  const unit = channel === 'hue' ? '°' : channel === 'red' || channel === 'green' || channel === 'blue' || channel === 'chroma' ? '' : '%';
  const digits = channel === 'chroma' ? 3 : space === 'oklch' && channel === 'lightness' ? 1 : 0;
  return `${Number(channelValue.toFixed(digits))}${unit}`;
}

export type ColorPickerSliderProps = ComponentProps<typeof SdkColorPickerSlider> & {
  /** Text above the track, which names the thumb. Without it the thumb is named after its channel ("Hue"). */
  label?: ReactNode;
  /** Show the channel's value opposite the label. */
  showValue?: boolean;
};

/** One `channel` as a gradient track ("hue", "alpha", "saturation" …, from the picker's `space`), with its thumb.
    `className` goes to the track. */
export function ColorPickerSlider({ className, label, showValue, children, id, render, ...props }: ColorPickerSliderProps) {
  const ownId = useId();
  const trackId = id ?? ownId;
  const labelId = `${trackId}-label`;
  const thumbs = children ?? <ColorPickerSliderThumb aria-labelledby={label ? labelId : undefined} />;
  if (!label && !showValue) {
    return (
      <SdkColorPickerSlider id={id} className={cx([track, 'data-disabled:opacity-50'], className)} render={render} {...props}>
        {thumbs}
      </SdkColorPickerSlider>
    );
  }
  return (
    <SdkColorPickerSlider
      id={trackId}
      className={cx(track, className)}
      // The caption sits outside the track, which is the surface a press lands on.
      render={(trackProps, state) => (
        <div className="flex w-full flex-col gap-1.5 has-data-disabled:opacity-50">
          <div className="flex items-center justify-between text-footnote">
            {label ? <Label variant="field" id={labelId} htmlFor={trackId}>{label}</Label> : <span />}
            {showValue ? <output aria-live="off" className="px-1 text-foreground/70 tabular-nums">{channelText(state)}</output> : null}
          </div>
          {renderElement('div', trackProps, render, state)}
        </div>
      )}
      {...props}
    >
      {thumbs}
    </SdkColorPickerSlider>
  );
}

/** A slider's handle. */
export function ColorPickerSliderThumb({ className, style, ...props }: ComponentProps<typeof SdkColorPickerSliderThumb>) {
  return (
    <SdkColorPickerSliderThumb
      className={cx(
        [thumb, 'data-[orientation=horizontal]:top-1/2 data-[orientation=vertical]:start-1/2 data-[orientation=vertical]:translate-y-1/2'],
        className,
      )}
      style={thumbStyle(style, (state) => state.channel === 'alpha')}
      {...props}
    />
  );
}

/** A row of preset colors: a listbox with one tab stop, arrows moving between the presets. Name it with
    `aria-label`, and fill it with ColorPickerSwatchItems. */
export function ColorPickerSwatches({ className, ...props }: ComponentProps<typeof SdkColorPickerSwatches>) {
  return <SdkColorPickerSwatches className={cx('flex flex-wrap gap-2', className)} {...props} />;
}

/** A preset: `value` is any CSS color. It is selected while the picker's color looks the same. */
export function ColorPickerSwatchItem({ className, ...props }: ComponentProps<typeof SdkColorPickerSwatchItem>) {
  return (
    <SdkColorPickerSwatchItem
      className={cx(
        [
          'box-border size-7 cursor-pointer appearance-none rounded-full border-0 bg-(--color-picker-color) p-0 shadow-hairline outline-none forced-color-adjust-none transition-transform duration-spring-snappy ease-spring-snappy hover:not-data-disabled:scale-110 motion-reduce:transition-none data-disabled:cursor-default',
          'data-selected:ring-2 data-selected:ring-ring data-selected:ring-offset-2 data-selected:ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover',
        ],
        className,
      )}
      {...props}
    />
  );
}

/** A button that picks a color from anywhere on the screen. It is hidden where the browser has no EyeDropper. */
export function ColorPickerEyeDropper({ className, children, ...props }: ComponentProps<typeof SdkColorPickerEyeDropper>) {
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  return (
    <SdkColorPickerEyeDropper
      aria-label={named ? undefined : 'Pick a color from the screen'}
      className={cx([buttonVariants({ variant: 'quiet', size: 'icon-sm' }), 'shrink-0 data-unsupported:hidden'], className)}
      {...props}
    >
      {children ?? <Icon name="drop" size={18} />}
    </SdkColorPickerEyeDropper>
  );
}

export type ColorPickerTriggerProps = Omit<ComponentProps<typeof PopoverTrigger>, 'children'> & {
  size?: 'sm' | 'default' | 'lg';
  /** Show the hex value beside the swatch. Default: true. */
  showValue?: boolean;
};

const triggerSize = { sm: 'h-8 rounded-lg text-subhead', default: 'h-11 rounded-ctl text-body', lg: 'h-[50px] rounded-xl text-body' } as const;

/** The Popover's trigger as a filled button showing the picker's color and its hex (eight digits once the opacity
    is below 1). */
export function ColorPickerTrigger({ className, size = 'default', showValue = true, ...props }: ColorPickerTriggerProps) {
  const state = useContext(ColorPickerStateContext);
  const name = useContext(ColorPickerNameContext);
  const valueId = useId();
  const hex = state ? formatColor(state.color, 'hex') : '';
  // Named by the field, then the color it shows ("Accent, " and the hex).
  const named = name.labelledBy ? { 'aria-labelledby': `${name.labelledBy} ${valueId}` }
    : name.label ? { 'aria-label': `${name.label}, ${hex}` } : {};
  return (
    <PopoverTrigger
      {...named}
      className={cx(
        [buttonVariants({ variant: 'secondary' }), 'w-full justify-start bg-input px-3 font-normal text-foreground hover:bg-secondary aria-expanded:ring-[1.5px] aria-expanded:ring-primary aria-expanded:ring-inset', triggerSize[size]],
        className,
      )}
      {...props}
    >
      <span id={valueId} className="contents">
        <ColorFieldSwatch />
        {showValue && state ? <span className="tabular-nums">{hex}</span> : null}
      </span>
    </PopoverTrigger>
  );
}

export type ColorPickerContentProps = Omit<ComponentProps<typeof PopoverContent>, 'children'> & {
  /** Preset colors shown as a row of swatches under the field. */
  swatches?: readonly string[];
  /** Add an opacity slider. Default: false. */
  alpha?: boolean;
  /** Replace the default area, hue slider, color field and swatches. */
  children?: ReactNode;
};

/** The popover: a ColorPickerArea, a hue slider, an optional opacity slider, a color field and optional swatches.
    The dialog takes the picker's name (its Field's label or `aria-label`), else "Color picker"; `aria-label` here
    renames it. */
export function ColorPickerContent({
  swatches, alpha, children, className, side = 'bottom', align = 'start', 'aria-label': ariaLabel, ...props
}: ColorPickerContentProps) {
  const picker = useContext(ColorPickerNameContext);
  const byField = ariaLabel === undefined && !picker.label && picker.labelledBy;
  return (
    <PopoverContent side={side} align={align} aria-labelledby={byField || undefined} className={cx('flex w-64 min-w-0 flex-col gap-3 p-3', className)} {...props}>
      {byField ? null : <PopoverTitle className="sr-only">{ariaLabel ?? picker.label ?? 'Color picker'}</PopoverTitle>}
      {children ?? (
        <>
          <ColorPickerArea className="h-40 w-full" />
          <ColorPickerSlider channel="hue" />
          {alpha ? (
            <ColorPickerSlider channel="alpha">
              <ColorPickerSliderThumb aria-label="Opacity" />
            </ColorPickerSlider>
          ) : null}
          <ColorFieldGroup size="sm">
            <ColorFieldSwatch className="size-5" />
            <ColorFieldInput />
          </ColorFieldGroup>
          {swatches?.length ? (
            <ColorPickerSwatches aria-label="Preset colors">
              {swatches.map((color) => <ColorPickerSwatchItem key={color} value={color} />)}
            </ColorPickerSwatches>
          ) : null}
        </>
      )}
    </PopoverContent>
  );
}
