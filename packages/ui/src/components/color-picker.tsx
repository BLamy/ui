'use client';
import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { formatColor, parseColor, type Color } from '@ui-sdk/core/color';
import {
  ColorPicker as SdkColorPicker,
  ColorPickerArea as SdkColorPickerArea,
  ColorPickerAreaCanvas as SdkColorPickerAreaCanvas,
  ColorPickerAreaThumb as SdkColorPickerAreaThumb,
  ColorPickerChannelInput as SdkColorPickerChannelInput,
  ColorPickerEyeDropper as SdkColorPickerEyeDropper,
  ColorPickerInput as SdkColorPickerInput,
  ColorPickerSlider as SdkColorPickerSlider,
  ColorPickerSliderThumb as SdkColorPickerSliderThumb,
  ColorPickerSwatch as SdkColorPickerSwatch,
  ColorPickerSwatches as SdkColorPickerSwatches,
  ColorPickerSwatchItem as SdkColorPickerSwatchItem,
  type ColorPickerSliderState,
  type ColorPickerState,
} from '@ui-sdk/react/color-picker';
import { renderElement } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { fieldSurfaceVariants } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger, type PopoverProps } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';

/* ══ ColorPicker / ColorInput — UI SDK's ColorPicker, drawn as iOS ══
   ColorPicker is a group that holds the color, a CSS color string (`value` / `defaultValue` /
   `onValueChange(value, details)` on every step of a drag, `onValueCommit` once it ends; `details.color` is the
   same color as data for `@ui-sdk/core/color`). `space` picks the channels the parts edit ("hsv" by default, "hsl",
   "srgb", "oklch") and `format` how the value is written (hex by default). Every part inside edits that color:
   a ColorPickerArea (two channels at once), ColorPickerSliders (one channel), ColorPickerSwatches (presets), a
   ColorPickerInputGroup holding a ColorPickerInput (any CSS color, typed) or ColorPickerChannelInputs (one channel as a
   number), a ColorPickerEyeDropper, and the ColorPickerSwatch that shows it. Thumbs take arrows, Shift+arrows,
   Page Up/Down and Home/End. The root also holds a popover's open state, so a trigger and a popup go straight in:
   <ColorPicker defaultValue="hsl(262 83% 66%)">
     <ColorPickerTrigger />
     <ColorPickerContent swatches={['hsl(4 100% 61%)', 'hsl(135 70% 50%)']} />
   </ColorPicker>
   ColorInput is the one-line typed field: the picker's root drawn as the kit's filled field, with a swatch and a
   text box. Put it in a Field for its label, description and error:
   <Field>
     <FieldLabel>Accent</FieldLabel>
     <ColorInput defaultValue="hsl(262 83% 66%)" />
   </Field>
   ColorSwatch is a color chip on its own. ══ */

/* The picker's state for the kit's parts that are not UI SDK parts of it (the trigger's value). */
const ColorPickerStateContext = createContext<ColorPickerState | null>(null);

/* What names the picker (its Field's label, or its own `aria-label` / `aria-labelledby`), so the trigger and the
   popover carry the field's name rather than the color's. */
interface ColorPickerName {
  labelledBy?: string;
  label?: string;
}
const ColorPickerNameContext = createContext<ColorPickerName>({});

export type ColorPickerProps = ComponentProps<typeof SdkColorPicker> &
  Pick<PopoverProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'presentation'>;

/** The root: it holds the color, and the open state of a ColorPickerTrigger's popup (`open` / `defaultOpen` /
    `onOpenChange`, and `presentation`, `"auto"` for a sheet in a compact container), so the trigger and the
    ColorPickerContent can be its direct children. */
export function ColorPicker({ children, ref, open, defaultOpen, onOpenChange, presentation, ...props }: ColorPickerProps) {
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
            <Popover open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} presentation={presentation}>
              {typeof children === 'function' ? children(state) : children}
            </Popover>
          </ColorPickerStateContext.Provider>
        )}
      </SdkColorPicker>
    </ColorPickerNameContext.Provider>
  );
}

export { createColorPickerController, type ColorPickerController } from '@ui-sdk/react/color-picker';

/* A thumb is centered on its point and filled with the color it sits on. It grows while its track is held and
   under keyboard focus. Its ring is white in both appearances, as iOS draws it: it sits on any color, and white
   reads on every hue (a background-colored ring would vanish on black in dark mode). */
const thumb = [
  'box-border size-6 -translate-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-raised outline-none forced-color-adjust-none transition-[width,height] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none rtl:translate-x-1/2',
  'group-active/track:size-7 focus-visible:size-7 focus-visible:ring-2 focus-visible:ring-ring',
];

/* UI SDK places a thumb at its value's percent of the track. Inside this layer, half a thumb in from every edge, the
   thumb stays on the area and the track at both ends rather than hanging half past them. */
const thumbTravel = 'pointer-events-none absolute inset-3 [&>*]:pointer-events-auto';

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
  return (
    <span className={thumbTravel}>
      <SdkColorPickerAreaThumb className={cx(thumb, className)} style={thumbStyle(style)} {...props} />
    </span>
  );
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

/** The unit a channel is read in: degrees for a hue, none for red, green, blue and chroma, else a percentage. */
const channelUnit = (channel: string) =>
  channel === 'hue' ? '°' : channel === 'red' || channel === 'green' || channel === 'blue' || channel === 'chroma' ? '' : '%';

/** A channel's value as people read it: degrees for a hue, a percentage, or the bare number. */
function channelText({ channel, channelValue, space }: ColorPickerSliderState) {
  const unit = channelUnit(channel);
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
    <span className={cn(thumbTravel, 'inset-y-0 in-data-[orientation=vertical]:inset-x-0 in-data-[orientation=vertical]:inset-y-3')}>
      <SdkColorPickerSliderThumb
        className={cx(
          [thumb, 'data-[orientation=horizontal]:top-1/2 data-[orientation=vertical]:start-1/2 data-[orientation=vertical]:translate-y-1/2'],
          className,
        )}
        style={thumbStyle(style, (state) => state.channel === 'alpha')}
        {...props}
      />
    </span>
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

/* ── The field ── */

/** The text boxes have no fill or outline of their own: the field around them draws both. */
const fieldInput = cn(
  'h-full min-w-0 flex-1 border-0 bg-transparent p-0 [font-family:inherit] [font-size:inherit] text-foreground outline-none placeholder:text-tertiary-foreground',
  selectableText,
);

/** The color's text box, inside a ColorPickerInputGroup: any CSS color, read on Enter or when it loses focus (text that is
    not a color goes back to the value, and Escape puts it back at once). It is named "Color" unless you name it, with
    `aria-label`, `aria-labelledby`, or a label pointed at its `id`. */
export function ColorPickerInput({ className, ...props }: ComponentProps<typeof SdkColorPickerInput>) {
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined || props.id !== undefined;
  return <SdkColorPickerInput aria-label={named ? undefined : 'Color'} className={cx(fieldInput, className)} {...props} />;
}

/** A number box for one `channel` of the picker's `space` ("hue", "alpha", "red" …), in the units people read it in,
    with the unit after it (° for a hue, % for saturation, lightness and opacity). Enter, leaving it or its arrow
    keys set the channel. It is named after the channel. */
export function ColorPickerChannelInput({ className, ...props }: ComponentProps<typeof SdkColorPickerChannelInput>) {
  const unit = channelUnit(String(props.channel));
  return (
    <>
      <SdkColorPickerChannelInput
        className={cx(
          [
            fieldInput,
            'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            // As wide as its digits, so the unit follows the number rather than the field's far end.
            unit && 'w-[3.5ch] flex-none field-sizing-content min-w-[2ch] supports-[field-sizing:content]:w-auto',
          ],
          className,
        )}
        {...props}
      />
      {unit ? <span aria-hidden="true" className="shrink-0 ps-0.5 text-muted-foreground">{unit}</span> : null}
    </>
  );
}

/* A chip is filled with `--color-picker-color`, which UI SDK's swatch part writes and ColorSwatch sets itself. It is
   24px, and 20px in a small field (its `data-size`), so a 32px field keeps a margin around it. */
const swatch = 'size-6 shrink-0 rounded-full bg-(--color-picker-color) shadow-hairline forced-color-adjust-none in-data-[size=sm]:size-5';

/** A chip of the color the picker holds, named for screen readers ("vivid blue"). */
export function ColorPickerSwatch({ className, ...props }: ComponentProps<typeof SdkColorPickerSwatch>) {
  return <SdkColorPickerSwatch className={cx(swatch, className)} {...props} />;
}

export interface ColorPickerInputGroupProps extends ComponentProps<'div'>, VariantProps<typeof fieldSurfaceVariants> {}

/** The kit's filled field box around a picker's ColorPickerSwatch, ColorPickerInput or ColorPickerChannelInputs (the
    picker holds the color, so it is a plain box). It dims with the picker. */
export function ColorPickerInputGroup({ className, size, ...props }: ColorPickerInputGroupProps) {
  return (
    <div
      data-slot="color-picker-input-group"
      data-size={size ?? 'default'}
      className={cn(fieldSurfaceVariants({ size }), 'w-full in-data-disabled:cursor-not-allowed in-data-disabled:opacity-50', className)}
      {...props}
    />
  );
}

export type ColorInputProps = ComponentProps<typeof SdkColorPicker> & VariantProps<typeof fieldSurfaceVariants>;

/** The typed color field on one line: the picker's root as the kit's filled field, holding a ColorPickerSwatch and a
    ColorPickerInput (or the parts you pass). It is a group that submits the color under `name`; its Field's label
    names it, and a press on that label focuses the text box. */
export function ColorInput({ className, size, children, ...props }: ColorInputProps) {
  return (
    <SdkColorPicker data-size={size ?? 'default'} className={cx([fieldSurfaceVariants({ size }), 'w-full'], className)} {...props}>
      {children ?? (
        <>
          <ColorPickerSwatch />
          <ColorPickerInput />
        </>
      )}
    </SdkColorPicker>
  );
}

export interface ColorSwatchProps extends Omit<ComponentProps<'div'>, 'color'> {
  /** The color it shows: any CSS color. */
  color: string;
}

/** A color chip on its own: an image named by its CSS value, or by `aria-label`. Inside a picker, use
    ColorPickerSwatch, which follows the color being edited. */
export function ColorSwatch({ color, className, style, ...props }: ColorSwatchProps) {
  return (
    <div
      data-slot="color-swatch"
      role="img"
      aria-label={color}
      className={cn(swatch, className)}
      // The color is a runtime value, fed in as the variable the chip is filled with.
      style={{ '--color-picker-color': color, ...style } as CSSProperties}
      {...props}
    />
  );
}

/* ── In a popover ── */

/** The trigger: the kit's filled field box as a button, showing the picker's color and its value, with the up-down
    glyph of a pop-up button. It keeps the field's edge while its popup is open. */
export const colorPickerTriggerVariants = cva(
  'bl-btn w-full cursor-pointer justify-start text-left active:not-data-disabled:bg-secondary-strong aria-expanded:bg-transparent aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]',
  {
    variants: {
      size: {
        sm: fieldSurfaceVariants({ size: 'sm' }),
        default: fieldSurfaceVariants({ size: 'default' }),
        lg: fieldSurfaceVariants({ size: 'lg' }),
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type ColorPickerTriggerProps = Omit<ComponentProps<typeof PopoverTrigger>, 'children'> & VariantProps<typeof colorPickerTriggerVariants> & {
  /** Show the value beside the swatch, as the picker's ColorPickerInput shows it. Default: true. */
  showValue?: boolean;
};

/** The popup's trigger: the picker's color and its value, written as the picker holds it (the string its
    ColorPickerInput shows; once edited, in the picker's `format`, hex with eight digits below full opacity). */
export function ColorPickerTrigger({ className, size, showValue = true, ...props }: ColorPickerTriggerProps) {
  const state = useContext(ColorPickerStateContext);
  const name = useContext(ColorPickerNameContext);
  const valueId = useId();
  // The value as the picker holds it: the same string its ColorPickerInput shows, so one widget never shows a color in
  // two notations (an edit writes it in the picker's `format`). A value it cannot read shows the color it fell back to.
  const text = !state ? '' : parseColor(state.value) ? state.value : formatColor(state.color, 'hex');
  // Named by the field, then the color it shows ("Accent, " and the value).
  const named = name.labelledBy ? { 'aria-labelledby': `${name.labelledBy} ${valueId}` }
    : name.label ? { 'aria-label': `${name.label}, ${text}` } : {};
  return (
    <PopoverTrigger
      {...named}
      data-size={size ?? 'default'}
      className={cx(colorPickerTriggerVariants({ size }), className)}
      {...props}
    >
      <span id={valueId} className="contents">
        <ColorPickerSwatch />
        {showValue && state ? <span className="min-w-0 flex-1 truncate tabular-nums">{text}</span> : null}
      </span>
      <Icon name="chevron-up-down" size={16} sw={2.2} className="ms-auto shrink-0 text-muted-foreground" />
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
    <PopoverContent side={side} align={align} aria-labelledby={byField || undefined} className={cx('flex w-64 min-w-(--anchor-width) flex-col gap-3 p-3', className)} {...props}>
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
          <ColorPickerInputGroup size="sm">
            <ColorPickerSwatch />
            <ColorPickerInput />
          </ColorPickerInputGroup>
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
