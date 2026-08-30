/* 15 — SearchPalette: command search with live filtering + empty state */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { BEASE, BFONT, BIcon, C, P, card, cn, mut3, vib } from './base';

export const SEARCH_PALETTE_COMMANDS_DEMO = [
  'Forecast summer demand',
  'Find waffle cone suppliers',
  'Compare seasonal flavors',
  'Draft flavor launch plan',
  'Check cold-chain status',
];

export interface SearchPaletteProps {
  commands?: string[];
  placeholder?: string;
  onSelect?: (command: string) => void;
  onAskAgent?: (query: string) => void;
  style?: CSSProperties;
  className?: string;
}
export function SearchPalette({
  commands = SEARCH_PALETTE_COMMANDS_DEMO,
  placeholder = 'Search commands…',
  onSelect,
  onAskAgent,
  style,
  className,
}: SearchPaletteProps) {
  const [q, setQ] = useState('');
  const hits = commands.filter((c) => c.toLowerCase().includes(q.toLowerCase()));
  return (
    <div data-slot="search-palette" className={cn(className)} style={{ ...card({ maxWidth: 420, overflow: 'hidden' }), ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '11px 14px',
          borderBottom: '1px solid var(--wb-sep)',
        }}
      >
        <span style={{ color: mut3, display: 'grid' }}>
          <BIcon d={P['search']} size={15} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoFocus={false}
          style={{ border: 0, background: 'none', outline: 'none', color: 'var(--wb-label)', fontSize: 13.5, fontFamily: BFONT, flex: 1 }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Clear"
            style={{ border: 0, background: 'none', color: mut3, cursor: 'pointer', padding: 2, display: 'grid' }}
          >
            <BIcon d={P['x']} size={13} />
          </button>
        )}
      </div>
      <div style={{ padding: 6, minHeight: 120 }}>
        {hits.map((c) => (
          <button
            key={c}
            className="bui-hl"
            onClick={() => {
              vib([6]);
              onSelect && onSelect(c);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              border: 0,
              borderRadius: 8,
              background: 'none',
              color: 'var(--wb-label)',
              fontSize: 13,
              padding: '8px 10px',
              cursor: 'pointer',
              fontFamily: BFONT,
              textAlign: 'left',
              animation: 'bui-in .18s ' + BEASE,
            }}
          >
            <span style={{ color: C.blue, display: 'grid' }}>
              <BIcon d={P['bolt']} size={13} />
            </span>
            {c}
          </button>
        ))}
        {!hits.length && (
          <div style={{ padding: '26px 0', textAlign: 'center', fontSize: 12.5, color: mut3 }}>
            No commands match “{q}”.
            <br />
            <button
              onClick={() => {
                vib([6]);
                onAskAgent && onAskAgent(q);
              }}
              style={{
                border: 0,
                background: 'none',
                color: C.blue,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: BFONT,
                marginTop: 6,
              }}
            >
              Ask the agent instead →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
