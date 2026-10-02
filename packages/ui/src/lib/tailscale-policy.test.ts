import { describe, expect, it } from 'vitest';
import {
  TailscalePolicyError, decodeTailscalePolicy, describeTailscalePolicy, encodeTailscalePolicy, isTailnetAddress, isTailnetHost, matchTailscalePolicy,
  resolveTailscalePolicy, type TailscalePolicy,
} from '@/lib/tailscale-policy';
import { loadServiceWorker } from '../../test/fake-service-worker';

const ORIGIN = 'https://app.example';

/** [policy, url, method, expected reason] — run through the TypeScript matcher and the service worker's copy. */
const CASES: Array<[TailscalePolicy, string, string, string]> = [
  [{}, 'https://nas.tail1234.ts.net/files', 'GET', 'tailnet-name'],
  [{}, 'http://NAS.Tail1234.TS.NET:8080/', 'GET', 'tailnet-name'],
  [{}, 'http://100.64.0.1/', 'GET', 'tailnet-address'],
  [{}, 'http://100.127.255.254:3000/x', 'POST', 'tailnet-address'],
  [{}, 'http://100.128.0.1/', 'GET', 'no-match'],
  [{}, 'http://100.63.255.255/', 'GET', 'no-match'],
  [{}, 'http://[fd7a:115c:a1e0::1]/', 'GET', 'tailnet-address'],
  [{}, 'http://[fd7a:115c:a1e1::1]/', 'GET', 'no-match'],
  [{}, 'https://example.com/', 'GET', 'no-match'],
  [{}, 'https://ts.net.evil.example/', 'GET', 'no-match'],
  [{}, 'https://app.example/api', 'GET', 'same-origin'],
  [{ sameOrigin: true }, 'https://app.example/api', 'GET', 'no-match'],
  [{}, 'http://localhost:5173/', 'GET', 'loopback'],
  [{ intercept: 'all' }, 'http://127.0.0.1:8080/', 'GET', 'loopback'],
  [{ intercept: 'all' }, 'http://[::1]/', 'GET', 'loopback'],
  [{ intercept: 'all' }, 'http://dev.localhost/', 'GET', 'loopback'],
  [{}, 'ftp://nas.tail1234.ts.net/', 'GET', 'scheme'],
  [{}, 'ws://nas.tail1234.ts.net/', 'GET', 'scheme'],
  [{ schemes: ['https'] }, 'http://nas.tail1234.ts.net/', 'GET', 'scheme'],
  [{ hosts: ['api.internal'] }, 'http://api.internal/v1', 'GET', 'host'],
  [{ hosts: ['api.internal'] }, 'http://x.api.internal/v1', 'GET', 'no-match'],
  [{ hosts: ['*.corp.example'] }, 'https://wiki.corp.example/', 'GET', 'host'],
  [{ hosts: ['*.corp.example'] }, 'https://corp.example/', 'GET', 'no-match'],
  [{ hosts: ['.corp.example'] }, 'https://corp.example/', 'GET', 'host'],
  [{ hosts: ['.corp.example'] }, 'https://a.b.corp.example/', 'GET', 'host'],
  [{ hosts: ['.corp.example'] }, 'https://notcorp.example/', 'GET', 'no-match'],
  [{ cidrs: ['192.168.1.0/24'] }, 'http://192.168.1.20/', 'GET', 'cidr'],
  [{ cidrs: ['192.168.1.0/24'] }, 'http://192.168.2.20/', 'GET', 'no-match'],
  [{ hosts: ['10.0.0.0/8'] }, 'http://10.1.2.3/', 'GET', 'cidr'],
  [{ cidrs: ['10.0.0.5'] }, 'http://10.0.0.5/', 'GET', 'cidr'],
  [{ cidrs: ['fd00:1::/64'] }, 'http://[fd00:1::abcd]/', 'GET', 'cidr'],
  [{ cidrs: ['fd00:1::/64'] }, 'http://[fd00:2::abcd]/', 'GET', 'no-match'],
  [{ shortNames: true }, 'http://nas/', 'GET', 'short-name'],
  [{}, 'http://nas/', 'GET', 'no-match'],
  [{ exclude: ['secret.tail1234.ts.net'] }, 'https://secret.tail1234.ts.net/', 'GET', 'excluded'],
  [{ exclude: ['100.100.0.0/16'] }, 'http://100.100.1.1/', 'GET', 'excluded'],
  [{ intercept: 'all' }, 'https://example.com/', 'GET', 'all'],
  [{ intercept: 'all', exclude: ['*.stripe.com'] }, 'https://api.stripe.com/', 'GET', 'excluded'],
  [{ methods: ['get'] }, 'https://nas.tail1234.ts.net/', 'POST', 'method'],
  [{ methods: ['get'] }, 'https://nas.tail1234.ts.net/', 'GET', 'tailnet-name'],
  [{}, 'http://[::ffff:100.64.0.1]/', 'GET', 'no-match'],
];

describe('matchTailscalePolicy', () => {
  it.each(CASES)('%j %s %s → %s', (policy, url, method, reason) => {
    const m = matchTailscalePolicy(url, method, resolveTailscalePolicy(policy), ORIGIN);
    expect(m.reason).toBe(reason);
    expect(m.route).toBe(['tailnet-name', 'tailnet-address', 'host', 'cidr', 'short-name', 'all'].includes(reason));
  });
  it('treats a string that is not a URL as not routed', () => {
    expect(matchTailscalePolicy('http://exa mple', 'GET', resolveTailscalePolicy())).toEqual({ route: false, reason: 'invalid-url' });
  });
  it('resolves relative URLs against the origin (and leaves them alone: they are same-origin)', () => {
    expect(matchTailscalePolicy('/api', 'GET', resolveTailscalePolicy(), ORIGIN).reason).toBe('same-origin');
  });
});

describe('the service worker agrees', () => {
  it('on every case', () => {
    for (const [policy, url, method, reason] of CASES) {
      const resolved = resolveTailscalePolicy(policy);
      const sw = loadServiceWorker(`${ORIGIN}/tailscale-sw.js?p=${encodeTailscalePolicy(resolved)}`);
      expect(sw.exposed.policy).toEqual(resolved);
      expect([url, sw.exposed.match(url, method, sw.exposed.policy, ORIGIN).reason]).toEqual([url, reason]);
    }
  });
  it('falls back to the default allowlist when the script URL has no policy, or a broken one', () => {
    for (const q of ['', '?p=', '?p=not-base64!', `?p=${btoa('{"v":2}')}`]) {
      const sw = loadServiceWorker(`${ORIGIN}/tailscale-sw.js${q}`);
      expect(sw.exposed.policy).toEqual(resolveTailscalePolicy());
    }
  });
});

describe('resolveTailscalePolicy', () => {
  it('defaults to the tailnet allowlist, network fallback', () => {
    expect(resolveTailscalePolicy()).toEqual({
      v: 1, intercept: 'tailnet', hosts: [], cidrs: [], shortNames: false, exclude: [], schemes: ['http', 'https'], methods: null,
      sameOrigin: false, whenUnavailable: 'network', maxBodyBytes: 32 * 1024 * 1024, timeoutMs: 60_000,
    });
  });
  it('normalises hosts (case, punycode) and moves addresses to cidrs', () => {
    const p = resolveTailscalePolicy({ hosts: ['API.Internal', '*.Bücher.example', '10.0.0.1', 'api.internal'] });
    expect(p.hosts).toEqual(['api.internal', '*.xn--bcher-kva.example']);
    expect(p.cidrs).toEqual(['10.0.0.1/32']);
  });
  it('refuses a wildcard host, junk and bad ranges', () => {
    for (const bad of [{ hosts: ['*'] }, { hosts: [''] }, { hosts: ['a b'] }, { cidrs: ['10.0.0.0/33'] }, { cidrs: ['example.com'] }, { exclude: ['*.'] }]) {
      expect(() => resolveTailscalePolicy(bad)).toThrow(TailscalePolicyError);
    }
    expect(() => resolveTailscalePolicy({ intercept: 'everything' as never })).toThrow(TailscalePolicyError);
    expect(() => resolveTailscalePolicy({ schemes: ['ftp' as never] })).toThrow(TailscalePolicyError);
  });
  it('round-trips through the script URL parameter', () => {
    const p = resolveTailscalePolicy({ hosts: ['*.corp.example'], cidrs: ['192.168.0.0/16'], whenUnavailable: 'error', intercept: 'all' });
    const text = encodeTailscalePolicy(p);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeTailscalePolicy(text)).toEqual(p);
    expect(decodeTailscalePolicy('garbage')).toBeNull();
  });
  it('describes itself', () => {
    expect(describeTailscalePolicy(resolveTailscalePolicy({ hosts: ['api.internal'], exclude: ['x.ts.net'] }))).toBe('Routes *.ts.net and Tailscale addresses, api.internal, except x.ts.net.');
    expect(describeTailscalePolicy(resolveTailscalePolicy({ intercept: 'all' }))).toBe('Routes every cross-origin request.');
  });
});

describe('address helpers', () => {
  it('know the tailnet ranges', () => {
    expect(isTailnetAddress('100.100.100.100')).toBe(true);
    expect(isTailnetAddress('[fd7a:115c:a1e0:ab12::1]')).toBe(true);
    expect(isTailnetAddress('8.8.8.8')).toBe(false);
    expect(isTailnetAddress('fd7a:115c:a1e0::1:2:3:4:5:6')).toBe(false);
    expect(isTailnetHost('Laptop.tail1234.ts.net')).toBe(true);
    expect(isTailnetHost('example.com')).toBe(false);
  });
});
