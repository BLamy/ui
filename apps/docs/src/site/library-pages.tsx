/* `#/libraries` (every library) and `#/libraries/<id>` (one library: what it's for, what's in it, what it builds on). */
import { Icon } from '@/lib/icon';
import { CATEGORIES, LIBRARIES, LIBRARY, SPLIT_CHANGES, libraryRoute, type Library } from './libraries';
import { LibraryGroups, SiteFooter } from './landing';
import { packageAnchor } from './roadmap-anchor';
import { REPO_URL } from './site-header';

const tone = (lib: Library) => CATEGORIES.find((c) => c.id === lib.category)!.tone;

function Chip({ lib }: { lib: Library }) {
  return (
    <a className="site-chip" href={`#/${libraryRoute(lib)}`} data-tone={tone(lib)} data-status={lib.status}>
      <Icon name={lib.icon} size={16} />
      {lib.name}
    </a>
  );
}

export function LibrariesIndex() {
  return (
    <div className="site-scroll dk-scroll" id="site-scroll">
      <section className="site-section">
        <h2>All libraries</h2>
        <p>
          Every BL package, by what it's for. <span className="site-status" data-status="live">On npm</span> ones have docs
          here today; <span className="site-status" data-status="planned">Planned</span> ones ship inside{' '}
          <code>@brett_lamy/ui</code> until the split gives each its own package — see the <a href="#/roadmap">plan</a>.
        </p>
        <LibraryGroups />
      </section>
      <SiteFooter />
    </div>
  );
}

const TREE = `${REPO_URL}/tree/main`;

export function LibraryPage({ id }: { id: string }) {
  const lib = LIBRARY[id];
  if (!lib) {
    return (
      <div className="site-scroll dk-scroll">
        <section className="site-section">
          <h2>No library called “{id}”</h2>
          <p><a href="#/libraries">See every library</a>.</p>
        </section>
      </div>
    );
  }
  const deps = lib.dependsOn.map((d) => LIBRARY[d]);
  const usedBy = LIBRARIES.filter((l) => l.dependsOn.includes(lib.id));
  const changes = SPLIT_CHANGES.filter((c) => lib.modules?.includes(c.unit));
  const source = lib.status === 'live' ? `${TREE}/packages/${lib.id}` : `${TREE}/packages/ui/src`;
  return (
    <div className="site-scroll dk-scroll" id="site-scroll" data-tone={tone(lib)}>
      <section className="site-lib-hero">
        <a className="site-back" href="#/libraries"><Icon name="arrow-left" size={14} /> All libraries</a>
        <div className="site-lib-title">
          <span className="site-tile"><Icon name={lib.icon} size={30} /></span>
          <h1>{lib.name}</h1>
          <span className="site-status" data-status={lib.status}>{lib.status === 'live' ? 'On npm' : 'Planned'}</span>
        </div>
        <p className="site-lib-tagline">{lib.tagline}</p>
        <p className="site-lib-desc">{lib.description}</p>
        <div className="site-ctas">
          {lib.docs ? <a className="site-btn" href={`#/${lib.docs}`}>Read the docs</a> : <a className="site-btn" href={`#/roadmap/packages#${packageAnchor(lib)}`}>See it in the plan</a>}
          <a className="site-btn" data-variant="soft" href={source} target="_blank" rel="noreferrer">Source</a>
          {lib.status === 'live' ? <a className="site-btn" data-variant="soft" href={`https://www.npmjs.com/package/${lib.npm}`} target="_blank" rel="noreferrer">npm</a> : null}
          <code className="site-npm">{lib.npm}</code>
        </div>
      </section>

      <div className="site-lib-grid">
        <div className="site-stack">
          <div className="site-panel">
            <h3>Highlights</h3>
            <ul className="site-list">
              {lib.highlights.map((h) => <li key={h}><Icon name="checkmark" size={16} />{h}</li>)}
            </ul>
          </div>
          {lib.modules?.length ? (
            <div className="site-panel">
              <h3>{lib.status === 'planned' ? 'Moves here from @brett_lamy/ui' : 'Joins it from @brett_lamy/ui'}</h3>
              {lib.status === 'planned' ? (
                <p className="site-note">
                  Planned. This code ships today inside <code>@brett_lamy/ui</code> (and its shadcn registry items), so it
                  already works — the split gives it its own package, docs and version.
                </p>
              ) : null}
              <ul className="site-files">
                {lib.modules.map((m) => <li key={m}>packages/ui/src/{m}</li>)}
              </ul>
              {changes.map((c) => <p key={c.unit} className="site-note" style={{ marginTop: 14, marginBottom: 0 }}>{c.change}</p>)}
            </div>
          ) : null}
        </div>
        <div className="site-stack">
          <div className="site-panel">
            <h3>Builds on</h3>
            {deps.length ? <div className="site-chips">{deps.map((d) => <Chip key={d.id} lib={d} />)}</div> : <p className="site-note" style={{ margin: 0 }}>No other BL package.</p>}
          </div>
          <div className="site-panel">
            <h3>Used by</h3>
            {usedBy.length ? <div className="site-chips">{usedBy.map((d) => <Chip key={d.id} lib={d} />)}</div> : <p className="site-note" style={{ margin: 0 }}>Nothing else in BL — it's a leaf.</p>}
          </div>
          {lib.external?.length ? (
            <div className="site-panel">
              <h3>Brings from npm</h3>
              <ul className="site-files">{lib.external.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
