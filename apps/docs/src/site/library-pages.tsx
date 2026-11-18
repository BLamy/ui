/* `#/libraries` (every library) and `#/libraries/<id>` (one library: what it's for, how to install it from npm or with
   the shadcn CLI, what it loads, what's in it and what it builds on). */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';
import { pressableFocusRing } from '@/lib/primitives';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';
import { LIBRARIES, LIBRARY, LAYER_EXCEPTIONS, STATUS_LABEL, type Library } from './libraries';
import { packageAnchor } from './roadmap-anchor';
import { LibraryChip, LibraryGroups, LibraryTile, REPO_URL, SitePage, SiteSection, StatusBadge } from './site-parts';

export function LibrariesIndex() {
  return (
    <SitePage label="Libraries">
      <SiteSection
        id="all-libraries"
        title="All libraries"
        lede={<>
          One npm package, <code>@brett_lamy/ui</code>, and every BL library inside it as an entry of its own:{' '}
          <code>@brett_lamy/ui/audio</code>, <code>@brett_lamy/ui/markdown</code>, <code>@brett_lamy/ui/diagram</code>. An app
          installs one thing and bundles only the entries it imports, or copies a library's source with the shadcn CLI.
          How they fit together is in <a href="#/roadmap/packages">the package map</a>.
        </>}
      >
        <LibraryGroups />
      </SiteSection>
    </SitePage>
  );
}

const TREE = `${REPO_URL}/tree/main`;

/** Where a library's code lives in the repo. */
function sourceOf(lib: Library): string {
  if (lib.id === 'ui-sdk') return `${TREE}/vendor`;
  if (lib.id === 'sandbox') return 'https://github.com/BLamy/almostnode';
  if (lib.id === 'linux-vm') return 'https://github.com/BLamy/wasm-vm';
  if (lib.entry) return `${TREE}/packages/ui/src/libraries/${lib.entry}.ts`;
  if (lib.id === 'docstream' || lib.id === 'docstream-editor') return `${TREE}/packages/ui/src/${lib.id}`;
  return `${TREE}/packages/ui/src`;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card variant="outline">
      <CardHeader><CardTitle render={<h2 />}>{title}</CardTitle></CardHeader>
      <CardContent className="pt-1">{children}</CardContent>
    </Card>
  );
}

const linkClass = cn('rounded-sm', pressableFocusRing);

/** `library-sizes.generated.json` (tools/size/measure.mjs): absent or empty until the package has been built and measured. */
const sizeFiles = import.meta.glob('./library-sizes.generated.json', { import: 'default', eager: true }) as Record<string, { libraries?: Record<string, { gzip: number; lazy?: { gzip: number }; peers?: string[] }> }>;
const SIZES = Object.values(sizeFiles)[0]?.libraries ?? {};
const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} kB`;

const REGISTRY_URL = 'https://blamy.github.io/ui/r';
/** The shadcn item that installs the whole library: the core and every library with a generated entry have one. */
const registryItemOf = (lib: Library) => (lib.id === 'ui' ? 'library-ui' : lib.entry ? `library-${lib.entry}` : null);
/** What an app writes to use the library from npm. */
function importLineOf(lib: Library): string {
  if (lib.id === 'ui-sdk') return `import { Dialog } from '@brett_lamy/ui/sdk/react/dialog';`;
  return `import { … } from '${lib.npm}';`;
}

/** One line of code with a button that copies it. */
function CopyLine({ label, text }: { label: string; text: string }) {
  const { copy, copied } = useCopy();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-footnote text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1 rounded-ctl bg-secondary py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-footnote whitespace-nowrap">{text}</code>
        <Button variant="ghost" size="sm" aria-label={`Copy: ${text}`} onClick={() => void copy(text)}>
          <Icon name={copied ? 'checkmark' : 'copy'} size={14} />
        </Button>
      </div>
    </div>
  );
}

export function LibraryPage({ id }: { id: string }) {
  const lib = LIBRARY[id];
  if (!lib) {
    return (
      <SitePage label="Library not found">
        <EmptyState
          icon={<Icon name="magnifyingglass" size={28} />}
          title={`No library called “${id}”`}
          description="It may have been renamed or folded into another one."
          action={<Button render={<a href="#/libraries" />} className="no-underline">See every library</Button>}
        />
      </SitePage>
    );
  }
  const deps = lib.dependsOn.map((d) => LIBRARY[d]);
  const usedBy = LIBRARIES.filter((l) => l.dependsOn.includes(lib.id));
  const changes = LAYER_EXCEPTIONS.filter((c) => lib.modules?.includes(c.unit));
  const item = registryItemOf(lib);
  const size = SIZES[lib.id];
  return (
    <SitePage label={lib.name}>
      <section aria-labelledby="library-title" className="flex flex-col gap-4">
        <a href="#/libraries" className={cn('flex w-fit items-center gap-1 text-footnote text-muted-foreground no-underline hover:text-foreground', linkClass)}>
          <Icon name="arrow-left" size={14} /> All libraries
        </a>
        <div className="flex flex-wrap items-center gap-3">
          <LibraryTile lib={lib} size="lg" />
          <h1 id="library-title" className="m-0 text-[clamp(2rem,3cqi+1.25rem,3rem)] leading-tight font-bold tracking-tight">{lib.name}</h1>
          <StatusBadge status={lib.status} />
        </div>
        <p className="m-0 max-w-3xl text-callout font-medium">{lib.tagline}</p>
        <p className="m-0 max-w-3xl text-body text-muted-foreground">{withCode(lib.description)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {lib.docs ? (
            <Button render={<a href={`#/${lib.docs}`} />} className="no-underline">Read the docs</Button>
          ) : (
            <Button render={<a href={`#/roadmap/packages#${packageAnchor(lib)}`} />} className="no-underline">See it on the map</Button>
          )}
          <Button variant="secondary" render={<a href={sourceOf(lib)} target="_blank" rel="noreferrer" />} className="no-underline">Source</Button>
          {lib.status !== 'planned' ? (
            <Button variant="secondary" render={<a href="https://www.npmjs.com/package/@brett_lamy/ui" target="_blank" rel="noreferrer" />} className="no-underline">npm</Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 @4xl/page:grid-cols-[3fr_2fr] @4xl/page:items-start">
        <div className="flex flex-col gap-4">
          <Panel title="Highlights">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lib.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-subhead"><Icon name="checkmark" size={16} className="mt-0.5 shrink-0 text-success" /><span>{withCode(h)}</span></li>
              ))}
            </ul>
          </Panel>
          {lib.modules?.length ? (
            <Panel title="Its code">
              <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-footnote">
                {lib.modules.map((m) => <li key={m} className="truncate">packages/ui/src/{m}</li>)}
              </ul>
              {changes.map((c) => <p key={c.unit} className="m-0 mt-3 text-subhead text-muted-foreground">{withCode(c.why)}</p>)}
            </Panel>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title={lib.status === 'planned' ? 'Not shipped yet' : 'Install'}>
            {lib.status === 'planned' ? (
              <p className="m-0 text-subhead text-muted-foreground">
                Planned. It will be an entry of <code>@brett_lamy/ui</code>, <code>{lib.npm}</code>, like every other library:
                nothing else to install. <a href="#/roadmap" className={linkClass}>Where it stands</a>
              </p>
            ) : (
            <div className="flex flex-col gap-3">
              <CopyLine label="From npm: one package for every library" text="npm install @brett_lamy/ui" />
              <CopyLine label="Then import this library's entry" text={importLineOf(lib)} />
              {item ? (
                <CopyLine label="Or copy its source with the shadcn CLI" text={`npx shadcn@latest add ${REGISTRY_URL}/${item}.json`} />
              ) : (
                <p className="m-0 text-footnote text-muted-foreground">
                  Not copied by the shadcn registry: registry items that use it install <code>@brett_lamy/ui</code> and import this entry.
                </p>
              )}
            </div>
            )}
            <dl className="m-0 mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-subhead">
              {lib.alsoAt?.length ? (
                <FragmentRow term="Also" value={<span className="flex flex-col">{lib.alsoAt.map((e) => <code key={e}>@brett_lamy/ui/{e}</code>)}</span>} />
              ) : null}
              {size ? (
                <FragmentRow
                  term="Loads"
                  value={<>
                    {kb(size.gzip)} gzip for everything it exports{size.lazy?.gzip ? <>, and up to {kb(size.lazy.gzip)} more on demand</> : null}.
                    {' '}<a href="#/roadmap/packages#entries" className={linkClass}>How it's measured</a>
                  </>}
                />
              ) : null}
              <dt className="text-muted-foreground">Status</dt>
              <dd className="m-0">{STATUS_LABEL[lib.status]}</dd>
              {lib.formerly?.map((f) => (
                <FragmentRow key={f.npm} term="Was" value={<><code>{f.npm}</code>: frozen at {f.last}. <a href="#/roadmap/migration" className={linkClass}>Migrating</a></>} />
              ))}
            </dl>
          </Panel>
          <Panel title="Builds on">
            {deps.length ? <div className="flex flex-wrap gap-1.5">{deps.map((d) => <LibraryChip key={d.id} lib={d} />)}</div> : <p className="m-0 text-subhead text-muted-foreground">No other BL library.</p>}
          </Panel>
          <Panel title="Used by">
            {usedBy.length ? <div className="flex flex-wrap gap-1.5">{usedBy.map((d) => <LibraryChip key={d.id} lib={d} />)}</div> : <p className="m-0 text-subhead text-muted-foreground">Nothing else in BL: it's a leaf.</p>}
          </Panel>
          {lib.external?.length ? (
            <Panel title="Brings from npm">
              <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-footnote">{lib.external.map((e) => <li key={e}>{e}</li>)}</ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </SitePage>
  );
}

/** Plain text with `backticked` spans as code. */
function withCode(text: string): ReactNode[] {
  return text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

function FragmentRow({ term, value }: { term: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="m-0">{value}</dd>
    </>
  );
}
