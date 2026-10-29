/* The site header (desktop) and the repository header: owner / name, visibility, Watch / Fork / Star. The owner / name
   crumb opens the repository picker; the right end is the account — the GitHub avatar when signed in, else Sign in with
   GitHub (or Unlock keychain when a saved sign-in is behind the passkey). */
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Counter, Mark, Oct, ghButton, type OctName, type Layout } from './parts';
import { useRepo } from './repo-context';

export function GlobalHeader({ ui, width }: { ui: Layout; width: number }) {
  const { source, openPicker, repo } = useRepo();
  const [owner, name] = source.full.split('/');
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-[var(--gh-inset)] px-4">
      <button type="button" aria-label="Open menu" className={cn(ghButton(), 'w-8 bg-transparent px-0')}><Oct name="menu" /></button>
      <Mark />
      <button type="button" onClick={openPicker} aria-label={`Repository ${source.full}: choose another`}
        className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent p-0 text-detail text-foreground">
        <span className="rounded-md px-1.5 py-1 hover:bg-secondary">{repo?.owner ?? owner}</span>
        <span className="text-tertiary-foreground">/</span>
        <span className="truncate rounded-md px-1.5 py-1 font-semibold hover:bg-secondary">{repo?.name ?? name}</span>
        <Oct name="chevDown" size={12} className="text-muted-foreground" />
      </button>
      <span className="flex-1" />
      {width >= 900 ? (
        <div className="flex h-8 w-[300px] items-center gap-2 rounded-md border border-border bg-background px-2 text-muted-foreground">
          <Oct name="search" />
          <span className="flex-1">Type <kbd className="rounded border border-border px-1 font-mono text-caption2">/</kbd> to search</span>
        </div>
      ) : null}
      {ui.wide ? <span className="h-5 w-px bg-border" /> : null}
      <button type="button" aria-label="Create new" className={cn(ghButton(), 'gap-1 bg-transparent px-2 text-muted-foreground')}>
        <Oct name="plus" /><Oct name="chevDown" size={12} />
      </button>
      {(['issue', 'pr', 'inbox'] as OctName[]).map((n) => (
        <button key={n} type="button" aria-label={n} className={cn(ghButton(), 'w-8 bg-transparent px-0 text-muted-foreground')}><Oct name={n} /></button>
      ))}
      <Account />
    </header>
  );
}

/** Signed in: the avatar (it opens the picker). Not: the keychain's way in. */
export function Account() {
  const { keychain, viewer, openPicker, source } = useRepo();
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
    <button type="button" onClick={openPicker} aria-label={`Signed in as ${viewer.login}`} className="cursor-pointer rounded-full border-0 bg-transparent p-0">
      <Avatar c={viewer} src={viewer.avatar} size={32} />
    </button>
  );
}

export function RepoHeader({ ui }: { ui: Layout }) {
  const { repo } = useRepo();
  const counted = (icon: OctName, label: string, count: string) => (
    <div className="flex">
      <Button className={cn(ghButton(), 'rounded-r-none')}><Oct name={icon} className="text-muted-foreground" />{label}<Counter>{count}</Counter></Button>
      <Button aria-label={label + ' options'} className={cn(ghButton(), '-ml-px rounded-l-none px-2')}><Oct name="chevDown" size={12} /></Button>
    </div>
  );
  return (
    <div className="px-4 pt-4 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex min-w-0 items-center gap-2 text-title">
          <Oct name={repo.private ? 'lock' : 'book'} className="text-muted-foreground" />
          <span className="text-primary">{repo.owner}</span>
          <span className="text-tertiary-foreground">/</span>
          <strong className="truncate font-semibold text-primary">{repo.name}</strong>
          <Badge variant="outline" className="h-5 px-2 text-caption font-medium text-muted-foreground">{repo.private ? 'Private' : 'Public'}</Badge>
        </div>
        {!ui.phone ? (
          <div className="ml-auto flex flex-wrap gap-2">
            {counted('eye', 'Watch', repo.watchers)}
            {counted('fork', 'Fork', repo.forks)}
            {counted('star', 'Star', repo.stars)}
          </div>
        ) : null}
      </div>
      {!ui.wide ? (
        <div className="mt-3 space-y-3">
          {repo.description ? <p className="m-0 text-detail leading-5 text-muted-foreground">{repo.description}</p> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-detail text-muted-foreground">
            {repo.homepage ? <span className="flex items-center gap-1.5 font-semibold text-primary"><Oct name="link" />{repo.homepage}</span> : null}
            <span className="flex items-center gap-1.5"><Oct name="star" /><b className="text-foreground">{repo.stars}</b> stars</span>
            <span className="flex items-center gap-1.5"><Oct name="fork" /><b className="text-foreground">{repo.forks}</b> forks</span>
          </div>
          {ui.phone ? (
            <div className="flex gap-2">
              <Button className={cn(ghButton(), 'flex-1')}><Oct name="star" className="text-muted-foreground" />Star</Button>
              <Button className={cn(ghButton(), 'flex-1')}><Oct name="eye" className="text-muted-foreground" />Watch</Button>
              <Button className={cn(ghButton(), 'flex-1')}><Oct name="fork" className="text-muted-foreground" />Fork</Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
