/* The site's front page: what BL is, every library by category, how they layer, a live app, and how to install. */
import { libraryPages, uiUnits } from 'virtual:bl-site-files';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownView } from '@/components/ui/markdown-view';
import { Icon } from '@/lib/icon';
import { BLOCK_PAGES, PAGE_LIST } from '../pages';
import { demoResolver } from '../demos';
import { LIBRARIES, LIBRARY, packageNames, packageOf, reach, type Library } from './libraries';
import { LibraryChip, LibraryGroups, SitePage, SiteSection } from './site-parts';

/* How the libraries stack, computed from the plan so it can't drift: the npm package that holds the core, what the core
   builds on, what builds on the core, and what needs neither. */
const inCore = (l: Library) => packageOf(l).id === 'ui';
const coreReach = new Set(LIBRARIES.filter(inCore).flatMap((l) => [...reach(l.id)]));
const LAYERS: Array<{ name: string; note: string; libs: Library[] }> = [
  { name: 'Built on the core', note: 'Planned packages: in @brett_lamy/ui today', libs: LIBRARIES.filter((l) => !inCore(l) && reach(l.id).has('ui')) },
  { name: 'The core', note: '@brett_lamy/ui, with docstream and its editor', libs: LIBRARIES.filter(inCore) },
  { name: 'Foundation', note: 'What the core builds on', libs: LIBRARIES.filter((l) => !inCore(l) && coreReach.has(l.id)) },
  { name: 'Beside it', note: 'Need no BL library, or only the foundation', libs: LIBRARIES.filter((l) => !inCore(l) && !coreReach.has(l.id) && !reach(l.id).has('ui')) },
];

const INSTALL_SOURCE = '{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json{% endcommand %}';
const INSTALL_PACKAGE = [
  '{% command %}npm install @brett_lamy/ui{% endcommand %}',
  '```tsx',
  "import '@brett_lamy/ui/styles.css';",
  "import { Dialog, DialogContent } from '@brett_lamy/ui/dialog';",
  "import { MarkdownView } from '@brett_lamy/ui/markdown-view';",
  '```',
].join('\n');
const DEMO = '{% demo src="introduction/first-app" %}';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-panel bg-card p-4 shadow-hairline">
      <strong className="text-large-title leading-none font-bold tabular-nums">{value}</strong>
      <span className="text-footnote text-muted-foreground">{label}</span>
    </div>
  );
}

export function Landing() {
  const packages = LIBRARIES.filter((l) => l.status !== 'planned').flatMap(packageNames);
  const components = uiUnits.filter((u) => u.startsWith('components/')).length;
  return (
    <SitePage label="BL">
      <section aria-labelledby="hero" className="grid gap-8 @4xl/page:grid-cols-[3fr_2fr] @4xl/page:items-end">
        <h1 id="hero" className="m-0 text-[clamp(2.25rem,4cqi+1.25rem,4rem)] leading-[1.05] font-bold tracking-tight text-balance">
          React libraries for apps that feel <span className="text-primary">native</span>
        </h1>
        <div className="flex flex-col gap-5">
          <p className="m-0 text-body text-muted-foreground">
            Components, motion, Markdown and data tools that compose like UIKit: behavior from UI SDK, looks from tokens,
            responsive by container. Copy them into your project as source, or install them from npm.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" render={<a href="#/libraries" />} className="no-underline">Browse the libraries</Button>
            <Button size="lg" variant="ghost" render={<a href="#/introduction" />} className="no-underline">
              Read the docs <Icon name="arrow-right" size={16} />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 @3xl/page:grid-cols-4">
        <Stat value={LIBRARIES.length} label="Libraries" />
        <Stat value={packages.length} label="npm packages in 6.0" />
        <Stat value={components} label="Component modules" />
        <Stat value={PAGE_LIST.length + libraryPages} label="Docs pages" />
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle render={<h2 />}>Docstream moved in</CardTitle>
          <CardDescription>
            Docstream and its editor are part of <code>@brett_lamy/ui</code> from 6.0. The packages{' '}
            <code>{LIBRARY.docstream.formerly?.[0].npm}</code> and <code>{LIBRARY['docstream-editor'].formerly?.[0].npm}</code> stop at
            {' '}{LIBRARY.docstream.formerly?.[0].last}: import <code>{LIBRARY.docstream.npm}</code> and <code>{LIBRARY['docstream-editor'].npm}</code> instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" size="sm" render={<a href="#/roadmap/migration" />} className="no-underline">How to migrate</Button>
          <Button variant="ghost" size="sm" render={<a href="#/docstream" />} className="no-underline">Docstream's docs</Button>
        </CardContent>
      </Card>

      <SiteSection
        title="The libraries"
        lede={<>
          <code>@brett_lamy/ui</code> carries the kit, docstream and its editor; UI SDK publishes beside it. The planned
          libraries ship inside <code>@brett_lamy/ui</code> today and are next in line for packages of their own — each is
          mapped, module by module, in <a href="#/roadmap/module-map">the plan</a>.
        </>}
      >
        <LibraryGroups />
      </SiteSection>

      <SiteSection title="Built in layers" lede="Each layer builds only on the ones below it, so an app installs the parts it uses and nothing above them. A test holds the plan to the real imports.">
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {LAYERS.filter((layer) => layer.libs.length).map((layer) => (
            <li key={layer.name} className="grid gap-3 rounded-panel bg-card p-4 shadow-hairline @3xl/page:grid-cols-[12rem_1fr] @3xl/page:items-center">
              <div className="flex flex-col">
                <strong className="text-subhead">{layer.name}</strong>
                <span className="text-footnote text-muted-foreground">{layer.note}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {layer.libs.map((lib) => <LibraryChip key={lib.id} lib={lib} />)}
              </div>
            </li>
          ))}
        </ol>
      </SiteSection>

      <SiteSection title="Not screenshots" lede="Every example on this site is the real component, running. This one is Tabs with a NavigationStack in each, inset Lists, and a Dialog shown as a tray: open a friend, then swipe back from the leading edge.">
        <MarkdownView markdown={DEMO} demoResolver={demoResolver} className="dk-md" />
      </SiteSection>

      <SiteSection title="Two ways in" lede="The same source, two ways: copy what you need into your project, or install the package.">
        <div className="grid gap-3 @3xl/page:grid-cols-2">
          <Card variant="outline">
            <CardHeader>
              <CardTitle>Copy the source</CardTitle>
              <CardDescription>The shadcn registry copies a component and the parts it's built from into your project. You own the code, and you ship only what you add.</CardDescription>
            </CardHeader>
            <CardContent><MarkdownView markdown={INSTALL_SOURCE} /></CardContent>
          </Card>
          <Card variant="outline">
            <CardHeader>
              <CardTitle>Install the package</CardTitle>
              <CardDescription>Every module is its own entry, so a bundler takes only the ones you import. Import the stylesheet once.</CardDescription>
            </CardHeader>
            <CardContent><MarkdownView markdown={INSTALL_PACKAGE} /></CardContent>
          </Card>
        </div>
        <p className="m-0 text-footnote text-muted-foreground">
          {BLOCK_PAGES.length} app blocks show the parts working together — <a href="#/blocks">see them all</a>.
        </p>
      </SiteSection>
    </SitePage>
  );
}
