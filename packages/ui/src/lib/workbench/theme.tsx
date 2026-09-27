import * as React from 'react';
import { useAppearance, type Appearance } from '../theme';
import { cn } from './util';

/* ══ --wb-* token sets ══
   Dark is the prototype's exact var map; light is an Apple/Codex-desktop-style counterpart. The terminal stays
   dark in both (like an IDE's integrated terminal): `.wb-light .wb-term` in styles.css hands its subtree the
   dark tokens back. */
const darkVars = (tint: string): Record<string, string> => ({
  '--wb-bg': '#141419',
  '--wb-side': '#101015',
  '--wb-card': '#1C1C23',
  '--wb-fill': 'rgba(255,255,255,.06)',
  '--wb-fill2': 'rgba(255,255,255,.11)',
  '--wb-sep': 'rgba(255,255,255,.08)',
  '--wb-label': '#EDEDF2',
  '--wb-label2': '#9C9CA6',
  '--wb-label3': '#69696F',
  '--wb-tint': tint,
  '--wb-green': '#30D158',
  '--wb-red': '#FF453A',
  '--bl-tint': tint,
  '--mdc-code': 'rgba(255,255,255,.09)',
  '--mdc-pre': '#0C0C10',
  '--mdc-border': 'rgba(255,255,255,.1)',
  '--mdc-mut': '#9C9CA6',
  '--mdc-card': '#1C1C23',
  '--mdc-muted': 'rgba(255,255,255,.06)',
});
const lightVars = (tint: string): Record<string, string> => ({
  '--wb-bg': '#FFFFFF',
  '--wb-side': '#F7F7F9',
  '--wb-card': '#FFFFFF',
  '--wb-card2': '#F2F2F5',
  '--wb-well': '#F7F7F9',
  '--wb-term': '#1A1A1F',
  '--wb-handle': 'rgba(0,0,0,.18)',
  '--wb-shadow': 'rgba(0,0,0,.08)',
  '--wb-fill': 'rgba(0,0,0,.05)',
  '--wb-fill2': 'rgba(0,0,0,.09)',
  '--wb-sep': 'rgba(0,0,0,.08)',
  '--wb-label': '#17171C',
  '--wb-label2': '#6B6B76',
  '--wb-label3': '#9A9AA3',
  '--wb-tint': tint,
  '--wb-green': '#34C759',
  '--wb-red': '#FF3B30',
  '--bl-tint': tint,
  '--mdc-code': 'rgba(0,0,0,.06)',
  '--mdc-pre': '#F4F4F7',
  '--mdc-pre-fg': '#24242B',
  '--mdc-border': 'rgba(0,0,0,.1)',
  '--mdc-mut': '#6B6B76',
  '--mdc-card': '#FFFFFF',
  '--mdc-muted': 'rgba(0,0,0,.04)',
});

export function workbenchVars(tint?: string, appearance: Appearance = 'dark'): React.CSSProperties {
  const t = tint || '#0A84FF';
  return (appearance === 'light' ? lightVars(t) : darkVars(t)) as React.CSSProperties;
}

/** Root classes for an appearance: `wb-dark`/`wb-light` key the package CSS, plus the matching color-scheme. */
export const workbenchAppearanceClass = (appearance: Appearance) =>
  appearance === 'light' ? 'wb-light scheme-light' : 'wb-dark scheme-dark';

/* The resolved appearance of the nearest Workbench root, for pieces whose third-party renderers need it
   as a prop (e.g. the diff theme). Kept private to the package so nested BLProviders are unaffected. */
const WorkbenchAppearanceContext = React.createContext<Appearance | undefined>(undefined);
export const WorkbenchAppearanceProvider = WorkbenchAppearanceContext.Provider;

/** The explicit prop, else the ambient `AppearanceProvider`, else Workbench's dark default. */
export function useWorkbenchAppearance(explicit?: Appearance): Appearance {
  const root = React.useContext(WorkbenchAppearanceContext);
  const ambient = useAppearance();
  return explicit ?? root ?? ambient ?? 'dark';
}

export interface WorkbenchThemeProps extends React.HTMLAttributes<HTMLDivElement> {
  tint?: string;
  /** Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  children?: React.ReactNode;
}
/* Applies the --wb-* token set (runtime vars, tint-dependent) + base styling, like the shell root. */
export function WorkbenchTheme({ tint, appearance: appearanceProp, className, style, children, ...rest }: WorkbenchThemeProps) {
  const appearance = useWorkbenchAppearance(appearanceProp);
  return (
    <div
      data-slot="workbench-theme"
      className={cn('bg-wb-bg font-ios text-wb-label antialiased', workbenchAppearanceClass(appearance), className)}
      style={{ ...workbenchVars(tint, appearance), ...style }}
      {...rest}
    >
      <WorkbenchAppearanceProvider value={appearance}>{children}</WorkbenchAppearanceProvider>
    </div>
  );
}
