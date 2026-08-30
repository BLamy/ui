/* 17 — CodeBlockStream: agent-written code streaming line by line */
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3, vib } from './base';

export const CODE_STREAM_DEMO = `export function churnRisk(skus: Sku[]) {
  return skus
    .map(s => ({
      ...s,
      risk: s.velocity * leadDays(s.supplier) / s.stock,
    }))
    .filter(s => s.risk > 0.7)
    .sort((a, b) => b.risk - a.risk)
}`;

export interface CodeBlockStreamProps {
  code?: string;
  filename?: ReactNode;
  language?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function CodeBlockStream({
  code = CODE_STREAM_DEMO,
  filename = 'churn.ts',
  language = 'TYPESCRIPT',
  style,
  className,
}: CodeBlockStreamProps) {
  const lines = code.split('\n');
  const [n, setN] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (n >= lines.length) return;
    const t = setTimeout(() => setN((x) => x + 1), 260);
    return () => clearTimeout(t);
  }, [n, lines.length]);
  const shown = lines.slice(0, n).join('\n');
  return (
    <div
      data-slot="code-block-stream"
      className={cn(className)}
      style={{ ...card({ maxWidth: 520, overflow: 'hidden' }), '--mdc-pre': '#101014', ...style } as CSSProperties}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: '1px solid var(--wb-sep)' }}
      >
        <span style={{ color: C.blue, display: 'grid' }}>
          <BIcon d={P['code']} size={14} />
        </span>
        <span style={{ fontFamily: BMONO, fontSize: 12, color: 'var(--wb-label)' }}>{filename}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: mut3, letterSpacing: '.4px' }}>{language}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {n < lines.length && <span style={{ fontFamily: BMONO, fontSize: 10.5, color: C.blue }}>streaming…</span>}
          <button
            onClick={() => {
              setCopied(true);
              vib([6]);
              setTimeout(() => setCopied(false), 1200);
              try {
                navigator.clipboard.writeText(code);
              } catch (e) {
                /* noop */
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              border: 0,
              background: 'none',
              color: copied ? C.green : mut,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BFONT,
              padding: 0,
            }}
          >
            <BIcon d={copied ? P['check'] : P['copy']} size={12} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div style={{ padding: '2px 13px' }}>
        <pre style={{ fontFamily: BMONO, fontSize: 12, color: '#D8D8E2', lineHeight: 1.55 }}>{shown}</pre>
      </div>
      {n >= lines.length && (
        <div style={{ padding: '0 13px 10px' }}>
          <button
            onClick={() => setN(0)}
            style={{
              border: 0,
              background: 'none',
              color: C.blue,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BFONT,
              padding: 0,
            }}
          >
            Replay
          </button>
        </div>
      )}
    </div>
  );
}
