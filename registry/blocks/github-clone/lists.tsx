/* Shared pieces of the Issues and Pull requests lists. The query box is the truth, as on GitHub: `is:open label:bug
   sort:updated-desc` goes to GitHub's search as typed, every filter menu just edits it, and the page number lives in the
   route, so filters compose, can be shared as a URL, and reach every page. */
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Label, Milestone, User } from './data';
import { labelOf } from './github-api';
import { AvatarStack, Counter, LabelChip, Oct, StateIcon, ghButton, type OctName, type StateKind } from './parts';
import { Menu } from './pickers';
import { SelectMenu } from './pickers';
import { GhLink } from './links';
import type { Route } from './route';
import { useLoad, useNav, useRepo } from './repo-context';
import type { Paged } from './source';

/* ── Query editing ── */

/** Quotes a value when it needs it. */
const quoted = (v: string) => (/\s/.test(v) ? `"${v}"` : v);

/** Values of a qualifier in a query (`label:bug label:"help wanted"` → bug, help wanted). */
export function qualifierValues(q: string, key: string): string[] {
  const out: string[] = [];
  for (const m of q.matchAll(new RegExp(`(?:^|\\s)${key}:(?:"([^"]*)"|(\\S+))`, 'g'))) out.push(m[1] ?? m[2]);
  return out;
}
/** A query without any `key:` qualifier. */
export function withoutQualifier(q: string, key: string): string {
  return q.replace(new RegExp(`(?:^|\\s)${key}:(?:"[^"]*"|\\S+)`, 'g'), '').trim();
}
/** A query with `key:` set to exactly these values. */
export function setQualifier(q: string, key: string, values: string[]): string {
  const rest = withoutQualifier(q, key);
  return [rest, ...values.map((v) => `${key}:${quoted(v)}`)].filter(Boolean).join(' ');
}
/** Which state a query asks for. */
export function queryState(q: string): 'open' | 'closed' | 'merged' | 'all' {
  if (/(?:^|\s)is:merged\b/.test(q)) return 'merged';
  const m = /(?:^|\s)(?:is|state):(open|closed)\b/.exec(q);
  return m ? (m[1] as 'open' | 'closed') : 'all';
}
/** A query asking for one state. */
export function setQueryState(q: string, state: 'open' | 'closed' | 'merged'): string {
  const rest = q.replace(/(?:^|\s)(?:is|state):(?:open|closed|merged)\b/g, '').trim();
  return `is:${state} ${rest}`.trim();
}

export const ISSUE_SORTS = [
  ['created-desc', 'Newest'], ['created-asc', 'Oldest'], ['comments-desc', 'Most commented'], ['comments-asc', 'Least commented'], ['updated-desc', 'Recently updated'], ['updated-asc', 'Least recently updated'], ['reactions-desc', 'Most reactions'],
] as const;

/* ── Toolbar ── */

export function ListToolbar({ query, onQuery, placeholder, children, canCreate, newLabel, onNew }: {
  query: string; onQuery: (q: string) => void; placeholder: string; children?: ReactNode; canCreate: boolean; newLabel: string; onNew: () => void;
}) {
  const { source, ui } = useRepo();
  const nav = useNav();
  const labels = useLoad(source.id + ':labels', source.labels).data;
  const milestones = useLoad(source.id + ':milestones:open', () => source.milestones('open')).data;
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form role="search" className="flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-border bg-muted px-2 group-data-[phone=true]/gh:h-11"
        onSubmit={(e) => { e.preventDefault(); onQuery(text.trim()); }}>
        <Oct name="search" className="shrink-0 text-muted-foreground" />
        <input aria-label={placeholder} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} spellCheck={false} autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-caption text-foreground outline-none select-text placeholder:text-muted-foreground" />
        {query !== text ? <button type="submit" className="cursor-pointer border-0 bg-transparent p-0 text-caption font-semibold text-primary">Search</button> : null}
      </form>
      <div className="flex">
        <Button className={cn(ghButton(), 'rounded-r-none')} onPress={() => nav.go({ s: 'labels' })}><Oct name="tag" className="text-muted-foreground" />Labels{!ui.phone && labels ? <Counter>{labels.length}</Counter> : null}</Button>
        <Button className={cn(ghButton(), '-ml-px rounded-l-none')} onPress={() => nav.go({ s: 'milestones' })}><Oct name="milestone" className="text-muted-foreground" />Milestones{!ui.phone && milestones ? <Counter>{milestones.length}</Counter> : null}</Button>
      </div>
      {children}
      {canCreate ? <Button className={ghButton(true)} onPress={onNew}>{newLabel}</Button> : null}
    </div>
  );
}

export function StateToggle({ value, onChange, open, closed, closedIcon }: {
  value: string; onChange: (v: 'open' | 'closed') => void; open?: number; closed?: number; closedIcon: OctName;
}) {
  const item = (v: 'open' | 'closed', icon: OctName, n: number | undefined, label: string) => (
    <Button onPress={() => onChange(v)} aria-pressed={value === v}
      className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-detail outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary group-data-[phone=true]/gh:min-h-11',
        value === v ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
      <Oct name={icon} />{n != null ? n.toLocaleString('en-US') + ' ' : ''}{label}
    </Button>
  );
  return <div className="flex items-center gap-1">{item('open', 'issue', open, 'Open')}{item('closed', closedIcon, closed, 'Closed')}</div>;
}

const filterButton = 'flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-detail text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary data-hovered:text-foreground data-pressed:bg-secondary group-data-[phone=true]/gh:min-h-11';

/** Author, Labels, Milestones, Assignee, Sort (and Reviews on pull requests): each one edits the query. */
export function FilterMenus({ query, onQuery, reviews }: { query: string; onQuery: (q: string) => void; reviews?: boolean }) {
  const { source } = useRepo();
  const labels = useLoad(source.id + ':labels', source.labels).data ?? [];
  const milestones = useLoad(source.id + ':milestones:open', () => source.milestones('open')).data ?? [];
  const people = useLoad(source.id + ':assignable', source.assignable).data ?? [];
  const userItems = people.map((u) => ({ id: u.login, label: u.login, keywords: `${u.f} ${u.l}`, leading: <Avatar c={u} src={u.avatar} size={20} /> }));
  const label = (name: string, count: number) => <>{name}{count ? <Counter className="ml-0.5">{count}</Counter> : null}<Oct name="chevDown" size={12} /></>;
  const assigneeNone = /(?:^|\s)no:assignee\b/.test(query);
  const noLabel = /(?:^|\s)no:label\b/.test(query);
  const sort = qualifierValues(query, 'sort')[0] ?? 'created-desc';
  const review = qualifierValues(query, 'review')[0];
  return (
    <div className="ml-auto flex flex-wrap items-center justify-end text-muted-foreground">
      <SelectMenu title="Filter by author" trigger={label('Author', qualifierValues(query, 'author').length)} triggerClassName={filterButton}
        items={[...userItems]} selected={qualifierValues(query, 'author')} empty="No one matches" filterPlaceholder="Filter users"
        onApply={(ids) => onQuery(setQualifier(query, 'author', ids))} clearLabel="Everyone" />
      <SelectMenu title="Filter by label" multiple trigger={label('Labels', qualifierValues(query, 'label').length + (noLabel ? 1 : 0))} triggerClassName={filterButton} filterPlaceholder="Filter labels"
        items={labels.map((l) => ({ id: l.name, label: l.name, description: l.description, leading: <span className="size-3.5 shrink-0 rounded-full" style={{ background: l.color }} /> }))}
        selected={qualifierValues(query, 'label')} onApply={(ids) => onQuery(setQualifier(query, 'label', ids))}
        footer={(_q, close) => (
          <Button className="w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-caption text-primary outline-none data-hovered:bg-accent" onPress={() => { onQuery(noLabel ? query.replace(/(?:^|\s)no:label\b/, '').trim() : `${withoutQualifier(query, 'label')} no:label`.trim()); close(); }}>
            {noLabel ? 'Include labeled items' : 'Only items without a label'}
          </Button>
        )} />
      <SelectMenu title="Filter by milestone" trigger={label('Milestones', qualifierValues(query, 'milestone').length)} triggerClassName={filterButton} filterPlaceholder="Filter milestones"
        items={milestones.map((m) => ({ id: m.title, label: m.title, description: m.dueWhen ? `Due ${m.dueWhen}` : undefined }))} selected={qualifierValues(query, 'milestone')} clearLabel="Any milestone"
        onApply={(ids) => onQuery(setQualifier(query, 'milestone', ids))} empty="No milestones" />
      {reviews ? (
        <Menu label="Filter by review" triggerClassName={filterButton} trigger={label('Reviews', review ? 1 : 0)} placement="bottom end" entries={[
          { id: 'any', label: 'Any review state', selected: !review, onAction: () => onQuery(withoutQualifier(query, 'review')) },
          { id: 'none', label: 'No reviews', selected: review === 'none', onAction: () => onQuery(setQualifier(query, 'review', ['none'])) },
          { id: 'required', label: 'Review required', selected: review === 'required', onAction: () => onQuery(setQualifier(query, 'review', ['required'])) },
          { id: 'approved', label: 'Approved', selected: review === 'approved', onAction: () => onQuery(setQualifier(query, 'review', ['approved'])) },
          { id: 'changes', label: 'Changes requested', selected: review === 'changes_requested', onAction: () => onQuery(setQualifier(query, 'review', ['changes_requested'])) },
        ]} />
      ) : null}
      <SelectMenu title="Filter by assignee" trigger={label('Assignee', qualifierValues(query, 'assignee').length + (assigneeNone ? 1 : 0))} triggerClassName={filterButton} filterPlaceholder="Filter users" empty="No one matches"
        items={userItems} selected={qualifierValues(query, 'assignee')} clearLabel="Anyone"
        onApply={(ids) => onQuery(setQualifier(query.replace(/(?:^|\s)no:assignee\b/, '').trim(), 'assignee', ids))}
        footer={(_q, close) => (
          <Button className="w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-caption text-primary outline-none data-hovered:bg-accent" onPress={() => { onQuery(assigneeNone ? query.replace(/(?:^|\s)no:assignee\b/, '').trim() : `${withoutQualifier(query, 'assignee')} no:assignee`.trim()); close(); }}>
            {assigneeNone ? 'Include assigned items' : 'Only unassigned items'}
          </Button>
        )} />
      <Menu label="Sort" triggerClassName={filterButton} trigger={<>Sort<Oct name="chevDown" size={12} /></>} placement="bottom end"
        entries={ISSUE_SORTS.map(([id, text]) => ({ id, label: text, selected: sort === id, onAction: () => onQuery(id === 'created-desc' ? withoutQualifier(query, 'sort') : setQualifier(query, 'sort', [id])) }))} />
    </div>
  );
}

/** Filters in play, each removable, and a way back to the plain list. */
export function ActiveFilters({ query, base, onQuery, labels }: { query: string; base: string; onQuery: (q: string) => void; labels: Label[] }) {
  const chosen = qualifierValues(query, 'label');
  if (query.trim() === base.trim()) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-muted-foreground">
      {chosen.length ? <>Labels {chosen.map((l) => (
        <Button key={l} aria-label={`Remove label filter ${l}`} className="cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary" onPress={() => onQuery(setQualifier(query, 'label', chosen.filter((x) => x !== l)))}>
          <LabelChip label={labels.find((x) => x.name === l) ?? labelOf(l)} dark={false} />
        </Button>
      ))}</> : null}
      <Button className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-detail text-muted-foreground outline-none data-hovered:text-primary data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:min-h-11" onPress={() => onQuery(base)}>
        <Oct name="x" size={14} />Clear current search query, filters, and sorts
      </Button>
    </div>
  );
}

/* ── Rows ── */

export function ItemRow({ state, title, to, labels, meta, assignees, comments, status, onLabel, stateText }: {
  state: StateKind; title: string; to: Route; labels: Label[]; meta: ReactNode; assignees: User[]; comments: number; status?: ReactNode; onLabel?: (l: string) => void; stateText: string;
}) {
  const { ui } = useRepo();
  const nav = useNav();
  return (
    <div className="flex gap-2 border-t border-border px-4 py-2 first:border-t-0 hover:bg-muted group-data-[phone=true]/gh:py-3">
      <span className="contents"><StateIcon state={state} className="mt-[3px]" /><span className="sr-only">{stateText}</span></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <GhLink to={to} className="text-callout leading-6 font-semibold text-foreground no-underline hover:text-primary group-data-[phone=true]/gh:after:absolute group-data-[phone=true]/gh:after:inset-0">{title}</GhLink>
          {status}
          {labels.map((l) => (
            onLabel
              ? <Button key={l.name} aria-label={`Filter by label ${l.name}`} className="relative z-1 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary" onPress={() => onLabel(l.name)}><LabelChip label={l} dark={ui.dark} /></Button>
              : <LabelChip key={l.name} label={l} dark={ui.dark} />
          ))}
        </div>
        <div className="mt-1 text-caption text-muted-foreground">{meta}</div>
      </div>
      {!ui.phone ? (
        <div className="flex w-[120px] shrink-0 items-start justify-end gap-4 pt-1">
          {assignees.length ? <AvatarStack users={assignees} /> : null}
          {comments ? <a href={nav.url(to)} onClick={(e) => { e.preventDefault(); nav.go(to); }} aria-label={`${comments} comments`} className="flex items-center gap-1 text-caption text-muted-foreground no-underline hover:text-primary"><Oct name="comment" />{comments}</a> : null}
        </div>
      ) : comments ? (
        <span className="flex shrink-0 items-center gap-1 pt-1 text-caption text-muted-foreground"><Oct name="comment" size={14} />{comments}<span className="sr-only">comments</span></span>
      ) : null}
    </div>
  );
}

/** Previous, the pages around this one, Next. */
export function Pagination<T>({ data, go, className }: { data: Paged<T>; go: (page: number) => void; className?: string }) {
  if (!data.hasNext && !data.hasPrev) return null;
  const last = data.lastPage ?? (data.hasNext ? data.page + 1 : data.page);
  const pages = [...new Set([1, data.page - 1, data.page, data.page + 1, last])].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const button = 'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent bg-transparent px-2 text-detail text-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:border-border data-disabled:cursor-default data-disabled:text-muted-foreground group-data-[phone=true]/gh:h-11 group-data-[phone=true]/gh:min-w-11';
  return (
    <nav aria-label="Pagination" className={cn('mt-4 flex flex-wrap items-center justify-center gap-1', className)}>
      <Button className={button} isDisabled={!data.hasPrev} onPress={() => go(data.page - 1)}><Oct name="chevLeft" size={14} />Previous</Button>
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i && p - pages[i - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
          <Button aria-current={p === data.page ? 'page' : undefined} aria-label={`Page ${p}`} className={cn(button, p === data.page && 'bg-primary font-semibold text-white')} onPress={() => go(p)}>{p}</Button>
        </span>
      ))}
      <Button className={button} isDisabled={!data.hasNext} onPress={() => go(data.page + 1)}>Next<Oct name="chevRight" size={14} /></Button>
    </nav>
  );
}

/** Who an item is by, as a link back to the list filtered to them. */
export function ByAuthor({ user, onPick }: { user: User; onPick: (login: string) => void }) {
  return (
    <Button className="relative z-1 cursor-pointer border-0 bg-transparent p-0 text-caption text-muted-foreground outline-none data-hovered:text-primary data-focus-visible:ring-2 data-focus-visible:ring-primary" aria-label={`Filter by author ${user.login}`} onPress={() => onPick(user.login)}>{user.login}</Button>
  );
}

export type { Milestone };
