/* 03 — StreamingText: streamed answer + inline sources + follow-ups */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { BChip } from './base';
import { BEASE, BFONT, BIcon, C, P, card, cn, mut, mut3, vib } from './base';

export const STREAM_TXT =
  'Pistachio is your strongest seasonal climber — up 18% quarter over quarter, with the sharpest lift on weekend afternoons. Rocky Road keeps sliding and now sits below the 40-scoops-weekly retirement line.';

export interface StreamingTextProps {
  text?: string;
  sourcesLabel?: string;
  avatarColors?: string[];
  sources?: string[];
  followUps?: string[];
  onFollowUp?: (q: string) => void;
  style?: CSSProperties;
  className?: string;
}
export function StreamingText({
  text = STREAM_TXT,
  sourcesLabel = '10 sources',
  avatarColors = [C.blue, C.purple, C.teal],
  sources = ['scoopdata.io', 'trends.google.com', 'marketbasket.io'],
  followUps = ['Which flavors sell best in winter', 'Compare gelato and soft serve margins'],
  onFollowUp,
  style,
  className,
}: StreamingTextProps) {
  const [n, setN] = useState(0);
  const words = text.split(' ');
  const [run, setRun] = useState(true);
  useEffect(() => {
    if (!run) return;
    if (n >= words.length) {
      setRun(false);
      return;
    }
    const t = setTimeout(() => setN((x) => x + 1 + (Math.random() < 0.3 ? 1 : 0)), 70);
    return () => clearTimeout(t);
  }, [n, run, words.length]);
  const done = n >= words.length;
  return (
    <div data-slot="streaming-text" className={cn(className)} style={{ maxWidth: 520, fontFamily: BFONT, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex' }}>
          {avatarColors.map((c, i) => (
            <span
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: c,
                border: '2px solid var(--wb-card)',
                marginLeft: i ? -6 : 0,
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, color: mut, fontWeight: 600 }}>{sourcesLabel}</span>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--wb-label)', margin: '0 0 12px', minHeight: 66 }}>
        {words.slice(0, n).join(' ')}
        {!done && (
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 14,
              background: C.blue,
              borderRadius: 2,
              marginLeft: 3,
              verticalAlign: '-2px',
              animation: 'bui-pulse .9s infinite',
            }}
          />
        )}
      </p>
      {done && (
        <div style={{ animation: 'bui-in .3s ' + BEASE }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {sources.map((s) => (
              <BChip key={s} tone={C.teal}>
                <BIcon d={P['globe']} size={12} />
                {s}
              </BChip>
            ))}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.5px',
              textTransform: 'uppercase',
              color: mut3,
              marginBottom: 6,
            }}
          >
            Follow-ups
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {followUps.map((f) => (
              <button
                key={f}
                className="bui-hl"
                onClick={() => {
                  vib([6]);
                  onFollowUp && onFollowUp(f);
                }}
                style={{
                  ...card({ padding: '8px 12px', borderRadius: 10 }),
                  textAlign: 'left',
                  fontSize: 12.5,
                  color: 'var(--wb-label)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {f}
                <span style={{ color: mut3, display: 'grid' }}>
                  <BIcon d={P['chev']} size={13} />
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setN(0);
              setRun(true);
            }}
            style={{
              border: 0,
              background: 'none',
              color: C.blue,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              marginTop: 12,
              fontFamily: BFONT,
            }}
          >
            Replay stream
          </button>
        </div>
      )}
    </div>
  );
}
