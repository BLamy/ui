/* 31 — Combobox: filtering input + listbox with keyboard nav */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { BEASE, BFONT, BIcon, C, P, card, cn, mut3, vib } from './base';

export interface ComboboxProps {
  options?: string[];
  value?: string | null;
  onChange?: (o: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
}
export function Combobox({ options = [], value, onChange, placeholder = 'Search…', style, className }: ComboboxProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const hits = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  const commit = (o: string) => {
    onChange && onChange(o);
    setQ('');
    setOpen(false);
    vib([6]);
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, hits.length - 1));
      setOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && hits[hi]) commit(hits[hi]);
    else if (e.key === 'Escape') setOpen(false);
  };
  return (
    <div data-slot="combobox" ref={ref} className={cn(className)} style={{ position: 'relative', width: 250, fontFamily: BFONT, ...style }}>
      <div style={{ ...card({ borderRadius: 10, padding: '7px 11px' }), display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: mut3, display: 'grid' }}>
          <BIcon d={P['search']} size={13} />
        </span>
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onKeyDown={key}
          placeholder={value || placeholder}
          style={{
            border: 0,
            background: 'none',
            outline: 'none',
            color: 'var(--wb-label)',
            fontSize: 13,
            fontFamily: BFONT,
            flex: 1,
            minWidth: 0,
          }}
        />
        {value && !q && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.blue }}>✓</span>}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 5,
            zIndex: 30,
            ...card({ padding: 5, background: '#17171D', boxShadow: '0 14px 36px rgba(0,0,0,.5)' }),
            animation: 'bui-in .15s ' + BEASE,
          }}
        >
          {hits.map((o, i) => (
            <button
              key={o}
              onClick={() => commit(o)}
              onMouseEnter={() => setHi(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                border: 0,
                borderRadius: 7,
                padding: '7px 9px',
                cursor: 'pointer',
                fontFamily: BFONT,
                fontSize: 12.5,
                color: 'var(--wb-label)',
                textAlign: 'left',
                background: i === hi ? 'var(--wb-fill2)' : 'none',
              }}
            >
              <span style={{ width: 13, color: C.blue, display: 'grid' }}>
                {value === o ? <BIcon d={P['check']} size={12} sw={2.6} /> : null}
              </span>
              {o}
            </button>
          ))}
          {!hits.length && <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 12, color: mut3 }}>No matches</div>}
        </div>
      )}
    </div>
  );
}
