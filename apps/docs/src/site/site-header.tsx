/* The header on every page of the site, and the only bar: the brand, the Libraries menu (every library by category,
   with its status), the Docs, Blocks and Roadmap links, GitHub and the appearance switch. Over a docs site (the ui
   docs, docstream's, the editor's, the roadmap) it also holds that site's search and, while the site is narrow enough
   to fold its sidebar away, the button that opens its navigation: the DocsSite under it is mounted without a header
   of its own (`header={false}`), and these are its own triggers, connected through its controller.

   It is the kit's responsive pattern, not a hand-made one. The header measures its own width (a size-class scope, as
   CONVENTIONS rule 10 asks) and its menus are DropdownMenus with `presentation="auto"`: on a regular or medium header
   the Libraries menu is a popover laid out in columns, one per category; on a compact one the links fold into a single
   menu button, and the same menu opens as a sheet. UI SDK owns the keyboard (arrow keys through the rows, typeahead,
   Esc, focus back to the trigger). */
import { DocsSiteNavigationTrigger, DocsSiteSearchTrigger, type DocsSiteController } from '@brett_lamy/ui/docstream/site';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuGroupLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import type { SizeClass } from '@/lib/size-class';
import { Icon } from '@/lib/icon';
import { barMaterial, pressableFocusRing } from '@/lib/primitives';
import { ThemeScope, type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { CATEGORIES, STATUS_LABEL, byCategory, libraryRoute, type Library } from './libraries';
import { BLMark, REPO_URL, toneTextOf } from './site-parts';

/** The site's own sections, by route prefix. `Docs` is every ui docs page that isn't a block. */
const SECTIONS = [
  { label: 'Docs', href: '#/introduction', current: (route: string) => route !== 'blocks' && !route.startsWith('blocks/') },
  { label: 'Blocks', href: '#/blocks', current: (route: string) => route === 'blocks' || route.startsWith('blocks/') },
  { label: 'Roadmap', href: '#/roadmap', current: (route: string) => route === 'roadmap' || route.startsWith('roadmap/') },
] as const;

export type SiteArea = 'home' | 'libraries' | 'docs' | 'library-docs';

/** Docs and Blocks are ui docs pages; the Roadmap is a docs site of its own. */
const sectionCurrent = (s: (typeof SECTIONS)[number], route: string, area: SiteArea) => (s.label === 'Roadmap' || area === 'docs') && s.current(route);

/** A row's second line: the status, and in a sheet (where rows are wide) the package too. */
const describe = (lib: Library, compact: boolean) => (compact ? `${STATUS_LABEL[lib.status]} · ${lib.npm}` : STATUS_LABEL[lib.status]);
/** The row of the page you're on. */
const CURRENT_ROW = 'aria-[current=page]:font-semibold aria-[current=page]:text-primary';

function LibraryRows({ compact, route }: { compact: boolean; route: string }) {
  return CATEGORIES.map((c, i) => (
    <DropdownMenuGroup key={c.id}>
      {compact && i > 0 ? <DropdownMenuSeparator /> : null}
      <DropdownMenuGroupLabel>{c.label}</DropdownMenuGroupLabel>
      {byCategory(c.id).map((lib) => (
        <DropdownMenuItem
          key={lib.id}
          render={<a href={`#/${libraryRoute(lib)}`} aria-current={route === libraryRoute(lib) ? 'page' : undefined} />}
          icon={<Icon name={lib.icon} size={compact ? 20 : 16} className={toneTextOf(lib)} />}
          description={describe(lib, compact)}
          className={CURRENT_ROW}
        >
          {lib.name}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  ));
}

/** Every library, by category: columns in a popover, or one list in a sheet. In a compact header it also carries the
    site's sections, which the header has no room for. */
function SiteMenu({ compact, columns, route, area }: { compact: boolean; columns: 3 | 5; route: string; area: SiteArea }) {
  const onLibraries = route === 'libraries' || route.startsWith('libraries/');
  // Keyed by the route: a navigation the menu didn't make (Back, a link elsewhere) closes it.
  return (
    <DropdownMenu key={route} presentation="auto">
      {compact ? (
        <DropdownMenuTrigger render={<Button variant="quiet" size="icon" aria-label="Menu" />}>
          <Icon name="line-3-horizontal" size={18} />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={<Button variant="quiet" size="sm" aria-current={onLibraries ? 'page' : undefined} className="aria-[current=page]:bg-accent aria-[current=page]:text-foreground" />}
        >
          Libraries
          <Icon name="chevron-down" size={12} className="transition-transform duration-spring-snappy ease-spring-snappy in-aria-expanded:rotate-180 motion-reduce:transition-none" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        data-bl-site=""
        aria-label={compact ? 'Site' : 'Libraries'}
        size={compact ? 'default' : 'sm'}
        align="start"
        className={cn(!compact && ['grid max-w-[var(--available-width)] gap-x-1 gap-y-2 p-2', columns === 5 ? 'w-[60rem] grid-cols-5' : 'w-[36rem] grid-cols-3'])}
      >
        {compact ? (
          <DropdownMenuGroup>
            <DropdownMenuItem className={CURRENT_ROW} render={<a href="#/" aria-current={area === 'home' ? 'page' : undefined} />} icon={<Icon name="house" size={20} />}>Home</DropdownMenuItem>
            {SECTIONS.map((s) => (
              <DropdownMenuItem key={s.href} className={CURRENT_ROW} render={<a href={s.href} aria-current={sectionCurrent(s, route, area) ? 'page' : undefined} />}>{s.label}</DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
        {compact ? <DropdownMenuSeparator /> : null}
        <LibraryRows compact={compact} route={route} />
        {compact ? <DropdownMenuSeparator /> : null}
        <DropdownMenuGroup className={cn(!compact && 'col-span-full border-t border-border pt-1')}>
          <DropdownMenuItem className={CURRENT_ROW} render={<a href="#/libraries" aria-current={route === 'libraries' ? 'page' : undefined} />} icon={<Icon name="grid" size={compact ? 20 : 16} />}>
            All libraries
          </DropdownMenuItem>
          {compact ? null : (
            <DropdownMenuItem render={<a href="#/roadmap/packages" />} icon={<Icon name="arrow-right" size={16} />} description="What moves where, checked against the code">
              The split plan
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The docs site mounted under the header: its controller, and the name its search goes by ("Search Docstream…"). */
interface SiteHeaderDocs {
  controller: DocsSiteController;
  name: string;
}

/** The docs site's search, as the site's ⌘K opens it: a field-like button with the shortcut on a regular header, a
    shorter one on a medium header, a round icon button on a compact one. */
function DocsSearch({ docs, sizeClass }: { docs: SiteHeaderDocs; sizeClass: SizeClass }) {
  const compact = sizeClass === 'compact';
  return (
    <DocsSiteSearchTrigger
      controller={docs.controller}
      aria-label={`Search ${docs.name}`}
      render={<Button variant={compact ? 'quiet' : 'outline'} size={compact ? 'icon' : 'sm'} />}
      className={cn(!compact && 'me-1.5 justify-start gap-2 ps-2.5 pe-1.5 font-normal text-muted-foreground hover:not-data-disabled:text-foreground', sizeClass === 'regular' && 'min-w-56')}
    >
      <Icon name="magnifyingglass" size={compact ? 18 : 15} />
      {compact ? null : <span className="flex-1 pe-1 text-start">{sizeClass === 'regular' ? `Search ${docs.name}…` : 'Search…'}</span>}
      {sizeClass === 'regular' ? <Kbd keys="mod+k" /> : null}
    </DocsSiteSearchTrigger>
  );
}

export function SiteHeader({ route, area, appearance, onToggleAppearance, docs }: {
  route: string;
  area: SiteArea;
  appearance: Appearance;
  onToggleAppearance: () => void;
  /** The docs site this route mounts, if it does. */
  docs?: SiteHeaderDocs;
}) {
  const [measure, sizeClass] = useSizeClass<HTMLElement>();
  const compact = sizeClass === 'compact';
  const dark = appearance === 'dark';
  return (
    <ThemeScope data-bl-site="" appearance={appearance} className="relative z-20 shrink-0 font-sans text-foreground">
      <SizeClassProvider value={sizeClass}>
        <header ref={measure} className={cn('flex h-14 items-center gap-1 shadow-hairline-b', compact ? 'px-2' : 'px-4', barMaterial)}>
          {docs ? (
            // Renders only while the docs site's sidebar is folded into its drawer.
            <DocsSiteNavigationTrigger controller={docs.controller} aria-label="Open the docs navigation" render={<Button variant="quiet" size="icon" />} className={cn(!compact && '-ms-1.5')}>
              <Icon name="sidebar-left" size={18} />
            </DocsSiteNavigationTrigger>
          ) : null}
          <a href="#/" aria-label="BL, home" aria-current={area === 'home' ? 'page' : undefined} className={cn('me-2 flex items-center gap-2 rounded-ctl px-1.5 py-1 text-foreground no-underline', pressableFocusRing)}>
            <BLMark />
            <span className="text-callout font-bold tracking-tight">BL</span>
          </a>
          {compact ? null : (
            <nav aria-label="Site" className="flex items-center gap-0.5">
              <SiteMenu compact={false} columns={sizeClass === 'regular' ? 5 : 3} route={route} area={area} />
              {SECTIONS.map((s) => {
                const current = sectionCurrent(s, route, area);
                return (
                  <Button
                    key={s.href}
                    variant="quiet"
                    size="sm"
                    render={<a href={s.href} aria-current={current ? 'page' : undefined} />}
                    className="no-underline aria-[current=page]:bg-accent aria-[current=page]:text-foreground"
                  >
                    {s.label}
                  </Button>
                );
              })}
            </nav>
          )}
          <div className="ms-auto flex items-center gap-0.5">
            {docs ? <DocsSearch docs={docs} sizeClass={sizeClass} /> : null}
            <Button variant="quiet" size="icon" render={<a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository" />}>
              <GitHubMark />
            </Button>
            <Button variant="quiet" size="icon" aria-label={dark ? 'Use the light appearance' : 'Use the dark appearance'} onClick={onToggleAppearance}>
              <Icon name={dark ? 'sun' : 'moon'} size={18} />
            </Button>
            {compact ? <SiteMenu compact columns={3} route={route} area={area} /> : null}
          </div>
        </header>
      </SizeClassProvider>
    </ThemeScope>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}
