/* One session, played: its recorded page in a ReplayPreview, with what's known about it above. */
import { useEffect, useState } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { ReplayPreview, type ReplayEvent } from '@/components/ui/replay-preview';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { deleteSession, readSession, type SessionInfo } from '@/lib/session-recorder';
import { count, duration, fullLabel } from './format';

type Load = { events: ReplayEvent[] } | { error: string } | null;

export function SessionDetail({ session, onDeleted }: { session: SessionInfo; onDeleted: () => void }) {
  const [load, setLoad] = useState<Load>(null);
  // Bumped to read a session that is still recording again, for the events written since.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad(null);
    readSession(session.id).then(
      (events) => { if (live) setLoad({ events: events as unknown as ReplayEvent[] }); },
      (e: unknown) => { if (live) setLoad({ error: e instanceof Error ? e.message : 'Couldn’t read this session' }); },
    );
    return () => { live = false; };
  }, [session.id, version]);

  const events = load && 'events' in load ? load.events : null;
  const span = events && events.length > 1 ? events[events.length - 1].timestamp - events[0].timestamp : session.endedAt ? session.endedAt - session.startedAt : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-callout font-semibold">{fullLabel(session.startedAt)}</h2>
          <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-footnote text-muted-foreground">
            {session.live ? <span className="inline-flex items-center gap-1.5 font-medium text-destructive"><span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-destructive" />Recording now</span> : null}
            {span !== null ? <span>{duration(span)}</span> : null}
            {events ? <span>{count(events.length)} events</span> : session.events ? <span>{count(session.events)} events</span> : null}
            <span>{session.width} × {session.height}</span>
            <span className="inline-flex items-center gap-1"><Icon name={session.local ? 'laptop' : 'cloud'} size={13} sw={1.8} />{session.local ? 'This browser' : 'Cloud'}</span>
            {session.truncated ? <span className="text-warning">Stopped early: storage was full</span> : null}
          </p>
        </div>
        {session.live ? (
          <PlainButton aria-label="Refresh" title="Load the latest events" onPress={() => setVersion((v) => v + 1)} className="grid size-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground hover:bg-secondary">
            <Icon name="arrow-clockwise" size={18} sw={1.8} />
          </PlainButton>
        ) : (
          <PlainButton aria-label="Delete session" title="Delete this session" onPress={() => { void deleteSession(session.id).then(onDeleted); }} className="grid size-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground hover:bg-secondary hover:text-destructive">
            <Icon name="trash-slim" size={18} sw={1.7} />
          </PlainButton>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {events && events.length > 1 ? (
          <ReplayPreview key={`${session.id}:${version}`} events={events} title={`Session from ${fullLabel(session.startedAt)}`} autoplay={false} lazy={false} />
        ) : load && 'error' in load ? (
          <p className="m-0 py-16 text-center text-detail text-muted-foreground">{load.error}</p>
        ) : events ? (
          <p className="m-0 py-16 text-center text-detail text-muted-foreground">Nothing recorded in this session yet.</p>
        ) : (
          <div className="grid place-items-center py-16 text-muted-foreground"><Spinner spin size={24} /></div>
        )}
      </div>
    </div>
  );
}
