/* Actions: workflows sidebar, runs filtered by event, status, branch and actor (GitHub's own parameters, so filters apply
   to every page), and one run in full: jobs, steps, re-run, cancel, delete, and each job's log. Workflows with a
   workflow_dispatch trigger can be run from here with their inputs, read from the workflow file. */
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Workflow, WorkflowRun } from './data';
import { GitHubError } from './github-api';
import { GhLink, UserLink } from './links';
import { Pagination } from './lists';
import { Box, Branch, Oct, ghButton } from './parts';
import { Menu, SelectMenu } from './pickers';
import type { Route } from './route';
import { ActionError, Failed, Loaded, useAction, useCan, useLoad, useNav, usePoll, useRepo } from './repo-context';

export const RUN_ICON: Record<WorkflowRun['status'], [ReactNode, string]> = {
  success: [<Oct key="s" name="checkFill" className="text-(--gh-open)" />, 'Success'],
  failure: [<Oct key="f" name="xFill" className="text-(--gh-closed)" />, 'Failure'],
  running: [<Oct key="r" name="dotFill" className="text-(--gh-attention)" />, 'In progress'],
  queued: [<Oct key="q" name="history" className="text-(--gh-attention)" />, 'Queued'],
  cancelled: [<Oct key="c" name="stopFill" className="text-muted-foreground" />, 'Cancelled'],
  skipped: [<Oct key="k" name="stopFill" className="text-muted-foreground" />, 'Skipped'],
};

type ActionsRoute = Extract<Route, { s: 'actions' }>;

const filterButton = 'flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-detail text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary data-hovered:text-foreground group-data-[phone=true]/gh:min-h-11';

export function ActionsView({ filter }: { filter: ActionsRoute }) {
  const { source, ui, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const page = filter.page ?? 1;
  const runs = useLoad(`${source.id}:runs:${JSON.stringify(filter)}`, () => source.runs({ workflow: filter.workflow, event: filter.event, status: filter.status, branch: filter.branch, actor: filter.actor, page }));
  const workflows = useLoad(source.id + ':workflows', source.workflows);
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const people = useLoad(source.id + ':assignable', source.assignable).data ?? [];
  const [dispatching, setDispatching] = useState(false);
  const list = workflows.data ?? [];
  const current = list.find((w) => w.id === filter.workflow);
  const set = (patch: Partial<ActionsRoute>) => nav.go({ ...filter, page: undefined, ...patch });
  const running = (runs.data?.items ?? []).some((r) => r.status === 'running' || r.status === 'queued');
  usePoll(source.live && running, 20_000, () => source.refresh('/actions'));
  const entry = (w: Workflow | null) => (
    <GhLink key={w?.id ?? 'all'} to={{ s: 'actions', workflow: w?.id }} aria-current={filter.workflow === w?.id ? 'page' : undefined}
      className={cn('relative flex min-h-8 items-center gap-2 rounded-md px-2 text-detail text-foreground no-underline hover:bg-secondary', filter.workflow === w?.id && 'bg-secondary font-semibold before:absolute before:inset-y-1.5 before:-left-2 before:w-1 before:rounded-full before:bg-primary')}>
      <span className="min-w-0 flex-1 truncate">{w?.name ?? 'All workflows'}</span>
      {w && !w.active ? <span className="rounded-full border border-border px-1.5 text-caption2 text-muted-foreground">Disabled</span> : null}
    </GhLink>
  );
  const clearable = filter.event || filter.status || filter.branch || filter.actor;
  return (
    <div className={cn('flex gap-6', ui.phone && 'flex-col gap-3')}>
      {ui.wide ? (
        <aside aria-label="Workflows" className="w-[240px] shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-title font-semibold">Actions</h2>
            {can.push ? <GhLink to={{ s: 'new-file', dir: '.github/workflows', name: 'ci.yml', content: NEW_WORKFLOW, message: 'Add a workflow' }} className={cn(ghButton(), 'h-7 px-2 text-caption no-underline')}>New workflow</GhLink> : null}
          </div>
          {entry(null)}
          {list.map(entry)}
        </aside>
      ) : list.length ? (
        <SelectMenu title="Choose a workflow" trigger={<><Oct name="play" className="text-muted-foreground" />{current?.name ?? 'All workflows'}<Oct name="chevDown" size={12} /></>} triggerClassName={cn(ghButton(), 'w-full justify-start md:w-auto')}
          clearLabel="All workflows" selected={filter.workflow ? [String(filter.workflow)] : []} items={list.map((w) => ({ id: String(w.id), label: w.name, description: w.active ? w.path : `Disabled · ${w.path}` }))}
          onApply={(ids) => nav.go({ s: 'actions', workflow: ids[0] ? Number(ids[0]) : undefined })} />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="mt-0 mb-1 text-title font-semibold">{current?.name ?? 'All workflows'}</h1>
            <p className="m-0 text-muted-foreground">{current ? <><GhLink to={{ s: 'code', path: current.path }} className="font-mono text-caption">{current.path}</GhLink></> : 'Showing runs from all workflows'}</p>
          </div>
          {current && can.push ? <WorkflowMenu workflow={current} onDispatch={() => setDispatching(true)} /> : null}
        </div>
        {dispatching && current ? <DispatchForm workflow={current} onClose={() => setDispatching(false)} /> : null}
        <Box header={
          <div className="flex w-full flex-wrap items-center gap-2">
            <b className="font-semibold" role="status">{runs.data?.total != null ? `${runs.data.total.toLocaleString('en-US')} workflow run${runs.data.total === 1 ? '' : 's'}` : 'Workflow runs'}</b>
            <div className="ml-auto flex flex-wrap items-center">
              <SelectMenu title="Filter by event" trigger={<>Event{filter.event ? `: ${filter.event}` : ''}<Oct name="chevDown" size={12} /></>} triggerClassName={filterButton} clearLabel="All events" selected={filter.event ? [filter.event] : []}
                items={['push', 'pull_request', 'release', 'schedule', 'workflow_dispatch'].map((e) => ({ id: e, label: e }))} onApply={(ids) => set({ event: ids[0] })} />
              <SelectMenu title="Filter by status" trigger={<>Status{filter.status ? `: ${filter.status}` : ''}<Oct name="chevDown" size={12} /></>} triggerClassName={filterButton} clearLabel="All statuses" selected={filter.status ? [filter.status] : []}
                items={['success', 'failure', 'in_progress', 'queued', 'cancelled'].map((e) => ({ id: e, label: e.replace('_', ' ') }))} onApply={(ids) => set({ status: ids[0] })} />
              <SelectMenu title="Filter by branch" trigger={<>Branch{filter.branch ? `: ${filter.branch}` : ''}<Oct name="chevDown" size={12} /></>} triggerClassName={filterButton} clearLabel="All branches" selected={filter.branch ? [filter.branch] : []} filterPlaceholder="Filter branches"
                items={[repo.branch, ...(names?.branches ?? []).filter((b) => b !== repo.branch)].map((e) => ({ id: e, label: e }))} onApply={(ids) => set({ branch: ids[0] })} />
              <SelectMenu title="Filter by actor" trigger={<>Actor{filter.actor ? `: ${filter.actor}` : ''}<Oct name="chevDown" size={12} /></>} triggerClassName={filterButton} clearLabel="All actors" selected={filter.actor ? [filter.actor] : []} filterPlaceholder="Filter users"
                items={people.map((u) => ({ id: u.login, label: u.login, leading: <Avatar c={u} src={u.avatar} size={20} /> }))} onApply={(ids) => set({ actor: ids[0] })} />
              {clearable ? <Button className={filterButton} onPress={() => nav.go({ s: 'actions', workflow: filter.workflow })}><Oct name="x" size={12} />Clear</Button> : null}
            </div>
          </div>
        }>
          <Loaded load={runs} className="rounded-none border-0">
            {(data) => (
              <div aria-busy={runs.loading} className={cn(runs.loading && 'opacity-70')}>
                {data.items.map((r) => <RunRow key={r.id} run={r} />)}
                {!data.items.length ? (
                  <div className="px-4 py-14 text-center">
                    <Oct name="play" size={24} className="text-muted-foreground" />
                    <h2 className="mt-3 mb-1 text-title font-semibold">{clearable ? 'No runs match these filters' : 'No workflow runs yet'}</h2>
                    {!clearable && !list.length ? <p className="m-0 text-muted-foreground">This repository has no workflows{can.push ? ': add a file under .github/workflows to start one.' : '.'}</p> : null}
                  </div>
                ) : null}
              </div>
            )}
          </Loaded>
        </Box>
        {runs.data ? <Pagination data={runs.data} go={(p) => nav.go({ ...filter, page: p })} /> : null}
      </div>
    </div>
  );
}

const NEW_WORKFLOW = `name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Hello from Actions"
`;

function RunActions({ run, compact }: { run: WorkflowRun; compact?: boolean }) {
  const { source, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const act = useAction();
  const active = run.status === 'running' || run.status === 'queued';
  return (
    <>
      <Menu label={`Actions for run ${run.number}`} triggerClassName={compact ? cn(ghButton(), 'h-7 w-7 border-0 bg-transparent px-0') : undefined} trigger={<Oct name="kebab" />} entries={[
        { id: 'open', label: 'View run', onAction: () => nav.go({ s: 'run', id: run.id }) },
        run.url ? { id: 'github', label: 'Open on GitHub', href: run.url, onAction: () => {} } : null,
        can.push && !active ? { id: 'rerun', label: 'Re-run all jobs', onAction: () => void act.run(async () => { await source.rerun(run.id, false); notify('Re-run requested'); }) } : null,
        can.push && active ? { id: 'cancel', label: 'Cancel run', onAction: () => void act.run(async () => { await source.cancelRun(run.id); notify('Cancel requested'); }) } : null,
        can.push && !active ? { id: 'delete', label: 'Delete run', danger: true, onAction: () => void act.run(async () => { await source.deleteRun(run.id); notify('Run deleted'); }) } : null,
      ]} />
      <ActionError error={act.error} className="w-full" />
    </>
  );
}

function RunRow({ run: r }: { run: WorkflowRun }) {
  const { ui } = useRepo();
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-border px-4 py-3 first:border-t-0 hover:bg-muted">
      <span className="pt-0.5" title={RUN_ICON[r.status][1]}>{RUN_ICON[r.status][0]}<span className="sr-only">{RUN_ICON[r.status][1]}</span></span>
      <div className="min-w-0 flex-1">
        <GhLink to={{ s: 'run', id: r.id }} className="block truncate font-semibold text-foreground no-underline hover:text-primary hover:underline">{r.title}</GhLink>
        <div className="mt-1 text-caption text-muted-foreground">
          <b className="font-semibold">{r.workflow}</b> #{r.number}: {r.pull ? <>{r.rawEvent} <GhLink to={{ s: 'pull', n: r.pull }}>#{r.pull}</GhLink></> : r.event} by <UserLink user={r.actor} />
        </div>
        {!ui.wide ? <div className="mt-1.5 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">{r.branch ? <Branch>{r.branch}</Branch> : null}{r.when}{r.duration ? ` · ${r.duration}` : ''}</div> : null}
      </div>
      {ui.wide ? (
        <>
          {r.branch ? <span className="shrink-0 pt-0.5"><Branch>{r.branch}</Branch></span> : null}
          <div className="w-[120px] shrink-0 space-y-1 text-caption text-muted-foreground">
            <div className="flex items-center gap-1.5" title={r.at ? new Date(r.at).toLocaleString() : undefined}><Oct name="calendar" size={14} />{r.when}</div>
            <div className="flex items-center gap-1.5"><Oct name="history" size={14} />{r.duration}</div>
          </div>
        </>
      ) : null}
      <RunActions run={r} compact />
    </div>
  );
}

function WorkflowMenu({ workflow, onDispatch }: { workflow: Workflow; onDispatch: () => void }) {
  const { source } = useRepo();
  const inputs = useLoad(`${source.id}:workflow-inputs:${workflow.path}`, () => source.workflowInputs(workflow.path, ''));
  const act = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {inputs.data?.dispatchable && workflow.active ? <Button className={ghButton(true)} onPress={onDispatch}><Oct name="play" />Run workflow</Button> : null}
      <Menu label={`More about ${workflow.name}`} trigger={<Oct name="kebab" />} entries={[
        { id: 'toggle', label: workflow.active ? 'Disable workflow' : 'Enable workflow', onAction: () => void act.run(() => source.setWorkflowEnabled(workflow.id, !workflow.active)) },
        workflow.url ? { id: 'github', label: 'Open on GitHub', href: workflow.url, onAction: () => {} } : null,
      ]} />
      <ActionError error={act.error} className="w-full" />
    </div>
  );
}

function DispatchForm({ workflow, onClose }: { workflow: Workflow; onClose: () => void }) {
  const { source, repo, notify } = useRepo();
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const [ref, setRef] = useState(repo.branch);
  const inputs = useLoad(`${source.id}:workflow-inputs:${workflow.path}:${ref}`, () => source.workflowInputs(workflow.path, ref));
  const [values, setValues] = useState<Record<string, string>>({});
  const act = useAction();
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const i of inputs.data?.inputs ?? []) next[i.name] = i.default ?? (i.options?.[0] ?? (i.type === 'boolean' ? 'false' : ''));
    setValues(next);
  }, [inputs.data]);
  const list = inputs.data?.inputs ?? [];
  const missing = list.some((i) => i.required && !values[i.name]);
  return (
    <form className="mb-4 grid gap-3 rounded-md border border-border p-3" aria-label={`Run ${workflow.name}`} onSubmit={(e) => { e.preventDefault(); if (!missing) void act.run(async () => { await source.dispatch(workflow.id, ref, values); notify('Workflow run requested'); onClose(); }); }}>
      <label className="grid gap-1 font-semibold">Use workflow from
        <select value={ref} onChange={(e) => setRef(e.target.value)} className="box-border h-8 rounded-md border border-border bg-background px-1 font-mono text-caption font-normal text-foreground group-data-[phone=true]/gh:h-11">
          {[repo.branch, ...(names?.branches ?? []).filter((b) => b !== repo.branch)].map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      {inputs.data && !inputs.data.dispatchable ? <p role="alert" className="m-0 text-caption text-(--gh-closed)">This workflow has no workflow_dispatch trigger on {ref}.</p> : null}
      {list.map((i) => (
        <label key={i.name} className="grid gap-1 font-semibold">
          <span>{i.description || i.name}{i.required ? <span className="text-(--gh-closed)"> *</span> : null}</span>
          {i.type === 'boolean' ? (
            <input type="checkbox" className="justify-self-start" checked={values[i.name] === 'true'} onChange={(e) => setValues({ ...values, [i.name]: String(e.target.checked) })} />
          ) : i.options?.length ? (
            <select value={values[i.name] ?? ''} onChange={(e) => setValues({ ...values, [i.name]: e.target.value })} className="box-border h-8 rounded-md border border-border bg-background px-1 font-sans text-detail font-normal text-foreground group-data-[phone=true]/gh:h-11">
              {i.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input value={values[i.name] ?? ''} onChange={(e) => setValues({ ...values, [i.name]: e.target.value })} className="box-border h-8 rounded-md border border-border bg-background px-2 font-sans text-detail font-normal text-foreground outline-none select-text focus:border-primary group-data-[phone=true]/gh:h-11" />
          )}
        </label>
      ))}
      <ActionError error={act.error} />
      <div className="flex justify-end gap-2">
        <Button className={ghButton()} onPress={onClose}>Cancel</Button>
        <Button type="submit" className={ghButton(true)} isDisabled={act.busy || missing || inputs.data?.dispatchable === false}>{act.busy ? 'Starting…' : 'Run workflow'}</Button>
      </div>
    </form>
  );
}

export function RunPage({ id }: { id: number }) {
  const { source, ui, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const run = useLoad(`${source.id}:run:${id}`, () => source.run(id));
  const act = useAction();
  const active = run.data?.status === 'running' || run.data?.status === 'queued';
  usePoll(source.live && !!active, 10_000, () => source.refresh('/actions'));
  if (run.error instanceof GitHubError && run.error.kind === 'notFound') return <div className={cn(ui.phone && 'p-4')}><Failed error={run.error} what={`There’s no workflow run ${id} in ${source.full}. It may have been deleted.`} /></div>;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      {!ui.phone ? <GhLink to={{ s: 'actions' }} className="mb-3 flex w-fit items-center gap-1 text-detail text-primary no-underline hover:underline"><Oct name="chevLeft" size={14} />All workflows</GhLink> : null}
      <Loaded load={run}>
        {(r) => (
          <>
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <span className="pt-1">{RUN_ICON[r.status][0]}</span>
              <div className="min-w-0 flex-1">
                <h1 className="m-0 text-title font-semibold">{r.title} <span className="font-normal text-muted-foreground">#{r.number}</span></h1>
                <p className="mt-1 mb-0 flex flex-wrap items-center gap-x-1.5 text-caption text-muted-foreground">
                  <span>{RUN_ICON[r.status][1]}</span> · <b className="font-semibold">{r.workflow}</b> · {r.rawEvent} by <UserLink user={r.actor} /> {r.when}{r.duration ? ` in ${r.duration}` : ''}{(r.attempt ?? 1) > 1 ? ` · attempt ${r.attempt}` : ''}
                  {r.branch ? <Branch>{r.branch}</Branch> : null}
                  {r.sha ? <GhLink to={{ s: 'commit', sha: r.sha }} className="font-mono text-primary no-underline hover:underline">{r.sha.slice(0, 7)}</GhLink> : null}
                  {r.pull ? <GhLink to={{ s: 'pull', n: r.pull }}>#{r.pull}</GhLink> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {can.push && active ? <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.cancelRun(r.id); notify('Cancel requested'); })}>Cancel run</Button> : null}
                {can.push && !active ? (
                  r.hasFailed ? (
                    <Menu label="Re-run jobs" trigger={<>Re-run jobs<Oct name="chevDown" size={12} /></>} entries={[
                      { id: 'failed', label: 'Re-run failed jobs', onAction: () => void act.run(async () => { await source.rerun(r.id, true); notify('Re-run requested'); }) },
                      { id: 'all', label: 'Re-run all jobs', onAction: () => void act.run(async () => { await source.rerun(r.id, false); notify('Re-run requested'); }) },
                    ]} />
                  ) : <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.rerun(r.id, false); notify('Re-run requested'); })}>Re-run all jobs</Button>
                ) : null}
                {can.push && !active ? <Button aria-label="Delete run" className={cn(ghButton(), 'text-(--gh-closed)')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteRun(r.id); notify('Run deleted'); nav.go({ s: 'actions' }, { replace: true }); })}><Oct name="trash" /></Button> : null}
                {r.url && source.live ? <a href={r.url} target="_blank" rel="noreferrer" className={cn(ghButton(), 'no-underline')}>Open on GitHub<Oct name="external" size={12} /></a> : null}
              </div>
            </div>
            <ActionError error={act.error} className="mb-3" />
            <h2 className="mt-0 mb-2 text-callout font-semibold">Jobs</h2>
            <div className="space-y-3">
              {r.jobs.map((j) => <JobCard key={j.id} job={j} />)}
              {!r.jobs.length ? <Box className="px-6 py-10 text-center text-muted-foreground">No jobs have started yet.</Box> : null}
            </div>
          </>
        )}
      </Loaded>
    </div>
  );
}

function JobCard({ job: j }: { job: { id: number; name: string; status: WorkflowRun['status']; duration: string; url?: string; steps: { number: number; name: string; status: WorkflowRun['status']; duration: string }[] } }) {
  const { source } = useRepo();
  const [open, setOpen] = useState(j.status === 'failure');
  const [showLog, setShowLog] = useState(false);
  const log = useLoad<string | null>(`${source.id}:log:${j.id}:${showLog}`, () => (showLog ? source.jobLog(j.id) : null));
  return (
    <Box>
      <Button aria-expanded={open} onPress={() => setOpen(!open)} className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-0 bg-muted px-3 text-left text-detail text-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary">
        <Oct name={open ? 'chevDown' : 'chevRight'} size={14} className="text-muted-foreground" />
        {RUN_ICON[j.status][0]}<span className="sr-only">{RUN_ICON[j.status][1]}</span>
        <b className="min-w-0 flex-1 truncate font-semibold">{j.name}</b>
        <span className="text-caption text-muted-foreground">{j.duration}</span>
      </Button>
      {open ? (
        <div className="border-t border-border">
          <ol className="m-0 list-none p-0">
            {j.steps.map((s) => (
              <li key={s.number} className="flex items-center gap-2 border-t border-border px-4 py-1.5 text-caption first:border-t-0">
                {RUN_ICON[s.status][0]}<span className="sr-only">{RUN_ICON[s.status][1]}</span>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-muted-foreground">{s.duration}</span>
              </li>
            ))}
          </ol>
          <div className="border-t border-border px-4 py-2">
            <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setShowLog(!showLog)}>{showLog ? 'Hide log' : 'View log'}</Button>
            {showLog ? (
              <div className="mt-2">
                {log.error ? (
                  <p role="alert" className="m-0 text-caption text-muted-foreground">
                    GitHub didn’t hand over this log in the browser ({log.error instanceof Error ? log.error.message : 'error'}). Logs redirect to storage that doesn’t always allow it, and expire after a while.{j.url ? <> <a className="text-primary" href={j.url} target="_blank" rel="noreferrer">Read it on GitHub</a>.</> : null}
                  </p>
                ) : log.loading ? <p className="m-0 text-caption text-muted-foreground">Loading the log…</p> : (
                  <pre className="m-0 max-h-[50vh] overflow-auto rounded-md bg-muted p-2 font-mono text-caption2 leading-4" tabIndex={0}>{log.data}</pre>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Box>
  );
}
