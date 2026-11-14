'use client';
import type { ComponentProps } from 'react';
import { Switch as SdkSwitch, SwitchThumb as SdkSwitchThumb } from '@ui-sdk/react/switch';
import { cx } from '@/lib/utils';
import { useRowLabel } from '@/lib/row-label';

/* ══ Switch — the iOS switch, on UI SDK's Switch ══
   `checked` / `defaultChecked` / `onCheckedChange(checked, details)`, `disabled`, `readOnly`, and `name` to submit
   with a form. The root is the track (a button with the `switch` role); with no children it renders its
   `SwitchThumb`, which springs across and stretches toward the far side while pressed (as on iOS), so a press
   already hints where it will go. Name it: wrap it and its text in a Label, or pass `aria-label`. Inside a ListRow
   it is labelled by the row title. */
export type SwitchProps = ComponentProps<typeof SdkSwitch>;

export function Switch({ className, children, ...props }: SwitchProps) {
  const labelledBy = useRowLabel(props);
  return (
    <SdkSwitch
      {...props}
      aria-labelledby={labelledBy}
      className={cx(
        'group relative inline-block h-[31px] w-[51px] shrink-0 cursor-pointer rounded-2xl border-0 bg-secondary-strong p-0 outline-none transition-[background-color] duration-spring-smooth ease-spring-smooth focus-visible:ring-[3px] focus-visible:ring-ring/45 data-checked:bg-success data-disabled:cursor-default data-disabled:opacity-40',
        className,
      )}
    >
      {children ?? <SwitchThumb />}
    </SdkSwitch>
  );
}

export function SwitchThumb({ className, ...props }: ComponentProps<typeof SdkSwitchThumb>) {
  return (
    <SdkSwitchThumb
      className={cx(
        'pointer-events-none absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_--alpha(black/22%),0_1px_1px_--alpha(black/14%)] transition-[translate,width] duration-spring-snappy ease-spring-snappy group-active:not-data-disabled:w-[33px] data-checked:translate-x-5 data-checked:group-active:not-data-disabled:translate-x-[14px] motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  );
}

export { createSwitchController } from '@ui-sdk/react/switch';
