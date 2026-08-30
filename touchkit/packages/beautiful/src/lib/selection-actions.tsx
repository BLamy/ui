/* 19 — SelectionActions: highlight text, hand it to the agent */
import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BMONO, C, card, cn, mut3, vib } from './base';

export const SELECTION_TEXT_DEMO =
  'Pistachio holds the top slot all weekend. Churn it first thing Saturday so the batch has time to firm up before the afternoon rush.';

export interface SelectionActionsProps {
  children?: ReactNode;
  actions?: string[];
  hint?: ReactNode;
  onAction?: (action: string, text: string) => void;
  style?: CSSProperties;
  className?: string;
}
export function SelectionActions({
  children = SELECTION_TEXT_DEMO,
  actions = ['Explain', 'Improve', 'Shorten', 'Tone'],
  hint = 'Select any passage above ↑',
  onAction,
  style,
  className,
}: SelectionActionsProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [bar, setBar] = useState<{ x: number; y: number; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const onUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !boxRef.current || !boxRef.current.contains(sel.anchorNode)) {
      setBar(null);
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect(),
      b = boxRef.current.getBoundingClientRect();
    setBar({
      x: Math.max(10, Math.min(r.left - b.left + r.width / 2, b.width - 150)),
      y: r.top - b.top,
      text: sel.toString(),
    });
    vib([5]);
  };
  const act = (a: string) => {
    if (!bar) return;
    setNote(a + ' → “' + bar.text.slice(0, 42) + (bar.text.length > 42 ? '…' : '') + '”');
    onAction && onAction(a, bar.text);
    setBar(null);
    vib([8]);
    try {
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      /* noop */
    }
  };
  return (
    <div data-slot="selection-actions" className={cn(className)} style={{ maxWidth: 480, fontFamily: BFONT, ...style }}>
      <div
        ref={boxRef}
        onMouseUp={onUp}
        onTouchEnd={onUp}
        style={{
          ...card({ padding: '14px 16px' }),
          position: 'relative',
          fontSize: 13.5,
          lineHeight: 1.7,
          color: 'var(--wb-label)',
          userSelect: 'text',
          cursor: 'text',
        }}
      >
        {children}
        {bar && (
          <div
            style={{
              position: 'absolute',
              left: bar.x,
              top: bar.y - 40,
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 2,
              background: '#0C0C10',
              border: '1px solid var(--wb-sep)',
              borderRadius: 10,
              padding: 3,
              boxShadow: '0 10px 28px rgba(0,0,0,.5)',
              zIndex: 6,
              animation: 'bui-in .15s ' + BEASE,
            }}
          >
            {actions.map((a) => (
              <button
                key={a}
                onClick={() => act(a)}
                style={{
                  border: 0,
                  background: 'none',
                  color: '#EDEDF2',
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '5px 9px',
                  borderRadius: 7,
                  cursor: 'pointer',
                  fontFamily: BFONT,
                }}
                onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,.09)')}
                onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = 'none')}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: note ? C.blue : mut3, marginTop: 9, fontFamily: BMONO, minHeight: 16 }}>
        {note || hint}
      </div>
    </div>
  );
}
