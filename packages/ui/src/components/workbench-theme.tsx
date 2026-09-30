import * as React from 'react';
import { useAppearance, themeScopeProps, type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';

/* ══ The Workbench theme scope ══
   The Workbench's palette is the bl-theme's `workbench` scope (dark-first IDE colors; light is an
   Apple/Codex-desktop-style counterpart). Its integrated terminal is a nested `terminal` scope that stays dark in
   both. WorkbenchShell and WorkbenchTheme mark the scope; everything inside uses the ordinary shadcn utilities. */

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
  /** Accent (--primary / --ring). Defaults to the theme's primary. */
  tint?: string;
  /** Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  children?: React.ReactNode;
}
/** A `workbench` theme scope with the Workbench's base styling — for Workbench parts used outside WorkbenchShell. */
export function WorkbenchTheme({ tint, appearance: appearanceProp, className, style, children, ...rest }: WorkbenchThemeProps) {
  const appearance = useWorkbenchAppearance(appearanceProp);
  const scope = themeScopeProps({ scope: 'workbench', appearance, tint });
  return (
    <div
      data-slot="workbench-theme"
      data-theme-scope={scope['data-theme-scope']}
      className={cn('bg-background font-ios text-foreground antialiased', scope.className, className)}
      style={{ ...scope.style, ...style }}
      {...rest}
    >
      <WorkbenchAppearanceProvider value={appearance}>{children}</WorkbenchAppearanceProvider>
    </div>
  );
}
