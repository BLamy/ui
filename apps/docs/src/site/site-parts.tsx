/* The pieces every page of the BL site shares, all on the kit: the brand mark, a library's tile and status, its card,
   the grid of cards by category, and the footer. */
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/lib/icon';
import { brandTile, pressableFocusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { CATEGORIES, STATUS_LABEL, byCategory, categoryOf, libraryRoute, type Library, type Status } from './libraries';

export const REPO_URL = 'https://github.com/BLamy/ui';

/** A category's chart color, as whole class names (Tailwind reads them from here). */
const TONE: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'bg-chart-1/15 text-chart-1',
  2: 'bg-chart-2/15 text-chart-2',
  3: 'bg-chart-3/15 text-chart-3',
  4: 'bg-chart-4/15 text-chart-4',
  5: 'bg-chart-5/15 text-chart-5',
};
export const toneOf = (lib: Library) => TONE[categoryOf(lib).tone];
const TONE_TEXT: Record<1 | 2 | 3 | 4 | 5, string> = { 1: 'text-chart-1', 2: 'text-chart-2', 3: 'text-chart-3', 4: 'text-chart-4', 5: 'text-chart-5' };
/** A library's category color as a text color (an icon on a menu row). */
export const toneTextOf = (lib: Library) => TONE_TEXT[categoryOf(lib).tone];

/** The BL mark: the docs' equalizer bars on the brand tile. */
export function BLMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-grid size-7 shrink-0 place-items-center rounded-lg text-primary-foreground', brandTile, className)} aria-hidden="true">
      <svg viewBox="0 0 34 34" className="size-[82%]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M8 15.5v3M12.25 11.5v11M17 7.5v19M21.75 11.5v11M26 15.5v3" />
      </svg>
    </span>
  );
}

/** A library's icon on its category's tint. */
export function LibraryTile({ lib, size = 'default' }: { lib: Library; size?: 'sm' | 'default' | 'lg' }) {
  const box = size === 'lg' ? 'size-14 rounded-card' : size === 'sm' ? 'size-7 rounded-lg' : 'size-10 rounded-ctl';
  return (
    <span className={cn('inline-grid shrink-0 place-items-center', box, toneOf(lib))} aria-hidden="true">
      <Icon name={lib.icon} size={size === 'lg' ? 30 : size === 'sm' ? 16 : 22} />
    </span>
  );
}

const STATUS_VARIANT: Record<Status, 'success' | 'tinted' | 'outline'> = { live: 'success', new: 'tinted', planned: 'outline' };

export function StatusBadge({ status, size }: { status: Status; size?: 'sm' | 'default' }) {
  return <Badge variant={STATUS_VARIANT[status]} size={size}>{STATUS_LABEL[status]}</Badge>;
}

/** A library as a card that links to its page. */
export function LibraryCard({ lib }: { lib: Library }) {
  return (
    <Card
      variant="outline"
      render={<a href={`#/${libraryRoute(lib)}`} />}
      className={cn('no-underline transition-colors hover:bg-accent/60 motion-reduce:transition-none', pressableFocusRing)}
    >
      <CardHeader className="items-center gap-x-3 has-data-[slot=card-action]:grid-cols-[auto_1fr_auto]">
        <LibraryTile lib={lib} />
        <CardTitle className="min-w-0 truncate">{lib.name}</CardTitle>
        <CardAction className="col-start-3 row-span-1 self-center"><StatusBadge status={lib.status} size="sm" /></CardAction>
      </CardHeader>
      <CardDescription className="flex-1 px-4 pt-1 pb-2">{lib.tagline}</CardDescription>
      <CardFooter>
        <code className="truncate font-mono text-caption text-muted-foreground">{lib.npm}</code>
      </CardFooter>
    </Card>
  );
}

/** Every library, as cards under their category. */
export function LibraryGroups() {
  return (
    <div className="flex flex-col gap-8">
      {CATEGORIES.map((c) => (
        <section key={c.id} aria-labelledby={`category-${c.id}`}>
          <h3 id={`category-${c.id}`} className="m-0 mb-3 flex items-center gap-2 text-footnote font-semibold tracking-wide text-muted-foreground uppercase">
            <span className={cn('size-2 rounded-full', TONE[c.tone])} aria-hidden="true" />
            {c.label}
          </h3>
          <div className="grid grid-cols-1 gap-3 @2xl/page:grid-cols-2 @5xl/page:grid-cols-3">
            {byCategory(c.id).map((lib) => <LibraryCard key={lib.id} lib={lib} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A library as a small link (the "builds on" and "used by" lists, the layers). */
export function LibraryChip({ lib }: { lib: Library }) {
  return (
    <Button variant="outline" size="sm" render={<a href={`#/${libraryRoute(lib)}`} />} className="no-underline">
      <LibraryTile lib={lib} size="sm" />
      {lib.name}
      {lib.status === 'planned' ? <span className="sr-only"> (planned)</span> : null}
    </Button>
  );
}

/** Links in running text: the kit's link color, underlined while hovered. */
const PROSE_LINKS = '[&_code]:font-mono [&_:is(p,dd)_a]:text-link [&_:is(p,dd)_a]:underline-offset-2 [&_:is(p,dd)_a:hover]:underline';

/** A page of the site: a scroll container that is also the size container its sections respond to. */
export function SitePage({ children, label }: { children: ReactNode; label: string }) {
  return (
    <main id="site-scroll" data-bl-site="" aria-label={label} className={cn('@container/page bl-scroll h-full overflow-y-auto bg-background text-foreground select-text', PROSE_LINKS)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 pt-10 pb-6 @3xl/page:px-10 @3xl/page:pt-16">{children}</div>
      <SiteFooter />
    </main>
  );
}

export function SiteSection({ title, lede, children, id }: { title: string; lede?: ReactNode; children: ReactNode; id?: string }) {
  const heading = id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-5">
      <div className="flex max-w-3xl flex-col gap-2">
        <h2 id={heading} className="m-0 text-title font-bold tracking-tight">{title}</h2>
        {lede ? <p className="m-0 text-callout text-muted-foreground">{lede}</p> : null}
      </div>
      {children}
    </section>
  );
}

const FOOTER_LINKS: Array<[string, string]> = [
  ['Libraries', '#/libraries'],
  ['UI docs', '#/introduction'],
  ['Blocks', '#/blocks'],
  ['Docstream', '#/docstream'],
  ['Roadmap', '#/roadmap'],
];

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-10 flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-6 text-footnote text-muted-foreground @3xl/page:px-10">
      <span className="flex items-center gap-2"><BLMark className="size-5 rounded-md" /> BL — open source, MIT.</span>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
        {FOOTER_LINKS.map(([label, href]) => (
          <a key={href} href={href} className={cn('rounded-sm text-muted-foreground no-underline hover:text-foreground', pressableFocusRing)}>{label}</a>
        ))}
      </nav>
      <a href={REPO_URL} target="_blank" rel="noreferrer" className={cn('ms-auto rounded-sm text-muted-foreground no-underline hover:text-foreground', pressableFocusRing)}>
        github.com/BLamy/ui
      </a>
    </footer>
  );
}
