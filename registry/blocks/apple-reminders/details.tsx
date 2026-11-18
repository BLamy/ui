/* The Details sheet (a Dialog: a centered dialog on wide screens, a bottom tray on phones): title, notes and URL,
   status (docstream's task states), date and time with quick picks, flag, priority, list, and subtasks you can check
   off or add to. A task from a Markdown file keeps only what its line holds: the title, status and subtasks. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TASK_STATES } from '@brett_lamy/ui/docstream/gitbook';
import { TASK_STATE_ICONS } from '@brett_lamy/ui/docstream/tasks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogView } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ListRow, ListSection } from '@/components/ui/list';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Icon, type IconName } from '@/lib/icon';
import { Collapsible, CollapsiblePanel } from '@brett_lamy/ui/sdk/react/collapsible';
import { Input } from '@brett_lamy/ui/sdk/react/input';
import { Textarea } from '@brett_lamy/ui/sdk/react/textarea';
import { SYSTEM, dueLabel, stateOf, type Reminder } from './data';
import type { TaskState } from './markdown-tasks';
import { CheckCircle, ListIcon } from './reminder-row';
import { useReminders } from './store';

const DAYS = [{ value: '0', label: 'Today' }, { value: '1', label: 'Tomorrow' }, { value: '5', label: 'Weekend' }, { value: '7', label: 'Next Week' }];
const TIMES = ['9:00 AM', '12:00 PM', '5:00 PM', '8:00 PM'].map((t) => ({ value: t, label: t.replace(':00', '') }));
const PRIORITIES = ['None', 'Low', 'Medium', 'High'].map((p, i) => ({ value: String(i), label: p }));

const Tile = ({ glyph, color }: { glyph: IconName; color: string }) => (
  <span className="grid size-[29px] shrink-0 place-items-center rounded-[7px] text-white" style={{ background: color }}><Icon name={glyph} size={18} weight="semibold" /></span>
);
const field = 'w-full appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-foreground outline-none select-text placeholder:text-tertiary-foreground';
/** A row under a switch that springs open with it: a Collapsible the switch drives (it has no trigger of its own). */
const Reveal = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <Collapsible open={open}>
    <CollapsiblePanel className="h-(--collapsible-panel-height) overflow-clip transition-[height,opacity] duration-spring-tray ease-spring-tray data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 motion-reduce:transition-none">
      <div className="bg-card px-4 pb-3">{children}</div>
    </CollapsiblePanel>
  </Collapsible>
);

/** Status: every docstream task state, as in the checkbox's right-click menu. */
function StatusRow({ r }: { r: Reminder }) {
  const api = useReminders();
  const state = stateOf(r);
  const meta = TASK_STATES.find((s) => s.id === state)!;
  return (
    <ListSection>
      <ListRow icon={<Tile glyph="checklist" color={SYSTEM.green} />} title="Status" divider={false}
        accessory={<DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="gap-1.5 text-primary" />}>
            {/* The menu is named by its trigger: "Status: Pending". */}
            <span className="sr-only">Status: </span>
            <Icon name={TASK_STATE_ICONS[state]} size={17} sw={1.8} />{meta.label.split(' · ')[0]}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuRadioGroup value={state} onValueChange={(value) => api.setState(r.id, value as TaskState)}>
              {TASK_STATES.map((s) => {
                return <DropdownMenuRadioItem key={s.id} closeOnSelect value={s.id} label={s.label} icon={<Icon name={TASK_STATE_ICONS[s.id]} size={19} sw={1.8} />}>{s.label}</DropdownMenuRadioItem>;
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>} />
    </ListSection>
  );
}

/** A file's task: the title is written back when you're done typing (Return or leaving the field). */
function FileBody({ r }: { r: Reminder }) {
  const api = useReminders();
  const list = api.lists.find((l) => l.id === r.list);
  const [title, setTitle] = useState(r.title);
  useEffect(() => setTitle(r.title), [r.title]);
  const commit = () => { if (title.trim() && title !== r.title) api.update(r.id, { title }); };
  return (
    <div className="bl-scroll max-h-[min(620px,calc(100vh-150px))] overflow-y-auto px-4 pt-2 pb-4">
      <div className="mb-[22px] flex flex-col gap-2 rounded-panel bg-card px-4 py-3">
        <Input className={`${field} text-body font-medium`} value={title} aria-label="Title" onValueChange={setTitle}
          onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
        {r.tags?.length ? <div className="flex flex-wrap gap-x-2 text-subhead text-primary">{r.tags.map((t) => <span key={t}>#{t}</span>)}</div> : null}
      </div>
      <StatusRow r={r} />
      <ListSection>
        <ListRow icon={<ListIcon glyph={list?.glyph ?? 'checklist'} tint={list?.color ?? SYSTEM.blue} size={29} />} title={list?.name ?? 'List'}
          description={<span className="break-all">{r.source!.path} · line {r.source!.line + 1}</span>} divider={false} />
      </ListSection>
      {r.subtasks?.length ? (
        <ListSection title="Subtasks">
          <div className="flex flex-col bg-card">
            {r.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 shadow-hairline-b last:shadow-none">
                <CheckCircle size={22} done={!!s.done} state={stateOf(s)} tint={list?.color ?? SYSTEM.blue} label={`Subtask “${s.title}”`}
                  onToggle={() => api.toggleSubtask(r.id, s.id)} onState={(state) => api.setState(s.id, state)} />
                <span className={s.done ? 'text-body text-muted-foreground' : 'text-body'}>{s.title}</span>
              </div>
            ))}
          </div>
        </ListSection>
      ) : null}
      <p className="mx-1 mb-4 text-footnote text-muted-foreground">Dates, flags, priority and notes aren’t stored in Markdown task lists.</p>
      <Button variant="secondary" size="pill" className="text-destructive" onClick={() => { api.openDetails(null); api.remove(r.id); }}>Delete from File</Button>
    </div>
  );
}

function Body({ r }: { r: Reminder }) {
  if (r.source) return <FileBody r={r} />;
  return <LocalBody r={r} />;
}

function LocalBody({ r }: { r: Reminder }) {
  const api = useReminders();
  const up = (patch: Partial<Reminder>) => api.update(r.id, patch);
  const list = api.lists.find((l) => l.id === r.list);
  const [sub, setSub] = useState('');
  const addSub = () => {
    if (!sub.trim()) return;
    up({ subtasks: [...(r.subtasks ?? []), { id: `${r.id}-s${Date.now()}`, title: sub.trim() }] });
    setSub('');
  };
  return (
    <div className="bl-scroll max-h-[min(620px,calc(100vh-150px))] overflow-y-auto px-4 pt-2 pb-4">
      <div className="mb-[22px] flex flex-col gap-2 rounded-panel bg-card px-4 py-3">
        <Input className={`${field} text-body font-medium`} value={r.title} aria-label="Title" onValueChange={(title) => up({ title })} />
        <Textarea className={`${field} min-h-[44px] resize-none text-subhead leading-[1.4]`} rows={2} placeholder="Notes" aria-label="Notes"
          value={r.notes ?? ''} onValueChange={(notes) => up({ notes: notes || undefined })} />
        <Input className={`${field} text-subhead text-primary`} placeholder="URL" aria-label="URL" value={r.url ?? ''} onValueChange={(url) => up({ url: url || undefined })} />
      </div>

      <StatusRow r={r} />

      <ListSection>
        <ListRow icon={<Tile glyph="calendar" color={SYSTEM.red} />} title="Date" description={r.due != null ? <span className="text-primary">{dueLabel({ due: r.due })}</span> : undefined}
          accessory={<Switch checked={r.due != null} onCheckedChange={(v) => up(v ? { due: 0 } : { due: undefined, time: undefined })} />} divider={r.due != null} />
        <Reveal open={r.due != null}>
          <Segmented aria-label="Due date" size="sm" value={r.due != null ? String(r.due) : null} onValueChange={(d) => { if (d) up({ due: Number(d) }); }}>
            {DAYS.map((d) => <SegmentedItem key={d.value} value={d.value}>{d.label}</SegmentedItem>)}
          </Segmented>
        </Reveal>
        <ListRow icon={<Tile glyph="clock" color={SYSTEM.blue} />} title="Time" description={r.time ? <span className="text-primary">{r.time}</span> : undefined}
          accessory={<Switch checked={!!r.time} onCheckedChange={(v) => up(v ? { time: '9:00 AM', due: r.due ?? 0 } : { time: undefined })} />} divider={!!r.time} />
        <Reveal open={!!r.time}>
          <Segmented aria-label="Due time" size="sm" value={r.time ?? null} onValueChange={(t) => { if (t) up({ time: t }); }}>
            {TIMES.map((t) => <SegmentedItem key={t.value} value={t.value}>{t.label}</SegmentedItem>)}
          </Segmented>
        </Reveal>
      </ListSection>

      <ListSection>
        <ListRow icon={<Tile glyph="flag-fill" color={SYSTEM.orange} />} title="Flag" divider={false}
          accessory={<Switch checked={!!r.flagged} onCheckedChange={(v) => up({ flagged: v })} />} />
      </ListSection>

      <ListSection title="Priority">
        <div className="bg-card p-3">
          <Segmented aria-label="Priority" value={String(r.priority ?? 0)} onValueChange={(p) => { if (p) up({ priority: Number(p) as Reminder['priority'] }); }}>
            {PRIORITIES.map((p) => <SegmentedItem key={p.value} value={p.value}>{p.label}</SegmentedItem>)}
          </Segmented>
        </div>
      </ListSection>

      {list ? (
        <ListSection>
          <ListRow icon={<ListIcon glyph={list.glyph} tint={list.color} size={29} />} title="List" trailing={<span className="text-muted-foreground">{list.name}</span>} divider={false} />
        </ListSection>
      ) : null}

      <ListSection title="Subtasks">
        <div className="flex flex-col bg-card">
          {(r.subtasks ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 shadow-hairline-b">
              <CheckCircle size={22} done={!!s.done} state={stateOf(s)} tint={list?.color ?? SYSTEM.blue} label={`Subtask “${s.title}”`}
                onToggle={() => api.toggleSubtask(r.id, s.id)} onState={(state) => api.setState(s.id, state)} />
              <span className={s.done ? 'text-body text-muted-foreground' : 'text-body'}>{s.title}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-[22px] shrink-0 place-items-center rounded-full text-primary"><Icon name="plus" size={18} weight="bold" /></span>
            <Input className={`${field} text-body`} placeholder="Add Subtask" aria-label="Add subtask" value={sub}
              onValueChange={setSub} onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }} onBlur={addSub} />
          </div>
        </div>
      </ListSection>

      <Button variant="secondary" size="pill" className="text-destructive" onClick={() => { api.openDetails(null); api.remove(r.id); }}>Delete Reminder</Button>
    </div>
  );
}

export function DetailsSheet() {
  const api = useReminders();
  const r = api.items.find((x) => x.id === api.details);
  // Keep the last reminder while the sheet animates out.
  const last = useRef<Reminder | null>(null);
  if (r) last.current = r;
  return (
    // A tray while the split view is compact, a dialog beside its columns otherwise (the Dialog's `"auto"`).
    <Dialog open={!!r} onOpenChange={(open) => { if (!open) api.openDetails(null); }}>
      <DialogBackdrop />
      <DialogContent variant="tray" className="bg-muted">
        <DialogHeader variant="bar"><DialogTitle>Details</DialogTitle><DialogClose /></DialogHeader>
        <DialogView>{last.current ? <Body r={r ?? last.current} /> : null}</DialogView>
      </DialogContent>
    </Dialog>
  );
}
