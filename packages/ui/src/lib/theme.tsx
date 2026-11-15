'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { bindSizeClass, type SizeClass } from '@/lib/size-class';
import { SizeClassProvider } from '@/lib/container';
import { cn, BARH } from '@/lib/utils';
import { THEME_VARS, type ThemeVar } from '@/lib/tokens.generated';

export { THEME_VARS, type ThemeVar };

/* ══ Chrome coordination ══
   Nav bar and tab bar hide together on scroll-down and come back on scroll-up. The scrolling screen
   publishes here so a `Tabs` bar anywhere in the tree follows without prop drilling. */
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
/* Without an AppearanceProvider, a shadcn app's dark mode — the `dark` class on <html> — counts as the ambient
   appearance, so blocks and shells follow it. No class → no preference (undefined), as before. */
function subscribeHtmlClass(cb: () => void) {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
}
const htmlDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
export function useAppearance(): Appearance | undefined {
  const ctx = useContext(AppearanceContext);
  const dark = useSyncExternalStore(subscribeHtmlClass, htmlDark, () => false);
  return ctx ?? (dark ? 'dark' : undefined);
}

/* ══ Theme scopes ══
   Colors are shadcn's CSS variables. A theme (the app's own, or BL UI's bl-theme — `@brett_lamy/ui/theme.css`)
   defines them for light (`:root` / `.light`) and dark (`.dark`). BLProvider and ThemeScope only pick which values
   apply below them: they put `light` or `dark` on their root, and `data-theme-scope` names a surface the bl-theme
   restyles with the same variables (the Workbench, its always-dark terminal, team chat). A `tint` overrides
   --primary / --ring for the subtree, with an ink that reads on it (--primary-foreground). */
export type ThemeScopeName = 'workbench' | 'chat' | 'terminal' | 'sheet' | 'glass' | (string & {});

/** Variables to set on a scope, by name without the leading `--`: `{ radius: '0.25rem', primary: '#f43' }`. Names are
    the theme variables (tokens.css), so they autocomplete; anything else is a custom property of your own. */
export type ThemeVars = { [K in ThemeVar]?: string } & { [custom: string]: string | undefined };

/** The inline style for a `vars` object: `{ radius: '0.25rem' }` → `{ '--radius': '0.25rem' }`. */
export const themeVarStyle = (vars?: ThemeVars): CSSProperties => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (v != null) out['--' + k.replace(/^--/, '')] = v;
  return out as CSSProperties;
};

/** Root classes for an appearance: shadcn's `dark` (or `light`) plus the matching color-scheme. */
export const themeScopeClass = (appearance: Appearance | undefined) =>
  appearance === 'dark' ? 'dark scheme-dark' : appearance === 'light' ? 'light scheme-light' : '';

/* ── A readable ink on a tint ──
   A tint is the fill of primary buttons, so it needs an ink of its own. White stays while it reaches 3:1 on the tint
   (WCAG's minimum for large text and controls, and what the iOS blue gives: 3.6:1); on a lighter tint (green, orange,
   yellow, teal, where white is about 2:1) the ink is a near-black, which is then at least 6:1. The switch is the tint's
   relative luminance (0.30). For a color this can read (hex, rgb notation, a gray oklch) it is worked out here; for any other
   CSS color (a name, hsl(), a var()) the browser works it out with relative color syntax, from the same luminance. */
const TINT_INK_DARK = 'oklch(0.2 0 0)';
const TINT_INK_LIGHT = 'oklch(1 0 0)';
/** The luminance at which white falls under 3:1. */
const TINT_INK_SWITCH = 0.3;

/** The sRGB channels (0–255) of a hex or rgb() color, or null for anything else. */
function parseRgb(color: string): [number, number, number] | null {
  const c = color.trim().toLowerCase();
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.exec(c);
  if (hex) {
    const h = hex[1].length <= 4 ? [...hex[1].slice(0, 3)].map((d) => d + d).join('') : hex[1].slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)/.exec(c);
  if (rgb) return rgb.slice(1, 4).map((v) => (v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v))) as [number, number, number];
  return null;
}

const linear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a hex or rgb() color, or of an achromatic `oklch(L 0 0)` (the inks below); null otherwise. */
function luminance(color: string): number | null {
  const rgb = parseRgb(color);
  if (rgb) {
    const [r, g, b] = rgb.map(linear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const gray = /^oklch\(\s*([\d.]+)(%?)\s+0\s+0\s*\)$/i.exec(color.trim());
  return gray ? (gray[2] ? parseFloat(gray[1]) / 100 : parseFloat(gray[1])) ** 3 : null;
}

/** The ink for text and icons on a tint: white while it reaches 3:1 on it, else a near-black. */
export function tintForeground(tint: string): string {
  const y = luminance(tint);
  if (y !== null) return y > TINT_INK_SWITCH ? TINT_INK_DARK : TINT_INK_LIGHT;
  // XYZ's Y is the luminance: k is 1 under the switch (white), 0 above it (the ink, whose Y is 0.2³).
  const k = `clamp(0, (${TINT_INK_SWITCH} - y) * 1000, 1)`;
  return `color(from ${tint} xyz-d65 calc(0.0076 + 0.9429 * ${k}) calc(0.008 + 0.992 * ${k}) calc(0.0087 + 1.0803 * ${k}))`;
}

/** WCAG 2 contrast ratio of two colors `tintForeground` can read (hex, rgb(), a gray oklch()); null otherwise. */
export function contrastRatio(a: string, b: string): number | null {
  const x = luminance(a);
  const y = luminance(b);
  if (x === null || y === null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** --primary, its ink (--primary-foreground) and --ring for a tint (nothing when no tint is given, so the theme's
    primary applies). */
export const tintVars = (tint?: string): CSSProperties =>
  (tint ? { '--primary': tint, '--primary-foreground': tintForeground(tint), '--ring': tint } : {}) as CSSProperties;

/** The props a scope root carries: `data-theme-scope`, the appearance class and the tint. */
export function themeScopeProps({ scope, appearance, tint, vars }: { scope?: ThemeScopeName; appearance?: Appearance; tint?: string; vars?: ThemeVars }) {
  return { 'data-theme-scope': scope, className: themeScopeClass(appearance), style: { ...tintVars(tint), ...themeVarStyle(vars) } as CSSProperties };
}

/* ── The scope an overlay opened inside should wear ──
   Popovers, menus, dialogs and tooltips render into their layer host (BLProvider's root, see `useLayerHost`), outside
   the scope's DOM, so CSS inheritance no longer reaches them. ThemeScope publishes its scope here and the overlay
   primitives spread `useThemeScopeProps()` onto their popup — it gets the same `data-theme-scope`, appearance class,
   tint and vars as the surface that opened it. Nothing is applied outside a scope. */
export interface ThemeScopeState { scope?: ThemeScopeName; appearance?: Appearance; tint?: string; vars?: ThemeVars }
export const ThemeScopeContext = createContext<ThemeScopeState | null>(null);

/** Props (`data-theme-scope`, `className`, `style`) that carry the surrounding ThemeScope onto a portalled overlay. */
export function useThemeScopeProps(): { 'data-theme-scope'?: string; className?: string; style?: CSSProperties } {
  const state = useContext(ThemeScopeContext);
  if (!state) return {};
  const p = themeScopeProps(state);
  return { 'data-theme-scope': p['data-theme-scope'], className: p.className || undefined, style: p.style };
}

/** A UI SDK part's `style`: an object, or a function of the part's state. */
export type StyleProp<State> = CSSProperties | ((state: State) => CSSProperties | undefined) | undefined;

/** Puts a scope's variables under a UI SDK part's own `style`, which may be a function of the part's state. */
export function scopeStyle<State>(scope: CSSProperties | undefined, style: StyleProp<State>): StyleProp<State> {
  if (!scope) return style;
  return typeof style === 'function' ? (state) => ({ ...scope, ...style(state) }) : { ...scope, ...style };
}

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

/** The appearance a named scope falls back to when neither its prop, an enclosing scope of the same name nor the
    ambient appearance decides. The Workbench is dark-first; other surface scopes are light. */
const SCOPE_DEFAULT_APPEARANCE: Partial<Record<string, Appearance>> = { workbench: 'dark' };

/** The nearest ThemeScope's resolved state (`scope`, `appearance`, `tint`, `vars`), or `null` outside every scope.
    Use it for third-party renderers that take the appearance as a prop (a diff viewer, a highlighter). */
export function useThemeScope(): ThemeScopeState | null {
  return useContext(ThemeScopeContext);
}

/** The appearance a `<ThemeScope scope={scope} appearance={appearance}>` rendered here resolves to: the terminal scope
    is always dark; otherwise the explicit value, else the enclosing scope's when it has the same name, else the ambient
    `AppearanceProvider` (or `.dark` on `<html>`), else the scope's default (dark for `workbench`, light for the other
    named scopes, none for a plain scope). For a component that renders its own scope root, such as a shell. */
export function useScopeAppearance(scope: ThemeScopeName, appearance?: Appearance): Appearance;
export function useScopeAppearance(scope?: ThemeScopeName, appearance?: Appearance): Appearance | undefined;
export function useScopeAppearance(scope?: ThemeScopeName, appearance?: Appearance): Appearance | undefined {
  const parent = useContext(ThemeScopeContext);
  const ambient = useAppearance();
  if (scope === 'terminal') return 'dark';
  return appearance
    ?? (scope && parent?.scope === scope ? parent.appearance : undefined)
    ?? ambient
    ?? (scope ? (SCOPE_DEFAULT_APPEARANCE[scope] ?? 'light') : undefined);
}

export interface ThemeScopeProps extends ComponentProps<'div'> {
  /** A named surface palette — `[data-theme-scope="name"] { … }` in your CSS, or one the bl-theme and the blocks define
      (`workbench`, `chat`, `terminal`, `sheet`, `glass`). Omit for the plain theme. The bl-theme's `workbench` scope
      also paints its root (background, text color, sans font, antialiasing). */
  scope?: ThemeScopeName;
  /** Defaults to an enclosing scope of the same name, else the ambient `AppearanceProvider` value; without either a
      plain scope inherits the page's `.dark` / light, `workbench` is dark, other surface scopes are light, and the
      terminal scope is always dark. */
  appearance?: Appearance;
  /** Accent for the subtree: --primary and --ring, and a readable --primary-foreground for it (white on a dark tint, a
      near-black on a light one such as the iOS green; see `tintForeground`). Set `vars={{ 'primary-foreground': … }}` to
      choose the ink yourself. */
  tint?: string;
  /** Theme variables for the subtree, by name without `--`: `{ radius: '0.25rem', card: '#111' }`. Wins over `tint`. */
  vars?: ThemeVars;
}

/** A subtree with its own appearance, accent, variables and (optionally) named surface palette. Overlays opened inside
    it (popovers, menus, dialogs, tooltips) wear the same scope. Scopes nest; the nearest one wins. */
export function ThemeScope({ scope, appearance: appearanceProp, tint, vars, className, style, ...props }: ThemeScopeProps) {
  const appearance = useScopeAppearance(scope, appearanceProp);
  const p = themeScopeProps({ scope, appearance, tint, vars });
  const state = useMemo<ThemeScopeState>(() => ({ scope, appearance, tint, vars }), [scope, appearance, tint, vars]);
  return (
    <ThemeScopeContext.Provider value={state}>
      <div
        data-slot="theme-scope"
        {...props}
        data-theme-scope={p['data-theme-scope']}
        className={cn(p.className, className)}
        style={{ ...p.style, ...style }}
      />
    </ThemeScopeContext.Provider>
  );
}

/* ══ Layer host ══
   A popup (dialog, sheet, popover, menu, tooltip, toast) belongs to the app it opened in, not to the page: an app
   shown in a phone frame or a window keeps its dialogs, their scrim and their scroll lock inside that frame.
   BLProvider's root is that host. It publishes the element here, and every popup renders into it through UI SDK's
   `container` prop, set on the popup's root so that its backdrop follows its content: `const host = useLayerHost()`,
   then `<SdkDialog container={container ?? host}>`. Outside a BLProvider there is no host, and a popup renders in
   place, in the browser's top layer. */
const LayerHostContext = createContext<HTMLElement | undefined>(undefined);

/** The element popups opened below should render into (UI SDK's `container`): the nearest BLProvider's root, or
    `undefined` outside one and until that root has mounted. */
export function useLayerHost(): HTMLElement | undefined {
  return useContext(LayerHostContext);
}


export interface BLProviderProps {
  /** Defaults to the ambient `AppearanceProvider` value; without one the provider inherits the page's appearance
      (shadcn's `.dark` on an ancestor, else light). */
  dark?: boolean;
  /** Accent for everything below: sets --primary, --ring and a readable --primary-foreground (as ThemeScope's `tint`).
      Defaults to the theme's primary. */
  tint?: string;
  /** Dynamic Island floor. `true` → 59px, a number → that many px. */
  safeTop?: boolean | number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BLProvider({ dark: darkProp, tint, safeTop, children, className, style }: BLProviderProps) {
  const appearance = useAppearance();
  const dark = darkProp ?? (appearance ? appearance === 'dark' : undefined);
  const safe = safeTop === true ? 59 : typeof safeTop === 'number' ? safeTop : 0;
  /* Popups render into this root (see `useLayerHost`), so they stay inside it and inherit its theme variables,
     font and color scheme. null until mounted: a popup open on the first render moves in one commit later. The
     root is a layer host (UI SDK's `data-layer-host`, with the `contain: layout` it needs), written in the markup
     so it is there before any popup inside binds: popups stay in its box instead of the browser's top layer, a
     modal one makes only the rest of the root inert, and the page keeps its scroll.
     The root is also a size-class scope: it measures its own box (`bindSizeClass`), writes `data-size-class`, and
     provides the class to everything inside, so `presentation="auto"` in a phone frame is a sheet on a desktop.
     Until it is measured (and on the server) there is no class, and "auto" falls back to UI SDK's own rule. */
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [sizeClass, setSizeClass] = useState<SizeClass | undefined>(undefined);
  const rootRef = useCallback((el: HTMLDivElement) => {
    setRoot(el);
    const stop = bindSizeClass(el, { onChange: setSizeClass });
    return () => {
      stop();
      setSizeClass(undefined);
    };
  }, []);
  return (
    <div
      ref={rootRef}
      data-slot="bl-provider"
      data-layer-host=""
      data-size-class={sizeClass}
      className={cn(
        'relative h-full w-full overflow-hidden bg-muted font-sans [contain:layout] text-foreground select-none transition-[background] duration-spring-smooth ease-spring-smooth',
        themeScopeClass(dark === undefined ? undefined : dark ? 'dark' : 'light'),
        className,
      )}
      style={{ ...tintVars(tint), '--bl-safe-top': safe + 'px', ...style } as CSSProperties}
    >
      {/* Popups render into this root and inherit its theme from it, so a ThemeScope outside (a docs page's light
          scope around a dark block) must not dress them as well. */}
      <ThemeScopeContext.Provider value={null}>
        <LayerHostContext.Provider value={root ?? undefined}>
          <SizeClassProvider value={sizeClass}>
            <BLSafeCtx.Provider value={safe}>{children}</BLSafeCtx.Provider>
          </SizeClassProvider>
        </LayerHostContext.Provider>
      </ThemeScopeContext.Provider>
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
