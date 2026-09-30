/* A project's Overview: four tiles (each opens its tab), the live run if one is going, the exploration replays
   (one player that seeks from exploration to exploration while the caption slides the way you paged), the
   latest run's findings and the newest open bugs. */
import { useRef, useState } from 'react';
import { ContentSwap } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/ui/markdown-view';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ReplayPreview, formatReplayTime, type ReplayPreviewHandle } from '@/components/ui/replay-preview';
import { Icon } from '@/lib/icon';
import { useDirection } from '@/lib/motion';
import { isOpen } from './agent';
import { EXPLORATIONS, PLAYWRIGHT_TESTS, relativeTime, type Bug, type Project } from './data';
import { BarButton, Panel, SeverityBadge, SeverityBar, StatTile, Pressable } from './parts';
import { countBySeverity } from './projects-home';
import { EXPLORATION_EVENTS } from './recordings';
import { RunCard } from './runs';
import { useLoopQA } from './state';

export function Overview({ project: p }: { project: Project }) {
  const qa = useLoopQA();
  const open = qa.bugs.filter((b) => b.projectId === p.id && isOpen(b));
  const runs = qa.runs.filter((r) => r.projectId === p.id);
  const live = runs.find((r) => r.status === 'running');
  const latest = runs.find((r) => r.status !== 'running');
  const tests = p.id === 'northwind' ? PLAYWRIGHT_TESTS : [];
  const failing = tests.filter((t) => t.status === 'failing').length;
  const coverage = latest?.coverage ?? 0;
  const recent = [...open].sort((a, b) => b.discovered.localeCompare(a.discovered) || a.id.localeCompare(b.id)).slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4!">
        <StatTile label="Open bugs" icon="exclamation-circle" value={open.length} onPress={() => qa.setTab('bugs')}
          foot={open.length ? `${open.filter((b) => b.severity === 'critical').length} critical` : 'All clear'}>
          <SeverityBar counts={countBySeverity(open.map((b) => b.severity))} className="mt-2.5" />
        </StatTile>
        <StatTile label="Test runs" icon="checklist" value={runs.length} onPress={() => qa.setTab('runs')}
          foot={latest ? `Last: ${latest.status} · ${relativeTime(latest.started)}` : 'No runs yet'} />
        <StatTile label="Playwright tests" icon="doc-text" value={tests.length} onPress={() => qa.setTab('tests')}
          foot={tests.length ? (failing ? `${failing} failing until fixed` : 'All passing') : 'Generated from bugs'} />
        <StatTile label="Coverage" icon="network" onPress={() => qa.setTab('sitemap')} foot="of known pages and states">
          <div className="mt-2 flex items-center gap-3">
            <ProgressRing aria-label="Coverage" value={coverage} size="lg" showValue />
            <span className="text-[12px] leading-4 text-muted-foreground">{latest ? `${latest.journeys.length} journeys in the last run` : '—'}</span>
          </div>
        </StatTile>
      </div>

      {live ? <RunCard runId={live.id} /> : null}

      <Exploration />

      <div className="grid gap-5 @5xl:grid-cols-[1.25fr_1fr]!">
        <Panel title="Latest findings" icon="sparkle"
          trailing={latest ? <Button size="sm" variant="ghost" className="h-7 rounded-md px-2 text-[12.5px] text-muted-foreground" onPress={() => qa.open({ kind: 'run', id: latest.id })}>Run #{latest.id.slice(4)}<Icon name="chevron-right" size={12} sw={2.4} /></Button> : null}
          bodyClassName="px-4 py-3.5 text-[13.5px] [&_p]:my-2 [&_ul]:my-2">
          {latest?.findings ? <MarkdownView markdown={latest.findings} /> : (
            <p className="m-0 text-muted-foreground">{latest ? `${latest.journeys.length} journeys · ${latest.newBugs} new bugs.` : 'Run the project to see findings here.'}</p>
          )}
        </Panel>
        <Panel title="Newest open bugs" icon="exclamation-circle"
          trailing={<Button size="sm" variant="ghost" className="h-7 rounded-md px-2 text-[12.5px] text-muted-foreground" onPress={() => qa.setTab('bugs')}>All {open.length}<Icon name="chevron-right" size={12} sw={2.4} /></Button>}>
          <ul className="m-0 list-none p-1.5">
            {recent.map((b) => <BugLine key={b.id} bug={b} />)}
            {!recent.length ? <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">No open bugs.</li> : null}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function BugLine({ bug: b }: { bug: Bug }) {
  const qa = useLoopQA();
  return (
    <li>
      <Pressable onPress={() => qa.open({ kind: 'bug', id: b.id })}
        className="flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-[.99]">
        <SeverityBadge severity={b.severity} className="w-[66px] justify-center" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-[13px] font-medium">{b.title}</span>
          <span className="block text-[11.5px] text-muted-foreground"><span className="font-mono">{b.id}</span> · {relativeTime(b.discovered)}</span>
        </span>
      </Pressable>
    </li>
  );
}

function Exploration() {
  const [index, setIndex] = useState(0);
  const dir = useDirection(index);
  const player = useRef<ReplayPreviewHandle>(null);
  const ex = EXPLORATIONS[index]!;
  const go = (d: number) => {
    const next = (index + d + EXPLORATIONS.length) % EXPLORATIONS.length;
    setIndex(next);
    player.current?.pause(EXPLORATIONS[next]!.initialTime);
  };
  return (
    <Panel
      title="Exploration"
      icon="play-outline"
      trailing={
        <span className="flex items-center gap-1">
          <BarButton label="Previous exploration" icon="chevron-left" onPress={() => go(-1)} className="size-7" />
          <span className="min-w-9 text-center text-[12px] text-muted-foreground tabular-nums">{index + 1} / {EXPLORATIONS.length}</span>
          <BarButton label="Next exploration" icon="chevron-right" onPress={() => go(1)} className="size-7" />
        </span>
      }
      bodyClassName="grid gap-4 p-4 @5xl:grid-cols-[1fr_240px]!"
    >
      <ReplayPreview events={EXPLORATION_EVENTS} initialTime={EXPLORATIONS[0]!.initialTime} playerRef={player} title="Exploration replay" />
      <ContentSwap id={ex.id} direction={dir}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[11.5px] font-semibold tracking-[.06em] text-muted-foreground uppercase">Exploration {index + 1}</div>
            <div className="mt-1 text-[15px] leading-5 font-semibold tracking-[-.01em]">{ex.title}</div>
            <p className="m-0 mt-1.5 text-[13px] text-muted-foreground">{ex.summary}</p>
          </div>
          <dl className="m-0 grid grid-cols-3 gap-2 text-center">
            {[['Pages', ex.pages], ['Actions', ex.actions], ['At', formatReplayTime(ex.initialTime)]].map(([k, v]) => (
              <div key={k} className="rounded-[10px] bg-muted px-2 py-2">
                <dd className="m-0 text-[15px] font-semibold tabular-nums">{v}</dd>
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
              </div>
            ))}
          </dl>
        </div>
      </ContentSwap>
    </Panel>
  );
}
