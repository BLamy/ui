/* The editor's documentation inside the BL site, at `#/docstream-editor/<page>`: the playground's docs/ folder through
   DocsSite, with its live editors ({% demo %} folders) and live-code renderer. */
import { DocsSite, humanize, type BuildDocsTreeOptions } from '@brett_lamy/ui/docstream/site';
import { editorLiveRenderer } from './playground-parts';
import { editorDemos } from './library-demos';
import { embeddedSiteProps, type EmbeddedDocsProps } from './embedded';
import { BLMark, REPO_URL } from './site-parts';

const files = import.meta.glob('../../../docstream-editor-playground/docs/**/*.{md,json,yaml,yml,capnp}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const FOLDER_TITLES: Record<string, string> = { api: 'API' };
const treeOptions: BuildDocsTreeOptions = { folderTitle: (name) => FOLDER_TITLES[name] ?? humanize(name) };

const DOCS_URL = 'https://blamy.github.io/ui/#/docstream-editor';

export default function EditorDocs(props: EmbeddedDocsProps) {
  return (
    <DocsSite
      files={files}
      treeOptions={treeOptions}
      basePath="docstream-editor"
      title="Docstream Editor"
      logo={<BLMark />}
      links={[
        { label: 'Source', href: `${REPO_URL}/tree/main/packages/ui/src/docstream-editor` },
        { label: 'Docstream', href: '#/docstream' },
      ]}
      liveRenderer={editorLiveRenderer}
      demoResolver={editorDemos}
      pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${DOCS_URL}/${page.slug}\n` })}
      editUrl={(page) => `${REPO_URL}/edit/main/apps/docstream-editor-playground/docs/${page.path}`}
      sidebarFooter={<>Part of <code>@brett_lamy/ui</code> since 6.0: <code>@brett_lamy/ui/docstream-editor</code>.</>}
      {...embeddedSiteProps(props)}
    />
  );
}
