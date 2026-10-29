/* A pull request: title and state, then Conversation (timeline, merge box, comment composer), Commits, Checks and
   Files changed. The conversation (Thread) is shared with issues: its description, comments, commits, labels, review
   requests, reviews and state changes, then the composer. With live data the composer posts a real comment
   (POST /issues/{n}/comments) and the posted comment says so, with a link to it on GitHub; with the sample it stays
   on the page. Merging isn't done here: live, the merge button opens the pull request on GitHub. */
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText } from '@/components/ui/composer/composer';
import { MarkdownView } from '@/components/ui/markdown-view';
import { Progress } from '@/components/ui/progress';
import { TabView, TabViewBar, TabViewFooter, TabViewList, TabViewPanels } from '@/components/ui/tab-view';
import { cn } from '@/lib/utils';
import type { Check, FileNode, PullDetail, TimelineItem, User } from './data';
import { AvatarStack, Box, DiffStat, DiffView, FileTree, FlowPanel, LabelChip, Oct, StatePill, UnderlineTab, ghButton, githubMarkdown, Branch, PR_STATE, type OctName, type Layout, type Nav } from './parts';
import { Loaded, useLoad, useRepo } from './repo-context';

export type PullRequestTab = 'conversation' | 'commits' | 'checks' | 'files';

const openOnGitHub = (url?: string) => (url ? () => window.open(url, '_blank', 'noopener') : undefined);

export function PullRequestView({ ui, number, nav, initialTab = 'conversation' }: { ui: Layout; number: number; nav: Nav; initialTab?: PullRequestTab }) {
  const { source } = useRepo();
  const pull = useLoad(`${source.id}:pull:${number}`, () => source.pull(number));
  const checks = useLoad(`${source.id}:checks:${number}`, () => source.pullChecks(number));
  const [sub, setSub] = useState<string>(initialTab);
  return (
    <div className={cn(ui.phone && 'px-4 py-4')}>
      {!ui.phone ? (
        <button type="button" onClick={() => nav.openPr(null)} className="mb-3 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-detail text-primary hover:underline">
          <Oct name="chevLeft" size={14} />Pull requests
        </button>
      ) : null}
      <Loaded load={pull}>
        {(p) => (
          <>
            <div className="flex items-start gap-4">
              <h1 className={cn('m-0 min-w-0 flex-1 leading-tight font-normal', ui.phone ? 'text-[22px]' : 'text-[32px]')}>
                {p.title} <span className="font-light text-muted-foreground">#{p.number}</span>
              </h1>
              {!ui.phone ? (
                <div className="flex shrink-0 gap-2 pt-1.5">
                  <Button className={ghButton()} onPress={openOnGitHub(p.url)}>{p.url ? <>Open on GitHub<Oct name="external" size={12} /></> : 'Edit'}</Button>
                  <Button className={ghButton(true)} onPress={nav.clone}><Oct name="code" />Code<Oct name="chevDown" size={12} /></Button>
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border pb-4 text-muted-foreground">
              <StatePill state={PR_STATE[p.state]} />
              <span className="leading-6">
                <b className="font-semibold text-foreground">{p.author.login}</b> {p.state === 'merged' ? 'merged' : 'wants to merge'} {p.commits} commit{p.commits === 1 ? '' : 's'} into <Branch>{p.base}</Branch> from <Branch>{p.head}</Branch>
              </span>
            </div>
            <TabView placement="top" selectedKey={sub} onSelectionChange={(k) => setSub(String(k))} className="mt-2">
              <TabViewBar variant="plain" className="overflow-x-auto border-b border-border [scrollbar-width:none]">
                <TabViewList aria-label="Pull request" className="flex gap-1">
                  <UnderlineTab id="conversation" icon="comment" label="Conversation" count={p.comments} />
                  <UnderlineTab id="commits" icon="commit" label="Commits" count={p.commits} />
                  <UnderlineTab id="checks" icon="checkFill" label="Checks" count={checks.data?.length} />
                  <UnderlineTab id="files" icon="file" label="Files changed" count={p.changedFiles} />
                </TabViewList>
                {!ui.phone ? <TabViewFooter className="pl-4"><DiffStat add={p.additions} del={p.deletions} /></TabViewFooter> : null}
              </TabViewBar>
              <TabViewPanels className="pt-6">
                <FlowPanel id="conversation"><Conversation ui={ui} pr={p} checks={checks.data ?? []} /></FlowPanel>
                <FlowPanel id="commits"><CommitList ui={ui} number={p.number} /></FlowPanel>
                <FlowPanel id="checks"><Loaded load={checks}>{(c) => <Checks checks={c} />}</Loaded></FlowPanel>
                <FlowPanel id="files"><FilesChanged ui={ui} number={p.number} /></FlowPanel>
              </TabViewPanels>
            </TabView>
          </>
        )}
      </Loaded>
    </div>
  );
}

/* ── Conversation ── */

const REVIEWER_ICON: Record<PullDetail['reviewers'][number]['state'], ReactNode> = {
  approved: <Oct name="check" className="text-[var(--gh-open)]" />,
  changes: <Oct name="x" className="text-[var(--gh-closed)]" />,
  commented: <Oct name="comment" className="text-muted-foreground" />,
  pending: <span className="mx-1 size-2 rounded-full bg-[var(--gh-attention)]" />,
};

export function Conversation({ ui, pr, checks }: { ui: Layout; pr: PullDetail; checks: Check[] }) {
  const side = 'border-b border-border py-4 text-caption first:pt-0';
  const sideTitle = 'mb-2 flex items-center justify-between font-semibold text-muted-foreground';
  const { source } = useRepo();
  const participants = participantsOf(useLoad(`${source.id}:timeline:${pr.number}`, () => source.timeline(pr.number)).data ?? []);
  return (
    <div className="flex gap-6">
      <Thread ui={ui} number={pr.number} authorLogin={pr.author.login}
        footer={pr.state === 'merged' || pr.state === 'closed' ? null : <MergeBox ui={ui} pr={pr} checks={checks} />}
        closeLabel={pr.state === 'open' || pr.state === 'draft' ? <><Oct name="prClosed" className="text-[var(--gh-closed)]" />Close pull request</> : null} />
      {ui.wide ? (
        <aside className="w-[256px] shrink-0">
          <div className={side}>
            <div className={sideTitle}>Reviewers<Oct name="gear" size={14} /></div>
            {pr.reviewers.length ? pr.reviewers.map((r) => (
              <div key={r.user.login} className="mb-1.5 flex items-center gap-2"><Avatar c={r.user} src={r.user.avatar} size={20} /><b className="flex-1 font-semibold">{r.user.login}</b>{REVIEWER_ICON[r.state]}</div>
            )) : <span className="text-muted-foreground">No reviews</span>}
          </div>
          <div className={side}>
            <div className={sideTitle}>Assignees<Oct name="gear" size={14} /></div>
            {pr.assignees.length ? pr.assignees.map((u) => (
              <div key={u.login} className="mb-1.5 flex items-center gap-2"><Avatar c={u} src={u.avatar} size={20} /><b className="font-semibold">{u.login}</b></div>
            )) : <span className="text-muted-foreground">No one assigned</span>}
          </div>
          <div className={side}>
            <div className={sideTitle}>Labels<Oct name="gear" size={14} /></div>
            {pr.labels.length ? <div className="flex flex-wrap gap-1">{pr.labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}</div> : <span className="text-muted-foreground">None yet</span>}
          </div>
          <div className={side}>
            <div className={sideTitle}>Milestone<Oct name="gear" size={14} /></div>
            {pr.milestone ? (
              <>
                <Progress aria-label={`${pr.milestone.title} progress`} value={pr.milestone.pct} size="sm" tone="success" />
                <b className="mt-1.5 block font-semibold">{pr.milestone.title}</b>
              </>
            ) : <span className="text-muted-foreground">No milestone</span>}
          </div>
          {pr.closes.length ? (
            <div className={side}>
              <div className={sideTitle}>Development</div>
              <p className="m-0 text-muted-foreground">Successfully merging this pull request may close these issues.</p>
              {pr.closes.map((t) => <p key={t} className="mt-2 mb-0 flex items-center gap-1.5"><Oct name="issue" size={14} className="text-[var(--gh-open)]" /><b className="font-semibold">{t}</b></p>)}
            </div>
          ) : null}
          {participants.length ? (
            <div className={side}>
              <div className={sideTitle}>Participants</div>
              <AvatarStack users={participants} size={26} />
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

/** Who spoke in a conversation (comments and reviews), first appearance first. */
export function participantsOf(items: TimelineItem[]): User[] {
  const seen = new Map<string, User>();
  for (const it of items) if ((it.kind === 'comment' || it.kind === 'review') && !seen.has(it.author.login)) seen.set(it.author.login, it.author);
  return [...seen.values()];
}

/** An issue's or pull request's conversation and the comment composer. */
export function Thread({ ui, number, authorLogin, footer, closeLabel }: {
  ui: Layout; number: number; authorLogin: string; footer?: ReactNode; closeLabel?: ReactNode;
}) {
  const { source, viewer } = useRepo();
  const timeline = useLoad(`${source.id}:timeline:${number}`, () => source.timeline(number));
  const [posted, setPosted] = useState<TimelineItem[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = [...(timeline.data ?? []), ...posted];

  const send = (body: string) => {
    if (sending || !body.trim()) return;
    setSending(true);
    setError(null);
    source.comment(number, body).then(
      (item) => setPosted((xs) => [...xs, item]),
      (e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setDraft(body); },
    ).finally(() => setSending(false));
  };
  return (
    <div className="min-w-0 flex-1">
      <Loaded load={timeline}>
        {() => (
          /* The timeline rail runs behind the event badges. */
          <div className={cn('relative', ui.phone ? 'before:left-4' : 'before:left-[72px]', 'before:absolute before:inset-y-0 before:w-0.5 before:bg-border')}>
            {items.map((it) => (
              <div key={it.id}>
                <TimelineEntry ui={ui} item={it} authorLogin={authorLogin} />
                {posted.includes(it) ? <PostedNote ui={ui} url={it.kind === 'comment' ? it.url : undefined} where={`${source.full}#${number}`} /> : null}
              </div>
            ))}
          </div>
        )}
      </Loaded>
      {footer}
      <div className="mt-6 flex gap-4 border-t-2 border-border pt-6">
        {!ui.phone && viewer ? <Avatar c={viewer} src={viewer.avatar} size={40} /> : null}
        <div className="min-w-0 flex-1">
          <h3 className="mt-0 mb-2 text-detail font-semibold">Add a comment</h3>
          <Composer onSubmit={send} value={draft} onValueChange={setDraft}>
            <ComposerCard className="rounded-md shadow-none">
              <ComposerInput placeholder="Use Markdown to format your comment" slashMenu={false} />
              <ComposerFooter>
                <ComposerText>
                  {sending ? <>Posting to GitHub…</> : <><Oct name="book" size={14} />Markdown is supported{source.live ? ` · posts to ${source.full} as ${viewer?.login ?? 'you'}` : ''}</>}
                </ComposerText>
                <ComposerSpacer />
                <ComposerSend />
              </ComposerFooter>
            </ComposerCard>
          </Composer>
          {error ? <p role="alert" className="mt-2 mb-0 text-caption text-[var(--gh-closed)]">Couldn’t post the comment: {error} Your text is back in the box.</p> : null}
          {closeLabel ? (
            <div className="mt-3 flex justify-end gap-2">
              <Button className={ghButton()}>{closeLabel}</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Under a comment this page posted: where it went. */
function PostedNote({ ui, url, where }: { ui: Layout; url?: string; where: string }) {
  return (
    <div className={cn('-mt-2 mb-2 flex items-center gap-1.5 text-caption text-muted-foreground', ui.phone ? 'pl-0' : 'pl-14')}>
      <Oct name="check" size={14} className="text-[var(--gh-open)]" />
      {url ? (
        <>Posted to {where} on GitHub · <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View on GitHub</a></>
      ) : <>Added on this page only — the sample repository isn’t on GitHub.</>}
    </div>
  );
}

export function CommentCard({ ui, author, when, body, role, verb = 'commented', tone, url }: {
  ui: Layout; author: User; when: string; body: string; role?: string; verb?: string; tone?: 'author'; url?: string;
}) {
  return (
    <div className="relative flex gap-4 py-4">
      {!ui.phone ? <Avatar c={author} src={author.avatar} size={40} /> : null}
      <div className={cn('relative z-1 min-w-0 flex-1 overflow-hidden rounded-md border bg-background', tone === 'author' ? 'border-primary/40' : 'border-border')}>
        <div className={cn('flex items-center gap-1.5 border-b px-4 py-2 text-muted-foreground', tone === 'author' ? 'border-primary/40 bg-primary/8' : 'border-border bg-muted')}>
          {ui.phone ? <Avatar c={author} src={author.avatar} size={20} /> : null}
          <b className="shrink-0 font-semibold whitespace-nowrap text-foreground">{author.login}</b>
          <span className="min-w-0 truncate">{verb} {url ? <a href={url} target="_blank" rel="noreferrer" className="text-inherit no-underline hover:underline">{when}</a> : when}</span>
          <span className="flex-1" />
          {role && !ui.phone ? <span className="rounded-full border border-border px-2 text-caption leading-[18px] font-medium">{role}</span> : null}
          <Oct name="kebab" className="shrink-0" />
        </div>
        <MarkdownView markdown={body} className={cn(githubMarkdown, 'bg-background px-4 py-3 text-detail leading-[1.5]')} />
      </div>
    </div>
  );
}

export function TimelineEvent({ ui, icon, badge, children }: { ui: Layout; icon: OctName; badge?: string; children: ReactNode }) {
  return (
    <div className={cn('relative flex items-start gap-2 py-3', ui.phone ? 'pl-0' : 'pl-14')}>
      <span className={cn('z-1 grid size-8 shrink-0 place-items-center rounded-full border-2 border-background', badge ?? 'bg-muted text-muted-foreground')}>
        <Oct name={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1 pt-1.5 text-muted-foreground">{children}</div>
    </div>
  );
}

/** closed / reopened / merged / … : icon, badge, and what the actor did. */
const EVENTS: Record<string, { icon: OctName; badge?: string; text: (detail?: string) => ReactNode }> = {
  closed: { icon: 'issueClosed', badge: 'bg-(--gh-done) text-white', text: () => 'closed this' },
  reopened: { icon: 'issue', badge: 'bg-(--gh-merge) text-white', text: () => 'reopened this' },
  merged: { icon: 'merged', badge: 'bg-(--gh-done) text-white', text: () => 'merged this' },
  head_ref_deleted: { icon: 'branch', text: () => 'deleted the head branch' },
  ready_for_review: { icon: 'eye', text: () => 'marked this pull request as ready for review' },
  convert_to_draft: { icon: 'prDraft', text: () => 'marked this pull request as draft' },
  renamed: { icon: 'comment', text: (t) => <>changed the title to <b className="font-semibold text-foreground">{t}</b></> },
  assigned: { icon: 'people', text: (t) => <>assigned <b className="font-semibold text-foreground">{t}</b></> },
};

export function TimelineEntry({ ui, item, authorLogin }: { ui: Layout; item: TimelineItem; authorLogin?: string }) {
  const who = (u: User) => (
    <><Avatar c={u} src={u.avatar} size={20} className="mr-1.5 inline-grid align-[-5px]" /><b className="font-semibold text-foreground">{u.login}</b></>
  );
  switch (item.kind) {
    case 'comment':
      return <CommentCard ui={ui} author={item.author} when={item.when} body={item.body} role={item.role} url={item.url} tone={item.author.login === authorLogin ? 'author' : undefined} />;
    case 'commits':
      return (
        <TimelineEvent ui={ui} icon="commit">
          {who(item.author)} added {item.commits.length} commit{item.commits.length === 1 ? '' : 's'} {item.when}
          <ul className="mt-2 mb-0 list-none space-y-1.5 p-0">
            {item.commits.map((c) => (
              <li key={c.sha} className="flex items-center gap-2">
                <Avatar c={c.author} src={c.author.avatar} size={16} />
                <span className="min-w-0 flex-1 truncate text-foreground">{c.message}</span>
                <Oct name="check" size={14} className="shrink-0 text-[var(--gh-open)]" />
                <code className="shrink-0 font-mono text-caption">{c.sha}</code>
              </li>
            ))}
          </ul>
        </TimelineEvent>
      );
    case 'labeled':
      return (
        <TimelineEvent ui={ui} icon="tag">
          {who(item.author)} added {item.labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} className="mx-0.5 align-[1px]" />)} label{item.labels.length === 1 ? '' : 's'} {item.when}
        </TimelineEvent>
      );
    case 'requested':
      return <TimelineEvent ui={ui} icon="eye">{who(item.author)} requested a review from <b className="font-semibold text-foreground">{item.reviewer.login}</b> {item.when}</TimelineEvent>;
    case 'review':
      return (
        <>
          <TimelineEvent ui={ui} icon={item.state === 'approved' ? 'check' : item.state === 'changes' ? 'x' : 'eye'}
            badge={item.state === 'approved' ? 'bg-(--gh-merge) text-white' : item.state === 'changes' ? 'bg-(--gh-closed) text-white' : undefined}>
            {who(item.author)} {item.state === 'approved' ? 'approved these changes' : item.state === 'changes' ? 'requested changes' : 'reviewed'} {item.when}
          </TimelineEvent>
          {item.body ? <CommentCard ui={ui} author={item.author} when={item.when} body={item.body} verb="left a comment" role="Member" /> : null}
        </>
      );
    case 'event': {
      const e = EVENTS[item.event];
      if (!e) return null;
      return <TimelineEvent ui={ui} icon={e.icon} badge={e.badge}>{who(item.author)} {e.text(item.text)} {item.when}</TimelineEvent>;
    }
  }
}

const REVIEW_ROW: Record<NonNullable<PullDetail['review']>, [boolean, string, string]> = {
  approved: [true, 'Changes approved', 'approving review by reviewers with write access.'],
  changes: [false, 'Changes requested', 'Reviewers asked for changes before this can merge.'],
  pending: [false, 'Review required', 'At least one approving review may be required by reviewers with write access.'],
  draft: [false, 'This pull request is still a work in progress', 'Draft pull requests cannot be merged.'],
};

const MERGEABLE: Record<string, [boolean, string, string]> = {
  clean: [true, 'No conflicts with base branch', 'Merging can be performed automatically.'],
  unstable: [true, 'No conflicts with base branch', 'Merging can be performed automatically.'],
  has_hooks: [true, 'No conflicts with base branch', 'Merging can be performed automatically.'],
  dirty: [false, 'This branch has conflicts that must be resolved', 'Resolve conflicts on GitHub or the command line.'],
  behind: [false, 'This branch is out-of-date with the base branch', 'Merge the latest changes from the base branch into this branch.'],
  blocked: [false, 'Merging is blocked', 'The base branch’s rules aren’t satisfied yet.'],
  draft: [false, 'This branch is a draft', 'Mark it ready for review to merge.'],
};

export function MergeBox({ ui, pr, checks }: { ui: Layout; pr: PullDetail; checks: Check[] }) {
  const { source } = useRepo();
  const row = (ok: boolean, title: string, text: string) => (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3">
      {ok ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-(--gh-merge) text-white"><Oct name="check" /></span>
        : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Oct name="dotFill" /></span>}
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-caption text-muted-foreground">{text}</div>
      </div>
    </div>
  );
  const approvals = pr.reviewers.filter((r) => r.state === 'approved').length;
  const [reviewOk, reviewTitle, reviewText] = REVIEW_ROW[pr.review ?? 'pending'];
  const passed = checks.filter((c) => c.status === 'success').length;
  const failed = checks.filter((c) => c.status === 'failure').length;
  const running = checks.filter((c) => c.status === 'pending').length;
  const [checksTitle, checksText] = failed ? ['Some checks were not successful', `${failed} failing and ${passed} successful checks`]
    : running ? ['Some checks haven’t completed yet', `${running} in progress and ${passed} successful checks`]
    : ['All checks have passed', `${passed} successful check${passed === 1 ? '' : 's'}`];
  const [mergeOk, mergeTitle, mergeText] = MERGEABLE[pr.mergeable] ?? [false, 'Checking for the ability to merge automatically…', 'Hang tight while GitHub checks.'];
  return (
    <div className="relative flex gap-4 pt-4">
      {!ui.phone ? <span className="grid size-10 shrink-0 place-items-center rounded-md bg-(--gh-merge) text-white"><Oct name="pr" size={20} /></span> : null}
      <div className="relative z-1 min-w-0 flex-1 overflow-hidden rounded-md border border-(--gh-merge)/60 bg-background">
        {row(reviewOk, reviewTitle, pr.review === 'approved' ? `${approvals} ${reviewText}` : reviewText)}
        {checks.length ? (
          <>
            {row(!failed && !running, checksTitle, checksText)}
            <div className="border-b border-border bg-muted">
              {checks.map((c) => (
                <div key={c.name} className="flex items-center gap-2 px-4 py-1.5 text-caption sm:pl-[60px]">
                  {CHECK_GLYPH[c.status]}
                  <b className="min-w-0 truncate font-semibold">{c.name}</b>
                  <span className="text-muted-foreground">{c.status === 'success' ? `Successful in ${c.time}` : c.time}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {row(mergeOk, mergeTitle, mergeText)}
        <div className="flex flex-wrap items-center gap-3 bg-background px-4 py-3">
          <div className="flex">
            <Button className={cn(ghButton(true), 'rounded-r-none')} onPress={openOnGitHub(pr.url)}>Merge pull request</Button>
            <Button aria-label="Merge options" className={cn(ghButton(true), 'rounded-l-none border-l-white/30 px-2')}><Oct name="chevDown" size={12} /></Button>
          </div>
          <span className="text-caption text-muted-foreground">{source.live ? 'Merging opens the pull request on GitHub.' : 'You can also merge this with the command line.'}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Commits / Checks / Files changed ── */

const CHECK_GLYPH: Record<Check['status'], ReactNode> = {
  success: <Oct name="check" size={14} className="text-[var(--gh-open)]" />,
  failure: <Oct name="x" size={14} className="text-[var(--gh-closed)]" />,
  pending: <span className="mx-1 size-2 shrink-0 rounded-full bg-[var(--gh-attention)]" />,
  neutral: <Oct name="stopFill" size={14} className="text-muted-foreground" />,
};

export function CommitList({ ui, number }: { ui: Layout; number: number }) {
  const { source } = useRepo();
  const commits = useLoad(`${source.id}:commits:${number}`, () => source.pullCommits(number));
  return (
    <div className={cn('relative', !ui.phone && 'pl-8')}>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground"><Oct name="commit" />{source.live ? 'Commits' : 'Commits on Sep 24, 2026'}</div>
      <Loaded load={commits}>
        {(list) => (
          <Box>
            {list.map((c) => (
              <div key={c.sha} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 hover:bg-muted">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.message}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                    <Avatar c={c.author} src={c.author.avatar} size={16} /><b className="font-semibold text-foreground">{c.author.login}</b> committed {c.when}
                    {!source.live ? <Oct name="check" size={14} className="text-[var(--gh-open)]" /> : null}
                  </div>
                </div>
                <code className={cn(ghButton(), 'h-7 px-2 font-mono text-caption')}>{c.sha}</code>
                {!ui.phone ? <Oct name="copy" size={14} className="text-muted-foreground" /> : null}
              </div>
            ))}
          </Box>
        )}
      </Loaded>
    </div>
  );
}

export function Checks({ checks }: { checks: Check[] }) {
  const failed = checks.filter((c) => c.status === 'failure').length;
  const running = checks.filter((c) => c.status === 'pending').length;
  const head = !checks.length ? <b className="font-semibold">No checks reported</b>
    : failed ? <><Oct name="xFill" className="text-[var(--gh-closed)]" /><b className="font-semibold">Some checks were not successful</b><span className="text-muted-foreground">· {failed} failing</span></>
    : running ? <><Oct name="dotFill" className="text-[var(--gh-attention)]" /><b className="font-semibold">Some checks haven’t completed yet</b><span className="text-muted-foreground">· {running} in progress</span></>
    : <><Oct name="checkFill" className="text-[var(--gh-open)]" /><b className="font-semibold">All checks have passed</b><span className="text-muted-foreground">· {checks.length} successful checks</span></>;
  const icon: Record<Check['status'], ReactNode> = {
    success: <Oct name="checkFill" className="text-[var(--gh-open)]" />, failure: <Oct name="xFill" className="text-[var(--gh-closed)]" />,
    pending: <Oct name="dotFill" className="text-[var(--gh-attention)]" />, neutral: <Oct name="stopFill" className="text-muted-foreground" />,
  };
  return (
    <Box header={head}>
      {checks.map((c) => (
        <div key={c.name} className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
          {icon[c.status]}
          <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
          <span className="shrink-0 text-caption text-muted-foreground">{c.time}</span>
        </div>
      ))}
    </Box>
  );
}

/** Builds a folder tree from the changed paths. */
export function treeFromPaths(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  for (const p of paths) {
    let level = root;
    p.split('/').forEach((name, i, parts) => {
      const path = parts.slice(0, i + 1).join('/');
      let n = level.find((x) => x.name === name);
      if (!n) {
        n = { name, path, type: i === parts.length - 1 ? 'file' : 'dir', commit: '', when: '', children: i === parts.length - 1 ? undefined : [] };
        level.push(n);
      }
      level = n.children ?? [];
    });
  }
  return root;
}

export function FilesChanged({ ui, number }: { ui: Layout; number: number }) {
  const { source } = useRepo();
  const files = useLoad(`${source.id}:files:${number}`, () => source.pullFiles(number));
  const [selected, setSelected] = useState<string | undefined>();
  return (
    <Loaded load={files}>
      {(list) => {
        const add = list.reduce((s, f) => s + f.additions, 0);
        const del = list.reduce((s, f) => s + f.deletions, 0);
        return (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {!ui.phone ? <Button className={ghButton()}>All commits<Oct name="chevDown" size={12} /></Button> : null}
              <span className="flex items-center gap-2 text-muted-foreground">{list.length} files <DiffStat add={add} del={del} /></span>
              <span className="flex-1" />
              <span className="text-caption text-muted-foreground">0 / {list.length} viewed</span>
              <Button className={ghButton(true)}>Review changes<Oct name="chevDown" size={12} /></Button>
            </div>
            <div className="flex gap-4">
              {ui.wide ? (
                <aside className="w-[260px] shrink-0">
                  <div className="sticky top-0">
                    <FileTree nodes={treeFromPaths(list.map((f) => f.path))} selected={selected ?? list[0]?.path} defaultOpen
                      onSelect={(n) => { setSelected(n.path); document.getElementById('diff-' + n.path)?.scrollIntoView({ block: 'start' }); }} />
                  </div>
                </aside>
              ) : null}
              <div className="min-w-0 flex-1 space-y-4">
                {list.map((f) => <DiffView key={f.path} path={f.path} patch={f.patch} add={f.additions} del={f.deletions} note={f.note} />)}
                {!list.length ? <Box className="px-6 py-12 text-center text-muted-foreground">No files changed.</Box> : null}
              </div>
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}
