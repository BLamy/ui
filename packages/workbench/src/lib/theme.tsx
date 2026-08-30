import * as React from 'react';
import { cn, WFONT } from './util';

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
    '--tk-tint': tint || '#0A84FF',
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
/* Applies the --wb-* token set + dark base styling; the shell root does the same inline. */
export function WorkbenchTheme({ tint, className, style, children, ...rest }: WorkbenchThemeProps) {
  return (
    <div
      data-slot="workbench-theme"
      className={cn('wb-dark', className)}
      style={{
        ...workbenchVars(tint),
        background: 'var(--wb-bg)',
        color: 'var(--wb-label)',
        fontFamily: WFONT,
        colorScheme: 'dark',
        WebkitFontSmoothing: 'antialiased',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
