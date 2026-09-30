/* ⌘K — jump anywhere and do anything. The root has the actions (start a run, Ask QA, copy the open reports,
   connect a tracker, share, switch the theme), the bug on screen's own commands (status, severity, copy), and
   "Go to" pages for projects (⌘1–⌘7), bugs (with a preview pane) and runs; typing at the root searches all of
   them at once. Nested pages keep their query and row when you come back (Backspace / ←).

   Hotkeys listen on the document but only act for this block — when focus is inside it, or nothing is focused and
   the pointer is over it — so a page hosting several blocks doesn't trigger them all:
   ⌘K palette · ⌘J Ask QA · ⇧⌘↵ start a run · ⇧⌘C copy open bug reports · ⇧⌘L light/dark · ⌘. change status of
   the open bug. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ContentSwap } from '@/components/ui/animated-height';
import { CommandEmpty, CommandFooter, CommandGroup, CommandInput, CommandItem, CommandList, CommandMenu, CommandPage, matchesHotkey, useCommandActive, useCommandMenu } from '@/components/ui/command-menu';
import { useContainerWidth } from '@/lib/container';
import { cn } from '@/lib/utils';
import { isOpen } from './agent';
import {
  PROJECTS, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABEL, TRACKERS, host, relativeTime, severityRank, type Bug,
} from './data';
import { EnvBadge, KindLabel, RunStatusBadge, SEVERITY_COLOR, STATUS_DOT, SeverityBadge, StatusBadge } from './parts';
import { useLoopQA } from './state';

export function Commands() {
  const qa = useLoopQA();
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const dark = qa.look === 'dark';

  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    const root = layer?.parentElement;
    if (!root) return;
    const active = document.activeElement;
    const mine = (active && active !== document.body && root.contains(active)) || ((!active || active === document.body) && root.matches(':hover'));
    if (!mine) return;
    const run = (fn: () => void) => { e.preventDefault(); fn(); };
    if (matchesHotkey(e, 'mod+k')) return run(() => (qa.palette.open ? qa.setPalette((s) => ({ ...s, open: false })) : qa.openPalette()));
    if (matchesHotkey(e, 'mod+j')) return run(() => qa.setAskOpen(!qa.askOpen));
    if (matchesHotkey(e, 'shift+mod+enter')) return run(() => qa.startRun(qa.project?.id ?? PROJECTS[0]!.id, 'Manual'));
    if (matchesHotkey(e, 'shift+mod+c')) return run(() => qa.copyBugReports(qa.project?.id ?? PROJECTS[0]!.id));
    if (matchesHotkey(e, 'shift+mod+l')) return run(() => qa.setLook(dark ? 'light' : 'dark'));
    if (qa.currentBug && matchesHotkey(e, 'mod+.')) return run(() => qa.openPalette(['status']));
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => !e.defaultPrevented && keys.current(e);
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, []);

  return (
    <>
      {/* The palette portals here: inside the block's theme, and its scrim covers just the block. */}
      <div ref={setLayer} className="contents" />
      <Palette key={qa.palette.key} container={layer} />
    </>
  );
}

function Palette({ container }: { container: Element | null }) {
  const qa = useLoopQA();
  const [ref, width] = useContainerWidth<HTMLDivElement>(640);
  const project = qa.project ?? PROJECTS[0]!;
  const bug = qa.currentBug ? qa.bugs.find((b) => b.id === qa.currentBug) : undefined;
  const openBugs = [...qa.bugs.filter(isOpen)].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.discovered.localeCompare(a.discovered));
  const dark = qa.look === 'dark';

  const bugItem = (b: Bug) => (
    <CommandItem key={b.id} value={`bug ${b.id}`} keywords={[b.id, b.title, b.kind]} searchDescription={false}
      icon={<span className="size-2.5 rounded-full bg-(--c)" style={{ '--c': SEVERITY_COLOR[b.severity] } as CSSProperties} />}
      title={b.title} description={`${b.id} · ${PROJECTS.find((p) => p.id === b.projectId)?.name ?? ''}`}
      onSelect={() => qa.open({ kind: 'bug', id: b.id })} />
  );

  return (
    <CommandMenu
      variant="dialog"
      isOpen={qa.palette.open}
      onOpenChange={(o) => qa.setPalette((s) => ({ ...s, open: o }))}
      defaultPages={qa.palette.pages}
      container={container}
      ranking="global"
      aria-label="Command menu"
      className="w-full [--command-surface:var(--popover)] shadow-[0_28px_80px_-12px_--alpha(black/45%),0_0_0_1px_var(--border)]"
      style={{ maxWidth: 680 }}
    >
      <CommandInput placeholder="Search projects, bugs and runs, or type a command…" />
      <div ref={ref} className="flex min-h-0 border-t border-border">
        <div className="min-w-0 flex-1">
          <CommandList maxHeight={400}>
            <CommandEmpty>No results</CommandEmpty>

            <CommandPage id="root">
              {bug ? (
                <CommandGroup heading={`This bug · ${bug.id}`}>
                  <CommandItem icon="checkmark-circle" title="Change status…" description={STATUS_LABEL[bug.status]} shortcut="⌘." page="status" searchDescription={false} />
                  <CommandItem icon="flag" title="Change severity…" description={SEVERITY_LABEL[bug.severity]} page="severity" searchDescription={false} />
                  <CommandItem icon="copy" title="Copy bug report" description="Markdown, ready for a coding agent" onSelect={() => qa.copyBugReport(bug.id)} />
                </CommandGroup>
              ) : null}
              <CommandGroup heading="Actions">
                <CommandItem icon="play" title={`Start test run on ${project.name}`} value="Start test run" keywords={['run', 'test', 'qa', project.name]} shortcut="⇧⌘↵"
                  disabled={qa.runs.some((r) => r.status === 'running')} onSelect={() => qa.startRun(project.id, 'Manual')} />
                <CommandItem icon="sparkle" title={qa.askOpen ? 'Hide Ask QA' : 'Ask QA'} keywords={['chat', 'agent', 'assistant']} shortcut="⌘J" onSelect={() => qa.setAskOpen(!qa.askOpen)} />
                <CommandItem icon="copy" title="Copy open bug reports" description={`${qa.bugs.filter((b) => b.projectId === project.id && isOpen(b)).length} reports from ${project.name}`} shortcut="⇧⌘C"
                  keywords={['markdown', 'export']} onSelect={() => qa.copyBugReports(project.id)} />
                <CommandItem icon="link" title="Connect issue tracker…" keywords={['linear', 'jira', 'github', 'slack', 'integration']} page="tracker" />
                <CommandItem icon="share" title="Share project…" keywords={['invite', 'members', 'link']} onSelect={() => qa.setDialog('share')} />
                <CommandItem icon={dark ? 'sun' : 'moon'} title={dark ? 'Switch to light theme' : 'Switch to dark theme'} value="Toggle theme" keywords={['appearance', 'dark', 'light', 'mode']} shortcut="⇧⌘L"
                  onSelect={() => qa.setLook(dark ? 'light' : 'dark')} />
              </CommandGroup>
              <CommandGroup heading="Go to">
                <CommandItem icon="grid" title="All projects" onSelect={() => qa.openSection('projects')} />
                <CommandItem icon="folder-closed" title="Project…" page="projects" chevron />
                <CommandItem icon="exclamation-circle" title="Bug…" description={`${openBugs.length} open`} page="bugs" chevron searchDescription={false} />
                <CommandItem icon="checklist" title="Test run…" page="runs" chevron />
              </CommandGroup>
              <SearchOnly>
                <CommandGroup heading="Projects">
                  {PROJECTS.map((p) => (
                    <CommandItem key={p.id} value={`project ${p.name}`} keywords={[p.name, host(p.url)]} icon={<Swatch color={p.brand} />} title={p.name} description={host(p.url)}
                      onSelect={() => qa.openSection(p.id)} />
                  ))}
                </CommandGroup>
                <CommandGroup heading="Bugs">{openBugs.map(bugItem)}</CommandGroup>
                <CommandGroup heading="Runs">
                  {qa.runs.map((r) => (
                    <CommandItem key={r.id} value={`run ${r.id} ${r.title}`} keywords={[r.title, `#${r.id.slice(4)}`]} icon="checklist" title={r.title}
                      description={`#${r.id.slice(4)} · ${PROJECTS.find((p) => p.id === r.projectId)?.name} · ${r.status}`} searchDescription={false}
                      onSelect={() => qa.open({ kind: 'run', id: r.id })} />
                  ))}
                </CommandGroup>
              </SearchOnly>
            </CommandPage>

            <CommandPage id="projects" title="Projects" placeholder="Search projects…" numbered>
              <CommandGroup heading="Projects">
                {PROJECTS.map((p) => (
                  <CommandItem key={p.id} value={p.name} keywords={[host(p.url)]} icon={<Swatch color={p.brand} />} title={p.name} description={host(p.url)}
                    badge={<span className="text-caption text-muted-foreground tabular-nums">{qa.bugs.filter((b) => b.projectId === p.id && isOpen(b)).length} open</span>}
                    onSelect={() => qa.openSection(p.id)} />
                ))}
              </CommandGroup>
            </CommandPage>

            <CommandPage id="bugs" title="Bugs" placeholder="Search open bugs…">
              {SEVERITIES.map((s) => (
                <CommandGroup key={s} heading={SEVERITY_LABEL[s]}>{openBugs.filter((b) => b.severity === s).map(bugItem)}</CommandGroup>
              ))}
            </CommandPage>

            <CommandPage id="runs" title="Test runs" placeholder="Search runs…">
              <CommandGroup heading="Recent runs">
                {qa.runs.map((r) => (
                  <CommandItem key={r.id} value={`${r.title} #${r.id.slice(4)}`} icon="checklist" title={r.title}
                    description={`#${r.id.slice(4)} · ${PROJECTS.find((p) => p.id === r.projectId)?.name} · ${r.status === 'running' ? 'running now' : relativeTime(r.started)}`}
                    badge={<RunStatusBadge status={r.status} />} onSelect={() => qa.open({ kind: 'run', id: r.id })} />
                ))}
              </CommandGroup>
            </CommandPage>

            <CommandPage id="status" title={bug ? `${bug.id} status` : 'Status'} placeholder="Set status…" numbered>
              <CommandGroup heading="Status">
                {STATUSES.map((s) => (
                  <CommandItem key={s} value={STATUS_LABEL[s]} icon={<span className={cn('size-2.5 rounded-full', STATUS_DOT[s])} />} title={STATUS_LABEL[s]}
                    badge={bug?.status === s ? <span className="text-caption text-muted-foreground">Current</span> : undefined}
                    disabled={!bug} onSelect={() => { if (bug) { qa.setBugStatus(bug.id, s); qa.toast.hud(`${bug.id} → ${STATUS_LABEL[s]}`); } }} />
                ))}
              </CommandGroup>
            </CommandPage>

            <CommandPage id="severity" title={bug ? `${bug.id} severity` : 'Severity'} placeholder="Set severity…" numbered>
              <CommandGroup heading="Severity">
                {SEVERITIES.map((s) => (
                  <CommandItem key={s} value={SEVERITY_LABEL[s]} icon={<Swatch color={SEVERITY_COLOR[s]} round />} title={SEVERITY_LABEL[s]}
                    badge={bug?.severity === s ? <span className="text-caption text-muted-foreground">Current</span> : undefined}
                    disabled={!bug} onSelect={() => { if (bug) { qa.setBugSeverity(bug.id, s); qa.toast.hud(`${bug.id} → ${SEVERITY_LABEL[s]}`); } }} />
                ))}
              </CommandGroup>
            </CommandPage>

            <CommandPage id="tracker" title="Issue tracker" placeholder="Connect a tracker…">
              <CommandGroup heading="Issue trackers">
                {TRACKERS.map((t) => (
                  <CommandItem key={t.id} value={t.name} icon={<Swatch color={t.color} />} title={t.name} description={t.detail}
                    badge={qa.trackers.includes(t.id) ? <span className="text-caption font-medium text-success">Connected</span> : undefined}
                    onSelect={() => qa.connectTracker(t.id, t.name)} />
                ))}
              </CommandGroup>
            </CommandPage>
          </CommandList>
        </div>
        <BugPreview wide={width >= 600} />
      </div>
      <CommandFooter />
    </CommandMenu>
  );
}

/** Rows that only show while typing at the root (the root lists actions until you search). */
function SearchOnly({ children }: { children: ReactNode }) {
  const { query } = useCommandMenu();
  return query.trim() ? <>{children}</> : null;
}

/** On the Bugs page (wide palettes), the active bug's summary beside the list. */
function BugPreview({ wide }: { wide: boolean }) {
  const { page } = useCommandMenu();
  const active = useCommandActive();
  const qa = useLoopQA();
  if (!wide || page !== 'bugs') return null;
  const b = active?.startsWith('bug ') ? qa.bugs.find((x) => x.id === active.slice(4)) : undefined;
  return (
    <aside className="relative w-[44%] shrink-0 animate-bl-fade-in border-l border-border">
      <div className="absolute inset-0 overflow-hidden">
        <ContentSwap id={b?.id ?? 'none'} className="h-full [&>*]:h-full">
          {b ? (
            <div className="flex h-full flex-col gap-2.5 p-4">
              <div className="flex flex-wrap items-center gap-1.5"><SeverityBadge severity={b.severity} /><StatusBadge status={b.status} /><EnvBadge env={b.environment} /></div>
              <div className="text-detail leading-[19px] font-semibold">{b.title}</div>
              <p className="m-0 line-clamp-5 text-[12.5px] leading-[18px] text-muted-foreground">{b.summary}</p>
              <dl className="m-0 mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border pt-3 text-caption">
                <dt className="text-muted-foreground">Kind</dt><dd className="m-0"><KindLabel kind={b.kind} className="text-caption" /></dd>
                <dt className="text-muted-foreground">Found</dt><dd className="m-0">{relativeTime(b.discovered)} · run #{b.runId.slice(4)}</dd>
                <dt className="text-muted-foreground">Journey</dt><dd className="m-0 truncate">{b.journey}</dd>
              </dl>
            </div>
          ) : <div className="grid h-full place-items-center text-footnote text-tertiary-foreground">No bug selected</div>}
        </ContentSwap>
      </div>
    </aside>
  );
}

function Swatch({ color, round }: { color: string; round?: boolean }) {
  return <span className={round ? 'size-2.5 rounded-full bg-(--c)' : 'size-3 rounded-sm bg-(--c)'} style={{ '--c': color } as CSSProperties} />;
}
