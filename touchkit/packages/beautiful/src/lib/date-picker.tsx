/* 30 — DatePicker: month grid */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { BFONT, BIcon, C, P, card, cn, mut, mut3, vib } from './base';

export interface DatePickerProps {
  value?: Date | null;
  onChange?: (d: Date) => void;
  style?: CSSProperties;
  className?: string;
}
export function DatePicker({ value, onChange, style, className }: DatePickerProps) {
  const today = new Date();
  const [view, setView] = useState(() => new Date((value || today).getFullYear(), (value || today).getMonth(), 1));
  const y = view.getFullYear(),
    m = view.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const same = (d: number) => !!value && d === value.getDate() && m === value.getMonth() && y === value.getFullYear();
  const isToday = (d: number) => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  return (
    <div data-slot="date-picker" className={cn(className)} style={{ ...card({ padding: 12, width: 250 }), fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <button
          className="bui-hl"
          onClick={() => {
            setView(new Date(y, m - 1, 1));
            vib([4]);
          }}
          aria-label="Previous month"
          style={{
            border: 0,
            background: 'none',
            color: mut,
            cursor: 'pointer',
            padding: 5,
            borderRadius: 7,
            display: 'grid',
            transform: 'rotate(180deg)',
          }}
        >
          <BIcon d={P['chev']} size={13} />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)' }}>
          {view.toLocaleString('en', { month: 'long' })} {y}
        </span>
        <button
          className="bui-hl"
          onClick={() => {
            setView(new Date(y, m + 1, 1));
            vib([4]);
          }}
          aria-label="Next month"
          style={{ border: 0, background: 'none', color: mut, cursor: 'pointer', padding: 5, borderRadius: 7, display: 'grid' }}
        >
          <BIcon d={P['chev']} size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} style={{ fontSize: 9.5, fontWeight: 700, color: mut3, padding: '2px 0' }}>
            {d}
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={'e' + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          return (
            <button
              key={d}
              onClick={() => {
                vib([5]);
                onChange && onChange(new Date(y, m, d));
              }}
              className={same(d) ? '' : 'bui-hl'}
              style={{
                border: 0,
                borderRadius: 7,
                padding: '5px 0',
                fontSize: 11.5,
                cursor: 'pointer',
                fontFamily: BFONT,
                background: same(d) ? C.blue : 'none',
                color: same(d) ? '#fff' : isToday(d) ? C.blue : 'var(--wb-label)',
                fontWeight: same(d) || isToday(d) ? 700 : 400,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
