/* docstream-editor's documentation as one component: the docs/ folder through docstream's DocsSite, with the live
   editors its pages embed. The playground (main.tsx) mounts it on its own; the BL site mounts it under
   `#/docstream-editor` beside the other libraries. */
import { useMemo } from 'react';
import { DocsSite, humanize, type BuildDocsTreeOptions, type DocsSiteProps } from '@brett_lamy/docstream/site';
import { createDemoResolver } from './demos';
import { liveRenderer } from './live-renderer';

export const editorFiles = import.meta.glob('../docs/**/*.{md,json,yaml,yml}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const FOLDER_TITLES: Record<string, string> = { api: 'API' };
const treeOptions: BuildDocsTreeOptions = { folderTitle: (name) => FOLDER_TITLES[name] ?? humanize(name) };

export const EditorLogo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--primary)" />
    <path d="M9 10.5h9M9 16h7M9 21.5h5" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" />
    <path d="m18.5 22.5 5.5-5.5 1.8 1.8-5.5 5.5-2.4.6z" fill="var(--primary-foreground)" />
  </svg>
);

export const REPO = 'https://github.com/BLamy/ui';
export const DOCS_URL = 'https://blamy.github.io/ui/#/docstream-editor';

export interface EditorDocsProps extends Partial<DocsSiteProps> {
  /** Namespaces the demos' "Open in new tab" links (`?demo=<prefix><page>/<example>`). */
  demoPrefix?: string;
  /** Where the header's docstream link points. */
  docstreamUrl?: string;
}

/** The docstream-editor docs site. Every DocsSite prop can be overridden (routing, basePath, theme, header links, …). */
export function EditorDocs({ demoPrefix = '', docstreamUrl = 'https://blamy.github.io/ui/#/docstream', ...props }: EditorDocsProps) {
  const demoResolver = useMemo(() => createDemoResolver(demoPrefix), [demoPrefix]);
  return (
    <DocsSite
      files={editorFiles}
      treeOptions={treeOptions}
      title="docstream-editor"
      logo={<EditorLogo />}
      links={[
        { label: 'GitHub', href: `${REPO}/tree/main/packages/docstream-editor` },
        { label: 'npm', href: 'https://www.npmjs.com/package/@brett_lamy/docstream-editor' },
        { label: 'docstream', href: docstreamUrl },
      ]}
      liveRenderer={liveRenderer}
      demoResolver={demoResolver}
      pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${DOCS_URL}/${page.slug}\n` })}
      editUrl={(page) => `${REPO}/edit/main/packages/docstream-editor/demo/docs/${page.path}`}
      sidebarFooter={<>A folder of Markdown, published with docstream's <a href="https://blamy.github.io/ui/#/docstream/docs-site">DocsSite</a>.</>}
      {...props}
    />
  );
}
