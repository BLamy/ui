/* 13 — FilterTable: status chips reorganizing live data */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BChip, BEASE, BFONT, BMONO, C, card, cn, mut, mut3, vib } from './base';

export type FilterRow = [string, ReactNode, string, ReactNode];
export const FILTER_ROWS_DEMO: FilterRow[] = [
  ['Restock mango sorbet', 'Dec 03', 'To do', 'Mango Moon Gelato'],
  ['Churn black sesame', 'Sep 22', 'In Progress', 'Kumo Creamery'],
  ['Print summer menu', 'Jan 02', 'To do', 'Coral Coast Sorbet'],
  ['Taste-test batch 42', 'Nov 08', 'In Progress', 'Maple Orbit'],
  ['Order waffle cones', 'Apr 14', 'Completed', 'Aurora Scoops'],
];
export const FILTER_STATUS_TONES: Record<string, string> = {
  'To do': mut,
  'In Progress': C.orange,
  Completed: C.green,
};

export interface FilterTableProps {
  rows?: FilterRow[];
  statuses?: string[];
  tones?: Record<string, string>;
  headers?: ReactNode[];
  emptyLabel?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function FilterTable({
  rows: allRows = FILTER_ROWS_DEMO,
  statuses = ['All', 'To do', 'In Progress', 'Completed'],
  tones = FILTER_STATUS_TONES,
  headers = ['Task name', 'Date', 'Status', 'Advisor'],
  emptyLabel = 'Nothing here.',
  style,
  className,
}: FilterTableProps) {
  const [f, setF] = useState('All');
  const rows = allRows.filter((r) => f === 'All' || r[2] === f);
  const cell: CSSProperties = { padding: '8px 12px', fontSize: 12.5, textAlign: 'left' };
  return (
    <div data-slot="filter-table" className={cn(className)} style={{ maxWidth: 540, fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {statuses.map((o) => {
          const n = o === 'All' ? allRows.length : allRows.filter((r) => r[2] === o).length;
          return (
            <BChip
              key={o}
              active={f === o}
              onPress={() => {
                setF(o);
                vib([5]);
              }}
            >
              {o}
              <span style={{ fontFamily: BMONO, fontSize: 10.5, color: mut3 }}>{n}</span>
            </BChip>
          );
        })}
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
            {rows.map(([t, d, s, a], i) => (
              <tr
                key={t}
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid var(--wb-sep)' : 'none',
                  animation: 'bui-in .25s ' + BEASE,
                }}
              >
                <td style={{ ...cell, color: 'var(--wb-label)', fontWeight: 600 }}>{t}</td>
                <td style={{ ...cell, color: mut, fontFamily: BMONO, fontSize: 11.5 }}>{d}</td>
                <td style={cell}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tones[s] }}>{s}</span>
                </td>
                <td style={{ ...cell, color: mut }}>{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div style={{ padding: 20, fontSize: 12.5, color: mut3, textAlign: 'center' }}>{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}
