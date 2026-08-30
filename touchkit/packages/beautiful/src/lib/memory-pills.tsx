/* 27 — MemoryPills: what the agent currently knows, dismissible */
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, C, P, cn, mut, mut3, vib } from './base';

export interface MemoryPillsProps {
  label?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function MemoryPills({ label = 'Agent context', children, style, className }: MemoryPillsProps) {
  return (
    <div data-slot="memory-pills" className={cn(className)} style={{ fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color: C.purple, display: 'grid' }}>
          <BIcon d={P['brain']} size={13} />
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: mut3 }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

export interface MemoryPillProps {
  icon?: string | ReactNode;
  onDismiss?: () => void;
  children?: ReactNode;
}
export function MemoryPill({ icon, onDismiss, children }: MemoryPillProps) {
  return (
    <span
      data-slot="memory-pill"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid var(--wb-sep)',
        background: 'var(--wb-fill)',
        borderRadius: 999,
        padding: '4px 6px 4px 11px',
        fontSize: 12,
        color: 'var(--wb-label)',
        fontFamily: BFONT,
        animation: 'bui-in .2s ' + BEASE,
      }}
    >
      {icon && (
        <span style={{ color: mut, display: 'grid' }}>
          <BIcon d={typeof icon === 'string' ? P[icon] : (icon as string)} size={12} />
        </span>
      )}
      {children}
      {onDismiss && (
        <button
          onClick={() => {
            vib([5]);
            onDismiss();
          }}
          aria-label="Forget"
          style={{ border: 0, background: 'none', color: mut3, cursor: 'pointer', padding: 2, display: 'grid' }}
        >
          <BIcon d={P['x']} size={10} sw={2.4} />
        </button>
      )}
    </span>
  );
}
MemoryPills.Pill = MemoryPill;
