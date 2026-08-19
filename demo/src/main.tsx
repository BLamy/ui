import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GitbookStreamdown, MarkdownContent } from '@brett_lamy/docstream';
import '@brett_lamy/docstream/styles.css';
import { PAGES } from './content';
import { liveRenderer } from './live-renderer';
import { ReactDemoLive } from './react-demo-live';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif";

const STREAM_SOURCE = `## Live stream demo

This markdown is arriving **a few words at a time** and re-rendering through \`GitbookStreamdown\` with \`isStreaming\`.

{% hint style="info" %}
Notice the hint renders before its closing tag has streamed in.
{% endhint %}

\`\`\`ts
// even code fences render progressively
const chunks = await model.stream(prompt)
for await (const c of chunks) append(c)
\`\`\`

- lists build up item by item
- tables and math work the same way

Done — the stream restarts in a few seconds.`;

function StreamDemo() {
  const [n, setN] = useState(0);
  const words = STREAM_SOURCE.split(/(?<=\s)/);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x >= words.length ? (x > words.length + 20 ? 0 : x + 1) : x + 2)), 90);
    return () => clearInterval(t);
  }, [words.length]);
  const md = words.slice(0, Math.min(n, words.length)).join('');
  const streaming = n < words.length;
  return (
    <div style={{ border: '1px solid #e2e2ea', borderRadius: 12, padding: '4px 20px 12px', margin: '16px 0', minHeight: 320 }}>
      <GitbookStreamdown markdown={md} isStreaming={streaming} isAnimating={streaming} />
    </div>
  );
}

function App() {
  // Hash routing keeps the current page across the one-time reload the
  // almost-node service worker triggers when it first installs.
  const [page, setPage] = useState(() => window.location.hash.slice(1) || PAGES[0].id);
  const cur = PAGES.find((p) => p.id === page) ?? PAGES[0];
  useEffect(() => {
    if (window.location.hash.slice(1) !== page) window.location.hash = page;
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    const onHash = () => setPage(window.location.hash.slice(1) || PAGES[0].id);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT, color: '#16161d' }}>
      <nav style={{ width: 240, flexShrink: 0, borderRight: '1px solid #e6e6ee', padding: '20px 12px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', background: '#fafafc' }}>
        <div style={{ fontWeight: 800, fontSize: 17, padding: '0 10px 4px', letterSpacing: '-0.2px' }}>docstream</div>
        <div style={{ fontSize: 11.5, color: '#77777f', padding: '0 10px 14px' }}>GitBook-aware markdown & AI stream renderer</div>
        {PAGES.map((p) => (
          <button key={p.id} onClick={() => setPage(p.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', border: 0, borderRadius: 8, padding: '7px 10px',
              fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 2,
              background: p.id === page ? '#e8e8f2' : 'transparent', fontWeight: p.id === page ? 650 : 450, color: 'inherit',
            }}>
            {p.title}
          </button>
        ))}
        <div style={{ position: 'absolute', bottom: 16, left: 22, right: 12, fontSize: 11, color: '#9a9aa2' }}>
          <a href="https://www.npmjs.com/package/@brett_lamy/docstream" style={{ color: '#5b5bd6' }}>npm</a>
          {' · '}
          <a href="https://github.com/BLamy/docstream" style={{ color: '#5b5bd6' }}>GitHub</a>
          <div style={{ marginTop: 4 }}>rendered with docstream</div>
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 760, padding: '28px 32px 80px', boxSizing: 'border-box' }}>
          <MarkdownContent markdown={cur.markdown} liveRenderer={liveRenderer} />
          {cur.id === 'streaming' ? <StreamDemo /> : null}
          {cur.id === 'live-demos' ? <ReactDemoLive /> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, borderTop: '1px solid #e6e6ee', paddingTop: 16 }}>
            {(() => {
              const i = PAGES.indexOf(cur);
              const prev = PAGES[i - 1]; const next = PAGES[i + 1];
              const btn = (p: typeof cur, label: string) => (
                <button onClick={() => setPage(p.id)} style={{ border: '1px solid #e2e2ea', background: '#fff', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                  <span style={{ color: '#9a9aa2', display: 'block', fontSize: 11 }}>{label}</span>
                  <span style={{ fontWeight: 650 }}>{p.title}</span>
                </button>
              );
              return (<>
                <span>{prev ? btn(prev, '← Previous') : null}</span>
                <span>{next ? btn(next, 'Next →') : null}</span>
              </>);
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><App /></StrictMode>
);
