'use client';
import { Separator as AriaSeparator, type SeparatorProps as AriaSeparatorProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ══ Separator — hairline rule on react-aria's Separator ══ */
export const separatorVariants = cva('m-0 shrink-0 border-0 bg-border', {
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'w-px self-stretch',
    },
    /** `inset` indents a horizontal rule like an iOS list separator. */
    inset: { true: '', false: '' },
  },
  compoundVariants: [{ orientation: 'horizontal', inset: true, className: 'ml-4 w-[calc(100%-16px)]' }],
  defaultVariants: { orientation: 'horizontal', inset: false },
});

export interface SeparatorProps extends Omit<AriaSeparatorProps, 'orientation'>, VariantProps<typeof separatorVariants> {}

export function Separator({ className, orientation = 'horizontal', inset, ...props }: SeparatorProps) {
  return (
    <AriaSeparator
      data-slot="separator"
      orientation={orientation ?? 'horizontal'}
      className={cn(separatorVariants({ orientation, inset }), className)}
      {...props}
    />
  );
}
