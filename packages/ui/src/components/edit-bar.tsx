'use client';
import type { CSSProperties } from 'react';
import { Toolbar, ToolbarButton } from '@ui-sdk/react/toolbar';
import { cn } from '@/lib/utils';

export interface EditBarProps {
  count: number;
  allFav?: boolean;
  onFav?: () => void;
  onDelete?: () => void;
  className?: string;
  style?: CSSProperties;
}

const action = 'bl-btn cursor-pointer border-0 bg-transparent px-1 py-2 [font-family:inherit] text-[16.5px] data-disabled:opacity-35';

/* ══ EditBar — the bottom bar of a list in edit mode ══
   Favorite and Delete around the selection count, as a UI SDK Toolbar (one tab stop, arrow keys between the two
   actions). Both are disabled, but stay focusable, while nothing is selected. */
export function EditBar({ count, allFav, onFav, onDelete, className, style }: EditBarProps) {
  return (
    <Toolbar aria-label="Edit"
      className={cn(
        'absolute inset-x-0 bottom-0 z-130 box-border flex h-[62px] items-center [border-top:1px_solid_var(--border)] bg-bar px-4 pt-0 pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7]',
        className,
      )}
      style={style}>
      <ToolbarButton className={cn(action, 'text-primary')} disabled={!count} onClick={onFav}>{allFav ? 'Unfavorite' : 'Favorite'}</ToolbarButton>
      <span className="flex-1 text-center text-footnote text-muted-foreground">{count ? count + ' selected' : 'Select items'}</span>
      <ToolbarButton className={cn(action, 'text-destructive')} disabled={!count} onClick={onDelete}>Delete</ToolbarButton>
    </Toolbar>
  );
}
