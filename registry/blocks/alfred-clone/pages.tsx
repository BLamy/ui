/* Alfred's pages. Each is a <CommandPage> with its own items and, where it needs one, its own keys
   (`onKeyDown` runs before the menu's; preventDefault takes a key over). The launcher renders the current one. */
import type { KeyboardEvent, ReactNode } from 'react';
import { CommandGroup, CommandItem, CommandPage, useCommandActive, useCommandMenu } from '@/components/ui/command-menu';
import { IconSwap } from '@/components/ui/icon-swap';
import { Kbd } from '@/components/ui/kbd';
import { NumberMorph } from '@/components/ui/number-morph';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { evaluate, formatResult, looksLikeMath, plainResult, prettyExpression } from './calc';
import {
  EMOJI_GROUPS, ENGINES, HOME, LABELS, REPOS, SNIPPETS, TIMERS, TRASH, descendants, nodeAt, pathOf, type Engine, type FileNode,
} from './data';
import { CalcGlyph, ClipGlyph, FileGlyph, Tile } from './parts';
import { useAlfred } from './state';

const isMod = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

/** The trailing "↵ Copy" hint on a result row. */
function Hint({ children, keys = '↵' }: { children: ReactNode; keys?: string }) {
  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 pl-3 text-[12.5px] text-muted-foreground">
      <Kbd>{keys}</Kbd>{children}
    </span>
  );
}

/* ══ Root ══ */

export const APPS = [
  { page: 'calc', title: 'Calculator', description: 'Type math anywhere — or = to start', tone: 'calc', keywords: ['math', 'calculate', '='] },
  { page: 'clipboard', title: 'Clipboard History', description: 'Everything you’ve copied, pinned first', tone: 'clipboard', icon: 'copy', keywords: ['paste', 'copy', 'history'] },
  { page: 'emoji', title: 'Emoji & Symbols', description: 'Search and copy emoji', tone: 'emoji', keywords: ['emoji', 'smiley', 'symbols'] },
  { page: 'snippets', title: 'Snippets', description: 'Text that expands from a keyword', tone: 'snippets', icon: 'textformat', keywords: ['text', 'expand', 'keyword', ';'] },
  { page: 'folder:~', title: 'File Search', description: 'Browse and open files', tone: 'files', icon: 'folder-fill', keywords: ['find', 'open', 'finder', 'files'] },
  { page: 'system', title: 'System', description: 'Lock, sleep, empty Trash, dark mode…', tone: 'system', icon: 'gear', keywords: ['mac', 'power', 'appearance'] },
  { page: 'web', title: 'Web Search', description: 'Google, GitHub, Wikipedia and more', tone: 'web', icon: 'globe', keywords: ['search', 'google', 'internet'] },
  { page: 'workflows', title: 'Workflows', description: 'Multi-step actions: issues, timers', tone: 'workflows', icon: 'bolt-fill', keywords: ['automation', 'multi-step'] },
] as const;

export function appTile(tone: string, icon?: string, size = 30) {
  if (tone === 'calc') return <Tile tone="calc" size={size} glyph={<CalcGlyph size={Math.round(size * 0.6)} />} />;
  if (tone === 'emoji') return <Tile tone="emoji" size={size} glyph={<span className="leading-none" style={{ fontSize: size * 0.62 }}>😊</span>} />;
  return <Tile tone={tone as 'files'} size={size} icon={icon} />;
}

export function RootPage() {
  const { query } = useCommandMenu();
  const a = useAlfred();
  const q = query.trim();
  const math = looksLikeMath(q) ? evaluate(q) : null;
  const snippets = q.startsWith(';') ? SNIPPETS.filter((s) => s.keyword.startsWith(q.toLowerCase())) : [];
  const files = q && !q.startsWith(';') && math === null ? descendants('~') : [];
  const apps = APPS.map((app) => (
    <CommandItem
      key={app.page} value={app.title} keywords={[...app.keywords]} icon={appTile(app.tone, 'icon' in app ? app.icon : undefined)}
      // The description is a node so it isn't searched ("dark" should find the command, not System's blurb).
      title={app.title} description={<span>{app.description}</span>} page={app.page}
    />
  ));
  if (!q) return <CommandPage id="root" numbered><CommandGroup heading="Alfred">{apps}</CommandGroup></CommandPage>;
  // Typing: one ranked list, like Alfred (a group ranks its own items by score; separate groups keep DOM order).
  // The calculator's row matches its own query exactly, so it leads; files follow, and web searches come last.
  return (
    <CommandPage id="root" numbered>
      <CommandGroup>
        {math !== null ? (
          <CommandItem
            value={q}
            icon={appTile('calc')}
            title={<span className="text-[17px] font-semibold tabular-nums">{formatResult(math)}</span>}
            description={`${prettyExpression(q)} =`}
            badge={<Hint>Copy</Hint>}
            onSelect={() => {
              a.addHistory({ expr: prettyExpression(q), result: plainResult(math) });
              a.copy(plainResult(math), `Copied ${formatResult(math)}`, 'Calculator');
            }}
          />
        ) : null}
        {snippets.map((s) => (
          <CommandItem
            key={s.keyword} value={s.keyword} keywords={[s.name]} icon={appTile('snippets', 'textformat')} title={s.name}
            description={<span>{s.text.split('\n')[0]}</span>} badge={<KeywordChip>{s.keyword}</KeywordChip>}
            onSelect={() => a.copy(s.text, `Pasted ${s.keyword}`, 'Snippets')}
          />
        ))}
        {apps}
        <SystemItems />
        <WorkflowItems />
      </CommandGroup>
      {/* Files after features and commands, so "calc" opens the Calculator rather than calc.ts. */}
      <CommandGroup heading="Files">
        {files.map(({ node, path }) => <FileItem key={path} node={node} path={path} />)}
      </CommandGroup>
      <CommandGroup heading="Search the web">
        {ENGINES.slice(0, 3).map((en) => <EngineItem key={en.id} engine={en} q={q} value={`${en.name} ${q}`} />)}
      </CommandGroup>
    </CommandPage>
  );
}

function KeywordChip({ children }: { children: ReactNode }) {
  return <span className="ml-auto shrink-0 rounded-md bg-primary/12 px-1.5 py-0.5 font-mono text-[12px] font-medium text-primary">{children}</span>;
}

/* ══ Calculator ══ */

export function CalculatorPage() {
  const { query, setQuery } = useCommandMenu();
  const active = useCommandActive();
  const a = useAlfred();
  const q = query.trim();
  const value = evaluate(q);
  const copyResult = (v: number, expr: string) => {
    a.addHistory({ expr, result: plainResult(v) });
    a.copy(plainResult(v), `Copied ${formatResult(v)}`, 'Calculator');
  };
  // Tab continues from a history result: its value goes into the input.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const h = active?.startsWith('h:') ? a.history[Number(active.slice(2))] : null;
    if (h) setQuery(h.result);
    else if (value !== null) setQuery(plainResult(value));
  };
  const big = value !== null && Math.abs(value) < 1e15;
  return (
    <CommandPage id="calc" title="Calculator" placeholder="2^10, sqrt(2), 15% × 80, (1200 × 1.08) ÷ 12" filter={false} numbered onKeyDown={onKeyDown}>
      <div className="px-1 pt-2 pb-1">
        {value !== null ? (
          <CommandItem value="result" className="min-h-[92px] rounded-[14px] px-4" onSelect={() => copyResult(value, prettyExpression(q))}>
            <CalcDisplay expr={`${prettyExpression(q)} =`}>
              {big ? <NumberMorph value={Number(value.toPrecision(14))} format={{ maximumFractionDigits: 10 }} /> : formatResult(value)}
            </CalcDisplay>
            <Hint>Copy</Hint>
          </CommandItem>
        ) : (
          <div className="flex min-h-[92px] items-center px-4">
            <CalcDisplay expr={q ? `${prettyExpression(q)} =` : 'Type an expression'} muted>{q ? '…' : '0'}</CalcDisplay>
          </div>
        )}
      </div>
      <CommandGroup heading="History">
        {a.history.map((h, i) => (
          <CommandItem
            key={h.expr} value={`h:${i}`} icon={<Icon name="clock-dial" size={17} sw={1.8} />}
            title={<span className="tabular-nums">{formatResult(Number(h.result))}</span>} description={`${h.expr} =`}
            onSelect={() => a.copy(h.result, `Copied ${formatResult(Number(h.result))}`, 'Calculator')}
          />
        ))}
      </CommandGroup>
    </CommandPage>
  );
}

function CalcDisplay({ expr, muted, children }: { expr: string; muted?: boolean; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-[13px] text-muted-foreground tabular-nums">{expr}</span>
      <span className={cn('truncate text-[34px] leading-[40px] font-semibold tracking-tight tabular-nums', muted && 'text-tertiary-foreground')}>{children}</span>
    </span>
  );
}

/* ══ Clipboard ══ */

export function ClipboardPage() {
  const a = useAlfred();
  const active = useCommandActive();
  const pinned = a.clips.filter((c) => c.pinned);
  const rest = a.clips.filter((c) => !c.pinned);
  const onKeyDown = (e: KeyboardEvent) => {
    const clip = a.clips.find((c) => c.text === active);
    if (!clip || !isMod(e)) return;
    if (e.key === 'Backspace') {
      // The menu hands the selection to the deleted row's neighbour.
      e.preventDefault();
      a.removeClip(clip.id);
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      a.togglePin(clip.id);
      a.hud(clip.pinned ? 'Unpinned' : 'Pinned', clip.pinned ? 'pushpin-slash' : 'pushpin-fill');
    }
  };
  const item = (c: (typeof a.clips)[number]) => (
    <CommandItem
      key={c.id} value={c.text} keywords={[c.app, c.kind]} icon={<ClipGlyph kind={c.kind} text={c.text} size={28} />}
      title={c.kind === 'image' ? c.text : c.text.split('\n')[0]} description={`${c.app} · ${c.when}`}
      badge={c.pinned ? <Icon name="pushpin-fill" size={13} sw={2} className="ml-auto shrink-0 text-muted-foreground" /> : undefined}
      onSelect={() => a.copy(c.text, 'Pasted to Notes', c.app)}
    />
  );
  return (
    <CommandPage id="clipboard" title="Clipboard" placeholder="Search clipboard history…" numbered onKeyDown={onKeyDown}>
      <CommandGroup heading="Pinned">{pinned.map(item)}</CommandGroup>
      <CommandGroup heading="Recent">{rest.map(item)}</CommandGroup>
      {!a.clips.length ? <div className="py-10 text-center text-[14px] text-muted-foreground">Clipboard history is empty</div> : null}
    </CommandPage>
  );
}

/* ══ Emoji ══ */

export const ALL_EMOJI = EMOJI_GROUPS.flatMap((g) => g.items);

export function EmojiPage({ columns }: { columns: number }) {
  const a = useAlfred();
  return (
    <CommandPage id="emoji" title="Emoji" placeholder="Search emoji — heart, party, thumbs…">
      {EMOJI_GROUPS.map((g) => (
        <CommandGroup key={g.heading} heading={g.heading} columns={columns} className="px-1">
          {g.items.map((em) => (
            <CommandItem key={em.name} value={em.name} keywords={em.keywords} className="rounded-[12px]" onSelect={() => a.copy(em.char, `Copied ${em.char}`, 'Emoji')}>
              <span className="text-[28px] leading-none select-none" aria-label={em.name}>{em.char}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </CommandPage>
  );
}

/* ══ Snippets ══ */

export function SnippetsPage() {
  const a = useAlfred();
  const collections = [...new Set(SNIPPETS.map((s) => s.collection))];
  return (
    <CommandPage id="snippets" title="Snippets" placeholder="Search snippets by name or ;keyword…" numbered>
      {collections.map((c) => (
        <CommandGroup key={c} heading={c}>
          {SNIPPETS.filter((s) => s.collection === c).map((s) => (
            <CommandItem
              key={s.keyword} value={s.keyword} keywords={[s.name]} icon={<Icon name="textformat" size={18} sw={1.8} />}
              title={s.name} description={s.text.replace(/\n/g, ' · ')} badge={<KeywordChip>{s.keyword}</KeywordChip>}
              onSelect={() => a.copy(s.text, `Pasted ${s.keyword}`, 'Snippets')}
            />
          ))}
        </CommandGroup>
      ))}
    </CommandPage>
  );
}

/* ══ Files ══ */

const folderTitle = (path: string) => (path === '~' ? 'Home' : path.slice(path.lastIndexOf('/') + 1));

function FileItem({ node, path }: { node: FileNode; path: string }) {
  const a = useAlfred();
  const where = path.split('/').slice(0, -1).join('/');
  const folder = node.kind === 'folder';
  return (
    // Matched by name only: the path is a node, not searchable text (every file under Projects would match "proj").
    <CommandItem
      value={node.name} title={node.name} icon={<FileGlyph kind={node.kind} size={28} />}
      description={<span>{where}</span>} page={folder ? `folder:${path}` : undefined}
      onSelect={folder ? undefined : () => a.hud(`Opening ${node.name}`, 'arrow-up-right')}
    />
  );
}

export function FolderPage({ path }: { path: string }) {
  const { query, push, pop, depth } = useCommandMenu();
  const active = useCommandActive();
  const a = useAlfred();
  const node = nodeAt(path) ?? HOME;
  const list = query.trim() ? descendants(path) : (node.children ?? []).map((c) => ({ node: c, path: `${path}/${c.name}` }));
  const onKeyDown = (e: KeyboardEvent) => {
    const input = e.target as HTMLInputElement;
    const atEnd = input.selectionStart === input.value.length;
    const targetPath = active ? pathOf(active) : null;
    const target = targetPath ? nodeAt(targetPath) : null;
    if (e.key === 'ArrowRight' && atEnd && target?.kind === 'folder') {
      e.preventDefault();
      push(`folder:${targetPath}`);
    } else if (e.key === 'ArrowLeft' && input.value === '' && depth > 1) {
      e.preventDefault();
      pop();
    } else if (e.key === 'Enter' && isMod(e) && target) {
      e.preventDefault();
      a.hud(`Revealed ${target.name} in Finder`, 'folder-fill');
    }
  };
  return (
    <CommandPage id={`folder:${path}`} title={folderTitle(path)} placeholder={`Search in ${folderTitle(path)}…`} numbered onKeyDown={onKeyDown}>
      <CommandGroup heading={query.trim() ? `In ${path}` : path}>
        {list.map(({ node: n, path: p }) => <FileItem key={p} node={n} path={p} />)}
      </CommandGroup>
    </CommandPage>
  );
}

/* ══ System ══ */

function SystemItems() {
  const a = useAlfred();
  return (
    <>
      <CommandItem
        value="Toggle Dark Mode" keywords={['appearance', 'light mode', 'theme']} title={a.dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        description="Appearance"
        icon={<IconSwap id={a.dark ? 'light' : 'dark'}>{a.dark ? <Tile tone="light" icon="sun-fill" size={28} /> : <Tile tone="dark" icon="moon-fill" size={28} />}</IconSwap>}
        onSelect={() => { a.toggleDark(); a.hud(a.dark ? 'Light Mode' : 'Dark Mode', a.dark ? 'sun-fill' : 'moon-fill'); }}
      />
      <CommandItem value="Lock Screen" keywords={['lock']} title="Lock Screen" icon={<Tile tone="lock" icon="lock-fill" size={28} />} shortcut="⌃⌘Q" onSelect={() => { a.close(); a.setPower('lock'); }} />
      <CommandItem value="Sleep" keywords={['sleep', 'display']} title="Sleep" icon={<Tile tone="sleep" icon="moon-fill" size={28} />} onSelect={() => { a.close(); a.setPower('sleep'); }} />
      <CommandItem
        value="Empty Trash" keywords={['trash', 'delete', 'bin']} title="Empty Trash" icon={<Tile tone="trash" icon={a.trash ? 'trash-fill' : 'trash'} size={28} />}
        description={a.trash ? `${a.trash} items · ${TRASH.size}` : 'Trash is empty'} dimmed={!a.trash} page={a.trash ? 'confirm:trash' : undefined}
        onSelect={a.trash ? undefined : () => a.hud('Trash is already empty', 'trash')}
      />
      <CommandItem value="Restart" keywords={['reboot']} title="Restart…" icon={<Tile tone="system" icon="arrow-clockwise" size={28} />} page="confirm:restart" />
      <CommandItem value="Shut Down" keywords={['power off', 'turn off']} title="Shut Down…" icon={<Tile tone="power" icon="power" size={28} />} page="confirm:shutdown" />
      <CommandItem value="Log Out" keywords={['sign out', 'user']} title="Log Out Brett Lamy…" icon={<Tile tone="system" icon="person-fill" size={28} />} page="confirm:logout" />
      <CommandItem value="Eject All" keywords={['eject', 'unmount', 'drives']} title="Eject All Volumes" icon={<Tile tone="system" icon="arrow-up-circle" size={28} />} onSelect={() => a.hud('Ejected 2 volumes', 'arrow-up-circle')} />
    </>
  );
}

export function SystemPage() {
  return <CommandPage id="system" title="System" placeholder="Search system commands…" numbered><CommandGroup heading="System"><SystemItems /></CommandGroup></CommandPage>;
}

const CONFIRM = {
  trash: { title: 'Empty Trash', action: 'Empty Trash', tone: 'trash', icon: 'trash-fill', body: `Permanently erase ${TRASH.items} items (${TRASH.size})? You can’t undo this.` },
  restart: { title: 'Restart', action: 'Restart', tone: 'system', icon: 'arrow-clockwise', body: 'Are you sure you want to restart your computer now?' },
  shutdown: { title: 'Shut Down', action: 'Shut Down', tone: 'power', icon: 'power', body: 'Are you sure you want to shut down your computer now?' },
  logout: { title: 'Log Out', action: 'Log Out', tone: 'system', icon: 'person-fill', body: 'Quit all apps and log out Brett Lamy?' },
} as const;
export type ConfirmId = keyof typeof CONFIRM;

export function ConfirmPage({ id }: { id: ConfirmId }) {
  const c = CONFIRM[id];
  const a = useAlfred();
  const { pop } = useCommandMenu();
  const confirm = () => {
    if (id === 'trash') { a.emptyTrash(); a.hud('Trash Emptied', 'trash'); pop(); return; }
    a.close();
    a.setPower(id === 'restart' ? 'restart' : id === 'shutdown' ? 'off' : 'lock');
  };
  return (
    <CommandPage id={`confirm:${id}`} title={c.title} placeholder="Confirm or go back…" filter={false} numbered>
      <div className="flex items-center gap-3.5 px-3 pt-3 pb-2">
        <Tile tone={c.tone} icon={c.icon} size={40} />
        <p className="m-0 text-[14px] leading-[20px] text-muted-foreground">{c.body}</p>
      </div>
      <CommandGroup>
        <CommandItem value="confirm" title={<span className={id === 'trash' || id === 'shutdown' ? 'font-medium text-destructive' : 'font-medium'}>{c.action}</span>} icon={<Icon name="check-circle-fill" size={20} sw={1.8} />} onSelect={confirm} />
        <CommandItem value="cancel" title="Cancel" icon={<Icon name="xmark-circle" size={20} sw={1.8} />} onSelect={() => pop()} />
      </CommandGroup>
    </CommandPage>
  );
}

/* ══ Web search ══ */

const ENGINE_TILE: Record<string, ReactNode> = {
  google: <Tile tone="google" size={28} glyph={<span className="text-[17px] font-bold" style={{ color: '#4285F4' }}>G</span>} />,
  github: <Tile tone="github" size={28} icon="branch" />,
  wikipedia: <Tile tone="wikipedia" size={28} dark glyph={<span className="font-serif text-[17px] font-semibold">W</span>} />,
  youtube: <Tile tone="youtube" size={28} icon="play" />,
  maps: <Tile tone="maps" size={28} icon="mappin-fill" />,
  amazon: <Tile tone="amazon" size={28} icon="cart" />,
};

function EngineItem({ engine, q, value }: { engine: Engine; q: string; value?: string }) {
  const a = useAlfred();
  return (
    <CommandItem
      value={value ?? engine.id} icon={ENGINE_TILE[engine.id]}
      // Fallbacks always "match" (their value holds the query): rank them under real results, and don't search the URL.
      boost={value ? 0.4 : 1} searchDescription={false}
      title={q ? <>Search {engine.name} for <span className="font-semibold">“{q}”</span></> : `Search ${engine.name}`}
      description={q ? `${engine.url}${encodeURIComponent(q)}` : engine.host} dimmed={!q}
      onSelect={() => (q ? a.hud(`Opening ${engine.name}…`, 'arrow-up-right') : a.hud('Type something to search', 'magnifyingglass'))}
    />
  );
}

export function WebPage() {
  const { query } = useCommandMenu();
  const q = query.trim();
  return (
    <CommandPage id="web" title="Web Search" placeholder="Search the web for…" filter={false} numbered>
      <CommandGroup heading={q ? 'Search for' : 'Type a query, then pick a site'}>
        {ENGINES.map((en) => <EngineItem key={en.id} engine={en} q={q} />)}
      </CommandGroup>
    </CommandPage>
  );
}

/* ══ Workflows ══ */

function WorkflowItems() {
  const a = useAlfred();
  return (
    <>
      <CommandItem value="Create GitHub Issue" keywords={['github', 'bug', 'issue', 'new']} title="Create GitHub Issue" description="Repository → title → label → create" icon={<Tile tone="github" icon="branch" size={28} />} page="gh-repo" onSelect={() => a.setIssue({ title: undefined, label: undefined })} />
      <CommandItem value="Start Timer" keywords={['timer', 'pomodoro', 'focus']} title="Start Timer" description="Length → label → start" icon={<Tile tone="timer" icon="clock-fill" size={28} />} page="timer" />
    </>
  );
}

export function WorkflowsPage() {
  return <CommandPage id="workflows" title="Workflows" placeholder="Search workflows…" numbered><CommandGroup heading="Workflows"><WorkflowItems /></CommandGroup></CommandPage>;
}

export function RepoPage() {
  const a = useAlfred();
  return (
    <CommandPage id="gh-repo" title="New Issue" placeholder="Choose a repository…" numbered>
      <CommandGroup heading="Repositories">
        {REPOS.map((r) => (
          <CommandItem
            key={r.name} value={r.name} keywords={[r.lang]} title={r.name} description={`${r.description} · ★ ${r.stars}`}
            icon={<Tile tone="github" icon="branch" size={28} />} page="gh-title" onSelect={() => a.setIssue({ repo: r.name })}
            badge={<span className="ml-auto inline-flex shrink-0 items-center gap-1.5 pl-3 text-[12.5px] text-muted-foreground"><span className="size-2.5 rounded-full" style={{ background: r.langColor }} />{r.lang}</span>}
          />
        ))}
      </CommandGroup>
    </CommandPage>
  );
}

export function IssueTitlePage() {
  const { query } = useCommandMenu();
  const a = useAlfred();
  const q = query.trim();
  return (
    <CommandPage id="gh-title" title={a.issue.repo ?? 'New Issue'} placeholder="Issue title…" filter={false}>
      <CommandGroup heading="Title">
        {q ? (
          <CommandItem value="title" icon={<Icon name="square-pencil" size={19} sw={1.8} />} title={`“${q}”`} description="Next: choose a label" page="gh-label" onSelect={() => a.setIssue({ title: q })} />
        ) : (
          <CommandItem value="title" icon={<Icon name="square-pencil" size={19} sw={1.8} />} title="Type a title for the new issue" description={`In ${a.issue.repo ?? 'a repository'}`} disabled />
        )}
      </CommandGroup>
    </CommandPage>
  );
}

export function LabelPage() {
  const a = useAlfred();
  return (
    <CommandPage id="gh-label" title="Label" placeholder="Choose a label…" numbered>
      <CommandGroup heading="Labels">
        {LABELS.map((l) => (
          <CommandItem
            key={l.id} value={l.name} title={l.name} description={l.description} page="gh-confirm" onSelect={() => a.setIssue({ label: l.id })}
            icon={<span className="size-3.5 rounded-full shadow-[inset_0_0_0_.5px_rgba(0,0,0,.15)]" style={{ background: l.color }} />}
          />
        ))}
        <CommandItem value="No label" title="No label" icon={<Icon name="minus-circle" size={18} sw={1.8} />} page="gh-confirm" onSelect={() => a.setIssue({ label: undefined })} />
      </CommandGroup>
    </CommandPage>
  );
}

export function IssueConfirmPage() {
  const a = useAlfred();
  const label = LABELS.find((l) => l.id === a.issue.label);
  return (
    <CommandPage id="gh-confirm" title="Confirm" placeholder="Create the issue?" filter={false} numbered>
      <div className="mx-1 mt-2 mb-1 rounded-[12px] border border-border bg-background/50 p-3.5">
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Icon name="branch" size={14} sw={2} />{a.issue.repo}</div>
        <div className="mt-1 text-[16px] leading-[22px] font-semibold">{a.issue.title}</div>
        {label ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ color: label.color, background: `color-mix(in oklab, ${label.color} 16%, transparent)` }}>
            <span className="size-2 rounded-full" style={{ background: label.color }} />{label.name}
          </span>
        ) : null}
      </div>
      <CommandGroup>
        <CommandItem value="create" title="Create Issue" icon={<Icon name="plus-circle-fill" size={20} sw={1.8} />} onSelect={() => { a.hud(`Issue #483 opened in ${a.issue.repo}`, 'check'); a.reset(); }} />
        <CommandItem value="cancel" title="Discard" icon={<Icon name="xmark-circle" size={20} sw={1.8} />} onSelect={() => { a.hud('Issue discarded', 'xmark'); a.reset(); }} />
      </CommandGroup>
    </CommandPage>
  );
}

export function TimerPage() {
  const a = useAlfred();
  return (
    <CommandPage id="timer" title="Timer" placeholder="How long?" numbered>
      <CommandGroup heading="Length">
        {TIMERS.map((t) => (
          <CommandItem
            key={t.minutes} value={`${t.minutes} minutes`} keywords={[t.name]} title={`${t.minutes} minutes`} description={t.name}
            icon={<Tile tone="timer" size={28} glyph={<span className="text-[12px] font-bold tabular-nums">{t.minutes}</span>} />}
            page="timer-name" onSelect={() => a.setTimerDraft(t.minutes)}
          />
        ))}
      </CommandGroup>
    </CommandPage>
  );
}

export function TimerNamePage() {
  const { query } = useCommandMenu();
  const a = useAlfred();
  const name = query.trim() || 'Focus';
  return (
    <CommandPage id="timer-name" title={`${a.timerDraft} min`} placeholder="What are you working on?" filter={false}>
      <CommandGroup heading="Start">
        <CommandItem
          value="start" icon={<Tile tone="timer" icon="clock-fill" size={28} />} title={`Start ${a.timerDraft}-minute timer`} description={name}
          onSelect={() => { a.startTimer(a.timerDraft, name); a.hud(`${a.timerDraft}:00 — ${name}`, 'clock-fill'); a.reset(); }}
        />
      </CommandGroup>
    </CommandPage>
  );
}

/* ══ Page lookup ══ */

export function renderPage(page: string, emojiColumns: number) {
  if (page === 'root') return <RootPage />;
  if (page === 'calc') return <CalculatorPage />;
  if (page === 'clipboard') return <ClipboardPage />;
  if (page === 'emoji') return <EmojiPage columns={emojiColumns} />;
  if (page === 'snippets') return <SnippetsPage />;
  if (page.startsWith('folder:')) return <FolderPage key={page} path={page.slice(7)} />;
  if (page === 'system') return <SystemPage />;
  if (page.startsWith('confirm:')) return <ConfirmPage id={page.slice(8) as ConfirmId} />;
  if (page === 'web') return <WebPage />;
  if (page === 'workflows') return <WorkflowsPage />;
  if (page === 'gh-repo') return <RepoPage />;
  if (page === 'gh-title') return <IssueTitlePage />;
  if (page === 'gh-label') return <LabelPage />;
  if (page === 'gh-confirm') return <IssueConfirmPage />;
  if (page === 'timer') return <TimerPage />;
  if (page === 'timer-name') return <TimerNamePage />;
  return null;
}
