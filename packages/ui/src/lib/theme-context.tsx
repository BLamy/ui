'use client';
/* @internal: the theme's shared state, for the kit's own modules: the chrome-hidden store, the safe-area and sticky
   offsets BLProvider and NavigationStack thread down, and the appearance and scope contexts. Public API reads them
   through lib/theme (`useChromeHidden`, `setChromeHidden`, `useAppearance`, `useThemeScope`, …). Registry installs copy
   it with the theme; it has no npm entry. */
import { createContext } from 'react';
import { BARH } from '@/lib/primitives';
import type { Appearance, ThemeScopeState } from '@/lib/theme';

/* ══ Chrome coordination ══
   Nav bar and tab bar hide together on scroll-down and come back on scroll-up. The scrolling screen
   publishes here so a `Tabs` bar anywhere in the tree follows without prop drilling. */
export const chromeStore = {
  hidden: false,
  subs: new Set<(v: boolean) => void>(),
  set(v: boolean) { if (v === this.hidden) return; this.hidden = v; this.subs.forEach(f => f(v)); },
};

/* Safe-area top inset (Dynamic Island) threaded down from the app frame, so it survives frame changes
   without remounting. --bl-safe-top is still set for CSS that wants it. */
export const BLSafeCtx = createContext(0);

/* How far down sticky list headers must stop — whatever chrome is above the list (0 when the list is in a
   bare scroller, so it never needs to know where it lives). While the chrome is hidden every offset moves
   up by one bar height, floored at the safe-area strip — that's how headers ride along with the bar. */
export const BLStickyCtx = createContext(0);
export const chromeOffset = (top: number, hidden: boolean) => (hidden ? Math.max(0, top - BARH) : top);

/** The ambient appearance (`AppearanceProvider`). */
export const AppearanceContext = createContext<Appearance | undefined>(undefined);

/** The nearest ThemeScope's state (`useThemeScope`). */
export const ThemeScopeContext = createContext<ThemeScopeState | null>(null);
