/* The pieces every page of the BL site shares, all on the kit: the brand mark, a library's category color, the page
   and the footer. */
import type { ReactNode } from 'react';
import { brandTile, pressableFocusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { categoryOf, type Library } from './libraries';

export const REPO_URL = 'https://github.com/BLamy/ui';

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
