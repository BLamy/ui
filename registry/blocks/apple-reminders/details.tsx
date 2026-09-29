/* The Details sheet (Credenza: a centered dialog on wide screens, a bottom tray on phones): title, notes and URL,
   date and time with quick picks, flag, priority, list, and subtasks you can check off or add to. */
import { useRef, useState, type ReactNode } from 'react';
import { Button, Credenza, Haptics, Icon, ListRow, ListSection, Segmented, Switch, useSplitView, type IconName } from '@brett_lamy/ui';
import { dueLabel, type Reminder } from './data';
import { CheckCircle, ListIcon } from './reminder-row';
import { useReminders } from './store';

const DAYS = [{ id: '0', label: 'Today' }, { id: '1', label: 'Tomorrow' }, { id: '5', label: 'Weekend' }, { id: '7', label: 'Next Week' }];
const TIMES = ['9:00 AM', '12:00 PM', '5:00 PM', '8:00 PM'].map((t) => ({ id: t, label: t.replace(':00', '') }));
const PRIORITIES = ['None', 'Low', 'Medium', 'High'].map((p, i) => ({ id: String(i), label: p }));

const Tile = ({ glyph, color }: { glyph: IconName; color: string }) => (
  <span className="grid size-[29px] shrink-0 place-items-center rounded-[7px] text-white" style={{ background: color }}><Icon name={glyph} size={18} weight="semibold" /></span>
);
const field = 'w-full appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-foreground outline-none select-text placeholder:text-bl-label3';
/** A row under a switch that springs open with it. */
const Reveal = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <div className={`grid transition-[grid-template-rows,opacity] duration-spring-tray ease-spring-tray ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
    <div className="min-h-0 overflow-hidden" inert={!open || undefined}><div className="bg-card px-4 pb-3">{children}</div></div>
  </div>
);

function Body({ r }: { r: Reminder }) {
  const api = useReminders();
  const up = (patch: Partial<Reminder>) => api.update(r.id, patch);
  const list = api.lists.find((l) => l.id === r.list);
  const [sub, setSub] = useState('');
  const addSub = () => {
    if (!sub.trim()) return;
    up({ subtasks: [...(r.subtasks ?? []), { id: `${r.id}-s${Date.now()}`, title: sub.trim() }] });
    setSub('');
    Haptics.impact('light');
  };
  return (
    <div className="bl-scroll max-h-[min(620px,calc(100vh-150px))] overflow-y-auto px-4 pt-2 pb-4">
      <div className="mb-[22px] flex flex-col gap-2 rounded-[12px] bg-card px-4 py-3">
        <input className={`${field} text-[17px] font-medium`} value={r.title} aria-label="Title" onChange={(e) => up({ title: e.target.value })} />
        <textarea className={`${field} min-h-[44px] resize-none text-[15px] leading-[1.4]`} rows={2} placeholder="Notes" aria-label="Notes"
          value={r.notes ?? ''} onChange={(e) => up({ notes: e.target.value || undefined })} />
        <input className={`${field} text-[15px] text-primary`} placeholder="URL" aria-label="URL" value={r.url ?? ''} onChange={(e) => up({ url: e.target.value || undefined })} />
      </div>

      <ListSection>
        <ListRow leading={<Tile glyph="calendar" color="#FF3B30" />} title="Date" subtitle={r.due != null ? <span className="text-primary">{dueLabel({ due: r.due })}</span> : undefined}
          accessory={<Switch checked={r.due != null} onChange={(v) => up(v ? { due: 0 } : { due: undefined, time: undefined })} />} divider={r.due != null} />
        <Reveal open={r.due != null}>
          <Segmented aria-label="Due date" className="[&>*]:px-1.5" options={DAYS} value={String(r.due ?? '')} onChange={(d) => up({ due: Number(d) })} />
        </Reveal>
        <ListRow leading={<Tile glyph="clock" color="#007AFF" />} title="Time" subtitle={r.time ? <span className="text-primary">{r.time}</span> : undefined}
          accessory={<Switch checked={!!r.time} onChange={(v) => up(v ? { time: '9:00 AM', due: r.due ?? 0 } : { time: undefined })} />} divider={!!r.time} />
        <Reveal open={!!r.time}>
          <Segmented aria-label="Due time" className="[&>*]:px-1.5" options={TIMES} value={r.time ?? ''} onChange={(t) => up({ time: t })} />
        </Reveal>
      </ListSection>

      <ListSection>
        <ListRow leading={<Tile glyph="flag-fill" color="#FF9500" />} title="Flag" divider={false}
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
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 shadow-[inset_0_-1px_0_var(--bl-sep)]">
              <CheckCircle size={22} done={!!s.done} color={list?.color ?? '#007AFF'} label={`Subtask “${s.title}”`} onToggle={() => api.toggleSubtask(r.id, s.id)} />
              <span className={s.done ? 'text-[17px] text-muted-foreground' : 'text-[17px]'}>{s.title}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="grid size-[22px] shrink-0 place-items-center rounded-full text-primary"><Icon name="plus" size={18} weight="bold" /></span>
            <input className={`${field} text-[17px]`} placeholder="Add Subtask" aria-label="Add subtask" value={sub}
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
