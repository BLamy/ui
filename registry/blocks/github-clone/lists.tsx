/* Shared pieces of the Issues and Pull requests lists: search toolbar, Open/Closed toggle, filter menus, rows. */
import { type ReactNode } from 'react';
import { Button, SearchField, cn } from '@brett_lamy/ui';
import { LABELS, type Label } from './data';
import { AvatarStack, Counter, LabelChip, Oct, StateIcon, ghButton, type OctName, type StateKind, type Layout, type Nav } from './parts';

export function ListToolbar({ ui, nav, q, setQ, placeholder, newLabel }: { ui: Layout; nav: Nav; q: string; setQ: (q: string) => void; placeholder: string; newLabel: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchField value={q} onChange={setQ} placeholder={placeholder} aria-label="Search"
        className="h-8 min-w-[200px] flex-1 rounded-md border border-bl-sep bg-bl-bg2 px-2 py-0 text-[14px] [&_input]:text-[14px] [&_svg]:size-4" />
      <div className="flex">
        <Button className={cn(ghButton(), 'rounded-r-none')} onPress={nav.labels}><Oct name="tag" className="text-bl-label2" />Labels{!ui.phone ? <Counter>{Object.keys(LABELS).length}</Counter> : null}</Button>
        <Button className={cn(ghButton(), '-ml-px rounded-l-none')}><Oct name="history" className="text-bl-label2" />Milestones</Button>
      </div>
      <Button className={ghButton(true)}>{newLabel}</Button>
    </div>
  );
}

export function StateToggle({ value, onChange, open, closed, closedIcon }: {
  value: 'open' | 'closed'; onChange: (v: 'open' | 'closed') => void; open: number; closed: number; closedIcon: OctName;
}) {
  const item = (v: 'open' | 'closed', icon: OctName, n: number, label: string) => (
    <button type="button" onClick={() => onChange(v)} aria-pressed={value === v}
      className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-[14px] hover:bg-bl-fill',
        value === v ? 'font-semibold text-bl-label' : 'text-bl-label2')}>
      <Oct name={icon} />{n} {label}
    </button>
  );
  return <div className="flex items-center gap-1">{item('open', 'issue', open, 'Open')}{item('closed', closedIcon, closed, 'Closed')}</div>;
}

export function FilterMenus({ ui, names, onLabel }: { ui: Layout; names: string[]; onLabel: () => void }) {
  if (ui.phone) return null;
  const shown = ui.wide ? names : names.slice(-2);
  return (
    <div className="ml-auto flex items-center text-bl-label2">
      {shown.map((n) => (
        <button key={n} type="button" onClick={n === 'Labels' ? onLabel : undefined}
          className="flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 py-1 text-[14px] text-bl-label2 hover:bg-bl-fill hover:text-bl-label">
          {n}<Oct name="chevDown" size={12} />
        </button>
      ))}
    </div>
  );
}

export function ItemRow({ ui, state, title, labels, meta, assignees, comments, status, onOpen }: {
  ui: Layout; state: StateKind; title: string; labels: Label[]; meta: ReactNode; assignees: { login: string; f: string; l: string }[];
  comments: number; status?: ReactNode; onOpen?: () => void;
}) {
  return (
    <div className="flex gap-2 border-t border-bl-sep px-4 py-2 first:border-t-0 hover:bg-bl-bg2">
      <StateIcon state={state} className="mt-[3px]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <button type="button" onClick={onOpen}
            className="cursor-pointer border-0 bg-transparent p-0 text-left text-[16px] leading-6 font-semibold text-bl-label hover:text-bl-tint">
            {title}
          </button>
          {status}
          {labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}
        </div>
        <div className="mt-1 text-[12px] text-bl-label2">{meta}</div>
      </div>
      {!ui.phone ? (
        <div className="flex w-[120px] shrink-0 items-start justify-end gap-4 pt-1">
          {assignees.length ? <AvatarStack users={assignees} /> : null}
          {comments ? <span className="flex items-center gap-1 text-[12px] text-bl-label2 hover:text-bl-tint"><Oct name="comment" />{comments}</span> : null}
        </div>
      ) : comments ? (
        <span className="flex shrink-0 items-center gap-1 pt-1 text-[12px] text-bl-label2"><Oct name="comment" size={14} />{comments}</span>
      ) : null}
    </div>
  );
}
