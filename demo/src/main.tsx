import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MarkdownContent } from '@brett_lamy/docstream';
import { GitbookEditor } from '@brett_lamy/docstream-editor';
import '@brett_lamy/docstream/styles.css';
import '@brett_lamy/docstream-editor/styles.css';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

interface DocPage { id: string; title: string; markdown: string; playground?: boolean }

const PAGES: DocPage[] = [
  {
    id: 'introduction',
    title: 'Introduction',
    markdown: `# docstream-editor

A rich GitBook-flavored markdown **editor** built on [Tiptap](https://tiptap.dev), paired with [@brett_lamy/docstream](https://www.npmjs.com/package/@brett_lamy/docstream) for parsing and serialization.

{% hint style="info" %}
The prose on this site is rendered by docstream; the playground page embeds the actual \`GitbookEditor\`. The pair round-trips the same GitBook markdown.
{% endhint %}

## What it does

- WYSIWYG editing of GitBook-style markdown: hints, tabs, expandables, steppers, tables, code blocks with syntax highlighting.
- **Round-tripping** — the editor state serializes back to GitBook markdown via docstream's AST (\`tiptapToAst\` → \`serialize\`), so what you edit is what you commit.
- A built-in formatting toolbar and a "/" slash menu for inserting blocks.
- Composable internals for custom editors (Yjs collaboration, bespoke menus).

## Installation

\`\`\`sh
npm install @brett_lamy/docstream-editor @brett_lamy/docstream react
\`\`\`

Tiptap packages are peer dependencies — see the package.json for the exact list (\`@tiptap/core\`, \`@tiptap/react\`, \`@tiptap/starter-kit\`, table/list/placeholder/code-block-lowlight extensions, \`@tiptap/pm\`, \`@tiptap/suggestion\`).
`,
  },
  {
    id: 'quick-start',
    title: 'Quick start',
    markdown: `# Quick start

\`\`\`tsx
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import "@brett_lamy/docstream/styles.css"
import "@brett_lamy/docstream-editor/styles.css"

export function Editor() {
  const [md, setMd] = useState("# Hello")
  return <GitbookEditor markdown={md} onChange={setMd} />
}
\`\`\`

## GitbookEditor props

| Prop | Type | Purpose |
| --- | --- | --- |
| \`markdown\` | \`string\` | Markdown source; the editor stays in sync (controlled). |
| \`onChange\` | \`(md: string) => void\` | Serialized GitBook markdown on every edit. |
| \`toolbar\` | \`boolean\` | Built-in formatting toolbar (default true). |
| \`slashMenu\` | \`boolean \\| { items }\` | The "/" insert menu — or your own item list. |
| \`editable\` | \`boolean\` | Read-only mode when false. |
| \`placeholder\` | \`string\` | Placeholder for an empty document. |
| \`autofocus\` | \`boolean\` | Focus on mount. |
| \`className\` | \`string\` | Wrapper class. |
`,
  },
  {
    id: 'playground',
    title: 'Playground',
    playground: true,
    markdown: `# Playground

The real \`GitbookEditor\`, live. Type below — try the toolbar, or press \`/\` for the slash menu (hints, tables, code blocks…). The right pane shows the GitBook markdown the editor serializes on every edit.
`,
  },
  {
    id: 'architecture',
    title: 'How it works',
    markdown: `# How it works

## markdown ⇄ editor round trip

\`\`\`mermaid
graph LR
  MD[GitBook markdown] -->|parseMarkdown| AST[docstream AST]
  AST -->|astToTiptap| PM[Tiptap/ProseMirror doc]
  PM -->|edits| PM
  PM -->|tiptapToAst| AST2[docstream AST]
  AST2 -->|serialize| MD2[GitBook markdown]
\`\`\`

\`convert.ts\` owns both directions: \`astToTiptap(ast)\` builds the ProseMirror document, and \`tiptapToAst(doc)\` maps editor nodes back onto docstream's block AST, which \`serialize\` turns into markdown. Because both ends share docstream's parser, the editor never invents syntax the renderer can't display.

## Building blocks

For a custom editor (collaboration, custom menus) skip \`GitbookEditor\` and compose the parts:

\`\`\`ts
import {
  createGitbookExtensions,  // Tiptap extensions for all GitBook nodes
  getGitbookSchema,         // the ProseMirror schema
  gitbookNodes,             // node definitions (GbCodeBlock, GbTable, …)
  createSlashMenu, SLASH_ITEMS,
  astToTiptap, tiptapToAst,
} from "@brett_lamy/docstream-editor"
\`\`\`

{% hint style="success" %}
\`ReactDemoEditor\` is also exported — an editor variant used for live React code demos in docs.
{% endhint %}
`,
  },
];

const SEED = `# Release notes draft

{% hint style="info" %}
Edit me — this hint is a real GitBook block.
{% endhint %}

## Highlights

- Editor and renderer share one AST
- Slash menu: press \`/\` on an empty line

\`\`\`ts
const answer = 42
\`\`\`
`;

function Playground() {
  const [md, setMd] = useState(SEED);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', margin: '18px 0', minHeight: 420 }}>
      <div style={{ flex: 1, minWidth: 0, border: '1px solid #e2e2ea', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#77777f' }}>GitbookEditor</div>
        <GitbookEditor markdown={SEED} onChange={setMd} placeholder="Write something…" />
      </div>
      <div style={{ flex: 1, minWidth: 0, border: '1px solid #e2e2ea', borderRadius: 12, overflow: 'hidden', background: '#fafafc' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #eee', fontSize: 12, fontWeight: 700, color: '#77777f' }}>Serialized markdown (live)</div>
        <pre style={{ margin: 0, padding: 14, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{md}</pre>
      </div>
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
        <div style={{ width: '100%', maxWidth: cur.playground ? 1100 : 760, padding: '28px 32px 80px', boxSizing: 'border-box' }}>
          <MarkdownContent markdown={cur.markdown} />
          {cur.playground ? <Playground /> : null}
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><App /></StrictMode>
);
