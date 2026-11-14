import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CommandMenu,
  CommandMenuDialog,
  CommandMenuDialogContent,
  CommandMenuEmpty,
  CommandMenuFooter,
  CommandMenuGroup,
  CommandMenuGroupLabel,
  CommandMenuInput,
  CommandMenuItem,
  CommandMenuList,
  CommandMenuPage,
  CommandMenuShortcut,
  useCommandMenu,
  type CommandMenuDialogProps,
} from '@/components/ui/command-menu';
import {
  CONTENT_INDEX,
  FILES,
  GITHUB_REPOS,
  LOCAL_FOLDERS,
  PULL_REQUESTS,
  threadUuid,
  type Project,
} from '../lib/data';
import type { ThreadsState } from '../lib/use-threads';

/* The ⌘K palette, after T3 Code's: Actions at the root, "New thread in…" and "Add project" drill into pages
   (Backspace or the back arrow returns, with the query you had), ⌘1–⌘6 pick a project. */

export interface CommandPaletteProps {
  open: boolean;
  /** The dialog's own change details (Escape, the scrim, a pick that closes it…); `details.cancel()` keeps it as it is. */
  onOpenChange: NonNullable<CommandMenuDialogProps['onOpenChange']>;
  /** Pages to open on (a hotkey like ⌘P opens straight onto "Go to file"). */
  pages?: string[];
  /** Portal target inside the Workbench, so the palette keeps its palette and its scrim covers the block. */
  container: Element | null;
  threads: ThreadsState;
  project: string;
  projects: Project[];
  onNewThread: (project: string) => void;
  onAddProject: (project: Project) => void;
  linked: number[];
  onLink: (pr: number) => void;
  onOpenFile: (path: string) => void;
  onToggleThemeEditor: () => void;
  notify: (message: string) => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const { open, onOpenChange, pages, container, threads, project, projects, linked } = props;
  const thread = threads.current;
  const id = thread ? threadUuid(thread.id) : null;
  const copy = (text: string, message: string) => {
    void navigator.clipboard?.writeText(text).catch(() => {});
    props.notify(message);
  };
  const add = (name: string, path: string) => {
    props.onAddProject({ name, path, color: '#64D2FF' });
    props.notify(`Added ${name}`);
  };

  return (
    <CommandMenuDialog open={open} onOpenChange={onOpenChange} container={container}>
      <CommandMenuDialogContent aria-label="Command palette" className="max-w-[580px]">
        <CommandMenu
          defaultPages={pages}
          // T3's palette sits a step darker than the popovers, on the app's own background.
          className="[--command-surface:var(--background)] shadow-[0_24px_80px_color-mix(in_srgb,black_45%,transparent),0_0_0_1px_var(--border)]"
        >
          <CommandMenuInput placeholder="Search commands, projects, and threads..." />
          <CommandMenuEmpty>No results</CommandMenuEmpty>
          <CommandMenuList className="max-h-99">
            <CommandMenuPage>
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
                <CommandMenuItem
                  icon="square-pencil"
                  value={`New thread in ${project}`}
                  label={`New thread in ${project}`}
                  title={<>New thread in <b className="font-semibold">{project}</b></>}
                  trailing={<CommandMenuShortcut shortcut="mod+shift+o" />}
                  onSelect={() => props.onNewThread(project)}
                />
                <CommandMenuItem icon="square-pencil" title="New thread in..." value="New thread in…" keywords={['project']} page="projects" />
                <CommandMenuItem
                  icon="link"
                  title="Copy thread ID"
                  description={id ?? 'Start a thread first'}
                  trailing={<CommandMenuShortcut shortcut="mod+shift+c" />}
                  disabled={!id}
                  onSelect={() => id && copy(id, 'Copied thread ID')}
                />
                <CommandMenuItem icon={<PullRequestIcon />} title="Link pull request to thread" disabled={!thread} page="link-pr" chevron={false} />
                <CommandMenuItem icon={<PullRequestIcon />} title="Show linked pull requests" disabled={!linked.length} page="linked-prs" chevron={false} />
                <CommandMenuItem icon={<FileSearchIcon />} title="Go to file" trailing={<CommandMenuShortcut shortcut="mod+p" />} page="files" chevron={false} />
                <CommandMenuItem icon={<ContentSearchIcon />} title="Search project contents" trailing={<CommandMenuShortcut shortcut="mod+shift+f" />} keywords={['grep', 'find']} page="search" chevron={false} />
                <CommandMenuItem icon="folder-plus" title="Add project" keywords={['clone', 'open']} page="add-project" chevron={false} />
                <CommandMenuItem icon={<PaletteIcon />} title="Toggle theme editor" trailing={<CommandMenuShortcut shortcut="mod+alt+shift+t" />} keywords={['appearance', 'dark', 'light', 'tint']} onSelect={props.onToggleThemeEditor} />
              </CommandMenuGroup>
              <SearchOnly>
                <CommandMenuGroup>
                  <CommandMenuGroupLabel>Projects</CommandMenuGroupLabel>
                  {projects.map((p) => (
                    <CommandMenuItem key={p.name} value={`project ${p.name}`} icon={<Monogram project={p} />} title={p.name} description={`Local · ${p.path}`} keywords={[p.name]} onSelect={() => props.onNewThread(p.name)} />
                  ))}
                </CommandMenuGroup>
              </SearchOnly>
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Threads</CommandMenuGroupLabel>
                {threads.threads.slice(0, 8).map((t) => (
                  <CommandMenuItem key={t.id} value={`thread ${t.id} ${t.title}`} keywords={[t.title]} icon="bubble-left" title={t.title} description={t.age} onSelect={() => threads.select(t.id)} />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="projects" numbered>
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Projects</CommandMenuGroupLabel>
                {projects.map((p) => (
                  <CommandMenuItem key={p.name} value={p.name} icon={<Monogram project={p} />} title={p.name} description={`Local · ${p.path}`} onSelect={() => props.onNewThread(p.name)} />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="link-pr" placeholder="Search pull requests...">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Open pull requests</CommandMenuGroupLabel>
                {PULL_REQUESTS.map((pr) => (
                  <CommandMenuItem
                    key={pr.number}
                    value={`#${pr.number} ${pr.title}`}
                    keywords={[pr.branch, pr.author]}
                    icon={<PullRequestIcon />}
                    title={pr.title}
                    description={`#${pr.number} · ${pr.branch} · ${pr.author}`}
                    trailing={linked.includes(pr.number) ? <Badge variant="secondary" className="rounded-md">Linked</Badge> : undefined}
                    disabled={linked.includes(pr.number)}
                    onSelect={() => {
                      props.onLink(pr.number);
                      props.notify(`Linked #${pr.number}`);
                    }}
                  />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="linked-prs" placeholder="Search linked pull requests...">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Linked to this thread</CommandMenuGroupLabel>
                {PULL_REQUESTS.filter((pr) => linked.includes(pr.number)).map((pr) => (
                  <CommandMenuItem key={pr.number} value={`#${pr.number} ${pr.title}`} icon={<PullRequestIcon />} title={pr.title} description={`#${pr.number} · ${pr.branch}`} trailing={<CommandMenuShortcut shortcut="enter" />} onSelect={() => props.notify(`Opened #${pr.number}`)} />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="files" placeholder="Go to file...">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Files</CommandMenuGroupLabel>
                {FILES.map((f) => {
                  const parts = f.split('/');
                  return <CommandMenuItem key={f} value={f} keywords={[parts[parts.length - 1]]} icon="doc-text" title={parts[parts.length - 1]} description={parts.slice(0, -1).join('/')} onSelect={() => props.onOpenFile(f)} />;
                })}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="search" placeholder="Search project contents..." filter={false}>
              <ContentResults onOpen={props.onOpenFile} />
            </CommandMenuPage>

            <CommandMenuPage value="add-project">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Sources</CommandMenuGroupLabel>
                <CommandMenuItem icon="folder-plus" title="Local folder" description="Browse a folder on disk" page="local-folder" chevron={false} />
                <CommandMenuItem icon="link" title="Git URL" description="Clone from a remote URL" page="git-url" chevron={false} />
                <CommandMenuItem icon={<GitHubIcon />} title="GitHub repository" description="Clone GitHub owner/repo" page="github" chevron={false} />
                {SETUP.map((s) => (
                  <CommandMenuItem
                    key={s.title}
                    icon={s.icon}
                    title={s.title}
                    description={s.description}
                    dimmed
                    trailing={<SetupRequired />}
                    closeOnSelect={false}
                    onSelect={() => props.notify(`Connect ${s.short} in Settings first`)}
                  />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="local-folder" placeholder="Search folders...">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Folders</CommandMenuGroupLabel>
                {LOCAL_FOLDERS.map((f) => (
                  <CommandMenuItem key={f} value={f} icon="folder-closed" title={f.split('/').pop()} description={f} onSelect={() => add(f.split('/').pop()!, f)} />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>

            <CommandMenuPage value="git-url" placeholder="https://github.com/owner/repo.git" filter={false}>
              <GitUrl onClone={(url) => add(url.replace(/\.git$/, '').split(/[/:]/).pop() || 'repo', url)} />
            </CommandMenuPage>

            <CommandMenuPage value="github" placeholder="Search owner/repo...">
              <CommandMenuGroup>
                <CommandMenuGroupLabel>Repositories</CommandMenuGroupLabel>
                {GITHUB_REPOS.map((r) => (
                  <CommandMenuItem key={r} value={r} icon={<GitHubIcon />} title={r} description={`github.com/${r}`} onSelect={() => add(r.split('/')[1], `~/Code/${r.split('/')[1]}`)} />
                ))}
              </CommandMenuGroup>
            </CommandMenuPage>
          </CommandMenuList>
          <CommandMenuFooter />
        </CommandMenu>
      </CommandMenuDialogContent>
    </CommandMenuDialog>
  );
}

/** Children only while there is a query (the root lists projects once you search). */
function SearchOnly({ children }: { children: ReactNode }) {
  return useCommandMenu().query.trim() ? <>{children}</> : null;
}

function ContentResults({ onOpen }: { onOpen: (path: string) => void }) {
  const { query } = useCommandMenu();
  const q = query.trim().toLowerCase();
  if (!q) return <div className="px-3 py-8 text-center text-detail text-muted-foreground">Type to search {CONTENT_INDEX.length} indexed lines</div>;
  const hits = CONTENT_INDEX.filter((l) => l.text.toLowerCase().includes(q) || l.file.toLowerCase().includes(q));
  return (
    <CommandMenuGroup>
      <CommandMenuGroupLabel>{`${hits.length} result${hits.length === 1 ? '' : 's'}`}</CommandMenuGroupLabel>
      {hits.map((l) => (
        <CommandMenuItem
          key={`${l.file}:${l.line}`}
          value={`${l.file}:${l.line}`}
          icon={<ContentSearchIcon />}
          title={<span className="font-mono text-footnote"><Exact text={l.text} query={q} /></span>}
          description={`${l.file}:${l.line}`}
          onSelect={() => onOpen(`cookbook/${l.file}`)}
        />
      ))}
    </CommandMenuGroup>
  );
}

/** Substring highlight (a grep result is literal, not fuzzy). */
function Exact({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[3px] bg-warning/25 text-foreground">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

function GitUrl({ onClone }: { onClone: (url: string) => void }) {
  const { query } = useCommandMenu();
  const url = query.trim();
  const valid = /^(https?:\/\/|git@|ssh:\/\/)\S+[/:]\S+$/.test(url);
  return (
    <CommandMenuGroup>
      <CommandMenuGroupLabel>Clone</CommandMenuGroupLabel>
      <CommandMenuItem
        value="clone"
        icon="link"
        title={url ? `Clone ${url}` : 'Paste a repository URL'}
        description={url ? (valid ? 'Clones into ~/Code and adds the project' : 'Not a git URL yet — https://… or git@…') : 'HTTPS or SSH'}
        disabled={!valid}
        onSelect={() => onClone(url)}
      />
    </CommandMenuGroup>
  );
}

export function Monogram({ project }: { project: Project }) {
  const words = project.name.split(/[-_\s]+/).filter(Boolean);
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : project.name.slice(0, 2)).toUpperCase();
  return (
    <span
      className="grid size-[22px] place-items-center rounded-[5px] font-mono text-[10px] font-bold tracking-[-.02em]"
      style={{ color: project.color, background: `color-mix(in oklab, ${project.color} 17%, transparent)` }}
    >
      {letters}
    </span>
  );
}

function SetupRequired() {
  return (
    <Badge
      variant="outline"
      className="ml-auto h-7 rounded-md px-2.5 text-footnote font-medium text-warning/85 shadow-hairline"
    >
      Setup Required
    </Badge>
  );
}

const svg = (children: ReactNode, fill = false) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

function PullRequestIcon() {
  return svg(
    <>
      <circle cx="6" cy="5.5" r="2.2" />
      <circle cx="6" cy="18.5" r="2.2" />
      <circle cx="18" cy="18.5" r="2.2" />
      <path d="M6 7.7v8.6M18 16.3V9.5a2.5 2.5 0 0 0-2.5-2.5H11m0 0 2.4-2.4M11 7l2.4 2.4" />
    </>,
  );
}
function FileSearchIcon() {
  return svg(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <circle cx="11.5" cy="14" r="2.3" />
      <path d="m13.2 15.7 1.8 1.8" />
    </>,
  );
}
function ContentSearchIcon() {
  return svg(
    <>
      <path d="M4 6h11M4 11h6M4 16h5" />
      <circle cx="15.5" cy="14.5" r="3" />
      <path d="m17.7 16.7 2.3 2.3" />
    </>,
  );
}
function PaletteIcon() {
  return svg(
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2A4.6 4.6 0 0 0 21 10.6C21 6.4 17 3 12 3z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15" cy="7.8" r="1" />
    </>,
  );
}
function GitHubIcon() {
  return svg(
    <path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.7-.2.7-.5v-1.7c-2.7.6-3.2-1.2-3.2-1.2-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1.1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 0 1 4.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.2 4.5-4.3 4.7.3.3.6.9.6 1.8v2.6c0 .3.2.6.7.5A9.5 9.5 0 0 0 12 2.5z" />,
    true,
  );
}

const SETUP: { title: string; short: string; description: string; icon: ReactNode }[] = [
  {
    title: 'Azure DevOps repository',
    short: 'Azure DevOps',
    description: 'Clone Azure DevOps project/repository',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
        <path d="M3 17.5 9.5 4h4.2l-3.9 9.6 4.9 5.8L3 21z" fill="#1D6FD8" />
        <path d="M14.4 5.3 21 19.8l-9.4 1.2 3.6-2.2z" fill="#39A0F4" />
      </svg>
    ),
  },
  {
    title: 'Bitbucket repository',
    short: 'Bitbucket',
    description: 'Clone Bitbucket workspace/repository',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
        <path d="M3.2 3.5h17.6a.7.7 0 0 1 .7.8L19 19.6a1 1 0 0 1-1 .9H6a1 1 0 0 1-1-.9L2.5 4.3a.7.7 0 0 1 .7-.8zm6.6 11h4.4l1-5.8H8.8z" fill="#2E6BE6" />
      </svg>
    ),
  },
  {
    title: 'Forgejo / Gitea repository',
    short: 'Forgejo / Gitea',
    description: 'Clone Forgejo / Gitea owner/repo',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#E0541F" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M8 21V9a5 5 0 0 1 5-5h3M8 21v-3a5 5 0 0 1 5-5h3" />
        <circle cx="18" cy="4" r="1.8" />
        <circle cx="18" cy="13" r="1.8" />
        <circle cx="8" cy="21" r="0.6" />
      </svg>
    ),
  },
];
