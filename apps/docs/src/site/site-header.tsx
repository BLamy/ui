/* The header on every page of the site: the brand, the Libraries menu (every library by category, live and planned),
   the Blocks and Roadmap links, GitHub and the theme switch. */
import { useState } from 'react';
import { Button as AriaButton, Dialog } from 'react-aria-components';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { CATEGORIES, byCategory, libraryRoute } from './libraries';
import type { Appearance } from '@/lib/theme';

export const REPO_URL = 'https://github.com/BLamy/ui';

/** The BL mark: the docs' equalizer bars on the blue–indigo tile. */
export function BLMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" style={{ flexShrink: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id="bl-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A84FF" /><stop offset="1" stopColor="#5E5CE6" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="8.5" fill="url(#bl-mark)" />
      <path d="M8 15.5v3M12.25 11.5v11M17 7.5v19M21.75 11.5v11M26 15.5v3" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

function LibrariesMenu({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const onLibraries = current === 'libraries' || current.startsWith('libraries/');
  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <AriaButton className="site-nav-item" aria-current={onLibraries && !open ? 'page' : undefined}>
        Libraries
        <Icon name="chevron-down" size={13} className="site-caret" />
      </AriaButton>
      <Popover placement="bottom" offset={6} className="site-mega">
        <Dialog aria-label="Libraries" className="site-mega-dialog">
          <div className="site-mega-grid">
            {CATEGORIES.map((c) => (
              <section key={c.id} className="site-mega-col" data-tone={c.tone}>
                <h3>{c.label}</h3>
                <ul>
                  {byCategory(c.id).map((lib) => (
                    <li key={lib.id}>
                      <a className="site-mega-link" data-status={lib.status} href={`#/${libraryRoute(lib)}`} onClick={() => setOpen(false)}
                        title={lib.status === 'planned' ? `${lib.name} — planned: in @brett_lamy/ui today` : lib.tagline}>
                        <Icon name={lib.icon} size={20} />
                        <span>{lib.name}</span>
                        {lib.status === 'planned' ? <span className="site-status" data-status="planned">Planned</span> : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="site-mega-foot">
            <a className="site-mega-all" href="#/libraries" onClick={() => setOpen(false)}>
              <Icon name="grid" size={16} />
              Browse all libraries
              <Icon name="arrow-right" size={14} />
            </a>
            {/* The header hides these on a phone; they live here instead. */}
            <a className="site-mega-all site-mega-narrow" href="#/blocks" onClick={() => setOpen(false)}>Blocks</a>
            <a className="site-mega-all site-mega-narrow" href="#/roadmap" onClick={() => setOpen(false)}>Roadmap</a>
          </div>
        </Dialog>
      </Popover>
    </PopoverTrigger>
  );
}

export function SiteHeader({ current, appearance, onToggleTheme }: { current: string; appearance: Appearance; onToggleTheme: () => void }) {
  const dark = appearance === 'dark';
  return (
    <header className="site-header">
      <a className="site-brand" href="#/" aria-label="BL — home">
        <BLMark />
        <span>BL</span>
      </a>
      <nav className="site-nav" aria-label="Site">
        <LibrariesMenu current={current} />
        <a className="site-nav-item site-nav-secondary" href="#/blocks" aria-current={current === 'blocks' || current.startsWith('blocks/') ? 'page' : undefined}>Blocks</a>
        <a className="site-nav-item site-nav-secondary" href="#/roadmap" aria-current={current === 'roadmap' || current.startsWith('roadmap/') ? 'page' : undefined}>Roadmap</a>
      </nav>
      <div className="site-header-end">
        <a className="site-icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository">
          <GitHubMark />
        </a>
        <button type="button" className="site-icon-btn" onClick={onToggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
          <Icon name={dark ? 'sun' : 'moon'} size={18} />
        </button>
      </div>
    </header>
  );
}
