/* A simulated tailnet — for stories, tests and the "Simulated" docs demo. It is NOT the block's default: <Safari> uses the
   real Tailscale unless you pass this explicitly (`<Safari tailscale={createDemoTailnet().options} />`).
   Four small sites on `demo-tailnet.ts.net`, an exit node, and a pretend public internet that answers only while that exit
   node is chosen, all served by the in-memory fake client (lib/tailscale-fake): no account, no network. The sites are
   written to show what the loader does with a page: a stylesheet and images it must fetch through the tailnet, a script
   and a tracking pixel it must not run or load, a form, a redirect, JSON, a picture and a file. */
import { createFakeTailscaleClient, type FakeTailnetHandler, type FakeTailscale } from '@/lib/tailscale-fake';
import type { TailscaleOptions } from '@/lib/tailscale';

export const TAILNET = 'demo-tailnet.ts.net';
export const HOME = `home.${TAILNET}`;
export const WIKI = `wiki.${TAILNET}`;
export const NOTES = `notes.${TAILNET}`;
export const STATUS = `status.${TAILNET}`;
/** The peer that offers to be an exit node, and a public host that answers only through it. */
export const EXIT_NODE = 'exit-node';
export const EXIT_NODE_ID = `node-${EXIT_NODE}`;
export const PUBLIC_SITE = 'example.com';

const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const svg = (body: string) => new Response(body, { headers: { 'content-type': 'image/svg+xml' } });
const text = (body: string, type: string) => new Response(body, { headers: { 'content-type': type } });

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head>
<body><header><a class="brand" href="http://${HOME}/"><img src="/logo.svg" alt="" width="28" height="28">${TAILNET}</a>
<nav><a href="http://${HOME}/">Home</a><a href="http://${WIKI}/">Wiki</a><a href="http://${NOTES}/">Notes</a><a href="http://${STATUS}/">Status</a></nav></header>
<main>${body}</main></body></html>`;

const STYLE = `
:root{color-scheme:light;--ink:#1c1c1e;--mute:#6c6c70;--line:#e5e5ea;--tint:#0a84ff}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:var(--ink);background:#fff url('/dots.svg')}
header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 24px;background:#fffc;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;color:var(--ink);text-decoration:none}
nav{display:flex;gap:18px}nav a{color:var(--tint);text-decoration:none}
main{max-width:760px;margin:0 auto;padding:32px 24px 64px}
h1{font-size:34px;line-height:1.15;margin:0 0 12px;letter-spacing:-.02em}h2{font-size:21px;margin:28px 0 8px}
p{margin:0 0 14px}.lead{font-size:19px;color:var(--mute)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin:22px 0}
.card{display:block;padding:16px;border:1px solid var(--line);border-radius:14px;background:#fff;color:inherit;text-decoration:none}
.card b{display:block;margin-bottom:4px}.card span{color:var(--mute);font-size:14px}
table{border-collapse:collapse;width:100%;margin:12px 0}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
code{font:14px ui-monospace,SFMono-Regular,Menlo,monospace;background:#f2f2f7;padding:1px 5px;border-radius:5px}
form{display:flex;gap:8px;margin:18px 0}input{flex:1;font:inherit;padding:9px 12px;border:1px solid var(--line);border-radius:10px}
button{font:inherit;padding:9px 16px;border:0;border-radius:10px;background:var(--tint);color:#fff}
.note{padding:12px 14px;border-radius:12px;background:#f2f2f7;margin:14px 0}
`;

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#0a84ff"/><g fill="#fff"><circle cx="8" cy="8" r="2.4" opacity=".4"/><circle cx="14" cy="8" r="2.4"/><circle cx="20" cy="8" r="2.4" opacity=".4"/><circle cx="8" cy="14" r="2.4"/><circle cx="14" cy="14" r="2.4"/><circle cx="20" cy="14" r="2.4"/><circle cx="8" cy="20" r="2.4" opacity=".4"/><circle cx="14" cy="20" r="2.4"/><circle cx="20" cy="20" r="2.4" opacity=".4"/></g></svg>`;
const DOTS = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="2" cy="2" r="1" fill="#e5e5ea"/></svg>`;
const DIAGRAM = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120" width="360" height="120"><rect width="360" height="120" rx="14" fill="#f2f2f7"/><g font-family="sans-serif" font-size="13" text-anchor="middle"><rect x="20" y="34" width="86" height="52" rx="10" fill="#fff" stroke="#c7c7cc"/><text x="63" y="65">your browser</text><rect x="137" y="34" width="86" height="52" rx="10" fill="#0a84ff"/><text x="180" y="65" fill="#fff">Tailscale</text><rect x="254" y="34" width="86" height="52" rx="10" fill="#fff" stroke="#c7c7cc"/><text x="297" y="65">your server</text></g><path d="M106 60h31M223 60h31" stroke="#0a84ff" stroke-width="2"/></svg>`;
const PHOTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ac8fa"/><stop offset="1" stop-color="#ffd60a"/></linearGradient></defs><rect width="320" height="200" fill="url(#s)"/><circle cx="240" cy="64" r="26" fill="#fff" opacity=".85"/><path d="M0 200V150l70-48 60 38 70-70 120 80v50z" fill="#1c1c1e" opacity=".8"/></svg>`;

const home: FakeTailnetHandler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/style.css') return text(STYLE, 'text/css');
  if (url.pathname === '/logo.svg') return svg(LOGO);
  if (url.pathname === '/dots.svg') return svg(DOTS);
  if (url.pathname === '/search') {
    const q = url.searchParams.get('q') ?? '';
    return html(page(`Search: ${q}`, `<h1>Search</h1><p class="lead">You searched this tailnet for <code>${q.replace(/[<>&]/g, '')}</code>.</p><form action="/search" method="get"><input name="q" value="${q.replace(/["<>&]/g, '')}" aria-label="Search"><button>Search</button></form><p>No results: this is a demo tailnet, and the form was sent through it.</p>`));
  }
  if (url.pathname === '/old') return new Response(null, { status: 302, headers: { location: `http://${WIKI}/` } });
  if (url.pathname !== '/') return html(page('Not found', '<h1>Not found</h1><p>There is nothing at this address.</p>'), 404);
  return html(page('Home', `<h1>Welcome home</h1>
<p class="lead">Every page, stylesheet and picture here was fetched through Tailscale.</p>
<div class="cards">
<a class="card" href="http://${WIKI}/"><b>Wiki</b><span>How the tailnet is wired</span></a>
<a class="card" href="http://${NOTES}/"><b>Notes</b><span>Three short notes</span></a>
<a class="card" href="http://${STATUS}/"><b>Status</b><span>JSON, a photo and a download</span></a>
<a class="card" href="/old"><b>An old link</b><span>Redirects to the wiki</span></a>
</div>
<form action="/search" method="get"><input name="q" placeholder="Search this tailnet" aria-label="Search"><button>Search</button></form>
<h2>What this page tried</h2>
<div class="note"><p id="script-ran">A script on this page tried to change this line. It could not run: scripts are switched off.</p>
<script>document.getElementById('script-ran').textContent = 'A script ran.'</script>
<p>It also asked a public tracker for a pixel, <img src="http://tracker.example.com/pixel.gif" alt="" width="1" height="1">, which is not on your tailnet, so nothing was sent.</p></div>`));
};

const wiki: FakeTailnetHandler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/style.css') return text(STYLE, 'text/css');
  if (url.pathname === '/logo.svg') return svg(LOGO);
  if (url.pathname === '/dots.svg') return svg(DOTS);
  if (url.pathname === '/diagram.svg') return svg(DIAGRAM);
  if (url.pathname === '/derp') return html(page('DERP relays', `<h1>DERP relays</h1><p class="lead">Browsers cannot send UDP, so packets travel over Tailscale's relay servers on WebSockets.</p><p><a href="/">Back to the wiki</a></p>`));
  return html(page('Wiki', `<h1>How the tailnet is wired</h1>
<p class="lead">A tailnet is a private network of your devices. This browser is one of them.</p>
<p><img src="/diagram.svg" alt="Your browser reaches your server through Tailscale" width="360" height="120"></p>
<h2>What goes where</h2>
<table><tr><th>Request</th><th>Goes</th></tr><tr><td>The page</td><td>Through your tailnet</td></tr><tr><td>Its stylesheet and images</td><td>Through your tailnet</td></tr><tr><td>Anything outside it</td><td>Nowhere</td></tr></table>
<p>Read about <a href="/derp">DERP relays</a>, or jump to <a href="#end">the end</a>.</p>
${'<p>The relay path adds a little latency but needs no port forwarding and no public address.</p>'.repeat(14)}
<h2 id="end">The end</h2><p>That was the whole page.</p>`));
};

const notes: FakeTailnetHandler = async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/style.css') return text(STYLE, 'text/css');
  if (url.pathname === '/logo.svg') return svg(LOGO);
  if (url.pathname === '/dots.svg') return svg(DOTS);
  if (url.pathname === '/new' && req.method === 'POST') {
    const form = new URLSearchParams(await req.text());
    return html(page('Note saved', `<h1>Saved</h1><p class="lead">The form was sent with POST through your tailnet.</p><div class="note"><b>${(form.get('title') ?? '').replace(/[<>&]/g, '')}</b></div><p><a href="/">Back to the notes</a></p>`));
  }
  const match = /^\/n\/(\d)$/.exec(url.pathname);
  const list = [['Renew the TLS certificate', 'Before the 24th.'], ['Buy milk', 'Oat, two litres.'], ['Backups', 'Check the NAS disk health.']];
  if (match && list[Number(match[1]) - 1]) {
    const [title, body] = list[Number(match[1]) - 1];
    return html(page(title, `<h1>${title}</h1><p class="lead">${body}</p><p><a href="/">All notes</a></p>`));
  }
  return html(page('Notes', `<h1>Notes</h1><div class="cards">${list.map(([t, b], i) => `<a class="card" href="/n/${i + 1}"><b>${t}</b><span>${b}</span></a>`).join('')}</div>
<h2>New note</h2><form action="/new" method="post"><input name="title" placeholder="Title" aria-label="Title"><button>Save</button></form>`));
};

const status: FakeTailnetHandler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/api/status.json') return text(JSON.stringify({ ok: true, node: 'status', tailnet: TAILNET, uptimeDays: 41 }, null, 2), 'application/json');
  if (url.pathname === '/photo.svg') return svg(PHOTO);
  if (url.pathname === '/backup.bin') return new Response(new Uint8Array(2048), { headers: { 'content-type': 'application/octet-stream' } });
  if (url.pathname === '/style.css') return text(STYLE, 'text/css');
  if (url.pathname === '/logo.svg') return svg(LOGO);
  if (url.pathname === '/dots.svg') return svg(DOTS);
  return html(page('Status', `<h1>Status</h1><p class="lead">Everything is up.</p><ul><li><a href="/api/status.json">status.json</a> (JSON, shown as text)</li><li><a href="/photo.svg">photo.svg</a> (an image, shown alone)</li><li><a href="/backup.bin">backup.bin</a> (a file Safari cannot display)</li></ul>`));
};

const publicPage = (title: string, body: string) => html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>body{font:17px/1.55 -apple-system,system-ui,sans-serif;max-width:640px;margin:56px auto;padding:0 22px;color:#1c1c1e}h1{font-size:32px}a{color:#0a84ff}</style></head><body>${body}</body></html>`);

/** The pretend public internet: reached only through the exit node. */
const publicSite: FakeTailnetHandler = (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/more') return publicPage('More information', '<h1>More information</h1><p>A second page on the pretend internet, reached through the exit node too.</p><p><a href="/">Back</a></p>');
  return publicPage('Example Domain', `<h1>Example Domain</h1><p>This domain is for illustrative examples. You are reading it on the simulated public internet, through the exit node.</p><p><a href="/more">More information…</a></p>`);
};

export interface DemoTailnet {
  fake: FakeTailscale;
  options: TailscaleOptions;
}

export interface DemoTailnetOptions {
  /** The exit node: `online` (default), `offline` (listed, asleep) or `none` (the tailnet offers no exit node). */
  exitNode?: 'online' | 'offline' | 'none';
}

/** A fresh simulated tailnet, and the controller options that use it. */
export function createDemoTailnet({ exitNode = 'online' }: DemoTailnetOptions = {}): DemoTailnet {
  const fake = createFakeTailscaleClient({
    tailnet: TAILNET,
    approveAfterMs: 900,
    routes: { [HOME]: home, [WIKI]: wiki, [NOTES]: notes, [STATUS]: status },
    exitNodes: exitNode === 'online' ? [EXIT_NODE] : [],
    offlineExitNodes: exitNode === 'offline' ? [EXIT_NODE] : [],
    internet: { [PUBLIC_SITE]: publicSite },
  });
  return { fake, options: { client: fake.client, popup: false, lockName: false, hostname: 'safari' } };
}
