import { Input as AriaInput, type InputProps as AriaInputProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ Input — iOS filled text field on react-aria's Input ══
   Inside a <TextField> it picks up the label, description and validation wiring automatically. */
export const inputVariants = cva(
  [
    'box-border w-full min-w-0 rounded-[10px] border-0 bg-input px-3 [font-family:inherit] text-foreground outline-none',
    'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground',
    'data-focused:bg-transparent data-focused:shadow-[inset_0_0_0_1.5px_var(--primary)]',
    'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50',
    selectableText,
  ],
  {
    variants: {
      size: {
        sm: 'h-8 text-[15px]',
        default: 'h-11 text-[17px]',
        lg: 'h-[50px] rounded-xl text-[17px]',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export interface InputProps extends Omit<AriaInputProps, 'size'>, VariantProps<typeof inputVariants> {}

export function Input({ className, size, ...props }: InputProps) {
  return (
    <AriaInput
      data-slot="input"
      className={composeRenderProps(className, (cls) => cn(inputVariants({ size }), cls))}
      {...props}
    />
  );
}
