/* The libraries, at `#/libraries/<id>`: generated docstream pages (libraries-site.ts) as a DocsSite, with the docs'
   demo resolver, so a page runs the blocks and component demos it shows. */
import { DocsSite, type DocsSiteController } from '@brett_lamy/ui/docstream/site';
import { demoResolver } from '../demos';
import { embeddedSiteProps, type EmbeddedDocsProps } from './embedded';
import { LIBRARY_FILES } from './libraries-site';
import { BLMark, REPO_URL } from './site-parts';

/* No header of its own: the site's is the only bar. The pages are generated, so there is nothing to edit. */
export default function LibrariesDocs({ controller, ...props }: EmbeddedDocsProps & { controller: DocsSiteController }) {
  return (
    <DocsSite
      files={LIBRARY_FILES}
      basePath="libraries"
      title="Libraries"
      logo={<BLMark />}
      header={false}
      controller={controller}
      demoResolver={demoResolver}
      sidebarFooter={<>Generated from <code>libraries.ts</code> and the code: each page shows the blocks that import the library. <a href={`${REPO_URL}/blob/main/apps/docs/src/site/showcase-graph.ts`} target="_blank" rel="noreferrer">How</a></>}
      {...embeddedSiteProps(props)}
    />
  );
}
