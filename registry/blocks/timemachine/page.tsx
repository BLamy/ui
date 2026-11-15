/* Time Machine — every session of this desktop, recorded and kept, to watch again. The macOS block records each page
   load with rrweb as append-only streams in localStorage (see `@/lib/session-recorder`); this app lists them by day and
   plays any one in a ReplayPreview. Sessions stay in this browser unless Cloud sync is turned on, which mirrors them
   live to a Durable Streams server (Rivet) so another device can watch too.
   The app marks itself `rr-block rr-ignore`: rrweb records an empty placeholder where it is, and no input inside it,
   so the recorder never records a replay of itself replaying. Resting on a session in the sidebar previews it in a hover
   card (detail.tsx's SessionPeek): its last frame, its page and what happened, before you open it. */
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/dialog';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { SplitView, SplitViewDetail, SplitViewItem, SplitViewSidebar, useSplitViewBack, type SplitViewColumn } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { clearSessions, storageUsage, useSessionCloud, useSessions, type SessionInfo } from '@/lib/session-recorder';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Meter, MeterIndicator, MeterTrack } from '@ui-sdk/react/meter';
import { CloudPanel } from './cloud';
import { SessionDetail, SessionPeek } from './detail';
import { bytes, count, dayLabel, duration, timeLabel } from './format';

/** Time Machine's accent: its clock's green. */
const TM_TINT = { light: '#1E9E4A', dark: '#30D158' } as const;

export default function TimeMachine() {
  const dark = useAppearance() === 'dark';
  const sessions = useSessions();
  const [picked, setPicked] = useState<string | null>(null);
  // A SplitView: sidebar and detail tiled unless the box is compact; compact, picking pushes the detail, and back,
  // Escape or a swipe from the leading edge pop it. The column on top is held here so a deletion can pop it too.
  const [column, setColumn] = useState<SplitViewColumn | null>('sidebar');
  // The newest session is selected to start with; a pick that has gone (deleted) falls back to it.
  const selected = sessions.find((s) => s.id === picked) ?? sessions[0] ?? null;

  return (
    // rr-block: recorded as an empty box. rr-ignore: no input events recorded. Together: never recorded recursively.
    <BLProvider tint={TM_TINT[dark ? 'dark' : 'light']} className="rr-block rr-ignore">
      <SplitView
        aria-label="Time Machine" sidebarBehavior="tile" defaultSidebarOpen={{ medium: true }}
        value={{ sidebar: selected?.id ?? null }} onValueChange={(next) => setPicked(next.sidebar ?? null)}
        compactColumn={column} onCompactColumnChange={(next) => setColumn(next)}
      >
        <SplitViewSidebar width={300} resizable={false} aria-label="Sessions" className="bg-muted">
          <Sidebar sessions={sessions} />
        </SplitViewSidebar>
        <SplitViewDetail aria-label="Session">
          {selected ? (
            <div className="flex h-full flex-col">
              <BackRow />
              <div className="min-h-0 flex-1"><SessionDetail key={selected.id} session={selected} onDeleted={() => { setPicked(null); setColumn('sidebar'); }} /></div>
            </div>
          ) : (
            <Empty />
          )}
        </SplitViewDetail>
      </SplitView>
    </BLProvider>
  );
}

/** The detail's way back to the list while the split view is collapsed (the SplitView's own back: the same as
    Escape and the edge swipe). Nothing while the columns are side by side. */
function BackRow() {
  const back = useSplitViewBack();
  if (!back) return null;
  return (
    <SdkButton onClick={back.back} aria-label={`Back to ${back.title}`} className="flex h-10 shrink-0 cursor-pointer items-center gap-0.5 border-0 border-b border-border bg-card pr-3 pl-2 text-detail font-medium text-primary">
      <Icon name="chevron-left" size={20} sw={2.2} />{back.title}
    </SdkButton>
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

function Sidebar({ sessions }: { sessions: SessionInfo[] }) {
  const { settings, status } = useSessionCloud();
  // The detail's back button is labelled with this column's title.
  useSplitViewBack('Sessions');
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
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-toolbar shrink-0 items-center gap-2 px-4">
        <span className="text-callout font-semibold">Sessions</span>
        <span className="text-footnote text-muted-foreground tabular-nums">{sessions.length}</span>
        <span className="flex-1" />
        <Popover>
          <PopoverTrigger
            aria-label="Where sessions are stored" title={settings.enabled ? `Cloud sync: ${status.state}` : 'Private: this browser only'}
            render={<SdkButton className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-footnote font-medium text-muted-foreground hover:bg-secondary" />}
          >
            <Icon name={settings.enabled ? 'cloud' : 'lock'} size={16} sw={1.8} />
            {settings.enabled ? (status.state === 'syncing' ? 'Syncing' : status.state === 'error' ? 'Error' : status.state === 'offline' ? 'Offline' : 'Synced') : 'Private'}
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-[320px]">
            <PopoverTitle className="sr-only">Storage</PopoverTitle>
            <CloudPanel />
          </PopoverContent>
        </Popover>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <h3 className="m-0 px-2 pt-3 pb-1 text-caption font-semibold tracking-wide text-muted-foreground uppercase">{g.day}</h3>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {g.items.map((s) => <Row key={s.id} s={s} />)}
            </ul>
          </section>
        ))}
        {!sessions.length ? <EmptyState size="sm" title="Nothing recorded yet." /> : null}
      </div>
      <footer className="flex shrink-0 flex-col gap-1.5 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-caption text-muted-foreground">
          <span>{bytes(usage.used)} in this browser</span>
          {sessions.some((s) => !s.live) ? (
            <AlertDialog>
              <AlertDialogTrigger render={<SdkButton className="cursor-pointer border-0 bg-transparent p-0 text-caption font-medium text-primary" />}>Clear All…</AlertDialogTrigger>
              <AlertDialogBackdrop />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete every past session?</AlertDialogTitle>
                  <AlertDialogDescription>Past sessions are removed from this browser; the one recording now is kept.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
                  <AlertDialogClose variant="destructive" value="confirm" action={() => clearSessions()}>Delete All</AlertDialogClose>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
        <Meter value={pct} aria-label="Browser storage">
          <MeterTrack className="h-1 overflow-hidden rounded-full bg-secondary-strong">
            {/* Warns past 85%, and never shrinks out of sight while anything is stored. */}
            <MeterIndicator className={cn('h-full rounded-full', pct > 85 ? 'bg-warning' : 'bg-primary', usage.used > 0 && 'min-w-[2%]')} />
          </MeterTrack>
        </Meter>
      </footer>
    </div>
  );
}

/** A session in the list: a SplitViewItem (selecting it shows it in the detail), previewed in a hover card. */
function Row({ s }: { s: SessionInfo }) {
  const span = s.endedAt ? s.endedAt - s.startedAt : s.live ? Date.now() - s.startedAt : null;
  return (
    <li>
      <SplitViewItem value={s.id} preview={<SessionPeek session={s} />} className="min-h-0 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary-strong text-muted-foreground group-data-current/item:bg-white/20 group-data-current/item:text-inherit">
          <Icon name={s.live ? 'circle-fill' : 'clock'} size={s.live ? 11 : 17} sw={1.8} className={s.live ? 'animate-pulse text-destructive group-data-current/item:animate-none group-data-current/item:text-inherit' : undefined} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-detail font-semibold">{timeLabel(s.startedAt)}</span>
          <span className="block truncate text-caption text-muted-foreground group-data-current/item:text-white/80">
            {s.live ? 'Recording now' : [span !== null ? duration(span) : null, s.events ? `${count(s.events)} events` : null].filter(Boolean).join(' · ') || 'Session'}
          </span>
        </span>
        {!s.local ? <Icon name="cloud" size={15} sw={1.8} className="text-muted-foreground group-data-current/item:text-white/80" /> : null}
      </SplitViewItem>
    </li>
  );
}
