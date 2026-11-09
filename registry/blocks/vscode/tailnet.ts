import { createTailscaleConnectClient } from '@/lib/tailscale-connect';
import { webStorageTailscalePersistence, type TailscaleOptions } from '@/lib/tailscale';

/** Standalone VS Code gets its own device; inside macOS it borrows the desktop's controller. */
export function vscodeTailnet(): TailscaleOptions {
  return {
    client: async () => {
      const { default: wasmURL } = await import('@agent-wasm/tailscale-connect/main.wasm?url');
      return createTailscaleConnectClient({ wasmURL });
    },
    hostname: 'vscode',
    persistence: typeof sessionStorage === 'undefined' ? undefined : webStorageTailscalePersistence(sessionStorage, 'vscode-tailscale'),
    lockName: 'vscode',
  };
}
