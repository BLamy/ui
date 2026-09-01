/* MarkdownStreamDemo — streamed GitBook markdown with citations + reference chips,
   rendered by docstream through @touchkit/workbench MarkdownView. Replaces the
   hand-rolled StreamingText fake: the source chips, superscript citations, and
   @mention/#tag pills are real markdown now. */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { MarkdownView } from '@touchkit/workbench';
import '@touchkit/workbench/styles.css';
import { BFONT, C, cn, mut } from '../lib/base';

export const MARKDOWN_STREAM_MD = `Pistachio is your strongest seasonal climber — up 18% quarter over quarter [^1], with the sharpest lift on weekend afternoons [^2]. Rocky Road keeps sliding and now sits below the 40-scoops-weekly retirement line [^3].

Ask @brett to sanity-check the #seasonal forecast before the weekend batch plan.

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
[^2]: https://trends.google.com/ice-cream "Google Trends"
[^3]: https://marketbasket.io/flavors "Market Basket"`;

export interface MarkdownStreamDemoProps {
  markdown?: string;
  sourcesLabel?: string;
  avatarColors?: string[];
  style?: CSSProperties;
  className?: string;
}

export function MarkdownStreamDemo({
  markdown = MARKDOWN_STREAM_MD,
  sourcesLabel = '3 sources',
  avatarColors = [C.blue, C.purple, C.teal],
  style,
  className,
}: MarkdownStreamDemoProps) {
  const [n, setN] = useState(0);
  const words = markdown.split(/(?<=\s)/);
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
    <div data-slot="markdown-stream" className={cn(className)} style={{ maxWidth: 520, fontFamily: BFONT, ...style }}>
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
      <MarkdownView
        markdown={words.slice(0, Math.min(n, words.length)).join('')}
        streaming={!done}
        style={{ minHeight: 120 }}
      />
      {done && (
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
      )}
    </div>
  );
}
