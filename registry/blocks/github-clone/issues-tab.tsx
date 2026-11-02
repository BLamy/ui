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
import { ActionError, Failed, Loaded, useAction, useCan, useLoad, useNav, useRepo } from './repo-context';
import { Thread, participantsOf } from './thread';

export function IssueList({ q, page = 1 }: { q?: string; page?: number }) {
  const { source, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const query = q ?? DEFAULT_ISSUE_Q;
  const go = (next: string, p?: number) => nav.go({ s: 'issues', q: next, page: p });
  const issues = useLoad(`${source.id}:issues:${query}:${page}`, () => source.searchIssues(query, page));
  const counts = useLoad(source.id + ':counts', source.counts).data;
  const labels = useLoad(source.id + ':labels', source.labels).data ?? [];
  if (!repo.has.issues) {
    return <Box className="grid place-items-center px-6 py-16 text-center"><Oct name="issue" size={24} className="text-muted-foreground" /><h2 className="mt-3 mb-1 text-title font-semibold">Issues are turned off</h2><p className="m-0 text-muted-foreground">This repository doesn’t use GitHub Issues.{can.admin ? ' Turn them on in Settings.' : ''}</p></Box>;
  }
  const state = queryState(query);
  const filtered = !/^\s*is:(open|closed)\s*$/.test(query);
  return (
    <div>
      <h1 className="sr-only">Issues</h1>
      <ListToolbar query={query} onQuery={(x) => go(x)} placeholder="Search all issues" canCreate={can.participate} newLabel="New issue" onNew={() => nav.go({ s: 'new-issue' })} />
      <ActiveFilters query={query} base={DEFAULT_ISSUE_Q} onQuery={(x) => go(x)} labels={labels} />
      <Box header={
        <div className="flex w-full flex-wrap items-center gap-x-2">
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
                  meta={<>#{i.number} {i.state === 'open' ? 'opened' : 'was closed'} <span title={i.at ? new Date(i.at).toLocaleString() : undefined}>{i.when}</span> by {i.author.login}{i.milestone ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="milestone" size={12} />{i.milestone}</span> : null}{i.locked ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="lock" size={12} />Locked</span> : null}</>}
                  assignees={i.assignees} comments={i.comments} />
              ))}
              {data.items.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <Oct name="issue" size={24} className="text-muted-foreground" />
                  <h2 className="mt-3 mb-1 text-title font-semibold">{filtered ? 'No results matched your search.' : `No ${state} issues.`}</h2>
                  {filtered ? <p className="m-0 text-muted-foreground">Try fewer filters. Search looks at titles, descriptions and comments.</p> : null}
                </div>
              ) : null}
            </div>
          )}
        </Loaded>
      </Box>
      {issues.data ? <Pagination data={issues.data} go={(p) => go(query, p)} /> : null}
      <p className="mt-4 text-center text-caption text-muted-foreground">
        <b className="font-semibold">ProTip!</b> Add <Button className="inline cursor-pointer border-0 bg-transparent p-0 outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary" onPress={() => go(`${query} no:assignee`)}><code className="rounded bg-secondary px-1 font-mono">no:assignee</code></Button> to see everything that’s not assigned.
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
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
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
              {titleDraft != null ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (titleDraft.trim()) void act.run(async () => { await save({ title: titleDraft.trim() }); setTitleDraft(null); }); }}>
                  <Input aria-label="Issue title" autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="h-9 min-w-[200px] flex-1 rounded-md border border-border bg-background text-title" />
                  <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !titleDraft.trim()}>Save</Button>
                  <Button className={ghButton()} onPress={() => { setTitleDraft(null); act.clear(); }}>Cancel</Button>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <h1 className={cn('m-0 min-w-0 flex-1 leading-tight font-normal', ui.phone ? 'text-title' : 'text-[32px]')}>{i.title} <span className="font-light text-muted-foreground">#{i.number}</span></h1>
                  <div className="flex shrink-0 gap-2 pt-1">
                    {canEdit ? <Button className={ghButton()} onPress={() => setTitleDraft(i.title)}>Edit</Button> : null}
                    {can.participate && !ui.phone ? <Button className={ghButton(true)} onPress={() => nav.go({ s: 'new-issue' })}>New issue</Button> : null}
                  </div>
                </div>
              )}
              <ActionError error={act.error} className="mt-2" />
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
  const [t, setT] = useState(title);
  const [b, setB] = useState(body);
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
      nav.go({ s: 'issue', n }, { replace: true });
    });
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
            <Input aria-required="true" aria-invalid={touched && !t.trim()} autoFocus value={t} onChange={(e) => setT(e.target.value)} placeholder="Title" className="h-9 rounded-md border border-border bg-background" />
            {touched && !t.trim() ? <span role="alert" className="text-caption text-(--gh-closed)">A title is required.</span> : null}
          </label>
          <div className="grid gap-1">
            <span className="font-semibold">Description</span>
            <MarkdownField label="Description" value={b} onChange={setB} onSubmit={submit} rows={10} placeholder="Type your description here…" disabled={act.busy} />
          </div>
          <ActionError error={act.error} />
          <div className="flex justify-end gap-2">
            <Button className={ghButton()} isDisabled={act.busy} onPress={() => nav.back()}>Cancel</Button>
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


