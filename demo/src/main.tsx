import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoFullscreen, DocstreamRefContext, GitbookStreamdown, MarkdownContent, SourcePreview, createBundledSourceClient, createViteSourceClient, demoFromSearch, type CitationPreviewResolver, type SourceReferenceRenderer } from '@brett_lamy/docstream';
import '@brett_lamy/docstream/styles.css';
import './site.css';
import { demoResolver } from './demos';
import { PAGES } from './content';
import * as ButtonModule from './examples/Button';
import * as ButtonStoriesModule from './examples/Button.stories';
import { liveRenderer } from './live-renderer';
import { ReactDemoLive } from './react-demo-live';

const bundledSourceClient = createBundledSourceClient({
  'Button.tsx': ButtonModule,
  'Button.stories.tsx': ButtonStoriesModule,
});
const sourceClient = import.meta.env.DEV ? createViteSourceClient() : bundledSourceClient;
const sourceRenderer: SourceReferenceRenderer = (reference) => <SourcePreview reference={reference} client={sourceClient} />;
const citationPreviews: CitationPreviewResolver = (citation) => {
  if (citation.url?.includes('trends.google.com')) {
    return {
      title: 'Explore what the world is searching',
      description: 'Compare search interest for ice cream flavors across regions and time ranges with Google Trends.',
      siteName: 'Google Trends',
      image: 'https://ssl.gstatic.com/trends_nrtr/4116_RC01/embed_loader.gif',
    };
  }
  if (citation.url?.includes('scoopdata.io')) {
    return {
      title: citation.label ?? 'ScoopData Q3 report',
      description: 'Quarterly category performance, seasonal shifts, and the signals behind this period’s strongest movers.',
      siteName: 'ScoopData',
      image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=640&q=80',
    };
  }
  return null;
};

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

Pistachio is your strongest seasonal climber — up 18% quarter over quarter [^1], with the sharpest lift on weekend afternoons [^2]. Ask @brett about the #seasonal push. Rocky Road keeps sliding [^3].

Done — the stream restarts in a few seconds.

[^1]: https://scoopdata.io/q3 "ScoopData Q3 report"
[^2]: https://trends.google.com/ice-cream "Google Trends"
[^3]: https://marketbasket.io/flavors "Market Basket"`;

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
    <div className="site-stream">
      <GitbookStreamdown markdown={md} isStreaming={streaming} isAnimating={streaming} demoResolver={demoResolver} />
    </div>
  );
}

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  const fromUrl = new URLSearchParams(location.search).get('theme');
  if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;
  const saved = localStorage.getItem('docstream-demo-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark';
    localStorage.setItem('docstream-demo-theme', next);
    return next;
  });
  return [theme, toggle];
}

const SunMoon = ({ theme }: { theme: Theme }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {theme === 'dark'
      ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
      : <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />}
  </svg>
);

function App() {
  const [theme, toggleTheme] = useTheme();
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
  const i = PAGES.indexOf(cur);
  const prev = PAGES[i - 1];
  const next = PAGES[i + 1];
  const pagerButton = (p: typeof cur, label: string) => (
    <button onClick={() => setPage(p.id)}>
      <small>{label}</small>
      <strong>{p.title}</strong>
    </button>
  );
  return (
    <div className="site">
      <nav className="site-nav" aria-label="Pages">
        <div className="site-brand">
          docstream
          <button type="button" className="site-theme" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <SunMoon theme={theme} />
          </button>
        </div>
        <div className="site-tagline">GitBook-aware markdown & AI stream renderer</div>
        {PAGES.map((p) => (
          <button key={p.id} className="site-link" aria-current={p.id === page ? 'page' : undefined} onClick={() => setPage(p.id)}>
            {p.title}
          </button>
        ))}
        <div className="site-foot">
          <a href="https://www.npmjs.com/package/@brett_lamy/docstream">npm</a>
          {' · '}
          <a href="https://github.com/BLamy/docstream">GitHub</a>
          <div style={{ marginTop: 4 }}>rendered with docstream</div>
        </div>
      </nav>
      <main className="site-main">
        <div className="site-page">
          <DocstreamRefContext.Provider value={{ resolveCitationPreview: citationPreviews }}>
            <MarkdownContent
              key={cur.id}
              markdown={cur.markdown}
              liveRenderer={liveRenderer}
              sourceRenderer={sourceRenderer}
              demoResolver={demoResolver}
              pageActions={{ transform: (md) => `${md.trim()}\n\n---\n\nSource: https://blamy.github.io/docstream/#${cur.id}\n` }}
            />
            {cur.id === 'streaming' ? <StreamDemo /> : null}
          </DocstreamRefContext.Provider>
          {cur.id === 'live-demos' ? <ReactDemoLive /> : null}
          <div className="site-pager">
            <span>{prev ? pagerButton(prev, '← Previous') : null}</span>
            <span>{next ? pagerButton(next, 'Next →') : null}</span>
          </div>
        </div>
      </main>
    </div>
  );
}

/** `?demo=<page>/<example>` renders one demo alone (the viewer's "Open in new tab"). */
function Fullscreen({ src, variant }: { src: string; variant?: string }) {
  useTheme();
  return <div data-docstream=""><DemoFullscreen src={src} variant={variant} resolver={demoResolver} /></div>;
}

function Root() {
  const deepLink = demoFromSearch();
  return deepLink ? <Fullscreen src={deepLink.src} variant={deepLink.variant} /> : <App />;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><Root /></StrictMode>
);
