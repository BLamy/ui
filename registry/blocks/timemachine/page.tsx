/* Time Machine — every session of this desktop, recorded and kept, to watch again. The macOS block records each page
   load with rrweb as append-only streams in localStorage (see `@/lib/session-recorder`); this app lists them by day and
   plays any one in a ReplayPreview. Sessions stay in this browser unless Cloud sync is turned on, which mirrors them
   live to a Durable Streams server (Rivet) so another device can watch too.
   The app marks itself `rr-block rr-ignore`: rrweb records an empty placeholder where it is, and no input inside it,
   so the recorder never records a replay of itself replaying. */
import { useEffect, useMemo, useState } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { clearSessions, storageUsage, useSessionCloud, useSessions, type SessionInfo } from '@/lib/session-recorder';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { CloudPanel } from './cloud';
import { SessionDetail } from './detail';
import { bytes, count, dayLabel, duration, timeLabel } from './format';

/** Time Machine's accent: its clock's green. */
const TM_TINT = { light: '#1E9E4A', dark: '#30D158' } as const;

export default function TimeMachine() {
  const dark = useAppearance() === 'dark';
  const [ref, width] = useContainerWidth<HTMLDivElement>(900);
  const sessions = useSessions();
  const [picked, setPicked] = useState<string | null>(null);
  const wide = width >= 640;
  // The newest session is selected to start with (wide); a pick that has gone (deleted) falls back to it.
  const selected = sessions.find((s) => s.id === picked) ?? (wide ? sessions[0] : undefined) ?? null;

  return (
    // rr-block: recorded as an empty box. rr-ignore: no input events recorded. Together: never recorded recursively.
    <BLProvider tint={TM_TINT[dark ? 'dark' : 'light']} className="rr-block rr-ignore">
      <div ref={ref} data-slot="timemachine" className="flex h-full w-full bg-background">
        {wide || !selected ? (
          <Sidebar sessions={sessions} selected={selected?.id ?? null} onPick={setPicked} full={!wide} />
        ) : null}
        {wide || selected ? (
          <main className="min-w-0 flex-1">
            {selected ? (
              <div className="flex h-full flex-col">
                {wide ? null : (
                  <PlainButton onPress={() => setPicked(null)} className="flex h-10 shrink-0 cursor-pointer items-center gap-0.5 border-0 border-b border-border bg-card pr-3 pl-2 text-detail font-medium text-primary">
                    <Icon name="chevron-left" size={20} sw={2.2} />Sessions
                  </PlainButton>
                )}
                <div className="min-h-0 flex-1"><SessionDetail key={selected.id} session={selected} onDeleted={() => setPicked(null)} /></div>
              </div>
            ) : (
              <Empty />
            )}
          </main>
        ) : null}
      </div>
    </BLProvider>
  );
}

function Empty() {
  return (
    <div className="grid h-full place-items-center p-8 text-center text-muted-foreground">
      <div>
        <Icon name="clock" size={40} sw={1.4} className="mx-auto mb-3 text-tertiary-foreground" />
        <div className="text-callout font-semibold text-foreground">No sessions yet</div>
        <div className="mt-1 max-w-64 text-footnote">Every time this desktop opens it starts a recording. Keep it open for a few seconds and this session appears here.</div>
      </div>
    </div>
  );
}

function Sidebar({ sessions, selected, onPick, full }: { sessions: SessionInfo[]; selected: string | null; onPick: (id: string) => void; full: boolean }) {
  const { settings, status } = useSessionCloud();
  // Re-read storage use as sessions change.
  const usage = useMemo(() => storageUsage(), [sessions]);
  const pct = Math.min(100, Math.round((usage.used / usage.quota) * 100));
  const groups = useMemo(() => {
    const out: { day: string; items: SessionInfo[] }[] = [];
    for (const s of sessions) {
      const day = dayLabel(s.startedAt);
      (out.find((g) => g.day === day) ?? out[out.push({ day, items: [] }) - 1]).items.push(s);
    }
    return out;
  }, [sessions]);
  // Re-label "Today" when midnight passes, and live sessions' running time.
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(id); }, []);

  return (
    <aside className={cn('flex shrink-0 flex-col border-r border-border bg-muted', full ? 'w-full border-r-0' : 'w-[300px]')}>
      <header className="flex h-toolbar shrink-0 items-center gap-2 px-4">
        <span className="text-callout font-semibold">Sessions</span>
        <span className="text-footnote text-muted-foreground tabular-nums">{sessions.length}</span>
        <span className="flex-1" />
        <PopoverTrigger>
          <PlainButton aria-label="Where sessions are stored" title={settings.enabled ? `Cloud sync: ${status.state}` : 'Private: this browser only'} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-footnote font-medium text-muted-foreground hover:bg-secondary">
            <Icon name={settings.enabled ? 'cloud' : 'lock'} size={16} sw={1.8} />
            {settings.enabled ? (status.state === 'syncing' ? 'Syncing' : status.state === 'error' ? 'Error' : status.state === 'offline' ? 'Offline' : 'Synced') : 'Private'}
          </PlainButton>
          <PopoverContent placement="bottom end" aria-label="Storage" className="w-[320px]"><CloudPanel /></PopoverContent>
        </PopoverTrigger>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <h3 className="m-0 px-2 pt-3 pb-1 text-caption font-semibold tracking-wide text-muted-foreground uppercase">{g.day}</h3>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {g.items.map((s) => <Row key={s.id} s={s} active={s.id === selected} onPick={() => onPick(s.id)} />)}
            </ul>
          </section>
        ))}
        {!sessions.length ? <p className="m-0 px-2 py-8 text-center text-footnote text-muted-foreground">Nothing recorded yet.</p> : null}
      </div>

      <footer className="flex shrink-0 flex-col gap-1.5 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>{bytes(usage.used)} in this browser</span>
          {sessions.some((s) => !s.live) ? (
            <PlainButton onPress={() => { if (confirm('Delete every past session from this browser?')) void clearSessions(); }} className="cursor-pointer border-0 bg-transparent p-0 text-caption font-medium text-primary">Clear All…</PlainButton>
          ) : null}
        </div>
        <div role="img" aria-label={`${pct}% of browser storage used`} className="h-1 overflow-hidden rounded-full bg-secondary-strong">
          <div className={cn('h-full rounded-full', pct > 85 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.max(pct, usage.used ? 2 : 0)}%` }} />
        </div>
      </footer>
    </aside>
  );
}

function Row({ s, active, onPick }: { s: SessionInfo; active: boolean; onPick: () => void }) {
  const span = s.endedAt ? s.endedAt - s.startedAt : s.live ? Date.now() - s.startedAt : null;
  return (
    <li>
      <PlainButton
        onPress={onPick}
        aria-current={active || undefined}
        className={cn('flex w-full cursor-pointer items-center gap-3 rounded-ctl border-0 px-2.5 py-2 text-left', active ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground hover:bg-secondary')}
      >
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', active ? 'bg-white/20' : 'bg-secondary-strong text-muted-foreground')}>
          <Icon name={s.live ? 'circle-fill' : 'clock'} size={s.live ? 11 : 17} sw={1.8} className={s.live && !active ? 'animate-pulse text-destructive' : undefined} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-detail font-semibold">{timeLabel(s.startedAt)}</span>
          <span className={cn('block truncate text-caption', active ? 'text-white/80' : 'text-muted-foreground')}>
            {s.live ? 'Recording now' : [span !== null ? duration(span) : null, s.events ? `${count(s.events)} events` : null].filter(Boolean).join(' · ') || 'Session'}
          </span>
        </span>
        {!s.local ? <Icon name="cloud" size={15} sw={1.8} className={active ? 'text-white/80' : 'text-muted-foreground'} /> : null}
      </PlainButton>
    </li>
  );
}
