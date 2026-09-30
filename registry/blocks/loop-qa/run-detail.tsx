/* A run: its ring and status, what it found (findings), what it covered, the exploration it recorded, and its
   journeys grouped by outcome — a journey with bugs unfolds to list them. A live run fills in as it goes. */
import { useState, type ReactNode } from 'react';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import { Chevron } from '@/components/ui/icon-swap';
import { MarkdownView } from '@/components/ui/markdown-view';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ReplayPreview } from '@/components/ui/replay-preview';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewContent, SplitViewHeader } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { LIVE_PLAN, dateTime, relativeTime, type Journey, type Run } from './data';
import { PageActions } from './header';
import { EnvBadge, Panel, RunStatusBadge, SectionLabel, SeverityBadge, Pressable } from './parts';
import { EXPLORATION_EVENTS } from './recordings';
import { RunRing } from './runs';
import { useLoopQA } from './state';

export function RunPage({ id }: { id: string }) {
  const qa = useLoopQA();
  const r = qa.runs.find((x) => x.id === id);
  if (!r) return null;
  const planned = r.plannedJourneys ?? r.journeys.length;
  const groups: { label: string; list: Journey[] }[] = [
    { label: 'With bugs', list: r.journeys.filter((j) => j.bugIds.length) },
    { label: 'Failed', list: r.journeys.filter((j) => j.status === 'failed' && !j.bugIds.length) },
    { label: 'Blocked', list: r.journeys.filter((j) => j.status === 'blocked') },
    { label: 'Passed', list: r.journeys.filter((j) => j.status === 'passed' && !j.bugIds.length) },
  ];
  return (
    <>
      <SplitViewHeader title={`Run #${r.id.slice(4)}`} titleOnScroll trailing={<PageActions />} />
      <SplitViewContent className="@container">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5 px-5 pt-3 pb-14 @3xl:px-8!">
          <div className="flex items-start gap-4">
            <RunRing run={r} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <RunStatusBadge status={r.status} />
                <EnvBadge env={r.environment} />
                <span className="font-mono text-caption text-tertiary-foreground">#{r.id.slice(4)}</span>
              </div>
              <h1 className="m-0 mt-1.5 text-[24px] leading-[30px] font-semibold tracking-[-.025em]">{r.title}</h1>
              <div className="mt-1 text-footnote text-muted-foreground">
                {r.status === 'running' ? 'Started just now' : `Started ${dateTime(r.started)}`} · {r.trigger} · {r.journeys.length}/{planned} journeys
                {r.newBugs ? ` · ${r.newBugs} new bugs` : ''}{r.rediscovered ? ` · ${r.rediscovered} rediscovered` : ''}
              </div>
            </div>
          </div>

          <div className="grid gap-5 @4xl:grid-cols-[1fr_300px]!">
            <Panel title="Findings summary" icon="sparkle" bodyClassName="px-4 py-3.5 text-[13.5px] [&_p]:my-2 [&_ul]:my-2">
              {r.status === 'running' ? (
                <p className="m-0 flex items-center gap-2 text-muted-foreground"><Spinner size={13} />Findings are written when the run finishes.</p>
              ) : r.findings ? <Expandable><MarkdownView markdown={r.findings} /></Expandable> : (
                <p className="m-0 text-muted-foreground">{r.newBugs} new and {r.rediscovered} rediscovered bugs across {r.journeys.length} journeys.</p>
              )}
            </Panel>
            <Panel title="Coverage" icon="network" bodyClassName="p-4">
              <div className="flex items-center gap-3.5">
                <ProgressRing aria-label="Coverage" value={r.coverage} size="xl" showValue />
                <div className="text-[12.5px] leading-[18px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{r.journeys.filter((j) => j.status === 'passed').length} passed</span>, {r.journeys.filter((j) => j.status === 'failed').length} failed, {r.journeys.filter((j) => j.status === 'blocked').length} blocked
                </div>
              </div>
              {r.coverageSummary ? <p className="m-0 mt-3 text-[12.5px] leading-[18px] text-muted-foreground">{r.coverageSummary}</p> : null}
            </Panel>
          </div>

          <Panel title="Exploration" icon="play-outline" bodyClassName={r.explored ? 'p-4' : 'px-4 py-5'}>
            {r.explored ? <ReplayPreview events={EXPLORATION_EVENTS} initialTime={2600} title="Run exploration" /> : (
              <p className="m-0 text-footnote text-muted-foreground">No exploration ran in this run — it replayed known journeys only.</p>
            )}
          </Panel>

          <section className="flex flex-col gap-3">
            <SectionLabel count={r.journeys.length}>Journeys</SectionLabel>
            {groups.map((g) => g.list.length ? (
              <div key={g.label} className="flex flex-col gap-2">
                <div className={cn('text-caption font-semibold', g.label === 'With bugs' || g.label === 'Failed' ? 'text-destructive' : g.label === 'Blocked' ? 'text-warning' : 'text-success')}>
                  {g.label} · {g.list.length}
                </div>
                <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card border border-border bg-card p-0">
                  {g.list.map((j) => <JourneyRow key={j.id} journey={j} />)}
                </ul>
              </div>
            ) : null)}
            {r.status === 'running' ? <Pending run={r} /> : null}
          </section>
        </div>
      </SplitViewContent>
    </>
  );
}

function Pending({ run: r }: { run: Run }) {
  const next = LIVE_PLAN.slice(r.journeys.length);
  return (
    <ul className="m-0 flex list-none flex-col overflow-hidden rounded-card border border-dashed border-border p-0">
      {next.map((j, i) => (
        <li key={j.title} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-[13.5px] last:border-b-0">
          {i === 0 ? <Spinner size={14} /> : <span className="size-3.5 rounded-full border-[1.5px] border-dashed border-tertiary-foreground" />}
          <span className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>{j.title}</span>
          <span className="ml-auto text-caption text-tertiary-foreground">{i === 0 ? 'Replaying…' : 'Queued'}</span>
        </li>
      ))}
    </ul>
  );
}

function JourneyRow({ journey: j }: { journey: Journey }) {
  const qa = useLoopQA();
  const [open, setOpen] = useState(j.bugIds.length > 0 && j.bugIds.length < 3);
  const bugs = j.bugIds.map((id) => qa.bugs.find((b) => b.id === id)).filter((b) => !!b);
  const icon = j.status === 'passed' ? 'check' : j.status === 'blocked' ? 'exclamation-circle' : 'xmark';
  const tone = j.status === 'passed' ? 'text-success' : j.status === 'blocked' ? 'text-warning' : 'text-destructive';
  return (
    <li className="border-b border-border last:border-b-0">
      <Pressable isDisabled={!bugs.length} onPress={() => setOpen(!open)} aria-expanded={bugs.length ? open : undefined}
        className="flex w-full cursor-pointer items-center justify-start gap-3 rounded-none px-4 py-2.5 text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-100 data-disabled:cursor-default data-disabled:opacity-100 data-focus-visible:ring-inset">
        <Icon name={icon} size={14} sw={2.6} className={cn('shrink-0', tone)} />
        <span className="min-w-0 flex-1 text-[13.5px] font-medium">{j.title}</span>
        <span className="shrink-0 text-caption text-muted-foreground">{j.steps} steps</span>
        {bugs.length ? (
          <span className="flex shrink-0 items-center gap-1.5 text-caption font-semibold text-destructive">
            <Icon name="exclamation-circle" size={13} sw={2.2} />{bugs.length}
            <Chevron direction={open ? 'down' : 'right'} size={12} sw={2.6} className="text-tertiary-foreground" />
          </span>
        ) : null}
      </Pressable>
      {bugs.length ? (
        <AnimatedHeight>
          {open ? (
            <ul className="m-0 list-none px-3 pb-2 pl-9">
              {bugs.map((b) => (
                <li key={b.id}>
                  <Pressable onPress={() => qa.open({ kind: 'bug', id: b.id })}
                    className="flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-[9px] px-2 py-1.5 text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-[.99]">
                    <SeverityBadge severity={b.severity} />
                    <span className="min-w-0 flex-1 truncate text-footnote">{b.title}</span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{relativeTime(b.discovered)}</span>
                  </Pressable>
                </li>
              ))}
            </ul>
          ) : null}
        </AnimatedHeight>
      ) : null}
    </li>
  );
}

/** Long findings fold to ~7 lines with "Show more". */
function Expandable({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <AnimatedHeight>
        <div className={cn('relative', !open && 'max-h-[168px] overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:h-12 after:bg-linear-to-t after:from-card after:content-[""]')}>
          {children}
        </div>
      </AnimatedHeight>
      <Button size="sm" variant="ghost" className="mt-1 -ml-2 h-7 rounded-md px-2 text-[12.5px] text-primary" onPress={() => setOpen(!open)}>
        {open ? 'Show less' : 'Show more'}
      </Button>
    </div>
  );
}
