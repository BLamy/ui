/* 09 — RecommendationCard: suggestion + confidence + accept */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, BMONO, C, Meter, P, card, cn, mut, mut3, vib } from './base';

const codeStyle: CSSProperties = {
  fontFamily: BMONO,
  fontSize: 11.5,
  background: 'var(--wb-fill)',
  borderRadius: 5,
  padding: '1px 5px',
};

export interface RecommendationAlternative {
  label: ReactNode;
  tag: ReactNode;
  tone: string;
}
export const RECOMMENDATION_ALTS_DEMO: RecommendationAlternative[] = [
  { label: 'Switch to vanilla_madagascar', tag: 'Needs review', tone: C.orange },
  { label: 'Full restock across every SKU', tag: 'No signal', tone: mut3 },
];

export interface RecommendationCardProps {
  title?: ReactNode;
  description?: ReactNode;
  alternatives?: RecommendationAlternative[];
  confidence?: number;
  confidenceTone?: string;
  confidenceLabel?: ReactNode;
  acceptLabel?: ReactNode;
  acceptedLabel?: ReactNode;
  onAccept?: (accepted: boolean) => void;
  style?: CSSProperties;
  className?: string;
}
export function RecommendationCard({
  title = 'Want me to place this restock order?',
  description = (
    <>
      Reorder waffle cones from <code style={codeStyle}>cone_king</code> with lead time{' '}
      <code style={codeStyle}>7_days</code>.
    </>
  ),
  alternatives = RECOMMENDATION_ALTS_DEMO,
  confidence = 0.88,
  confidenceTone = C.green,
  confidenceLabel = 'High confidence',
  acceptLabel = 'Accept',
  acceptedLabel = '✓ Ordered',
  onAccept,
  style,
  className,
}: RecommendationCardProps) {
  const [alts, setAlts] = useState(false);
  const [state, setState] = useState<'idle' | 'done'>('idle');
  return (
    <div data-slot="recommendation-card" className={cn(className)} style={card({ padding: 16, maxWidth: 440, ...style })}>
      <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--wb-label)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: mut, lineHeight: 1.6, marginBottom: 12 }}>{description}</div>
      <button
        onClick={() => {
          setAlts((a) => !a);
          vib([4]);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          border: 0,
          background: 'none',
          color: mut,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          fontFamily: BFONT,
          marginBottom: alts ? 8 : 12,
        }}
      >
        Other options
        <span style={{ display: 'grid', transform: alts ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}>
          <BIcon d={P['chevD']} size={12} />
        </span>
      </button>
      {alts && (
        <div style={{ display: 'grid', gap: 5, marginBottom: 12, animation: 'bui-in .2s ' + BEASE }}>
          {alternatives.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: mut,
                padding: '6px 10px',
                borderRadius: 9,
                background: 'var(--wb-fill)',
              }}
            >
              <span style={{ flex: 1 }}>{a.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: a.tone }}>{a.tag}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Meter v={confidence} tone={confidenceTone} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: confidenceTone }}>{confidenceLabel}</span>
        <button
          onClick={() => {
            const next = state === 'done' ? 'idle' : 'done';
            setState(next);
            vib([12]);
            onAccept && onAccept(next === 'done');
          }}
          style={{
            marginLeft: 'auto',
            border: 0,
            borderRadius: 9,
            padding: '7px 16px',
            fontSize: 12.5,
            fontWeight: 650,
            cursor: 'pointer',
            fontFamily: BFONT,
            background: state === 'done' ? 'rgba(50,215,75,.15)' : C.blue,
            color: state === 'done' ? C.green : '#fff',
            transition: 'all .2s',
          }}
        >
          {state === 'done' ? acceptedLabel : acceptLabel}
        </button>
      </div>
    </div>
  );
}
