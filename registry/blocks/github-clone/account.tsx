/* The account and everything across repositories: the menu behind the avatar and the hamburger, your issues and pull
   requests, notifications, and creating a repository. In the sample these work on the sample's own accounts. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import type { KeychainSignIn } from '../apple-passwords/page';
import type { User } from './data';
import { acrossRepos, createRepo, markAllNotificationsRead, markNotificationRead, notificationsOf, type GitHub } from './github-api';
import { Oct, StateIcon, ghButton } from './parts';
import { parseGitHubUrl, type Route } from './route';
import { ActionError, Loaded, useAction, useLoad } from './repo-context';

export type AppView = 'menu' | 'issues' | 'pulls' | 'notifications' | 'new-repo';

const row = 'flex min-h-11 w-full cursor-pointer items-center gap-3 border-0 border-t border-border bg-transparent px-3 py-2 text-left text-subhead text-foreground outline-none first:border-t-0 hover:bg-accent focus-visible:bg-accent';

export function AppMenu({ view, onView, onClose, compact, gh, viewer, keychain, live, onOpen, openPicker }: {
  view: AppView | null; onView: (v: AppView) => void; onClose: () => void; compact: boolean; gh: GitHub | null; viewer?: User | null; keychain: KeychainSignIn | null; live: boolean;
  /** Opens a repository (and a screen in it). */
  onOpen: (full: string, route?: Route | null) => void; openPicker: () => void;
}) {
  const titles: Record<AppView, string> = { menu: 'Menu', issues: 'Your issues', pulls: 'Your pull requests', notifications: 'Notifications', 'new-repo': 'New repository' };
  const follow = (url?: string) => {
    const hit = url ? parseGitHubUrl(url) : null;
    if (hit) { onClose(); onOpen(hit.full, hit.route); }
  };
  const rate = gh?.rateLimit();
  const scopes = gh?.scopes();
  return (
    <Credenza open={!!view} onClose={onClose} title={view ? titles[view] : ''} view={view ?? undefined} canBack={view !== 'menu'} onBack={() => onView('menu')} compact={compact} className={cn(!compact && view !== 'menu' && 'w-[560px]')}>
      <div className="grid gap-3 px-4 pt-1 pb-4">
        {view === 'menu' ? (
          <>
            {viewer ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2.5">
                <Avatar c={viewer} src={viewer.avatar} size={36} />
                <div className="min-w-0 flex-1 text-footnote">
                  <b className="block truncate font-semibold">{viewer.login}</b>
                  <span className="block text-muted-foreground">{live ? `${viewer.f} ${viewer.l}`.trim() : 'The sample’s demo user. Nothing here reaches GitHub.'}</span>
                </div>
              </div>
            ) : <p className="m-0 text-footnote text-muted-foreground">Not signed in.</p>}
            <div className="overflow-hidden rounded-xl border border-border">
              <button type="button" className={row} onClick={() => { onClose(); openPicker(); }}><Oct name="book" className="text-muted-foreground" />Repositories</button>
              {viewer ? <button type="button" className={row} onClick={() => onView('issues')}><Oct name="issue" className="text-muted-foreground" />Your issues</button> : null}
              {viewer ? <button type="button" className={row} onClick={() => onView('pulls')}><Oct name="pr" className="text-muted-foreground" />Your pull requests</button> : null}
              {viewer ? <button type="button" className={row} onClick={() => onView('notifications')}><Oct name="inbox" className="text-muted-foreground" />Notifications</button> : null}
              {viewer ? <button type="button" className={row} onClick={() => onView('new-repo')}><Oct name="plus" className="text-muted-foreground" />New repository</button> : null}
            </div>
            {live && viewer ? <a className={cn(row, 'rounded-xl border border-border no-underline')} href={`https://github.com/${viewer.login}`} target="_blank" rel="noreferrer"><Oct name="external" className="text-muted-foreground" />Your profile on GitHub</a> : null}
            {live && rate ? (
              <p className="m-0 text-caption text-muted-foreground">
                API: {rate.remaining.toLocaleString('en-US')} of {rate.limit.toLocaleString('en-US')} requests left{rate.resetAt ? `, resets at ${new Date(rate.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.
                {scopes?.length ? <> Token scopes: <code className="font-mono">{scopes.join(', ')}</code>.</> : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {keychain?.token ? (
                <Button className={cn(ghButton(), 'flex-1')} onPress={() => { onClose(); keychain.forget(); }}><Oct name="signout" />Sign out</Button>
              ) : keychain ? (
                keychain.locked && !keychain.rejected
                  ? <Button className={cn(ghButton(true), 'flex-1')} onPress={() => void keychain.unlock().catch(() => {})}><Oct name="lock" size={14} />Unlock keychain</Button>
                  : <Button className={cn(ghButton(true), 'flex-1')} onPress={() => { onClose(); keychain.signIn(); }}>{keychain.rejected ? 'Sign in again' : 'Sign in with GitHub'}</Button>
              ) : null}
            </div>
          </>
        ) : view === 'issues' || view === 'pulls' ? (
          gh && viewer ? <YourWork gh={gh} kind={view} onFollow={follow} /> : null
        ) : view === 'notifications' ? (
          gh ? <Notifications gh={gh} onFollow={follow} /> : null
        ) : view === 'new-repo' ? (
          gh && viewer ? <NewRepo gh={gh} owner={viewer.login} onCreated={(full) => { onClose(); onOpen(full); }} /> : null
        ) : null}
      </div>
    </Credenza>
  );
}

function YourWork({ gh, kind, onFollow }: { gh: GitHub; kind: 'issues' | 'pulls'; onFollow: (url?: string) => void }) {
  const FILTERS = kind === 'issues'
    ? [['author', 'Created', 'author:@me'], ['assignee', 'Assigned', 'assignee:@me'], ['mentions', 'Mentioned', 'mentions:@me']]
    : [['author', 'Created', 'author:@me'], ['assignee', 'Assigned', 'assignee:@me'], ['review', 'Review requests', 'review-requested:@me']];
  const [filter, setFilter] = useState(FILTERS[0][0]);
  const q = `is:${kind === 'issues' ? 'issue' : 'pr'} is:open ${FILTERS.find((f) => f[0] === filter)![2]}`;
  const load = useLoad(`your:${gh.id}:${q}`, () => acrossRepos(gh, q));
  return (
    <>
      <Segmented aria-label="Which ones" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ id: f[0], label: f[1] }))} />
      <Loaded load={load} pending={<p className="m-0 text-caption text-muted-foreground">Loading…</p>}>
        {(list) => list.length ? (
          <ul className="m-0 max-h-[56vh] list-none overflow-auto rounded-xl border border-border p-0">
            {list.map((i) => (
              <li key={i.url} className="border-t border-border first:border-t-0">
                <button type="button" onClick={() => onFollow(i.url)} className="flex min-h-11 w-full cursor-pointer items-start gap-2 border-0 bg-transparent px-3 py-2 text-left text-detail text-foreground outline-none hover:bg-accent focus-visible:bg-accent">
                  <StateIcon state={i.isPull ? 'prOpen' : 'open'} className="mt-0.5" />
                  <span className="min-w-0 flex-1"><span className="font-semibold">{i.title}</span><span className="block text-caption text-muted-foreground">{i.repo} #{i.number} · {i.when}</span></span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="my-6 text-center text-footnote text-muted-foreground">Nothing here.</p>}
      </Loaded>
    </>
  );
}

function Notifications({ gh, onFollow }: { gh: GitHub; onFollow: (url?: string) => void }) {
  const [all, setAll] = useState(false);
  const load = useLoad(`notifications:${gh.id}:${all}`, () => notificationsOf(gh, all));
  const act = useAction();
  const unread = (load.data ?? []).filter((n) => n.unread).length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented aria-label="Which notifications" value={all ? 'all' : 'unread'} onChange={(v) => setAll(v === 'all')} options={[{ id: 'unread', label: 'Unread' }, { id: 'all', label: 'All' }]} className="min-w-[160px]" />
        <span className="flex-1" />
        <Button className={ghButton()} isDisabled={!unread || act.busy} onPress={() => void act.run(() => markAllNotificationsRead(gh))}>Mark all as read</Button>
      </div>
      <ActionError error={act.error} />
      <Loaded load={load} pending={<p className="m-0 text-caption text-muted-foreground">Loading…</p>}>
        {(list) => list.length ? (
          <ul className="m-0 max-h-[56vh] list-none overflow-auto rounded-xl border border-border p-0">
            {list.map((n) => (
              <li key={n.id} className={cn('flex items-center gap-2 border-t border-border pr-2 first:border-t-0', n.unread && 'bg-primary/5')}>
                <button type="button" onClick={() => { if (n.unread) void markNotificationRead(gh, n.id).catch(() => {}); onFollow(n.url); }} className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-2 border-0 bg-transparent px-3 py-2 text-left text-detail text-foreground outline-none hover:bg-accent focus-visible:bg-accent">
                  <Oct name={n.type === 'PullRequest' ? 'pr' : n.type === 'Release' ? 'tag' : 'issue'} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1"><span className={cn(n.unread && 'font-semibold')}>{n.unread ? <span className="sr-only">Unread: </span> : null}{n.title}</span><span className="block text-caption text-muted-foreground">{n.repo}{n.number ? ` #${n.number}` : ''} · {n.reason} · {n.when}</span></span>
                </button>
                {n.unread ? <Button aria-label={`Mark “${n.title}” as read`} className={cn(ghButton(), 'h-7 w-7 px-0')} isDisabled={act.busy} onPress={() => void act.run(() => markNotificationRead(gh, n.id))}><Oct name="check" size={14} /></Button> : null}
              </li>
            ))}
          </ul>
        ) : <p className="my-6 text-center text-footnote text-muted-foreground">{all ? 'No notifications.' : 'All caught up.'}</p>}
      </Loaded>
    </>
  );
}

function NewRepo({ gh, owner, onCreated }: { gh: GitHub; owner: string; onCreated: (full: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [readme, setReadme] = useState(true);
  const act = useAction();
  useEffect(() => act.clear(), [name]);
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void act.run(async () => onCreated(await createRepo(gh, { name: name.trim(), description, private: visibility === 'private', autoInit: readme }))); }}>
      <label className="grid gap-1 text-footnote font-semibold">Repository name
        <span className="flex items-center gap-1 font-normal text-muted-foreground">{owner} / <Input data-autofocus required value={name} onChange={(e) => setName(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background font-mono text-caption" /></span>
      </label>
      <label className="grid gap-1 text-footnote font-semibold">Description (optional)
        <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9 rounded-md border border-border bg-background font-normal" />
      </label>
      <Segmented aria-label="Visibility" value={visibility} onChange={setVisibility} options={[{ id: 'public', label: 'Public' }, { id: 'private', label: 'Private' }]} />
      <label className="flex cursor-pointer items-center gap-2 text-footnote"><input type="checkbox" checked={readme} onChange={(e) => setReadme(e.target.checked)} />Add a README</label>
      <ActionError error={act.error} />
      <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !name.trim()}>{act.busy ? 'Creating…' : 'Create repository'}</Button>
    </form>
  );
}
