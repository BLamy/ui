/* Code tab: branch toolbar, file table, README and About sidebar; folders and files with GitHub's file-tree sidebar. */
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MarkdownView } from '@/components/ui/markdown-view';
import { Segmented } from '@/components/ui/segmented';
import { SyntaxHighlightingCopyButton } from '@/components/ui/syntax-highlighting';
import { cn } from '@/lib/utils';
import { README_MD, REPO, TREE, findNode, type FileNode } from './data';
import { Box, CodeView, Counter, FileTree, Oct, ghButton, githubMarkdown, type OctName, type Layout, type Nav } from './parts';

export function CodeHome({ ui, nav }: { ui: Layout; nav: Nav }) {
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <CodeToolbar ui={ui} nav={nav} />
        <FileTable ui={ui} nodes={TREE} nav={nav} />
        <Box header={
          <div className="-my-2 flex items-center gap-4 self-stretch">
            <span className="relative flex h-full items-center gap-2 font-semibold after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[var(--gh-tab)]">
              <Oct name="book" className="text-muted-foreground" />README
            </span>
            <span className="flex items-center gap-2 text-muted-foreground"><Oct name="law" />{REPO.license}</span>
          </div>
        }>
          <Readme markdown={README_MD} phone={ui.phone} />
        </Box>
      </div>
      {ui.wide ? <About /> : null}
    </div>
  );
}

export function Readme({ markdown, phone }: { markdown: string; phone: boolean }) {
  return (
    <MarkdownView markdown={markdown}
      className={cn(githubMarkdown, 'text-[16px] leading-[1.5] [&_table]:text-[14px]', phone ? 'px-4 py-5' : 'px-8 py-6')} />
  );
}

export function CodeToolbar({ ui, nav }: { ui: Layout; nav: Nav }) {
  const [branch, setBranch] = useState(REPO.branch);
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <Button className={ghButton()}><Oct name="branch" className="text-muted-foreground" /><span className="max-w-[140px] truncate">{branch}</span><Oct name="chevDown" size={12} className="text-muted-foreground" /></Button>
        <DropdownMenuContent aria-label="Switch branches" selectionMode="single" selectedKeys={[branch]}
          onSelectionChange={(keys) => setBranch(String([...(keys as Set<string>)][0] ?? branch))} className="py-1">
          {REPO.branches.map((b) => (
            <DropdownMenuItem key={b} id={b} className="min-h-9 py-1.5 font-mono text-[13px]">{b}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {!ui.phone ? (
        <>
          <span className="flex items-center gap-1.5 px-2 text-muted-foreground"><Oct name="branch" /><b className="text-foreground">{REPO.branchCount}</b> Branches</span>
          <span className="flex items-center gap-1.5 px-2 text-muted-foreground"><Oct name="tag" /><b className="text-foreground">{REPO.tagCount}</b> Tags</span>
        </>
      ) : null}
      <span className="flex-1" />
      {ui.wide ? (
        <div className="flex h-8 w-[240px] items-center gap-2 rounded-md border border-border px-2 text-muted-foreground">
          <Oct name="search" /><span className="flex-1">Go to file</span><kbd className="rounded border border-border px-1 font-mono text-[11px]">t</kbd>
        </div>
      ) : null}
      {!ui.phone ? <Button className={ghButton()}>Add file<Oct name="chevDown" size={12} /></Button> : null}
      <Button className={ghButton(true)} onPress={nav.clone}><Oct name="code" />Code<Oct name="chevDown" size={12} /></Button>
    </div>
  );
}

export function LastCommit({ ui, message = REPO.lastCommit.message, when = REPO.lastCommit.when }: { ui: Layout; message?: string; when?: string }) {
  const c = REPO.lastCommit;
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <Avatar c={c.author} size={24} />
      <b className="shrink-0 font-semibold">{c.author.login}</b>
      <span className="min-w-0 truncate text-muted-foreground">{message}</span>
      <span className="flex-1" />
      {!ui.phone ? <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{c.sha} · {when}</span> : null}
      <span className="flex shrink-0 items-center gap-1.5 font-semibold"><Oct name="history" className="text-muted-foreground" />{ui.phone ? '' : REPO.commitCount + ' Commits'}</span>
    </div>
  );
}

export function FileTable({ ui, nodes, nav, parent }: { ui: Layout; nodes: FileNode[]; nav: Nav; parent?: string }) {
  const sorted = [...nodes].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  return (
    <Box header={<LastCommit ui={ui} />}>
      {parent != null ? (
        <FileRow ui={ui} icon={<Oct name="folder" className="text-[var(--gh-folder)]" />} name=".." onOpen={() => nav.openPath(parent)} />
      ) : null}
      {sorted.map((n) => (
        <FileRow key={n.path} ui={ui} name={n.name} commit={n.commit} when={n.when} onOpen={() => nav.openPath(n.path)}
          icon={n.type === 'dir' ? <Oct name="folder" className="text-[var(--gh-folder)]" /> : <Oct name="file" className="text-muted-foreground" />} />
      ))}
    </Box>
  );
}

export function FileRow({ ui, icon, name, commit, when, onOpen }: { ui: Layout; icon: ReactNode; name: string; commit?: string; when?: string; onOpen: () => void }) {
  return (
    <div className="flex h-10 items-center gap-3 border-t border-border px-4 first:border-t-0 hover:bg-muted">
      {icon}
      <button type="button" onClick={onOpen}
        className={cn('min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[14px] text-foreground hover:text-primary hover:underline', ui.phone ? 'flex-1' : 'w-[34%] shrink-0')}>
        {name}
      </button>
      {!ui.phone ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{commit}</span> : null}
      <span className="shrink-0 text-right text-muted-foreground">{when}</span>
    </div>
  );
}

export function About() {
  const section = 'border-b border-border py-6 first:pt-0 last:border-0';
  return (
    <aside className="w-[296px] shrink-0 text-[14px]">
      <div className={section}>
        <h2 className="mt-0 mb-4 text-[16px] font-semibold">About</h2>
        <p className="m-0 text-[16px] leading-6">{REPO.description}</p>
        <p className="my-4 flex items-center gap-2 font-semibold text-primary"><Oct name="link" className="text-muted-foreground" />{REPO.homepage}</p>
        <div className="flex flex-wrap gap-1.5">
          {REPO.topics.map((t) => (
            <span key={t} className="rounded-full bg-primary/10 px-2.5 py-[3px] text-[12px] leading-[18px] font-medium text-primary">{t}</span>
          ))}
        </div>
        <ul className="mt-4 mb-0 list-none space-y-2 p-0 text-muted-foreground">
          {([['book', 'Readme'], ['law', REPO.license], ['pulse', 'Activity'], ['star', REPO.stars + ' stars'], ['eye', REPO.watchers + ' watching'], ['fork', REPO.forks + ' forks']] as [OctName, string][]).map(([i, t]) => (
            <li key={t} className="flex items-center gap-2 hover:text-primary"><Oct name={i} />{t}</li>
          ))}
        </ul>
      </div>
      <div className={section}>
        <h2 className="mt-0 mb-3 flex items-center gap-2 text-[16px] font-semibold">Releases <Counter>{REPO.release.count}</Counter></h2>
        <div className="flex gap-2">
          <Oct name="tag" className="mt-0.5 text-[var(--gh-open)]" />
          <div>
            <div className="flex items-center gap-2"><b className="font-semibold">{REPO.release.tag}</b>
              <span className="rounded-full border border-[var(--gh-open)] px-2 text-[12px] leading-[18px] font-medium text-[var(--gh-open)]">Latest</span></div>
            <div className="text-[12px] text-muted-foreground">{REPO.release.when}</div>
          </div>
        </div>
      </div>
      <div className={section}>
        <h2 className="mt-0 mb-3 flex items-center gap-2 text-[16px] font-semibold">Contributors <Counter>{REPO.contributorCount}</Counter></h2>
        <div className="flex flex-wrap gap-1">{REPO.contributors.map((u) => <Avatar key={u.login} c={u} size={32} />)}</div>
      </div>
      <div className={section}>
        <h2 className="mt-0 mb-3 text-[16px] font-semibold">Languages</h2>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {REPO.languages.map((l) => <span key={l.name} style={{ width: l.pct + '%', background: l.color }} />)}
        </div>
        <ul className="mt-3 mb-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px]">
          {REPO.languages.map((l) => (
            <li key={l.name} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: l.color }} /><b className="font-semibold">{l.name}</b><span className="text-muted-foreground">{l.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** A folder listing or a file viewer, with GitHub's file-tree sidebar at wide widths. */
export function PathView({ ui, path, nav }: { ui: Layout; path: string; nav: Nav }) {
  const node = findNode(path);
  const parts = path.split('/');
  if (!node) return null;
  const crumbs = (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-[16px]">
      <button type="button" onClick={() => nav.openPath('')} className="cursor-pointer border-0 bg-transparent p-0 text-[16px] font-semibold text-primary hover:underline">{REPO.name}</button>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-tertiary-foreground">/</span>
          {i === parts.length - 1
            ? <b className="font-semibold">{p}</b>
            : <button type="button" onClick={() => nav.openPath(parts.slice(0, i + 1).join('/'))} className="cursor-pointer border-0 bg-transparent p-0 text-[16px] text-primary hover:underline">{p}</button>}
        </span>
      ))}
      <Oct name="copy" size={14} className="ml-1 text-muted-foreground" />
    </div>
  );
  return (
    <div className={cn('flex gap-6', ui.phone && 'px-4 py-4')}>
      {ui.wide ? (
        <aside className="w-[280px] shrink-0 border-r border-border pr-4">
          <div className="mb-3 flex items-center gap-2">
            <Oct name="sidebar" className="text-muted-foreground" /><b className="text-[16px] font-semibold">Files</b>
          </div>
          <div className="mb-3 flex h-8 items-center gap-2 rounded-md border border-border px-2 text-muted-foreground"><Oct name="search" />Go to file</div>
          <FileTree nodes={TREE} selected={path} onSelect={(n) => nav.openPath(n.path)} />
        </aside>
      ) : null}
      <div className="min-w-0 flex-1 space-y-4">
        {!ui.phone ? crumbs : null}
        {node.type === 'dir' ? (
          <FileTable ui={ui} nodes={node.children ?? []} nav={nav} parent={parts.slice(0, -1).join('/')} />
        ) : (
          <>
            <Box className="px-4 py-3"><LastCommit ui={ui} message={node.commit} when={node.when} /></Box>
            <FileViewer ui={ui} node={node} />
          </>
        )}
      </div>
    </div>
  );
}

export function FileViewer({ ui, node }: { ui: Layout; node: FileNode }) {
  const code = node.content ?? `// ${node.name}\n// Contents are not included in this sample repository.\n`;
  const isMd = node.name.endsWith('.md') && node.content;
  const [view, setView] = useState(isMd ? 'preview' : 'code');
  const lines = code.replace(/\n$/, '').split('\n').length;
  return (
    <Box header={
      <div className="flex w-full items-center gap-3">
        <Segmented aria-label="View" value={view} onChange={setView} className="w-[150px] rounded-md"
          options={isMd ? [{ id: 'preview', label: 'Preview' }, { id: 'code', label: 'Code' }] : [{ id: 'code', label: 'Code' }, { id: 'blame', label: 'Blame' }]} />
        {!ui.phone ? <span className="text-[12px] text-muted-foreground">{lines} lines · {(code.length / 1024).toFixed(1)} KB</span> : null}
        <span className="flex-1" />
        <Button className={cn(ghButton(), 'h-7 px-2.5 text-[12px]')}>Raw</Button>
        <SyntaxHighlightingCopyButton value={code} label="Copy raw file" className={cn(ghButton(), 'h-7 w-7 px-0')} />
      </div>
    }>
      {view === 'preview' ? <Readme markdown={code} phone={ui.phone} /> : <CodeView path={node.path} code={code} />}
    </Box>
  );
}
