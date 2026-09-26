import {
  Radio as AriaRadio, type RadioProps as AriaRadioProps,
  RadioGroup as AriaRadioGroup, type RadioGroupProps as AriaRadioGroupProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ RadioGroup — generic round radios on react-aria's RadioGroup (arrows move + select, one tick per change).
   For the iOS segmented look use <Segmented>. ══ */
export const radioGroupVariants = cva('group flex', {
  variants: {
    orientation: {
      vertical: 'flex-col gap-3',
      horizontal: 'flex-row flex-wrap gap-5',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

export interface RadioGroupProps extends AriaRadioGroupProps {}

export function RadioGroup({ className, orientation = 'vertical', onChange, ...props }: RadioGroupProps) {
  return (
    <AriaRadioGroup
      data-slot="radio-group"
      orientation={orientation}
      onChange={(v) => { Haptics.selection(); onChange?.(v); }}
      className={composeRenderProps(className, (cls) => cn(radioGroupVariants({ orientation }), cls))}
      {...props}
    />
  );
}

export const radioVariants = cva(
  [
    'box-border size-[22px] shrink-0 rounded-full border-[1.5px] border-bl-label3 bg-transparent',
    'transition-[border-width,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
    'group-data-selected:border-[7px] group-data-selected:border-primary group-data-selected:bg-white',
    'group-data-pressed:scale-90 group-data-focus-visible:ring-[3px] group-data-focus-visible:ring-ring/45',
    'group-data-invalid:border-destructive',
  ],
);

export interface RadioProps extends AriaRadioProps, VariantProps<typeof radioVariants> {}

export function Radio({ className, children, ...props }: RadioProps) {
  return (
    <AriaRadio
      data-slot="radio"
      className={composeRenderProps(className, (cls) =>
        cn('group relative inline-flex cursor-pointer items-center gap-3 text-[17px] text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40', cls))}
      {...props}
    >
      {composeRenderProps(children, (kids) => (
        <>
          <span data-slot="radio-indicator" className={radioVariants()} />
          {kids}
        </>
      ))}
    </AriaRadio>
  );
}
