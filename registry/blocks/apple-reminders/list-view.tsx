/* The open list: large colored title and count, the "N Completed · Clear / Show" bar, sections of reminders, an
   inline composer and the New Reminder button. Clearing the last open reminder bursts a small celebration. */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  Button, Celebrate, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, Haptics, NumberMorph,
  SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewToggle, cn, useSplitView,
} from '@brett_lamy/ui';
import type { Reminder } from './data';
import { Glyph } from './glyphs';
import { ReminderRow } from './reminder-row';
import { useReminders } from './store';
import { buildView, type View } from './views';

/** Fires when a list's open count drops to zero by completing (not by switching lists). */
function useClearedBurst(view: View) {
  const [fire, setFire] = useState(0);
  const prev = useRef({ id: view.id, open: view.open });
  useEffect(() => {
    const p = prev.current;
    if (p.id === view.id && p.open > 0 && view.open === 0 && view.id !== 'completed' && view.id !== 'search') {
      setFire((f) => f + 1);
      Haptics.notification('success');
    }
    prev.current = { id: view.id, open: view.open };
  }, [view.id, view.open]);
  return fire;
}

/** New reminder, typed in place. Enter adds and keeps the field open for the next one; Esc or an empty blur closes. */
function Composer({ color, onAdd, onClose }: { color: string; onAdd: (title: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  return (
    <div className="flex items-start gap-3 pl-4 animate-bl-fade-in">
      <span className="mt-[11px] size-6 shrink-0 rounded-full shadow-[inset_0_0_0_1.6px_var(--bl-label3)]" />
      <input autoFocus value={text} placeholder="New Reminder" aria-label="New reminder"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); Haptics.impact('light'); }
          else if (e.key === 'Escape') onClose();
        }}
        onBlur={() => { if (text.trim()) onAdd(text.trim()); onClose(); }}
        className="min-w-0 flex-1 appearance-none border-0 bg-transparent py-[11px] pr-3 [font-family:inherit] text-[17px] text-foreground caret-(--c) shadow-[inset_0_-1px_0_var(--bl-sep)] outline-none select-text"
        style={{ '--c': color } as CSSProperties} />
    </div>
  );
}

export function ListView() {
  const api = useReminders();
  const s = useSplitView();
  const id = api.query && !s.collapsed ? 'search' : s.selection.sidebar ?? 'today';
  const view = buildView(id, api.items, api.lists, api.recent, api.showCompleted, api.query);
  const fire = useClearedBurst(view);
  const [adding, setAdding] = useState(false);
  useEffect(() => setAdding(false), [id]);

  const list = view.list;
  const shown = list ? !!api.showCompleted[list.id] : false;
  const canAdd = id !== 'completed' && id !== 'search';
  const add = (title: string) => {
    const base: Omit<Reminder, 'id'> = { list: list?.id ?? 'reminders', title };
    if (list?.sections?.length) base.section = list.sections[list.sections.length - 1];
    if (id === 'today' || id === 'scheduled') base.due = 0;
    if (id === 'flagged') base.flagged = true;
    api.add(base);
  };
  const empty = view.groups.every((g) => g.items.length === 0);

  return (
    <SplitViewDetail aria-label={view.title}>
      <SplitViewHeader leading={<SplitViewToggle />} backLabel="Lists"
        trailing={list ? (
          <DropdownMenu>
            <Button variant="ghost" size="icon" aria-label="List options" className="size-9 text-primary"><Glyph name="ellipsis" size={24} sw={1.7} /></Button>
            <DropdownMenuContent aria-label="List options" placement="bottom end">
              <DropdownMenuItem onAction={() => api.setShowCompleted(list.id, !shown)} icon={<Glyph name="check" size={20} />}>
                {shown ? 'Hide Completed' : 'Show Completed'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" isDisabled={!view.completed} onAction={() => api.clearCompleted(list.id)}>
                {`Clear ${view.completed} Completed`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null} />
      <SplitViewContent>
        <div className="mx-auto max-w-[760px] pb-6">
          <div className="flex items-end justify-between gap-4 px-5 pt-3 pb-1" style={{ color: view.color }}>
            <h1 className="m-0 min-w-0 truncate text-[34px] leading-[1.15] font-bold tracking-[-.5px]">{view.title}</h1>
            {id !== 'completed' ? (
              <span className="relative isolate text-[34px] leading-[1.15] font-semibold tabular-nums">
                <NumberMorph value={view.open} />
                <Celebrate fire={fire} count={16} spread={72} colors={[view.color, '#FFCC00', '#34C759', '#FF2D55']} />
              </span>
            ) : null}
          </div>

          {list && view.completed ? (
            <div className="mx-5 mt-1 flex items-center gap-2 py-1.5 text-[15px] text-muted-foreground shadow-[inset_0_-1px_0_var(--bl-sep)]">
              <span>{view.completed} Completed</span>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => api.clearCompleted(list.id)} className="bl-btn cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-[15px] text-primary">Clear</button>
              <button type="button" onClick={() => api.setShowCompleted(list.id, !shown)} className="bl-btn ml-auto cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-[15px] text-primary">
                {shown ? 'Hide' : 'Show'}
              </button>
            </div>
          ) : null}

          {empty && !adding ? (
            <div className="grid place-items-center px-6 pt-24 pb-10 text-center animate-bl-fade-in">
              <div className="text-[20px] font-semibold text-muted-foreground">
                {id === 'search' ? 'No Results' : view.completed || id === 'today' || id === 'flagged' ? 'All Done' : 'No Reminders'}
              </div>
              {id === 'search' ? null : <div className="mt-1 text-[15px] text-bl-label3">{view.completed ? `${view.completed} completed` : 'Tap New Reminder to add one.'}</div>}
            </div>
          ) : null}

          {view.groups.map((g, gi) => (
            <section key={g.key} className={cn(g.title && 'pt-4')}>
              {g.title ? <h2 className="m-0 px-5 pb-1 text-[20px] font-bold tracking-[-.2px]" style={{ color: g.color }}>{g.title}</h2> : null}
              {g.items.map((r) => (
                <ReminderRow key={r.id} r={r} leaving={view.leaving(r)} phone={s.collapsed}
                  color={api.lists.find((l) => l.id === r.list)?.color ?? view.color} />
              ))}
              {adding && gi === view.groups.length - 1 ? <Composer color={view.color} onAdd={add} onClose={() => setAdding(false)} /> : null}
            </section>
          ))}
          {adding && !view.groups.length ? <Composer color={view.color} onAdd={add} onClose={() => setAdding(false)} /> : null}
        </div>
      </SplitViewContent>
      {canAdd ? (
        <div className="flex h-[54px] shrink-0 items-center px-4">
          <button type="button" onClick={() => setAdding(true)} style={{ color: view.color }}
            className="bl-btn flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 [font-family:inherit] text-[17px] font-semibold transition-[scale] duration-spring-snappy ease-spring-snappy active:scale-95">
            <span className="grid size-[23px] place-items-center rounded-full text-white" style={{ background: view.color }}><Glyph name="plus" size={15} sw={2.8} /></span>
            New Reminder
          </button>
        </div>
      ) : null}
    </SplitViewDetail>
  );
}
