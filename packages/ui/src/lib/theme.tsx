import { createContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { cn, FONT, BARH } from './utils';

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
   without remounting. --tk-safe-top is still set for CSS that wants it. */
export const TKSafeCtx = createContext(0);

/* How far down sticky list headers must stop — whatever chrome is above the list (0 when the list is in a
   bare scroller, so it never needs to know where it lives). While the chrome is hidden every offset moves
   up by one bar height, floored at the safe-area strip — that's how headers ride along with the bar. */
export const TKStickyCtx = createContext(0);
export const chromeOffset = (top: number, hidden: boolean) => (hidden ? Math.max(0, top - BARH) : top);

const darkVars = (tint: string): Record<string, string> => ({
  '--tk-bg': '#000', '--tk-bg2': '#0A0A0C', '--tk-card': '#1C1C1E', '--tk-label': '#F5F5F7',
  '--tk-label2': 'rgba(235,235,245,.62)', '--tk-label3': 'rgba(235,235,245,.3)', '--tk-sep': 'rgba(84,84,88,.48)',
  '--tk-fill': 'rgba(120,120,128,.22)', '--tk-fill2': 'rgba(120,120,128,.34)', '--tk-bar': 'rgba(16,16,18,.82)',
  '--tk-press': 'rgba(120,120,128,.22)', '--tk-stick': 'rgba(18,18,20,.9)', '--tk-side': '#111114',
  '--tk-red': '#FF453A', '--tk-green': '#30D158', '--tk-scrim': 'rgba(0,0,0,.5)', '--tk-tint': tint,
});
const lightVars = (tint: string): Record<string, string> => ({
  '--tk-bg': '#fff', '--tk-bg2': '#F2F2F7', '--tk-card': '#fff', '--tk-label': '#0B0B0F',
  '--tk-label2': 'rgba(60,60,67,.6)', '--tk-label3': 'rgba(60,60,67,.33)', '--tk-sep': 'rgba(60,60,67,.22)',
  '--tk-fill': 'rgba(120,120,128,.13)', '--tk-fill2': 'rgba(120,120,128,.24)', '--tk-bar': 'rgba(250,250,252,.85)',
  '--tk-press': 'rgba(120,120,128,.16)', '--tk-stick': 'rgba(244,244,248,.92)', '--tk-side': '#ECECF1',
  '--tk-red': '#FF3B30', '--tk-green': '#34C759', '--tk-scrim': 'rgba(0,0,0,.38)', '--tk-tint': tint,
});

export interface TouchKitProviderProps {
  dark?: boolean;
  tint?: string;
  /** Dynamic Island floor. `true` → 59px, a number → that many px. */
  safeTop?: boolean | number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function TouchKitProvider({ dark, tint = '#0A84FF', safeTop, children, className, style }: TouchKitProviderProps) {
  const safe = safeTop === true ? 59 : typeof safeTop === 'number' ? safeTop : 0;
  const vars = dark ? darkVars(tint) : lightVars(tint);
  return (
    <div
      data-slot="touchkit-provider"
      className={cn(className)}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden', fontFamily: FONT,
        background: 'var(--tk-bg2)', color: 'var(--tk-label)', colorScheme: dark ? 'dark' : 'light',
        userSelect: 'none', WebkitUserSelect: 'none', transition: 'background .25s',
        ...vars, '--tk-safe-top': safe + 'px', ...style,
      } as CSSProperties}
    >
      <TKSafeCtx.Provider value={safe}>{children}</TKSafeCtx.Provider>
      {safe ? (
        <div
          style={{
            position: 'absolute', top: Math.max(8, safe / 5), left: '50%', transform: 'translateX(-50%)',
            width: 118, height: 35, borderRadius: 18, background: '#000', zIndex: 400, pointerEvents: 'none',
          }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
