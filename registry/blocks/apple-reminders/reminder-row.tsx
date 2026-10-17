/* A reminder: the completion circle, title with priority marks, notes, due date (red when overdue), link, tags,
   flag, subtasks that fold open, and the info button that opens the details sheet. Also the list icon. */
import { useState, type CSSProperties } from 'react';
import { TASK_STATES } from '@brett_lamy/docstream/gitbook';
import { TASK_STATE_ICONS } from '@brett_lamy/docstream/tasks';
import { ContextMenu, ContextMenuContent } from '@/components/ui/context-menu';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Chevron } from '@/components/ui/icon-swap';
import { Icon, type IconName } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { SYSTEM, dueLabel, stateOf, type Reminder } from './data';
import type { TaskState } from './markdown-tasks';
import { useReminders } from './store';

/** A list's icon: a colored circle with a white glyph. */
export function ListIcon({ glyph, color, size = 30, className }: { glyph: IconName; color: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center rounded-full bg-(--list-color) text-white', className)}
      style={{ width: size, height: size, '--list-color': color } as CSSProperties}>
      <Icon name={glyph} size={size * 0.58} weight="semibold" />
    </span>
  );
}

/** The circle: a ring that fills with the list color on the bouncy spring when completed. The other docstream task
    states (in progress, blocked, parked, …) show their icon in the list color. With `onState`, right-click (or
    long-press, or the menu key) opens every state. */
export function CheckCircle({ done, state = done ? 'verified' : 'pending', color, label, size = 24, onToggle, onState }: {
  done: boolean; state?: TaskState; color: string; label: string; size?: number; onToggle: () => void; onState?: (state: TaskState) => void;
}) {
  const meta = TASK_STATES.find((s) => s.id === state) ?? TASK_STATES[0]!;
  const marked = state !== 'pending' && state !== 'verified';
  const StateIcon = TASK_STATE_ICONS[state];
  const circle = (
    <button type="button" role="checkbox" aria-checked={marked ? 'mixed' : done} aria-label={`${label} (${meta.label})`} onClick={onToggle}
      aria-haspopup={onState ? 'menu' : undefined} title={onState ? `${meta.label} — right-click for every state` : undefined}
      className={cn('bl-btn relative grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[scale,box-shadow] duration-spring-snappy ease-spring-snappy active:scale-[.86] motion-reduce:transition-none',
        marked ? '' : done ? 'shadow-[inset_0_0_0_1.6px_var(--list-color)]' : 'shadow-[inset_0_0_0_1.6px_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))]')}
      style={{ width: size, height: size, '--list-color': color } as CSSProperties}>
      <span aria-hidden="true" className={cn('rounded-full bg-(--list-color) transition-[scale,opacity] duration-spring-bouncy ease-spring-bouncy motion-reduce:transition-none', done ? 'scale-100 opacity-100' : 'scale-0 opacity-0')}
        style={{ width: size - 9, height: size - 9 }} />
      {marked ? <StateIcon aria-hidden="true" data-state-icon={state} className="absolute text-(--list-color)" size={size - 2} strokeWidth={2} /> : null}
    </button>
  );
  if (!onState) return circle;
  return (
    <ContextMenu className="grid shrink-0">
      {circle}
      <ContextMenuContent aria-label="Task state" selectionMode="single" selectedKeys={[state]}
        onAction={(key) => onState(String(key) as TaskState)}>
        {TASK_STATES.map((s) => {
          const ItemIcon = TASK_STATE_ICONS[s.id];
          return <DropdownMenuItem key={s.id} id={s.id} textValue={s.label} icon={<ItemIcon aria-hidden="true" size={19} strokeWidth={1.8} />}>{s.label}</DropdownMenuItem>;
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function ReminderRow({ r, color, leaving, phone }: { r: Reminder; color: string; leaving?: boolean; phone?: boolean }) {
  const api = useReminders();
  const [open, setOpen] = useState(false);
  const subs = r.subtasks ?? [];
  const subsDone = subs.filter((s) => s.done).length;
  const overdue = !r.done && r.due != null && r.due < 0;
  return (
    // Leaving rows fold their height to zero on the tray spring instead of vanishing.
    <div data-slot="reminder" className={cn('grid transition-[grid-template-rows,opacity] duration-spring-tray ease-spring-tray motion-reduce:transition-none',
      leaving ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100')}>
      <div className="min-h-0 overflow-hidden">
        <div className="group/row flex items-start gap-3 pl-4">
          <div className="pt-[11px]">
            <CheckCircle done={!!r.done} state={stateOf(r)} color={color} label={r.done ? `Mark “${r.title}” incomplete` : `Complete “${r.title}”`}
              onToggle={() => api.toggle(r.id)} onState={(state) => api.setState(r.id, state)} />
          </div>
          <div className="min-w-0 flex-1 py-[11px] pr-3 shadow-hairline-b" onDoubleClick={() => api.openDetails(r.id)}>
            <div className="flex items-start gap-2">
              <div className={cn('min-w-0 flex-1 text-body leading-[1.3] transition-colors duration-200', r.done && 'text-muted-foreground', (r.state === 'cancelled' || r.state === 'refuted') && 'line-through')}>
                {r.priority ? <span className="mr-1 font-semibold" style={{ color: r.done ? undefined : color }}>{'!'.repeat(r.priority)}</span> : null}
                {r.title}
              </div>
              {r.flagged ? <Icon name="flag-fill" size={16} className="mt-0.5" style={{ color: SYSTEM.orange }} /> : null}
              <button type="button" aria-label={`Details for “${r.title}”`} onClick={() => api.openDetails(r.id)}
                className={cn('bl-btn -my-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-primary transition-opacity duration-150',
                  phone ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100')}>
                <Icon name="info" size={22} weight="light" />
              </button>
            </div>
            {r.source ? <div className="mt-0.5 truncate text-footnote text-muted-foreground" title={`${r.source.path}, line ${r.source.line + 1}`}>
              {r.state && r.state !== 'pending' && r.state !== 'verified' ? `${TASK_STATES.find((t) => t.id === r.state)?.label} · ` : ''}{r.source.path.split('/').slice(1).join('/')}
            </div> : null}
            {r.notes ? <div className="mt-0.5 line-clamp-2 text-subhead leading-[1.35] text-muted-foreground">{r.notes}</div> : null}
            {r.due != null || r.tags?.length ? (
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-subhead">
                {r.due != null ? <span className={overdue ? 'text-destructive' : 'text-muted-foreground'}>{dueLabel(r)}</span> : null}
                {r.tags?.map((t) => <span key={t} className={r.done ? 'text-muted-foreground' : 'text-primary'}>#{t}</span>)}
              </div>
            ) : null}
            {r.url ? (
              <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-footnote text-muted-foreground">
                <Icon name="link" size={13} weight="semibold" /><span className="truncate">{r.url}</span>
              </span>
            ) : null}
            {subs.length ? (
              <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
                className="bl-btn mt-1 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-muted-foreground">
                {subsDone} of {subs.length} subtasks
                <Chevron direction={open ? 'down' : 'right'} size={13} sw={2.6} />
              </button>
            ) : null}
            <div className={cn('grid transition-[grid-template-rows,opacity] duration-spring-tray ease-spring-tray', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
                <div className="flex flex-col gap-2.5 pt-2.5">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <CheckCircle size={20} done={!!s.done} state={stateOf(s)} color={color} label={`Subtask “${s.title}”`}
                        onToggle={() => api.toggleSubtask(r.id, s.id)} onState={(state) => api.setState(s.id, state)} />
                      <span className={cn('text-callout', s.done && 'text-muted-foreground')}>{s.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
