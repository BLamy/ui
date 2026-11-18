/* The open list: large colored title and count, the "N Completed · Clear / Show" bar, sections of reminders, an
   inline composer and the New Reminder button. Clearing the last open reminder bursts a small celebration. In the
   smart lists, each list's heading previews that list (ListPreview). */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Celebrate } from '@/components/ui/celebrate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { NumberMorph } from '@/components/ui/number-morph';
import { Button as SdkButton } from '@brett_lamy/ui/sdk/react/button';
import { SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewSidebarTrigger, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { Input } from '@brett_lamy/ui/sdk/react/input';
import { SYSTEM, type Reminder } from './data';
import { ListPreview, ReminderRow } from './reminder-row';
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
      <span className="mt-[11px] size-6 shrink-0 rounded-full shadow-[inset_0_0_0_1.6px_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))]" />
      <Input autoFocus value={text} placeholder="New Reminder" aria-label="New reminder"
        onValueChange={setText}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); }
          else if (e.key === 'Escape') onClose();
        }}
        onBlur={() => { if (text.trim()) onAdd(text.trim()); onClose(); }}
        className="min-w-0 flex-1 appearance-none border-0 bg-transparent py-[11px] pr-3 [font-family:inherit] text-body text-foreground caret-(--c) shadow-hairline-b outline-none select-text"
        style={{ '--c': color } as CSSProperties} />
    </div>
  );
}

export function ListView() {
  const api = useReminders();
  const s = useSplitView();
  const id = api.query && !s.collapsed ? 'search' : s.value.sidebar ?? 'today';
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
      <SplitViewHeader title={<span style={{ color: view.color }}>{view.title}</span>} largeTitle leading={<SplitViewSidebarTrigger />} backLabel="Lists"
        trailing={list ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="List options" className="size-9 text-primary" />}>
              <Icon name="ellipsis-circle" size={24} weight="light" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end">
              <DropdownMenuItem onSelect={() => api.setShowCompleted(list.id, !shown)} icon={<Icon name="check" size={20} />}>
                {shown ? 'Hide Completed' : 'Show Completed'}
              </DropdownMenuItem>
              {/* A file's completed tasks stay in the file. */}
              {list.file ? null : <>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive disabled={!view.completed} onSelect={() => api.clearCompleted(list.id)}>
                  {`Clear ${view.completed} Completed`}
                </DropdownMenuItem>
              </>}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null} />
      {/* The large title lines up with the reminders (centred, 760 wide) and leaves room for the count. */}
      <SplitViewContent className="[&>[data-slot=split-view-large-title]]:mx-auto [&>[data-slot=split-view-large-title]]:max-w-[760px] [&>[data-slot=split-view-large-title]]:pr-24 [&>[data-slot=split-view-large-title]]:pl-5">
        <div className="relative mx-auto max-w-[760px] pb-6">
          {id !== 'completed' ? (
            // The open count sits on the large title's line, on the trailing edge.
            <Celebrate fire={fire} count={16} spread={72} colors={[view.color, SYSTEM.yellow, SYSTEM.green, SYSTEM.pink]}
              className="absolute right-5 -top-[47px] text-[34px] leading-[1.15] font-semibold tabular-nums" style={{ color: view.color }}>
              <NumberMorph value={view.open} />
            </Celebrate>
          ) : null}

          {list && view.completed ? (
            <div className="mx-5 mt-1 flex items-center gap-2 py-1.5 text-subhead text-muted-foreground shadow-hairline-b">
              <span>{view.completed} Completed</span>
              {list.file ? null : <>
                <span aria-hidden="true">·</span>
                <SdkButton onClick={() => api.clearCompleted(list.id)} className="bl-btn cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-primary">Clear</SdkButton>
              </>}
              <SdkButton onClick={() => api.setShowCompleted(list.id, !shown)} className="bl-btn ml-auto cursor-pointer border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-primary">
                {shown ? 'Hide' : 'Show'}
              </SdkButton>
            </div>
          ) : null}

          {empty && !adding ? (
            <div className="grid place-items-center px-6 pt-24 pb-10 text-center animate-bl-fade-in">
              <div className="text-title font-semibold text-muted-foreground">
                {id === 'search' ? 'No Results' : view.completed || id === 'today' || id === 'flagged' ? 'All Done' : 'No Reminders'}
              </div>
              {id === 'search' ? null : <div className="mt-1 text-subhead text-tertiary-foreground">{view.completed ? `${view.completed} completed` : 'Tap New Reminder to add one.'}</div>}
            </div>
          ) : null}

          {view.groups.map((g, gi) => {
            // All, Flagged, Completed and search group by list: those headings are lists.
            const of = list ? undefined : api.lists.find((l) => l.id === g.key);
            return (
              <section key={g.key} className={cn(g.title && 'pt-4')}>
                {g.title ? <h2 className="m-0 px-5 pb-1 text-title font-bold tracking-[-.2px]" style={{ color: g.color }}>
                  {of ? <HoverCard>
                    <HoverCardTrigger render={<span />}>{g.title}</HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start"><ListPreview list={of} items={api.items} /></HoverCardContent>
                  </HoverCard> : g.title}
                </h2> : null}
                {g.items.map((r) => (
                  <ReminderRow key={r.id} r={r} leaving={view.leaving(r)} phone={s.collapsed}
                    tint={api.lists.find((l) => l.id === r.list)?.color ?? view.color} />
                ))}
                {adding && gi === view.groups.length - 1 ? <Composer color={view.color} onAdd={add} onClose={() => setAdding(false)} /> : null}
              </section>
            );
          })}
          {adding && !view.groups.length ? <Composer color={view.color} onAdd={add} onClose={() => setAdding(false)} /> : null}
        </div>
      </SplitViewContent>
      {canAdd ? (
        <div className="flex h-[54px] shrink-0 items-center px-4">
          <SdkButton onClick={() => setAdding(true)} style={{ color: view.color }}
            className="bl-btn flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 [font-family:inherit] text-body font-semibold transition-[scale] duration-spring-snappy ease-spring-snappy active:scale-95">
            <span className="grid size-[23px] place-items-center rounded-full text-white" style={{ background: view.color }}><Icon name="plus" size={15} sw={2.8} /></span>
            New Reminder
          </SdkButton>
        </div>
      ) : null}
    </SplitViewDetail>
  );
}
