/* The roadmap, at `#/roadmap/<page>`: the hand-written pages in apps/docs/roadmap/ and the three roadmap.ts generates
   from the plan, as a DocsSite. */
import { DocsSite } from '@brett_lamy/ui/docstream/site';
import { embeddedSiteProps, type EmbeddedDocsProps } from './embedded';
import { ROADMAP_FILES } from './roadmap';
import { BLMark, REPO_URL } from './site-parts';

/** The generated pages (01, 02, 04) have no source file to edit. */
const GENERATED = /^0[124]-/;

export default function RoadmapDocs(props: EmbeddedDocsProps) {
  return (
    <DocsSite
      files={ROADMAP_FILES}
      basePath="roadmap"
      title="Roadmap"
      logo={<BLMark />}
      links={[{ label: 'Libraries', href: '#/libraries' }]}
      editUrl={(page) => (GENERATED.test(page.path) ? undefined : `${REPO_URL}/edit/main/apps/docs/roadmap/${page.path}`)}
      sidebarFooter={<>The package and module maps are generated from <code>libraries.ts</code>, and a test checks them against the code.</>}
      {...embeddedSiteProps(props)}
    />
  );
}
