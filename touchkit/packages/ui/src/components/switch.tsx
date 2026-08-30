import type { CSSProperties } from 'react';
import { Switch as RACSwitch } from 'react-aria-components';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** iOS-style switch (prototype `TKSwitch`) — react-aria Switch behavior, prototype-exact visuals. */
export function Switch({ checked, onChange, className, style, ...rest }: SwitchProps) {
  return (
    <RACSwitch
      data-slot="switch"
      isSelected={checked}
      onChange={(v) => { Haptics.impact('light'); onChange(v); }}
      aria-label={rest['aria-label'] || 'Toggle'}
      className={cn(className)}
      style={{ position: 'relative', display: 'inline-block', width: 51, height: 31, flexShrink: 0, cursor: 'pointer', ...style }}
    >
      <span style={{ position: 'absolute', inset: 0, borderRadius: 16, background: checked ? 'var(--tk-green)' : 'var(--tk-fill2)', transition: 'background .25s' }} />
      <span style={{
        position: 'absolute', top: 2, left: checked ? 22 : 2, width: 27, height: 27, borderRadius: '50%', background: '#fff',
        boxShadow: '0 3px 8px rgba(0,0,0,.22), 0 1px 1px rgba(0,0,0,.14)', transition: 'left .25s cubic-bezier(.3,.9,.4,1.05)', pointerEvents: 'none',
      }} />
    </RACSwitch>
  );
}
