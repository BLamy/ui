/* 10 — ContextCards: retrieved knowledge chunks with sources */
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BMONO, C, card, cn, mut, mut3 } from './base';

export interface ContextChunk {
  t: ReactNode;
  n: ReactNode;
  body: ReactNode;
  file: ReactNode;
  kind: ReactNode;
  tone: string;
}
export const CONTEXT_CHUNKS_DEMO: ContextChunk[] = [
  {
    t: 'Vendor onboarding rule',
    n: '290 characters',
    body: 'Cold-chain certification must be verified before a new dairy can be added to the reorder workflow.',
    file: 'Dairy Onboarding SOP.pdf',
    kind: 'PDF',
    tone: C.red,
  },
  {
    t: 'Seasonal demand row',
    n: '1,250 characters',
    body: 'Q4 velocity table: pistachio +18%, vanilla +6%, rocky road −11%; retire flavors below 40 scoops weekly.',
    file: 'Sales Velocity Export.csv',
    kind: 'CSV',
    tone: C.green,
  },
];

export interface ContextCardsProps {
  chunks?: ContextChunk[];
  title?: ReactNode;
  count?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function ContextCards({
  chunks = CONTEXT_CHUNKS_DEMO,
  title = 'All chunks',
  count = 32,
  style,
  className,
}: ContextCardsProps) {
  return (
    <div data-slot="context-cards" className={cn(className)} style={{ maxWidth: 520, fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)' }}>{title}</span>
        <span
          style={{
            fontFamily: BMONO,
            fontSize: 11,
            color: mut3,
            background: 'var(--wb-fill)',
            borderRadius: 6,
            padding: '1px 6px',
          }}
        >
          {count}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {chunks.map((c, i) => (
          <div key={i} style={card({ padding: '12px 14px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)' }}>{c.t}</span>
              <span style={{ fontFamily: BMONO, fontSize: 10.5, color: mut3 }}>{c.n}</span>
            </div>
            <div style={{ fontSize: 12.5, color: mut, lineHeight: 1.55, marginBottom: 9 }}>{c.body}</div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                color: mut,
                border: '1px solid var(--wb-sep)',
                borderRadius: 7,
                padding: '3px 8px',
              }}
            >
              <span style={{ fontSize: 9.5, fontWeight: 800, color: c.tone }}>{c.kind}</span>
              {c.file}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
