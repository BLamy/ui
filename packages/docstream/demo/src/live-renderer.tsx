/* Live-example renderer for the docs site.

   `MarkdownContent` calls this for every `{% code live="true" %}` jsx/tsx
   fence. The first line of the fence carries a `// demo:<name>` marker that
   selects a real mounted component from the registry below — every entry
   mounts the REAL exported component from the package. A fence without a
   marker runs as written, in almost-node (loaded on first use). */
import { Suspense, lazy, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  GitbookStreamdown,
  MarkdownContent,
  VideoEmbed,
  parseMarkdown,
  type LivePreviewProps,
} from '@brett_lamy/docstream';

const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

/* ---------- individual demos ---------- */

function VideoEmbedDemo() {
  return <VideoEmbed src="https://www.youtube.com/embed/8aGhZQkoFbQ" title="What the heck is the event loop anyway?" />;
}

const NESTED_MD = `{% hint style="success" %}
This whole panel is a **GitbookStreamdown** mounted by the docs site — hints, tables and code all render live.
{% endhint %}

| Feature | Status |
| --- | --- |
| GitBook tags | rendered |
| Syntax highlighting | rendered |

\`\`\`ts
const rendered = "live"
\`\`\``;

function NestedMarkdownDemo() {
  return <GitbookStreamdown markdown={NESTED_MD} />;
}

function ClassNameDemo() {
  return (
    <div>
      <style>{`.demo-compact-md p { font-size: 12.5px; color: #6b6b7a; margin: 4px 0; } .demo-compact-md h3 { margin: 4px 0; font-size: 15px; }`}</style>
      <MarkdownContent
        className="demo-compact-md"
        markdown={`### Rendered with className="demo-compact-md"\n\nThe host stylesheet targets the class to shrink this paragraph — proof the \`className\` prop lands on the article element.`}
      />
    </div>
  );
}

const THEME_MD = `{% hint style="info" %}
Hints, code and tables inherit the wrapper's host tokens.
{% endhint %}

\`\`\`ts
const themed = true // colors come from --chart-1..4
\`\`\``;

function ThemeTokensDemo() {
  const darkTokens = {
    '--background': '#0b0b10',
    '--foreground': '#e6e6f0',
    '--card': '#12121a',
    '--card-foreground': '#e6e6f0',
    '--muted': '#1b1b26',
    '--muted-foreground': '#9a9ab0',
    '--border': '#2a2a3c',
    '--accent': '#1e1e2c',
    '--accent-foreground': '#e6e6f0',
    '--primary': '#8b8bf0',
    '--gb-info': '#7cb8ff',
    '--chart-1': '#7ee2a8',
    '--chart-2': '#c8a2ff',
    '--chart-3': '#7cb8ff',
    '--chart-4': '#ff8a8a',
  } as CSSProperties;
  const label: CSSProperties = { fontSize: 11, fontWeight: 700, color: '#9a9aa2', margin: '0 0 6px' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div style={label}>DEFAULT TOKENS</div>
        <div style={{ border: '1px solid #e2e2ea', borderRadius: 10, padding: '2px 14px 10px' }}>
          <MarkdownContent markdown={THEME_MD} />
        </div>
      </div>
      <div>
        <div style={label}>WRAPPER OVERRIDES --card / --border / --primary / --gb-info …</div>
        <div style={{ ...darkTokens, background: '#0b0b10', color: '#e6e6f0', border: '1px solid #2a2a3c', borderRadius: 10, padding: '2px 14px 10px' }}>
          <MarkdownContent markdown={THEME_MD} />
        </div>
      </div>
    </div>
  );
}

function ParseExplorerDemo() {
  const [src, setSrc] = useState('{% hint style="info" %}\nType **markdown** here…\n{% endhint %}');
  const ast = useMemo(() => {
    try {
      return JSON.stringify(parseMarkdown(src), null, 2);
    } catch (e) {
      return String(e);
    }
  }, [src]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 200 }}>
      <textarea
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        aria-label="Markdown source"
        style={{ fontFamily: MONO, fontSize: 12, padding: 10, border: '1px solid #e2e2ea', borderRadius: 8, resize: 'vertical', minHeight: 200 }}
      />
      <pre data-demo-ast style={{ margin: 0, fontFamily: MONO, fontSize: 11, lineHeight: 1.45, padding: 10, background: '#f7f7fa', border: '1px solid #e2e2ea', borderRadius: 8, overflow: 'auto', maxHeight: 320 }}>{ast}</pre>
    </div>
  );
}

/* ---------- registry + renderer ---------- */

const REGISTRY: Record<string, () => ReactNode> = {
  'video-embed': () => <VideoEmbedDemo />,
  'nested-markdown': () => <NestedMarkdownDemo />,
  'markdown-classname': () => <ClassNameDemo />,
  'theme-tokens': () => <ThemeTokensDemo />,
  'parse-explorer': () => <ParseExplorerDemo />,
};

const ReactCodePreview = lazy(() =>
  import('@brett_lamy/docstream/playground').then((m) => ({ default: m.ReactCodePreview })),
);

// The service worker lives under the site's base (/docstream/); every almost-node preview on a
// page shares it, so each one must register it there. Stable identity — it lands in effect deps.
const WORKSPACE_OPTIONS = { basePath: import.meta.env.BASE_URL.replace(/\/$/, '') };

export function liveRenderer(props: LivePreviewProps): ReactNode {
  const { files, entry, title } = props;
  const code = files[entry] ?? '';
  const marker = /^\/\/\s*demo:([\w-]+)/.exec(code.split('\n', 1)[0] ?? '');
  if (!marker) {
    return (
      <Suspense fallback={<div className="docs-demo-runtime-status">Loading the almost-node runtime…</div>}>
        <ReactCodePreview files={files} entry={entry} title={title} workspaceOptions={WORKSPACE_OPTIONS} collapsedCodeLines={props.collapsedCodeLines} expandedCodeLines={props.expandedCodeLines} />
      </Suspense>
    );
  }
  const demo = REGISTRY[marker[1]];
  return (
    <section data-live-example={marker?.[1] ?? 'unknown'} style={{ border: '1px solid #d8d8e4', borderRadius: 12, margin: '16px 0', overflow: 'hidden' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #e6e6ee', background: '#fafafc', fontSize: 12, fontWeight: 700, color: '#5b5bd6' }}>
        <span>Live example</span>
        <span style={{ color: '#9a9aa2', fontWeight: 500 }}>{title}</span>
      </header>
      <div style={{ padding: 14 }}>
        {demo ? demo() : <em style={{ fontSize: 13, color: '#9a9aa2' }}>Unknown live demo marker in this code block.</em>}
      </div>
    </section>
  );
}
