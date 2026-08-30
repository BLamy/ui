/* 05 — ToolChips: tool calls as compact expandable chips */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BChip, BEASE, BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3, vib } from './base';

export interface ToolChip {
  icon: string;
  name: ReactNode;
  detail: ReactNode;
  out: ReactNode;
}
export const TOOL_CHIPS_DEMO: ToolChip[] = [
  { icon: P['term'], name: 'read_pos_export', detail: '3 files · 2.1s', out: 'Parsed 4,182 rows from summer POS exports.' },
  { icon: P['code'], name: 'edit churn.ts', detail: '+18 −4', out: 'Added stockout-risk scoring to the churn model.' },
  { icon: P['globe'], name: 'fetch supplier_api', detail: '200 · 340ms', out: 'cone_king lead time confirmed: 7 days.' },
  { icon: P['doc'], name: 'write reorder.md', detail: 'draft', out: 'Drafted the weekend reorder plan.' },
];

export interface ToolChipsProps {
  tools?: ToolChip[];
  summary?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function ToolChips({
  tools = TOOL_CHIPS_DEMO,
  summary = '4 tool calls, 2 messages',
  style,
  className,
}: ToolChipsProps) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div data-slot="tool-chips" className={cn(className)} style={{ maxWidth: 520, fontFamily: BFONT, ...style }}>
      <div style={{ fontSize: 12, color: mut, marginBottom: 8, fontWeight: 600 }}>{summary}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tools.map((t, i) => (
          <BChip
            key={i}
            active={open === i}
            onPress={() => {
              setOpen(open === i ? null : i);
              vib([5]);
            }}
          >
            <span style={{ color: C.blue, display: 'grid' }}>
              <BIcon d={t.icon} size={12} />
            </span>
            <span style={{ fontFamily: BMONO, fontSize: 11.5 }}>{t.name}</span>
            <span style={{ color: mut3, fontSize: 11 }}>{t.detail}</span>
          </BChip>
        ))}
      </div>
      {open !== null && (
        <div
          key={open}
          style={{
            ...card({ padding: '10px 13px', borderRadius: 10, marginTop: 8 }),
            fontSize: 12.5,
            color: mut,
            animation: 'bui-in .2s ' + BEASE,
          }}
        >
          <span style={{ color: C.green, marginRight: 7, display: 'inline-grid', verticalAlign: '-2px' }}>
            <BIcon d={P['check']} size={12} sw={2.4} />
          </span>
          {tools[open].out}
        </div>
      )}
    </div>
  );
}
