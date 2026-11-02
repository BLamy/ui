/* The site header (desktop) and the repository header: owner / name, visibility, Watch / Fork / Star. The owner / name
   crumb opens the repository picker; search opens the palette (/); + creates things; the issue, pull request and inbox
   buttons open your work across repositories; the right end is the account. */
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Credenza } from '@/components/ui/credenza';
import { cn } from '@/lib/utils';
import type { Subscription } from './source';
import { notificationsOf, orgsOf } from './github-api';
import { GhLink } from './links';
import { Counter, Mark, Oct, ghButton } from './parts';
import { Menu, type MenuEntry } from './pickers';
import { ActionError, useAction, useCan, useLoad, useNav, useRepo } from './repo-context';

const plain = cn(ghButton(), 'bg-transparent');

export function GlobalHeader({ width }: { width: number }) {
  const { source, openPicker, repo, ui, openApp, gh, viewer } = useRepo();
  const nav = useNav();
  const can = useRepoCan();
  const [owner, name] = source.full.split('/');
  const unread = useLoad(`notifications-dot:${gh?.id}:${viewer?.login ?? ''}`, () => (gh && viewer ? notificationCount(gh) : 0)).data ?? 0;
  const createEntries: (MenuEntry | null)[] = [
    can.participate ? { id: 'issue', label: 'New issue', icon: <Oct name="issue" size={14} />, onAction: () => nav.go({ s: 'new-issue' }) } : null,
    repo && !repo.empty ? { id: 'pull', label: 'New pull request', icon: <Oct name="pr" size={14} />, onAction: () => nav.go({ s: 'compare' }) } : null,
    can.push ? { id: 'file', label: 'New file', icon: <Oct name="fileAdd" size={14} />, onAction: () => nav.go({ s: 'new-file' }) } : null,
    can.push ? { id: 'release', label: 'New release', icon: <Oct name="tag" size={14} />, onAction: () => nav.go({ s: 'new-release' }) } : null,
    viewer ? { separator: true, id: 'sep' } : null,
    viewer ? { id: 'repo', label: 'New repository', icon: <Oct name="book" size={14} />, onAction: () => openApp('new-repo') } : null,
  ];
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-(--gh-inset) px-4">
      <Button aria-label="Open menu" className={cn(plain, 'w-8 px-0')} onPress={() => openApp('menu')}><Oct name="menu" /></Button>
      <GhLink to={{ s: 'code' }} aria-label={`${source.full} home`} className="rounded-full no-underline"><Mark /></GhLink>
      <Button onPress={openPicker} aria-label={`Repository ${source.full}: choose another`}
        className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 text-detail text-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary">
        <span className="rounded-md px-1.5 py-1 hover:bg-secondary">{repo?.owner ?? owner}</span>
        <span className="text-tertiary-foreground">/</span>
        <span className="truncate rounded-md px-1.5 py-1 font-semibold hover:bg-secondary">{repo?.name ?? name}</span>
        <Oct name="chevDown" size={12} className="text-muted-foreground" />
      </Button>
      <span className="flex-1" />
      {width >= 900 ? (
        <Button onPress={() => nav.search()} className="flex h-8 w-[300px] cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 text-left text-detail text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:border-primary">
          <Oct name="search" />
          <span className="flex-1">Type <kbd className="rounded border border-border px-1 font-mono text-caption2">/</kbd> to search</span>
        </Button>
      ) : <Button aria-label="Search" className={cn(plain, 'w-8 px-0 text-muted-foreground')} onPress={() => nav.search()}><Oct name="search" /></Button>}
      {ui.wide ? <span className="h-5 w-px bg-border" /> : null}
      <Button aria-label="Reload from GitHub" className={cn(plain, 'w-8 px-0 text-muted-foreground')} onPress={() => source.refresh()}><Oct name="retry" /></Button>
      {createEntries.some(Boolean) ? (
        <Menu label="Create new" triggerClassName={cn(plain, 'gap-1 px-2 text-muted-foreground')} trigger={<><Oct name="plus" /><Oct name="chevDown" size={12} /></>} entries={createEntries} />
      ) : null}
      {viewer ? (
        <>
          <Button aria-label="Your issues" className={cn(plain, 'w-8 px-0 text-muted-foreground')} onPress={() => openApp('issues')}><Oct name="issue" /></Button>
          <Button aria-label="Your pull requests" className={cn(plain, 'w-8 px-0 text-muted-foreground')} onPress={() => openApp('pulls')}><Oct name="pr" /></Button>
          <Button aria-label={unread ? `Notifications: ${unread} unread` : 'Notifications'} className={cn(plain, 'relative w-8 px-0 text-muted-foreground')} onPress={() => openApp('notifications')}>
            <Oct name="inbox" />
            {unread ? <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-(--gh-inset) bg-primary" /> : null}
          </Button>
        </>
      ) : null}
      <Account />
    </header>
  );
}

const notificationCount = async (gh: NonNullable<ReturnType<typeof useRepo>['gh']>) => (await notificationsOf(gh, false).catch(() => [])).length;

/** useCan needs the repository; the header draws before it loads. */
function useRepoCan() {
  const { repo, viewer } = useRepo();
  if (!repo) return { participate: false, push: false };
  const open = !repo.archived;
  return { participate: open && !!viewer, push: open && repo.permissions.push };
}

/** Signed in: the avatar, opening the account menu. Not: the keychain's way in. In the sample the avatar says it's a sample. */
export function Account() {
  const { keychain, viewer, source, openApp } = useRepo();
  if (keychain && !keychain.token && !source.live) {
    const [label, act]: [string, () => void] = keychain.rejected
      ? ['Sign in again', keychain.signIn]
      : keychain.locked
        ? ['Unlock keychain', () => void keychain.unlock().catch(() => {})]
        : ['Sign in with GitHub', keychain.signIn];
    return (
      <Button className={ghButton(true)} onPress={act}>
        {keychain.locked && !keychain.rejected ? <Oct name="lock" size={14} /> : null}{label}
      </Button>
    );
  }
  if (!viewer) return <span className="size-8 shrink-0 rounded-full bg-secondary" />;
  return (
    <Button onPress={() => openApp('menu')} aria-label={source.live ? `Account: ${viewer.login}` : 'Account: the sample’s demo user'} className="cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary">
      <Avatar c={viewer} src={viewer.avatar} size={32} />
    </Button>
  );
}

function Split({ main, chevron }: { main: ReactNode; chevron: ReactNode }) {
  return <div className="flex">{main}{chevron}</div>;
}

const WATCH: Record<Subscription, { label: string; hint: string }> = {
  participating: { label: 'Participating and @mentions', hint: 'Only receive notifications from this repository when participating or @mentioned.' },
  all: { label: 'All Activity', hint: 'Notified of all notifications on this repository.' },
  ignored: { label: 'Ignore', hint: 'Never be notified.' },
};

export function RepoHeader() {
  const { repo, source, viewer, ui } = useRepo();
  const nav = useNav();
  const can = useCan();
  const starred = useLoad(`${source.id}:starred:${viewer?.login ?? ''}`, () => (viewer ? source.starred() : false)).data ?? false;
  const subscription = useLoad(`${source.id}:subscription:${viewer?.login ?? ''}`, () => (viewer ? source.subscription() : 'participating' as Subscription)).data ?? 'participating';
  const act = useAction();
  const [forkOpen, setForkOpen] = useState(false);
  const signedIn = can.signedIn;
  const starButton = (full: boolean) => (
    <Button aria-pressed={starred} isDisabled={!signedIn || act.busy} className={cn(ghButton(), full ? 'flex-1' : 'rounded-r-none')} onPress={() => void act.run(() => source.setStarred(!starred))}>
      <Oct name="star" className={starred ? 'text-(--gh-attention)' : 'text-muted-foreground'} />{starred ? 'Starred' : 'Star'}{!full ? <Counter>{repo.stars}</Counter> : null}
    </Button>
  );
  const watchEntries: MenuEntry[] = [
    ...(['participating', 'all', 'ignored'] as Subscription[]).map((s) => ({ id: s, label: WATCH[s].label, hint: WATCH[s].hint, selected: subscription === s, onAction: () => void act.run(() => source.setSubscription(s)) })),
    { separator: true, id: 'sep' },
    { id: 'list', label: 'See who’s watching', onAction: () => nav.go({ s: 'people', kind: 'watchers' }) },
  ];
  const watchLabel = subscription === 'all' ? 'Unwatch' : subscription === 'ignored' ? 'Stop ignoring' : 'Watch';
  const watchButton = (full: boolean) => (
    <Menu label={`Notifications for ${source.full}: ${WATCH[subscription].label}`} isDisabled={!signedIn} triggerClassName={cn(ghButton(), full && 'flex-1')} entries={watchEntries} placement="bottom end"
      trigger={<><Oct name="eye" className="text-muted-foreground" />{watchLabel}{!full ? <Counter>{repo.watchers}</Counter> : null}<Oct name="chevDown" size={12} /></>} />
  );
  const forkButton = (full: boolean) => (
    <Button isDisabled={!signedIn} className={cn(ghButton(), full ? 'flex-1' : 'rounded-r-none')} onPress={() => setForkOpen(true)}>
      <Oct name="fork" className="text-muted-foreground" />Fork{!full ? <Counter>{repo.forks}</Counter> : null}
    </Button>
  );
  return (
    <div className="px-4 pt-4 md:px-6">
      {repo.archived ? (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-md border border-(--gh-attention)/50 bg-(--gh-attention)/10 px-3 py-2"><Oct name="archive" className="text-(--gh-attention)" />This repository has been archived by the owner. It is now read-only.</div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-title">
          <Oct name={repo.private ? 'lock' : repo.fork ? 'fork' : 'book'} className="text-muted-foreground" />
          <a href={`https://github.com/${repo.owner}`} target="_blank" rel="noreferrer" className="text-primary no-underline hover:underline">{repo.owner}</a>
          <span className="text-tertiary-foreground">/</span>
          <GhLink to={{ s: 'code' }} className="truncate font-semibold text-primary no-underline hover:underline">{repo.name}</GhLink>
          <Badge variant="outline" className="h-5 px-2 text-caption font-medium text-muted-foreground">{repo.archived ? 'Public archive' : repo.private ? 'Private' : 'Public'}</Badge>
          {repo.parent ? <span className="w-full text-caption text-muted-foreground">forked from <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-caption text-primary hover:underline" onClick={() => nav.openRepo(repo.parent!)}>{repo.parent}</button></span> : null}
        </div>
        {!ui.phone ? (
          <div className="ml-auto flex flex-wrap gap-2">
            {watchButton(false)}
            <Split main={forkButton(false)} chevron={
              <Menu label="Fork options" triggerClassName={cn(ghButton(), '-ml-px rounded-l-none px-2')} trigger={<Oct name="chevDown" size={12} />} entries={[
                { id: 'forks', label: 'See existing forks', onAction: () => nav.go({ s: 'insights', page: 'forks' }) },
                signedIn ? { id: 'new', label: 'Create a new fork', onAction: () => setForkOpen(true) } : null,
              ]} />
            } />
            <Split main={starButton(false)} chevron={
              <Menu label="Star options" triggerClassName={cn(ghButton(), '-ml-px rounded-l-none px-2')} trigger={<Oct name="chevDown" size={12} />} entries={[
                { id: 'who', label: 'See who starred this', onAction: () => nav.go({ s: 'people', kind: 'stargazers' }) },
              ]} />
            } />
          </div>
        ) : null}
      </div>
      <ActionError error={act.error} className="mt-2" />
      {!ui.wide ? (
        <div className="mt-3 space-y-3">
          {repo.description ? <p className="m-0 text-detail leading-5 text-muted-foreground">{repo.description}</p> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-detail text-muted-foreground">
            {repo.homepage ? <a href={/^https?:/.test(repo.homepage) ? repo.homepage : `https://${repo.homepage}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-semibold text-primary no-underline hover:underline"><Oct name="link" />{repo.homepage.replace(/^https?:\/\//, '')}</a> : null}
            <GhLink to={{ s: 'people', kind: 'stargazers' }} className="flex items-center gap-1.5 text-muted-foreground no-underline hover:text-primary"><Oct name="star" /><b className="text-foreground">{repo.stars}</b> stars</GhLink>
            <GhLink to={{ s: 'insights', page: 'forks' }} className="flex items-center gap-1.5 text-muted-foreground no-underline hover:text-primary"><Oct name="fork" /><b className="text-foreground">{repo.forks}</b> forks</GhLink>
          </div>
          {ui.phone ? <div className="flex gap-2">{starButton(true)}{watchButton(true)}{forkButton(true)}</div> : null}
        </div>
      ) : null}
      {forkOpen ? <ForkDialog onClose={() => setForkOpen(false)} /> : null}
    </div>
  );
}

function ForkDialog({ onClose }: { onClose: () => void }) {
  const { source, repo, viewer, ui, gh, notify } = useRepo();
  const nav = useNav();
  const [name, setName] = useState(repo.name);
  const [owner, setOwner] = useState(viewer?.login ?? '');
  const [branchOnly, setBranchOnly] = useState(true);
  const orgs = useLoad('orgs', () => (gh ? orgsOf(gh).catch(() => []) : [])).data ?? [];
  const act = useAction();
  useEffect(() => { if (viewer) setOwner(viewer.login); }, [viewer]);
  const mine = source.full.split('/')[0] === owner;
  const submit = () => void act.run(async () => {
    const full = await source.fork({ name: name.trim() === repo.name ? undefined : name.trim(), organization: owner === viewer?.login ? undefined : owner, defaultBranchOnly: branchOnly });
    notify(`Forked to ${full}`);
    onClose();
    nav.openRepo(full);
  });
  return (
    <Credenza open onClose={onClose} title="Create a new fork" compact={ui.phone}>
      <form className="grid gap-3 px-4 pt-2 pb-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className="m-0 text-caption text-muted-foreground">A fork is a copy of {source.full}, in your account, that you can change and propose back.</p>
        <label className="grid gap-1 font-semibold">Owner
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className="box-border h-9 rounded-md border border-border bg-background px-1 font-sans text-detail font-normal text-foreground">
            {viewer ? <option value={viewer.login}>{viewer.login}</option> : null}
            {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="grid gap-1 font-semibold">Repository name
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-md border border-border bg-background font-mono text-caption font-normal" />
        </label>
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={branchOnly} onChange={(e) => setBranchOnly(e.target.checked)} />Copy the <b className="font-mono text-caption font-semibold">{repo.branch}</b> branch only</label>
        {mine ? <p role="alert" className="m-0 text-caption text-(--gh-closed)">You own this repository, so a fork needs a different owner.</p> : null}
        <ActionError error={act.error} />
        <div className="flex justify-end gap-2">
          <Button className={ghButton()} onPress={onClose}>Cancel</Button>
          <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !name.trim() || mine}>{act.busy ? 'Forking…' : 'Create fork'}</Button>
        </div>
      </form>
    </Credenza>
  );
}


