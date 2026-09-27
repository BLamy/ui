/* `?render` — any docstream Markdown rendered exactly like a docs page (same shell classes, same renderer), for
   checking that a page's "Copy page" Markdown renders back as the page. The Markdown comes from the textarea, or
   from sessionStorage["bldocs-render"] (tools/vr/copy-page.vr.mjs puts the clipboard there).

     ?render             with the docs' demo resolver (demos resolve from their folders; inline files are ignored)
     ?render&resolver=0  without it: demos show the files they carry inline (the preview runs them in almost-node),
                         as the Markdown renders anywhere else */
import { useState } from 'react';
import { GitbookStreamdown } from '@brett_lamy/docstream';
import { demoResolver } from '../demos';
import './shell.css';

export const RENDER_KEY = 'bldocs-render';

export default function RenderPage({ resolver }: { resolver: boolean }) {
  const [markdown, setMarkdown] = useState(() => window.sessionStorage.getItem(RENDER_KEY) ?? '');
  return (
    <div id="bldocs-scroll" className="dk-scroll" style={{ height: '100vh', overflowY: 'auto' }}>
      <div className="dk-doc" style={{ maxWidth: 780, margin: '0 auto', boxSizing: 'border-box', padding: '34px 34px 90px' }}>
        <textarea
          aria-label="Markdown to render"
          placeholder="Paste a page's Markdown (Copy page)…"
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            window.sessionStorage.setItem(RENDER_KEY, e.target.value);
          }}
          style={{
            display: 'block', width: '100%', height: markdown ? 60 : 240, boxSizing: 'border-box', padding: 10, borderRadius: 10,
            border: '1px solid var(--dk-border3)', background: 'var(--dk-card)', color: 'var(--dk-fg)',
            font: '12px/1.5 ui-monospace, Menlo, monospace',
          }}
        />
        <div className="dk-md" data-render-mode={resolver ? 'resolver' : 'inline'}>
          <div className="wb-md">
            <GitbookStreamdown markdown={markdown} demoResolver={resolver ? demoResolver : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
