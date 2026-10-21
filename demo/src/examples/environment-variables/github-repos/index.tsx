import { useEffect, useState } from 'react';
import { useDocstreamEnv } from '@brett_lamy/docstream';

// The page declares `env: [GITHUB_TOKEN]`, and this file mentions GITHUB_TOKEN, so it waits behind the gate until the
// site's env host supplies the token. It is sent only to api.github.com.
type Repo = { id: number; full_name: string; html_url: string; description: string | null; private: boolean; pushed_at: string; stargazers_count: number };

export default function GithubRepos() {
  const token = useDocstreamEnv().values.GITHUB_TOKEN;
  const [repos, setRepos] = useState<Repo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const ctl = new AbortController();
    fetch('https://api.github.com/user/repos?sort=pushed&per_page=8', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: ctl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`GitHub answered ${r.status}`))))
      .then(setRepos, (e: unknown) => { if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : String(e)); });
    return () => ctl.abort();
  }, [token]);

  if (error) return <p role="alert" style={{ color: '#d93025', margin: 16 }}>{error}</p>;
  if (!repos) return <p style={{ margin: 16, opacity: 0.6 }}>Loading your repositories…</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 16, display: 'grid', gap: 10, width: '100%', boxSizing: 'border-box' }}>
      {repos.map((r) => (
        <li key={r.id} style={{ display: 'grid', gap: 2 }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <a href={r.html_url} style={{ fontWeight: 600 }}>{r.full_name}</a>
            {r.private ? <small style={{ opacity: 0.6 }}>Private</small> : null}
            <small style={{ marginLeft: 'auto', opacity: 0.6 }}>★ {r.stargazers_count} · {new Date(r.pushed_at).toLocaleDateString()}</small>
          </span>
          {r.description ? <span style={{ fontSize: 13, opacity: 0.75 }}>{r.description}</span> : null}
        </li>
      ))}
    </ul>
  );
}
