/* The exit node, chosen for you. Safari browses only through the tailnet, so a public site can load only through an exit node:
   rather than ask, it picks the best online one (lib/tailscale-exit `pickExitNode`) when a page needs it.

   - `prepare(url)` runs before a page is fetched. A public name with no exit node set selects one first — unless the person
     chose "None: your devices only" in the menu, which is remembered (until Try Again, or choosing a node) and never overridden.
   - `retry(address, error)` is Try Again: when the failure is about reaching a public site, or the exit node in use is offline or
     failing, it clears that opt-out, picks another online node (not the one that just failed, if there is one) and sets it.
   - `choose(id)` is the menu: a node, or null to opt out. */
import type { Tailscale, TailscaleSnapshot } from '@/lib/tailscale';
import { isPublicName } from '@/lib/tailscale-connect';
import { exitNodeOnline, pickExitNode } from '@/lib/tailscale-exit';
import { LoadError } from './loader';

/** The host of an http(s) address when it needs public DNS (and so an exit node), else null. */
export function publicHostOf(address: string): string | null {
  try {
    const { hostname } = new URL(address);
    return isPublicName(hostname) ? hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}

export type ExitNodeProblem =
  /** A public site and no exit node is set. */
  | 'none'
  /** A public site and the exit node in use is offline (or gone from the tailnet). */
  | 'offline'
  /** A public site, an exit node that looks up, and the site could not be reached through it. */
  | 'failing';

/** What is wrong with the exit node for a page that failed, or null when the failure is not about it (a tailnet address, a 404, or
    Tailscale itself being down). Try Again acts on a problem; with none it only reloads. */
export function exitNodeProblem(snapshot: Pick<TailscaleSnapshot, 'peers' | 'exitNodeId'>, address: string, error: unknown): ExitNodeProblem | null {
  if (!publicHostOf(address)) return null;
  if (error instanceof LoadError && error.reason === 'offline') return null;
  if (snapshot.exitNodeId === null) return 'none';
  if (!exitNodeOnline(snapshot)) return 'offline';
  if (error instanceof LoadError && (error.reason === 'unreachable' || (error.reason === 'status' && [502, 503, 504].includes(error.status ?? 0)))) return 'failing';
  return null;
}

export interface ExitNodes {
  /** The person chose "None: your devices only": nothing is picked for them until Try Again or a chosen node. */
  readonly optedOut: boolean;
  /** Before fetching `url`: select an exit node if it is a public site and none is set. Never rejects. */
  prepare(url: string): Promise<void>;
  /** The menu: use this node, or none (null, which is remembered). Rejects if the controller refuses. */
  choose(id: string | null): Promise<void>;
  /** Try Again: fix the exit node for the page that failed. Resolves true when one was selected. Never rejects. */
  retry(address: string, error: unknown): Promise<boolean>;
  /** Forget the opt-out and the last node (signed out). */
  reset(): void;
}

export function createExitNodes(tailscale: Pick<Tailscale, 'getSnapshot' | 'setExitNode'>): ExitNodes {
  let optedOut = false;
  let last: string | null = null;
  let inflight: Promise<void> | null = null;
  const remember = (snapshot: TailscaleSnapshot) => { if (snapshot.exitNodeId) last = snapshot.exitNodeId; };

  return {
    get optedOut() { return optedOut; },

    prepare(url) {
      if (optedOut || !publicHostOf(url)) return Promise.resolve();
      if (inflight) return inflight;
      const snapshot = tailscale.getSnapshot();
      remember(snapshot);
      if (snapshot.status !== 'connected' || snapshot.exitNodeId) return Promise.resolve();
      const id = pickExitNode(snapshot, { prefer: last });
      if (!id) return Promise.resolve();
      inflight = Promise.resolve()
        .then(() => tailscale.setExitNode(id))
        .then(() => { last = id; }, () => undefined)
        .finally(() => { inflight = null; });
      return inflight;
    },

    async choose(id) {
      remember(tailscale.getSnapshot());
      optedOut = id === null;
      await tailscale.setExitNode(id);
      if (id) last = id;
    },

    async retry(address, error) {
      const snapshot = tailscale.getSnapshot();
      remember(snapshot);
      if (!exitNodeProblem(snapshot, address, error)) return false;
      optedOut = false;
      const failed = snapshot.exitNodeId;
      // Another node than the one that just failed; if it is the only one online, it gets another chance.
      const id = pickExitNode(snapshot, { exclude: failed, prefer: last }) ?? pickExitNode(snapshot, { prefer: last });
      if (!id) return false;
      try {
        await tailscale.setExitNode(id);
        last = id;
        return true;
      } catch {
        return false;
      }
    },

    reset() {
      optedOut = false;
      last = null;
    },
  };
}
