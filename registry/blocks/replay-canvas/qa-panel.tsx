'use client';
/* The Replay QA pane: your QA projects, then a project's test runs (newest first, as their pages arrive). Pressing a
   test run loads the recording of every journey in it into the canvas's recordings. */
import { useEffect, useMemo, useState } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { SearchField } from '@/components/ui/search-field';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { groupTestRuns, type QaClient, type QaJourneyRun, type QaProject, type QaTestRun } from './qa';

/** What's loading (or loaded) into the canvas: a test run, how many of its journeys are in. */
export interface QaLoad {
  projectId: string;
  runId: string;
  done: number;
  total: number;
  empty: number;
  loading: boolean;
  error?: string;
}

export interface QaPanelProps {
  client: QaClient;
  load: QaLoad | null;
  onOpen: (project: QaProject, run: QaTestRun) => void;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const rowClass = (on?: boolean) => cn(
  'flex w-full cursor-pointer flex-col gap-0.5 rounded-ctl border-0 bg-transparent px-2 py-1.5 text-left text-footnote text-foreground outline-none',
  'hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring',
  on && 'bg-primary/12',
);

export function QaPanel({ client, load, onOpen }: QaPanelProps) {
  const [projects, setProjects] = useState<QaProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [project, setProject] = useState<QaProject | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setError(null);
    client.projects(ctl.signal).then(
      (list) => setProjects(list.sort((a, b) => b.updated_at.localeCompare(a.updated_at))),
      (e: unknown) => { if (!ctl.signal.aborted) setError(errorText(e)); },
    );
    return () => ctl.abort();
  }, [client]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.id.includes(q) || (p.target_url ?? '').toLowerCase().includes(q));
  }, [projects, query]);

  if (project) return <TestRuns client={client} project={project} load={load} onBack={() => setProject(null)} onOpen={(run) => onOpen(project, run)} />;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchField value={query} onChange={setQuery} placeholder="Find a project" aria-label="Find a QA project" className="mx-2 mb-1 py-[5px] [&_input]:text-footnote" />
      <ul aria-label="Replay QA projects" className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-2 pb-2">
        {shown.map((p) => (
          <li key={p.id}>
            <PlainButton className={rowClass()} onPress={() => setProject(p)}>
              <span className="flex w-full items-center gap-1.5">
                <span className="truncate font-medium">{p.name}</span>
                <Icon name="chevron-right" size={11} sw={2.2} className="ml-auto shrink-0 text-muted-foreground" />
              </span>
              <span className="truncate text-caption2 text-muted-foreground">
                {p.bug_count} bug{p.bug_count === 1 ? '' : 's'} · {when(p.updated_at)}{p.status === 'paused' ? ' · paused' : ''}
              </span>
            </PlainButton>
          </li>
        ))}
        {!projects && !error && <li className="grid place-items-center py-6"><Spinner label="Loading QA projects" size={18} /></li>}
        {projects && !shown.length && <li className="px-2 py-3 text-footnote text-muted-foreground">No projects{query ? ` match “${query}”` : ''}.</li>}
        {error && <li role="alert" className="px-2 py-3 text-footnote text-destructive">{error}</li>}
      </ul>
    </div>
  );
}

function TestRuns({ client, project, load, onBack, onOpen }: {
  client: QaClient; project: QaProject; load: QaLoad | null; onBack: () => void; onOpen: (run: QaTestRun) => void;
}) {
  const [runs, setRuns] = useState<QaJourneyRun[] | null>(null);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    setRuns(null); setComplete(false); setError(null);
    client.journeyRuns(project.id, ctl.signal, setRuns).then(
      (all) => { setRuns(all); setComplete(true); },
      (e: unknown) => { if (!ctl.signal.aborted) setError(errorText(e)); },
    );
    return () => ctl.abort();
  }, [client, project.id]);

  const testRuns = useMemo(() => groupTestRuns(runs ?? []), [runs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlainButton onPress={onBack} className="mx-2 mb-1 flex cursor-pointer items-center gap-1 self-start rounded-ctl border-0 bg-transparent px-1 py-0.5 text-footnote text-primary outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring">
        <Icon name="chevron-left" size={12} sw={2.2} />Projects
      </PlainButton>
      <div className="truncate px-3 pb-1 text-footnote font-semibold" title={project.target_url ?? undefined}>{project.name}</div>
      <ul aria-label="Test runs" className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-2 pb-2">
        {testRuns.map((t) => {
          const active = load?.projectId === project.id && load.runId === t.id ? load : null;
          return (
            <li key={t.id}>
              <PlainButton className={rowClass(!!active)} onPress={() => onOpen(t)} aria-label={`Load test run of ${when(t.startedAt)}`}>
                <span className="flex w-full items-center gap-1.5">
                  <span className="truncate font-medium">{when(t.startedAt)}</span>
                  {t.environment && <span className="truncate text-caption2 text-muted-foreground">{t.environment}</span>}
                  {active?.loading && <Spinner size={13} className="ml-auto shrink-0" />}
                </span>
                <span className="flex items-center gap-2 text-caption2 text-muted-foreground">
                  <span>{t.runs.length} journey{t.runs.length === 1 ? '' : 's'}</span>
                  {t.passed > 0 && <span className="text-success">✓ {t.passed}</span>}
                  {t.failed > 0 && <span className="text-destructive">✗ {t.failed}</span>}
                  {t.bugs > 0 && <span>{t.bugs} bug{t.bugs === 1 ? '' : 's'}</span>}
                </span>
                {active && (
                  <span className={cn('text-caption2', active.error ? 'text-destructive' : 'text-primary')}>
                    {active.error ?? (active.loading
                      ? `Loading recordings ${active.done} of ${active.total}…`
                      : `${active.done - active.empty} recording${active.done - active.empty === 1 ? '' : 's'} loaded${active.empty ? ` · ${active.empty} without one` : ''}`)}
                  </span>
                )}
              </PlainButton>
            </li>
          );
        })}
        {!complete && !error && <li className="grid place-items-center py-4"><Spinner label="Loading test runs" size={18} /></li>}
        {complete && !testRuns.length && <li className="px-2 py-3 text-footnote text-muted-foreground">No test runs yet.</li>}
        {error && <li role="alert" className="px-2 py-3 text-footnote text-destructive">{error}</li>}
      </ul>
    </div>
  );
}
