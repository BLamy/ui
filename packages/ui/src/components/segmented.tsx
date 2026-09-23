import type { CSSProperties, ReactNode } from 'react';
import { Radio, RadioGroup } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

export interface SegmentedOption {
  id: string;
  label: ReactNode;
}

export interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onChange: (id: string) => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** iOS segmented control on react-aria's RadioGroup: arrows move and select, one tick per change. */
export function Segmented({ options, value, onChange, className, style, ...rest }: SegmentedProps) {
  return (
    <RadioGroup
      data-slot="segmented"
      aria-label={rest['aria-label'] || 'Segmented control'}
      orientation="horizontal"
      value={value}
      onChange={(id) => { if (id === value) return; Haptics.selection(); onChange(id); }}
      className={cn('flex gap-0.5 rounded-[9px] bg-bl-fill p-0.5', className)}
      style={style}
    >
      {options.map((o) => (
        <Radio
          key={o.id}
          value={o.id}
          className="bl-btn relative flex flex-1 cursor-pointer items-center justify-center rounded-[7px] px-3 py-[5px] text-[13px] font-semibold whitespace-nowrap text-bl-label outline-none transition-[background,box-shadow] duration-200 data-focus-visible:ring-2 data-focus-visible:ring-ring data-selected:bg-bl-card data-selected:shadow-[0_1px_4px_rgba(0,0,0,.14)]"
        >
          {o.label}
        </Radio>
      ))}
    </RadioGroup>
  );
}
