/* 12 — RecordsTable: CRM grid with tags + connection strength */
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BMONO, C, card, cn, mut, mut3 } from './base';

export type RecordRow = [string, ReactNode, string[], ReactNode, number];
export const RECORDS_DEMO: RecordRow[] = [
  ['Aurora Scoops', 'Reykjavík', ['Gelato', 'Seasonal'], '9 days ago', 5],
  ['Kumo Creamery', 'Tokyo', ['B2C', 'Cafe', 'Vegan'], '3 weeks ago', 5],
  ['Coral Coast Sorbet', 'Honolulu', ['Sorbet', 'Local'], '9 days ago', 5],
  ['Ember Cone Company', 'Seoul', ['B2C', 'Vegan'], '15 days ago', 2],
  ['Maple Orbit', 'Montréal', ['B2B', 'Wholesale'], '15 days ago', 2],
  ['Blue Fig Gelato', 'Florence', ['Gelato', 'Cafe'], 'over 1 year ago', 1],
  ['Cacao Norte', 'Oaxaca', ['B2B', 'Local'], 'about 2 years ago', 0],
];

export interface StrengthProps {
  v: number;
}
export function Strength({ v }: StrengthProps) {
  return (
    <span data-slot="strength" style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: 4 + i * 2,
            borderRadius: 1,
            background: i < v ? (v >= 4 ? C.green : v >= 2 ? C.orange : C.red) : 'var(--wb-fill2)',
          }}
        />
      ))}
    </span>
  );
}

export interface RecordsTableProps {
  records?: RecordRow[];
  headers?: ReactNode[];
  footer?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function RecordsTable({
  records = RECORDS_DEMO,
  headers = ['Company', 'Categories', 'Last interaction', 'Strength'],
  footer = '26 records · 44% avg strength · 19 links',
  style,
  className,
}: RecordsTableProps) {
  const cell: CSSProperties = { padding: '8px 12px', fontSize: 12.5, textAlign: 'left', whiteSpace: 'nowrap' };
  return (
    <div
      data-slot="records-table"
      style={{ ...card({ overflow: 'auto', maxWidth: 560 }), fontFamily: BFONT, ...style }}
      className={cn('wb-scroll', className)}
    >
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
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
          {records.map(([name, city, tags, last, v], i) => (
            <tr
              key={name}
              className="bui-hl"
              style={{ borderBottom: i < records.length - 1 ? '1px solid var(--wb-sep)' : 'none', cursor: 'default' }}
            >
              <td style={cell}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: 'var(--wb-fill2)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: mut,
                    }}
                  >
                    {name[0]}
                  </span>
                  <span>
                    <span style={{ color: 'var(--wb-label)', fontWeight: 600 }}>{name}</span>
                    <span style={{ color: mut3 }}> — {city}</span>
                  </span>
                </span>
              </td>
              <td style={cell}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  {tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: mut,
                        background: 'var(--wb-fill)',
                        borderRadius: 5,
                        padding: '1.5px 6px',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </span>
              </td>
              <td style={{ ...cell, color: mut }}>{last}</td>
              <td style={cell}>
                <Strength v={v} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          padding: '7px 12px',
          fontSize: 11,
          color: mut3,
          borderTop: '1px solid var(--wb-sep)',
          fontFamily: BMONO,
        }}
      >
        {footer}
      </div>
    </div>
  );
}
