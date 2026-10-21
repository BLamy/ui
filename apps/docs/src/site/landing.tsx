/* The site's front page: what BL is, every library by category, how they layer, a live app, and how to install. */
import { GitbookStreamdown } from '@brett_lamy/docstream';
import { libraryPages } from 'virtual:bl-site-files';
import { Icon } from '@/lib/icon';
import { BLOCK_COUNT, demoResolver } from '../demos';
import { PAGE_LIST } from '../pages';
import { CATEGORIES, LIBRARIES, LIBRARY, byCategory, libraryRoute, type Library } from './libraries';
import { REPO_URL } from './site-header';

// Pages, counted without loading them: the ui docs, plus each library's docs folder.
const LIBRARY_PAGES = libraryPages;

const tone = (lib: Library) => CATEGORIES.find((c) => c.id === lib.category)!.tone;

export function LibraryCard({ lib }: { lib: Library }) {
  return (
    <a className="site-card" href={`#/${libraryRoute(lib)}`} data-tone={tone(lib)}>
      <div className="site-card-head">
        <span className="site-tile"><Icon name={lib.icon} size={21} /></span>
        <span className="site-card-title">{lib.name}</span>
        <span className="site-status" data-status={lib.status}>{lib.status === 'live' ? 'On npm' : 'Planned'}</span>
      </div>
      <p>{lib.tagline}</p>
      <code>{lib.npm}</code>
    </a>
  );
}

export function LibraryGroups() {
  return (
    <>
      {CATEGORIES.map((c) => (
        <div key={c.id} className="site-group" data-tone={c.tone}>
          <h3 className="site-kicker">{c.label}</h3>
          <div className="site-cards">
            {byCategory(c.id).map((lib) => <LibraryCard key={lib.id} lib={lib} />)}
          </div>
        </div>
      ))}
    </>
  );
}

/* Tiers, top to bottom; each builds only on the ones below it (libraries.test.ts holds the plan to that). */
const LAYERS: Array<{ name: string; note: string; ids: string[] }> = [
  { name: 'Features', note: 'Built on the core', ids: ['time', 'canvas', 'media', 'composer', 'sql', 'filter', 'vault', 'tailscale'] },
  { name: 'Core', note: 'Primitives and containers', ids: ['ui', 'markdown'] },
  { name: 'Foundation', note: 'No UI of their own', ids: ['tokens', 'icons', 'motion'] },
  { name: 'Standalone', note: 'Depend on no BL package', ids: ['docstream', 'docstream-editor', 'pglite', 'sync', 'registry'] },
];

const INSTALL_SOURCE = '{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/navigation-stack.json{% endcommand %}';
const INSTALL_PACKAGE = '{% command %}npm install @brett_lamy/ui @brett_lamy/docstream{% endcommand %}';
const DEMO = '{% demo src="introduction/first-app" %}';

export function Landing() {
  const live = LIBRARIES.filter((l) => l.status === 'live').length;
  return (
    <div className="site-scroll dk-scroll" id="site-scroll">
      <section className="site-hero">
        <div className="site-hero-inner">
          <h1>React libraries for apps that feel <em>native</em></h1>
          <div>
            <p className="site-hero-lede">
              Components, motion, Markdown and data tools that compose like UIKit — accessible on React Aria, themed with CSS
              variables, and yours to copy as source or install from npm.
            </p>
            <div className="site-ctas">
              <a className="site-btn" href="#/libraries">Browse the libraries</a>
              <a className="site-text-link" href="#/roadmap">Read the plan <Icon name="arrow-right" size={15} /></a>
            </div>
          </div>
        </div>
      </section>

      <div className="site-stats">
        <div className="site-stat"><strong>{LIBRARIES.length}</strong><span>Libraries</span></div>
        <div className="site-stat"><strong>{live}</strong><span>On npm today</span></div>
        <div className="site-stat"><strong>{BLOCK_COUNT}</strong><span>App blocks</span></div>
        <div className="site-stat"><strong>{PAGE_LIST.length + LIBRARY_PAGES}</strong><span>Docs pages</span></div>
      </div>

      <section className="site-section">
        <h2>The libraries</h2>
        <p>
          {live} are on npm today. The rest live inside <code>@brett_lamy/ui</code> and are next in line to become packages
          of their own — each one is mapped, module by module, in the <a href="#/roadmap">plan</a>.
        </p>
        <LibraryGroups />
      </section>

      <section className="site-section">
        <h2>Built in layers</h2>
        <p>Each tier builds only on the tiers below it, so an app installs the parts it uses and nothing above them.</p>
        <div className="site-layers">
          {LAYERS.map((layer) => (
            <div key={layer.name} className="site-layer">
              <div className="site-layer-name"><strong>{layer.name}</strong><span>{layer.note}</span></div>
              <div className="site-chips">
                {layer.ids.map((id) => {
                  const lib = LIBRARY[id];
                  return (
                    <a key={id} className="site-chip" href={`#/${libraryRoute(lib)}`} data-tone={tone(lib)} data-status={lib.status}>
                      <Icon name={lib.icon} size={16} />
                      {lib.name}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="site-section">
        <h2>Not screenshots</h2>
        <p>
          Every example on this site is the real component, running. This one is a TabView with a NavigationStack inside,
          inset Lists and a Credenza tray — swipe back from the left edge.
        </p>
        <div className="site-md wb-md">
          <GitbookStreamdown markdown={DEMO} demoResolver={demoResolver} />
        </div>
      </section>

      <section className="site-section">
        <h2>Two ways in</h2>
        <p>The same source, two ways: copy what you need into your project, or install the packages.</p>
        <div className="site-split">
          <div className="site-panel">
            <h3>Copy the source</h3>
            <p>The shadcn registry copies a component and the parts it's built from into your project. You own the code, and you only ship what you add.</p>
            <div className="site-md wb-md"><GitbookStreamdown markdown={INSTALL_SOURCE} /></div>
          </div>
          <div className="site-panel">
            <h3>Install the packages</h3>
            <p>Everything, bundled and typed, from npm. Import the stylesheet once and the parts from the package root.</p>
            <div className="site-md wb-md"><GitbookStreamdown markdown={INSTALL_PACKAGE} /></div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>BL — open source, MIT.</span>
      <a href="#/libraries">Libraries</a>
      <a href="#/blocks">Blocks</a>
      <a href="#/roadmap">Roadmap</a>
      <a href="#/introduction">UI docs</a>
      <a href="#/docstream">Docstream docs</a>
      <a className="site-footer-end" href={REPO_URL} target="_blank" rel="noreferrer">github.com/BLamy/ui</a>
    </footer>
  );
}
