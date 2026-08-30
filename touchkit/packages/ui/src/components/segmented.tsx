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

/** Segmented control — react-aria RadioGroup/Radio behavior, prototype-exact visuals. */
export function Segmented({ options, value, onChange, className, style, ...rest }: SegmentedProps) {
  return (
    <RadioGroup
      data-slot="segmented"
      value={value}
      onChange={(id) => { Haptics.selection(); onChange(id); }}
      aria-label={rest['aria-label'] || 'Segmented control'}
      orientation="horizontal"
      className={cn(className)}
      style={{ display: 'flex', gap: 2, background: 'var(--tk-fill,#e4e4ea)', borderRadius: 9, padding: 2, ...style }}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Radio key={o.id} value={o.id} className="tk-btn" style={{
            flex: 1, border: 0, padding: '5px 12px', borderRadius: 7, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: on ? 'var(--tk-card,#fff)' : 'transparent', color: 'var(--tk-label,#16161a)',
            boxShadow: on ? '0 1px 4px rgba(0,0,0,.14)' : 'none', transition: 'background .2s, box-shadow .2s',
          }}>{o.label}</Radio>
        );
      })}
    </RadioGroup>
  );
}
