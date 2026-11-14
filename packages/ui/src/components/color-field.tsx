'use client';
import type { ComponentProps, CSSProperties } from 'react';
import {
  ColorPicker as SdkColorPicker,
  ColorPickerChannelInput as SdkColorPickerChannelInput,
  ColorPickerInput as SdkColorPickerInput,
  ColorPickerSwatch as SdkColorPickerSwatch,
} from '@ui-sdk/react/color-picker';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';

/* ══ ColorField / ColorSwatch — a text field for a color, on UI SDK's ColorPicker ══
   ColorField is the picker's root drawn as the kit's filled field. It holds the color, a CSS color string
   (`value` / `defaultValue` / `onValueChange(value, details)`, and `onValueCommit` once an edit ends), and the parts
   inside edit it: ColorFieldInput reads any CSS color when Enter is pressed or the field loses focus (text that is
   not a color goes back to the value, and Escape puts it back at once), ColorFieldChannelInput edits one channel as
   a number, ColorFieldSwatch shows the color. With no children it renders a swatch and an input. Put it in a Field
   for its label, description and error:
   <Field>
     <FieldLabel>Accent</FieldLabel>
     <ColorField defaultValue="hsl(262 83% 66%)" />
     <FieldDescription>Any CSS color.</FieldDescription>
   </Field>
   Inside a ColorPicker, which already holds the color, ColorFieldGroup draws the same field around the parts.
   ColorSwatch is a color chip on its own. ══ */

export const colorFieldVariants = cva(
  [
    'box-border flex w-full min-w-0 items-center gap-2 bg-input px-3 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
    'focus-within:bg-transparent focus-within:ring-[1.5px] focus-within:ring-primary focus-within:ring-inset',
    'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 rounded-lg text-subhead',
        default: 'h-11 rounded-ctl text-body',
        lg: 'h-[50px] rounded-xl text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type ColorFieldProps = ComponentProps<typeof SdkColorPicker> & VariantProps<typeof colorFieldVariants>;

/** The field: a group that holds the color and submits it under `name`. Its Field's label names it, and a press on
    that label focuses the input. */
export function ColorField({ className, size, children, ...props }: ColorFieldProps) {
  return (
    <SdkColorPicker className={cx(colorFieldVariants({ size }), className)} {...props}>
      {children ?? (
        <>
          <ColorFieldSwatch />
          <ColorFieldInput />
        </>
      )}
    </SdkColorPicker>
  );
}

export type ColorFieldGroupProps = ComponentProps<'div'> & VariantProps<typeof colorFieldVariants>;

/** The filled field as a plain box, for the parts inside a ColorPicker: the picker holds the color, so there is no
    second root. It dims with the picker. */
export function ColorFieldGroup({ className, size, ...props }: ColorFieldGroupProps) {
  return (
    <div
      data-slot="color-field-group"
      className={cn(colorFieldVariants({ size }), 'in-data-disabled:cursor-not-allowed in-data-disabled:opacity-50', className)}
      {...props}
    />
  );
}

/* The text boxes have no fill or outline of their own: the field around them draws both. */
const fieldInput = cn(
  'h-full min-w-0 flex-1 border-0 bg-transparent p-0 [font-family:inherit] [font-size:inherit] text-foreground outline-none placeholder:text-tertiary-foreground',
  selectableText,
);

/** The text box: any CSS color, read on Enter or when it loses focus. It is named "Color" unless you name it, with
    `aria-label`, `aria-labelledby`, or a label pointed at its `id`. */
export function ColorFieldInput({ className, ...props }: ComponentProps<typeof SdkColorPickerInput>) {
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined || props.id !== undefined;
  return <SdkColorPickerInput aria-label={named ? undefined : 'Color'} className={cx(fieldInput, className)} {...props} />;
}

/** A number box for one `channel` of the root's `space` ("hue", "alpha", "red" …), in the units people read it in.
    Enter, leaving it or its arrow keys set the channel. It is named after the channel. */
export function ColorFieldChannelInput({ className, ...props }: ComponentProps<typeof SdkColorPickerChannelInput>) {
  return (
    <SdkColorPickerChannelInput
      className={cx(
        [fieldInput, 'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'],
        className,
      )}
      {...props}
    />
  );
}

/* A chip is filled with `--color-picker-color`, which UI SDK's swatch part writes and ColorSwatch sets itself. */
const swatch = 'size-6 shrink-0 rounded-full bg-(--color-picker-color) shadow-hairline forced-color-adjust-none';

/** A chip of the color the surrounding ColorField (or ColorPicker) holds, named for screen readers ("vivid blue"). */
export function ColorFieldSwatch({ className, ...props }: ComponentProps<typeof SdkColorPickerSwatch>) {
  return <SdkColorPickerSwatch className={cx(swatch, className)} {...props} />;
}

export interface ColorSwatchProps extends Omit<ComponentProps<'div'>, 'color'> {
  /** The color it shows: any CSS color. */
  color: string;
}

/** A color chip on its own: an image named by its CSS value, or by `aria-label`. Inside a field or a picker, use
    ColorFieldSwatch, which follows the color being edited. */
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
