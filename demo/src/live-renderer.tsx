/* Live-example renderer for the docstream-editor docs site.

   Prose is rendered with docstream's MarkdownContent, which calls this for
   every `{% code live="true" %}` jsx/tsx fence. A `// demo:<name>` marker in
   the fence's first line picks a real mounted GitbookEditor from the
   registry below. */
import { useState, type ReactNode } from 'react';
import { GitbookEditor } from '@brett_lamy/docstream-editor';

const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

function EditorBasicDemo() {
  const [md, setMd] = useState('Try **bold**, `code`, or press `/` on an empty line.');
  return (
    <div>
      <GitbookEditor markdown={md} onChange={setMd} toolbar={false} placeholder="Type here…" />
      <pre style={{ margin: '10px 0 0', padding: 10, background: '#f7f7fa', border: '1px solid #e6e6ee', borderRadius: 8, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'pre-wrap' }}>{md}</pre>
    </div>
  );
}

const READONLY_MD = `{% hint style="success" %}
This document is rendered by the editor itself — same look as editing, but inert.
{% endhint %}

- No caret, no toolbar
- Blocks still render exactly like the editable version
`;

function EditorReadonlyDemo() {
  return <GitbookEditor markdown={READONLY_MD} toolbar={false} editable={false} />;
}

function EditorSlashDemo() {
  return (
    <GitbookEditor
      markdown=""
      toolbar={false}
      autofocus
      placeholder="Press / to open the slash menu…"
    />
  );
}

const REGISTRY: Record<string, () => ReactNode> = {
  'editor-basic': () => <EditorBasicDemo />,
  'editor-readonly': () => <EditorReadonlyDemo />,
  'editor-slash': () => <EditorSlashDemo />,
};

interface LivePreviewProps {
  files: Record<string, string>;
  entry: string;
  title: string;
}

export function liveRenderer({ files, entry, title }: LivePreviewProps): ReactNode {
  const code = files[entry] ?? '';
  const marker = /^\/\/\s*demo:([\w-]+)/.exec(code.split('\n', 1)[0] ?? '');
  const demo = marker ? REGISTRY[marker[1]] : undefined;
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
