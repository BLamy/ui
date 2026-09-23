import { createContext, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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

const darkVars = (tint: string): Record<string, string> => ({
  '--bl-bg': '#000', '--bl-bg2': '#0A0A0C', '--bl-card': '#1C1C1E', '--bl-label': '#F5F5F7',
  '--bl-label2': 'rgba(235,235,245,.62)', '--bl-label3': 'rgba(235,235,245,.3)', '--bl-sep': 'rgba(84,84,88,.48)',
  '--bl-fill': 'rgba(120,120,128,.22)', '--bl-fill2': 'rgba(120,120,128,.34)', '--bl-bar': 'rgba(16,16,18,.82)',
  '--bl-press': 'rgba(120,120,128,.22)', '--bl-stick': 'rgba(18,18,20,.9)', '--bl-side': '#111114',
  '--bl-red': '#FF453A', '--bl-green': '#30D158', '--bl-scrim': 'rgba(0,0,0,.5)', '--bl-tint': tint,
});
const lightVars = (tint: string): Record<string, string> => ({
  '--bl-bg': '#fff', '--bl-bg2': '#F2F2F7', '--bl-card': '#fff', '--bl-label': '#0B0B0F',
  '--bl-label2': 'rgba(60,60,67,.6)', '--bl-label3': 'rgba(60,60,67,.33)', '--bl-sep': 'rgba(60,60,67,.22)',
  '--bl-fill': 'rgba(120,120,128,.13)', '--bl-fill2': 'rgba(120,120,128,.24)', '--bl-bar': 'rgba(250,250,252,.85)',
  '--bl-press': 'rgba(120,120,128,.16)', '--bl-stick': 'rgba(244,244,248,.92)', '--bl-side': '#ECECF1',
  '--bl-red': '#FF3B30', '--bl-green': '#34C759', '--bl-scrim': 'rgba(0,0,0,.38)', '--bl-tint': tint,
});

export interface BLProviderProps {
  dark?: boolean;
  tint?: string;
  /** Dynamic Island floor. `true` → 59px, a number → that many px. */
  safeTop?: boolean | number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BLProvider({ dark, tint = '#0A84FF', safeTop, children, className, style }: BLProviderProps) {
  const safe = safeTop === true ? 59 : typeof safeTop === 'number' ? safeTop : 0;
  const vars = dark ? darkVars(tint) : lightVars(tint);
  /* react-aria overlays (Popover, Modal, Tooltip) portal into this root instead of document.body, so they
     inherit the --bl-* tokens, font and color scheme. null until mounted → overlays wait one commit. */
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const getContainer = useCallback(() => root, [root]);
  return (
    <div
      ref={setRoot}
      data-slot="bl-provider"
      className={cn(
        'relative h-full w-full overflow-hidden bg-muted font-ios text-foreground select-none transition-[background] duration-250',
        dark ? 'scheme-dark' : 'scheme-light',
        className,
      )}
      // The palette depends on `dark` and `tint`, so the tokens are set per render.
      style={{ ...vars, '--bl-safe-top': safe + 'px', ...style } as CSSProperties}
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
