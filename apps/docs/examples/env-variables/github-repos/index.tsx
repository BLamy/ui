import { useEffect, useState } from 'react'
import { useDocstreamEnv } from '@brett_lamy/docstream'
import { Spinner } from '@/components/ui/spinner'

// The page declares `env: [GITHUB_TOKEN]`, and this file mentions GITHUB_TOKEN, so docstream holds it behind
// "Load from Keychain" until the token is loaded. It is read here and sent only to api.github.com.
type Repo = { full_name: string; html_url: string; pushed_at: string; private: boolean }

export default function GithubRepos() {
  const token = useDocstreamEnv().values.GITHUB_TOKEN
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const ctl = new AbortController()
    fetch('https://api.github.com/user/repos?sort=pushed&per_page=6', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: ctl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`GitHub answered ${r.status}`))))
      .then(setRepos, (e: unknown) => { if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : String(e)) })
    return () => ctl.abort()
  }, [token])

  if (error) return <p className="m-0 p-4 text-footnote text-destructive" role="alert">{error}</p>
  if (!repos) return <div className="grid place-items-center p-8"><Spinner label="Loading repositories" /></div>
  return (
    <ul className="m-0 grid list-none gap-1 p-4">
      {repos.map((r) => (
        <li key={r.full_name} className="flex items-baseline justify-between gap-3 text-subhead">
          <a href={r.html_url} className="truncate text-primary">{r.full_name}</a>
          <span className="shrink-0 text-caption text-muted-foreground">{r.private ? 'Private · ' : ''}{new Date(r.pushed_at).toLocaleDateString()}</span>
        </li>
      ))}
    </ul>
  )
}
