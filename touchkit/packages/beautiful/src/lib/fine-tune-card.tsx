/* 18 — FineTuneCard: agent-adjustable design inspector */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3 } from './base';

export interface FineTuneCardProps {
  title?: ReactNode;
  previewLabel?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function FineTuneCard({ title = 'Flavor card', previewLabel = 'Pistachio', style, className }: FineTuneCardProps) {
  const [v, setV] = useState({ w: 220, h: 120, r: 16, o: 100 });
  const slider = (key: 'w' | 'h' | 'r' | 'o', label: string, min: number, max: number, unit: string) => (
    <label
      style={{ display: 'grid', gridTemplateColumns: '52px 1fr 44px', gap: 9, alignItems: 'center', fontSize: 11.5, color: mut }}
    >
      <span style={{ fontWeight: 650 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: +e.target.value })}
        style={{ accentColor: C.blue, height: 16 }}
      />
      <span style={{ fontFamily: BMONO, fontSize: 10.5, textAlign: 'right', color: mut3 }}>
        {v[key]}
        {unit}
      </span>
    </label>
  );
  return (
    <div
      data-slot="fine-tune-card"
      className={cn(className)}
      style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start', fontFamily: BFONT, ...style }}
    >
      <div style={{ ...card({ width: 250, padding: 14 }) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <span style={{ color: C.purple, display: 'grid' }}>
            <BIcon d={P['pen']} size={13} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)', flex: 1 }}>{title}</span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: C.blue,
              background: 'rgba(10,132,255,.12)',
              borderRadius: 6,
              padding: '2px 8px',
            }}
          >
            Adjust
          </span>
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '.6px',
            textTransform: 'uppercase',
            color: mut3,
            marginBottom: 8,
          }}
        >
          Layout
        </div>
        <div style={{ display: 'grid', gap: 9 }}>
          {slider('w', 'W', 140, 300, '')}
          {slider('h', 'H', 80, 180, '')}
          {slider('r', 'Radius', 0, 40, '')}
          {slider('o', 'Opacity', 20, 100, '%')}
        </div>
      </div>
      <div
        style={{ width: 300, height: 190, display: 'grid', placeItems: 'center', background: 'var(--wb-fill)', borderRadius: 14 }}
      >
        <div
          style={{
            width: v.w,
            height: v.h,
            borderRadius: v.r,
            opacity: v.o / 100,
            background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            transition: 'border-radius .2s',
            boxShadow: '0 14px 30px -12px rgba(10,132,255,.5)',
          }}
        >
          {previewLabel}
        </div>
      </div>
    </div>
  );
}
