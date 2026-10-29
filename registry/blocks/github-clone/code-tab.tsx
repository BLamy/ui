/* Code tab: branch toolbar, file table, README and About sidebar; folders and files with GitHub's file-tree sidebar.
   The tree is one recursive listing per branch; a file's text and last commit load when it opens. Live trees carry no
   per-file commit (GitHub computes that per file), so the table's commit and age columns stay empty there. */
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MarkdownView } from '@/components/ui/markdown-view';
import { Segmented } from '@/components/ui/segmented';
import { SyntaxHighlightingCopyButton } from '@/components/ui/syntax-highlighting';
import { cn } from '@/lib/utils';
import type { FileNode } from './data';
import { Box, CodeView, Counter, FileTree, Oct, ghButton, githubMarkdown, type OctName, type Layout, type Nav } from './parts';
import { Loaded, Pending, useLoad, useRepo } from './repo-context';

/** Files GitHub's own viewer won't show inline either. */
const TOO_LARGE = 1_000_000;

function useTree() {
  const { source, ref } = useRepo();
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

export function CodeHome({ ui, nav }: { ui: Layout; nav: Nav }) {
  const { source, ref, repo } = useRepo();
  const tree = useTree();
  const readme = useLoad(`${source.id}:readme:${ref}`, () => source.readme(ref));
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <CodeToolbar ui={ui} nav={nav} />
        <Loaded load={tree}>{(nodes) => <FileTable ui={ui} nodes={nodes} nav={nav} />}</Loaded>
        <Loaded load={readme} pending={<Pending label="Loading the README…" />}>
          {(md) => md == null ? null : (
            <Box header={
              <div className="-my-2 flex items-center gap-4 self-stretch">
                <span className="relative flex h-full items-center gap-2 font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--gh-tab)]">
                  <Oct name="book" className="text-muted-foreground" />README
                </span>
                {repo.license ? <span className="flex items-center gap-2 text-muted-foreground"><Oct name="law" />{repo.license}</span> : null}
              </div>
            }>
              <Readme markdown={md} phone={ui.phone} />
            </Box>
          )}
        </Loaded>
      </div>
      {ui.wide ? <About /> : null}
    </div>
  );
}

export function Readme({ markdown, phone }: { markdown: string; phone: boolean }) {
  return (
    <MarkdownView markdown={markdown}
      className={cn(githubMarkdown, 'text-callout leading-[1.5] [&_table]:text-detail', phone ? 'px-4 py-5' : 'px-8 py-6')} />
  );
}

export function CodeToolbar({ ui, nav }: { ui: Layout; nav: Nav }) {
  const { repo, ref, setRef } = useRepo();
  const branch = ref || repo.branch;
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <Button className={ghButton()}><Oct name="branch" className="text-muted-foreground" /><span className="max-w-[140px] truncate">{branch}</span><Oct name="chevDown" size={12} className="text-muted-foreground" /></Button>
        <DropdownMenuContent aria-label="Switch branches" selectionMode="single" selectedKeys={[branch]}
          onSelectionChange={(keys) => { const b = String([...(keys as Set<string>)][0] ?? branch); setRef(b === repo.branch ? '' : b); }} className="max-h-[360px] py-1">
          {repo.branches.map((b) => (
            <DropdownMenuItem key={b} id={b} className="min-h-9 py-1.5 font-mono text-footnote">{b}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {!ui.phone ? (
        <>
          <span className="flex items-center gap-1.5 px-2 text-muted-foreground"><Oct name="branch" /><b className="text-foreground">{repo.branchCount}</b> Branches</span>
          <span className="flex items-center gap-1.5 px-2 text-muted-foreground"><Oct name="tag" /><b className="text-foreground">{repo.tagCount}</b> Tags</span>
        </>
      ) : null}
      <span className="flex-1" />
      {ui.wide ? (
        <div className="flex h-8 w-[240px] items-center gap-2 rounded-md border border-border px-2 text-muted-foreground">
          <Oct name="search" /><span className="flex-1">Go to file</span><kbd className="rounded border border-border px-1 font-mono text-caption2">t</kbd>
        </div>
      ) : null}
      {!ui.phone ? <Button className={ghButton()}>Add file<Oct name="chevDown" size={12} /></Button> : null}
      <Button className={ghButton(true)} onPress={nav.clone}><Oct name="code" />Code<Oct name="chevDown" size={12} /></Button>
    </div>
  );
}

/** The last commit touching `path` ('' for the repository) on the branch being browsed. */
export function LastCommit({ ui, path = '' }: { ui: Layout; path?: string }) {
  const { source, ref, repo } = useRepo();
  const c = useLoad(`${source.id}:last:${ref}:${path}`, () => source.lastCommit(path, ref)).data;
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      {c ? (
        <>
          <Avatar c={c.author} src={c.author.avatar} size={24} />
          <b className="shrink-0 font-semibold">{c.author.login}</b>
          <span className="min-w-0 truncate text-muted-foreground">{c.message}</span>
        </>
      ) : <span className="h-6" />}
      <span className="flex-1" />
      {c && !ui.phone ? <span className="shrink-0 font-mono text-caption text-muted-foreground">{c.sha} · {c.when}</span> : null}
      <span className="flex shrink-0 items-center gap-1.5 font-semibold"><Oct name="history" className="text-muted-foreground" />{ui.phone ? '' : `${repo.commitCount} Commit${repo.commitCount === '1' ? '' : 's'}`}</span>
    </div>
  );
}

export function FileTable({ ui, nodes, nav, parent, path = '' }: { ui: Layout; nodes: FileNode[]; nav: Nav; parent?: string; path?: string }) {
  const sorted = [...nodes].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  return (
    <Box header={<LastCommit ui={ui} path={path} />}>
      {parent != null ? (
        <FileRow ui={ui} icon={<Oct name="folder" className="text-[var(--gh-folder)]" />} name=".." onOpen={() => nav.openPath(parent)} />
      ) : null}
      {sorted.map((n) => (
        <FileRow key={n.path} ui={ui} name={n.name} commit={n.commit} when={n.when} onOpen={() => nav.openPath(n.path)}
          icon={n.type === 'dir' ? <Oct name="folder" className="text-[var(--gh-folder)]" /> : <Oct name="file" className="text-muted-foreground" />} />
      ))}
      {!sorted.length ? <div className="px-4 py-8 text-center text-muted-foreground">This folder is empty.</div> : null}
    </Box>
  );
}

export function FileRow({ ui, icon, name, commit, when, onOpen }: { ui: Layout; icon: ReactNode; name: string; commit?: string; when?: string; onOpen: () => void }) {
  return (
    <div className="flex h-10 items-center gap-3 border-t border-border px-4 first:border-t-0 hover:bg-muted">
      {icon}
      <button type="button" onClick={onOpen}
        className={cn('min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-detail text-foreground hover:text-primary hover:underline', ui.phone ? 'flex-1' : 'w-[34%] shrink-0')}>
        {name}
      </button>
      {!ui.phone ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{commit}</span> : null}
      <span className="shrink-0 text-right text-muted-foreground">{when}</span>
    </div>
  );
}

export function About() {
  const { repo } = useRepo();
  const section = 'border-b border-border py-6 first:pt-0 last:border-0';
  return (
    <aside className="w-[296px] shrink-0 text-detail">
      <div className={section}>
        <h2 className="mt-0 mb-4 text-callout font-semibold">About</h2>
        <p className="m-0 text-callout leading-6">{repo.description || <span className="text-muted-foreground italic">No description, website, or topics provided.</span>}</p>
        {repo.homepage ? <p className="my-4 flex items-center gap-2 font-semibold text-primary"><Oct name="link" className="text-muted-foreground" />{repo.homepage}</p> : null}
        {repo.topics.length ? (
          <div className={cn('flex flex-wrap gap-1.5', !repo.homepage && 'mt-4')}>
            {repo.topics.map((t) => (
              <span key={t} className="rounded-full bg-primary/10 px-2.5 py-[3px] text-caption leading-[18px] font-medium text-primary">{t}</span>
            ))}
          </div>
        ) : null}
        <ul className="mt-4 mb-0 list-none space-y-2 p-0 text-muted-foreground">
          {([['book', 'Readme'], ...(repo.license ? [['law', repo.license]] : []), ['pulse', 'Activity'], ['star', repo.stars + ' stars'], ['eye', repo.watchers + ' watching'], ['fork', repo.forks + ' forks']] as [OctName, string][]).map(([i, t]) => (
            <li key={t} className="flex items-center gap-2 hover:text-primary"><Oct name={i} />{t}</li>
          ))}
        </ul>
      </div>
      {repo.release ? (
        <div className={section}>
          <h2 className="mt-0 mb-3 flex items-center gap-2 text-callout font-semibold">Releases <Counter>{repo.release.count}</Counter></h2>
          <div className="flex gap-2">
            <Oct name="tag" className="mt-0.5 text-[var(--gh-open)]" />
            <div>
              <div className="flex items-center gap-2"><b className="font-semibold">{repo.release.tag}</b>
                <span className="rounded-full border border-[var(--gh-open)] px-2 text-caption leading-[18px] font-medium text-[var(--gh-open)]">Latest</span></div>
              <div className="text-caption text-muted-foreground">{repo.release.when}</div>
            </div>
          </div>
        </div>
      ) : null}
      {repo.contributors.length ? (
        <div className={section}>
          <h2 className="mt-0 mb-3 flex items-center gap-2 text-callout font-semibold">Contributors <Counter>{repo.contributorCount}</Counter></h2>
          <div className="flex flex-wrap gap-1">{repo.contributors.map((u) => <Avatar key={u.login} c={u} src={u.avatar} size={32} />)}</div>
        </div>
      ) : null}
      {repo.languages.length ? (
        <div className={section}>
          <h2 className="mt-0 mb-3 text-callout font-semibold">Languages</h2>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
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
    </aside>
  );
}

/** A folder listing or a file viewer, with GitHub's file-tree sidebar at wide widths. */
export function PathView({ ui, path, nav }: { ui: Layout; path: string; nav: Nav }) {
  const { repo } = useRepo();
  const tree = useTree();
  const parts = path.split('/');
  const crumbs = (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-callout">
      <button type="button" onClick={() => nav.openPath('')} className="cursor-pointer border-0 bg-transparent p-0 text-callout font-semibold text-primary hover:underline">{repo.name}</button>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-tertiary-foreground">/</span>
          {i === parts.length - 1
            ? <b className="font-semibold">{p}</b>
            : <button type="button" onClick={() => nav.openPath(parts.slice(0, i + 1).join('/'))} className="cursor-pointer border-0 bg-transparent p-0 text-callout text-primary hover:underline">{p}</button>}
        </span>
      ))}
      <Oct name="copy" size={14} className="ml-1 text-muted-foreground" />
    </div>
  );
  return (
    <Loaded load={tree} className={cn(ui.phone && 'm-4')}>
      {(nodes) => {
        const node = nodeAt(nodes, path, repo.name);
        return (
          <div className={cn('flex gap-6', ui.phone && 'px-4 py-4')}>
            {ui.wide ? (
              <aside className="w-[280px] shrink-0 border-r border-border pr-4">
                <div className="mb-3 flex items-center gap-2">
                  <Oct name="sidebar" className="text-muted-foreground" /><b className="text-callout font-semibold">Files</b>
                </div>
                <div className="mb-3 flex h-8 items-center gap-2 rounded-md border border-border px-2 text-muted-foreground"><Oct name="search" />Go to file</div>
                <FileTree nodes={nodes} selected={path} onSelect={(n) => nav.openPath(n.path)} />
              </aside>
            ) : null}
            <div className="min-w-0 flex-1 space-y-4">
              {!ui.phone ? crumbs : null}
              {!node ? (
                <Box className="px-6 py-12 text-center text-muted-foreground">{path} isn’t on this branch.</Box>
              ) : node.type === 'dir' ? (
                <FileTable ui={ui} nodes={node.children ?? []} nav={nav} parent={parts.slice(0, -1).join('/')} path={path} />
              ) : (
                <>
                  <Box className="px-4 py-3"><LastCommit ui={ui} path={path} /></Box>
                  <FileViewer ui={ui} node={node} />
                </>
              )}
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}

export function FileViewer({ ui, node }: { ui: Layout; node: FileNode }) {
  const { source, ref, repo } = useRepo();
  const tooLarge = (node.size ?? 0) > TOO_LARGE;
  const file = useLoad(`${source.id}:file:${ref}:${node.path}`, () => (tooLarge ? null : source.file(node.path, ref)));
  const isMd = node.name.endsWith('.md') && (source.live || !!node.content);
  const [view, setView] = useState(isMd ? 'preview' : 'code');
  const code = file.data ?? '';
  const lines = code.replace(/\n$/, '').split('\n').length;
  const raw = repo.url ? `${repo.url}/raw/${encodeURIComponent(ref || repo.branch)}/${node.path.split('/').map(encodeURIComponent).join('/')}` : undefined;
  return (
    <Box header={
      <div className="flex w-full items-center gap-3">
        <Segmented aria-label="View" value={view} onChange={setView} className="w-[150px] rounded-md"
          options={isMd ? [{ id: 'preview', label: 'Preview' }, { id: 'code', label: 'Code' }] : [{ id: 'code', label: 'Code' }, { id: 'blame', label: 'Blame' }]} />
        {!ui.phone && file.data != null ? <span className="text-caption text-muted-foreground">{lines} lines · {(code.length / 1024).toFixed(1)} KB</span> : null}
        <span className="flex-1" />
        <Button className={cn(ghButton(), 'h-7 px-2.5 text-caption')} onPress={raw ? () => window.open(raw, '_blank', 'noopener') : undefined}>Raw</Button>
        <SyntaxHighlightingCopyButton value={code} label="Copy raw file" className={cn(ghButton(), 'h-7 w-7 px-0')} />
      </div>
    }>
      {tooLarge ? (
        <div className="px-4 py-10 text-center text-muted-foreground">This file is {(node.size! / 1e6).toFixed(1)} MB — too large to show here. Use Raw to download it.</div>
      ) : (
        <Loaded load={file} pending={<div className="px-4 py-10 text-center text-caption text-muted-foreground">Loading {node.name}…</div>}>
          {(text) => text == null
            ? <div className="px-4 py-10 text-center text-muted-foreground">Binary file not shown.</div>
            : view === 'preview' ? <Readme markdown={text} phone={ui.phone} /> : <CodeView path={node.path} code={text} />}
        </Loaded>
      )}
    </Box>
  );
}
