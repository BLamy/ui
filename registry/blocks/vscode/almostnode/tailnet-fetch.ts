import { isTailnetHost } from '@/lib/tailscale-policy';

/** The requests that leave the Worker for the page's tailnet connection: HTTP to a tailnet name or address. Package
 *  downloads and ordinary web requests stay in the Worker. */
export function isTailnetUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isTailnetHost(url.hostname);
  } catch { return false; }
}
