/* Real links: every one is an <a> with GitHub's URL (open in a new tab, copy link, screen readers), and a plain click stays in the block. */
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from './data';
import { Branch } from './parts';
import type { Route } from './route';
import { useNav, useRepo } from './repo-context';

const ring = 'rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-primary';

export function GhLink({ to, children, className, onNavigate, onClick, ...rest }: { to: Route; children: ReactNode; className?: string; onNavigate?: () => void } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const nav = useNav();
  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate?.();
    nav.go(to);
  };
  return <a href={nav.url(to)} onClick={click} className={cn(ring, className ?? 'text-primary underline underline-offset-2')} {...rest}>{children}</a>;
}

/** Someone's GitHub profile (the block has no profile pages, so it leaves). */
export function UserLink({ user, className, children }: { user: User | string; className?: string; children?: ReactNode }) {
  const login = typeof user === 'string' ? user : user.login;
  // A commit author without an account has a name, not a login: nothing to link to.
  if (/\s/.test(login)) return <span className={className}>{children ?? login}</span>;
  return <a href={`https://github.com/${login}`} target="_blank" rel="noreferrer" className={cn(ring, 'text-inherit no-underline hover:text-primary hover:underline', className)}>{children ?? login}</a>;
}

export function UserChip({ user, size = 20, className }: { user: User; size?: number; className?: string }) {
  return (
    <UserLink user={user} className={cn('inline-flex items-center gap-1.5 font-semibold text-foreground', className)}>
      <Avatar c={user} src={user.avatar} size={size} /><span>{user.login}</span>
    </UserLink>
  );
}

/** A branch name that opens the branch. */
export function BranchLink({ name, repo, deleted }: { name: string; repo?: string; deleted?: boolean }) {
  const { source } = useRepo();
  if (deleted) return <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-caption text-muted-foreground line-through">{name}</span>;
  if (repo && repo !== source.full) {
    return <a href={`https://github.com/${repo}/tree/${encodeURIComponent(name)}`} target="_blank" rel="noreferrer" className={cn(ring, 'no-underline')}><Branch>{repo.split('/')[0]}:{name}</Branch></a>;
  }
  return <GhLink to={{ s: 'code', ref: name }} className="no-underline"><Branch>{name}</Branch></GhLink>;
}
