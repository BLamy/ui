/* Where sessions live: this browser alone (the default — nothing leaves it), or also on a Durable Streams server
   (Rivet), which syncs them live and lets another device watch them. */
import { useState, type ReactNode } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { useSessionCloud } from '@/lib/session-recorder';
import { cn } from '@/lib/utils';
import { timeLabel } from './format';

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-footnote font-medium">{label}</span>
      {children}
      {hint ? <span className="text-caption text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const input = 'h-9 w-full rounded-ctl border-0 bg-secondary px-3 text-detail text-foreground outline-none select-text placeholder:text-tertiary-foreground focus-visible:ring-2 focus-visible:ring-primary';

export function CloudPanel() {
  const { status, settings, configure } = useSessionCloud();
  const [url, setUrl] = useState(settings.url);
  const [token, setToken] = useState(settings.token);
  const [prefix, setPrefix] = useState(settings.prefix);
  const on = settings.enabled;
  // Private is the default; Cloud shows the server fields, and only "Turn on" sends anything.
  const [mode, setMode] = useState<'private' | 'cloud'>(on ? 'cloud' : 'private');
  const save = (enabled: boolean) => configure({ enabled, url: url.trim(), token: token.trim(), prefix: prefix.trim() });

  return (
    <div className="flex flex-col gap-3.5">
      <Segmented
        aria-label="Where sessions are stored"
        value={mode}
        onChange={(v) => { setMode(v as 'private' | 'cloud'); if (v === 'private' && on) configure({ enabled: false }); }}
        options={[{ id: 'private', label: 'Private' }, { id: 'cloud', label: 'Cloud' }]}
      />

      {mode === 'private' ? (
        <p className="m-0 flex gap-2 text-footnote text-muted-foreground">
          <Icon name="lock" size={16} className="mt-px shrink-0" />
          <span>Private: sessions are stored in this browser only and never sent anywhere. Turn on Cloud to sync them live to a Durable Streams server, such as one on Rivet.</span>
        </p>
      ) : (
        <>
          <Field label="Server" hint="A Durable Streams endpoint, e.g. your Rivet project’s /durable-streams URL.">
            <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-project.rivet.run/durable-streams" spellCheck={false} autoCapitalize="off" />
          </Field>
          <Field label="Access token" hint="Sent as a bearer token. Stored in this browser.">
            <input className={input} type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Optional" autoComplete="off" />
          </Field>
          <Field label="Stream prefix" hint="Keeps this computer’s streams apart from others on the same server.">
            <input className={input} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="my-mac" spellCheck={false} autoCapitalize="off" />
          </Field>
          <PlainButton
            onPress={() => save(!on)}
            isDisabled={!on && !url.trim()}
            className={cn('h-9 cursor-pointer rounded-ctl border-0 px-3 text-detail font-semibold data-disabled:opacity-40', on ? 'bg-secondary text-foreground hover:bg-secondary-strong' : 'bg-primary text-primary-foreground')}
          >
            {on ? 'Stop syncing' : 'Turn on Cloud sync'}
          </PlainButton>
          {on ? (
            <div role="status" className="flex items-start gap-2 rounded-ctl bg-secondary px-3 py-2 text-footnote">
              <span aria-hidden="true" className={cn('mt-1 size-2 shrink-0 rounded-full', status.state === 'error' ? 'bg-destructive' : status.state === 'offline' ? 'bg-warning' : 'bg-success')} />
              <span className="min-w-0">
                <span className="font-medium">{status.state === 'syncing' ? 'Syncing…' : status.state === 'offline' ? 'Offline — will sync when back' : status.state === 'error' ? 'Can’t reach the server' : 'Synced'}</span>
                <span className="block text-muted-foreground">
                  {status.error ? status.error : status.pending ? `${status.pending.toLocaleString()} records waiting` : status.lastSyncAt ? `Up to date at ${timeLabel(status.lastSyncAt)}` : 'Connecting…'}
                </span>
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
