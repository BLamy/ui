/* Small pieces the columns share: tinted bar buttons, the translucent bottom bar, the branch, folder and changes
   glyphs, and the status chips on a worktree (primary, clone, pull request, locked, missing, outside the opened folders). */
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { PullRequest, Worktree } from './types';

/** A tinted, borderless toolbar button: a glyph, or a text label like "Edit". */
export function BarButton({ label, children, onPress, isDisabled, className }: {
  label: string; children?: ReactNode; onPress?: () => void; isDisabled?: boolean; className?: string;
}) {
  const text = children == null;
  return (
    <Button variant="ghost" aria-label={label} onPress={onPress} isDisabled={isDisabled}
      className={cn('h-9 rounded-ctl text-primary data-hovered:bg-secondary', text ? 'px-2.5 text-body font-normal' : 'w-10 px-0', className)}>
      {children ?? label}
    </Button>
  );
}

/** Translucent bar pinned to the bottom of a column. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="atlas-bottom-bar" className={cn(
      'absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-hairline-t backdrop-blur-[20px] backdrop-saturate-[1.8]',
      className,
    )}>{children}</div>
  );
}

/** A Git branch: two commits joined to a third. */
export function BranchIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} className={cn('shrink-0', className)}
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="7" r="2.2" />
      <path d="M6 7.2v9.6M18 9.2c0 5-6 4-11 7.6" />
    </svg>
  );
}

const glyph = { 'aria-hidden': true, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** A project's folder, outlined; it opens with its row. */
export function FolderIcon({ open, size = 20, className }: { open?: boolean; size?: number; className?: string }) {
  return (
    <svg {...glyph} width={size} height={size} className={cn('shrink-0', className)}>
      {open ? <>
        <path d="M3.5 17.5v-10A1.5 1.5 0 0 1 5 6h3.6l2 2H17a1.5 1.5 0 0 1 1.5 1.5V11" />
        <path d="M3.5 17.5 6 12.1a1.5 1.5 0 0 1 1.36-.87h12.4a.9.9 0 0 1 .82 1.28l-2.4 5.6a1.5 1.5 0 0 1-1.38.9H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      </> : <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h3.6l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />}
    </svg>
  );
}

/** Changes against main: a branch that comes back, as a pull request draws it. */
export function ChangesIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg {...glyph} width={size} height={size} className={cn('shrink-0', className)}>
      <circle cx="6" cy="6" r="2.3" /><circle cx="6" cy="18" r="2.3" /><circle cx="18" cy="18" r="2.3" />
      <path d="M6 8.3v7.4M18 15.7V9a3 3 0 0 0-3-3h-4.5M12.8 3.6 10.4 6l2.4 2.4" />
    </svg>
  );
}

/** GitHub's merged purple (light, dark). */
const MERGED_PURPLE = { light: '#8250df', dark: '#a371f7' } as const;

const CHIP = 'inline-flex h-[18px] shrink-0 items-center rounded-[5px] px-1.5 text-caption2 font-semibold tracking-[.1px]';

export function Chip({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'primary' | 'success' | 'warning' | 'destructive' | 'merged'; className?: string }) {
  const dark = useAppearance() === 'dark';
  return (
    <span style={tone === 'merged' ? { '--atlas-merged': MERGED_PURPLE[dark ? 'dark' : 'light'] } as CSSProperties : undefined} className={cn(CHIP, {
      muted: 'bg-secondary text-muted-foreground',
      primary: 'bg-primary/12 text-primary',
      success: 'bg-success/14 text-success',
      warning: 'bg-warning/16 text-warning',
      destructive: 'bg-destructive/12 text-destructive',
      merged: 'bg-(--atlas-merged)/14 text-(--atlas-merged)',
    }[tone], className)}>{children}</span>
  );
}

const PR_TONE = { open: 'success', merged: 'merged', closed: 'destructive' } as const;

export function PullRequestChip({ pr }: { pr: PullRequest }) {
  return <Chip tone={PR_TONE[pr.state]}>#{pr.number} {pr.state[0].toUpperCase() + pr.state.slice(1)}</Chip>;
}

/** The chips that say what a worktree is before you open it. */
export function WorktreeChips({ w }: { w: Worktree }) {
  return (
    <>
      {w.primary ? <Chip tone="primary">Primary</Chip> : null}
      {w.clone ? <Chip tone="primary">Clone</Chip> : null}
      {w.pullRequest ? <PullRequestChip pr={w.pullRequest} /> : null}
      {w.locked ? <Chip tone="warning">Locked</Chip> : null}
      {w.missing ? <Chip tone="destructive">Missing</Chip> : null}
      {w.unreachable ? <Chip>Outside folders</Chip> : null}
    </>
  );
}

/** `/Users/you/Code/ui` → `~/Code/ui`. */
export const shortPath = (path: string) => path.replace(/^\/(Users|home)\/[^/]+/, '~');

export const branchLabel = (w: Worktree) => w.branch ?? `Detached at ${w.head}`;
