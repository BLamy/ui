'use client';
import { useEffect, useRef, useState } from 'react';
import { resolveTailscalePolicy, type TailscalePolicy } from '@/lib/tailscale-policy';
import { useOptionalTailscale } from '@/lib/tailscale-react';
import type { Tailscale } from '@/lib/tailscale';
import { registerTailscaleRouter, type TailscaleRouterHandle, type TailscaleRouterOptions, type TailscaleRouterState } from '@/lib/tailscale-router/bridge';

/* ══ The router as a hook and a component ══
   <TailscaleProvider options={…}>
     <TailscaleRouter policy={{ hosts: ['*.corp.example'] }} />
   </TailscaleProvider>
   Registers on mount, detaches on unmount; a changed policy registers a new worker script (the policy is part of its URL). */

export interface UseTailscaleRouterOptions extends Omit<TailscaleRouterOptions, 'tailscale'> {
  /** Default: the provider's controller. */
  tailscale?: Tailscale;
  /** Do nothing while false. Default true. */
  enabled?: boolean;
}

/** Registers the request router for the provider's connection and returns its state (`unsupported`, `registering`, `active`, `uncontrolled`, `error`). */
export function useTailscaleRouter({ tailscale, enabled = true, policy, ...rest }: UseTailscaleRouterOptions = {}): TailscaleRouterState & { router: TailscaleRouterHandle | null } {
  const t = useOptionalTailscale(tailscale);
  if (!t) throw new Error('useTailscaleRouter must be used inside <TailscaleProvider> (or be given a controller).');
  const key = JSON.stringify(resolveTailscalePolicy(policy));
  const restRef = useRef(rest);
  restRef.current = rest;
  const [router, setRouter] = useState<TailscaleRouterHandle | null>(null);
  const [state, setState] = useState<TailscaleRouterState>(() => ({ status: 'registering', detail: null, routed: 0, policy: resolveTailscalePolicy(policy) }));

  useEffect(() => {
    if (!enabled) return undefined;
    const r = registerTailscaleRouter({ ...restRef.current, tailscale: t, policy: JSON.parse(key) as TailscalePolicy });
    setRouter(r);
    setState(r.getState());
    const off = r.subscribe(() => setState(r.getState()));
    return () => {
      off();
      void r.dispose();
      setRouter(null);
    };
  }, [t, key, enabled]);

  return { ...state, router };
}

export interface TailscaleRouterProps extends UseTailscaleRouterOptions {
  /** Called when the router's state changes. */
  onStateChange?: (state: TailscaleRouterState) => void;
}

/** Renders nothing; runs `useTailscaleRouter`. */
export function TailscaleRouter({ onStateChange, ...options }: TailscaleRouterProps): null {
  const state = useTailscaleRouter(options);
  const cb = useRef(onStateChange);
  cb.current = onStateChange;
  const { status, detail, routed } = state;
  useEffect(() => { cb.current?.(state); }, [status, detail, routed]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
