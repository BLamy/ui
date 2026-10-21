/* The demo site's DocstreamEnvHost: variables live in a passkey keychain (docstream's createEnvKeychain), encrypted with
   your fingerprint or face. GITHUB_TOKEN, when the keychain doesn't hold it yet, comes from signing in to GitHub with a
   device code (RFC 8628, the GitHub CLI's flow) or a token you paste. GitHub's login endpoints send no CORS headers, so
   the device flow goes through almostnode's public CORS proxy; the token itself is only ever sent to api.github.com.
   Next visit, the gate says "Unlock with Passkey": one biometric prompt opens every example whose variables are saved. */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createEnvKeychain, keychainEnvHost, type DocstreamEnvHost, type EnvKeychain } from '@brett_lamy/docstream';

const PROXY = 'https://almostnode-cors-proxy.langtail.workers.dev/?url=';
const CLIENT_ID = 'Ov23li3di39s0mmKf6HE'; // a public OAuth app with the device flow enabled
const SCOPE = 'read:user repo';
const KEYCHAIN_ID = 'docstream-demo';

const viaProxy = (url: string, body: Record<string, string>, signal: AbortSignal) =>
  fetch(PROXY + encodeURIComponent(url), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  }).then((r) => r.json() as Promise<Record<string, unknown>>);

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

interface Prompt { code: string; uri: string }

/** GitHub's device flow: a code to enter at github.com/login/device, then polling until the user approves. */
async function deviceFlow(signal: AbortSignal, onPrompt: (p: Prompt) => void): Promise<string> {
  const start = await viaProxy('https://github.com/login/device/code', { client_id: CLIENT_ID, scope: SCOPE }, signal);
  if (typeof start.device_code !== 'string') throw new Error('GitHub did not return a device code.');
  onPrompt({ code: String(start.user_code), uri: String(start.verification_uri) });
  let interval = Number(start.interval ?? 5) * 1000;
  const deadline = Date.now() + Number(start.expires_in ?? 900) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval, signal);
    const poll = await viaProxy('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID, device_code: start.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }, signal);
    if (typeof poll.access_token === 'string') return poll.access_token;
    if (poll.error === 'slow_down') interval += 5000;
    else if (poll.error === 'access_denied') throw new Error('You declined the request.');
    else if (poll.error && poll.error !== 'authorization_pending') throw new Error(String(poll.error_description ?? poll.error));
  }
  throw new Error('The code expired. Try again.');
}

type Pending = { resolve: (token: string) => void; reject: (e: Error) => void };

/** The host and the dialog it opens. Render `dialog` once anywhere in the page. */
export function useGithubEnv(): { host: DocstreamEnvHost; keychain: EnvKeychain; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const keychain = useRef(createEnvKeychain({ id: KEYCHAIN_ID, rpName: 'docstream docs', userName: 'Demo tokens' })).current;
  const host = useRef<DocstreamEnvHost>(keychainEnvHost(keychain, {
    signInLabel: 'Sign in with GitHub',
    describe: (name) => (name === 'GITHUB_TOKEN' ? 'GitHub device sign-in, or paste a token' : undefined),
    // Only for what the keychain doesn't hold; what this returns is saved in it.
    obtain: (names) => names.includes('GITHUB_TOKEN')
      ? new Promise<string>((resolve, reject) => setPending({ resolve, reject })).then((token) => ({ GITHUB_TOKEN: token }))
      : Promise.resolve({}),
  })).current;
  const dialog = pending ? <GithubDialog pending={pending} onDone={() => setPending(null)} /> : null;
  return { host, keychain, dialog };
}

function GithubDialog({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [attempt, setAttempt] = useState(0);
  const settled = useRef(false);

  const finish = (token: string | null, why = 'Cancelled.') => {
    if (settled.current) return;
    settled.current = true;
    if (token) pending.resolve(token);
    else pending.reject(new Error(why));
    ref.current?.close();
    onDone();
  };

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    const ctl = new AbortController();
    setPrompt(null);
    setError(null);
    deviceFlow(ctl.signal, setPrompt).then((t) => finish(t), (e: unknown) => {
      if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pasted.trim()) finish(pasted.trim());
  };

  return (
    <dialog ref={ref} className="gh-env-dialog" aria-labelledby="gh-env-title" onCancel={(e) => { e.preventDefault(); finish(null); }}>
      <h2 id="gh-env-title">Sign in with GitHub</h2>
      {error ? (
        <p className="gh-env-error" role="alert">{error} <button type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button></p>
      ) : prompt ? (
        <>
          <p>Enter this code at <a href={prompt.uri} target="_blank" rel="noreferrer">github.com/login/device</a>:</p>
          <div className="gh-env-code">
            <code>{prompt.code}</code>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(prompt.code).catch(() => {}); window.open(prompt.uri, '_blank', 'noopener'); }}>
              Copy &amp; open GitHub
            </button>
          </div>
          <p className="gh-env-wait" aria-live="polite">Waiting for you to approve…</p>
        </>
      ) : (
        <p aria-live="polite">Asking GitHub for a code…</p>
      )}
      <form onSubmit={submit} className="gh-env-paste">
        <label htmlFor="gh-env-token">Or paste a token</label>
        <input id="gh-env-token" type="password" autoComplete="off" spellCheck={false} placeholder="ghp_… or github_pat_…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
        <button type="submit" disabled={!pasted.trim()}>Use token</button>
      </form>
      <button type="button" className="gh-env-cancel" onClick={() => finish(null)}>Cancel</button>
    </dialog>
  );
}
