/* The desktop's own Tailscale options: the real Tailscale, the same client Safari uses. Safari is loaded on the first
   sign-in (it brings the WebAssembly file's URL), so a desktop that never touches Tailscale loads neither it nor the
   client. The device lives for the tab (sessionStorage), under its own name and lock so a Safari block on the same page
   is a different device, not a competing one. Pass `tailscale` or `controller` to <MacOS> for anything else. */
import { webStorageTailscalePersistence, type TailscaleOptions } from '@/lib/tailscale';

export function desktopTailnet(): TailscaleOptions {
  return {
    client: async () => {
      const { tailnetOptions } = await import('../safari/page');
      const client = tailnetOptions().client;
      if (!client) throw new Error('Safari has no Tailscale client to use.');
      return typeof client === 'function' ? client() : client;
    },
    hostname: 'macos',
    persistence: typeof sessionStorage === 'undefined' ? undefined : webStorageTailscalePersistence(sessionStorage, 'macos-tailscale'),
    lockName: 'macos',
  };
}
