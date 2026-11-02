/* Shared pieces of the Issues and Pull requests lists: search toolbar, Open/Closed toggle, filter menus, rows. A row's
   title previews the issue or pull request in a hover card, and its assignees' avatars preview each person. */
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { HoverCard, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { UserCard } from './cards';
import type { Label, User } from './data';
import { AvatarStack, Counter, LabelChip, Oct, StateIcon, ghButton, type OctName, type StateKind, type Layout, type Nav } from './parts';
import { useLoad, useRepo } from './repo-context';

export function ListToolbar({ ui, nav, q, setQ, placeholder, newLabel }: { ui: Layout; nav: Nav; q: string; setQ: (q: string) => void; placeholder: string; newLabel: string }) {
  const { source } = useRepo();
  const labels = useLoad(source.id + ':labels', source.labels).data;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchField value={q} onChange={setQ} placeholder={placeholder} aria-label="Search"
        className="h-8 min-w-[200px] flex-1 rounded-md border border-border bg-muted px-2 py-0 text-detail [&_input]:text-detail [&_svg]:size-4" />
      <div className="flex">
        <Button className={cn(ghButton(), 'rounded-r-none')} onPress={nav.labels}><Oct name="tag" className="text-muted-foreground" />Labels{!ui.phone && labels ? <Counter>{labels.length}</Counter> : null}</Button>
        <Button className={cn(ghButton(), '-ml-px rounded-l-none')}><Oct name="history" className="text-muted-foreground" />Milestones</Button>
      </div>
      <Button className={ghButton(true)}>{newLabel}</Button>
    </div>
  );
}

export function StateToggle({ value, onChange, open, closed, closedIcon }: {
  value: 'open' | 'closed'; onChange: (v: 'open' | 'closed') => void; open?: number; closed?: number; closedIcon: OctName;
}) {
  /** Counts arrive separately from the rows (live: a search total); until then just the label. */
  const item = (v: 'open' | 'closed', icon: OctName, n: number | undefined, label: string) => (
    <button type="button" onClick={() => onChange(v)} aria-pressed={value === v}
      className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-detail hover:bg-secondary',
        value === v ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
      <Oct name={icon} />{n != null ? n.toLocaleString('en-US') + ' ' : ''}{label}
    </button>
  );
  return <div className="flex items-center gap-1">{item('open', 'issue', open, 'Open')}{item('closed', closedIcon, closed, 'Closed')}</div>;
}

export function FilterMenus({ ui, names, onLabel }: { ui: Layout; names: string[]; onLabel: () => void }) {
  if (ui.phone) return null;
  const shown = ui.wide ? names : names.slice(-2);
  return (
    <div className="ml-auto flex items-center text-muted-foreground">
      {shown.map((n) => (
        <button key={n} type="button" onClick={n === 'Labels' ? onLabel : undefined}
          className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-detail text-muted-foreground hover:bg-secondary hover:text-foreground">
          {n}<Oct name="chevDown" size={12} />
        </button>
      ))}
    </div>
  );
}

export function ItemRow({ ui, state, title, labels, meta, assignees, comments, status, preview, onOpen }: {
  ui: Layout; state: StateKind; title: string; labels: Label[]; meta: ReactNode; assignees: User[];
  comments: number; status?: ReactNode;
  /** The issue / pull request's hover card (cards.tsx), shown from the title. */
  preview?: ReactNode;
  onOpen?: () => void;
}) {
  const open = (
    <button type="button" onClick={onOpen}
      className="cursor-pointer border-0 bg-transparent p-0 text-left text-callout leading-6 font-semibold text-foreground hover:text-primary">
      {title}
    </button>
  );
  return (
    <div className="flex gap-2 border-t border-border px-4 py-2 first:border-t-0 hover:bg-muted">
      <StateIcon state={state} className="mt-[3px]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {preview ? <HoverCardTrigger>{open}<HoverCard placement="bottom start" className="w-80">{preview}</HoverCard></HoverCardTrigger> : open}
          {status}
          {labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}
        </div>
        <div className="mt-1 text-caption text-muted-foreground">{meta}</div>
      </div>
      {!ui.phone ? (
        <div className="flex w-[120px] shrink-0 items-start justify-end gap-4 pt-1">
          {assignees.length ? <AvatarStack users={assignees} card={(u) => <UserCard user={u} />} /> : null}
          {comments ? <span className="flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"><Oct name="comment" />{comments}</span> : null}
        </div>
      ) : comments ? (
        <span className="flex shrink-0 items-center gap-1 pt-1 text-caption text-muted-foreground"><Oct name="comment" size={14} />{comments}</span>
      ) : null}
    </div>
  );
}
