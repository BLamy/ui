import type { CSSProperties } from 'react';
import { Switch as AriaSwitch } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';
import { useRowLabel } from '../lib/row-label';

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  'aria-label'?: string;
  /** Label the switch by another element. Inside a ListRow it defaults to the row title. */
  'aria-labelledby'?: string;
  className?: string;
  style?: CSSProperties;
}

/** iOS switch — shadcn's Switch shape on react-aria's Switch. The thumb springs across, and stretches toward
    the far side while pressed (as on iOS), so a press already hints where it will go. */
export function Switch({ checked, onChange, className, style, ...rest }: SwitchProps) {
  const labelledBy = useRowLabel(rest);
  return (
    <AriaSwitch
      data-slot="switch"
      isSelected={checked}
      onChange={(v) => { Haptics.impact('light'); onChange(v); }}
      aria-label={rest['aria-label'] || (labelledBy ? undefined : 'Toggle')}
      aria-labelledby={labelledBy}
      className={cn('group relative inline-block h-[31px] w-[51px] shrink-0 cursor-pointer', className)}
      style={style}
    >
      <span
        data-slot="switch-track"
        className="absolute inset-0 rounded-2xl bg-secondary-strong transition-[background-color] duration-spring-smooth ease-spring-smooth group-data-selected:bg-success"
      />
      <span
        data-slot="switch-thumb"
        className="pointer-events-none absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_--alpha(black/22%),0_1px_1px_--alpha(black/14%)] transition-[translate,width] duration-spring-snappy ease-spring-snappy group-data-pressed:w-[33px] group-data-selected:translate-x-5 group-data-selected:group-data-pressed:translate-x-[14px] motion-reduce:transition-none"
      />
    </AriaSwitch>
  );
}
