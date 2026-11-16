/* What every DocsSite mounted inside the BL site shares: it follows the site's appearance (the header has the only
   switch), keeps its theme to its own root, and fills the room under the header. */
import type { DocsSiteProps } from '@brett_lamy/ui/docstream/site';
import type { Appearance } from '@/lib/theme';

export interface EmbeddedDocsProps {
  appearance: Appearance;
}

/** The height of everything under the site's header (`h-14`). */
export const UNDER_HEADER = 'calc(100dvh - 3.5rem)';

export const embeddedSiteProps = ({ appearance }: EmbeddedDocsProps): Partial<DocsSiteProps> => ({
  theme: appearance,
  themeToggle: false,
  themeStorageKey: false,
  applyThemeTo: 'site',
  height: UNDER_HEADER,
  accentColor: 'var(--dk-accent)',
});
