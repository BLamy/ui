/* ⌘K — jump anywhere and do anything. The root has the actions (start a run, Ask QA, copy the open reports,
   connect a tracker, share, switch the theme), the bug on screen's own commands (status, severity, copy), and
   "Go to" pages for projects (⌘1–⌘7), bugs (with a preview pane) and runs; typing at the root searches all of
   them at once. Nested pages keep their query and row when you come back (Backspace / ←).

   Hotkeys are page shortcuts (UI SDK's `useShortcut`) that only act for this block — when focus is inside it, or
   nothing is focused and the pointer is over it — so a page hosting several blocks doesn't trigger them all:
   ⌘K palette · ⌘J Ask QA · ⇧⌘↵ start a run · ⇧⌘C copy open bug reports · ⇧⌘L light/dark · ⌘. change status of
   the open bug. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useShortcut } from '@brett_lamy/ui/sdk/react/shortcuts';
import { Swap } from '@/components/ui/swap';
import {
  CommandMenu, CommandMenuDialog, CommandMenuDialogContent, CommandMenuEmpty, CommandMenuFooter, CommandMenuGroup, CommandMenuGroupLabel,
  CommandMenuInput, CommandMenuItem, CommandMenuList, CommandMenuPage, CommandMenuShortcut, useCommandMenu, useCommandMenuValue,
} from '@/components/ui/command-menu';
import { useContainerWidth } from '@/lib/container';
import { cn } from '@/lib/utils';
import { isOpen } from './agent';
import {
  PROJECTS, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABEL, TRACKERS, host, relativeTime, severityRank, type Bug,
} from './data';
import { EnvBadge, KindLabel, RunStatusBadge, SEVERITY_COLOR, STATUS_DOT, SeverityBadge, StatusBadge } from './parts';
import { useLoopQA } from './state';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';

export function Commands() {
  const qa = useLoopQA();
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const dark = qa.look === 'dark';

  /** Whether a key press is this block's: focus is inside it, or nothing is focused and the pointer is over it. */
  const mine = () => {
    const root = layer?.parentElement;
    if (!root) return false;
    const active = document.activeElement;
    return (!!active && active !== document.body && root.contains(active)) || ((!active || active === document.body) && root.matches(':hover'));
  };
  const project = () => qa.project?.id ?? PROJECTS[0]!.id;
  useShortcut('mod+k', () => qa.openPalette(), { when: mine, description: 'Search Loop QA' });
  useShortcut('mod+j', () => qa.setAskOpen(!qa.askOpen), { when: mine, description: 'Ask QA' });
  useShortcut('shift+mod+enter', () => qa.startRun(project(), 'Manual'), { when: mine, description: 'Start a test run' });
  useShortcut('shift+mod+c', () => qa.copyBugReports(project()), { when: mine, description: 'Copy open bug reports' });
  useShortcut('shift+mod+l', () => qa.setLook(dark ? 'light' : 'dark'), { when: mine, description: 'Switch the theme' });
  useShortcut(qa.currentBug ? 'mod+.' : null, () => qa.openPalette(['status']), { when: mine, description: 'Change the bug’s status' });

  return (
    <>
      {/* The palette portals here: inside the block's theme, and its scrim covers just the block. */}
      <div ref={setLayer} className="contents" />
      <Palette key={qa.palette.key} container={layer} />
    </>
  );
}

function Palette({ container }: { container: HTMLElement | null }) {
  const qa = useLoopQA();
  const [ref, width] = useContainerWidth<HTMLDivElement>(640);
  const project = qa.project ?? PROJECTS[0]!;
  const bug = qa.currentBug ? qa.bugs.find((b) => b.id === qa.currentBug) : undefined;
  const openBugs = [...qa.bugs.filter(isOpen)].sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.discovered.localeCompare(a.discovered));
  const dark = qa.look === 'dark';
  const close = () => qa.setPalette((s) => ({ ...s, open: false }));
  // ⌘K again closes it (the page's ⌘K pauses while the palette is up).
  useShortcut(qa.palette.open ? 'mod+k' : null, close, { layer: ref });

  const bugItem = (b: Bug) => (
    <CommandMenuItem key={b.id} value={`bug ${b.id}`} label={b.title} keywords={[b.id, b.kind]}
      icon={<span className="size-2.5 rounded-full bg-(--c)" style={{ '--c': SEVERITY_COLOR[b.severity] } as CSSProperties} />}
      title={b.title} description={`${b.id} · ${PROJECTS.find((p) => p.id === b.projectId)?.name ?? ''}`}
      onSelect={() => qa.open({ kind: 'bug', id: b.id })} />
  );
  const hint = (keys: string) => <CommandMenuShortcut shortcut={keys} />;

  return (
    <CommandMenuDialog open={qa.palette.open} onOpenChange={(o) => qa.setPalette((s) => ({ ...s, open: o }))} container={container}>
      <CommandMenuDialogContent aria-label="Command menu" className="max-w-[680px]">
        <CommandMenu
          defaultPages={qa.palette.pages}
          className="w-full [--command-surface:var(--popover)] shadow-[0_28px_80px_-12px_--alpha(black/45%),0_0_0_1px_var(--border)]"
        >
          <CommandMenuInput placeholder="Search projects, bugs and runs, or type a command…" />
          <div ref={ref} className="flex min-h-0 border-t border-border">
            <div className="min-w-0 flex-1">
              <CommandMenuEmpty>No results</CommandMenuEmpty>
              <CommandMenuList className="max-h-100">
                <CommandMenuPage>
                  {bug ? (
                    <CommandMenuGroup>
                      <CommandMenuGroupLabel>This bug · {bug.id}</CommandMenuGroupLabel>
                      <CommandMenuItem icon="checkmark-circle" title="Change status…" label="Change status" description={STATUS_LABEL[bug.status]} trailing={hint('mod+.')} page="status" />
                      <CommandMenuItem icon="flag" title="Change severity…" label="Change severity" description={SEVERITY_LABEL[bug.severity]} page="severity" />
                      <CommandMenuItem icon="copy" title="Copy bug report" description="Markdown, ready for a coding agent" onSelect={() => qa.copyBugReport(bug.id)} />
                    </CommandMenuGroup>
                  ) : null}
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
                    <CommandMenuItem icon="play" title={`Start test run on ${project.name}`} value="Start test run" keywords={['run', 'test', 'qa', project.name]} trailing={hint('shift+mod+enter')}
                      disabled={qa.runs.some((r) => r.status === 'running')} onSelect={() => qa.startRun(project.id, 'Manual')} />
                    <CommandMenuItem icon="sparkle" title={qa.askOpen ? 'Hide Ask QA' : 'Ask QA'} keywords={['chat', 'agent', 'assistant']} trailing={hint('mod+j')} onSelect={() => qa.setAskOpen(!qa.askOpen)} />
                    <CommandMenuItem icon="copy" title="Copy open bug reports" description={`${qa.bugs.filter((b) => b.projectId === project.id && isOpen(b)).length} reports from ${project.name}`} trailing={hint('shift+mod+c')}
                      keywords={['markdown', 'export']} onSelect={() => qa.copyBugReports(project.id)} />
                    <CommandMenuItem icon="link" title="Connect issue tracker…" keywords={['linear', 'jira', 'github', 'slack', 'integration']} page="tracker" />
                    <CommandMenuItem icon="share" title="Share project…" keywords={['invite', 'members', 'link']} onSelect={() => qa.setDialog('share')} />
                    <CommandMenuItem icon={dark ? 'sun' : 'moon'} title={dark ? 'Switch to light theme' : 'Switch to dark theme'} value="Toggle theme" keywords={['appearance', 'dark', 'light', 'mode']} trailing={hint('shift+mod+l')}
                      onSelect={() => qa.setLook(dark ? 'light' : 'dark')} />
                  </CommandMenuGroup>
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Go to</CommandMenuGroupLabel>
                    <CommandMenuItem icon="grid" title="All projects" onSelect={() => qa.openSection('projects')} />
                    <CommandMenuItem icon="folder-closed" title="Project…" page="projects" />
                    <CommandMenuItem icon="exclamation-circle" title="Bug…" label="Bug" description={`${openBugs.length} open`} page="bugs" />
                    <CommandMenuItem icon="checklist" title="Test run…" page="runs" />
                  </CommandMenuGroup>
                  <SearchOnly>
                    <CommandMenuGroup>
                      <CommandMenuGroupLabel>Projects</CommandMenuGroupLabel>
                      {PROJECTS.map((p) => (
                        <CommandMenuItem key={p.id} value={`project ${p.name}`} keywords={[host(p.url)]} icon={<Swatch color={p.brand} />} title={p.name} description={host(p.url)}
                          onSelect={() => qa.openSection(p.id)} />
                      ))}
                    </CommandMenuGroup>
                    <CommandMenuGroup>
                      <CommandMenuGroupLabel>Bugs</CommandMenuGroupLabel>
                      {openBugs.map(bugItem)}
                    </CommandMenuGroup>
                    <CommandMenuGroup>
                      <CommandMenuGroupLabel>Runs</CommandMenuGroupLabel>
                      {qa.runs.map((r) => (
                        <CommandMenuItem key={r.id} value={`run ${r.id} ${r.title}`} label={r.title} keywords={[`#${r.id.slice(4)}`]} icon="checklist" title={r.title}
                          description={`#${r.id.slice(4)} · ${PROJECTS.find((p) => p.id === r.projectId)?.name} · ${r.status}`}
                          onSelect={() => qa.open({ kind: 'run', id: r.id })} />
                      ))}
                    </CommandMenuGroup>
                  </SearchOnly>
                </CommandMenuPage>

                <CommandMenuPage value="projects" title="Projects" placeholder="Search projects…" numbered>
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Projects</CommandMenuGroupLabel>
                    {PROJECTS.map((p) => (
                      <CommandMenuItem key={p.id} value={p.name} keywords={[host(p.url)]} icon={<Swatch color={p.brand} />} title={p.name} description={host(p.url)}
                        trailing={<span className="ml-auto shrink-0 text-caption text-muted-foreground tabular-nums">{qa.bugs.filter((b) => b.projectId === p.id && isOpen(b)).length} open</span>}
                        onSelect={() => qa.openSection(p.id)} />
                    ))}
                  </CommandMenuGroup>
                </CommandMenuPage>

                <CommandMenuPage value="bugs" title="Bugs" placeholder="Search open bugs…">
                  {SEVERITIES.map((s) => (
                    <CommandMenuGroup key={s}>
                      <CommandMenuGroupLabel>{SEVERITY_LABEL[s]}</CommandMenuGroupLabel>
                      {openBugs.filter((b) => b.severity === s).map(bugItem)}
                    </CommandMenuGroup>
                  ))}
                </CommandMenuPage>

                <CommandMenuPage value="runs" title="Test runs" placeholder="Search runs…">
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Recent runs</CommandMenuGroupLabel>
                    {qa.runs.map((r) => (
                      <CommandMenuItem key={r.id} value={`${r.title} #${r.id.slice(4)}`} icon="checklist" title={r.title}
                        description={`#${r.id.slice(4)} · ${PROJECTS.find((p) => p.id === r.projectId)?.name} · ${r.status === 'running' ? 'running now' : relativeTime(r.started)}`}
                        trailing={<span className="ml-auto shrink-0"><RunStatusBadge status={r.status} /></span>} onSelect={() => qa.open({ kind: 'run', id: r.id })} />
                    ))}
                  </CommandMenuGroup>
                </CommandMenuPage>

                <CommandMenuPage value="status" title={bug ? `${bug.id} status` : 'Status'} placeholder="Set status…" numbered>
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Status</CommandMenuGroupLabel>
                    {STATUSES.map((s) => (
                      <CommandMenuItem key={s} value={STATUS_LABEL[s]} icon={<span className={cn('size-2.5 rounded-full', STATUS_DOT[s])} />} title={STATUS_LABEL[s]}
                        trailing={bug?.status === s ? <span className="ml-auto shrink-0 text-caption text-muted-foreground">Current</span> : undefined}
                        disabled={!bug} onSelect={() => { if (bug) { qa.setBugStatus(bug.id, s); qa.hud(`${bug.id} → ${STATUS_LABEL[s]}`); } }} />
                    ))}
                  </CommandMenuGroup>
                </CommandMenuPage>

                <CommandMenuPage value="severity" title={bug ? `${bug.id} severity` : 'Severity'} placeholder="Set severity…" numbered>
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Severity</CommandMenuGroupLabel>
                    {SEVERITIES.map((s) => (
                      <CommandMenuItem key={s} value={SEVERITY_LABEL[s]} icon={<Swatch color={SEVERITY_COLOR[s]} round />} title={SEVERITY_LABEL[s]}
                        trailing={bug?.severity === s ? <span className="ml-auto shrink-0 text-caption text-muted-foreground">Current</span> : undefined}
                        disabled={!bug} onSelect={() => { if (bug) { qa.setBugSeverity(bug.id, s); qa.hud(`${bug.id} → ${SEVERITY_LABEL[s]}`); } }} />
                    ))}
                  </CommandMenuGroup>
                </CommandMenuPage>

                <CommandMenuPage value="tracker" title="Issue tracker" placeholder="Connect a tracker…">
                  <CommandMenuGroup>
                    <CommandMenuGroupLabel>Issue trackers</CommandMenuGroupLabel>
                    {TRACKERS.map((t) => (
                      <CommandMenuItem key={t.id} value={t.name} icon={<Swatch color={t.color} />} title={t.name} description={t.detail}
                        trailing={qa.trackers.includes(t.id) ? <span className="ml-auto shrink-0 text-caption font-medium text-success">Connected</span> : undefined}
                        onSelect={() => qa.connectTracker(t.id, t.name)} />
                    ))}
                  </CommandMenuGroup>
                </CommandMenuPage>
              </CommandMenuList>
            </div>
            <BugPreview wide={width >= 600} />
          </div>
          <CommandMenuFooter />
        </CommandMenu>
      </CommandMenuDialogContent>
    </CommandMenuDialog>
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
  const active = useCommandMenuValue();
  const qa = useLoopQA();
  if (!wide || page !== 'bugs') return null;
  const b = active?.startsWith('bug ') ? qa.bugs.find((x) => x.id === active.slice(4)) : undefined;
  return (
    <aside className="relative w-[44%] shrink-0 animate-bl-fade-in border-l border-border">
      <div className="absolute inset-0 overflow-hidden">
        <Swap value={b?.id ?? 'none'} className="h-full [&>*]:h-full">
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
          ) : <EmptyState icon={<Icon name="warning" />} title="No bug selected" description="Pick a bug in the list to see what was found." />}
        </Swap>
      </div>
    </aside>
  );
}

function Swatch({ color, round }: { color: string; round?: boolean }) {
  return <span className={round ? 'size-2.5 rounded-full bg-(--c)' : 'size-3 rounded-sm bg-(--c)'} style={{ '--c': color } as CSSProperties} />;
}
