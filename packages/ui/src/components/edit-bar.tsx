import type { CSSProperties } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cn } from '../lib/utils';

export interface EditBarProps {
  count: number;
  allFav?: boolean;
  onFav?: () => void;
  onDelete?: () => void;
  className?: string;
  style?: CSSProperties;
}

const action = 'bl-btn cursor-pointer border-0 bg-transparent px-1 py-2 [font-family:inherit] text-[16.5px] data-disabled:opacity-35';

export function EditBar({ count, allFav, onFav, onDelete, className, style }: EditBarProps) {
  return (
    <div data-slot="edit-bar"
      className={cn(
        'absolute inset-x-0 bottom-0 z-130 box-border flex h-[62px] items-center [border-top:1px_solid_var(--bl-sep)] bg-bl-bar px-4 pt-0 pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7]',
        className,
      )}
      style={style}>
      <AriaButton className={cn(action, 'text-primary')} isDisabled={!count} onPress={onFav}>{allFav ? 'Unfavorite' : 'Favorite'}</AriaButton>
      <span className="flex-1 text-center text-[13px] text-muted-foreground">{count ? count + ' selected' : 'Select items'}</span>
      <AriaButton className={cn(action, 'text-destructive')} isDisabled={!count} onPress={onDelete}>Delete</AriaButton>
    </div>
  );
}
