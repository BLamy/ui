/* Device sign-in: the CLI-style logins almostnode's app builder runs, without a terminal. Each one hands the user a
   URL (and, for RFC 8628, a code to type there), then polls until they approve in the browser and returns a token.

   - GitHub   RFC 8628 device authorization grant (the GitHub CLI flow): user code + github.com/login/device.
   - Fly.io   `fly auth login`: a CLI session whose auth_url the user opens; poll the session for its token.
   - Netlify  `netlify login`: an OAuth ticket the user authorizes; poll it, then exchange it for a token.
   - Replay   `replayio login`: an auth request keyed by a random hex key; poll it, then refresh through Auth0.

   None of these endpoints send CORS headers, so a browser needs a proxy: pass `fetch: corsProxy(prefix)`. The block
   defaults to `demoDeviceAuth`, which walks the same steps with an invented code and approves itself. */

export type ServiceId = 'github' | 'fly' | 'netlify' | 'replay';

export interface Service {
  id: ServiceId;
  name: string;
  /** Saved as the account's website. */
  site: string;
  /** Tile color (the service's brand). */
  color: string;
  /** What the browser step is called on the sheet's button. */
  verb: string;
}

export const SERVICES: Service[] = [
  { id: 'github', name: 'GitHub', site: 'github.com', color: '#24292F', verb: 'Open GitHub' },
  { id: 'fly', name: 'Fly.io', site: 'fly.io', color: '#7B3BE2', verb: 'Open Fly.io' },
  { id: 'netlify', name: 'Netlify', site: 'app.netlify.com', color: '#00AD9F', verb: 'Open Netlify' },
  { id: 'replay', name: 'Replay', site: 'app.replay.io', color: '#F02D5E', verb: 'Open Replay' },
];

export interface DevicePrompt {
  /** The code to enter at `verificationUri`. Absent when the URL itself carries the session (Fly, Netlify, Replay). */
  userCode?: string;
  verificationUri: string;
  /** The URL with the code already filled in, when the service offers one. */
  verificationUriComplete?: string;
  /** Epoch ms. */
  expiresAt: number;
}

export interface DeviceGrant {
  accessToken: string;
  /** Who signed in: a login or an email, for the saved item's user name. */
  account: string;
  scope?: string;
}

export interface SignInOptions {
  signal: AbortSignal;
  /** Called once the user has something to do — show the code and the button that opens the URL. */
  onPrompt: (prompt: DevicePrompt) => void;
}

export interface DeviceAuth {
  signIn: (service: ServiceId, options: SignInOptions) => Promise<DeviceGrant>;
  /** Sends the user to the prompt's URL. Defaults to a new tab; the demo approves instead. */
  open?: (prompt: DevicePrompt) => void;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** A fetch that routes every request through a CORS proxy taking the target as an encoded suffix
    (`https://proxy.example/?url=` + encodeURIComponent(url)). */
export function corsProxy(prefix: string): Fetch {
  return (url, init) => fetch(prefix + encodeURIComponent(url), init);
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

const FIFTEEN_MINUTES = 15 * 60_000;
const GITHUB_CLIENT_ID = 'Ov23li3di39s0mmKf6HE';
const NETLIFY_CLIENT_ID = 'd6f37de6614df7ae58664cfca524744d73807a377f5ee71f1a254f78412e3750';
const REPLAY_AUTH0_CLIENT_ID = '4FvFnJJW4XlnUyrXQF8zOLw6vNAH1MAo';

/* ── RFC 8628 ── request a device + user code, then poll the token endpoint at `interval`, backing off on slow_down. */
export interface Rfc8628Config {
  deviceAuthorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scope?: string;
}

export async function rfc8628(f: Fetch, config: Rfc8628Config, { signal, onPrompt }: SignInOptions) {
  const post = (url: string, body: Record<string, string>) => f(url, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });
  const res = await post(config.deviceAuthorizationEndpoint, { client_id: config.clientId, ...(config.scope ? { scope: config.scope } : {}) });
  if (!res.ok) throw new Error(`Couldn’t get a device code (${res.status}).`);
  const d = await res.json() as { device_code: string; user_code: string; verification_uri: string; verification_uri_complete?: string; expires_in: number; interval?: number };
  const expiresAt = Date.now() + d.expires_in * 1000;
  onPrompt({ userCode: d.user_code, verificationUri: d.verification_uri, verificationUriComplete: d.verification_uri_complete, expiresAt });

  let interval = (d.interval ?? 5) * 1000;
  while (Date.now() < expiresAt) {
    await sleep(interval, signal);
    const t = await post(config.tokenEndpoint, {
      client_id: config.clientId, device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    const body = await t.json().catch(() => ({})) as { access_token?: string; scope?: string; error?: string; error_description?: string };
    if (body.access_token) return { accessToken: body.access_token, scope: body.scope };
    if (body.error === 'authorization_pending') continue;
    if (body.error === 'slow_down') { interval += 5000; continue; }
    if (body.error === 'access_denied') throw new Error('You declined the request.');
    if (body.error === 'expired_token') break;
    throw new Error(body.error_description ?? body.error ?? `Token request failed (${t.status}).`);
  }
  throw new Error('The code expired. Try again.');
}

/* ── Per-service flows ── */
async function github(f: Fetch, o: SignInOptions): Promise<DeviceGrant> {
  const { accessToken, scope } = await rfc8628(f, {
    deviceAuthorizationEndpoint: 'https://github.com/login/device/code',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    clientId: GITHUB_CLIENT_ID,
    scope: 'repo read:org gist',
  }, o);
  const me: { login?: string } = await f('https://api.github.com/user', { signal: o.signal, headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return { accessToken, scope, account: me.login ?? 'GitHub user' };
}

async function fly(f: Fetch, { signal, onPrompt }: SignInOptions): Promise<DeviceGrant> {
  const api = 'https://api.fly.io/api/v1/cli_sessions';
  const res = await f(api, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'passwords-' + Math.random().toString(36).slice(2, 8), signup: false, target: 'auth' }),
  });
  if (res.status !== 201) throw new Error(`Couldn’t start a Fly.io session (${res.status}).`);
  const s = await res.json() as { id: string; auth_url?: string; url?: string };
  const expiresAt = Date.now() + FIFTEEN_MINUTES;
  onPrompt({ verificationUri: s.auth_url ?? s.url ?? 'https://fly.io/app/auth/cli', expiresAt });
  while (Date.now() < expiresAt) {
    await sleep(1000, signal);
    // 404 until the session is ready; like flyctl, keep polling through errors until it expires.
    const p = await f(`${api}/${encodeURIComponent(s.id)}`, { signal }).catch((e) => { if (signal.aborted) throw e; return null; });
    const token = p?.ok ? (await p.json() as { access_token?: string }).access_token : undefined;
    if (token) {
      const viewer = await f('https://api.fly.io/graphql', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: '{ viewer { email } }' }),
      }).then((r) => r.json() as Promise<{ data?: { viewer?: { email?: string } } }>).catch(() => ({} as { data?: { viewer?: { email?: string } } }));
      return { accessToken: token, account: viewer.data?.viewer?.email ?? 'Fly.io user' };
    }
  }
  throw new Error('The sign-in expired. Try again.');
}

async function netlify(f: Fetch, { signal, onPrompt }: SignInOptions): Promise<DeviceGrant> {
  const api = 'https://api.netlify.com/api/v1/oauth/tickets';
  const res = await f(`${api}?client_id=${NETLIFY_CLIENT_ID}`, { method: 'POST', signal });
  if (res.status !== 201) throw new Error(`Couldn’t start a Netlify sign-in (${res.status}).`);
  const { id } = await res.json() as { id: string };
  const expiresAt = Date.now() + FIFTEEN_MINUTES;
  onPrompt({ verificationUri: `https://app.netlify.com/authorize?response_type=ticket&ticket=${encodeURIComponent(id)}`, expiresAt });
  while (Date.now() < expiresAt) {
    await sleep(1000, signal);
    const p = await f(`${api}/${encodeURIComponent(id)}`, { signal });
    if (p.status === 401 || p.status === 404) throw new Error('You declined the request, or it expired.');
    if (!p.ok || !(await p.json() as { authorized?: boolean }).authorized) continue;
    const x = await f(`${api}/${encodeURIComponent(id)}/exchange`, { method: 'POST', signal });
    if (x.status !== 201) throw new Error(`Netlify token exchange failed (${x.status}).`);
    const t = await x.json() as { access_token: string; user_email?: string };
    return { accessToken: t.access_token, account: t.user_email ?? 'Netlify user' };
  }
  throw new Error('The sign-in expired. Try again.');
}

function jwtClaim(jwt: string, claim: string) {
  try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))[claim] as string | undefined; } catch { return undefined; }
}

async function replay(f: Fetch, { signal, onPrompt }: SignInOptions): Promise<DeviceGrant> {
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = Date.now() + 5 * 60_000;
  onPrompt({ verificationUri: `https://app.replay.io/api/browser/auth?key=${key}&source=cli`, expiresAt });
  let refreshToken: string | undefined;
  while (!refreshToken) {
    if (Date.now() > expiresAt) throw new Error('The sign-in expired. Try again.');
    await sleep(2500, signal);
    const r = await f('https://api.replay.io/v1/graphql', {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'CloseAuthRequest', variables: { key },
        query: 'mutation CloseAuthRequest($key: String!) { closeAuthRequest(input: { key: $key }) { success token } }',
      }),
    });
    if (!r.ok) continue;
    const j = await r.json() as { data?: { closeAuthRequest?: { token?: string } }; errors?: { message: string }[] };
    // "does not exist" until the user approves; any other error is final.
    if (j.errors?.length) {
      if (j.errors.length === 1 && j.errors[0].message === 'Authentication request does not exist') continue;
      throw new Error(j.errors.map((e) => e.message).join(', '));
    }
    refreshToken = j.data?.closeAuthRequest?.token;
  }
  const t = await f('https://webreplay.us.auth0.com/oauth/token', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audience: 'https://api.replay.io', scope: 'openid profile', grant_type: 'refresh_token', client_id: REPLAY_AUTH0_CLIENT_ID, refresh_token: refreshToken }),
  });
  const x = await t.json() as { access_token?: string; error?: string };
  if (!x.access_token) throw new Error(`Replay token exchange failed${x.error ? `: ${x.error}` : ''}.`);
  return { accessToken: x.access_token, account: jwtClaim(x.access_token, 'email') ?? jwtClaim(x.access_token, 'sub') ?? 'Replay user' };
}

const FLOWS: Record<ServiceId, (f: Fetch, o: SignInOptions) => Promise<DeviceGrant>> = { github, fly, netlify, replay };

/** The real flows. Pass `fetch: corsProxy(…)` in a browser; a desktop shell or server can use plain fetch. */
export function createDeviceAuth({ fetch: f = (url, init) => fetch(url, init) }: { fetch?: Fetch } = {}): DeviceAuth {
  return { signIn: (service, options) => FLOWS[service](f, options) };
}

/* ── Demo ── an invented code (and an invented token) that approve a moment after the sheet's button is pressed,
   so the whole flow can be walked through without an account or a network. */
const DEMO_CODES: Record<ServiceId, string> = { github: 'WDJB-MJHT', fly: 'FLY-7Q4K', netlify: 'NTL-2XRP', replay: 'RPL-9VKC' };
const DEMO_ACCOUNTS: Record<ServiceId, string> = {
  github: 'juneokafor', fly: 'june@okafor.example', netlify: 'june@studio.example', replay: 'june@okafor.example',
};

export function createDemoDeviceAuth({ promptDelay = 700, approveDelay = 1600 } = {}): DeviceAuth {
  const approvals = new Set<() => void>();
  return {
    open: () => { for (const approve of approvals) approve(); },
    async signIn(service, { signal, onPrompt }) {
      await sleep(promptDelay, signal);
      const s = SERVICES.find((x) => x.id === service)!;
      // Only GitHub's flow has a code to type; the others carry their session in the URL.
      onPrompt({
        userCode: service === 'github' ? DEMO_CODES[service] : undefined,
        verificationUri: `https://${s.site}/login/device`,
        expiresAt: Date.now() + FIFTEEN_MINUTES,
      });
      await new Promise<void>((resolve, reject) => {
        const approve = () => { approvals.delete(approve); resolve(); };
        approvals.add(approve);
        signal.addEventListener('abort', () => { approvals.delete(approve); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      });
      await sleep(approveDelay, signal);
      const token = { github: 'gho_', fly: 'fm2_', netlify: 'nfp_', replay: 'rpl_' }[service] + DEMO_CODES[service].replace('-', '').toLowerCase() + 'x'.repeat(24);
      return { accessToken: token, account: DEMO_ACCOUNTS[service], scope: service === 'github' ? 'repo, read:org, gist' : undefined };
    },
  };
}

export const demoDeviceAuth = createDemoDeviceAuth();
