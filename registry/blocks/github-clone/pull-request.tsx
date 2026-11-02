/* A pull request: title and state, then Conversation, Commits, Checks and Files changed. Everything here happens here:
   edit the title, description and base branch; close and reopen; draft and ready; request reviewers; comment on lines,
   collect them into a review and submit it; resolve threads; merge by any method the repository allows, with a truthful
   box saying why it can't when it can't. */
import { useMemo, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabView, TabViewBar, TabViewFooter, TabViewList, TabViewPanels } from '@/components/ui/tab-view';
import { cn } from '@/lib/utils';
import { GitHubError } from './github-api';
import { DiffFiles, type DiffReview } from './diff';
import type { Check, PullDetail, ReviewEvent, ReviewThread } from './data';
import { BranchLink, GhLink, UserLink } from './links';
import { MarkdownField } from './markdown';
import { AssigneeSection, LabelSection, LockSection, MetaColumn, MilestoneSection, NotificationSection, ParticipantsSection, ReviewerSection } from './meta';
import { Box, DiffStat, FlowPanel, Oct, StatePill, UnderlineTab, ghButton, PR_STATE } from './parts';
import { Menu, SelectMenu } from './pickers';
import type { PullTab } from './route';
import { ActionError, CancelButton, Failed, Loaded, useAction, useCan, useCopy, useDraft, useLoad, useNav, usePoll, useRepo } from './repo-context';
import { CommentCard, Thread, participantsOf } from './thread';

export function PullRequestView({ number, tab = 'conversation', commit }: { number: number; tab?: PullTab; commit?: string }) {
  const { source, ui, viewer } = useRepo();
  const copy = useCopy();
  const nav = useNav();
  const can = useCan();
  const pull = useLoad(`${source.id}:pull:${number}`, () => source.pull(number));
  const checks = useLoad(`${source.id}:checks:${number}`, () => source.pullChecks(number));
  const threads = useLoad(`${source.id}:threads:${number}`, () => source.pullThreads(number));
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const act = useAction();
  const p = pull.data;
  const running = (checks.data ?? []).some((c) => c.status === 'pending');
  // GitHub computes mergeability after the fact; checks change while they run. Ask again while either is unsettled.
  const unsettled = !!p && (p.state === 'open' || p.state === 'draft') && (p.canMerge === null || p.mergeable === 'unknown');
  usePoll(source.live && unsettled, 5000, () => source.refresh(`/pulls/${number}`));
  usePoll(source.live && running, 20_000, () => source.refresh(`/commits/${p?.headSha}`));
  if (pull.error instanceof GitHubError && pull.error.kind === 'notFound') {
    return <div className={cn(ui.phone && 'p-4')}><Failed error={pull.error} what={`There’s no pull request #${number} in ${source.full}.`} /></div>;
  }
  const canEdit = !!p && can.participate && (can.push || viewer?.login === p.author.login);
  return (
    <div className={cn(ui.phone && 'px-4 py-4')}>
      {!ui.phone ? <GhLink to={{ s: 'pulls' }} className="mb-3 flex w-fit items-center gap-1 text-detail text-primary no-underline hover:underline"><Oct name="chevLeft" size={14} />Pull requests</GhLink> : null}
      <Loaded load={pull}>
        {(pr) => (
          <>
            {titleDraft != null ? (
              <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (titleDraft.trim()) void act.run(async () => { await source.updatePull(number, { title: titleDraft.trim() }); setTitleDraft(null); }); }}>
                <Input aria-label="Pull request title" autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="h-9 min-w-[200px] flex-1 rounded-md border border-border bg-background text-title group-data-[phone=true]/gh:h-11" />
                <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !titleDraft.trim()}>Save</Button>
                <Button className={ghButton()} onPress={() => { setTitleDraft(null); act.clear(); }}>Cancel</Button>
              </form>
            ) : (
              <div className="flex items-start gap-4">
                <h1 className={cn('m-0 min-w-0 flex-1 leading-tight font-normal', ui.phone ? 'text-title' : 'text-[32px]')}>
                  {pr.title} <span className="font-light text-muted-foreground">#{pr.number}</span>
                </h1>
                <div className="flex shrink-0 gap-2 pt-1">
                  {canEdit ? <Button className={ghButton()} onPress={() => setTitleDraft(pr.title)}>Edit</Button> : null}
                  {!ui.phone ? <Button className={ghButton()} onPress={nav.clone}><Oct name="code" />Code<Oct name="chevDown" size={12} /></Button> : null}
                </div>
              </div>
            )}
            <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border pb-4 text-muted-foreground">
              <StatePill state={PR_STATE[pr.state]} />
              <span className="leading-7">
                <UserLink user={pr.author} className="font-semibold text-foreground" /> {pr.state === 'merged' ? <>merged {pr.commits} commit{pr.commits === 1 ? '' : 's'} into</> : <>wants to merge {pr.commits} commit{pr.commits === 1 ? '' : 's'} into</>}{' '}
                <BaseBranch pr={pr} canEdit={canEdit && (pr.state === 'open' || pr.state === 'draft')} /> from <BranchLink name={pr.head} repo={pr.headRepo} deleted={pr.headDeleted} />
                {pr.state === 'merged' && pr.mergedWhen ? ` ${pr.mergedWhen}` : ''}
              </span>
              <Button aria-label={`Copy branch name ${pr.head}`} className="grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-primary group-data-[phone=true]/gh:size-11"
                onPress={() => void copy(pr.head, 'Branch name copied')}><Oct name="copy" size={14} /></Button>
            </div>
            <TabView placement="top" selectedKey={tab} onSelectionChange={(k) => nav.go({ s: 'pull', n: number, tab: k as PullTab }, { replace: true })} className="mt-2">
              <TabViewBar variant="plain" className="overflow-x-auto border-b border-border [scrollbar-width:none]">
                <TabViewList aria-label="Pull request" className="flex gap-1">
                  <UnderlineTab id="conversation" icon="comment" label="Conversation" count={pr.comments} />
                  <UnderlineTab id="commits" icon="commit" label="Commits" count={pr.commits} />
                  <UnderlineTab id="checks" icon="checkFill" label="Checks" count={checks.data?.length} />
                  <UnderlineTab id="files" icon="file" label="Files changed" count={pr.changedFiles} />
                </TabViewList>
                {!ui.phone ? <TabViewFooter className="pl-4"><DiffStat add={pr.additions} del={pr.deletions} /></TabViewFooter> : null}
              </TabViewBar>
              <TabViewPanels className="pt-6">
                <FlowPanel id="conversation"><Conversation pr={pr} checks={checks.data ?? []} threads={threads.data?.threads ?? []} canEdit={canEdit} /></FlowPanel>
                <FlowPanel id="commits"><PullCommits number={pr.number} /></FlowPanel>
                <FlowPanel id="checks"><Loaded load={checks}>{(c) => <Checks checks={c} />}</Loaded></FlowPanel>
                <FlowPanel id="files"><FilesChanged pr={pr} commit={commit} /></FlowPanel>
              </TabViewPanels>
            </TabView>
          </>
        )}
      </Loaded>
    </div>
  );
}

function BaseBranch({ pr, canEdit }: { pr: PullDetail; canEdit: boolean }) {
  const { source } = useRepo();
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const act = useAction();
  if (!canEdit) return <BranchLink name={pr.base} />;
  return (
    <>
      <SelectMenu title="Choose a base branch" triggerLabel={`Base branch: ${pr.base}. Change`} triggerClassName="inline cursor-pointer rounded-md border-0 bg-primary/10 px-1.5 py-0.5 font-mono text-caption text-primary outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary"
        trigger={<>{pr.base}<Oct name="chevDown" size={10} className="ml-1" /></>} selected={[pr.base]} items={(names?.branches ?? []).filter((b) => b !== pr.head).map((b) => ({ id: b, label: b }))} filterPlaceholder="Filter branches"
        onApply={(ids) => { if (ids[0]) void act.run(() => source.updatePull(pr.number, { base: ids[0] })); }} />
      <ActionError error={act.error} onDismiss={act.clear} />
    </>
  );
}

/* ── Conversation ── */

export function Conversation({ pr, checks, threads, canEdit }: { pr: PullDetail; checks: Check[]; threads: ReviewThread[]; canEdit: boolean }) {
  const { source, ui, viewer } = useRepo();
  const can = useCan();
  const timeline = useLoad(`${source.id}:timeline:${pr.number}`, () => source.timeline(pr.number)).data ?? [];
  const extras = useLoad(`${source.id}:pull-extras:${pr.number}`, () => source.pullExtras(pr.number)).data;
  const n = pr.number;
  const act = useAction();
  const inReviewCounts = useMemo(() => new Map<number, ReviewThread[]>(threads.reduce<[number, ReviewThread[]][]>((all, t) => {
    const id = t.comments[0]?.reviewId;
    if (id == null) return all;
    const hit = all.find((x) => x[0] === id);
    if (hit) hit[1].push(t);
    else all.push([id, [t]]);
    return all;
  }, [])), [threads]);
  const isOpen = pr.state === 'open' || pr.state === 'draft';
  const pendingThreads = threads.filter((t) => t.comments.some((c) => c.pending));
  const canReopen = pr.state === 'closed';
  const summary = [`${pr.reviewers.length} reviewer${pr.reviewers.length === 1 ? '' : 's'}`, pr.labels.length ? `${pr.labels.length} label${pr.labels.length === 1 ? '' : 's'}` : null, pr.milestone].filter(Boolean).join(' · ');
  const details = (
      <MetaColumn summary={summary}>
        <ReviewerSection value={pr.reviewers} editable={can.triage && isOpen} author={pr.author.login}
          onRequest={async (add, remove) => { if (add.length) await source.requestReviewers(n, add); if (remove.length) await source.removeReviewers(n, remove); }}
          onDismiss={can.push ? (r, message) => source.dismissReview(n, r.reviewId!, message) : undefined} />
        <AssigneeSection value={pr.assignees} editable={can.triage} onSave={(assignees) => source.updateIssue(n, { assignees })} />
        <LabelSection value={pr.labels} editable={can.triage} onSave={(labels) => source.updateIssue(n, { labels })} query="pulls" />
        <MilestoneSection value={pr.milestoneDetail} editable={can.triage} onSave={(milestone) => source.updateIssue(n, { milestone })} />
        {extras?.closes.length ? (
          <div className="border-b border-border py-4 text-caption">
            <div className="mb-2 font-semibold text-muted-foreground">Development</div>
            <p className="m-0 text-muted-foreground">{pr.state === 'merged' ? 'Merging this pull request closed these issues.' : 'Successfully merging this pull request may close these issues.'}</p>
            {extras.closes.map((c) => (
              <p key={c.number} className="mt-2 mb-0 flex items-center gap-1.5"><Oct name={c.state === 'open' ? 'issue' : 'issueClosed'} size={14} className={c.state === 'open' ? 'text-(--gh-open)' : 'text-(--gh-done)'} />
                <GhLink to={{ s: 'issue', n: c.number }} className="font-semibold text-foreground no-underline hover:text-primary">{c.title} #{c.number}</GhLink></p>
            ))}
          </div>
        ) : null}
        {extras && can.signedIn ? <NotificationSection subscribed={extras.subscribed} disabled={false} onToggle={(on) => source.setThreadSubscribed(pr.nodeId, n, on)} /> : null}
        <ParticipantsSection users={participantsOf(timeline)} />
        <LockSection locked={!!pr.locked} reason={pr.lockReason} number={n} />
      </MetaColumn>
  );
  return (
    <div className={cn(ui.wide && 'flex gap-6')}>
      {!ui.wide ? details : null}
      <div className="min-w-0 flex-1">
        <Thread number={n} authorLogin={pr.author.login} locked={pr.locked} canEditBody={canEdit} saveBody={(body) => source.updatePull(n, { body })}
          threadsFor={(id) => (id != null ? inReviewCounts.get(id) : undefined)} renderThreads={(list) => <div className="space-y-2">{list.map((t) => <ThreadCard key={t.id} thread={t} number={n} showContext />)}</div>}
          footer={
            <>
              {pendingThreads.length ? (
                <section aria-label="Your pending review" className={cn('space-y-2 pt-4', !ui.phone && 'pl-14')}>
                  <h2 className="m-0 text-detail font-semibold">Your pending review <span className="font-normal text-muted-foreground">· only you can see these until you submit it on Files changed</span></h2>
                  {pendingThreads.map((t) => <ThreadCard key={t.id} thread={t} number={n} showContext />)}
                </section>
              ) : null}
              {isOpen ? <MergeBox pr={pr} checks={checks} threads={threads} /> : <MergedBox pr={pr} />}
            </>
          }
          actions={({ text, submit, busy }) => {
            const mine = viewer?.login === pr.author.login;
            if (!(can.push || (mine && can.participate))) return null;
            if (isOpen) return <Button className={ghButton()} isDisabled={busy || act.busy} onPress={() => void act.run(async () => { if (await submit()) await source.updatePull(n, { state: 'closed' }); })}><Oct name="prClosed" className="text-(--gh-closed)" />Close{text.trim() ? ' with comment' : ' pull request'}</Button>;
            if (canReopen && !pr.headDeleted) return <Button className={ghButton()} isDisabled={busy || act.busy} onPress={() => void act.run(async () => { if (await submit()) await source.updatePull(n, { state: 'open' }); })}><Oct name="pr" className="text-(--gh-open)" />Reopen{text.trim() ? ' with comment' : ' pull request'}</Button>;
            return null;
          }} />
        <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
      </div>
      {ui.wide ? details : null}
    </div>
  );
}

/* ── Review threads ── */

/** ```suggestion fences in a review comment: what to replace the commented lines with. */
export const suggestionOf = (body: string): string | null => /```suggestion[^\n]*\n([\s\S]*?)```/.exec(body)?.[1] ?? null;

/** Replaces lines `from`..`to` (1-based) with `text`; an empty suggestion deletes them. */
export function applyLines(file: string, from: number, to: number, text: string): string {
  const lines = file.split('\n');
  lines.splice(from - 1, to - from + 1, ...(text === '' ? [] : text.replace(/\n$/, '').split('\n')));
  return lines.join('\n');
}

/** What a review comment's lines said when it was made: the end of its diff hunk is the commented lines, oldest first. */
export function reviewedLines(hunk: string, count: number): string[] | null {
  const rows = hunk.split('\n').filter((l) => l && !l.startsWith('@@') && !l.startsWith('-') && !l.startsWith('\\'));
  return rows.length >= count ? rows.slice(-count).map((l) => l.slice(1)) : null;
}

export function ThreadCard({ thread, number, showContext }: { thread: ReviewThread; number: number; showContext?: boolean }) {
  const { source, notify } = useRepo();
  const pull = useLoad(`${source.id}:pull:${number}`, () => source.pull(number)).data;
  const can = useCan();
  const suggestion = thread.comments.map((c) => suggestionOf(c.body)).find((x) => x != null) ?? null;
  const isPending = thread.comments.some((c) => c.pending);
  const canCommit = suggestion != null && !isPending && !thread.outdated && !thread.resolved && thread.side === 'RIGHT' && thread.line != null && !!pull && !pull.headDeleted && !pull.fromFork && (pull.state === 'open' || pull.state === 'draft') && can.push;
  const commitSuggestion = () => void act.run(async () => {
    const [text, sha] = await Promise.all([source.file(thread.path, pull!.head), source.fileSha(thread.path, pull!.head)]);
    if (text == null || !sha) throw new Error('that file isn’t on the branch any more.');
    const [from, to] = [thread.startLine ?? thread.line!, thread.line!];
    // A line number is only a position. If those lines aren't what was reviewed, writing here would overwrite something nobody looked at.
    const expected = reviewedLines(thread.hunk, to - from + 1);
    const actual = text.split('\n').slice(from - 1, to);
    if (!expected || expected.join('\n') !== actual.join('\n')) throw new Error(`line ${from === to ? to : `${from}–${to}`} has changed since this was suggested, so nothing was written. Look at the file and apply it by hand.`);
    await source.putFile({ path: thread.path, content: applyLines(text, from, to, suggestion!), message: `Apply suggestion to ${thread.path}`, branch: pull!.head, sha });
    await source.setThreadResolved(thread.id, number, true);
    notify('Suggestion committed');
  }, 'commit the suggestion');
  const [open, setOpen] = useState(!thread.resolved);
  const replyDraft = useDraft(`${source.id}:reply:${thread.id}`);
  const [replying, setReplying] = useState(replyDraft.dirty);
  const reply = replying ? replyDraft.value : null;
  const setReply = (v: string | null) => { setReplying(v != null); replyDraft.set(v ?? ''); };
  const act = useAction();
  const hunk = useMemo(() => thread.hunk.split('\n').slice(-5), [thread.hunk]);
  const sendReply = () => {
    if (!reply?.trim()) return;
    void act.run(async () => { await source.replyToThread(number, thread.comments[0].id, reply.trim()); replyDraft.clear(); setReplying(false); }, 'post your reply');
  };
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex min-h-9 flex-wrap items-center gap-2 border-b border-border bg-muted px-2 py-1 text-caption">
        <Button aria-expanded={open} aria-label={open ? 'Collapse thread' : 'Expand thread'} onPress={() => setOpen(!open)} className="grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:size-11"><Oct name={open ? 'chevDown' : 'chevRight'} size={14} /></Button>
        <span className="min-w-0 font-mono font-semibold break-all">{thread.path}{thread.line != null ? `:${thread.line}` : thread.originalLine != null ? `, was line ${thread.originalLine}` : ''}</span>
        {thread.outdated ? <span className="rounded-full border border-(--gh-attention) px-1.5 text-caption2 leading-4 text-(--gh-attention)">Outdated</span> : null}
        {thread.comments.some((c) => c.pending) ? <span className="rounded-full border border-(--gh-attention) px-1.5 text-caption2 leading-4 text-(--gh-attention)">Pending</span> : null}
        {thread.resolved ? <span className="text-muted-foreground">{thread.resolvedBy ? `${thread.resolvedBy} marked this as resolved` : 'Resolved'}</span> : null}
      </div>
      {open ? (
        <>
          {showContext && hunk.length && hunk[0] ? (
            <pre className="m-0 overflow-x-auto border-b border-border bg-muted px-3 py-1 font-mono text-caption2 leading-4 text-muted-foreground">{hunk.join('\n')}</pre>
          ) : null}
          <div className="space-y-2 p-2">
            {thread.comments.map((c) => (
              <CommentCard key={c.id} compact author={c.author} when={c.when} at={c.at} body={c.body} role={c.role} url={c.url} number={number} target={{ kind: 'reviewComment', id: c.id }} canEdit={c.canEdit} canDelete={c.canDelete} reactions={c.pending ? undefined : c.reactions ?? {}} />
            ))}
          </div>
          <div className="border-t border-border p-2">
            {reply != null ? (
              <>
                <MarkdownField label="Reply" value={reply} onChange={setReply} autoFocus rows={3} placeholder="Reply" onSubmit={sendReply} disabled={act.busy} />
                <div className="mt-2 flex justify-end gap-2">
                  <CancelButton dirty={replyDraft.dirty} onCancel={() => { replyDraft.clear(); setReplying(false); }} />
                  <Button className={ghButton(true)} isDisabled={act.busy || !reply.trim()} onPress={sendReply}>{act.busy ? 'Replying…' : 'Reply'}</Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {thread.canReply ? <Button className={cn(ghButton(), 'flex-1 justify-start text-muted-foreground')} onPress={() => setReply('')}>Reply…</Button> : null}
                {canCommit ? <Button className={ghButton(true)} isDisabled={act.busy} onPress={commitSuggestion}>Commit suggestion</Button> : null}
                {thread.resolved ? (thread.canUnresolve ? <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(() => source.setThreadResolved(thread.id, number, false))}>Unresolve conversation</Button> : null)
                  : thread.canResolve ? <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(() => source.setThreadResolved(thread.id, number, true))}>Resolve conversation</Button> : null}
              </div>
            )}
            <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ── Merge ── */

const METHOD = {
  merge: { label: 'Merge pull request', confirm: 'Confirm merge', option: 'Create a merge commit', hint: 'All commits from this branch will be added to the base branch via a merge commit.' },
  squash: { label: 'Squash and merge', confirm: 'Confirm squash and merge', option: 'Squash and merge', hint: 'The commits from this branch will be combined into one commit in the base branch.' },
  rebase: { label: 'Rebase and merge', confirm: 'Confirm rebase and merge', option: 'Rebase and merge', hint: 'The commits from this branch will be rebased and added to the base branch.' },
} as const;
type Method = keyof typeof METHOD;

function StatusRow({ ok, tone, title, text, children }: { ok: boolean; tone?: 'bad' | 'wait'; title: ReactNode; text: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', ok ? 'bg-(--gh-merge) text-white' : tone === 'bad' ? 'bg-(--gh-closed) text-white' : tone === 'wait' ? 'bg-(--gh-attention) text-white' : 'bg-muted text-muted-foreground')}>
        <Oct name={ok ? 'check' : tone === 'bad' ? 'x' : 'dotFill'} />
        <span className="sr-only">{ok ? 'Passing:' : 'Not passing:'}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-caption text-muted-foreground">{text}</div>
      </div>
      {children}
    </div>
  );
}

export function MergeBox({ pr, checks, threads }: { pr: PullDetail; checks: Check[]; threads: ReviewThread[] }) {
  const { source, repo, viewer, ui } = useRepo();
  const can = useCan();
  const nav = useNav();
  const methods = (['merge', 'squash', 'rebase'] as Method[]).filter((m) => repo.merge[m]);
  const [method, setMethod] = useState<Method>(methods[0] ?? 'merge');
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const act = useAction();
  const protection = useLoad(`${source.id}:protection:${pr.base}:${can.admin}`, () => (can.admin ? source.protection(pr.base) : null)).data;
  const approvals = pr.reviewers.filter((r) => r.state === 'approved').length;
  const requests = pr.reviewers.filter((r) => r.state === 'changes').length;
  const passed = checks.filter((c) => c.status === 'success').length;
  const failed = checks.filter((c) => c.status === 'failure').length;
  const running = checks.filter((c) => c.status === 'pending').length;
  const neutral = checks.filter((c) => c.status === 'neutral').length;
  const unresolved = threads.filter((t) => !t.resolved).length;
  const draft = pr.state === 'draft';
  const state = pr.mergeable;
  const open = (next: Method) => {
    setMethod(next);
    setConfirming(true);
    setTitle(next === 'merge' ? `Merge pull request #${pr.number} from ${pr.headLabel.replace(':', '/')}` : `${pr.title} (#${pr.number})`);
    setMessage(next === 'merge' ? pr.title : pr.body);
  };
  const merge = () => act.run(async () => {
    await source.merge(pr.number, { method, title: method === 'rebase' ? undefined : title, message: method === 'rebase' ? undefined : message, sha: pr.headSha });
    setConfirming(false);
  });
  /* Why it can't merge, in one sentence, or null. */
  const blocked: string | null = !can.push ? (repo.archived ? 'This repository is archived.' : `Only people with write access to ${source.full} can merge.`)
    : draft ? 'Draft pull requests can’t be merged.'
    : state === 'dirty' ? 'This branch has conflicts that must be resolved first.'
    : state === 'behind' ? 'This branch must be up to date before merging.'
    : state === 'blocked' ? (requests ? 'Reviewers asked for changes.' : protection?.reviews && approvals < protection.reviews ? `${protection.reviews} approving review${protection.reviews === 1 ? ' is' : 's are'} required.` : 'The base branch’s rules aren’t satisfied yet.')
    : state === 'unknown' || pr.canMerge === null ? 'GitHub is still checking whether this can merge.'
    : !methods.length ? 'This repository doesn’t allow any merge method.'
    : null;
  const mine = viewer?.login === pr.author.login;
  const canReady = can.push || mine;
  const checkTitle = failed ? 'Some checks were not successful' : running ? 'Some checks haven’t completed yet' : neutral && !passed ? 'Checks finished without a result' : 'All checks have passed';
  const checkText = [failed && `${failed} failing`, running && `${running} in progress`, neutral && `${neutral} skipped or neutral`, passed && `${passed} successful`].filter(Boolean).join(', ');
  const [showChecks, setShowChecks] = useState(failed > 0);
  return (
    <div className="relative flex gap-4 pt-4">
      {!ui.phone ? <span className="grid size-10 shrink-0 place-items-center rounded-md bg-(--gh-merge) text-white"><Oct name="pr" size={20} /></span> : null}
      <section aria-label="Merge status" className={cn('relative z-1 min-w-0 flex-1 overflow-hidden rounded-md border bg-background', blocked ? 'border-border' : 'border-(--gh-merge)/60')}>
        {draft ? (
          <StatusRow ok={false} title="This pull request is still a work in progress" text="Draft pull requests cannot be merged.">
            {canReady && can.participate ? <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(() => source.setDraft(pr.nodeId, pr.number, false))}>Ready for review</Button> : null}
          </StatusRow>
        ) : (
          <StatusRow ok={pr.review === 'approved'} tone={pr.review === 'changes' ? 'bad' : undefined}
            title={pr.review === 'approved' ? 'Changes approved' : pr.review === 'changes' ? 'Changes requested' : protection?.reviews || state === 'blocked' ? 'Review required' : 'No reviews yet'}
            text={pr.review === 'approved' ? `${approvals} approving review${approvals === 1 ? '' : 's'}.` : pr.review === 'changes' ? `${requests} reviewer${requests === 1 ? '' : 's'} asked for changes.` : protection?.reviews ? `${protection.reviews} approving review${protection.reviews === 1 ? ' is' : 's are'} required by reviewers with write access.` : state === 'blocked' ? 'The base branch’s rules ask for an approving review.' : 'Reviews aren’t required to merge into this branch.'}>
            {!draft && canReady && can.participate ? <Button className={cn(ghButton(), 'text-caption')} isDisabled={act.busy} onPress={() => void act.run(() => source.setDraft(pr.nodeId, pr.number, true))}>Convert to draft</Button> : null}
          </StatusRow>
        )}
        {unresolved ? <StatusRow ok={false} title={`${unresolved} unresolved conversation${unresolved === 1 ? '' : 's'}`} text="Review threads are still open on the changes." /> : null}
        {checks.length ? (
          <>
            <StatusRow ok={!failed && !running} tone={failed ? 'bad' : running ? 'wait' : undefined} title={checkTitle} text={checkText}>
              <Button aria-expanded={showChecks} className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setShowChecks(!showChecks)}>{showChecks ? 'Hide' : 'Show'} all checks</Button>
            </StatusRow>
            {showChecks ? <div className="border-b border-border bg-muted">{checks.map((c) => <CheckRow key={c.name} check={c} />)}</div> : null}
          </>
        ) : <StatusRow ok={false} title="No checks reported" text="Nothing has reported a status on this commit." />}
        {state === 'dirty' ? (
          <StatusRow ok={false} tone="bad" title="This branch has conflicts that must be resolved" text={<>Resolve them on the command line, or <a className="text-primary" href={pr.url ? `${pr.url}/conflicts` : undefined} target="_blank" rel="noreferrer">in GitHub’s web editor</a>.</>} />
        ) : state === 'behind' ? (
          <StatusRow ok={false} title="This branch is out-of-date with the base branch" text={`Merge the latest changes from ${pr.base} into this branch.`}>
            {can.push || pr.maintainerCanModify || mine ? <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(() => source.updateBranch(pr.number))}>{act.busy ? 'Updating…' : 'Update branch'}</Button> : null}
          </StatusRow>
        ) : state === 'unknown' || pr.canMerge === null ? (
          <StatusRow ok={false} tone="wait" title="Checking for the ability to merge automatically…" text="Hang tight while GitHub works it out." />
        ) : (
          <StatusRow ok title="No conflicts with base branch" text={blocked ? blocked : 'Merging can be performed automatically.'}>
            {repo.merge.updateBranch && can.push && !draft ? <Button className={cn(ghButton(), 'text-caption')} isDisabled={act.busy} onPress={() => void act.run(() => source.updateBranch(pr.number))}>Update branch</Button> : null}
          </StatusRow>
        )}
        <div className="bg-background px-4 py-3">
          {confirming ? (
            <div className="grid gap-2">
              {method !== 'rebase' ? (
                <>
                  <label className="grid gap-1 font-semibold">Commit message
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" />
                  </label>
                  <label className="grid gap-1 font-semibold">Extended description
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="box-border w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 font-sans text-detail font-normal text-foreground outline-none select-text focus:border-primary" />
                  </label>
                </>
              ) : <p className="m-0 text-muted-foreground">{METHOD.rebase.hint}</p>}
              <ActionError error={act.error} onDismiss={act.clear} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button className={ghButton()} isDisabled={act.busy} onPress={() => setConfirming(false)}>Cancel</Button>
                <Button className={ghButton(true)} isDisabled={act.busy} onPress={() => void merge()}>{act.busy ? 'Merging…' : METHOD[method].confirm}</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex">
                <Button className={cn(ghButton(!blocked), 'rounded-r-none')} isDisabled={!!blocked} onPress={() => open(method)}>{METHOD[method].label}</Button>
                <Menu label="Merge options" isDisabled={!can.push || methods.length < 2} triggerClassName={cn(ghButton(!blocked), 'rounded-l-none border-l-white/30 px-2')} trigger={<Oct name="chevDown" size={12} />} placement="top end"
                  entries={methods.map((m) => ({ id: m, label: METHOD[m].option, hint: METHOD[m].hint, selected: m === method, onAction: () => setMethod(m) }))} />
              </div>
              {repo.merge.auto && can.push && state !== 'dirty' && state !== 'behind' && (state === 'blocked' || running > 0) && !pr.autoMerge && !draft ? (
                <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(() => source.setAutoMerge(pr.nodeId, pr.number, method))}>Enable auto-merge</Button>
              ) : null}
              {pr.autoMerge ? (
                <span className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                  <Oct name="merged" size={14} />Auto-merge enabled by {pr.autoMerge.by.login} ({pr.autoMerge.method})
                  {can.push ? <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} isDisabled={act.busy} onPress={() => void act.run(() => source.setAutoMerge(pr.nodeId, pr.number, null))}>Disable</Button> : null}
                </span>
              ) : null}
              <span className="min-w-0 flex-1 text-caption text-muted-foreground" role={blocked ? 'status' : undefined}>
                {blocked ?? 'You can also merge this with the command line.'}
              </span>
              <ActionError error={act.error} onDismiss={act.clear} className="w-full" />
            </div>
          )}
        </div>
        <span className="hidden">{nav.url({ s: 'pull', n: pr.number })}</span>
      </section>
    </div>
  );
}

/** After the merge or close: what happened, and the branch housekeeping. */
function MergedBox({ pr }: { pr: PullDetail }) {
  const { source, ui, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const act = useAction();
  const merged = pr.state === 'merged';
  const sameRepo = !pr.fromFork;
  return (
    <div className="relative flex gap-4 pt-4">
      {!ui.phone ? <span className={cn('grid size-10 shrink-0 place-items-center rounded-md text-white', merged ? 'bg-(--gh-done)' : 'bg-(--gh-closed)')}><Oct name={merged ? 'merged' : 'prClosed'} size={20} /></span> : null}
      <section aria-label="Merge status" className={cn('relative z-1 min-w-0 flex-1 rounded-md border bg-background px-4 py-3', merged ? 'border-(--gh-done)/50' : 'border-(--gh-closed)/50')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{merged ? 'Pull request successfully merged and closed' : 'Closed with unmerged commits'}</div>
            <div className="text-caption text-muted-foreground">
              {merged ? <>Merged by {pr.mergedBy?.login ?? 'someone'}{pr.mergeSha ? <> as <GhLink to={{ s: 'commit', sha: pr.mergeSha }} className="font-mono text-primary no-underline hover:underline">{pr.mergeSha.slice(0, 7)}</GhLink></> : null}. </> : null}
              {pr.headDeleted ? 'The head branch is gone.' : <>The <b className="font-semibold">{pr.head}</b> branch can be safely deleted{merged ? '.' : ' once you don’t need it.'}</>}
            </div>
          </div>
          {merged && can.push ? (
            <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(async () => { nav.go({ s: 'pull', n: await source.revert(pr.nodeId, pr.number, `Revert "${pr.title}"`) }); }, 'open the revert pull request')}><Oct name="history" />Revert</Button>
          ) : null}
          {!pr.headDeleted && sameRepo && can.push ? (
            <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteBranch(pr.head); notify(`Branch ${pr.head} deleted`); })}><Oct name="trash" />Delete branch</Button>
          ) : null}
          {pr.headDeleted && sameRepo && can.push && (pr.headSha) ? (
            <Button className={ghButton()} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.createBranchAt(pr.head, pr.headSha); notify(`Branch ${pr.head} restored`); })}>Restore branch</Button>
          ) : null}
        </div>
        <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
      </section>
    </div>
  );
}

/* ── Commits / Checks / Files changed ── */

const CHECK_GLYPH: Record<Check['status'], [ReactNode, string]> = {
  success: [<Oct key="s" name="checkFill" className="text-(--gh-open)" />, 'Successful'],
  failure: [<Oct key="f" name="xFill" className="text-(--gh-closed)" />, 'Failing'],
  pending: [<Oct key="p" name="dotFill" className="text-(--gh-attention)" />, 'In progress'],
  neutral: [<Oct key="n" name="stopFill" className="text-muted-foreground" />, 'Skipped or neutral'],
};

export function CheckRow({ check: c }: { check: Check }) {
  const nav = useNav();
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2 text-caption first:border-t-0 sm:pl-[60px]">
      {CHECK_GLYPH[c.status][0]}<span className="sr-only">{CHECK_GLYPH[c.status][1]}:</span>
      <b className="min-w-0 truncate font-semibold">{c.name}</b>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.summary ?? (c.status === 'success' && c.time ? `Successful in ${c.time}` : c.time)}</span>
      {c.runId ? <GhLink to={{ s: 'run', id: c.runId }} className="shrink-0 text-primary no-underline hover:underline">Details</GhLink>
        : c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="shrink-0 text-primary no-underline hover:underline" onClick={(e) => { if (nav.isInternal(c.url!)) { e.preventDefault(); nav.open(c.url!); } }}>Details</a> : null}
    </div>
  );
}

export function PullCommits({ number }: { number: number }) {
  const { source, ui } = useRepo();
  const copy = useCopy();
  const commits = useLoad(`${source.id}:commits:${number}`, () => source.pullCommits(number));
  return (
    <div className={cn('relative', !ui.phone && 'pl-8')}>
      <Loaded load={commits}>
        {(list) => (
          <Box>
            {list.map((c) => (
              <div key={c.fullSha} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 hover:bg-muted">
                <div className="min-w-0 flex-1">
                  <GhLink to={{ s: 'pull', n: number, tab: 'files', commit: c.fullSha }} className="block truncate font-semibold text-foreground no-underline hover:text-primary hover:underline">{c.message}</GhLink>
                  <div className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                    <Avatar c={c.author} src={c.author.avatar} size={16} /><UserLink user={c.author} className="font-semibold text-foreground" /> committed {c.when}
                  </div>
                </div>
                <GhLink to={{ s: 'commit', sha: c.fullSha }} className={cn(ghButton(), 'h-7 px-2 font-mono text-caption no-underline')}>{c.sha}</GhLink>
                <Button aria-label={`Copy full SHA ${c.sha}`} className={cn(ghButton(), 'h-7 w-7 px-0')} onPress={() => void copy(c.fullSha, 'SHA copied')}><Oct name="copy" size={14} /></Button>
              </div>
            ))}
            {!list.length ? <div className="px-4 py-8 text-center text-muted-foreground">No commits.</div> : null}
          </Box>
        )}
      </Loaded>
    </div>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  const failed = checks.filter((c) => c.status === 'failure').length;
  const running = checks.filter((c) => c.status === 'pending').length;
  const passed = checks.filter((c) => c.status === 'success').length;
  const head = !checks.length ? <b className="font-semibold">No checks reported</b>
    : failed ? <><Oct name="xFill" className="text-(--gh-closed)" /><b className="font-semibold">Some checks were not successful</b><span className="text-muted-foreground">· {failed} failing</span></>
    : running ? <><Oct name="dotFill" className="text-(--gh-attention)" /><b className="font-semibold">Some checks haven’t completed yet</b><span className="text-muted-foreground">· {running} in progress</span></>
    : <><Oct name="checkFill" className="text-(--gh-open)" /><b className="font-semibold">All checks have passed</b><span className="text-muted-foreground">· {passed} successful</span></>;
  return (
    <Box header={head}>
      {checks.map((c) => <CheckRow key={c.name} check={c} />)}
    </Box>
  );
}

export function FilesChanged({ pr, commit }: { pr: PullDetail; commit?: string }) {
  const { source, viewer } = useRepo();
  const can = useCan();
  const nav = useNav();
  const n = pr.number;
  const files = useLoad(`${source.id}:files:${n}`, () => source.pullFiles(n));
  const commits = useLoad(`${source.id}:commits:${n}`, () => source.pullCommits(n)).data ?? [];
  const one = useLoad(`${source.id}:commit:${commit ?? ''}`, () => (commit ? source.commit(commit) : null));
  const threads = useLoad(`${source.id}:threads:${n}`, () => source.pullThreads(n));
  const extras = useLoad(`${source.id}:pull-extras:${n}`, () => source.pullExtras(n)).data;
  const [localViewed, setLocalViewed] = useState<Record<string, boolean>>({});
  const viewedSet = useMemo(() => {
    const s = new Set(extras?.viewed ?? []);
    for (const [p, v] of Object.entries(localViewed)) { if (v) s.add(p); else s.delete(p); }
    return s;
  }, [extras, localViewed]);
  const act = useAction();
  const pending = threads.data?.pending ?? null;
  const open = pr.state === 'open' || pr.state === 'draft';
  const review: DiffReview | undefined = commit ? undefined : {
    threads: threads.data?.threads ?? [],
    pending: !!pending,
    canComment: can.participate && !pr.locked,
    addComment: (c, mode) => (mode === 'single' ? source.addReviewComment(n, c, pr.headSha) : source.addPendingComment(n, c, pr.headSha)),
    renderThread: (t) => <ThreadCard thread={t} number={n} />,
  };
  const toolbar = (
    <SelectMenu title="Filter by commit" triggerLabel="Filter changed files by commit" trigger={<>{commit ? commits.find((c) => c.fullSha === commit)?.sha ?? commit.slice(0, 7) : 'All commits'}<Oct name="chevDown" size={12} /></>} filterPlaceholder="Filter commits" clearLabel="All commits"
      items={commits.map((c) => ({ id: c.fullSha, label: c.message, description: `${c.sha} · ${c.author.login} · ${c.when}` }))} selected={commit ? [commit] : []}
      onApply={(ids) => nav.go({ s: 'pull', n, tab: 'files', commit: ids[0] }, { replace: true })} />
  );
  return (
    <>
      {!commit && viewer ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {pending ? <span className="text-caption text-(--gh-attention)" role="status">{pending.count} comment{pending.count === 1 ? '' : 's'} pending in your review</span> : null}
          <ReviewMenu pr={pr} pending={pending} disabled={!open || !can.participate} />
        </div>
      ) : null}
      {commit ? (
        <Loaded load={one}>{(c) => (c ? <DiffFiles files={c.files} toolbar={toolbar} browseRef={c.fullSha} /> : null)}</Loaded>
      ) : (
        <Loaded load={files}>
          {(list) => (
            <DiffFiles files={list} toolbar={toolbar} review={review} browseRef={pr.headDeleted ? pr.base : pr.head} viewedSet={viewedSet}
              onViewed={viewer ? (path, v) => {
                setLocalViewed((m) => ({ ...m, [path]: v }));
                void act.run(async () => { await source.setFileViewed(pr.nodeId, n, path, v); return true; }, 'mark that file').then((ok) => {
                  // It didn't save, so it isn't viewed.
                  if (!ok) setLocalViewed((m) => ({ ...m, [path]: !v }));
                });
              } : undefined} />
          )}
        </Loaded>
      )}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </>
  );
}

/** "Review changes": a summary, a verdict, and whatever's pending. You can't approve or reject your own pull request. */
function ReviewMenu({ pr, pending, disabled }: { pr: PullDetail; pending: { id: number; count: number } | null; disabled: boolean }) {
  const { source, viewer } = useRepo();
  const [open, setOpen] = useState(false);
  const draft = useDraft(`${source.id}:review:${pr.number}`);
  const body = draft.value;
  const setBody = draft.set;
  const [event, setEvent] = useState<ReviewEvent>('COMMENT');
  const act = useAction();
  const mine = viewer?.login === pr.author.login;
  const submit = () => {
    if (event === 'REQUEST_CHANGES' && !body.trim() && !pending) return;
    void act.run(async () => { await source.submitReview(pr.number, { event, body, pendingId: pending?.id, headSha: pr.headSha }); setOpen(false); draft.clear(); setEvent('COMMENT'); }, 'submit your review');
  };
  const needsText = (event === 'COMMENT' || event === 'REQUEST_CHANGES') && !body.trim() && !pending;
  const option = (id: ReviewEvent, title: string, hint: string, off?: boolean) => (
    <label className={cn('flex cursor-pointer items-start gap-2 py-1', off && 'cursor-not-allowed opacity-55')}>
      <input type="radio" name="review-event" className="mt-1" checked={event === id} disabled={off} onChange={() => setEvent(id)} />
      <span><b className="font-semibold">{title}</b><span className="block text-caption text-muted-foreground">{hint}</span></span>
    </label>
  );
  return (
    <div className="w-full sm:w-auto">
      <div className="flex justify-end">
        <Button className={ghButton(true)} isDisabled={disabled} aria-expanded={open} onPress={() => setOpen(!open)}>{pending ? `Finish your review (${pending.count})` : 'Review changes'}<Oct name="chevDown" size={12} /></Button>
      </div>
      {open ? (
        <div className="mt-2 rounded-md border border-border bg-background p-3 sm:w-[480px]">
          <h2 className="mt-0 mb-2 text-detail font-semibold">Finish your review</h2>
          <MarkdownField label="Review summary" value={body} onChange={setBody} autoFocus rows={4} placeholder="Leave a comment" onSubmit={submit} disabled={act.busy} />
          <div className="mt-2 grid gap-1">
            {option('COMMENT', 'Comment', 'Submit general feedback without explicit approval.')}
            {option('APPROVE', 'Approve', mine ? 'You can’t approve your own pull request.' : 'Submit feedback and approve merging these changes.', mine)}
            {option('REQUEST_CHANGES', 'Request changes', mine ? 'You can’t request changes on your own pull request.' : 'Submit feedback that must be addressed before merging.', mine)}
          </div>
          <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {pending ? <Button className={cn(ghButton(), 'mr-auto border-(--gh-closed) text-foreground')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.discardReview(pr.number, pending.id); setOpen(false); })}>Discard review</Button> : null}
            <Button className={ghButton()} onPress={() => setOpen(false)}>Close</Button>
            <Button className={ghButton(true)} isDisabled={act.busy || needsText} onPress={submit}>{act.busy ? 'Submitting…' : 'Submit review'}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
