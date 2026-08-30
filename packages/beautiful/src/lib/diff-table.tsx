/* 11 — DiffTable: a compatibility wrapper around @pierre/diffs */
import { MultiFileDiff } from '@pierre/diffs/react';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, C, cn, vib } from './base';

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

const pierreOptions = {
  diffStyle: 'unified' as const,
  diffIndicators: 'bars' as const,
  hunkSeparators: 'line-info' as const,
  overflow: 'scroll' as const,
  themeType: 'dark' as const,
};

function text(value: ReactNode) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function csvCell(value: ReactNode) {
  return `"${text(value).replaceAll('"', '""')}"`;
}

function csv(rows: DiffRow[], headers: ReactNode[], side: 'old' | 'new') {
  const visible = rows.filter(([, , , kind]) =>
    side === 'old' ? kind !== 'add' : kind !== 'remove',
  );
  return [headers.slice(0, 3).map(csvCell).join(','), ...visible.map((row) => row.slice(0, 3).map(csvCell).join(','))].join('\n');
}

export function DiffTable({
  rows = DIFF_ROWS_DEMO,
  title = 'Proposed menu cleanup',
  headers = ['Flavor', 'Category', 'Supplier', ''],
  applyLabel = 'Apply changes',
  style,
  className,
}: DiffTableProps) {
  const [applied, setApplied] = useState(false);
  const oldFile = { name: 'menu.csv', contents: csv(rows, headers, 'old') };
  const newFile = { name: 'menu.csv', contents: csv(rows, headers, 'new') };

  return (
    <div data-slot="diff-table" data-renderer="pierre-diffs" className={cn(className)} style={{ maxWidth: 620, fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--wb-label)', flex: 1 }}>{title}</span>
        <button
          type="button"
          onClick={() => {
            vib([8]);
            setApplied(true);
          }}
          disabled={applied}
          style={{
            border: 0,
            borderRadius: 8,
            padding: '6px 13px',
            fontSize: 12,
            fontWeight: 650,
            background: applied ? 'var(--wb-fill2)' : C.blue,
            color: applied ? 'var(--wb-label2)' : '#fff',
            cursor: applied ? 'default' : 'pointer',
            fontFamily: BFONT,
          }}
        >
          {applied ? 'Applied' : applyLabel}
        </button>
      </div>
      <div style={{ border: '1px solid var(--wb-sep)', borderRadius: 10, overflow: 'hidden' }}>
        <MultiFileDiff oldFile={oldFile} newFile={newFile} options={pierreOptions} />
      </div>
    </div>
  );
}
