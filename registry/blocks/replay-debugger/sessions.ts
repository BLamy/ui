import type { ReplaySession } from '@/components/ui/replay-debugger';

/* The sessions the block's demos run on, fetched as files when they're asked for rather than bundled: each is a few MB
   of JSON (a few hundred kB compressed), which a bundler shouldn't parse into code. `new URL(…, import.meta.url)` is a
   static asset to Vite, webpack and Next alike. */
export const SESSION_URLS = {
  /** A shop page and four Node services: gateway, orders, payments, inventory. */
  checkout: new URL('./recordings/checkout-session.json', import.meta.url).href,
  /** A TanStack Start page in Replay Chromium and its server in workerd. */
  tanstack: new URL('./recordings/tanstack-session.json', import.meta.url).href,
} as const;

const loaded = new Map<string, Promise<ReplaySession>>();

/** A session's JSON, fetched once per URL. */
export function loadSession(url: string): Promise<ReplaySession> {
  let session = loaded.get(url);
  if (!session) {
    session = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      return response.json() as Promise<ReplaySession>;
    });
    session.catch(() => loaded.delete(url));
    loaded.set(url, session);
  }
  return session;
}
