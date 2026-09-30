/* The site header (desktop) and the repository header: owner / name, visibility, Watch / Fork / Star. */
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ME, REPO } from './data';
import { Counter, Mark, Oct, ghButton, type OctName, type Layout } from './parts';

export function GlobalHeader({ ui, width }: { ui: Layout; width: number }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-[var(--gh-inset)] px-4">
      <button type="button" aria-label="Open menu" className={cn(ghButton(), 'w-8 bg-transparent px-0')}><Oct name="menu" /></button>
      <Mark />
      <nav className="flex min-w-0 items-center gap-1 text-detail">
        <span className="rounded-md px-1.5 py-1 hover:bg-secondary">{REPO.owner}</span>
        <span className="text-tertiary-foreground">/</span>
        <span className="truncate rounded-md px-1.5 py-1 font-semibold hover:bg-secondary">{REPO.name}</span>
      </nav>
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
      <Avatar c={ME} size={32} />
    </header>
  );
}

export function RepoHeader({ ui }: { ui: Layout }) {
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
          <Oct name="book" className="text-muted-foreground" />
          <span className="text-primary">{REPO.owner}</span>
          <span className="text-tertiary-foreground">/</span>
          <strong className="truncate font-semibold text-primary">{REPO.name}</strong>
          <Badge variant="outline" className="h-5 px-2 text-caption font-medium text-muted-foreground">Public</Badge>
        </div>
        {!ui.phone ? (
          <div className="ml-auto flex flex-wrap gap-2">
            {counted('eye', 'Watch', REPO.watchers)}
            {counted('fork', 'Fork', REPO.forks)}
            {counted('star', 'Star', REPO.stars)}
          </div>
        ) : null}
      </div>
      {!ui.wide ? (
        <div className="mt-3 space-y-3">
          <p className="m-0 text-detail leading-5 text-muted-foreground">{REPO.description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-detail text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-primary"><Oct name="link" />{REPO.homepage}</span>
            <span className="flex items-center gap-1.5"><Oct name="star" /><b className="text-foreground">{REPO.stars}</b> stars</span>
            <span className="flex items-center gap-1.5"><Oct name="fork" /><b className="text-foreground">{REPO.forks}</b> forks</span>
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
