import * as React from 'react';
import { cn } from './util';

/* ══ --wb-* token set — the exact var map the prototype shell root applies ══ */
export function workbenchVars(tint?: string): React.CSSProperties {
  return {
    '--wb-bg': '#141419',
    '--wb-side': '#101015',
    '--wb-card': '#1C1C23',
    '--wb-fill': 'rgba(255,255,255,.06)',
    '--wb-fill2': 'rgba(255,255,255,.11)',
    '--wb-sep': 'rgba(255,255,255,.08)',
    '--wb-label': '#EDEDF2',
    '--wb-label2': '#9C9CA6',
    '--wb-label3': '#69696F',
    '--wb-tint': tint || '#0A84FF',
    '--wb-green': '#30D158',
    '--wb-red': '#FF453A',
    '--bl-tint': tint || '#0A84FF',
    '--mdc-code': 'rgba(255,255,255,.09)',
    '--mdc-pre': '#0C0C10',
    '--mdc-border': 'rgba(255,255,255,.1)',
    '--mdc-mut': '#9C9CA6',
  } as React.CSSProperties;
}

export interface WorkbenchThemeProps extends React.HTMLAttributes<HTMLDivElement> {
  tint?: string;
  children?: React.ReactNode;
}
/* Applies the --wb-* token set (runtime vars, tint-dependent) + dark base styling, like the shell root. */
export function WorkbenchTheme({ tint, className, style, children, ...rest }: WorkbenchThemeProps) {
  return (
    <div
      data-slot="workbench-theme"
      className={cn('wb-dark bg-wb-bg font-ios text-wb-label antialiased scheme-dark', className)}
      style={{ ...workbenchVars(tint), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
