/* `#/libraries` (every library) and `#/libraries/<id>` (one library: what it's for, what's in it, what it builds on,
   which npm package it ships in). */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/lib/icon';
import { pressableFocusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { LIBRARIES, LIBRARY, SPLIT_CHANGES, STATUS_LABEL, packageOf, type Library } from './libraries';
import { packageAnchor } from './roadmap-anchor';
import { LibraryChip, LibraryGroups, LibraryTile, REPO_URL, SitePage, SiteSection, StatusBadge } from './site-parts';

export function LibrariesIndex() {
  return (
    <SitePage label="Libraries">
      <SiteSection
        id="all-libraries"
        title="All libraries"
        lede={<>
          Every BL library, by what it's for. <strong>{STATUS_LABEL.live}</strong> ones ship today, <strong>{STATUS_LABEL.new}</strong>{' '}
          ones publish for the first time with 6.0, and <strong>{STATUS_LABEL.planned}</strong> ones ship inside{' '}
          <code>@brett_lamy/ui</code> until the split gives each a package of its own — see <a href="#/roadmap">the plan</a>.
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
  if (lib.id === 'registry') return `${TREE}/tools/registry`;
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
  const changes = SPLIT_CHANGES.filter((c) => lib.modules?.includes(c.unit));
  const host = lib.partOf ? packageOf(lib) : null;
  const npmPackages = lib.packages ?? [lib.npm];
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
            <Button render={<a href={`#/roadmap/packages#${packageAnchor(lib)}`} />} className="no-underline">See it in the plan</Button>
          )}
          <Button variant="secondary" render={<a href={sourceOf(lib)} target="_blank" rel="noreferrer" />} className="no-underline">Source</Button>
          {lib.status !== 'planned' && !lib.partOf ? (
            <Button variant="secondary" render={<a href={`https://www.npmjs.com/package/${npmPackages.at(-1)}`} target="_blank" rel="noreferrer" />} className="no-underline">npm</Button>
          ) : null}
          <code className="rounded-ctl bg-secondary px-2.5 py-1.5 font-mono text-footnote">{lib.npm}</code>
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
            <Panel title={lib.status === 'planned' ? 'Moves here from @brett_lamy/ui' : 'Its code in @brett_lamy/ui'}>
              {lib.status === 'planned' ? (
                <p className="m-0 mb-3 text-subhead text-muted-foreground">
                  Planned. This code ships inside <code>@brett_lamy/ui</code> today (and as its shadcn registry items), so it
                  already works; the split gives it its own package, docs and version.
                </p>
              ) : null}
              <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-footnote">
                {lib.modules.map((m) => <li key={m} className="truncate">packages/ui/src/{m}</li>)}
              </ul>
              {changes.map((c) => <p key={c.unit} className="m-0 mt-3 text-subhead text-muted-foreground">{withCode(c.change)}</p>)}
            </Panel>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="On npm">
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-subhead">
              {host ? (
                <>
                  <dt className="text-muted-foreground">Ships in</dt>
                  <dd className="m-0"><a href={`#/libraries/${host.id}`} className={linkClass}><code>{host.npm}</code></a>, as <code>{lib.npm}</code></dd>
                </>
              ) : (
                <>
                  <dt className="text-muted-foreground">{npmPackages.length > 1 ? 'Packages' : 'Package'}</dt>
                  <dd className="m-0 flex flex-col">{npmPackages.map((p) => <code key={p}>{p}</code>)}</dd>
                </>
              )}
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
