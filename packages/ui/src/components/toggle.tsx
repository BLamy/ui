import { ToggleButton, type ToggleButtonProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ Toggle — two-state button on react-aria's ToggleButton. On = tinted, like an iOS toolbar toggle. ══ */
export const toggleVariants = cva(
  [
    'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap text-foreground outline-none',
    'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy data-pressed:not-aria-expanded:scale-[.96] motion-reduce:transition-none [&_svg]:shrink-0',
    'data-hovered:bg-accent data-pressed:bg-secondary-strong',
    'data-selected:bg-primary/15 data-selected:text-primary data-selected:data-pressed:bg-primary/25',
    'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        /** Filled resting state, for toggles standing alone on a card. */
        filled: 'bg-secondary',
        outline: 'bg-transparent shadow-[inset_0_0_0_1px_var(--border)] data-selected:shadow-[inset_0_0_0_1px_transparent]',
      },
      size: {
        sm: 'h-8 min-w-8 rounded-lg px-2 text-[13px]',
        default: 'h-9 min-w-9 rounded-[10px] px-2.5 text-[15px]',
        lg: 'h-11 min-w-11 rounded-xl px-3.5 text-[17px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ToggleProps extends ToggleButtonProps, VariantProps<typeof toggleVariants> {}

export function Toggle({ className, variant, size, onChange, ...props }: ToggleProps) {
  return (
    <ToggleButton
      data-slot="toggle"
      onChange={(v) => { Haptics.selection(); onChange?.(v); }}
      className={composeRenderProps(className, (cls) => cn(toggleVariants({ variant, size }), cls))}
      {...props}
    />
  );
}
