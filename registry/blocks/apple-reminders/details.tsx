/* The Details sheet (Credenza: a centered dialog on wide screens, a bottom tray on phones): title, notes and URL,
   status (docstream's task states), date and time with quick picks, flag, priority, list, and subtasks you can check
   off or add to. A task from a Markdown file keeps only what its line holds: the title, status and subtasks. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TASK_STATES } from '@brett_lamy/docstream/gitbook';
import { TASK_STATE_ICONS } from '@brett_lamy/docstream/tasks';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ListRow, ListSection } from '@/components/ui/list';
import { Segmented } from '@/components/ui/segmented';
import { useSplitView } from '@/components/ui/split-view';
import { Switch } from '@/components/ui/switch';
import { Icon, type IconName } from '@/lib/icon';
import { SYSTEM, dueLabel, stateOf, type Reminder } from './data';
import type { TaskState } from './markdown-tasks';
import { CheckCircle, ListIcon } from './reminder-row';
import { useReminders } from './store';

const DAYS = [{ id: '0', label: 'Today' }, { id: '1', label: 'Tomorrow' }, { id: '5', label: 'Weekend' }, { id: '7', label: 'Next Week' }];
const TIMES = ['9:00 AM', '12:00 PM', '5:00 PM', '8:00 PM'].map((t) => ({ id: t, label: t.replace(':00', '') }));
const PRIORITIES = ['None', 'Low', 'Medium', 'High'].map((p, i) => ({ id: String(i), label: p }));

const Tile = ({ glyph, color }: { glyph: IconName; color: string }) => (
  <span className="grid size-[29px] shrink-0 place-items-center rounded-[7px] text-white" style={{ background: color }}><Icon name={glyph} size={18} weight="semibold" /></span>
);
const field = 'w-full appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-foreground outline-none select-text placeholder:text-tertiary-foreground';
/** A row under a switch that springs open with it. */
const Reveal = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <div className={`grid transition-[grid-template-rows,opacity] duration-spring-tray ease-spring-tray ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
    <div className="min-h-0 overflow-hidden" inert={!open || undefined}><div className="bg-card px-4 pb-3">{children}</div></div>
  </div>
);

/** Status: every docstream task state, as in the checkbox's right-click menu. */
function StatusRow({ r }: { r: Reminder }) {
  const api = useReminders();
  const state = stateOf(r);
  const meta = TASK_STATES.find((s) => s.id === state)!;
  const Current = TASK_STATE_ICONS[state];
  return (
    <ListSection>
      <ListRow leading={<Tile glyph="checklist" color={SYSTEM.green} />} title="Status" divider={false}
        accessory={<DropdownMenu>
          <Button variant="ghost" size="sm" className="gap-1.5 text-primary"><Current aria-hidden="true" size={17} strokeWidth={1.8} />{meta.label.split(' · ')[0]}</Button>
          <DropdownMenuContent aria-label="Status" placement="bottom end" selectionMode="single" selectedKeys={[state]}
            onAction={(key) => api.setState(r.id, String(key) as TaskState)}>
            {TASK_STATES.map((s) => {
              const ItemIcon = TASK_STATE_ICONS[s.id];
              return <DropdownMenuItem key={s.id} id={s.id} textValue={s.label} icon={<ItemIcon aria-hidden="true" size={19} strokeWidth={1.8} />}>{s.label}</DropdownMenuItem>;
            })}
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
        <input className={`${field} text-body font-medium`} value={title} aria-label="Title" onChange={(e) => setTitle(e.target.value)}
          onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
        {r.tags?.length ? <div className="flex flex-wrap gap-x-2 text-subhead text-primary">{r.tags.map((t) => <span key={t}>#{t}</span>)}</div> : null}
      </div>
      <StatusRow r={r} />
      <ListSection>
        <ListRow leading={<ListIcon glyph={list?.glyph ?? 'checklist'} color={list?.color ?? SYSTEM.blue} size={29} />} title={list?.name ?? 'List'}
          subtitle={<span className="break-all">{r.source!.path} · line {r.source!.line + 1}</span>} divider={false} />
      </ListSection>
      {r.subtasks?.length ? (
        <ListSection title="Subtasks">
          <div className="flex flex-col bg-card">
            {r.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 shadow-hairline-b last:shadow-none">
                <CheckCircle size={22} done={!!s.done} state={stateOf(s)} color={list?.color ?? SYSTEM.blue} label={`Subtask “${s.title}”`}
                  onToggle={() => api.toggleSubtask(r.id, s.id)} onState={(state) => api.setState(s.id, state)} />
                <span className={s.done ? 'text-body text-muted-foreground' : 'text-body'}>{s.title}</span>
              </div>
            ))}
          </div>
        </ListSection>
      ) : null}
      <p className="mx-1 mb-4 text-footnote text-muted-foreground">Dates, flags, priority and notes aren’t stored in Markdown task lists.</p>
      <Button variant="secondary" size="pill" className="text-destructive" onPress={() => { api.openDetails(null); api.remove(r.id); }}>Delete from File</Button>
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
        <input className={`${field} text-body font-medium`} value={r.title} aria-label="Title" onChange={(e) => up({ title: e.target.value })} />
        <textarea className={`${field} min-h-[44px] resize-none text-subhead leading-[1.4]`} rows={2} placeholder="Notes" aria-label="Notes"
          value={r.notes ?? ''} onChange={(e) => up({ notes: e.target.value || undefined })} />
        <input className={`${field} text-subhead text-primary`} placeholder="URL" aria-label="URL" value={r.url ?? ''} onChange={(e) => up({ url: e.target.value || undefined })} />
      </div>

      <StatusRow r={r} />

      <ListSection>
        <ListRow leading={<Tile glyph="calendar" color={SYSTEM.red} />} title="Date" subtitle={r.due != null ? <span className="text-primary">{dueLabel({ due: r.due })}</span> : undefined}
          accessory={<Switch checked={r.due != null} onChange={(v) => up(v ? { due: 0 } : { due: undefined, time: undefined })} />} divider={r.due != null} />
        <Reveal open={r.due != null}>
          <Segmented aria-label="Due date" className="[&>*]:px-1.5" options={DAYS} value={String(r.due ?? '')} onChange={(d) => up({ due: Number(d) })} />
        </Reveal>
        <ListRow leading={<Tile glyph="clock" color={SYSTEM.blue} />} title="Time" subtitle={r.time ? <span className="text-primary">{r.time}</span> : undefined}
          accessory={<Switch checked={!!r.time} onChange={(v) => up(v ? { time: '9:00 AM', due: r.due ?? 0 } : { time: undefined })} />} divider={!!r.time} />
        <Reveal open={!!r.time}>
          <Segmented aria-label="Due time" className="[&>*]:px-1.5" options={TIMES} value={r.time ?? ''} onChange={(t) => up({ time: t })} />
        </Reveal>
      </ListSection>

      <ListSection>
        <ListRow leading={<Tile glyph="flag-fill" color={SYSTEM.orange} />} title="Flag" divider={false}
          accessory={<Switch checked={!!r.flagged} onChange={(v) => up({ flagged: v })} />} />
      </ListSection>

      <ListSection title="Priority">
        <div className="bg-card p-3">
          <Segmented aria-label="Priority" options={PRIORITIES} value={String(r.priority ?? 0)} onChange={(p) => up({ priority: Number(p) as Reminder['priority'] })} />
        </div>
      </ListSection>

      {list ? (
        <ListSection>
          <ListRow leading={<ListIcon glyph={list.glyph} color={list.color} size={29} />} title="List" trailing={<span className="text-muted-foreground">{list.name}</span>} divider={false} />
        </ListSection>
      ) : null}

      <ListSection title="Subtasks">
        <div className="flex flex-col bg-card">
          {(r.subtasks ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 shadow-hairline-b">
              <CheckCircle size={22} done={!!s.done} state={stateOf(s)} color={list?.color ?? SYSTEM.blue} label={`Subtask “${s.title}”`}
                onToggle={() => api.toggleSubtask(r.id, s.id)} onState={(state) => api.setState(s.id, state)} />
              <span className={s.done ? 'text-body text-muted-foreground' : 'text-body'}>{s.title}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-[22px] shrink-0 place-items-center rounded-full text-primary"><Icon name="plus" size={18} weight="bold" /></span>
            <input className={`${field} text-body`} placeholder="Add Subtask" aria-label="Add subtask" value={sub}
              onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }} onBlur={addSub} />
          </div>
        </div>
      </ListSection>

      <Button variant="secondary" size="pill" className="text-destructive" onPress={() => { api.openDetails(null); api.remove(r.id); }}>Delete Reminder</Button>
    </div>
  );
}

export function DetailsSheet() {
  const api = useReminders();
  const s = useSplitView();
  const r = api.items.find((x) => x.id === api.details);
  // Keep the last reminder while the sheet animates out.
  const last = useRef<Reminder | null>(null);
  if (r) last.current = r;
  return (
    <Credenza open={!!r} onClose={() => api.openDetails(null)} title="Details" compact={s.collapsed} view="details" className="bg-muted">
      {last.current ? <Body r={r ?? last.current} /> : null}
    </Credenza>
  );
}
