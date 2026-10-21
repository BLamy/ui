/* The sign-ins' network. A browser can't call GitHub's, Fly's, Netlify's or Replay's login endpoints itself (no CORS), so
   by default they go through almostnode's CORS proxy. When this tab is signed in to Tailscale and an exit node is online
   they go through the tailnet instead: the WebAssembly client fetches them as the exit node, and the proxy never sees the
   tokens. The node is the one the Safari block signs in (same saved session and Web Lock), so signing in there is enough. */
import { createTailscaleConnectClient } from '@/lib/tailscale-connect';
import { toResponse, toTailscaleRequest, webStorageTailscalePersistence, type Tailscale, type TailscaleOptions, type TailscaleSnapshot } from '@/lib/tailscale';
import { exitNodeOnline } from '@/lib/tailscale-exit';
import { corsProxy } from './device-auth';
import wasmURL from './wasm-url';

/** Safari's tailnet options: the same node (sessionStorage key and lock), so a session from either is used by both. */
export function passwordsTailnetOptions(): TailscaleOptions {
  return {
    client: () => createTailscaleConnectClient({ wasmURL }),
    hostname: 'safari',
    persistence: typeof sessionStorage === 'undefined' ? undefined : webStorageTailscalePersistence(sessionStorage, 'safari-tailscale'),
    lockName: 'safari',
  };
}

/** The online exit node to use: the one chosen, else the first online one by name. */
export function pickExitNode(snapshot: TailscaleSnapshot): string | null {
  if (exitNodeOnline(snapshot)) return snapshot.exitNodeId;
  const online = snapshot.peers.filter((p) => p.exitNode && p.online && p.id).sort((a, b) => a.name.localeCompare(b.name));
  return online[0]?.id ?? null;
}

/** Whether the tailnet can carry the sign-ins now: connected, with an exit node online (or one to choose). */
export const tailnetReady = (snapshot: TailscaleSnapshot) => snapshot.status === 'connected' && pickExitNode(snapshot) !== null;

/** A fetch that uses the tailnet when it is ready (choosing an exit node if none is set) and the CORS proxy otherwise. */
export function tailnetOrProxy(tailscale: Tailscale | null, fallback = corsProxy()) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const snapshot = tailscale?.getSnapshot();
    if (!tailscale || !snapshot || !tailnetReady(snapshot)) return fallback(url, init);
    const exit = pickExitNode(snapshot)!;
    if (snapshot.exitNodeId !== exit) await tailscale.setExitNode(exit);
    // The signal can't cross into the client; an aborted sign-in just stops reading.
    const { signal: _signal, ...rest } = init ?? {};
    return toResponse(await tailscale.fetch(await toTailscaleRequest(url, rest)));
  };
}
