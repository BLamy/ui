'use client';
import type { ComponentProps } from 'react';
import { Separator as SdkSeparator } from '@ui-sdk/react/separator';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';

/* ══ Separator — hairline rule on UI SDK's Separator ══
   Announced as a separator (with its orientation) unless it is `decorative`, for a line that is only visual. */
export const separatorVariants = cva('m-0 shrink-0 border-0 bg-border', {
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'w-px self-stretch',
    },
    /** `inset` indents a horizontal rule by 16px on its leading (start) side, like an iOS list separator; a vertical rule ignores it. */
    inset: {
      true: 'ms-4 w-[calc(100%-16px)] data-[orientation=vertical]:ms-0 data-[orientation=vertical]:w-px',
      false: '',
    },
  },
  defaultVariants: { orientation: 'horizontal', inset: false },
});

export type SeparatorProps = Omit<ComponentProps<typeof SdkSeparator>, 'orientation'> & VariantProps<typeof separatorVariants>;

export function Separator({ className, orientation, inset, ...props }: SeparatorProps) {
  return (
    <SdkSeparator
      orientation={orientation ?? 'horizontal'}
      className={cx(separatorVariants({ orientation, inset }), className)}
      {...props}
    />
  );
}
