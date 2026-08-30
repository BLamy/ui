/* 16 — InsightCards: paged agent insights with live charts */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, BMONO, C, P, card, cn, mut3, vib } from './base';

export interface Insight {
  t: ReactNode;
  pts: number[];
  tone: string;
}
export const INSIGHTS_DEMO: Insight[] = [
  {
    t: (
      <span>
        The worst performer in your <b style={{ color: C.blue }}>@Creamery</b> is Rocky Road — down{' '}
        <code style={{ fontFamily: BMONO, fontSize: '.9em', color: '#FF6961' }}>−6%</code> or{' '}
        <code style={{ fontFamily: BMONO, fontSize: '.9em', color: '#FF6961' }}>−$2,453</code>.
      </span>
    ),
    pts: [42, 40, 44, 38, 35, 31, 30, 26, 24],
    tone: C.red,
  },
  {
    t: (
      <span>
        Mint Chip is soft too: <code style={{ fontFamily: BMONO, fontSize: '.9em', color: '#FF6961' }}>−4.4%</code>,{' '}
        <code style={{ fontFamily: BMONO, fontSize: '.9em', color: '#FF6961' }}>−$2,378</code> over the same window.
      </span>
    ),
    pts: [30, 32, 29, 31, 28, 29, 27, 26, 27],
    tone: C.orange,
  },
  {
    t: (
      <span>
        Pistachio is the bright spot — <code style={{ fontFamily: BMONO, fontSize: '.9em', color: '#6BE28B' }}>+1.15%</code>,{' '}
        <code style={{ fontFamily: BMONO, fontSize: '.9em', color: '#6BE28B' }}>+$617</code> and climbing on weekends.
      </span>
    ),
    pts: [18, 20, 19, 23, 22, 26, 25, 29, 31],
    tone: C.green,
  },
];

export interface SparkProps {
  pts: number[];
  tone: string;
}
export function Spark({ pts, tone }: SparkProps) {
  const max = Math.max(...pts),
    min = Math.min(...pts);
  const d = pts
    .map(
      (p, i) =>
        (i ? 'L' : 'M') + (i * (200 / (pts.length - 1))).toFixed(1) + ' ' + (44 - ((p - min) / (max - min)) * 38).toFixed(1)
    )
    .join(' ');
  return (
    <svg data-slot="spark" width="100%" height="52" viewBox="0 0 200 52" preserveAspectRatio="none" style={{ display: 'block' }}>
      <path d={d + ' L200 52 L0 52 Z'} fill={tone} opacity="0.1" />
      <path d={d} fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export interface InsightCardsProps {
  insights?: Insight[];
  title?: ReactNode;
  count?: ReactNode;
  prompt?: ReactNode;
  onPrompt?: () => void;
  style?: CSSProperties;
  className?: string;
}
export function InsightCards({
  insights = INSIGHTS_DEMO,
  title = 'Insights',
  count = 3,
  prompt = 'Should I rebalance flavors?',
  onPrompt,
  style,
  className,
}: InsightCardsProps) {
  const [i, setI] = useState(0);
  const ins = insights[i];
  return (
    <div data-slot="insight-cards" className={cn(className)} style={{ ...card({ maxWidth: 420, padding: 16 }), fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)' }}>{title}</span>
        <span
          style={{ fontFamily: BMONO, fontSize: 11, color: mut3, background: 'var(--wb-fill)', borderRadius: 6, padding: '1px 6px' }}
        >
          {count}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {insights.map((_, j) => (
            <button
              key={j}
              onClick={() => {
                setI(j);
                vib([4]);
              }}
              aria-label={'Insight ' + (j + 1)}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                border: 0,
                padding: 0,
                cursor: 'pointer',
                background: j === i ? C.blue : 'var(--wb-fill2)',
              }}
            />
          ))}
        </div>
      </div>
      <div key={i} style={{ animation: 'bui-in .25s ' + BEASE }}>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--wb-label)', marginBottom: 12, minHeight: 40 }}>{ins.t}</div>
        <Spark pts={ins.pts} tone={ins.tone} />
      </div>
      <button
        className="bui-hl"
        onClick={() => {
          vib([6]);
          onPrompt && onPrompt();
        }}
        style={{
          ...card({ padding: '8px 12px', borderRadius: 10, marginTop: 12 }),
          width: '100%',
          textAlign: 'left',
          fontSize: 12.5,
          color: 'var(--wb-label)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {prompt}
        <span style={{ color: mut3, display: 'grid' }}>
          <BIcon d={P['chev']} size={13} />
        </span>
      </button>
    </div>
  );
}
