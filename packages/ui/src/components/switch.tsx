'use client';
import type { ComponentProps } from 'react';
import { Switch as SdkSwitch, SwitchThumb as SdkSwitchThumb } from '@ui-sdk/react/switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { pressableFocusRing } from '@/lib/primitives';
import { useRowLabel } from '@/lib/row-label';

/* ══ Switch — the iOS switch, on UI SDK's Switch ══
   `checked` / `defaultChecked` / `onCheckedChange(checked, details)`, `disabled`, `readOnly`, and `name` to submit
   with a form. The root is the track (a button with the `switch` role); with no children it renders its
   `SwitchThumb`, which springs across and stretches toward the far side while pressed (as on iOS), so a press
   already hints where it will go. Name it: wrap it and its text in a Label, or pass `aria-label`. Inside a ListRow
   it is labelled by the row title. */
/** The track. `default` is iOS's 51×31; `sm` is 38×22, the macOS and inspector size. */
export const switchVariants = cva(
  [
    'group/switch relative inline-block shrink-0 cursor-pointer rounded-full border-0 bg-secondary-strong p-0 transition-[background-color] duration-spring-smooth ease-spring-smooth',
    pressableFocusRing,
    'data-checked:bg-success data-disabled:cursor-default data-disabled:opacity-40',
  ],
  {
    variants: {
      size: {
        default: 'h-[31px] w-[51px]',
        sm: 'h-[22px] w-[38px]',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type SwitchProps = ComponentProps<typeof SdkSwitch> & VariantProps<typeof switchVariants>;

export function Switch({ className, children, size, ...props }: SwitchProps) {
  const labelledBy = useRowLabel(props);
  return (
    <SdkSwitch
      {...props}
      aria-labelledby={labelledBy}
      data-size={size ?? 'default'}
      className={cx(switchVariants({ size }), className)}
    >
      {children ?? <SwitchThumb />}
    </SdkSwitch>
  );
}

/** The knob. It reads the track's size (`data-size`), travels the track and stretches toward the far side while
    pressed. */
export function SwitchThumb({ className, ...props }: ComponentProps<typeof SdkSwitchThumb>) {
  return (
    <SdkSwitchThumb
      className={cx(
        [
          'pointer-events-none absolute top-0.5 start-0.5 rounded-full bg-white shadow-[0_3px_8px_--alpha(black/22%),0_1px_1px_--alpha(black/14%)] transition-[translate,width] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
          // "On" is toward the end of the line: the knob travels by `--switch-dir`, -1 in right-to-left text (as iOS mirrors it).
          '[--switch-dir:1] rtl:[--switch-dir:-1]',
          // default: a 27px knob that travels 20px and stretches to 33px.
          'h-[27px] w-[27px] group-active/switch:not-data-disabled:w-[33px] data-checked:translate-x-[calc(var(--switch-dir)*20px)] data-checked:group-active/switch:not-data-disabled:translate-x-[calc(var(--switch-dir)*14px)]',
          // sm: an 18px knob that travels 16px and stretches to 22px.
          'group-data-[size=sm]/switch:h-[18px] group-data-[size=sm]/switch:w-[18px] group-data-[size=sm]/switch:group-active/switch:not-data-disabled:w-[22px] group-data-[size=sm]/switch:data-checked:translate-x-[calc(var(--switch-dir)*16px)] group-data-[size=sm]/switch:data-checked:group-active/switch:not-data-disabled:translate-x-[calc(var(--switch-dir)*12px)]',
        ],
        className,
      )}
      {...props}
    />
  );
}

export { createSwitchController } from '@ui-sdk/react/switch';
