/* 04 — ApprovalCard: human-in-the-loop question */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, C, P, card, cn, mut3, vib } from './base';

export interface ApprovalCardProps {
  question?: ReactNode;
  options?: string[];
  onPick?: (option: string) => void;
  style?: CSSProperties;
  className?: string;
}
export function ApprovalCard({
  question = 'How many flavors should we launch?',
  options = ['Three (core line)', 'Five (full case)', 'Just one hero'],
  onPick,
  style,
  className,
}: ApprovalCardProps) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div data-slot="approval-card" className={cn(className)} style={card({ padding: 16, maxWidth: 420, ...style })}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ color: C.orange, display: 'grid', marginTop: 1 }}>
          <BIcon d={P['spark']} size={15} />
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--wb-label)', lineHeight: 1.4 }}>{question}</div>
      </div>
      {picked === null ? (
        <div style={{ display: 'grid', gap: 7 }}>
          {options.map((o, i) => (
            <button
              key={i}
              className="bui-hl"
              onClick={() => {
                setPicked(i);
                vib([10]);
                onPick && onPick(o);
              }}
              style={{
                ...card({ padding: '9px 13px', borderRadius: 10 }),
                textAlign: 'left',
                fontSize: 13,
                color: 'var(--wb-label)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
              }}
            >
              <span
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: '50%',
                  border: '1.5px solid var(--wb-fill2)',
                  flexShrink: 0,
                }}
              />
              {o}
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '9px 13px',
            borderRadius: 10,
            background: 'rgba(50,215,75,.09)',
            border: '1px solid rgba(50,215,75,.25)',
            animation: 'bui-in .25s ' + BEASE,
          }}
        >
          <span style={{ color: C.green, display: 'grid' }}>
            <BIcon d={P['check']} size={15} sw={2.4} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--wb-label)', flex: 1 }}>{options[picked]}</span>
          <button
            onClick={() => setPicked(null)}
            style={{
              border: 0,
              background: 'none',
              color: mut3,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BFONT,
            }}
          >
            Change
          </button>
        </div>
      )}
    </div>
  );
}
