import type { CSSProperties } from 'react';
import { cn } from '../lib/utils';

export interface EditBarProps {
  count: number;
  allFav?: boolean;
  onFav?: () => void;
  onDelete?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function EditBar({ count, allFav, onFav, onDelete, className, style }: EditBarProps) {
  const b: CSSProperties = { border: 0, background: 'none', fontFamily: 'inherit', fontSize: 16.5, cursor: 'pointer', padding: '8px 4px' };
  return (
    <div data-slot="edit-bar" className={cn(className)} style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 130, display: 'flex', alignItems: 'center', height: 62,
      padding: '0 16px 4px', boxSizing: 'border-box', background: 'var(--tk-bar)', backdropFilter: 'blur(20px) saturate(1.7)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.7)', borderTop: '1px solid var(--tk-sep)', ...style,
    }}>
      <button className="tk-btn" disabled={!count} onClick={onFav} style={{ ...b, color: 'var(--tk-tint)', opacity: count ? 1 : .35 }}>{allFav ? 'Unfavorite' : 'Favorite'}</button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--tk-label2)' }}>{count ? count + ' selected' : 'Select items'}</span>
      <button className="tk-btn" disabled={!count} onClick={onDelete} style={{ ...b, color: 'var(--tk-red)', opacity: count ? 1 : .35 }}>Delete</button>
    </div>
  );
}
