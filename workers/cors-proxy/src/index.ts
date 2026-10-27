/* BL CORS proxy — a Cloudflare Worker the browser-side sign-ins (registry/blocks/apple-passwords/device-auth.ts) go
   through, in place of almostnode's public proxy. Same shape: `https://<worker>/?url=` + encodeURIComponent(target).

   Like almostnode's proxy it reaches any http(s) URL (ALLOWED_HOSTS "*"; list hostnames to narrow it), but only for
   pages on an allowed Origin (ALLOWED_ORIGINS; `localhost` and 127.0.0.1 on any port always pass, for dev servers),
   so other sites can't use it as a free proxy. Cookies, the
   Origin and Referer, and Cloudflare's own headers are dropped on the way out; Set-Cookie on the way back. Nothing is
   logged or stored, so the tokens passing through stay between the page and the service. */

export interface Env {
  /** Comma separated origins, e.g. "https://blamy.github.io". */
  ALLOWED_ORIGINS?: string;
  /** Comma separated hostnames the proxy may reach, or "*" for any. */
  ALLOWED_HOSTS?: string;
}

const DROP_REQUEST = /^(host|origin|referer|cookie|connection|keep-alive|proxy-.*|te|trailer|transfer-encoding|upgrade|x-forwarded-.*|x-real-ip|cf-.*)$/i;
const DROP_RESPONSE = /^(set-cookie|set-cookie2|access-control-.*|connection|keep-alive|transfer-encoding)$/i;

const list = (value: string | undefined) => (value ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

export function originAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
  return list(env.ALLOWED_ORIGINS).includes(url.origin.toLowerCase());
}

export function targetAllowed(target: URL, env: Env): boolean {
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false;
  const hosts = list(env.ALLOWED_HOSTS);
  return hosts.includes('*') || hosts.includes(target.hostname.toLowerCase());
}

function cors(origin: string, extra: HeadersInit = {}): Headers {
  const h = new Headers(extra);
  h.set('Access-Control-Allow-Origin', origin);
  h.set('Access-Control-Expose-Headers', '*');
  h.append('Vary', 'Origin');
  return h;
}

function fail(status: number, message: string, origin: string | null, env: Env) {
  const headers = originAllowed(origin, env) && origin ? cors(origin) : new Headers();
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(message, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (!originAllowed(origin, env)) return fail(403, 'Origin not allowed.', origin, env);

    const raw = new URL(request.url).searchParams.get('url');
    let target: URL;
    try { target = new URL(raw ?? ''); } catch { return fail(400, 'Pass the target as ?url=<encoded URL>.', origin, env); }
    if (!targetAllowed(target, env)) {
      return fail(403, /^https?:$/.test(target.protocol) ? `Host not allowed: ${target.hostname}` : 'Only http(s) targets.', origin, env);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors(origin!, {
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE',
          'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '*',
          'Access-Control-Max-Age': '86400',
        }),
      });
    }

    const headers = new Headers();
    request.headers.forEach((value, key) => { if (!DROP_REQUEST.test(key)) headers.set(key, value); });
    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow',
    });

    const out = cors(origin!);
    upstream.headers.forEach((value, key) => { if (!DROP_RESPONSE.test(key) && key.toLowerCase() !== 'vary') out.set(key, value); });
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
  },
};
