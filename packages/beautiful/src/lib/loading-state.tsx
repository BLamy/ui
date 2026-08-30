/* 01 — LoadingState: pixel-grid loader + elapsed time; variants grid / dots / orbit */
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BMONO, C, card, cn, mut3 } from './base';

export type LoadingStateVariant = 'grid' | 'dots' | 'orbit';
export interface LoadingStateProps {
  variant?: LoadingStateVariant;
  label?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function LoadingState({ variant = 'grid', label = 'Churning', style, className }: LoadingStateProps) {
  const [t, setT] = useState(0);
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 0.1), 100);
    return () => clearInterval(i);
  }, []);
  useEffect(() => {
    const i = setInterval(() => setSeed((x) => x + 1), 320);
    return () => clearInterval(i);
  }, []);
  const cells = useMemo(() => {
    const r: number[] = [];
    let n = (seed * 2654435761) % 4294967296;
    for (let i = 0; i < 25; i++) {
      n = (n * 1103515245 + 12345) % 2147483648;
      r.push(n / 2147483648);
    }
    return r;
  }, [seed]);
  let gfx: ReactNode;
  if (variant === 'dots')
    gfx = (
      <div style={{ display: 'flex', gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: C.blue,
              animation: 'bui-pulse 1.1s ' + i * 0.18 + 's infinite',
            }}
          />
        ))}
      </div>
    );
  else if (variant === 'orbit')
    gfx = (
      <span
        style={{
          width: 16,
          height: 16,
          border: '2px solid var(--wb-fill2)',
          borderTopColor: C.blue,
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'bui-spin .8s linear infinite',
        }}
      />
    );
  else
    gfx = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 3px)', gap: 1.5 }}>
        {cells.map((v, i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: 3,
              background: C.blue,
              opacity: v > 0.55 ? 0.15 + v * 0.85 : 0.12,
              transition: 'opacity .3s',
            }}
          />
        ))}
      </div>
    );
  return (
    <div
      data-slot="loading-state"
      className={cn(className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        ...card({ padding: '9px 14px', borderRadius: 999 }),
        ...style,
      }}
    >
      {gfx}
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          background:
            'linear-gradient(90deg, var(--wb-label2) 30%, var(--wb-label) 50%, var(--wb-label2) 70%)',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: 'bui-sweep 1.8s linear infinite',
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: BMONO, fontSize: 11.5, color: mut3 }}>{t.toFixed(1)}s</span>
    </div>
  );
}
