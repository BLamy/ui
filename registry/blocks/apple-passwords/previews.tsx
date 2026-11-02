/* Hover cards: a saved sign-in from the list (site, username, websites, what it has — never the secret), and a
   shared group (who's in it, how many passwords it holds) from the sidebar and from the detail's "Shared In".
   Each only previews what selecting the row shows in full, so touch, which never opens them, misses nothing. */
import type { CSSProperties, ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { GROUPS, SEVERITY, type Account, type SharedGroup } from './data';
import { SiteTile } from './parts';
import type { Vault } from './vault';

/** What a sign-in has, as small labelled chips. */
function Chip({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={style} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption font-medium text-muted-foreground">{children}</span>;
}

export function AccountPreview({ account: a }: { account: Account }) {
  const group = GROUPS.find((g) => g.id === a.group);
  return (
    <>
      <HoverCardHeader media={<SiteTile title={a.title} color={a.color} size={40} className={cn(a.deleted && 'opacity-60 grayscale')} />}
        title={a.title} subtitle={a.username} />
      <div className="mt-3 flex flex-col gap-0.5 text-footnote">
        {a.websites.map((w) => <span key={w} className="flex items-center gap-1.5 truncate text-foreground"><Icon name="globe" size={13} className="shrink-0 text-muted-foreground" />{w}</span>)}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {a.password ? <Chip><Icon name="key" size={12} />{a.token ? 'Token' : 'Password'}</Chip> : null}
        {a.passkey ? <Chip><Icon name="passkey" size={12} />Passkey</Chip> : null}
        {a.otp ? <Chip><Icon name="lock-rotation" size={12} />Code</Chip> : null}
        {group ? <Chip><Icon name="people" size={12} />{group.name}</Chip> : null}
        {a.issue && !a.deleted ? <Chip style={{ color: SEVERITY[a.issue.severity].ink }}><Icon name="warning-fill" size={12} />{a.issue.kind}</Chip> : null}
      </div>
      <div className="mt-2.5 text-caption text-muted-foreground">{a.deleted ? a.deleted : `Modified ${a.modified}`}</div>
    </>
  );
}

export function GroupPreview({ group: g, vault }: { group: SharedGroup; vault: Vault }) {
  const n = vault.accounts.filter((a) => a.group === g.id && !a.deleted).length;
  return (
    <>
      <HoverCardHeader media={<span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground"><Icon name="people" size={21} /></span>}
        title={g.name} subtitle={`${g.members.length + 1} people · ${n} ${n === 1 ? 'password' : 'passwords'}`} />
      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        <li className="flex items-center gap-2 text-footnote"><Avatar name="You" size={24} />You<span className="ml-auto text-caption text-muted-foreground">Owner</span></li>
        {g.members.map((m) => (
          <li key={m.f + m.l} className="flex items-center gap-2 text-footnote"><Avatar c={m} size={24} />{m.f} {m.l}</li>
        ))}
      </ul>
    </>
  );
}
