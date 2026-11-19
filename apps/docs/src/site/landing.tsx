/* The site's front page. It leads with the kit itself: the macOS block, a desktop built from the real parts, in a frame whose width
   the reader sets, so "responsive by container" is something they do rather than read. Then the two ways to install,
   as commands to copy, and the libraries as what they are: entries of one package. The page's own parts are in
   ./landing/. */
import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { pressableFocusRing } from '@/lib/primitives';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';
import { BLOCK_PAGES } from '../pages';
import { InstallWays } from './landing/install';
import { INSTALL_COMMAND, PACKAGE } from './landing/install-data';
import { LibraryIndex } from './landing/library-index';
import { Stage } from './landing/stage';
import { LIBRARY } from './libraries';
import { REPO_URL, SitePage } from './site-parts';

/* The macOS block: a desktop whose apps are the other blocks, and an iPhone under 640 px. Loaded after the page, and
   its apps load as they open. It doesn't record the session or open Alfred on load, so the page keeps its focus. */
const MacOS = lazy(() => import('@/components/blocks/macos/page'));

/** A link in the page's own voice: the text color, an arrow, underlined while hovered. */
function TextLink({ href, children, external }: { href: string; children: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : null)}
      className={cn('group/link inline-flex items-center gap-1 rounded-sm text-subhead font-medium text-foreground no-underline underline-offset-4 hover:underline', pressableFocusRing)}
    >
      {children}
      <Icon name={external ? 'arrow-up-right' : 'arrow-right'} size={14} className="text-muted-foreground transition-transform duration-spring-snappy ease-spring-snappy group-hover/link:translate-x-0.5 motion-reduce:transition-none" />
    </a>
  );
}

/** The install command as one line to copy. */
function InstallLine() {
  const { copy, copied } = useCopy();
  return (
    <div className="flex h-11 w-fit max-w-full items-center gap-2 rounded-ctl bg-secondary ps-4 pe-1.5">
      <span aria-hidden="true" className="font-mono text-detail text-tertiary-foreground select-none">$</span>
      <code className="min-w-0 truncate font-mono text-detail text-foreground select-all">{INSTALL_COMMAND}</code>
      <Button variant="quiet" size="icon-sm" aria-label={copied ? 'Copied' : 'Copy the install command'} onClick={() => { void copy(INSTALL_COMMAND); }}>
        <Icon name={copied ? 'check' : 'copy'} size={16} />
      </Button>
    </div>
  );
}

function SectionHeading({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <h2 id={id} className="m-0 text-title font-bold tracking-tight">{title}</h2>
      {children ? <p className="m-0 text-callout text-pretty text-muted-foreground">{children}</p> : null}
    </div>
  );
}

export function Landing() {
  const docstream = LIBRARY.docstream;
  return (
    <SitePage label="BL">
      <section aria-labelledby="hero" className="flex flex-col gap-8">
        <div className="grid gap-x-12 gap-y-6 @4xl/page:grid-cols-[minmax(0,1fr)_auto] @4xl/page:items-end">
          <div className="flex max-w-2xl flex-col gap-3">
            <h1 id="hero" className="m-0 text-large-title leading-tight font-bold tracking-tight text-balance">React libraries for apps that feel native</h1>
            <p className="m-0 text-body text-pretty text-muted-foreground">
              Navigation stacks, split views, dialogs that become sheets, a composer, diagrams and a Markdown renderer
              that streams. Behavior from <a href="https://ui-sdk.dev" target="_blank" rel="noreferrer">UI SDK</a>, looks
              from Tailwind v4 and tokens, and every container responds to its own width, not the window’s.
            </p>
          </div>
          <div className="flex flex-col gap-3 @4xl/page:items-end">
            <InstallLine />
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <TextLink href="#/introduction">Read the docs</TextLink>
              <TextLink href={REPO_URL} external>GitHub</TextLink>
            </div>
          </div>
        </div>
        <Stage
          label="macOS, a live example app"
          lead="This is the kit running, not a picture of it. Open an app from the Dock."
          caption={({ resizable, sizeClass, available, regularFits }) => (
            <>
              A desktop built from the kit, whose apps are the other <a href="#/blocks">blocks</a>: Mail, Notes, Reminders, Safari, VS Code and more. It measures its frame, never the window, so under 640 px it becomes an iPhone with a springboard, and the windows come back where they were when it widens.{' '}
              {resizable
                ? <>The frame is {sizeClass} now.{regularFits ? null : <> This page gives it at most {available} px, so regular, which starts at 1024 px, is out of reach here.</>}</>
                : <>The frame is {sizeClass} at this width; on a wider screen you can resize it.</>}
            </>
          )}
        >
          <Suspense fallback={<div role="status" className="grid h-full place-items-center text-footnote text-muted-foreground"><span className="flex items-center gap-2"><Spinner size={16} /> Starting the desktop…</span></div>}>
            <MacOS defaultApps={['mail', 'notes']} defaultOpen={false} autoFocus={false} record={false} />
          </Suspense>
        </Stage>
      </section>

      <section aria-labelledby="install" className="flex flex-col gap-8">
        <SectionHeading id="install" title="Two ways to install">
          The same files either way. Take the package and import what you use, or have the shadcn CLI copy the source into your project.
        </SectionHeading>
        <InstallWays />
      </section>

      <section aria-labelledby="libraries" className="flex flex-col gap-6">
        <SectionHeading id="libraries" title="One package, a library per entry">
          Everything ships in <code>{PACKAGE}</code>. Each library is a path you import from it; its page says what it holds.
          {docstream?.formerly?.length ? <> Docstream and its editor moved in with 6.0: <a href="#/roadmap/migration" className="whitespace-nowrap">how to migrate</a>.</> : null}
        </SectionHeading>
        <LibraryIndex />
      </section>

      <nav aria-labelledby="next" className="flex flex-col gap-4 border-t border-border pt-8">
        <h2 id="next" className="m-0 text-body font-semibold">Where to go next</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <TextLink href="#/introduction">Read the docs</TextLink>
          <TextLink href="#/blocks">{`Open the ${BLOCK_PAGES.length} example apps`}</TextLink>
          <TextLink href="#/libraries">All libraries</TextLink>
          <TextLink href={REPO_URL} external>Source on GitHub</TextLink>
        </div>
      </nav>
    </SitePage>
  );
}
