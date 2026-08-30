import * as React from 'react';
import { PKI, type PKIconName } from './constants';

export interface PKIconProps extends React.SVGAttributes<SVGSVGElement> {
  name: PKIconName;
  size?: number;
}

export function PKIcon({ name, size, style, ...rest }: PKIconProps) {
  return (
    <svg
      data-slot="pk-icon"
      width={size || 19}
      height={size || 19}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
      {...rest}
    >
      {(PKI[name] || []).map((e, i) => (
        <path key={i} d={e.d} />
      ))}
    </svg>
  );
}
