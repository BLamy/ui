import type { CSSProperties } from 'react';
import { Switch as AriaSwitch } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** iOS switch — shadcn's Switch shape on react-aria's Switch. */
export function Switch({ checked, onChange, className, style, ...rest }: SwitchProps) {
  return (
    <AriaSwitch
      data-slot="switch"
      isSelected={checked}
      onChange={(v) => { Haptics.impact('light'); onChange(v); }}
      aria-label={rest['aria-label'] || 'Toggle'}
      className={cn('group relative inline-block h-[31px] w-[51px] shrink-0 cursor-pointer', className)}
      style={style}
    >
      <span
        data-slot="switch-track"
        className="absolute inset-0 rounded-2xl bg-bl-fill2 transition-[background] duration-250 group-data-selected:bg-bl-green"
      />
      <span
        data-slot="switch-thumb"
        className="pointer-events-none absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.22),0_1px_1px_rgba(0,0,0,.14)] transition-[left] duration-250 ease-[cubic-bezier(.3,.9,.4,1.05)] group-data-selected:left-[22px]"
      />
    </AriaSwitch>
  );
}
