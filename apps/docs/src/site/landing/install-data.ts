/* What the landing page says about installing, as data: the package, the commands, the code samples. It is apart from
   the components so that landing.test.ts can read it in plain Node and hold it to the code: every import in the
   samples is an entry of the package that exports those names, and every registry item a command names exists. */
import { LIBRARIES } from '../libraries';

export const PACKAGE = '@brett_lamy/ui';
export const REGISTRY_URL = 'https://blamy.github.io/ui/r';
export const INSTALL_COMMAND = `npm install ${PACKAGE}`;

/** The component the "copy the source" command copies. */
export const SOURCE_ITEM = 'split-view';

/** A whole library the CLI can copy, and its registry item: `library-<entry>`, which tools/registry/build.mjs writes for
    every library the manifest gives an entry (it lists the library's items as dependencies, so the CLI copies them all). */
export const SOURCE_LIBRARY = LIBRARIES.find((l) => l.entry === 'time') ?? LIBRARIES.find((l) => l.entry);
export const SOURCE_LIBRARY_ITEM = SOURCE_LIBRARY?.entry ? `library-${SOURCE_LIBRARY.entry}` : undefined;

export const addCommand = (item: string) => `npx shadcn@latest add ${REGISTRY_URL}/${item}.json`;

/** The stylesheet once, the core from the package's root, and two libraries from their own entries. */
export const SAMPLE_NPM = [
  "import '@brett_lamy/ui/styles.css';",
  '',
  "import { NavigationStack, SplitView, Dialog } from '@brett_lamy/ui';",
  "import { NaturalTimeInput } from '@brett_lamy/ui/time';",
  "import { Diagram } from '@brett_lamy/ui/diagram';",
].join('\n');

/** After `shadcn add`: the same parts, from the project's own files. */
export const SAMPLE_SOURCE = "import { SplitView, SplitViewDetail } from '@/components/ui/split-view';";
