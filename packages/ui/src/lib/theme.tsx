import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { UNSAFE_PortalProvider } from 'react-aria/PortalProvider';
import { cn, BARH } from './utils';

/* ══ Chrome coordination ══
   Nav bar and tab bar hide together on scroll-down and come back on scroll-up. The scrolling screen
   publishes here so a <TabBar> anywhere in the tree follows without prop drilling. */
export const chromeStore = {
  hidden: false,
  subs: new Set<(v: boolean) => void>(),
  set(v: boolean) { if (v === this.hidden) return; this.hidden = v; this.subs.forEach(f => f(v)); },
};

export function useChromeHidden() {
  const [h, setH] = useState(chromeStore.hidden);
  useEffect(() => {
    const f = (v: boolean) => setH(v);
    chromeStore.subs.add(f); setH(chromeStore.hidden);
    return () => { chromeStore.subs.delete(f); };
  }, []);
  return h;
}

/* Safe-area top inset (Dynamic Island) threaded down from the app frame, so it survives frame changes
   without remounting. --bl-safe-top is still set for CSS that wants it. */
export const BLSafeCtx = createContext(0);

/* How far down sticky list headers must stop — whatever chrome is above the list (0 when the list is in a
   bare scroller, so it never needs to know where it lives). While the chrome is hidden every offset moves
   up by one bar height, floored at the safe-area strip — that's how headers ride along with the bar. */
export const BLStickyCtx = createContext(0);
export const chromeOffset = (top: number, hidden: boolean) => (hidden ? Math.max(0, top - BARH) : top);

/* ══ Appearance ══
   Ambient light/dark choice for a subtree. Hosts (a docs site, an app's settings) set it once; every themed
   surface below — BLProvider, ThemeScope, WorkbenchShell, ChatShell — follows unless given an explicit prop.
   `undefined` means "no preference", so each surface keeps its own default (BL light, Workbench/chat dark). */
export type Appearance = 'light' | 'dark';
export const AppearanceContext = createContext<Appearance | undefined>(undefined);
export function AppearanceProvider({ value, children }: { value: Appearance | undefined; children?: ReactNode }) {
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
export const useAppearance = () => useContext(AppearanceContext);

/* ══ Theme scopes ══
   Colors are shadcn's CSS variables. A theme (the app's own, or BL UI's bl-theme — `@brett_lamy/ui/theme.css`)
   defines them for light (`:root` / `.light`) and dark (`.dark`). BLProvider and ThemeScope only pick which values
   apply below them: they put `light` or `dark` on their root, and `data-theme-scope` names a surface the bl-theme
   restyles with the same variables (the Workbench, its always-dark terminal, team chat). A `tint` overrides
   --primary / --ring for the subtree. */
export type ThemeScopeName = 'workbench' | 'chat' | 'terminal' | 'sheet' | 'glass';

/** Root classes for an appearance: shadcn's `dark` (or `light`) plus the matching color-scheme. */
export const themeScopeClass = (appearance: Appearance) => (appearance === 'dark' ? 'dark scheme-dark' : 'light scheme-light');

/** --primary / --ring for a tint (nothing when no tint is given, so the theme's primary applies). */
export const tintVars = (tint?: string): CSSProperties =>
  (tint ? { '--primary': tint, '--ring': tint } : {}) as CSSProperties;

/** The props a scope root carries: `data-theme-scope`, the appearance class and the tint. */
export function themeScopeProps({ scope, appearance, tint }: { scope?: ThemeScopeName; appearance: Appearance; tint?: string }) {
  return { 'data-theme-scope': scope, className: themeScopeClass(appearance), style: tintVars(tint) };
}

/** The theme variables a portalled overlay copies from the element that opened it, so it keeps that surface's
    palette wherever it renders. */
export const THEME_VARS = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'border',
  'input', 'ring', 'success', 'warning', 'tertiary-foreground', 'secondary-strong', 'overlay', 'bar', 'sticky', 'handle',
  'link', 'code', 'code-foreground',
] as const;

/** The resolved theme variables (and color-scheme) at an element, as a style object. */
export function readThemeVars(el: Element | null | undefined): CSSProperties {
  if (!el || typeof getComputedStyle === 'undefined') return {};
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const name of THEME_VARS) {
    const v = cs.getPropertyValue('--' + name).trim();
    if (v) out['--' + name] = v;
  }
  if (cs.colorScheme && cs.colorScheme !== 'normal') out.colorScheme = cs.colorScheme;
  return out as CSSProperties;
}

export interface ThemeScopeProps extends HTMLAttributes<HTMLDivElement> {
  /** The surface palette the bl-theme defines: `workbench`, `chat`, `terminal`, `sheet` (a floating chat surface's tone) or `glass` (the Composer floating over content). Omit for the plain theme. */
  scope?: ThemeScopeName;
  /** Defaults to the ambient `AppearanceProvider` value, else light (the terminal scope is always dark). */
  appearance?: Appearance;
  /** Accent for the subtree (--primary / --ring). */
  tint?: string;
}

/** A subtree with its own appearance, accent and (optionally) surface palette. */
export function ThemeScope({ scope, appearance: appearanceProp, tint, className, style, ...props }: ThemeScopeProps) {
  const ambient = useAppearance();
  const appearance: Appearance = scope === 'terminal' ? 'dark' : (appearanceProp ?? ambient ?? 'light');
  const p = themeScopeProps({ scope, appearance, tint });
  return (
    <div
      data-slot="theme-scope"
      {...props}
      data-theme-scope={p['data-theme-scope']}
      className={cn(p.className, className)}
      style={{ ...p.style, ...style }}
    />
  );
}

export interface BLProviderProps {
  /** Defaults to the ambient `AppearanceProvider` value, else light. */
  dark?: boolean;
  /** Accent for everything below: sets --primary and --ring. Defaults to the theme's primary. */
  tint?: string;
  /** Dynamic Island floor. `true` → 59px, a number → that many px. */
  safeTop?: boolean | number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BLProvider({ dark: darkProp, tint, safeTop, children, className, style }: BLProviderProps) {
  const appearance = useAppearance();
  const dark = darkProp ?? appearance === 'dark';
  const safe = safeTop === true ? 59 : typeof safeTop === 'number' ? safeTop : 0;
  /* react-aria overlays (Popover, Modal, Tooltip) portal into this root instead of document.body, so they
     inherit the theme variables, font and color scheme. null until mounted → overlays wait one commit. */
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const getContainer = useCallback(() => root, [root]);
  return (
    <div
      ref={setRoot}
      data-slot="bl-provider"
      className={cn(
        'relative h-full w-full overflow-hidden bg-muted font-ios text-foreground select-none transition-[background] duration-spring-smooth ease-spring-smooth',
        themeScopeClass(dark ? 'dark' : 'light'),
        className,
      )}
      style={{ ...tintVars(tint), '--bl-safe-top': safe + 'px', ...style } as CSSProperties}
    >
      <UNSAFE_PortalProvider getContainer={getContainer}>
        <BLSafeCtx.Provider value={safe}>{children}</BLSafeCtx.Provider>
      </UNSAFE_PortalProvider>
      {safe ? (
        <div
          className="pointer-events-none absolute left-1/2 z-400 h-[35px] w-[118px] -translate-x-1/2 rounded-[18px] bg-black"
          style={{ top: Math.max(8, safe / 5) }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
