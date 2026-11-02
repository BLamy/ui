/* Code tab: branch and tag switcher, file table with each entry's last commit, README and About; folders and files with
   GitHub's file-tree sidebar and a viewer that does Preview / Code / Blame, Raw, Download, History, Edit and Delete, with
   lines you can link to. The tree is one recursive listing per ref; the file table's last commits are one GraphQL query
   per folder. Files that aren't text show as images or say what they are. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SyntaxHighlightingCopyButton } from '@/components/ui/syntax-highlighting';
import { cn } from '@/lib/utils';
import type { BlameRange, FileNode } from './data';
import { GhLink, UserLink } from './links';
import { Md } from './markdown';
import { Box, CodeView, Counter, FileTree, Oct, ghButton, type OctName } from './parts';
import { Menu } from './pickers';
import { RefPicker } from './refs';
import { Loaded, Pending, useCan, useCopy, useLoad, useNav, useRepo } from './repo-context';

/** Files GitHub's own viewer won't show inline either. */
const TOO_LARGE = 1_000_000;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|ico|bmp)$/i;

function useTree(ref: string) {
  const { source } = useRepo();
  return useLoad(`${source.id}:tree:${ref}`, () => source.tree(ref));
}

/** A node by path in a tree ('' is the root). */
export function nodeAt(nodes: FileNode[], path: string, rootName = ''): FileNode | undefined {
  if (!path) return { name: rootName, path: '', type: 'dir', commit: '', when: '', children: nodes };
  let level: FileNode[] | undefined = nodes;
  let hit: FileNode | undefined;
  for (const part of path.split('/')) {
    hit = level?.find((n) => n.name === part);
    level = hit?.children;
  }
  return hit;
}

export function CodeHome({ gitRef }: { gitRef: string }) {
  const { source, repo, ui } = useRepo();
  const tree = useTree(gitRef);
  const readme = useLoad(`${source.id}:readme:${gitRef}`, () => source.readme(gitRef));
  if (repo.empty) return <EmptyRepo />;
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <h1 className="sr-only">{repo.owner}/{repo.name}</h1>
        <RecentlyPushed />
        <CodeToolbar gitRef={gitRef} />
        <Loaded load={tree} className="min-h-40">{(nodes) => <FileTable nodes={nodes} gitRef={gitRef} />}</Loaded>
        <Loaded load={readme} pending={<Pending label="Loading the README…" />}>
          {(md) => md == null ? <NoReadme gitRef={gitRef} /> : (
            <Box header={
              <div className="-my-2 flex items-center gap-4 self-stretch">
                <span id="readme" className="relative flex h-full items-center gap-2 font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-(--gh-tab)">
                  <Oct name="book" className="text-muted-foreground" />README
                </span>
                {repo.license ? <LicenseLink /> : null}
              </div>
            }>
              <Readme markdown={md} gitRef={gitRef} dir="" />
            </Box>
          )}
        </Loaded>
        {!ui.wide ? <AboutSections /> : null}
      </div>
      {ui.wide ? <aside aria-label="About this repository" className="w-[296px] shrink-0 text-detail"><AboutSections /></aside> : null}
    </div>
  );
}

function LicenseLink() {
  const { repo, source } = useRepo();
  const tree = useLoad(`${source.id}:tree:`, () => source.tree('')).data ?? [];
  const file = tree.find((n) => n.type === 'file' && /^(licen[cs]e|copying)(\.|$)/i.test(n.name));
  const body = <><Oct name="law" />{repo.license}</>;
  return file
    ? <GhLink to={{ s: 'code', path: file.path }} className="flex items-center gap-2 text-muted-foreground no-underline hover:text-primary">{body}</GhLink>
    : <span className="flex items-center gap-2 text-muted-foreground">{body}</span>;
}

function NoReadme({ gitRef }: { gitRef: string }) {
  const can = useCan();
  const nav = useNav();
  const { repo } = useRepo();
  if (!can.push) return null;
  return (
    <Box className="px-6 py-8 text-center">
      <p className="mt-0 mb-3 text-muted-foreground">Help people interested in this repository understand your project by adding a README.</p>
      <Button className={ghButton(true)} onPress={() => nav.go({ s: 'new-file', ref: gitRef, name: 'README.md', content: `# ${repo.name}\n` })}>Add a README</Button>
    </Box>
  );
}

/** Nothing committed yet: how to start, for those who can. */
function EmptyRepo() {
  const { repo, ui } = useRepo();
  const copy = useCopy();
  const can = useCan();
  const nav = useNav();
  const clone = `https://github.com/${repo.owner}/${repo.name}.git`;
  const script = `echo "# ${repo.name}" >> README.md\ngit init\ngit add README.md\ngit commit -m "first commit"\ngit branch -M main\ngit remote add origin ${clone}\ngit push -u origin main`;
  return (
    <Box className={cn('p-6', ui.phone && 'border-0 p-0')}>
      <h2 className="mt-0 mb-1 text-title font-semibold">This repository is empty</h2>
      {can.push ? (
        <>
          <p className="mt-0 mb-3 text-muted-foreground">Create the first file here, or push from your machine.</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button className={ghButton(true)} onPress={() => nav.go({ s: 'new-file', name: 'README.md', content: `# ${repo.name}\n`, message: 'Initial commit' })}><Oct name="fileAdd" />Create a README</Button>
            <Button className={ghButton()} onPress={() => nav.go({ s: 'new-file' })}>Create a new file</Button>
          </div>
          <div className="relative">
            <pre className="m-0 overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-caption leading-5" tabIndex={0}>{script}</pre>
            <Button aria-label="Copy commands" className={cn(ghButton(), 'absolute top-2 right-2 h-7 w-7 px-0')} onPress={() => void copy(script, 'Commands copied')}><Oct name="copy" size={14} /></Button>
          </div>
        </>
      ) : <p className="m-0 text-muted-foreground">Nothing has been pushed yet.</p>}
    </Box>
  );
}

/** "feat/x had recent pushes": a shortcut to opening the pull request. */
function RecentlyPushed() {
  const { source, repo, viewer } = useRepo();
  const can = useCan();
  const refs = useLoad(`${source.id}:recent-push:${can.push}:${viewer?.login ?? ''}`, () => (can.push && viewer ? source.branches(1) : null)).data;
  const candidate = refs?.items.find((b) => b.name !== repo.branch && !b.pull && (b.ahead ?? 0) > 0 && b.commit?.author.login === viewer?.login);
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!candidate || dismissed === candidate.name) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-(--gh-attention)/40 bg-(--gh-attention)/10 px-3 py-2">
      <Oct name="branch" className="text-muted-foreground" />
      <span className="min-w-0 flex-1"><b className="font-mono font-semibold">{candidate.name}</b> had recent pushes {candidate.commit?.when}</span>
      <GhLink to={{ s: 'compare', head: candidate.name, create: true }} className={cn(ghButton(true), 'no-underline')}>Compare &amp; pull request</GhLink>
      <Button aria-label="Dismiss" className={cn(ghButton(), 'w-8 px-0')} onPress={() => setDismissed(candidate.name)}><Oct name="x" size={14} /></Button>
    </div>
  );
}

export function Readme({ markdown, dir, gitRef }: { markdown: string; dir: string; gitRef: string }) {
  const { ui } = useRepo();
  return <Md markdown={markdown} dir={dir} gitRef={gitRef} className={cn('text-callout leading-[1.5] [&_table]:text-detail', ui.phone ? 'px-4 py-5' : 'px-8 py-6')} />;
}

export function CodeToolbar({ gitRef, dir = '' }: { gitRef: string; dir?: string }) {
  const { repo, ui, source } = useRepo();
  const nav = useNav();
  const can = useCan();
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const onBranch = !gitRef || gitRef === repo.branch || !names || names.branches.includes(gitRef);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RefPicker value={gitRef} path={dir} />
      {!ui.phone ? (
        <>
          <GhLink to={{ s: 'branches' }} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground no-underline hover:text-primary"><Oct name="branch" /><b className="text-foreground">{repo.branchCount}</b> Branch{repo.branchCount === 1 ? '' : 'es'}</GhLink>
          <GhLink to={{ s: 'tags' }} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground no-underline hover:text-primary"><Oct name="tag" /><b className="text-foreground">{repo.tagCount}</b> Tag{repo.tagCount === 1 ? '' : 's'}</GhLink>
        </>
      ) : null}
      {repo.parent && can.push ? (
        <Button className={ghButton()} onPress={() => nav.openRepo(repo.parent!, { s: 'compare', head: `${repo.owner}:${gitRef || repo.branch}`, create: true })}><Oct name="pr" />Contribute</Button>
      ) : null}
      <span className="flex-1" />
      <Button className={cn(ghButton(), ui.wide ? 'w-[200px] justify-start text-muted-foreground' : 'w-8 px-0')} aria-label="Go to file" onPress={nav.goToFile}>
        <Oct name="search" />{ui.wide ? <><span className="flex-1 text-left">Go to file</span><kbd className="rounded border border-border px-1 font-mono text-caption2">t</kbd></> : null}
      </Button>
      {can.push && onBranch ? (
        <Menu label="Add file" trigger={<><Oct name="plus" />{!ui.phone ? 'Add file' : null}<Oct name="chevDown" size={12} /></>} entries={[
          { id: 'new', label: 'Create new file', icon: <Oct name="fileAdd" size={14} />, onAction: () => nav.go({ s: 'new-file', ref: gitRef, dir }) },
          { id: 'upload', label: 'Upload files', icon: <Oct name="upload" size={14} />, onAction: () => nav.go({ s: 'upload', ref: gitRef, dir }) },
          { id: 'workflow', label: 'New workflow', icon: <Oct name="play" size={14} />, onAction: () => nav.go({ s: 'new-file', ref: gitRef, dir: '.github/workflows', name: 'ci.yml', content: 'name: CI\non:\n  push:\n    branches: [main]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n', message: 'Add a workflow' }) },
        ]} />
      ) : null}
      <Button aria-label="Clone or download" className={ghButton(true)} onPress={nav.clone}><Oct name="code" />{!ui.phone ? 'Code' : null}<Oct name="chevDown" size={12} /></Button>
    </div>
  );
}

/** The last commit touching `path` ('' for the repository) on the ref being browsed. */
export function LastCommit({ path = '', gitRef }: { path?: string; gitRef: string }) {
  const { source, repo, ui } = useRepo();
  const c = useLoad(`${source.id}:last:${gitRef}:${path}`, () => source.lastCommit(path, gitRef)).data;
  // The count GitHub keeps cheap is the default branch's; another ref says plain "Commits" rather than a wrong number.
  const commitsLabel = path ? 'History' : gitRef && gitRef !== repo.branch ? 'Commits' : `${repo.commitCount} Commit${repo.commitCount === '1' ? '' : 's'}`;
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      {c ? (
        <>
          <UserLink user={c.author} className="shrink-0"><Avatar c={c.author} src={c.author.avatar} size={24} /></UserLink>
          <UserLink user={c.author} className="shrink-0 font-semibold text-foreground" />
          <GhLink to={{ s: 'commit', sha: c.fullSha ?? c.sha }} className="min-w-0 truncate text-muted-foreground no-underline hover:text-primary hover:underline">{c.message}</GhLink>
        </>
      ) : <span className="h-6" />}
      <span className="flex-1" />
      {c && !ui.phone ? (
        <span className="shrink-0 font-mono text-caption text-muted-foreground">
          <GhLink to={{ s: 'commit', sha: c.fullSha ?? c.sha }} className="text-muted-foreground no-underline hover:text-primary">{c.sha}</GhLink> · <span title={c.at ? new Date(c.at).toLocaleString() : undefined}>{c.when}</span>
        </span>
      ) : null}
      <GhLink to={{ s: 'commits', ref: gitRef || undefined, path: path || undefined }} aria-label={commitsLabel} className="flex shrink-0 items-center gap-1.5 font-semibold text-foreground no-underline hover:text-primary group-data-[phone=true]/gh:min-h-11"><Oct name="history" className="text-muted-foreground" />{ui.phone ? '' : commitsLabel}</GhLink>
    </div>
  );
}

export function FileTable({ nodes, gitRef, parent, path = '' }: { nodes: FileNode[]; gitRef: string; parent?: string; path?: string }) {
  const { source, ui } = useRepo();
  const sorted = useMemo(() => [...nodes].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)), [nodes]);
  const paths = sorted.map((n) => n.path);
  const last = useLoad(`${source.id}:last-many:${gitRef}:${path}:${paths.length}`, () => source.lastCommits(paths, gitRef)).data ?? {};
  return (
    <Box header={<LastCommit path={path} gitRef={gitRef} />}>
      {parent != null ? (
        <FileRow icon={<Oct name="folder" className="text-(--gh-folder)" />} name=".." to={{ s: 'code', ref: gitRef || undefined, path: parent || undefined }} label="Parent directory" />
      ) : null}
      {sorted.map((n) => {
        const c = last[n.path];
        return (
          <FileRow key={n.path} name={n.name} commit={c?.message} commitSha={c?.fullSha} when={ui.phone ? undefined : c?.when} to={{ s: 'code', ref: gitRef || undefined, path: n.path }}
            label={`${n.type === 'dir' ? 'Folder' : 'File'} ${n.name}`}
            icon={n.type === 'dir' ? <Oct name="folder" className="text-(--gh-folder)" /> : <Oct name="file" className="text-muted-foreground" />} />
        );
      })}
      {!sorted.length ? <div className="px-4 py-8 text-center text-muted-foreground">This folder is empty.</div> : null}
    </Box>
  );
}

export function FileRow({ icon, name, commit, commitSha, when, to, label }: { icon: ReactNode; name: string; commit?: string; commitSha?: string; when?: string; to: Parameters<typeof GhLink>[0]['to']; label?: string }) {
  const { ui } = useRepo();
  return (
    <div className="relative flex min-h-10 items-center gap-3 border-t border-border px-4 first:border-t-0 hover:bg-muted group-data-[phone=true]/gh:min-h-12">
      {icon}
      <GhLink to={to} aria-label={label} className={cn('min-w-0 truncate text-detail text-foreground no-underline hover:text-primary hover:underline group-data-[phone=true]/gh:after:absolute group-data-[phone=true]/gh:after:inset-0', ui.phone ? 'flex-1' : 'w-[34%] shrink-0')}>{name}</GhLink>
      {!ui.phone ? (commit && commitSha ? <GhLink to={{ s: 'commit', sha: commitSha }} className="min-w-0 flex-1 truncate text-muted-foreground no-underline hover:text-primary hover:underline">{commit}</GhLink> : <span className="min-w-0 flex-1" />) : null}
      {when ? <span className="shrink-0 text-right text-muted-foreground">{when}</span> : null}
    </div>
  );
}

function AboutRow({ icon, children, to }: { icon: OctName; children: ReactNode; to?: Parameters<typeof GhLink>[0]['to'] }) {
  const inner = <><Oct name={icon} className="shrink-0" />{children}</>;
  return <li>{to ? <GhLink to={to} className="flex items-center gap-2 text-muted-foreground no-underline hover:text-primary group-data-[phone=true]/gh:min-h-11">{inner}</GhLink> : <span className="flex items-center gap-2">{inner}</span>}</li>;
}

export function AboutSections() {
  const { repo, source } = useRepo();
  const nav = useNav();
  const can = useCan();
  const section = 'border-b border-border py-6 first:pt-0 last:border-0';
  const hrefHome = repo.homepage ? (/^https?:/.test(repo.homepage) ? repo.homepage : `https://${repo.homepage}`) : '';
  const tree = useLoad(`${source.id}:tree:`, () => source.tree('')).data ?? [];
  const license = tree.find((n) => n.type === 'file' && /^(licen[cs]e|copying)(\.|$)/i.test(n.name));
  return (
    <>
      <div className={section}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-callout font-semibold">About</h2>
          {can.admin ? <Button aria-label="Edit repository details" className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-primary group-data-[phone=true]/gh:size-11" onPress={() => nav.go({ s: 'settings' })}><Oct name="gear" /></Button> : null}
        </div>
        <p className="m-0 text-callout leading-6">{repo.description || <span className="text-muted-foreground italic">No description, website, or topics provided.</span>}</p>
        {repo.homepage ? <p className="my-4 flex items-center gap-2 font-semibold"><Oct name="link" className="text-muted-foreground" /><a href={hrefHome} target="_blank" rel="noreferrer" className="text-primary no-underline hover:underline">{repo.homepage.replace(/^https?:\/\//, '')}</a></p> : null}
        {repo.topics.length ? (
          <div className={cn('flex flex-wrap gap-1.5', !repo.homepage && 'mt-4')}>
            {repo.topics.map((t) => (
              <a key={t} href={`https://github.com/topics/${encodeURIComponent(t)}`} target="_blank" rel="noreferrer" className="rounded-full bg-primary/10 px-2.5 py-[3px] text-caption leading-[18px] font-medium text-primary no-underline hover:bg-primary/20">{t}</a>
            ))}
          </div>
        ) : null}
        <ul className="mt-4 mb-0 list-none space-y-2 p-0 text-muted-foreground">
          <AboutRow icon="book" to={{ s: 'code' }}>Readme</AboutRow>
          {repo.license ? <AboutRow icon="law" to={license ? { s: 'code', path: license.path } : undefined}>{repo.license}</AboutRow> : null}
          <AboutRow icon="pulse" to={{ s: 'insights', page: 'pulse' }}>Activity</AboutRow>
          <AboutRow icon="star" to={{ s: 'people', kind: 'stargazers' }}>{repo.stars} stars</AboutRow>
          <AboutRow icon="eye" to={{ s: 'people', kind: 'watchers' }}>{repo.watchers} watching</AboutRow>
          <AboutRow icon="fork" to={{ s: 'insights', page: 'forks' }}>{repo.forks} forks</AboutRow>
        </ul>
      </div>
      {repo.release ? (
        <div className={section}>
          <h2 className="mt-0 mb-3 flex items-center gap-2 text-callout font-semibold"><GhLink to={{ s: 'releases' }} className="text-foreground no-underline hover:text-primary">Releases</GhLink> <Counter>{repo.release.count}</Counter></h2>
          <div className="flex gap-2">
            <Oct name="tag" className="mt-0.5 text-(--gh-open)" />
            <div>
              <div className="flex items-center gap-2"><GhLink to={{ s: 'release', tag: repo.release.tag }} className="font-semibold text-foreground no-underline hover:text-primary">{repo.release.tag}</GhLink>
                <span className="rounded-full border border-(--gh-open) px-2 text-caption leading-[18px] font-medium text-(--gh-open)">Latest</span></div>
              <div className="text-caption text-muted-foreground">{repo.release.when}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className={section}>
          <h2 className="mt-0 mb-2 text-callout font-semibold">Releases</h2>
          <p className="m-0 text-caption text-muted-foreground">No releases published. {can.push ? <GhLink to={{ s: 'new-release' }}>Create a new release</GhLink> : null}</p>
        </div>
      )}
      {repo.contributors.length ? (
        <div className={section}>
          <h2 className="mt-0 mb-3 flex items-center gap-2 text-callout font-semibold"><GhLink to={{ s: 'insights', page: 'contributors' }} className="text-foreground no-underline hover:text-primary">Contributors</GhLink> <Counter>{repo.contributorCount}</Counter></h2>
          <div className="flex flex-wrap gap-1">{repo.contributors.map((u) => <UserLink key={u.login} user={u}><Avatar c={u} src={u.avatar} size={32} /><span className="sr-only">{u.login}</span></UserLink>)}</div>
        </div>
      ) : null}
      {repo.languages.length ? (
        <div className={section}>
          <h2 className="mt-0 mb-3 text-callout font-semibold">Languages</h2>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {repo.languages.map((l) => <span key={l.name} style={{ width: l.pct + '%', background: l.color }} />)}
          </div>
          <ul className="mt-3 mb-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-caption">
            {repo.languages.map((l) => (
              <li key={l.name} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: l.color }} /><b className="font-semibold">{l.name}</b><span className="text-muted-foreground">{l.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** A folder listing or a file viewer, with GitHub's file-tree sidebar at wide widths. */
export function PathView({ path, gitRef, line, lineEnd, blame }: { path: string; gitRef: string; line?: number; lineEnd?: number; blame?: boolean }) {
  const { repo, ui, source } = useRepo();
  const copy = useCopy();
  const nav = useNav();
  const tree = useTree(gitRef);
  const truncated = useLoad(`${source.id}:truncated:${gitRef}`, () => source.treeTruncated(gitRef)).data;
  const parts = path.split('/');
  const crumbs = (
    <nav aria-label="Path" className="flex min-w-0 flex-wrap items-center gap-1 text-callout">
      <GhLink to={{ s: 'code', ref: gitRef || undefined }} className="font-semibold text-primary no-underline hover:underline">{repo.name}</GhLink>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-tertiary-foreground">/</span>
          {i === parts.length - 1 ? <h1 className="m-0 text-callout font-semibold break-all">{p}</h1> : <GhLink to={{ s: 'code', ref: gitRef || undefined, path: parts.slice(0, i + 1).join('/') }} className="text-primary no-underline hover:underline">{p}</GhLink>}
        </span>
      ))}
      <Button aria-label={`Copy path ${path}`} className="ml-1 grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-primary group-data-[phone=true]/gh:size-11"
        onPress={() => void copy(path, 'Path copied')}><Oct name="copy" size={14} /></Button>
    </nav>
  );
  return (
    <Loaded load={tree} className={cn(ui.phone && 'm-4')}>
      {(nodes) => {
        const node = nodeAt(nodes, path, repo.name);
        return (
          <div className={cn('flex gap-6', ui.phone && 'px-4 py-4')}>
            {ui.wide ? (
              <aside aria-label="Files" className="w-[280px] shrink-0 border-r border-border pr-4">
                <div className="mb-3 flex items-center gap-2">
                  <Oct name="sidebar" className="text-muted-foreground" /><b className="text-callout font-semibold">Files</b>
                </div>
                <Button className={cn(ghButton(), 'mb-3 w-full justify-start text-muted-foreground')} onPress={nav.goToFile}><Oct name="search" /><span className="flex-1 text-left">Go to file</span><kbd className="rounded border border-border px-1 font-mono text-caption2">t</kbd></Button>
                <FileTree nodes={nodes} selected={path} onSelect={(n) => nav.go({ s: 'code', ref: gitRef || undefined, path: n.path })} />
              </aside>
            ) : null}
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2"><RefPicker value={gitRef} path={path} />{crumbs}</div>
              {truncated ? <p role="status" className="m-0 rounded-md border border-border bg-muted px-3 py-2 text-caption text-muted-foreground">This repository is too big for GitHub to list at once, so the file tree is partial. Folders still open one at a time.</p> : null}
              {!node ? (
                truncated ? <AskedDirectly path={path} gitRef={gitRef} parts={parts} /> : (
                <Box className="px-6 py-12 text-center text-muted-foreground" role="alert">
                  <p className="mt-0 mb-3"><b className="font-semibold text-foreground">{path}</b> isn’t on {gitRef || repo.branch}.</p>
                  <GhLink to={{ s: 'code', ref: gitRef || undefined }} className={cn(ghButton(), 'no-underline')}>Go to the top of this branch</GhLink>
                </Box>
                )
              ) : node.special ? <SpecialEntry node={node} gitRef={gitRef} />
              : node.type === 'dir' ? (
                <>
                  <FolderActions path={path} gitRef={gitRef} />
                  <FileTable nodes={node.children ?? []} parent={parts.slice(0, -1).join('/')} path={path} gitRef={gitRef} />
                  <FolderReadme node={node} gitRef={gitRef} />
                </>
              ) : (
                <>
                  <Box className="px-4 py-3"><LastCommit path={path} gitRef={gitRef} /></Box>
                  <FileViewer node={node} gitRef={gitRef} line={line} lineEnd={lineEnd} blame={blame} />
                </>
              )}
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}

/** Past the end of a truncated tree: ask GitHub about this one path. */
function AskedDirectly({ path, gitRef, parts }: { path: string; gitRef: string; parts: string[] }) {
  const { source, repo } = useRepo();
  const info = useLoad(`${source.id}:path-info:${gitRef}:${path}`, () => source.pathInfo(path, gitRef));
  return (
    <Loaded load={info}>
      {(node) => !node ? (
        <Box className="px-6 py-12 text-center text-muted-foreground" role="alert"><b className="font-semibold text-foreground">{path}</b> isn’t on {gitRef || repo.branch}.</Box>
      ) : node.special ? <SpecialEntry node={node} gitRef={gitRef} />
      : node.type === 'dir' ? <FileTable nodes={node.children ?? []} parent={parts.slice(0, -1).join('/')} path={path} gitRef={gitRef} />
      : <FileViewer node={node} gitRef={gitRef} />}
    </Loaded>
  );
}

/** A submodule points at another repository's commit; a symlink at another path. Neither is a file to show. */
function SpecialEntry({ node, gitRef }: { node: FileNode; gitRef: string }) {
  const { source } = useRepo();
  const target = useLoad(`${source.id}:link:${gitRef}:${node.path}`, () => (node.special === 'symlink' ? source.file(node.path, gitRef) : null)).data;
  const resolved = target ? [...node.path.split('/').slice(0, -1), ...target.trim().split('/')].reduce<string[]>((all, p) => (p === '..' ? all.slice(0, -1) : p === '.' ? all : [...all, p]), []).join('/') : '';
  return (
    <Box className="px-6 py-10 text-center">
      <Oct name={node.special === 'submodule' ? 'commit' : 'link'} size={24} className="text-muted-foreground" />
      {node.special === 'submodule' ? (
        <>
          <h2 className="mt-3 mb-1 text-title font-semibold">{node.name} is a submodule</h2>
          <p className="m-0 text-muted-foreground">It points at commit <code className="font-mono text-caption">{node.objectSha?.slice(0, 7) ?? 'unknown'}</code> of another repository. Its address is in <GhLink to={{ s: 'code', ref: gitRef || undefined, path: '.gitmodules' }}>.gitmodules</GhLink>.</p>
        </>
      ) : (
        <>
          <h2 className="mt-3 mb-1 text-title font-semibold">{node.name} is a symbolic link</h2>
          {target ? <p className="m-0 text-muted-foreground">It points to <GhLink to={{ s: 'code', ref: gitRef || undefined, path: resolved }} className="font-mono text-caption text-primary underline">{target.trim()}</GhLink>.</p> : null}
        </>
      )}
    </Box>
  );
}

function FolderActions({ path, gitRef }: { path: string; gitRef: string }) {
  const { source, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  if (!can.push || (gitRef && gitRef !== repo.branch && names && !names.branches.includes(gitRef))) return null;
  return <div className="flex justify-end"><Button className={ghButton()} onPress={() => nav.go({ s: 'new-file', ref: gitRef, dir: path })}><Oct name="plus" />Add file here</Button></div>;
}

function FolderReadme({ node, gitRef }: { node: FileNode; gitRef: string }) {
  const { source } = useRepo();
  const child = node.children?.find((n) => n.type === 'file' && /^readme(\.md|\.markdown)?$/i.test(n.name));
  const text = useLoad(`${source.id}:folder-readme:${gitRef}:${child?.path ?? ''}`, () => (child ? source.file(child.path, gitRef) : null)).data;
  if (!child || text == null) return null;
  return <Box header={<span className="flex items-center gap-2 font-semibold"><Oct name="book" className="text-muted-foreground" />{child.name}</span>}><Readme markdown={text} dir={node.path} gitRef={gitRef} /></Box>;
}

type FileMode = 'preview' | 'code' | 'blame';

export function FileViewer({ node, gitRef, line, lineEnd, blame }: { node: FileNode; gitRef: string; line?: number; lineEnd?: number; blame?: boolean }) {
  const { source, repo, ui, notify } = useRepo();
  const copy = useCopy();
  const nav = useNav();
  const can = useCan();
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const last = useLoad(`${source.id}:last:${gitRef}:${node.path}`, () => source.lastCommit(node.path, gitRef)).data;
  const onBranch = !gitRef || gitRef === repo.branch || !names || names.branches.includes(gitRef);
  const tooLarge = (node.size ?? 0) > TOO_LARGE;
  const isImage = IMAGE.test(node.name);
  const file = useLoad<string | null>(`${source.id}:file:${gitRef}:${node.path}:${tooLarge || isImage}`, () => (tooLarge || isImage ? null : source.file(node.path, gitRef)));
  const isMd = /\.(md|markdown|mdx)$/i.test(node.name);
  const [modeState, setMode] = useState<FileMode>(isMd ? 'preview' : 'code');
  const mode: FileMode = blame ? 'blame' : modeState === 'blame' ? (isMd ? 'preview' : 'code') : modeState;
  const code = file.data ?? '';
  const lines = code.replace(/\n$/, '').split('\n').length;
  const encodedRef = encodeURIComponent(gitRef || repo.branch);
  const rawPath = node.path.split('/').map(encodeURIComponent).join('/');
  const blobUrl = `https://github.com/${source.full}/raw/${encodedRef}/${rawPath}`;
  const setView = (m: FileMode) => {
    if (m === 'blame') nav.go({ s: 'code', ref: gitRef || undefined, path: node.path, blame: true }, { replace: true });
    else {
      setMode(m);
      if (blame) nav.go({ s: 'code', ref: gitRef || undefined, path: node.path }, { replace: true });
    }
  };
  const seg = (m: FileMode, label: string) => (
    <Button key={m} aria-pressed={mode === m} onPress={() => setView(m)} className={cn('h-7 cursor-pointer rounded-md border-0 px-2.5 text-caption font-medium outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:h-11', mode === m ? 'bg-background text-foreground shadow-hairline' : 'bg-transparent text-muted-foreground')}>{label}</Button>
  );
  const download = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(a.href);
    notify(`Downloaded ${node.name}`);
  };
  const isText = !tooLarge && !isImage && file.data != null;
  return (
    <Box header={
      <div className="flex w-full flex-wrap items-center gap-2">
        {isText ? (
          <div role="group" aria-label="View" className="flex gap-0.5 rounded-md bg-secondary p-0.5">
            {isMd ? seg('preview', 'Preview') : null}
            {seg('code', 'Code')}
            {seg('blame', 'Blame')}
          </div>
        ) : null}
        {!ui.phone && file.data != null ? <span className="text-caption text-muted-foreground">{lines} lines · {(code.length / 1024).toFixed(1)} KB</span> : null}
        <span className="flex-1" />
        {source.live || !isText
          ? <a href={blobUrl} target="_blank" rel="noreferrer" className={cn(ghButton(), 'h-7 px-2.5 text-caption no-underline')}>Raw</a>
          // The sample isn't on github.com: show its own bytes.
          : <Button className={cn(ghButton(), 'h-7 px-2.5 text-caption')} onPress={() => window.open(URL.createObjectURL(new Blob([code], { type: 'text/plain' })), '_blank', 'noopener')}>Raw</Button>}
        {isText ? <SyntaxHighlightingCopyButton value={code} label="Copy raw file" className={cn(ghButton(), 'h-7 w-7 px-0')} /> : null}
        <Menu label="More file actions" triggerClassName={cn(ghButton(), 'h-7 w-7 px-0')} trigger={<Oct name="kebab" />} entries={[
          isText ? { id: 'download', label: 'Download', icon: <Oct name="download" size={14} />, onAction: download } : null,
          { id: 'history', label: 'History', icon: <Oct name="history" size={14} />, onAction: () => nav.go({ s: 'commits', ref: gitRef || undefined, path: node.path }) },
          // A permalink names the commit, so it keeps pointing at this version after the branch moves on.
          last?.fullSha ? { id: 'link', label: 'Copy permalink', icon: <Oct name="link" size={14} />, onAction: () => void copy(`https://github.com/${source.full}/blob/${last.fullSha}/${rawPath}`, 'Permalink copied') } : null,
          { id: 'path', label: 'Copy path', icon: <Oct name="copy" size={14} />, onAction: () => void copy(node.path, 'Path copied') },
          can.participate && onBranch && isText ? { separator: true, id: 'sep' } : null,
          // Without write access this is where forking starts, as on GitHub.
          can.participate && onBranch && isText ? { id: 'edit', label: can.push ? 'Edit file' : 'Fork and edit file', icon: <Oct name="pencil" size={14} />, onAction: () => nav.go({ s: 'edit', ref: gitRef || undefined, path: node.path, mode: 'edit' }) } : null,
          can.push && onBranch ? { id: 'delete', label: 'Delete file', danger: true, icon: <Oct name="trash" size={14} />, onAction: () => nav.go({ s: 'edit', ref: gitRef || undefined, path: node.path, mode: 'delete' }) } : null,
        ]} />
      </div>
    }>
      {tooLarge ? (
        <div className="px-4 py-10 text-center text-muted-foreground">This file is {(node.size! / 1e6).toFixed(1)} MB: too large to show here. Use Raw to download it.</div>
      ) : isImage ? (
        <ImageFile path={node.path} gitRef={gitRef} />
      ) : (
        <Loaded load={file} pending={<div className="px-4 py-10 text-center text-caption text-muted-foreground">Loading {node.name}…</div>}>
          {(text) => text == null
            ? <div className="px-4 py-10 text-center text-muted-foreground">Binary file not shown. Use Raw to download it.</div>
            : !text ? <div className="px-4 py-10 text-center text-muted-foreground">This file is empty.</div>
            : mode === 'blame' ? <BlameView path={node.path} text={text} gitRef={gitRef} />
            : mode === 'preview' ? <Readme markdown={text} dir={node.path.split('/').slice(0, -1).join('/')} gitRef={gitRef} />
            : <LinkedCode path={node.path} code={text} line={line} lineEnd={lineEnd} gitRef={gitRef} />}
        </Loaded>
      )}
    </Box>
  );
}

/** The code, plus a line gutter you can link to: a click puts the line in the URL, shift-click makes it a range. */
function LinkedCode({ path, code, line, lineEnd, gitRef }: { path: string; code: string; line?: number; lineEnd?: number; gitRef: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNav();
  useEffect(() => {
    if (!line) return;
    ref.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: 'center' });
  }, [line]);
  const count = code.replace(/\n$/, '').split('\n').length;
  // Addresses can say anything: #L5-L2 means 2 to 5, and lines past the end mean nothing.
  const [first, last] = line ? [Math.min(line, lineEnd ?? line), Math.max(line, lineEnd ?? line)] : [0, 0];
  const missing = !!line && first > count;
  const on = (n: number) => !!line && n >= first && n <= last;
  const base = { s: 'code' as const, ref: gitRef || undefined, path };
  return (
    <div ref={ref} className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`Code of ${path}`}>
      {missing ? <p role="status" className="m-0 border-b border-border bg-muted px-3 py-1 font-sans text-caption text-muted-foreground">This file has {count} lines, so there’s no line {first}.</p> : null}
      <div className="flex min-w-max">
        <div className="flex shrink-0 flex-col py-2 text-right font-mono text-caption2 leading-5 select-none">
          {Array.from({ length: count }, (_, i) => (
            <GhLink key={i} data-line={i + 1} to={{ ...base, line: i + 1 }} aria-label={`Line ${i + 1}`}
              onClick={(e) => {
                if (!e.shiftKey || !line) return;
                e.preventDefault();
                e.stopPropagation();
                nav.go({ ...base, line: Math.min(line, i + 1), lineEnd: Math.max(line, i + 1) }, { replace: true });
              }}
              className={cn('block h-5 px-2 text-muted-foreground no-underline hover:text-primary', on(i + 1) && 'bg-(--gh-hl) font-semibold text-foreground')}>{i + 1}</GhLink>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {line && !missing ? <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bg-(--gh-hl)" style={{ top: 8 + (first - 1) * 20, height: (Math.min(last, count) - first + 1) * 20 }} /> : null}
          <CodeView path={path} code={code} lineNumbers={false} />
        </div>
      </div>
    </div>
  );
}

function ImageFile({ path, gitRef }: { path: string; gitRef: string }) {
  const { source } = useRepo();
  const url = useLoad(`${source.id}:image:${gitRef}:${path}`, () => source.fileUrl(path, gitRef));
  return (
    <div className="grid place-items-center p-6">
      <Loaded load={url}>{(src) => <img src={src} alt={path.split('/').at(-1)} className="max-h-[70vh] max-w-full" />}</Loaded>
    </div>
  );
}

/** Each line beside the commit that last changed it (GraphQL's blame: REST has none). */
function BlameView({ path, text, gitRef }: { path: string; text: string; gitRef: string }) {
  const { source, ui } = useRepo();
  const blame = useLoad<BlameRange[]>(`${source.id}:blame:${gitRef}:${path}`, () => source.blame(path, gitRef));
  const lines = text.replace(/\n$/, '').split('\n');
  return (
    <Loaded load={blame} pending={<div className="px-4 py-10 text-center text-caption text-muted-foreground">Working out who changed what…</div>}>
      {(ranges) => ranges.length ? (
        <div className="overflow-x-auto font-mono text-caption leading-5" tabIndex={0} role="region" aria-label={`Blame of ${path}`}>
          <table className="w-full border-collapse">
            <tbody>
              {ranges.map((r) => lines.slice(r.start - 1, r.end).map((l, i) => (
                <tr key={r.start + i} className={cn(i === 0 && 'border-t border-border')}>
                  {i === 0 ? (
                    <td rowSpan={r.end - r.start + 1} className={cn('border-r border-border bg-muted px-2 py-1 align-top font-sans', ui.phone ? 'w-28 max-w-28' : 'w-[300px] max-w-[300px]')}>
                      <div className="flex items-center gap-1.5">
                        {!ui.phone ? <Avatar c={r.commit.author} src={r.commit.author.avatar} size={16} /> : null}
                        <GhLink to={{ s: 'commit', sha: r.commit.fullSha ?? r.commit.sha }} className="min-w-0 flex-1 truncate text-caption text-foreground no-underline hover:text-primary hover:underline">{r.commit.message}</GhLink>
                      </div>
                      <div className="truncate text-caption2 text-muted-foreground" title={r.commit.at ? new Date(r.commit.at).toLocaleString() : undefined}>{r.commit.author.login}, {r.commit.when}</div>
                    </td>
                  ) : null}
                  <td className="w-[1%] px-2 text-right align-top text-muted-foreground select-none">{r.start + i}</td>
                  <td className="px-2 whitespace-pre text-foreground">{l || ' '}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      ) : <div className="px-4 py-10 text-center text-muted-foreground">No blame information for this file.</div>}
    </Loaded>
  );
}

