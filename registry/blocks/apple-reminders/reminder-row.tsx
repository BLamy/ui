/* A reminder: the completion circle, title with priority marks, notes, due date (red when overdue), link, tags,
   flag, subtasks that fold open, and the info button that opens the details sheet. Also the list icon. */
import { useState, type CSSProperties } from 'react';
import { Chevron, Icon, cn, type IconName } from '@brett_lamy/ui';
import { dueLabel, type Reminder } from './data';
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

/** The circle: a ring that fills with the list color on the bouncy spring when completed. */
export function CheckCircle({ done, color, label, size = 24, onToggle }: { done: boolean; color: string; label: string; size?: number; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label} onClick={onToggle}
      className="bl-btn relative grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 transition-[scale,box-shadow] duration-spring-snappy ease-spring-snappy active:scale-[.86] motion-reduce:transition-none"
      style={{ width: size, height: size, boxShadow: `inset 0 0 0 1.6px ${done ? color : 'var(--tertiary-foreground)'}` }}>
      <span aria-hidden="true" className={cn('rounded-full transition-[scale,opacity] duration-spring-bouncy ease-spring-bouncy motion-reduce:transition-none', done ? 'scale-100 opacity-100' : 'scale-0 opacity-0')}
        style={{ width: size - 9, height: size - 9, background: color }} />
    </button>
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
            <CheckCircle done={!!r.done} color={color} label={r.done ? `Mark “${r.title}” incomplete` : `Complete “${r.title}”`} onToggle={() => api.toggle(r.id)} />
          </div>
          <div className="min-w-0 flex-1 py-[11px] pr-3 shadow-[inset_0_-1px_0_var(--border)]" onDoubleClick={() => api.openDetails(r.id)}>
            <div className="flex items-start gap-2">
              <div className={cn('min-w-0 flex-1 text-[17px] leading-[1.3] transition-colors duration-200', r.done && 'text-muted-foreground')}>
                {r.priority ? <span className="mr-1 font-semibold" style={{ color: r.done ? undefined : color }}>{'!'.repeat(r.priority)}</span> : null}
                {r.title}
              </div>
              {r.flagged ? <Icon name="flag-fill" size={16} className="mt-0.5 text-[#FF9500]" /> : null}
              <button type="button" aria-label={`Details for “${r.title}”`} onClick={() => api.openDetails(r.id)}
                className={cn('bl-btn -my-0.5 grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-primary transition-opacity duration-150',
                  phone ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100')}>
                <Icon name="info" size={22} weight="light" />
              </button>
            </div>
            {r.notes ? <div className="mt-0.5 line-clamp-2 text-[15px] leading-[1.35] text-muted-foreground">{r.notes}</div> : null}
            {r.due != null || r.tags?.length ? (
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[15px]">
                {r.due != null ? <span className={overdue ? 'text-destructive' : 'text-muted-foreground'}>{dueLabel(r)}</span> : null}
                {r.tags?.map((t) => <span key={t} className={r.done ? 'text-muted-foreground' : 'text-primary'}>#{t}</span>)}
              </div>
            ) : null}
            {r.url ? (
              <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-[8px] bg-secondary px-2 py-1 text-[13px] text-muted-foreground">
                <Icon name="link" size={13} weight="semibold" /><span className="truncate">{r.url}</span>
              </span>
            ) : null}
            {subs.length ? (
              <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
                className="bl-btn mt-1 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 [font-family:inherit] text-[15px] text-muted-foreground">
                {subsDone} of {subs.length} subtasks
                <Chevron direction={open ? 'down' : 'right'} size={13} sw={2.6} />
              </button>
            ) : null}
            <div className={cn('grid transition-[grid-template-rows,opacity] duration-spring-tray ease-spring-tray', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="min-h-0 overflow-hidden" inert={!open || undefined}>
                <div className="flex flex-col gap-2.5 pt-2.5">
                  {subs.map((s) => (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <CheckCircle size={20} done={!!s.done} color={color} label={`Subtask “${s.title}”`} onToggle={() => api.toggleSubtask(r.id, s.id)} />
                      <span className={cn('text-[16px]', s.done && 'text-muted-foreground')}>{s.title}</span>
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
