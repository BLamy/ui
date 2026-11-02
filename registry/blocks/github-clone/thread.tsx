/* A conversation, on issues and pull requests alike: the description, comments with edit, delete, quote and reactions,
   the timeline's events, and the box that adds a comment (and closes or reopens from the same place, as on GitHub). */
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { REACTION_GLYPH, type CommentTarget, type Commit, type ReactionContent, type Reactions, type ReviewThread, type TimelineItem, type User } from './data';
import { BranchLink, GhLink, UserLink } from './links';
import { MarkdownField, Md } from './markdown';
import { LabelChip, Oct, ghButton, type OctName } from './parts';
import { Menu } from './pickers';
import { ActionError, Loaded, useAction, useCan, useLoad, useRepo } from './repo-context';

/* ── Reactions ── */
const ALL_REACTIONS: ReactionContent[] = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
const REACTION_NAME: Record<ReactionContent, string> = { '+1': 'Thumbs up', '-1': 'Thumbs down', laugh: 'Laugh', hooray: 'Hooray', confused: 'Confused', heart: 'Heart', rocket: 'Rocket', eyes: 'Eyes' };

export function ReactionBar({ target, reactions, className }: { target: CommentTarget; reactions: Reactions; className?: string }) {
  const { source, viewer } = useRepo();
  const { participate } = useCan();
  const key = target.kind === 'issue' ? `i${target.number}` : `${target.kind}${target.id}`;
  const any = Object.keys(reactions).length > 0;
  const mine = useLoad<Partial<Record<ReactionContent, number>>>(`${source.id}:reactions:${key}:${any}:${viewer?.login ?? ''}`, () => (any && viewer ? source.myReactions(target) : {})).data ?? {};
  const act = useAction();
  const toggle = (c: ReactionContent) => act.run(async () => { if (mine[c]) await source.unreact(target, mine[c]!); else await source.react(target, c); });
  const chip = 'inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border px-2 text-caption outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-disabled:cursor-default group-data-[phone=true]/gh:h-9';
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {participate ? (
        <Menu label="Add reaction" triggerClassName={cn(chip, 'border-border bg-transparent text-muted-foreground data-hovered:text-primary')} trigger={<Oct name="smile" size={14} />} placement="bottom start"
          entries={ALL_REACTIONS.map((c) => ({ id: c, text: REACTION_NAME[c], label: <span>{REACTION_GLYPH[c]} {REACTION_NAME[c]}</span>, selected: !!mine[c], onAction: () => void toggle(c) }))} />
      ) : null}
      {ALL_REACTIONS.filter((c) => reactions[c]).map((c) => (
        <Button key={c} isDisabled={!participate || act.busy} aria-label={`${REACTION_NAME[c]}: ${reactions[c]}${mine[c] ? ', including you' : ''}`} aria-pressed={!!mine[c]} onPress={() => void toggle(c)}
          className={cn(chip, mine[c] ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-transparent text-muted-foreground')}>
          <span aria-hidden="true">{REACTION_GLYPH[c]}</span>{reactions[c]}
        </Button>
      ))}
      <ActionError error={act.error} />
    </div>
  );
}

/* ── A comment ── */

export interface CommentProps {
  author: User;
  when: string;
  at?: string;
  body: string;
  role?: string;
  url?: string;
  verb?: string;
  tone?: 'author';
  edited?: boolean;
  /** Set: it can be edited, deleted and reacted to. */
  target?: CommentTarget;
  /** The issue or pull request it belongs to. */
  number: number;
  reactions?: Reactions;
  /** Puts text into the composer below (Quote reply). */
  onQuote?: (text: string) => void;
  /** Called with the new body instead of the source's editComment (a description goes through its own patch). */
  onSaveBody?: (body: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
  compact?: boolean;
  children?: ReactNode;
}

export function CommentCard({ author, when, at, body, role, url, verb = 'commented', tone, edited, target, number, reactions, onQuote, onSaveBody, canEdit, canDelete, compact, children }: CommentProps) {
  const { source, ui, notify } = useRepo();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const act = useAction();
  const save = () => act.run(async () => {
    if (onSaveBody) await onSaveBody(editing!);
    else if (target) await source.editComment(target, editing!);
    setEditing(null);
  });
  const remove = () => act.run(async () => { if (target) await source.deleteComment(target, number); setConfirming(false); });
  return (
    <div className={cn('relative flex gap-4', compact ? '' : 'py-4')} id={target?.kind === 'issueComment' ? `issuecomment-${target.id}` : undefined}>
      {!ui.phone && !compact ? <UserLink user={author} className="shrink-0"><Avatar c={author} src={author.avatar} size={40} /></UserLink> : null}
      <div className={cn('relative z-1 min-w-0 flex-1 overflow-hidden rounded-md border bg-background', tone === 'author' ? 'border-primary/40' : 'border-border')}>
        <div className={cn('flex items-center gap-1.5 border-b px-4 py-2 text-muted-foreground', tone === 'author' ? 'border-primary/40 bg-primary/8' : 'border-border bg-muted')}>
          {ui.phone || compact ? <Avatar c={author} src={author.avatar} size={20} /> : null}
          <UserLink user={author} className="shrink-0 font-semibold whitespace-nowrap text-foreground">{author.login}</UserLink>
          <span className="min-w-0 truncate">{verb} {url ? <a href={url} target="_blank" rel="noreferrer" title={at ? new Date(at).toLocaleString() : undefined} className="text-inherit no-underline hover:underline">{when}</a> : when}{edited ? ' · edited' : ''}</span>
          <span className="flex-1" />
          {role && !ui.phone ? <span className="rounded-full border border-border px-2 text-caption leading-[18px] font-medium">{role}</span> : null}
          <Menu label={`Comment actions for ${author.login}`} triggerClassName="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary group-data-[phone=true]/gh:size-9"
            trigger={<Oct name="kebab" />} entries={[
              url ? { id: 'copy', label: 'Copy link', onAction: () => { void navigator.clipboard?.writeText(url).catch(() => {}); notify('Link copied'); } } : null,
              onQuote ? { id: 'quote', label: 'Quote reply', onAction: () => onQuote(body.split('\n').map((l) => `> ${l}`).join('\n') + '\n\n') } : null,
              url ? { id: 'github', label: 'Open on GitHub', href: url, onAction: () => {} } : null,
              canEdit ? { separator: true, id: 'sep' } : null,
              canEdit ? { id: 'edit', label: 'Edit', onAction: () => setEditing(body === '*No description provided.*' ? '' : body) } : null,
              canDelete ? { id: 'delete', label: 'Delete', danger: true, onAction: () => setConfirming(true) } : null,
            ]} />
        </div>
        {editing != null ? (
          <div className="p-3">
            <MarkdownField label="Edit comment" value={editing} onChange={setEditing} onSubmit={() => void save()} autoFocus />
            <ActionError error={act.error} className="mt-2" />
            <div className="mt-2 flex justify-end gap-2">
              <Button className={ghButton()} isDisabled={act.busy} onPress={() => { setEditing(null); act.clear(); }}>Cancel</Button>
              <Button className={ghButton(true)} isDisabled={act.busy} onPress={() => void save()}>{act.busy ? 'Saving…' : 'Update comment'}</Button>
            </div>
          </div>
        ) : (
          <>
            <Md markdown={body} className="px-4 py-3" />
            {children}
            {target && reactions ? <ReactionBar target={target} reactions={reactions} className="px-4 pb-3" /> : null}
          </>
        )}
        {confirming ? (
          <div role="alertdialog" aria-label="Delete this comment?" className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-4 py-2">
            <span className="min-w-0 flex-1 font-semibold">Delete this comment?</span>
            <ActionError error={act.error} />
            <Button className={ghButton()} isDisabled={act.busy} onPress={() => setConfirming(false)}>Cancel</Button>
            <Button className={cn(ghButton(), 'text-(--gh-closed)')} isDisabled={act.busy} onPress={() => void remove()}>{act.busy ? 'Deleting…' : 'Delete'}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── The timeline ── */

export function TimelineEvent({ icon, badge, children }: { icon: OctName; badge?: string; children: ReactNode }) {
  const { ui } = useRepo();
  return (
    <div className={cn('relative flex items-start gap-2 py-3', ui.phone ? 'pl-0' : 'pl-14')}>
      <span className={cn('z-1 grid size-8 shrink-0 place-items-center rounded-full border-2 border-background', badge ?? 'bg-muted text-muted-foreground')}>
        <Oct name={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1 pt-1.5 text-muted-foreground">{children}</div>
    </div>
  );
}

const strong = (t?: ReactNode) => <b className="font-semibold text-foreground">{t}</b>;
/** closed / reopened / merged / … : icon, badge, and what the actor did. */
const EVENTS: Record<string, { icon: OctName; badge?: string; text: (x: { text?: string; ref?: number; reason?: string | null; sha?: string }) => ReactNode }> = {
  closed: {
    icon: 'issueClosed', badge: 'bg-(--gh-done) text-white',
    text: ({ reason, sha }) => <>closed this {reason === 'not_planned' ? 'as not planned' : reason === 'completed' ? 'as completed' : ''}{sha ? <> in <GhLink to={{ s: 'commit', sha }} className="font-mono text-primary no-underline hover:underline">{sha.slice(0, 7)}</GhLink></> : null}</>,
  },
  reopened: { icon: 'issue', badge: 'bg-(--gh-merge) text-white', text: () => 'reopened this' },
  merged: { icon: 'merged', badge: 'bg-(--gh-done) text-white', text: ({ sha }) => <>merged this{sha ? <> as <GhLink to={{ s: 'commit', sha }} className="font-mono text-primary no-underline hover:underline">{sha.slice(0, 7)}</GhLink></> : null}</> },
  head_ref_deleted: { icon: 'branch', text: () => 'deleted the head branch' },
  head_ref_restored: { icon: 'branch', text: () => 'restored the head branch' },
  head_ref_force_pushed: { icon: 'branch', text: () => 'force-pushed the head branch' },
  ready_for_review: { icon: 'eye', text: () => 'marked this pull request as ready for review' },
  convert_to_draft: { icon: 'prDraft', text: () => 'marked this pull request as draft' },
  renamed: { icon: 'pencil', text: ({ text }) => <>changed the title to {strong(text)}</> },
  base_ref_changed: { icon: 'branch', text: ({ text }) => <>changed the base branch to {strong(text)}</> },
  assigned: { icon: 'people', text: ({ text }) => <>assigned {strong(text)}</> },
  unassigned: { icon: 'people', text: ({ text }) => <>unassigned {strong(text)}</> },
  milestoned: { icon: 'milestone', text: ({ text }) => <>added this to the {strong(text)} milestone</> },
  demilestoned: { icon: 'milestone', text: ({ text }) => <>removed this from the {strong(text)} milestone</> },
  locked: { icon: 'lock', text: ({ text }) => <>locked {text ? <>as {strong(text)} </> : ''}and limited conversation to collaborators</> },
  unlocked: { icon: 'lock', text: () => 'unlocked this conversation' },
  pinned: { icon: 'pin', text: () => 'pinned this issue' },
  unpinned: { icon: 'pin', text: () => 'unpinned this issue' },
  auto_merge_enabled: { icon: 'merged', text: () => 'enabled auto-merge' },
  auto_merge_disabled: { icon: 'merged', text: () => 'disabled auto-merge' },
  review_dismissed: { icon: 'x', text: () => 'dismissed a review' },
  'cross-referenced': { icon: 'link', text: ({ ref, text }) => <>mentioned this in <GhLink to={{ s: 'issue', n: ref! }}>{text ? `${text} ` : ''}#{ref}</GhLink></> },
  referenced: { icon: 'commit', text: ({ sha }) => <>added a commit that references this: <GhLink to={{ s: 'commit', sha: sha! }} className="font-mono text-primary no-underline hover:underline">{sha?.slice(0, 7)}</GhLink></> },
};

function CommitRow({ c }: { c: Commit }) {
  return (
    <li className="flex items-center gap-2">
      <Avatar c={c.author} src={c.author.avatar} size={16} />
      <GhLink to={{ s: 'commit', sha: c.fullSha }} className="min-w-0 flex-1 truncate text-foreground no-underline hover:text-primary hover:underline">{c.message}</GhLink>
      <GhLink to={{ s: 'commit', sha: c.fullSha }} className="shrink-0 font-mono text-caption text-muted-foreground no-underline hover:text-primary">{c.sha}</GhLink>
    </li>
  );
}

export function TimelineEntry({ item, number, authorLogin, onQuote, threads, renderThreads }: {
  item: TimelineItem; number: number; authorLogin?: string; onQuote?: (t: string) => void; threads?: ReviewThread[]; renderThreads?: (threads: ReviewThread[]) => ReactNode;
}) {
  const { ui, viewer } = useRepo();
  const can = useCan();
  const who = (u: User) => (
    <UserLink user={u} className="text-foreground"><Avatar c={u} src={u.avatar} size={20} className="mr-1.5 inline-grid align-[-5px]" /><b className="font-semibold">{u.login}</b></UserLink>
  );
  switch (item.kind) {
    case 'comment': {
      const mine = viewer?.login === item.author.login;
      return <CommentCard author={item.author} when={item.when} at={item.at} body={item.body} role={item.role} url={item.url} edited={item.edited} target={item.target} number={number} reactions={item.reactions} onQuote={onQuote}
        tone={item.author.login === authorLogin ? 'author' : undefined} canEdit={!item.isBody && !!item.target && can.participate && (mine || can.triage)} canDelete={!item.isBody && !!item.target && can.participate && (mine || can.triage)} />;
    }
    case 'commits':
      return (
        <TimelineEvent icon="commit">
          {who(item.author)} added {item.commits.length} commit{item.commits.length === 1 ? '' : 's'} {item.when}
          <ul className="mt-2 mb-0 list-none space-y-1.5 p-0">{item.commits.map((c) => <CommitRow key={c.fullSha} c={c} />)}</ul>
        </TimelineEvent>
      );
    case 'labeled':
      return (
        <TimelineEvent icon="tag">
          {who(item.author)}{item.labels.length ? <> added {item.labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} className="mx-0.5 align-[1px]" />)}</> : null}
          {item.removed?.length ? <>{item.labels.length ? ' and' : ''} removed {item.removed.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} className="mx-0.5 align-[1px]" />)}</> : null}{' '}
          label{item.labels.length + (item.removed?.length ?? 0) === 1 ? '' : 's'} {item.when}
        </TimelineEvent>
      );
    case 'requested':
      return <TimelineEvent icon="eye">{who(item.author)} {item.removed ? 'removed the review request for' : 'requested a review from'} {strong(item.reviewer.login)} {item.when}</TimelineEvent>;
    case 'review': {
      const here = threads ?? [];
      // A plain "commented" with no words and no threads of its own is a reply elsewhere: nothing to say here.
      if (item.state === 'commented' && !item.body && !here.length) return null;
      return (
        <>
          <TimelineEvent icon={item.state === 'approved' ? 'check' : item.state === 'changes' ? 'x' : 'eye'}
            badge={item.state === 'approved' ? 'bg-(--gh-merge) text-white' : item.state === 'changes' ? 'bg-(--gh-closed) text-white' : undefined}>
            {who(item.author)} {item.state === 'approved' ? 'approved these changes' : item.state === 'changes' ? 'requested changes' : item.state === 'dismissed' ? 'reviewed (dismissed)' : 'reviewed'} {item.when}
          </TimelineEvent>
          {item.body ? <CommentCard author={item.author} when={item.when} body={item.body} verb="left a comment" role={item.role} url={item.url} number={number} /> : null}
          {here.length && renderThreads ? <div className={cn('pb-2', !ui.phone && 'pl-14')}>{renderThreads(here)}</div> : null}
        </>
      );
    }
    case 'event': {
      const e = EVENTS[item.event];
      if (!e) return null;
      return <TimelineEvent icon={e.icon} badge={e.badge}>{who(item.author)} {e.text(item)} {item.when}</TimelineEvent>;
    }
  }
}

/** Who spoke in a conversation (comments and reviews), first appearance first. */
export function participantsOf(items: TimelineItem[]): User[] {
  const seen = new Map<string, User>();
  for (const it of items) if ((it.kind === 'comment' || it.kind === 'review') && !seen.has(it.author.login)) seen.set(it.author.login, it.author);
  return [...seen.values()];
}

export interface ThreadProps {
  number: number;
  authorLogin: string;
  /** Saves a new description. */
  saveBody?: (body: string) => Promise<void>;
  canEditBody?: boolean;
  locked?: boolean;
  /** Between the timeline and the composer (the merge box). */
  footer?: ReactNode;
  /** Beside "Comment" in the composer: close, reopen. Called with the text so far; a comment goes first if there is one. */
  actions?: (o: { text: string; submit: () => Promise<boolean>; busy: boolean }) => ReactNode;
  threadsFor?: (reviewId?: number) => ReviewThread[] | undefined;
  renderThreads?: (threads: ReviewThread[]) => ReactNode;
}

/** An issue's or pull request's conversation and the comment box. */
export function Thread({ number, authorLogin, saveBody, canEditBody, locked, footer, actions, threadsFor, renderThreads }: ThreadProps) {
  const { source, viewer, ui, repo, keychain } = useRepo();
  const can = useCan();
  const timeline = useLoad(`${source.id}:timeline:${number}`, () => source.timeline(number));
  const [draft, setDraft] = useState('');
  const act = useAction();
  const items = timeline.data ?? [];
  const submit = async () => {
    const body = draft.trim();
    if (!body) return true;
    const ok = await act.run(async () => { await source.comment(number, body); return true; });
    if (ok) setDraft('');
    return !!ok;
  };
  const quote = (t: string) => {
    setDraft((d) => (d ? d.trimEnd() + '\n\n' : '') + t);
    document.getElementById(`composer-${number}`)?.querySelector('textarea')?.focus();
  };
  const lockedOut = locked && !can.triage;
  return (
    <div className="min-w-0 flex-1">
      <Loaded load={timeline}>
        {() => (
          /* The timeline rail runs behind the event badges. */
          <div className={cn('relative', ui.phone ? 'before:left-4' : 'before:left-[72px]', 'before:absolute before:inset-y-0 before:w-0.5 before:bg-border')}>
            {items.map((it) => (
              it.kind === 'comment' && it.isBody ? (
                <CommentCard key={it.id} author={it.author} when={it.when} at={it.at} body={it.body} role={it.role} url={it.url} target={it.target} number={number} reactions={it.reactions} onQuote={quote} tone="author" onSaveBody={saveBody} canEdit={canEditBody} verb="opened this" />
              ) : (
                <div key={it.id}>
                  <TimelineEntry item={it} number={number} authorLogin={authorLogin} onQuote={quote} threads={it.kind === 'review' ? threadsFor?.(it.reviewId) : undefined} renderThreads={renderThreads} />
                </div>
              )
            ))}
          </div>
        )}
      </Loaded>
      {footer}
      <div className="mt-6 flex gap-4 border-t-2 border-border pt-6" id={`composer-${number}`}>
        {!ui.phone && viewer ? <Avatar c={viewer} src={viewer.avatar} size={40} /> : null}
        <div className="min-w-0 flex-1">
          {repo.archived ? (
            <p className="m-0 rounded-md border border-border bg-muted px-4 py-3 text-muted-foreground"><Oct name="archive" size={14} className="mr-1.5" />This repository has been archived. You can’t comment.</p>
          ) : !viewer ? (
            <p className="m-0 rounded-md border border-border bg-muted px-4 py-3 text-muted-foreground">
              {keychain ? <Button className={cn(ghButton(true), 'mr-2')} onPress={keychain.signIn}>Sign in with GitHub</Button> : null}to join this conversation.
            </p>
          ) : lockedOut ? (
            <p className="m-0 rounded-md border border-border bg-muted px-4 py-3 text-muted-foreground"><Oct name="lock" size={14} className="mr-1.5" />This conversation has been locked and limited to collaborators.</p>
          ) : (
            <>
              <h3 className="mt-0 mb-2 text-detail font-semibold">Add a comment</h3>
              <MarkdownField label="Add a comment" value={draft} onChange={setDraft} onSubmit={() => void submit()} disabled={act.busy}
                footer={source.live ? <span className="ml-auto">Posts to {source.full} as {viewer.login}</span> : <span className="ml-auto">Sample: stays in this page</span>} />
              <ActionError error={act.error} className="mt-2" />
            </>
          )}
          {viewer && !lockedOut && !repo.archived ? (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {actions?.({ text: draft, submit, busy: act.busy })}
              <Button className={ghButton(true)} isDisabled={act.busy || !draft.trim()} onPress={() => void submit()}>{act.busy ? 'Posting…' : 'Comment'}</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { BranchLink };
