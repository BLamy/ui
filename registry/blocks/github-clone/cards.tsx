/* GitHub's hover cards, built from what the screens already loaded: a person wherever a login or an avatar shows (name,
   login, bio, and whether they've committed to the open repository), an issue or pull request on its list row's title
   (state, title, labels, who opened it; a pull request adds its branches, size, checks and review), and a commit on
   its message (message, author, sha). Like GitHub's, each previews what the name or row already leads to — touch
   never shows one. */
import { type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { HoverCard, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import type { Commit, Issue, LastCommit, PullRequest, User } from './data';
import { Branch, DiffStat, LabelChip, Oct, PR_STATE, StateIcon, type Layout } from './parts';
import { useRepo } from './repo-context';

/** A person: name and login, bio, and a line when they've committed to the open repository. */
export function UserCard({ user }: { user: User }) {
  const { repo } = useRepo();
  const name = `${user.f} ${user.l}`.trim();
  const contributor = repo.contributors.some((u) => u.login === user.login) || repo.lastCommit?.author.login === user.login;
  return (
    <>
      <HoverCardHeader media={<Avatar c={user} src={user.avatar} size={48} />} title={name || user.login} subtitle={name ? user.login : undefined} />
      {user.bio ? <p className="mt-3 mb-0 text-detail leading-[1.5] text-foreground">{user.bio}</p> : null}
      {contributor ? (
        <div className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
          <Oct name="commit" size={14} />Committed to <b className="font-semibold text-foreground">{repo.owner}/{repo.name}</b>
        </div>
      ) : null}
    </>
  );
}

/** A login in bold that shows the person's card. */
export function UserName({ user, className }: { user: User; className?: string }) {
  return (
    <HoverCardTrigger className="align-baseline">
      <b className={cn('font-semibold text-foreground hover:text-primary hover:underline', className)}>{user.login}</b>
      <HoverCard><UserCard user={user} /></HoverCard>
    </HoverCardTrigger>
  );
}

/** An Avatar with the person's card. */
export function UserAvatar({ user, size, className }: { user: User; size: number; className?: string }) {
  return <Avatar c={user} src={user.avatar} size={size} className={className} card={<UserCard user={user} />} />;
}

/** The top of an issue / pull request card: where and when, then the state glyph and title, then its labels. */
function ItemCard({ ui, state, number, title, when, verb, author, labels, children }: {
  ui: Layout; state: Parameters<typeof StateIcon>[0]['state']; number: number; title: string; when: string; verb: string;
  author: User; labels: Issue['labels']; children?: ReactNode;
}) {
  const { repo } = useRepo();
  return (
    <>
      <div className="text-caption text-muted-foreground">{repo.owner}/{repo.name} · {when}</div>
      <div className="mt-2 flex gap-2">
        <StateIcon state={state} className="mt-[3px]" />
        <div className="min-w-0 flex-1 text-callout leading-6 font-semibold text-foreground">
          {title} <span className="font-normal text-muted-foreground">#{number}</span>
        </div>
      </div>
      {labels.length ? <div className="mt-2 flex flex-wrap gap-1 pl-6">{labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}</div> : null}
      {children}
      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-caption text-muted-foreground">
        <Avatar c={author} src={author.avatar} size={16} /><b className="font-semibold text-foreground">{author.login}</b> {verb}
      </div>
    </>
  );
}

export function IssueCard({ ui, issue }: { ui: Layout; issue: Issue }) {
  return (
    <ItemCard ui={ui} state={issue.state === 'open' ? 'open' : 'closed'} number={issue.number} title={issue.title} when={issue.when}
      verb={issue.state === 'open' ? 'opened this issue' : 'opened this issue · closed'} author={issue.author} labels={issue.labels}>
      {issue.milestone || issue.assignees.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 pl-6 text-caption text-muted-foreground">
          {issue.milestone ? <span className="flex items-center gap-1"><Oct name="history" size={12} />{issue.milestone}</span> : null}
          {issue.assignees.length ? <span className="flex items-center gap-1"><Oct name="people" size={12} />{issue.assignees.map((u) => u.login).join(', ')}</span> : null}
        </div>
      ) : null}
    </ItemCard>
  );
}

const CHECKS = { success: ['check', 'text-(--gh-open)', 'All checks have passed'], failure: ['x', 'text-(--gh-closed)', 'Some checks were not successful'], pending: ['dotFill', 'text-(--gh-attention)', 'Some checks haven’t completed yet'] } as const;
const REVIEW = { approved: 'Approved', changes: 'Changes requested', pending: 'Review required', draft: 'Draft' } as const;

export function PullCard({ ui, pr }: { ui: Layout; pr: PullRequest }) {
  const verb = pr.state === 'merged' ? 'merged this pull request' : pr.state === 'closed' ? 'closed this pull request' : 'opened this pull request';
  return (
    <ItemCard ui={ui} state={PR_STATE[pr.state]} number={pr.number} title={pr.title} when={pr.when} verb={verb} author={pr.author} labels={pr.labels}>
      {/* Live search results don't carry branches or sizes: the lines show once they're known. */}
      {pr.head && pr.base ? (
        <div className="mt-2 flex flex-wrap items-center gap-1 pl-6 text-caption text-muted-foreground">
          <Branch>{pr.base}</Branch><Oct name="chevLeft" size={12} /><Branch>{pr.head}</Branch>
        </div>
      ) : null}
      {pr.commits || pr.additions || pr.deletions ? (
        <div className="mt-2 flex items-center gap-3 pl-6 text-caption text-muted-foreground">
          <span className="flex items-center gap-1"><Oct name="commit" size={12} />{pr.commits} commit{pr.commits === 1 ? '' : 's'}</span>
          <DiffStat add={pr.additions} del={pr.deletions} />
        </div>
      ) : null}
      {pr.checks || pr.review ? (
        <div className="mt-2 space-y-1 pl-6 text-caption">
          {pr.checks ? <div className="flex items-center gap-1.5 text-muted-foreground"><Oct name={CHECKS[pr.checks][0]} size={12} className={CHECKS[pr.checks][1]} />{CHECKS[pr.checks][2]}</div> : null}
          {pr.review && pr.review !== 'draft' ? (
            <div className={cn('flex items-center gap-1.5', pr.review === 'approved' ? 'text-(--gh-open)' : pr.review === 'changes' ? 'text-(--gh-closed)' : 'text-muted-foreground')}>
              <Oct name="eye" size={12} />{REVIEW[pr.review]}
            </div>
          ) : null}
        </div>
      ) : null}
    </ItemCard>
  );
}

/** A commit: its message, who and when, and the short sha. */
export function CommitCard({ commit }: { commit: Commit | LastCommit }) {
  const { repo } = useRepo();
  return (
    <>
      <div className="text-caption text-muted-foreground">{repo.owner}/{repo.name}</div>
      <div className="mt-2 flex gap-2">
        <Oct name="commit" className="mt-[3px] text-muted-foreground" />
        <div className="min-w-0 flex-1 text-detail leading-5 font-semibold break-words text-foreground">{commit.message}</div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-caption text-muted-foreground">
        <Avatar c={commit.author} src={commit.author.avatar} size={16} />
        <span className="min-w-0 flex-1 truncate"><b className="font-semibold text-foreground">{commit.author.login}</b> committed {commit.when}</span>
        <code className="shrink-0 font-mono">{commit.sha.slice(0, 7)}</code>
      </div>
    </>
  );
}

/** A commit message (truncating) that shows the commit's card. */
export function CommitMessage({ commit, className }: { commit: Commit | LastCommit; className?: string }) {
  return (
    <HoverCardTrigger className="min-w-0">
      <span className={cn('min-w-0 truncate hover:text-primary hover:underline', className)}>{commit.message}</span>
      <HoverCard placement="bottom start"><CommitCard commit={commit} /></HoverCard>
    </HoverCardTrigger>
  );
}
