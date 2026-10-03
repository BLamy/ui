'use client';
import { useContext, type ComponentProps } from 'react';
import {
  ColorField as AriaColorField, type ColorFieldProps as AriaColorFieldProps,
  ColorFieldStateContext,
  ColorSwatch as AriaColorSwatch, type ColorSwatchProps as AriaColorSwatchProps,
  Group,
  Input as AriaInput, type InputProps as AriaInputProps,
  composeRenderProps,
  parseColor,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ ColorField / ColorSwatch — react-aria's ColorField: a text field that reads a color ("#RRGGBB", with or
   without the hash; or one channel of it, with `channel` / `colorSpace`) and commits it when the field loses focus, ↑/↓ nudging
   the value. ColorSwatch paints a color over a checkerboard so transparency shows.
   <ColorField defaultValue="hsl(262, 83%, 66%)">
     <Label variant="field">Accent</Label>
     <ColorFieldGroup><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
     <FieldError />
   </ColorField> ══ */

export interface ColorFieldProps extends AriaColorFieldProps {}

export function ColorField({ className, ...props }: ColorFieldProps) {
  return (
    <AriaColorField
      data-slot="color-field"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

export const colorFieldGroupVariants = cva(
  [
    'box-border flex w-full min-w-0 items-center gap-2 bg-input px-3 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
    'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset',
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

export interface ColorFieldGroupProps extends ComponentProps<typeof Group>, VariantProps<typeof colorFieldGroupVariants> {}

/** The filled field around a swatch and the input. Without a swatch, a plain `Input` from the library does the same job. */
export function ColorFieldGroup({ className, size, ...props }: ColorFieldGroupProps) {
  return (
    <Group
      data-slot="color-field-group"
      className={composeRenderProps(className, (cls) => cn(colorFieldGroupVariants({ size }), cls))}
      {...props}
    />
  );
}

/** The text box inside a ColorFieldGroup: no fill or outline of its own. */
export function ColorFieldInput({ className, ...props }: AriaInputProps) {
  return (
    <AriaInput
      data-slot="color-field-input"
      className={composeRenderProps(className, (cls) =>
        cn('h-full min-w-0 flex-1 border-0 bg-transparent p-0 [font-family:inherit] [font-size:inherit] text-foreground outline-none placeholder:text-tertiary-foreground', selectableText, cls),
      )}
      {...props}
    />
  );
}

const CLEAR = parseColor('hsla(0, 0%, 0%, 0)');

export interface ColorSwatchProps extends AriaColorSwatchProps {}

/** A color chip. Give it a `color`, or place it where a color is in context (a ColorPicker, ColorFieldSwatch …). */
export function ColorSwatch({ className, ...props }: ColorSwatchProps) {
  return (
    <AriaColorSwatch
      data-slot="color-swatch"
      className={composeRenderProps(className, (cls) => cn('size-6 shrink-0 rounded-full shadow-hairline', cls))}
      {...props}
    />
  );
}

/** A swatch of what the surrounding ColorField currently holds (clear while the field is empty or unparsable). */
export function ColorFieldSwatch({ className, ...props }: Omit<ColorSwatchProps, 'color'>) {
  const state = useContext(ColorFieldStateContext);
  return <ColorSwatch data-slot="color-field-swatch" className={className} color={state?.colorValue ?? CLEAR} {...props} />;
}
