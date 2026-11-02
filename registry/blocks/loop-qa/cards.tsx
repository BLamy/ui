/* Hover cards: what a reference points at, before you open it. A bug id or bug row previews the bug (severity,
   status, the summary, expected vs actual, where it was found); a run link previews the run (its RunCard: progress,
   passed / failed / bugs); a project in the sidebar previews the project (URL, schedule, last run, open bugs by
   severity and the trend); a member's initials preview the person and the projects they're on. Each only previews
   what pressing the reference opens, so touch, which never shows them, loses nothing. */
import type { ReactNode } from 'react';
import { HoverCard, HoverCardHeader, HoverCardTrigger, type HoverCardProps } from '@/components/ui/hover-card';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { isOpen } from './agent';
import { MEMBERS, PROJECTS, SEVERITIES, host, relativeTime, type Bug, type Project, type Severity } from './data';
import { Avatar, EnvBadge, KindLabel, SeverityBadge, SeverityBar, Sparkline, StatusBadge } from './parts';
import { RunCard } from './runs';
import { useLoopQA } from './state';

/** A trigger with its card; `className` goes on the trigger's wrapper (`flex w-full` for a row). */
function Preview({ card, className, placement = 'bottom start', cardClassName, contentClassName, children }: {
  card: ReactNode; className?: string; placement?: HoverCardProps['placement']; cardClassName?: string; contentClassName?: string; children: ReactNode;
}) {
  return (
    <HoverCardTrigger className={className}>
      {children}
      <HoverCard placement={placement} className={cardClassName} contentClassName={contentClassName}>{card}</HoverCard>
    </HoverCardTrigger>
  );
}

/* ── Bug ── */

export function BugCard({ bug: b }: { bug: Bug }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 font-mono text-caption text-muted-foreground">{b.id}</span>
        <SeverityBadge severity={b.severity} /><StatusBadge status={b.status} /><EnvBadge env={b.environment} />
      </div>
      <div className="text-detail leading-[19px] font-semibold">{b.title}</div>
      {b.summary !== b.title ? <p className="m-0 line-clamp-3 text-[12.5px] leading-[18px] text-muted-foreground">{b.summary}</p> : null}
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-2.5 py-2 text-caption">
        <dt className="text-muted-foreground">Expected</dt><dd className="m-0 line-clamp-2">{b.expected}</dd>
        <dt className="text-muted-foreground">Actual</dt><dd className="m-0 line-clamp-2">{b.actual}</dd>
      </dl>
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <KindLabel kind={b.kind} className="text-caption" />
        <span className="ml-auto">{relativeTime(b.discovered)} · run #{b.runId.slice(4)}</span>
      </div>
    </div>
  );
}

/** A bug reference (a row, an id button) that previews the bug. */
export function BugPreview({ bug, className, placement, children }: { bug: Bug; className?: string; placement?: HoverCardProps['placement']; children: ReactNode }) {
  return <Preview card={<BugCard bug={bug} />} className={className} placement={placement} cardClassName="w-80">{children}</Preview>;
}

/* ── Run ── the run's own RunCard, edge to edge in the hover card. */

export function RunPreview({ runId, className, placement, children }: { runId: string; className?: string; placement?: HoverCardProps['placement']; children: ReactNode }) {
  return (
    <Preview className={className} placement={placement} cardClassName="w-80" contentClassName="p-0"
      card={<RunCard runId={runId} compact className="rounded-[14px] border-0 bg-transparent" />}>
      {children}
    </Preview>
  );
}

/* ── Project ── */

export function ProjectCard({ project: p }: { project: Project }) {
  const qa = useLoopQA();
  const open = qa.bugs.filter((b) => b.projectId === p.id && isOpen(b));
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, open.filter((b) => b.severity === s).length])) as Record<Severity, number>;
  const live = qa.runs.some((r) => r.projectId === p.id && r.status === 'running');
  return (
    <>
      <HoverCardHeader
        media={<span className="grid size-9 place-items-center rounded-[10px] bg-(--brand) text-[15px] font-semibold text-white" style={{ '--brand': p.brand } as React.CSSProperties}>{p.name[0]}</span>}
        title={p.name}
        subtitle={<span className="inline-flex items-center gap-1"><Icon name="globe" size={11} sw={2} />{host(p.url)}</span>}
      />
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-caption text-muted-foreground"><span className="text-headline font-semibold text-foreground tabular-nums">{open.length}</span> open {open.length === 1 ? 'bug' : 'bugs'}</div>
          <SeverityBar counts={counts} className="mt-1.5 w-[120px]" />
        </div>
        <Sparkline values={p.trend} />
      </div>
      <div className="mt-3 grid gap-1 border-t border-border pt-2.5 text-caption text-muted-foreground">
        <span className="flex items-center gap-1.5"><Icon name="clock" size={12} sw={2} />{live ? 'Running now' : `Last run ${relativeTime(p.lastRun)}`}</span>
        <span className="flex items-center gap-1.5"><Icon name="calendar" size={12} sw={2} />{p.status === 'paused' ? 'Paused' : p.schedule}</span>
      </div>
    </>
  );
}

export function ProjectPreview({ project, className, children }: { project: Project; className?: string; children: ReactNode }) {
  return <Preview card={<ProjectCard project={project} />} className={className} placement="right top">{children}</Preview>;
}

/* ── Member ── */

export function MemberCard({ initials, tone = 0 }: { initials: string; tone?: number }) {
  const m = MEMBERS[initials];
  const projects = PROJECTS.filter((p) => p.members.includes(initials));
  return (
    <>
      <HoverCardHeader media={<Avatar initials={initials} tone={tone} className="size-10 text-footnote ring-0" />}
        title={m?.name ?? initials} subtitle={m ? `${m.role} · ${m.email}` : undefined} />
      {projects.length ? (
        <div className="mt-3 border-t border-border pt-2.5">
          <div className="mb-1.5 text-caption text-muted-foreground">On {projects.length} {projects.length === 1 ? 'project' : 'projects'}</div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-footnote">
            {projects.map((p) => (
              <li key={p.id} className={cn('flex items-center gap-2', p.status === 'paused' && 'text-muted-foreground')}>
                <span className="size-2 shrink-0 rounded-sm bg-(--brand)" style={{ '--brand': p.brand } as React.CSSProperties} />
                <span className="truncate">{p.name}</span>
                {p.members[0] === initials ? <span className="ml-auto shrink-0 text-caption text-muted-foreground">Owner</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

export function MemberPreview({ initials, tone, className, children }: { initials: string; tone?: number; className?: string; children: ReactNode }) {
  return <Preview card={<MemberCard initials={initials} tone={tone} />} className={className} cardClassName="w-64">{children}</Preview>;
}
