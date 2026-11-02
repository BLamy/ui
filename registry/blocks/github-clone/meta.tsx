/* The right-hand column of an issue or pull request: reviewers, assignees, labels, milestone, notifications, participants
   and the housekeeping (lock, pin, delete). Every section edits for real; without permission it reads, and says nothing
   it can't back. Beside the conversation when wide, a collapsible section above it otherwise, so the phone reaches all of it. */
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Label, Milestone, Reviewer, User } from './data';
import { GhLink, UserChip } from './links';
import { AvatarStack, Counter, LabelChip, Oct, ghButton } from './parts';
import { SelectMenu } from './pickers';
import { ActionError, useAction, useCan, useLoad, useRepo } from './repo-context';

const gear = 'grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-primary group-data-[phone=true]/gh:size-11';
const sideTitle = 'mb-2 flex items-center justify-between font-semibold text-muted-foreground';
const side = 'border-b border-border py-4 text-caption first:pt-0 last:border-0';

function Section({ title, menu, children }: { title: string; menu?: ReactNode; children: ReactNode }) {
  return <div className={side}><div className={sideTitle}>{title}{menu}</div>{children}</div>;
}

export const userPick = (u: User) => ({ id: u.login, label: u.login, keywords: `${u.f} ${u.l}`, leading: <Avatar c={u} src={u.avatar} size={20} /> });

export function LabelSection({ value, editable, onSave, query }: { value: Label[]; editable: boolean; onSave: (names: string[]) => Promise<void>; query: 'issues' | 'pulls' }) {
  const { source, ui, repo } = useRepo();
  const nav = useRepo().nav;
  const labels = useLoad(source.id + ':labels', source.labels);
  const act = useAction();
  void repo;
  return (
    <Section title="Labels" menu={editable ? (
      <SelectMenu title="Apply labels" multiple triggerLabel="Edit labels" triggerClassName={gear} trigger={<Oct name="gear" size={14} />} loading={labels.loading} filterPlaceholder="Filter labels"
        items={(labels.data ?? []).map((l) => ({ id: l.name, label: l.name, description: l.description, leading: <span className="size-3.5 shrink-0 rounded-full" style={{ background: l.color }} /> }))}
        selected={value.map((l) => l.name)} onApply={(ids) => void act.run(() => onSave(ids), 'update the labels')}
        footer={(_q, close) => <Button className="w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-caption text-primary outline-none data-hovered:bg-accent" onPress={() => { close(); nav.go({ s: 'labels' }); }}>Edit labels</Button>} />
    ) : undefined}>
      {value.length ? (
        <div className="flex flex-wrap gap-1">
          {value.map((l) => (
            <GhLink key={l.name} to={query === 'issues' ? { s: 'issues', q: `is:open label:"${l.name}"` } : { s: 'pulls', q: `is:open label:"${l.name}"` }} className="no-underline"><LabelChip label={l} dark={ui.dark} /></GhLink>
          ))}
        </div>
      ) : <span className="text-muted-foreground">None yet</span>}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </Section>
  );
}

export function AssigneeSection({ value, editable, onSave }: { value: User[]; editable: boolean; onSave: (logins: string[]) => Promise<void> }) {
  const { source, viewer } = useRepo();
  const people = useLoad(source.id + ':assignable', source.assignable);
  const act = useAction();
  return (
    <Section title="Assignees" menu={editable ? (
      <SelectMenu title="Assign up to 10 people" multiple triggerLabel="Edit assignees" triggerClassName={gear} trigger={<Oct name="gear" size={14} />} loading={people.loading} filterPlaceholder="Type or choose a user" empty="No one matches"
        items={(people.data ?? []).map(userPick)} selected={value.map((u) => u.login)} onApply={(ids) => void act.run(() => onSave(ids), 'update the assignees')} />
    ) : undefined}>
      {value.length ? value.map((u) => <div key={u.login} className="mb-1.5"><UserChip user={u} /></div>) : (
        <span className="text-muted-foreground">No one{editable && viewer ? <> — <Button className="inline cursor-pointer border-0 bg-transparent p-0 text-caption text-primary outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-primary" onPress={() => void act.run(() => onSave([viewer.login]), 'assign you')}>assign yourself</Button></> : null}</span>
      )}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </Section>
  );
}

export function MilestoneSection({ value, editable, onSave }: { value?: Milestone; editable: boolean; onSave: (n: number | null) => Promise<void> }) {
  const { source } = useRepo();
  const milestones = useLoad(source.id + ':milestones:open', () => source.milestones('open'));
  const act = useAction();
  return (
    <Section title="Milestone" menu={editable ? (
      <SelectMenu title="Set milestone" triggerLabel="Edit milestone" triggerClassName={gear} trigger={<Oct name="gear" size={14} />} loading={milestones.loading} filterPlaceholder="Filter milestones" empty="No milestones" clearLabel={value ? 'Clear this milestone' : undefined}
        items={(milestones.data ?? []).map((m) => ({ id: String(m.number), label: m.title, description: m.dueWhen ? `Due ${m.dueWhen}` : undefined }))} selected={value ? [String(value.number)] : []}
        onApply={(ids) => void act.run(() => onSave(ids[0] ? Number(ids[0]) : null), 'set the milestone')} />
    ) : undefined}>
      {value ? (
        <>
          <Progress aria-label={`${value.title} progress`} value={value.pct} size="sm" tone="success" />
          <GhLink to={{ s: 'milestone', n: value.number }} className="mt-1.5 block font-semibold text-foreground no-underline hover:text-primary">{value.title}</GhLink>
        </>
      ) : <span className="text-muted-foreground">No milestone</span>}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </Section>
  );
}

const REVIEWER_ICON: Record<Reviewer['state'], [ReactNode, string]> = {
  approved: [<Oct key="a" name="check" className="text-(--gh-open)" />, 'approved'],
  changes: [<Oct key="c" name="x" className="text-(--gh-closed)" />, 'requested changes'],
  commented: [<Oct key="k" name="comment" className="text-muted-foreground" />, 'commented'],
  pending: [<span key="p" className="mx-1 size-2 rounded-full bg-(--gh-attention)" />, 'awaiting review'],
  dismissed: [<Oct key="d" name="x" className="text-muted-foreground" />, 'review dismissed'],
};

export function ReviewerSection({ value, editable, author, onRequest, onRemove, onDismiss }: {
  value: Reviewer[]; editable: boolean; author: string; onRequest: (add: string[], remove: string[]) => Promise<void>; onRemove?: (login: string) => Promise<void>; onDismiss?: (r: Reviewer, message: string) => Promise<void>;
}) {
  const { source, viewer } = useRepo();
  const people = useLoad(source.id + ':assignable', source.assignable);
  const act = useAction();
  const [dismissing, setDismissing] = useState<Reviewer | null>(null);
  const [why, setWhy] = useState('');
  const requested = value.filter((r) => r.state === 'pending' && !r.isTeam).map((r) => r.user.login);
  void onRemove;
  return (
    <Section title="Reviewers" menu={editable ? (
      <SelectMenu title="Request up to 15 reviewers" multiple triggerLabel="Edit reviewers" triggerClassName={gear} trigger={<Oct name="gear" size={14} />} loading={people.loading} filterPlaceholder="Type or choose a user" empty="No one matches"
        items={(people.data ?? []).filter((u) => u.login !== author).map(userPick)} selected={requested}
        onApply={(ids) => void act.run(() => onRequest(ids.filter((x) => !requested.includes(x)), requested.filter((x) => !ids.includes(x))), 'update the reviewers')} />
    ) : undefined}>
      {value.length ? value.map((r) => (
        <div key={r.user.login} className="mb-1.5 flex items-center gap-2">
          <UserChip user={r.user} className="min-w-0 flex-1" />
          <span title={REVIEWER_ICON[r.state][1]}>{REVIEWER_ICON[r.state][0]}<span className="sr-only">{REVIEWER_ICON[r.state][1]}</span></span>
          {editable && r.state !== 'pending' && !r.isTeam && r.user.login !== viewer?.login ? (
            <Button aria-label={`Re-request review from ${r.user.login}`} className={gear} onPress={() => void act.run(() => onRequest([r.user.login], []), 're-request that review')}><Oct name="retry" size={12} /></Button>
          ) : null}
          {editable && onDismiss && (r.state === 'approved' || r.state === 'changes') && r.reviewId && r.user.login !== viewer?.login ? (
            <Button aria-label={`Dismiss ${r.user.login}’s review`} className={gear} onPress={() => { setDismissing(r); setWhy(''); }}><Oct name="x" size={12} /></Button>
          ) : null}
        </div>
      )) : <span className="text-muted-foreground">No reviews</span>}
      {dismissing ? (
        <form className="mt-2 grid gap-2" onSubmit={(e) => { e.preventDefault(); if (why.trim()) void act.run(async () => { await onDismiss!(dismissing, why.trim()); setDismissing(null); }, 'dismiss that review'); }}>
          <label className="grid gap-1 text-caption">
            <span className="font-semibold">Why dismiss {dismissing.user.login}’s review?</span>
            <input autoFocus value={why} onChange={(e) => setWhy(e.target.value)} className="box-border h-8 rounded-md border border-border bg-background px-2 font-sans text-caption text-foreground outline-none select-text focus:border-primary group-data-[phone=true]/gh:h-11" />
          </label>
          <div className="flex justify-end gap-2">
            <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setDismissing(null)}>Cancel</Button>
            <Button type="submit" className={cn(ghButton(true), 'h-7 px-2 text-caption')} isDisabled={!why.trim() || act.busy}>Dismiss review</Button>
          </div>
        </form>
      ) : null}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </Section>
  );
}

export function NotificationSection({ subscribed, disabled, onToggle }: { subscribed: boolean; disabled: boolean; onToggle: (on: boolean) => Promise<void> }) {
  const act = useAction();
  return (
    <Section title="Notifications">
      <Button className={cn(ghButton(), 'w-full')} isDisabled={disabled || act.busy} onPress={() => void act.run(() => onToggle(!subscribed), 'change your subscription')}><Oct name="bell" />{subscribed ? 'Unsubscribe' : 'Subscribe'}</Button>
      <p className="mt-2 mb-0 text-muted-foreground">{subscribed ? 'You’re receiving notifications from this thread.' : 'You’re not receiving notifications from this thread.'}</p>
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </Section>
  );
}

export function ParticipantsSection({ users }: { users: User[] }) {
  if (!users.length) return null;
  return <Section title={`${users.length} participant${users.length === 1 ? '' : 's'}`}><AvatarStack users={users} size={26} /></Section>;
}

/** Lock or unlock a conversation; offered to people with triage. */
export function LockSection({ locked, reason, number }: { locked: boolean; reason?: string | null; number: number }) {
  const { source } = useRepo();
  const can = useCan();
  const act = useAction();
  const [asking, setAsking] = useState(false);
  const [why, setWhy] = useState('');
  if (!can.triage) return locked ? <Section title="Conversation"><span className="text-muted-foreground"><Oct name="lock" size={12} className="mr-1" />Locked{reason ? ` as ${reason}` : ''}</span></Section> : null;
  return (
    <Section title="Conversation">
      {locked ? (
        <Button className={cn(ghButton(), 'w-full')} isDisabled={act.busy} onPress={() => void act.run(() => source.unlock(number), 'unlock the conversation')}><Oct name="lock" />Unlock conversation</Button>
      ) : asking ? (
        <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { await source.lock(number, why || undefined); setAsking(false); }, 'lock the conversation'); }}>
          <label className="grid gap-1">
            <span className="font-semibold">Reason</span>
            <select value={why} onChange={(e) => setWhy(e.target.value)} className="box-border h-8 rounded-md border border-border bg-background px-1 font-sans text-caption text-foreground group-data-[phone=true]/gh:h-11">
              <option value="">No reason</option><option value="off-topic">Off-topic</option><option value="too heated">Too heated</option><option value="resolved">Resolved</option><option value="spam">Spam</option>
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setAsking(false)}>Cancel</Button>
            <Button type="submit" className={cn(ghButton(true), 'h-7 px-2 text-caption')} isDisabled={act.busy}>Lock</Button>
          </div>
        </form>
      ) : (
        <Button className={cn(ghButton(), 'w-full')} onPress={() => setAsking(true)}><Oct name="lock" />Lock conversation</Button>
      )}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2" />
    </Section>
  );
}

/** Beside the conversation when wide; a collapsible section above it otherwise. */
export function MetaColumn({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  const { ui } = useRepo();
  const [open, setOpen] = useState(false);
  if (ui.wide) return <aside aria-label="Details" className="w-[256px] shrink-0">{children}</aside>;
  return (
    <div className="mb-4 rounded-md border border-border">
      <Button aria-expanded={open} onPress={() => setOpen(!open)} className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-0 bg-muted px-3 text-left text-detail text-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary">
        <Oct name={open ? 'chevDown' : 'chevRight'} size={14} className="text-muted-foreground" />
        <b className="font-semibold">Details</b>
        <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">{summary}</span>
      </Button>
      {open ? <div className="border-t border-border px-3 pt-3">{children}</div> : null}
    </div>
  );
}

export { Counter };
