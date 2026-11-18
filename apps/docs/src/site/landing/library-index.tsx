/* Every library as what it is: an entry of one package. An index, not a card grid: a group per category, a row per
   library with its name, one line, the path an app imports, and its size when the build has measured it. Each row is a
   link to the library's page. Everything comes from the manifest (`../libraries`), so a library added there shows here. */
import { Icon } from '@/lib/icon';
import { pressableFocusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { CATEGORIES, LIBRARIES, byCategory, libraryRoute, type Library } from '../libraries';
import { toneTextOf } from '../site-parts';
import { PACKAGE } from './install-data';
import { formatSize, gzipSize } from './sizes';

/** The import path, with the package's name set back so the eye lands on the entry: `@brett_lamy/ui` + `/audio`. */
function ImportPath({ path }: { path: string }) {
  const entry = path.startsWith(`${PACKAGE}/`) ? path.slice(PACKAGE.length) : '';
  return (
    <code className="font-mono text-footnote whitespace-nowrap">
      <span className={entry ? 'text-muted-foreground' : 'text-foreground'}>{entry ? PACKAGE : path}</span>
      {entry ? <span className="text-foreground">{entry}</span> : null}
    </code>
  );
}

/** Sizes are a column only once the build has measured some. */
const MEASURED = LIBRARIES.some((l) => gzipSize(l.id) !== undefined);

/** A row's columns on a wide page: icon, name, tagline, import path, (size,) chevron. The path has a fixed width, so the
    package's name starts on one line down the whole index and the entries read as a column. */
const WIDE_COLUMNS = MEASURED
  ? '@3xl/page:grid-cols-[auto_8.5rem_minmax(0,1fr)_16.5rem_4.5rem_auto]'
  : '@3xl/page:grid-cols-[auto_8.5rem_minmax(0,1fr)_16.5rem_auto]';

function LibraryRow({ lib }: { lib: Library }) {
  const size = gzipSize(lib.id);
  return (
    <li className="border-t border-border first:border-t-0">
      <a
        href={`#/${libraryRoute(lib)}`}
        className={cn(
          'group/row grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-ctl px-2 py-2.5 text-foreground no-underline',
          WIDE_COLUMNS, '@3xl/page:gap-x-4',
          'transition-colors hover:bg-accent/60 motion-reduce:transition-none',
          pressableFocusRing,
        )}
      >
        <Icon name={lib.icon} size={18} className={cn('mt-0.5 shrink-0 self-start', toneTextOf(lib))} />
        <span className="truncate text-subhead font-semibold">{lib.name}</span>
        <span className="col-span-2 col-start-2 row-start-2 text-footnote text-pretty text-muted-foreground @3xl/page:col-span-1 @3xl/page:col-start-3 @3xl/page:row-start-1 @3xl/page:text-detail">
          {lib.tagline}
        </span>
        <span className="col-span-2 col-start-2 row-start-3 min-w-0 truncate @3xl/page:col-span-1 @3xl/page:col-start-4 @3xl/page:row-start-1">
          <ImportPath path={lib.npm} />
        </span>
        {MEASURED ? (
          <span className="col-start-3 row-start-1 text-end text-footnote text-muted-foreground tabular-nums @3xl/page:col-start-5">
            {size ? <>{formatSize(size)}<span className="sr-only"> gzipped</span></> : null}
          </span>
        ) : null}
        <Icon name="chevron-right" size={14} className="hidden self-center text-tertiary-foreground transition-transform duration-spring-snappy ease-spring-snappy group-hover/row:translate-x-0.5 motion-reduce:transition-none @3xl/page:block" />
      </a>
    </li>
  );
}

/** The libraries, a group per category in the manifest's order. */
export function LibraryIndex() {
  return (
    <div className="flex flex-col gap-8">
      {CATEGORIES.map((c) => {
        const libs = byCategory(c.id);
        if (!libs.length) return null;
        return (
          <section key={c.id} aria-labelledby={`landing-${c.id}`} className="grid gap-x-8 gap-y-2 border-t border-border pt-4 @4xl/page:grid-cols-[9rem_minmax(0,1fr)]">
            <h3 id={`landing-${c.id}`} className="m-0 px-2 text-footnote font-semibold tracking-wide text-muted-foreground uppercase @4xl/page:px-0 @4xl/page:pt-3">{c.label}</h3>
            <ul className="m-0 flex list-none flex-col p-0">
              {libs.map((lib) => <LibraryRow key={lib.id} lib={lib} />)}
            </ul>
          </section>
        );
      })}
      {MEASURED ? <p className="m-0 text-footnote text-muted-foreground">Sizes are each library's own modules, minified and gzipped.</p> : null}
    </div>
  );
}
