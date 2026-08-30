import type { CSSProperties } from 'react';
import { Icon } from '../lib/icon';
import { cn } from '../lib/utils';

export interface SearchFieldProps {
  q: string;
  setQ: (q: string) => void;
  placeholder?: string;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

export function SearchField({ q, setQ, placeholder = 'Search', className, style, ...rest }: SearchFieldProps) {
  return (
    <div data-slot="search-field" className={cn(className)}
      style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--tk-fill)', borderRadius: 11, padding: '7px 9px', ...style }}>
      <Icon name="search" size={17} sw={2.2} style={{ color: 'var(--tk-label2)' }} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={rest['aria-label'] || 'Search'}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 17,
          color: 'var(--tk-label)', padding: 0, minWidth: 0, userSelect: 'text', WebkitUserSelect: 'text',
        }} />
      {q ? (
        <button className="tk-btn" onClick={() => setQ('')} aria-label="Clear search"
          style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--tk-label3)', display: 'grid' }}>
          <Icon name="xcirc" size={18} />
        </button>
      ) : null}
    </div>
  );
}
