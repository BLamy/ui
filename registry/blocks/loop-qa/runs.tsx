/* Test runs: the run card (a live run's ring fills journey by journey; used in the Overview and in Ask QA), and
   the project's run history as a list whose rows push the run's page. */
import type { ReactNode } from 'react';
import { NumberMorph } from '@/components/ui/number-morph';
import { ProgressRing } from '@/components/ui/progress-ring';
import { TextMorph } from '@/components/ui/text-morph';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { LIVE_PLAN, relativeTime, type Project, type Run } from './data';
import { Empty, RunStatusBadge, SectionLabel, Pressable } from './parts';
import { useLoopQA } from './state';

export function RunsTab({ project }: { project: Project }) {
  const qa = useLoopQA();
  const runs = qa.runs.filter((r) => r.projectId === project.id);
  if (!runs.length) return <Empty icon="checklist" title="No runs yet" text="Start a run and Loop QA will replay the riskiest journeys on your site." />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionLabel count={runs.length}>Test runs</SectionLabel>
        <span className="text-[12.5px] text-muted-foreground">{project.schedule}</span>
      </div>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-border bg-card p-0">
        {runs.map((r) => <RunRow key={r.id} run={r} />)}
      </ul>
    </div>
  );
}

function RunRow({ run: r }: { run: Run }) {
  const qa = useLoopQA();
  const planned = r.plannedJourneys ?? r.journeys.length;
  const failed = r.journeys.filter((j) => j.status === 'failed').length;
  const passed = r.journeys.filter((j) => j.status === 'passed').length;
  return (
    <li className="border-b border-border last:border-b-0">
      <Pressable
        onPress={() => qa.open({ kind: 'run', id: r.id })}
        className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-3.5 gap-y-1 rounded-none px-4 py-3 text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-100 data-focus-visible:ring-inset @3xl:grid-cols-[auto_1fr_150px_110px_auto]!"
      >
        <RunRing run={r} size={34} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold tracking-[-.01em]">{r.title}</span>
            <span className="hidden font-mono text-[11.5px] text-tertiary-foreground @xl:inline!">#{r.id.slice(4)}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
            <span>{r.trigger}</span><span className="text-tertiary-foreground">·</span>
            <span>{r.status === 'running' ? 'started just now' : relativeTime(r.started)}</span>
            {r.duration ? <><span className="text-tertiary-foreground">·</span><span>{r.duration} min</span></> : null}
          </span>
        </span>
        <span className="hidden items-center gap-3 text-[12.5px] tabular-nums @3xl:flex!">
          <Stat icon="check" tone="text-success" n={passed} label="passed" />
          <Stat icon="xmark" tone="text-destructive" n={failed} label="failed" />
          <span className="text-muted-foreground">/ {planned}</span>
        </span>
        <span className="hidden text-[12.5px] @3xl:block!">
          {r.newBugs ? <span className="font-medium text-destructive">{r.newBugs} new</span> : <span className="text-muted-foreground">No new bugs</span>}
          {r.rediscovered ? <span className="text-muted-foreground"> · {r.rediscovered} seen</span> : null}
        </span>
        <span className="flex items-center gap-2">
          <RunStatusBadge status={r.status} />
          <Icon name="chevron-right" size={14} sw={2.2} className="text-tertiary-foreground" />
        </span>
      </Pressable>
    </li>
  );
}

function Stat({ icon, tone, n, label }: { icon: string; tone: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${n} ${label}`}>
      <Icon name={icon} size={12} sw={2.6} className={tone} /><NumberMorph value={n} />
    </span>
  );
}

/** A run's progress ring: journeys done out of planned, green when the run passed, red with failures. */
export function RunRing({ run: r, size = 44 }: { run: Run; size?: number }) {
  const planned = r.plannedJourneys ?? r.journeys.length;
  const failed = r.journeys.some((j) => j.status === 'failed');
  const done = r.journeys.length;
  const tone = r.status === 'running' ? 'default' : r.status === 'blocked' ? 'warning' : failed || r.status === 'failed' ? 'destructive' : 'success';
  return (
    <ProgressRing aria-label={`${done} of ${planned} journeys`} value={planned ? (done / planned) * 100 : 0} size={size} tone={tone}>
      {r.status === 'running' ? (
        <span className="text-[10.5px] font-semibold tabular-nums"><NumberMorph value={done} /></span>
      ) : (
        <Icon name={r.status === 'blocked' ? 'exclamation-circle' : failed || r.status === 'failed' ? 'xmark' : 'check'} size={size * 0.36} sw={2.6}
          className={r.status === 'blocked' ? 'text-warning' : failed || r.status === 'failed' ? 'text-destructive' : 'text-success'} />
      )}
    </ProgressRing>
  );
}

/** The run card: ring, title, status, what it's doing now (live) or what it found (done). */
export function RunCard({ runId, compact, className, footer }: { runId: string; compact?: boolean; className?: string; footer?: ReactNode }) {
  const qa = useLoopQA();
  const r = qa.runs.find((x) => x.id === runId);
  if (!r) return null;
  const planned = r.plannedJourneys ?? r.journeys.length;
  const passed = r.journeys.filter((j) => j.status === 'passed').length;
  const failed = r.journeys.filter((j) => j.status === 'failed').length;
  const bugs = new Set(r.journeys.flatMap((j) => j.bugIds)).size;
  const now = r.status === 'running' ? LIVE_PLAN[r.journeys.length]?.title : null;
  return (
    <div data-run-status={r.status} className={cn('overflow-hidden rounded-[14px] border border-border bg-card', r.status === 'running' && 'shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_10%,transparent)]', className)}>
      <Pressable
        onPress={() => qa.open({ kind: 'run', id: r.id })}
        aria-label={`Open run ${r.title}`}
        className={cn('flex w-full cursor-pointer items-center justify-start gap-3 rounded-none text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-100 data-focus-visible:ring-inset', compact ? 'p-3' : 'p-4')}
      >
        <RunRing run={r} size={compact ? 38 : 46} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate font-semibold tracking-[-.01em]', compact ? 'text-[13px]' : 'text-[14.5px]')}>{r.title}</span>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
            {now ? <TextMorph>{`Replaying: ${now}`}</TextMorph> : `${r.journeys.length} / ${planned} journeys · ${r.status === 'running' ? 'just now' : relativeTime(r.started)}`}
          </span>
        </span>
        <RunStatusBadge status={r.status} />
      </Pressable>
      <div className={cn('grid grid-cols-3 border-t border-border text-center', compact ? 'text-[11.5px]' : 'text-[12.5px]')}>
        {[
          { n: passed, label: 'passed', cls: 'text-success' },
          { n: failed, label: 'failed', cls: 'text-destructive' },
          { n: bugs, label: bugs === 1 ? 'bug' : 'bugs', cls: 'text-foreground' },
        ].map((s, i) => (
          <div key={s.label} className={cn('py-2', i && 'border-l border-border')}>
            <span className={cn('font-semibold tabular-nums', s.cls)}><NumberMorph value={s.n} /></span>
            <span className="text-muted-foreground"> {s.label}</span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
