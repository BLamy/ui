/* Issues: the list (query box, filter menus, pages), one issue (conversation, details column, edit, close with a reason,
   reopen, lock, pin, delete) and the new-issue form with templates. Everything goes through the same search GitHub's own
   list uses, so what the box says is what you get. A number that turns out to be a pull request moves to its page, as
   GitHub's redirect does. */
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { GitHubError } from './github-api';
import { GhLink, UserLink } from './links';
import { ActiveFilters, FilterMenus, ItemRow, ListToolbar, Pagination, StateToggle, queryState, setQualifier, setQueryState } from './lists';
import { MarkdownField } from './markdown';
import { AssigneeSection, LabelSection, LockSection, MetaColumn, MilestoneSection, NotificationSection, ParticipantsSection, userPick } from './meta';
import { Box, LabelChip, Oct, StatePill, ghButton } from './parts';
import { Menu, SelectMenu } from './pickers';
import { DEFAULT_ISSUE_Q } from './route';
import { ActionError, CancelButton, Failed, Loaded, useAction, useCan, useDraft, useLoad, useNav, useRepo } from './repo-context';
import { Thread, participantsOf } from './thread';

export function IssueList({ q, page = 1 }: { q?: string; page?: number }) {
  const { source, repo, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const query = q ?? DEFAULT_ISSUE_Q;
  const go = (next: string, p?: number) => nav.go({ s: 'issues', q: next, page: p });
  const issues = useLoad(`${source.id}:issues:${query}:${page}`, () => source.searchIssues(query, page));
  const counts = useLoad(source.id + ':counts', source.counts).data;
  const labels = useLoad(source.id + ':labels', source.labels).data ?? [];
  const people = useLoad(source.id + ':assignable', source.assignable).data ?? [];
  const milestones = useLoad(source.id + ':milestones:open', () => source.milestones('open')).data ?? [];
  const [picked, setPicked] = useState<number[]>([]);
  const act = useAction();
  if (!repo.has.issues) {
    return <Box className="grid place-items-center px-6 py-16 text-center"><Oct name="issue" size={24} className="text-muted-foreground" /><h2 className="mt-3 mb-1 text-title font-semibold">Issues are turned off</h2><p className="m-0 text-muted-foreground">This repository doesn’t use GitHub Issues.{can.admin ? ' Turn them on in Settings.' : ''}</p></Box>;
  }
  const state = queryState(query);
  const filtered = !/^\s*is:(open|closed)\s*$/.test(query);
  const rows = issues.data?.items ?? [];
  const chosen = rows.filter((i) => picked.includes(i.number)).map((i) => i.number);
  /* The same write once per issue: GitHub has no bulk endpoint. Stops at the first refusal and says how far it got. */
  const bulk = (what: string, patch: Parameters<typeof source.updateIssue>[1]) => void act.run(async () => {
    let done = 0;
    try {
      for (const n of chosen) { await source.updateIssue(n, patch); done++; }
    } catch (e) {
      throw new Error(`${e instanceof Error ? e.message : String(e)} (${done} of ${chosen.length} done)`);
    }
    setPicked([]);
    notify(`Updated ${done} issue${done === 1 ? '' : 's'}`);
  }, what);
  return (
    <div>
      <h1 className="sr-only">Issues</h1>
      <ListToolbar query={query} onQuery={(x) => go(x)} placeholder="Search all issues" canCreate={can.participate} newLabel="New issue" onNew={() => nav.go({ s: 'new-issue' })} />
      <ActiveFilters query={query} base={DEFAULT_ISSUE_Q} onQuery={(x) => go(x)} labels={labels} />
      <ActionError error={act.error} onDismiss={act.clear} className="mb-2" />
      {chosen.length ? (
        <div role="toolbar" aria-label="Selected issues" className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/8 px-3 py-1.5">
          <b className="font-semibold" role="status">{chosen.length} selected</b>
          <span className="flex-1" />
          <Menu label="Mark selected issues as" trigger={<>Mark as<Oct name="chevDown" size={12} /></>} entries={[
            { id: 'open', label: 'Open', onAction: () => bulk('reopen those issues', { state: 'open' }) },
            { id: 'done', label: 'Closed as completed', onAction: () => bulk('close those issues', { state: 'closed', stateReason: 'completed' }) },
            { id: 'no', label: 'Closed as not planned', onAction: () => bulk('close those issues', { state: 'closed', stateReason: 'not_planned' }) },
          ]} />
          <SelectMenu title="Replace labels on selected issues" trigger={<>Label<Oct name="chevDown" size={12} /></>} items={labels.map((l) => ({ id: l.name, label: l.name, leading: <span className="size-3.5 shrink-0 rounded-full" style={{ background: l.color }} /> }))} selected={[]} multiple filterPlaceholder="Filter labels" onApply={(ids) => bulk('label those issues', { labels: ids })} />
          <SelectMenu title="Assign selected issues" trigger={<>Assign<Oct name="chevDown" size={12} /></>} items={people.map(userPick)} selected={[]} multiple filterPlaceholder="Filter users" onApply={(ids) => bulk('assign those issues', { assignees: ids })} />
          <SelectMenu title="Set milestone on selected issues" trigger={<>Milestone<Oct name="chevDown" size={12} /></>} items={milestones.map((m) => ({ id: String(m.number), label: m.title }))} selected={[]} clearLabel="No milestone" empty="No milestones" onApply={(ids) => bulk('set that milestone', { milestone: ids[0] ? Number(ids[0]) : null })} />
          <Button className={ghButton()} onPress={() => setPicked([])}>Clear</Button>
        </div>
      ) : null}
      <Box header={
        <div className="flex w-full flex-wrap items-center gap-x-2">
          {can.triage && rows.length ? <input type="checkbox" aria-label="Select all on this page" checked={chosen.length === rows.length} onChange={(e) => setPicked(e.target.checked ? rows.map((i) => i.number) : [])} className="size-4 cursor-pointer group-data-[phone=true]/gh:size-6" /> : null}
          <StateToggle value={state} onChange={(v) => go(setQueryState(query, v))} open={filtered ? undefined : counts?.issues.open} closed={filtered ? undefined : counts?.issues.closed} closedIcon="check" />
          {filtered && issues.data?.total != null ? <span className="text-caption text-muted-foreground" role="status">{issues.data.total.toLocaleString('en-US')} result{issues.data.total === 1 ? '' : 's'}</span> : null}
          <FilterMenus query={query} onQuery={(x) => go(x)} />
        </div>
      }>
        <Loaded load={issues} className="rounded-none border-0">
          {(data) => (
            <div className={cn(issues.loading && 'opacity-70')} aria-busy={issues.loading}>
              {data.items.map((i) => (
                <ItemRow key={i.number} state={i.state === 'open' ? 'open' : i.stateReason === 'not_planned' ? 'draft' : 'closed'} stateText={i.state === 'open' ? 'Open' : i.stateReason === 'not_planned' ? 'Closed as not planned' : 'Closed'} title={i.title} labels={i.labels} to={{ s: 'issue', n: i.number }}
                  onLabel={(l) => go(setQualifier(query, 'label', [l]))}
                  selected={picked.includes(i.number)} onSelect={can.triage ? (on) => setPicked((p) => (on ? [...p, i.number] : p.filter((x) => x !== i.number))) : undefined}
                  meta={<>#{i.number} {i.state === 'open' ? 'opened' : 'was closed'} <span title={i.at ? new Date(i.at).toLocaleString() : undefined}>{i.when}</span> by {i.author.login}{i.milestone ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="milestone" size={12} />{i.milestone}</span> : null}{i.locked ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="lock" size={12} />Locked</span> : null}</>}
                  assignees={i.assignees} comments={i.comments} />
              ))}
              {data.items.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <Oct name="issue" size={24} className="text-muted-foreground" />
                  <h2 className="mt-3 mb-1 text-title font-semibold">{page > 1 ? `There’s no page ${page}.` : filtered ? 'No results matched your search.' : `No ${state} issues.`}</h2>
                  {page > 1 ? <Button className={ghButton()} onPress={() => go(query)}>Back to the first page</Button> : filtered ? <p className="m-0 text-muted-foreground">Try fewer filters. Search looks at titles, descriptions and comments.</p> : null}
                </div>
              ) : null}
            </div>
          )}
        </Loaded>
      </Box>
      {issues.data?.items.length ? <Pagination data={issues.data} go={(p) => go(query, p)} /> : null}
      <p className="mt-4 text-center text-caption text-muted-foreground">
        <b className="font-semibold">ProTip!</b> Add <Button className="inline cursor-pointer border-0 bg-transparent p-0 outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary" onPress={() => go(/(?:^|\s)no:assignee\b/.test(query) ? query : `${query} no:assignee`)}><code className="rounded bg-secondary px-1 font-mono">no:assignee</code></Button> to see everything that’s not assigned.
      </p>
    </div>
  );
}

const closedPill = (reason?: string | null) => (reason === 'not_planned' ? 'draft' : 'closed') as 'draft' | 'closed';

/** One issue: title, state, and its conversation. */
export function IssueView({ number }: { number: number }) {
  const { source, ui, viewer, repo, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const issue = useLoad(`${source.id}:issue:${number}`, () => source.issue(number));
  const extras = useLoad(`${source.id}:issue-extras:${number}`, () => source.issueExtras(number)).data;
  const timeline = useLoad(`${source.id}:timeline:${number}`, () => source.timeline(number)).data ?? [];
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const act = useAction();
  const isPull = issue.data?.url?.includes('/pull/');
  useEffect(() => { if (isPull) nav.go({ s: 'pull', n: number }, { replace: true }); }, [isPull, number]);
  if (issue.error instanceof GitHubError && issue.error.kind === 'notFound') {
    return <div className={cn(ui.phone && 'p-4')}><Failed error={issue.error} what={`There’s no issue #${number} in ${source.full}. It may have been deleted.`} /></div>;
  }
  return (
    <div className={cn(ui.phone && 'px-4 py-4')}>
      {!ui.phone ? <GhLink to={{ s: 'issues' }} className="mb-3 flex w-fit items-center gap-1 text-detail text-primary no-underline hover:underline"><Oct name="chevLeft" size={14} />Issues</GhLink> : null}
      <Loaded load={issue}>
        {(i) => {
          const mine = viewer?.login === i.author.login;
          const canEdit = can.participate && (mine || can.triage);
          const save = (patch: Parameters<typeof source.updateIssue>[1]) => source.updateIssue(number, patch);
          return (
            <>
              {titleEdit != null ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (titleEdit.trim()) void act.run(async () => { await save({ title: titleEdit.trim() }); setTitleEdit(null); }, 'rename the issue'); }}>
                  <Input aria-label="Issue title" autoFocus value={titleEdit} onChange={(e) => setTitleEdit(e.target.value)} className="h-9 min-w-[200px] flex-1 rounded-md border border-border bg-background text-title group-data-[phone=true]/gh:h-11" />
                  <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !titleEdit.trim()}>Save</Button>
                  <Button className={ghButton()} onPress={() => { setTitleEdit(null); act.clear(); }}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <h1 className={cn('m-0 min-w-0 flex-1 leading-tight font-normal break-words', ui.phone ? 'text-title' : 'text-[32px]')}>{i.title} <span className="font-light text-muted-foreground">#{i.number}</span></h1>
                  <div className="flex shrink-0 gap-2 pt-1">
                    {canEdit ? <Button className={ghButton()} onPress={() => setTitleEdit(i.title)}>Edit</Button> : null}
                    {can.participate && !ui.phone ? <Button className={ghButton(true)} onPress={() => nav.go({ s: 'new-issue' })}>New issue</Button> : null}
                  </div>
                </div>
              )}
              <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
              <div className="mt-3 mb-2 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border pb-4 text-muted-foreground">
                <StatePill state={i.state === 'open' ? 'open' : closedPill(i.stateReason)} label={i.state === 'closed' && i.stateReason === 'not_planned' ? 'Closed as not planned' : undefined} />
                <span className="leading-6"><UserLink user={i.author} className="font-semibold text-foreground" /> opened this issue {i.when} · {i.comments} comment{i.comments === 1 ? '' : 's'}</span>
                {i.locked ? <span className="inline-flex items-center gap-1"><Oct name="lock" size={14} />Locked</span> : null}
                {extras?.pinned ? <span className="inline-flex items-center gap-1"><Oct name="pin" size={14} />Pinned</span> : null}
              </div>
              <div className={cn(ui.wide && 'flex gap-6')}>
                <MetaColumn summary={[i.labels.length ? `${i.labels.length} label${i.labels.length === 1 ? '' : 's'}` : null, i.assignees.length ? `${i.assignees.length} assignee${i.assignees.length === 1 ? '' : 's'}` : null, i.milestone].filter(Boolean).join(' · ') || 'Labels, assignees, milestone'}>
                  <div className={cn(ui.wide && 'order-2')}>
                    <AssigneeSection value={i.assignees} editable={can.triage} onSave={(assignees) => save({ assignees })} />
                    <LabelSection value={i.labels} editable={can.triage} onSave={(labels) => save({ labels })} query="issues" />
                    <MilestoneSection value={i.milestoneDetail} editable={can.triage} onSave={(milestone) => save({ milestone })} />
                    {extras && can.signedIn ? <NotificationSection subscribed={extras.subscribed} disabled={false} onToggle={(on) => source.setThreadSubscribed(extras.id, number, on)} /> : null}
                    <ParticipantsSection users={participantsOf(timeline)} />
                    <LockSection locked={!!i.locked} reason={i.lockReason} number={number} />
                    {extras && can.triage ? (
                      <div className="flex flex-wrap gap-2 py-4">
                        <Button className={cn(ghButton(), 'flex-1')} isDisabled={act.busy} onPress={() => void act.run(() => source.setPinned(extras.id, number, !extras.pinned))}><Oct name="pin" />{extras.pinned ? 'Unpin' : 'Pin issue'}</Button>
                        {extras.canDelete ? <Button className={cn(ghButton(), 'flex-1 text-(--gh-closed)')} onPress={() => setConfirmDelete(true)}><Oct name="trash" />Delete issue</Button> : null}
                      </div>
                    ) : null}
                    {confirmDelete && extras ? (
                      <div role="alertdialog" aria-label="Delete this issue?" className="mb-4 rounded-md border border-(--gh-closed) p-3 text-caption">
                        <p className="mt-0 mb-2 font-semibold">Delete issue #{number}? This can’t be undone.</p>
                        <div className="flex justify-end gap-2">
                          <Button className={ghButton()} onPress={() => setConfirmDelete(false)}>Cancel</Button>
                          <Button className={cn(ghButton(), 'text-(--gh-closed)')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteIssue(extras.id, number); notify(`Issue #${number} deleted`); nav.go({ s: 'issues' }, { replace: true }); })}>Delete this issue</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </MetaColumn>
                <div className={cn('min-w-0 flex-1', ui.wide && '-order-1')}>
                  <Thread number={i.number} authorLogin={i.author.login} locked={i.locked} canEditBody={canEdit} saveBody={(body) => save({ body })}
                    actions={({ text, submit, busy }) => {
                      if (!canEdit) return null;
                      const closeAs = (reason: 'completed' | 'not_planned') => void act.run(async () => { if (await submit()) await save({ state: 'closed', stateReason: reason }); });
                      const withText = text.trim() ? ' with comment' : '';
                      return i.state === 'open' ? (
                        <div className="flex">
                          <Button className={cn(ghButton(), 'rounded-r-none')} isDisabled={busy || act.busy} onPress={() => closeAs('completed')}><Oct name="issueClosed" className="text-(--gh-done)" />Close{withText || ' issue'}</Button>
                          <Menu label="Close with a reason" triggerClassName={cn(ghButton(), '-ml-px rounded-l-none px-2')} trigger={<Oct name="chevDown" size={12} />} placement="top end" entries={[
                            { id: 'done', label: 'Close as completed', hint: 'Done, closed, fixed, resolved', icon: <Oct name="issueClosed" className="text-(--gh-done)" />, onAction: () => closeAs('completed') },
                            { id: 'no', label: 'Close as not planned', hint: 'Won’t fix, can’t repro, duplicate, stale', icon: <Oct name="stopFill" />, onAction: () => closeAs('not_planned') },
                          ]} />
                        </div>
                      ) : (
                        <Button className={ghButton()} isDisabled={busy || act.busy} onPress={() => void act.run(async () => { if (await submit()) await save({ state: 'open' }); })}><Oct name="issue" className="text-(--gh-open)" />Reopen{withText || ' issue'}</Button>
                      );
                    }} />
                </div>
              </div>
              <span className="hidden">{repo.name}</span>
            </>
          );
        }}
      </Loaded>
    </div>
  );
}

/** A new issue: template choice, then title, body, and (with triage) labels, assignees and a milestone. */
export function NewIssue({ title = '', body = '' }: { title?: string; body?: string }) {
  const { source, ui, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const templates = useLoad(source.id + ':issue-templates', source.issueTemplates).data ?? [];
  const labelList = useLoad(source.id + ':labels', source.labels).data ?? [];
  const people = useLoad(source.id + ':assignable', source.assignable).data ?? [];
  const milestones = useLoad(source.id + ':milestones:open', () => source.milestones('open')).data ?? [];
  const titleDraft = useDraft(`${source.id}:new-issue:title`, title);
  const bodyDraft = useDraft(`${source.id}:new-issue:body`, body);
  const t = titleDraft.value;
  const setT = titleDraft.set;
  const b = bodyDraft.value;
  const setB = bodyDraft.set;
  const [labels, setLabels] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [milestone, setMilestone] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const submit = () => {
    setTouched(true);
    if (!t.trim()) return;
    void act.run(async () => {
      const n = await source.createIssue({ title: t.trim(), body: b, labels, assignees, milestone });
      titleDraft.clear();
      bodyDraft.clear();
      nav.go({ s: 'issue', n }, { replace: true });
    }, 'create the issue');
  };
  const applyTemplate = (x: (typeof templates)[number]) => { setT(x.title); setB(x.body); setLabels(x.labels); };
  const chosen = useMemo(() => labelList.filter((l) => labels.includes(l.name)), [labelList, labels]);
  if (repo.archived) return <Box className="px-6 py-12 text-center text-muted-foreground">This repository is archived, so it can’t take new issues.</Box>;
  return (
    <div className={cn('mx-auto max-w-[900px]', ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-4 text-title font-semibold">Create new issue</h1>
      {templates.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Start from a template:</span>
          {templates.map((x) => <Button key={x.name} className={ghButton()} onPress={() => applyTemplate(x)}>{x.name}</Button>)}
        </div>
      ) : null}
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className={cn(ui.wide && 'flex gap-6')}>
        <div className="min-w-0 flex-1 space-y-3">
          <label className="grid gap-1">
            <span className="font-semibold">Title <span className="text-(--gh-closed)">*</span></span>
            <Input aria-required="true" aria-invalid={touched && !t.trim()} autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="Title" className="h-9 rounded-md border border-border bg-background group-data-[phone=true]/gh:h-11" />
            {touched && !t.trim() ? <span role="alert" className="text-caption text-(--gh-closed)">A title is required.</span> : null}
          </label>
          <div className="grid gap-1">
            <span className="font-semibold">Description</span>
            <MarkdownField label="Description" value={b} onChange={setB} onSubmit={submit} rows={10} placeholder="Type your description here…" disabled={act.busy} />
          </div>
          <ActionError error={act.error} onDismiss={act.clear} />
          <div className="flex justify-end gap-2">
            <CancelButton dirty={titleDraft.dirty || bodyDraft.dirty} isDisabled={act.busy} onCancel={() => { titleDraft.clear(); bodyDraft.clear(); nav.back(); }} />
            <Button type="submit" className={ghButton(true)} isDisabled={act.busy}>{act.busy ? 'Creating…' : 'Create'}</Button>
          </div>
        </div>
        <aside aria-label="Issue details" className={cn(ui.wide ? 'w-[256px] shrink-0' : 'mt-4')}>
          {can.triage ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SelectMenu title="Assign up to 10 people" multiple trigger={<><Oct name="people" />Assignees{assignees.length ? ` (${assignees.length})` : ''}</>} items={people.map(userPick)} selected={assignees} onApply={setAssignees} filterPlaceholder="Filter users" />
                <SelectMenu title="Apply labels" multiple trigger={<><Oct name="tag" />Labels{labels.length ? ` (${labels.length})` : ''}</>} items={labelList.map((l) => ({ id: l.name, label: l.name, description: l.description, leading: <span className="size-3.5 shrink-0 rounded-full" style={{ background: l.color }} /> }))} selected={labels} onApply={setLabels} filterPlaceholder="Filter labels" />
                <SelectMenu title="Set milestone" trigger={<><Oct name="milestone" />{milestones.find((m) => m.number === milestone)?.title ?? 'Milestone'}</>} items={milestones.map((m) => ({ id: String(m.number), label: m.title }))} selected={milestone ? [String(milestone)] : []} clearLabel="No milestone" onApply={(ids) => setMilestone(ids[0] ? Number(ids[0]) : null)} empty="No milestones" />
              </div>
              {assignees.length ? <div className="flex flex-wrap gap-1.5">{people.filter((u) => assignees.includes(u.login)).map((u) => <span key={u.login} className="inline-flex items-center gap-1 text-caption"><Avatar c={u} src={u.avatar} size={16} />{u.login}</span>)}</div> : null}
              {chosen.length ? <div className="flex flex-wrap gap-1">{chosen.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}</div> : null}
            </div>
          ) : <p className="m-0 text-caption text-muted-foreground">Only people with triage access can set labels, assignees and milestones. Someone will triage this after you create it.</p>}
        </aside>
      </form>
    </div>
  );
}


