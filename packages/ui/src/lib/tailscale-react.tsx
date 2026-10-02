'use client';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createTailscale, createTailscaleFetch, type Tailscale, type TailscaleOptions, type TailscaleSnapshot } from '@/lib/tailscale';

/* ══ tailscale-react — a provider and hooks over lib/tailscale ══
   <TailscaleProvider options={{ client: () => createTailscaleConnectClient({ wasmURL }) }}>
     <TailscaleLoginButton />          // components/tailscale-login-button
   </TailscaleProvider>
   The snapshot is read with `useSyncExternalStore`; server rendering sees `idle`. */

const TailscaleContext = createContext<Tailscale | null>(null);

export interface TailscaleProviderProps {
  /** An existing controller (`createTailscale`). Takes precedence over `options`. */
  tailscale?: Tailscale;
  /** Options for a controller the provider creates once, on first render. Later changes are ignored; change `key` to start over. */
  options?: TailscaleOptions;
  children?: ReactNode;
}

/** Provides a Tailscale controller and runs its lifecycle: activated on mount (a saved session is restored), stopped on unmount. StrictMode safe. */
export function TailscaleProvider({ tailscale, options, children }: TailscaleProviderProps) {
  const [owned] = useState<Tailscale | null>(() => (tailscale ? null : createTailscale(options)));
  const active = tailscale ?? owned;
  if (!active) throw new Error('TailscaleProvider needs `tailscale` or `options`.');
  useEffect(() => active.activate(), [active]);
  return <TailscaleContext.Provider value={active}>{children}</TailscaleContext.Provider>;
}

/** The nearest provider's controller, or null outside one (components use this to work without a provider). */
export function useOptionalTailscale(override?: Tailscale): Tailscale | null {
  const ctx = useContext(TailscaleContext);
  return override ?? ctx;
}

function useInstance(override?: Tailscale): Tailscale {
  const t = useOptionalTailscale(override);
  if (!t) throw new Error('useTailscale must be used inside <TailscaleProvider> (or be given a controller).');
  return t;
}

/** The controller, with the component subscribed to its snapshot: `useTailscale().signIn()`. */
export function useTailscale(tailscale?: Tailscale): Tailscale {
  const t = useInstance(tailscale);
  useSyncExternalStore(t.subscribe, t.getSnapshot, t.getServerSnapshot);
  return t;
}

/** The snapshot: `status`, `loginUrl`, `error`, `selfName`, `tailnet`, `addresses`, `peers`, `hasSession`. A new object per change. */
export function useTailscaleStatus(tailscale?: Tailscale): TailscaleSnapshot {
  const t = useInstance(tailscale);
  return useSyncExternalStore(t.subscribe, t.getSnapshot, t.getServerSnapshot);
}

/** A stable `fetch` that sends what matches the controller's policy through the tailnet (see `createTailscaleFetch`). */
export function useTailscaleFetch(tailscale?: Tailscale): typeof fetch {
  const t = useInstance(tailscale);
  return useMemo(() => createTailscaleFetch(t), [t]);
}
