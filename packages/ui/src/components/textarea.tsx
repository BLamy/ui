import { TextArea as AriaTextArea, type TextAreaProps as AriaTextAreaProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '../lib/primitives';
import { cn } from '../lib/utils';

/* ══ Textarea — multi-line sibling of Input on react-aria's TextArea ══ */
export const textareaVariants = cva(
  [
    'box-border block w-full min-w-0 resize-none rounded-[10px] border-0 bg-input px-3 py-2.5 [font-family:inherit] text-[17px] leading-[22px] text-foreground outline-none',
    'transition-[box-shadow,background-color] duration-200 ease-ios placeholder:text-bl-label3',
    'data-focused:bg-transparent data-focused:shadow-[inset_0_0_0_1.5px_var(--bl-tint)]',
    'data-invalid:shadow-[inset_0_0_0_1.5px_var(--bl-red)] data-disabled:cursor-not-allowed data-disabled:opacity-50',
    selectableText,
  ],
  {
    variants: {
      size: {
        default: 'min-h-24',
        sm: 'min-h-16 text-[15px] leading-[20px]',
        lg: 'min-h-36',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export interface TextareaProps extends AriaTextAreaProps, VariantProps<typeof textareaVariants> {}

export function Textarea({ className, size, ...props }: TextareaProps) {
  return (
    <AriaTextArea
      data-slot="textarea"
      className={composeRenderProps(className, (cls) => cn(textareaVariants({ size }), cls))}
      {...props}
    />
  );
}
