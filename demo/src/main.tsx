import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownContent } from '@brett_lamy/docstream';
import type { SourceFileSnapshot, SourceReferenceClient } from '@brett_lamy/docstream/source';
import { GitbookEditor } from '@brett_lamy/docstream-editor';
import '@brett_lamy/docstream/styles.css';
import '@brett_lamy/docstream-editor/styles.css';
import { PAGES } from './content';
import { liveRenderer } from './live-renderer';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

const demoVirtualFiles = new Map([['src/Button.tsx', 'export default function Button() {\n  return <button>Virtual file</button>\n}\n']]);
const demoSourceClient: SourceReferenceClient = {
  async read(reference) {
    return {
      content: demoVirtualFiles.get(reference.path) ?? '',
      provenance: { mount: reference.mount, path: reference.path, exportName: reference.exportName, kind: reference.kind },
    };
  },
  async write(reference, content) {
    demoVirtualFiles.set(reference.path, content);
    return {
      content,
      provenance: { mount: reference.mount, path: reference.path, exportName: reference.exportName, kind: reference.kind },
    };
  },
  async importModule() {
    return {};
  },
};

const SEED = `# Release notes draft

{% hint style="info" %}
Edit me — this hint is a real GitBook block.
{% endhint %}

## Highlights

- Editor and renderer share one AST
- Slash menu: press \`/\` on an empty line
- Reference chips: type \`@\` or \`#\`, citations via /citation

Ask @brett about the #seasonal numbers [^1].

[^1]: https://scoopdata.io/q3 "ScoopData Q3"

\`\`\`ts
const answer = 42
\`\`\`

\`\`\`mermaid
graph LR
  Draft[Edit source below] --> Preview[Live diagram above]
\`\`\`

{% source-ref mount="demo" path="src/Button.tsx" export="default" kind="component" title="Virtual Button" %}

`;

function Playground() {
  const [md, setMd] = useState(SEED);
  const [savedFile, setSavedFile] = useState<SourceFileSnapshot | null>(null);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', margin: '18px 0', minHeight: 420 }}>
      <div style={{ flex: 1, minWidth: 0, border: '1px solid #e2e2ea', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#77777f' }}>GitbookEditor</div>
        <GitbookEditor
          markdown={SEED}
          onChange={setMd}
          placeholder="Write something…"
          sourceClient={demoSourceClient}
          sourcePreview={false}
          onSourceSaved={setSavedFile}
        />
        <div data-demo-file-save="" style={{ padding: '8px 14px', borderTop: '1px solid #eee', fontSize: 11, color: '#77777f' }}>
          {savedFile ? `Saved ${savedFile.provenance.path}: ${savedFile.content.length} bytes` : 'Virtual file autosave ready'}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, border: '1px solid #e2e2ea', borderRadius: 12, overflow: 'hidden', background: '#fafafc' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#77777f' }}>Serialized markdown (live)</div>
        <pre style={{ margin: 0, padding: 14, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{md}</pre>
      </div>
    </div>
  );
}

function ReadonlyPlayground() {
  return (
    <div style={{ border: '1px solid #e2e2ea', borderRadius: 12, overflow: 'hidden', margin: '18px 0' }}>
      <div style={{ padding: '8px 14px', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#77777f' }}>
        GitbookEditor · toolbar={'{false}'} editable={'{false}'}
      </div>
      <GitbookEditor markdown={SEED} toolbar={false} editable={false} />
    </div>
  );
}

function App() {
  const [page, setPage] = useState(PAGES[0].id);
  const cur = PAGES.find((p) => p.id === page) ?? PAGES[0];
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: FONT, color: '#16161d' }}>
      <nav style={{ width: 240, flexShrink: 0, borderRight: '1px solid #e6e6ee', padding: '20px 12px', position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', background: '#fafafc' }}>
        <div style={{ fontWeight: 800, fontSize: 17, padding: '0 10px 4px', letterSpacing: '-0.2px' }}>docstream-editor</div>
        <div style={{ fontSize: 11.5, color: '#77777f', padding: '0 10px 14px' }}>GitBook markdown WYSIWYG on Tiptap</div>
        {PAGES.map((p) => (
          <button key={p.id} onClick={() => setPage(p.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderRadius: 8, padding: '7px 10px', fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', marginBottom: 2, background: p.id === page ? '#e8e8f2' : 'transparent', fontWeight: p.id === page ? 650 : 450, color: 'inherit' }}>
            {p.title}
          </button>
        ))}
        <div style={{ position: 'absolute', bottom: 16, left: 22, right: 12, fontSize: 11, color: '#9a9aa2' }}>
          <a href="https://www.npmjs.com/package/@brett_lamy/docstream-editor" style={{ color: '#5b5bd6' }}>npm</a>
          {' · '}
          <a href="https://github.com/BLamy/docstream-editor" style={{ color: '#5b5bd6' }}>GitHub</a>
          <div style={{ marginTop: 4 }}>prose rendered with docstream</div>
        </div>
      </nav>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: cur.demo === 'playground' ? 1100 : 760, padding: '28px 32px 80px', boxSizing: 'border-box' }}>
          <MarkdownContent markdown={cur.markdown} liveRenderer={liveRenderer} />
          {cur.demo === 'playground' ? <Playground /> : null}
          {cur.demo === 'readonly' ? <ReadonlyPlayground /> : null}
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
