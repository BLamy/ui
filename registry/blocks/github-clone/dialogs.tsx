/* Credenzas: the Clone dialog ("Code ▾"), the repository picker, go-to-file, and search. A dialog when wide, a tray on
   phone. The picker is where the data comes from: the keychain's GitHub sign-in (sign in, unlock, or who is signed in and
   how much rate limit is left), any owner/name or github.com URL (which also opens the screen it points at), a search of
   all of GitHub, your repositories, your stars, and the sample. */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { List, ListRow } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import type { KeychainSignIn } from '../apple-passwords/page';
import type { FileNode, RepoSummary } from './data';
import { recentRepos, searchRepos, starredRepos, type GitHub } from './github-api';
import { LabelChip, Oct, StateIcon, ghButton } from './parts';
import { parseGitHubUrl, repoFromInput, type Route } from './route';
import { Loaded, useLoad, useNav, useRepo } from './repo-context';
import { SAMPLE_REPO } from './sample';
import type { RepoSource } from './source';

export function CloneDialog({ open, onClose, compact }: { open: boolean; onClose: () => void; compact: boolean }) {
  const { repo, ref, notify, source } = useRepo();
  const [proto, setProto] = useState('https');
  const url = { https: `https://github.com/${repo.owner}/${repo.name}.git`, ssh: `git@github.com:${repo.owner}/${repo.name}.git`, cli: `gh repo clone ${repo.owner}/${repo.name}` }[proto] ?? '';
  const zip = `https://github.com/${source.full}/archive/refs/heads/${encodeURIComponent(ref || repo.branch)}.zip`;
  const desktop = `x-github-client://openRepo/https://github.com/${source.full}`;
  const link = 'flex min-h-11 items-center gap-3 border-t border-border px-3 py-2 text-subhead text-foreground no-underline first:border-t-0 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary';
  return (
    <Credenza open={open} onClose={onClose} title="Clone" compact={compact}>
      <div className="px-4 pt-2 pb-4">
        <Segmented aria-label="Protocol" value={proto} onChange={setProto}
          options={[{ id: 'https', label: 'HTTPS' }, { id: 'ssh', label: 'SSH' }, { id: 'cli', label: 'GitHub CLI' }]} />
        <div className="mt-3 flex h-9 items-center gap-2 rounded-lg border border-border bg-muted pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-footnote">{url}</code>
          <Button aria-label="Copy URL" className={cn(ghButton(), 'h-7 w-7 px-0')} onPress={() => { void navigator.clipboard?.writeText(url).catch(() => {}); notify('Copied'); }}><Oct name="copy" size={14} /></Button>
        </div>
        <p className="mt-2 mb-3 text-caption text-muted-foreground">
          {proto === 'cli' ? 'Work fast with our official CLI.' : proto === 'ssh' ? 'Use a password-protected SSH key.' : 'Clone using the web URL.'}
        </p>
        {source.live ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <a className={link} href={desktop}><Oct name="desktop" className="text-muted-foreground" />Open with GitHub Desktop</a>
            <a className={link} href={zip} onClick={onClose}><Oct name="zip" className="text-muted-foreground" />Download ZIP</a>
          </div>
        ) : <p className="m-0 text-caption text-muted-foreground">This sample repository isn’t on GitHub, so there’s nothing to download or open in Desktop. Sign in and open a real repository for those.</p>}
      </div>
    </Credenza>
  );
}

/** Choose the repository: `onPick(full)`; a pasted GitHub URL also says which screen. */
export function RepoPicker({ open, onClose, compact, keychain, gh, current, onPick }: {
  open: boolean; onClose: () => void; compact: boolean; keychain: KeychainSignIn | null; gh: GitHub | null; current: RepoSource; onPick: (full: string | null, route?: Route | null) => void;
}) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  useEffect(() => { if (!open) setInput(''); }, [open]);
  const parsed = repoFromInput(input);
  const route = parseGitHubUrl(input)?.route;
  const rate = gh?.rateLimit();
  const row = '[&_[data-slot=list-row-content]]:text-subhead [&_[data-slot=list-row-body]]:min-h-0 [&_[data-slot=list-row-body]]:py-2';
  return (
    <Credenza open={open} onClose={onClose} title="Repository" compact={compact}>
      <div className="grid gap-4 px-4 pt-1 pb-4">
        {/* Signing in opens the keychain's own sheet: this one steps aside first. */}
        <AccountStatus keychain={keychain && { ...keychain, signIn: () => { onClose(); keychain.signIn(); } }} gh={gh} current={current} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (parsed) { onPick(parsed, route); setInput(''); } }}>
          <Input aria-label="Search repositories, or owner/name, or a GitHub URL" placeholder="Search, owner/name, or a github.com URL" autoComplete="off" spellCheck={false}
            value={input} onChange={(e) => setInput(e.target.value)} className="min-w-0 flex-1 font-mono text-footnote" />
          <Button type="submit" className={ghButton(true)} isDisabled={!parsed}>Open</Button>
        </form>
        {input.trim() && !parsed && /^https?:|\/\//.test(input.trim()) ? <p role="alert" className="-mt-2 m-0 text-caption text-(--gh-closed)">That isn’t a github.com repository URL.</p> : null}
        {open && gh ? <RepoLists gh={gh} q={q} current={current.full} onPick={(f) => onPick(f)} row={row} /> : null}
        {current.live && gh || !gh ? null : null}
        {rate && current.live ? (
          <p className="m-0 text-caption text-muted-foreground">
            GitHub API: {rate.remaining.toLocaleString('en-US')} of {rate.limit.toLocaleString('en-US')} requests left this hour
            {rate.resetAt ? `, resets at ${new Date(rate.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.
          </p>
        ) : null}
        <List className="overflow-hidden rounded-xl border border-border">
          <ListRow title={SAMPLE_REPO} subtitle="Sample repository: invented data, works offline, changes stay in this page" accessory="check" checked={!current.live && current.full === SAMPLE_REPO}
            leading={<Oct name="book" className="text-muted-foreground" />} onPress={() => onPick(null)} divider={false} className={row} />
        </List>
      </div>
    </Credenza>
  );
}

function AccountStatus({ keychain, gh, current }: { keychain: KeychainSignIn | null; gh: GitHub | null; current: RepoSource }) {
  const box = 'flex items-start gap-3 rounded-xl border border-border bg-muted px-3 py-2.5';
  if (current.live && gh) {
    return (
      <div className={box}>
        <Oct name="checkFill" className="mt-0.5 text-(--gh-open)" />
        <div className="min-w-0 flex-1 text-footnote">
          <b className="font-semibold">Live from GitHub: {current.full}</b>
          <div className="text-muted-foreground">
            {keychain?.account ? <>Using {keychain.account}’s sign-in from the Passwords keychain.</> : 'Using the token this block was given.'}
          </div>
        </div>
      </div>
    );
  }
  if (keychain?.token) {
    return <div className={cn(box, 'text-footnote')}><Oct name="checkFill" className="mt-0.5 text-(--gh-open)" /><span><b className="font-semibold">Signed in as {keychain.account}.</b> You’re looking at the sample: pick a real repository below.</span></div>;
  }
  if (!keychain) {
    return <div className={cn(box, 'text-footnote text-muted-foreground')}>Showing the sample repository. This block was set up without the keychain.</div>;
  }
  const [title, text, label, act] = keychain.rejected
    ? ['GitHub turned the saved sign-in down', 'It was revoked or expired. Sign in again to read your repositories.', 'Sign in again', keychain.signIn]
    : keychain.locked
      ? ['Your keychain is locked', 'Unlock it with your passkey to use the GitHub sign-in saved in Passwords.', 'Unlock keychain', () => void keychain.unlock().catch(() => {})]
      : ['Showing sample data', 'Sign in with GitHub to browse real repositories. The token is kept in the Passwords keychain, encrypted with your passkey.', 'Sign in with GitHub', keychain.signIn];
  return (
    <div className={cn(box, 'flex-col')}>
      <div className="text-footnote">
        <b className="font-semibold">{title}</b>
        <div className="text-muted-foreground">{text}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className={ghButton(true)} onPress={act}>{keychain.locked && !keychain.rejected ? <Oct name="lock" size={14} /> : null}{label}</Button>
        {keychain.locked && !keychain.rejected ? <Button className={ghButton()} onPress={keychain.signIn}>Sign in with GitHub</Button> : null}
      </div>
    </div>
  );
}

function RepoLists({ gh, q, current, onPick, row }: { gh: GitHub; q: string; current: string; onPick: (full: string) => void; row: string }) {
  const [tab, setTab] = useState<'yours' | 'stars'>('yours');
  const recent = useLoad(`recent:${gh.id}`, () => recentRepos(gh));
  const stars = useLoad(`stars:${gh.id}:${tab}`, () => (tab === 'stars' ? starredRepos(gh) : []));
  const results = useLoad(`search:${gh.id}:${q}`, () => (q && !repoFromInput(q) ? searchRepos(gh, q) : []));
  const rows = (list: RepoSummary[], label: string) => (list.length ? (
    <List className="max-h-[36vh] overflow-auto rounded-xl border border-border" aria-label={label}>
      {list.map((r, i) => (
        <ListRow key={r.full} title={r.full} subtitle={[r.description, r.stars ? `★ ${r.stars}` : null, r.archived ? 'Archived' : null].filter(Boolean).join(' · ') || undefined} accessory="check" checked={r.full.toLowerCase() === current.toLowerCase()}
          leading={<Oct name={r.private ? 'lock' : r.fork ? 'fork' : 'book'} className="text-muted-foreground" />} onPress={() => onPick(r.full)} divider={i < list.length - 1} className={row} />
      ))}
    </List>
  ) : null);
  if (q && !repoFromInput(q)) {
    return (
      <Loaded load={results} pending={<p className="m-0 text-caption text-muted-foreground">Searching GitHub…</p>}>
        {(list) => rows(list, 'Search results') ?? <p className="m-0 text-caption text-muted-foreground">No repositories match “{q}”.</p>}
      </Loaded>
    );
  }
  const list = tab === 'yours' ? recent : stars;
  return (
    <div className="grid gap-2">
      <Segmented aria-label="Which repositories" value={tab} onChange={(v) => setTab(v as 'yours' | 'stars')} options={[{ id: 'yours', label: 'Yours' }, { id: 'stars', label: 'Starred' }]} />
      <Loaded load={list} pending={<p className="m-0 text-caption text-muted-foreground">Loading…</p>}>
        {(l) => rows(l, tab === 'yours' ? 'Your repositories' : 'Starred repositories') ?? <p className="m-0 text-caption text-muted-foreground">{tab === 'yours' ? 'No repositories yet.' : 'Nothing starred yet.'}</p>}
      </Loaded>
    </div>
  );
}

/* ── Go to file ── */

const flatten = (nodes: FileNode[]): FileNode[] => nodes.flatMap((n) => (n.type === 'dir' ? flatten(n.children ?? []) : [n]));
/** Letters in order, closer together scoring better; null when they aren't all there. */
export function fuzzyScore(text: string, q: string): number | null {
  const t = text.toLowerCase();
  let at = -1;
  let score = 0;
  for (const c of q.toLowerCase()) {
    const next = t.indexOf(c, at + 1);
    if (next < 0) return null;
    score += next - at;
    at = next;
  }
  const total = score + (t.length - at);
  // A match inside the file name beats one spread across folders.
  const name = t.slice(t.lastIndexOf('/') + 1);
  let i = -1;
  const inName = [...q.toLowerCase()].every((c) => (i = name.indexOf(c, i + 1)) >= 0);
  return inName ? total - 1000 : total;
}

export function GoToFile({ open, onClose, gitRef, compact }: { open: boolean; onClose: () => void; gitRef: string; compact: boolean }) {
  const { source } = useRepo();
  const nav = useNav();
  const tree = useLoad(`${source.id}:goto-tree:${gitRef}:${open}`, () => (open ? source.tree(gitRef) : []));
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  useEffect(() => { if (open) { setQ(''); setAt(0); } }, [open]);
  const files = useMemo(() => flatten(tree.data ?? []), [tree.data]);
  const hits = useMemo(() => {
    if (!q) return files.slice(0, 50);
    return files.map((f) => ({ f, s: fuzzyScore(f.path, q) })).filter((x) => x.s != null).sort((a, b) => a.s! - b.s!).slice(0, 50).map((x) => x.f);
  }, [files, q]);
  const openFile = (f: FileNode) => { onClose(); nav.go({ s: 'code', ref: gitRef || undefined, path: f.path }); };
  return (
    <Credenza open={open} onClose={onClose} title="Go to file" compact={compact}>
      <div className="grid gap-2 px-4 pt-1 pb-4">
        <Input aria-label="Go to file" data-autofocus placeholder="Type a file name" autoComplete="off" spellCheck={false} value={q}
          onChange={(e) => { setQ(e.target.value); setAt(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((x) => Math.min(x + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAt((x) => Math.max(x - 1, 0)); }
            if (e.key === 'Enter' && hits[at]) { e.preventDefault(); openFile(hits[at]); }
          }} className="font-mono text-footnote" />
        <ul aria-label="Matching files" className="m-0 max-h-[50vh] list-none overflow-auto rounded-xl border border-border p-0">
          {hits.map((f, i) => (
            <li key={f.path} className="border-t border-border first:border-t-0">
              <button type="button" onClick={() => openFile(f)} className={cn('flex min-h-9 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-1.5 text-left font-mono text-caption text-foreground outline-none hover:bg-accent focus-visible:bg-accent group-data-[phone=true]/gh:min-h-11', i === at && 'bg-accent')}>
                <Oct name="file" size={14} className="shrink-0 text-muted-foreground" /><span className="min-w-0 break-all">{f.path}</span>
              </button>
            </li>
          ))}
          {!hits.length ? <li className="px-3 py-6 text-center text-caption text-muted-foreground">{tree.loading ? 'Loading files…' : 'No files match.'}</li> : null}
        </ul>
      </div>
    </Credenza>
  );
}

/* ── Search ── */

export function SearchDialog({ open, onClose, compact, initial }: { open: boolean; onClose: () => void; compact: boolean; initial?: string }) {
  const { source, ui } = useRepo();
  const nav = useNav();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { if (open) { setInput(initial ?? ''); setQ(initial ?? ''); } }, [open, initial]);
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const issues = useLoad(`${source.id}:search-issues:${open}:${q}`, () => (open && q ? source.searchIssues(q, 1) : null));
  const pulls = useLoad(`${source.id}:search-pulls:${open}:${q}`, () => (open && q ? source.searchPulls(q, 1) : null));
  const code = useLoad(`${source.id}:search-code:${open}:${q}`, () => (open && q ? source.searchCode(q) : null));
  const tree = useLoad(`${source.id}:search-tree:${open && !!q}`, () => (open && q ? source.tree('') : []));
  const fileHits = useMemo(() => (q ? flatten(tree.data ?? []).map((f) => ({ f, s: fuzzyScore(f.path, q) })).filter((x) => x.s != null).sort((a, b) => a.s! - b.s!).slice(0, 5).map((x) => x.f) : []), [q, tree.data]);
  const go = (r: Route) => { onClose(); nav.go(r); };
  const hit = 'flex min-h-9 w-full cursor-pointer items-start gap-2 border-0 border-t border-border bg-transparent px-3 py-1.5 text-left text-detail text-foreground outline-none first:border-t-0 hover:bg-accent focus-visible:bg-accent group-data-[phone=true]/gh:min-h-11';
  const sectionTitle = 'mt-3 mb-1 text-caption font-semibold text-muted-foreground first:mt-0';
  const nothing = q && !issues.loading && !pulls.loading && !code.loading && !fileHits.length && !issues.data?.items.length && !pulls.data?.items.length && !code.data?.items.length;
  return (
    <Credenza open={open} onClose={onClose} title={`Search ${source.full}`} compact={compact} className={cn(!compact && 'w-[620px]')}>
      <div className="grid gap-2 px-4 pt-1 pb-4">
        <Input aria-label={`Search ${source.full}`} data-autofocus placeholder="Search code, issues and pull requests" autoComplete="off" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-footnote" />
        <div className="max-h-[56vh] overflow-auto" role="region" aria-label="Search results" aria-live="polite">
          {!q ? <p className="my-4 text-center text-caption text-muted-foreground">Issue and pull request search takes GitHub’s qualifiers: <code className="font-mono">label:bug</code>, <code className="font-mono">author:someone</code>, <code className="font-mono">is:open</code>.</p> : null}
          {fileHits.length ? <h3 className={sectionTitle}>Files</h3> : null}
          {fileHits.length ? <div className="overflow-hidden rounded-md border border-border">{fileHits.map((f) => <button key={f.path} type="button" className={hit} onClick={() => go({ s: 'code', path: f.path })}><Oct name="file" size={14} className="mt-0.5 shrink-0 text-muted-foreground" /><span className="min-w-0 font-mono text-caption break-all">{f.path}</span></button>)}</div> : null}
          {issues.data?.items.length ? <h3 className={sectionTitle}>Issues · {issues.data.total}</h3> : null}
          {issues.data?.items.length ? <div className="overflow-hidden rounded-md border border-border">{issues.data.items.slice(0, 5).map((i) => (
            <button key={i.number} type="button" className={hit} onClick={() => go({ s: 'issue', n: i.number })}>
              <StateIcon state={i.state === 'open' ? 'open' : 'closed'} className="mt-0.5" />
              <span className="min-w-0 flex-1"><span className="font-semibold">{i.title}</span> <span className="text-muted-foreground">#{i.number}</span> {i.labels.slice(0, 2).map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} className="ml-1" />)}</span>
            </button>
          ))}{(issues.data.total ?? 0) > 5 ? <button type="button" className={cn(hit, 'text-primary')} onClick={() => go({ s: 'issues', q: `is:open ${q}` })}>See all issues</button> : null}</div> : null}
          {pulls.data?.items.length ? <h3 className={sectionTitle}>Pull requests · {pulls.data.total}</h3> : null}
          {pulls.data?.items.length ? <div className="overflow-hidden rounded-md border border-border">{pulls.data.items.slice(0, 5).map((p) => (
            <button key={p.number} type="button" className={hit} onClick={() => go({ s: 'pull', n: p.number })}>
              <StateIcon state={p.state === 'merged' ? 'merged' : p.state === 'closed' ? 'prClosed' : p.state === 'draft' ? 'draft' : 'prOpen'} className="mt-0.5" />
              <span className="min-w-0 flex-1"><span className="font-semibold">{p.title}</span> <span className="text-muted-foreground">#{p.number}</span></span>
            </button>
          ))}{(pulls.data.total ?? 0) > 5 ? <button type="button" className={cn(hit, 'text-primary')} onClick={() => go({ s: 'pulls', q: `is:open ${q}` })}>See all pull requests</button> : null}</div> : null}
          {code.data?.items.length ? <h3 className={sectionTitle}>Code · {code.data.total}</h3> : null}
          {code.data?.items.length ? <div className="overflow-hidden rounded-md border border-border">{code.data.items.slice(0, 8).map((c) => (
            <button key={c.path} type="button" className={hit} onClick={() => go({ s: 'code', path: c.path })}>
              <Oct name="code" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="block font-mono text-caption font-semibold break-all">{c.path}</span><span className="block truncate font-mono text-caption2 text-muted-foreground">{c.fragment}</span></span>
            </button>
          ))}</div> : null}
          {code.error ? <p className="mt-3 mb-0 text-caption text-muted-foreground">Code search is unavailable: {code.error instanceof Error ? code.error.message : 'GitHub didn’t answer'}.</p> : null}
          {nothing ? <p className="my-4 text-center text-caption text-muted-foreground">Nothing matches “{q}”.</p> : null}
        </div>
      </div>
    </Credenza>
  );
}
