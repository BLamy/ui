/* 11 — DiffTable: AI-proposed edits sweeping through rows */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BMONO, C, card, cn, mut, mut3, vib } from './base';

export type DiffKind = 'remove' | 'add' | 'keep';
export type DiffRow = [string, ReactNode, ReactNode, DiffKind];
export const DIFF_ROWS_DEMO: DiffRow[] = [
  ['Rocky Road', 'Classic', 'aurora-scoops', 'remove'],
  ['Bubblegum', 'Retro', 'kumo-creamery', 'remove'],
  ['Mint Chip', 'Classic', 'maple-orbit', 'keep'],
  ['Pistachio', 'Seasonal', 'maple-orbit', 'add'],
];

export interface DiffTableProps {
  rows?: DiffRow[];
  title?: ReactNode;
  headers?: ReactNode[];
  applyLabel?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function DiffTable({
  rows = DIFF_ROWS_DEMO,
  title = 'Proposed menu cleanup',
  headers = ['Flavor', 'Category', 'Supplier', ''],
  applyLabel = 'Apply sweep',
  style,
  className,
}: DiffTableProps) {
  const [sweep, setSweep] = useState(-1);
  const run = () => {
    vib([8]);
    let i = 0;
    setSweep(0);
    const t = setInterval(() => {
      i++;
      if (i > rows.length) {
        clearInterval(t);
      } else setSweep(i);
    }, 380);
  };
  const cell: CSSProperties = { padding: '8px 12px', fontSize: 12.5, textAlign: 'left' };
  return (
    <div data-slot="diff-table" className={cn(className)} style={{ maxWidth: 520, fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--wb-label)', flex: 1 }}>{title}</span>
        <button
          onClick={run}
          style={{
            border: 0,
            borderRadius: 8,
            padding: '6px 13px',
            fontSize: 12,
            fontWeight: 650,
            background: C.blue,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: BFONT,
          }}
        >
          {applyLabel}
        </button>
      </div>
      <div style={card({ overflow: 'hidden' })}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--wb-sep)' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    ...cell,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '.5px',
                    textTransform: 'uppercase',
                    color: mut3,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([f, c, s, kind], i) => {
              const hit = sweep > i;
              const bg = !hit
                ? 'transparent'
                : kind === 'remove'
                  ? 'rgba(255,69,58,.09)'
                  : kind === 'add'
                    ? 'rgba(50,215,75,.09)'
                    : 'transparent';
              return (
                <tr
                  key={f}
                  style={{
                    borderBottom: i < rows.length - 1 ? '1px solid var(--wb-sep)' : 'none',
                    background: bg,
                    transition: 'background .3s',
                  }}
                >
                  <td
                    style={{
                      ...cell,
                      color: 'var(--wb-label)',
                      fontWeight: 600,
                      textDecoration: hit && kind === 'remove' ? 'line-through' : 'none',
                      opacity: hit && kind === 'remove' ? 0.5 : 1,
                    }}
                  >
                    {f}
                  </td>
                  <td style={{ ...cell, color: mut }}>{c}</td>
                  <td style={{ ...cell, color: mut, fontFamily: BMONO, fontSize: 11.5 }}>{s}</td>
                  <td style={{ ...cell, width: 60 }}>
                    {hit && kind !== 'keep' && (
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: kind === 'remove' ? C.red : C.green }}>
                        {kind === 'remove' ? '− drop' : '+ add'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
