import { createContext, useContext } from 'react';
import {
  ToggleButtonGroup, type ToggleButtonGroupProps, type ToggleButtonProps, composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';
import { Toggle, toggleVariants } from './toggle';

/* ══ ToggleGroup — react-aria's ToggleButtonGroup (single or multiple selection, arrow-key roving focus).
   Items inherit the group's variant and size; one selection tick per change. ══ */
export const toggleGroupVariants = cva('inline-flex w-fit items-center', {
  variants: {
    variant: {
      default: 'gap-1',
      filled: 'gap-0.5 rounded-[11px] bg-secondary p-0.5',
      /** Joined buttons sharing a hairline frame. */
      outline: 'gap-0 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--bl-sep)]',
    },
  },
  defaultVariants: { variant: 'default' },
});

type ToggleGroupStyle = VariantProps<typeof toggleVariants>;
const ToggleGroupCtx = createContext<ToggleGroupStyle>({});

export interface ToggleGroupProps extends ToggleButtonGroupProps, ToggleGroupStyle {}

export function ToggleGroup({ className, variant, size, onSelectionChange, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupCtx.Provider value={{ variant, size }}>
      <ToggleButtonGroup
        data-slot="toggle-group"
        data-variant={variant ?? 'default'}
        onSelectionChange={(keys) => { Haptics.selection(); onSelectionChange?.(keys); }}
        className={composeRenderProps(className, (cls) => cn(toggleGroupVariants({ variant }), cls))}
        {...props}
      />
    </ToggleGroupCtx.Provider>
  );
}

export interface ToggleGroupItemProps extends ToggleButtonProps, ToggleGroupStyle {}

export function ToggleGroupItem({ className, variant, size, ...props }: ToggleGroupItemProps) {
  const ctx = useContext(ToggleGroupCtx);
  const v = variant ?? ctx.variant;
  return (
    <Toggle
      data-slot="toggle-group-item"
      variant={v === 'filled' ? 'default' : v}
      size={size ?? ctx.size}
      className={composeRenderProps(className, (cls) => cn(
        v === 'filled' && 'rounded-[9px] data-selected:bg-card data-selected:text-foreground data-selected:shadow-[0_1px_4px_rgba(0,0,0,.14)] data-selected:data-pressed:bg-card',
        v === 'outline' && 'rounded-none shadow-none not-first:shadow-[inset_1px_0_0_var(--bl-sep)] data-selected:shadow-none data-selected:not-first:shadow-[inset_1px_0_0_var(--bl-sep)]',
        cls,
      ))}
      {...props}
    />
  );
}
