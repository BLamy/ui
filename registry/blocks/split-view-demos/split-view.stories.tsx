import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackLargeTitle, NavigationStackLeading, NavigationStackPage,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack';
import {
  SplitView, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, SplitViewSidebarTrigger,
  type SplitViewProps,
} from '@/components/ui/split-view';
import { BLProvider } from '@/lib/theme';

import {
  SplitViewGalleryDemo, SplitViewLibraryDemo, SplitViewMailDemo, SplitViewNotesDemo, SplitViewRemindersDemo,
  SplitViewResizableDemo, SplitViewSettingsDemo,
} from './demos';

/** A sized, rounded frame around BLProvider (BL UI containers are absolutely positioned in their host). */
function Phone({ children, w = 390, h = 720, appearance }: { children?: ReactNode; w?: number; h?: number; appearance?: 'light' | 'dark' }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 20, boxShadow: '0 12px 40px color-mix(in srgb, black 18%, transparent)', width: w, height: h }}>
      <BLProvider appearance={appearance}>{children}</BLProvider>
    </div>
  );
}

const meta: Meta<typeof SplitView> = {
  title: 'Organisms/SplitView',
  component: SplitView,
};
export default meta;
type Story = StoryObj<typeof SplitView>;

/** Mail at regular width: mailboxes, list and message tiled. The toggle slides the sidebar away. */
export const Mail: Story = {
  render: () => <Phone w={1180} h={700}><SplitViewMailDemo /></Phone>,
};

export const MailDark: Story = {
  render: () => <Phone w={1180} h={700} appearance="dark"><SplitViewMailDemo /></Phone>,
};

/** Two columns: the note list is the sidebar; hide it for a full-width editor. */
export const Notes: Story = {
  render: () => <Phone w={1080} h={620}><SplitViewNotesDemo /></Phone>,
};

/** Sidebar + grouped detail. */
export const Settings: Story = {
  render: () => <Phone w={1060} h={660} appearance="dark"><SplitViewSettingsDemo /></Phone>,
};

/** Compact: one column at a time. Rows push the next column; back, Esc or an edge swipe pops. */
export const CompactStack: Story = {
  render: () => <Phone w={390} h={760}><SplitViewMailDemo /></Phone>,
};

/** Compact, landed on the message: the same state a regular split collapses into. */
export const CompactPushed: Story = {
  render: () => <Phone w={390} h={760} appearance="dark"><SplitViewMailDemo defaultCompactColumn="detail" /></Phone>,
};

/** Medium: list and message tile; the sidebar floats over them. Tap the scrim or press Esc to dismiss. */
export const OverlaySidebar: Story = {
  render: function OverlayStory() {
    const [open, setOpen] = useState(true);
    return <Phone w={820} h={640}><SplitViewMailDemo sidebarOpen={open} onSidebarOpenChange={setOpen} /></Phone>;
  },
};

/** Medium, `displace`: the sidebar pushes the columns aside instead of covering them. */
export const DisplaceSidebar: Story = {
  render: function DisplaceStory() {
    const [open, setOpen] = useState(true);
    return <Phone w={820} h={640}><SplitViewSettingsDemo sidebarBehavior="displace" sidebarOpen={open} onSidebarOpenChange={setOpen} /></Phone>;
  },
};

/** Drag the handle (or focus it and use the arrow keys): the split morphs between regular, medium and
 *  compact without losing the selection or the scroll position. */
export const ResizableFrame: Story = {
  render: () => (
    <div style={{ width: 1240, height: 700 }}>
      <BLProvider className="bg-background p-4">
        <SplitViewResizableDemo initial={1100} height={620}>
          <SplitViewMailDemo />
        </SplitViewResizableDemo>
      </BLProvider>
    </div>
  ),
};

/** Medium width with `defaultSidebarOpen={{ medium: true }}` and a tiled sidebar: the sidebar starts open
 *  at medium too. Resize across the breakpoints: each class resets to where it starts, and the parent (which
 *  mirrors the sidebar's state) hears every reset through `onSidebarOpenChange` (reason `content-resize`). */
export const MediumSidebarVisible: Story = {
  render: function MediumStory() {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ width: 1240, height: 700 }}>
        <BLProvider className="bg-background p-4">
          <div className="mb-2 text-[12.5px] text-muted-foreground">parent state: sidebar {open ? 'visible' : 'hidden'}</div>
          <SplitViewResizableDemo initial={820} height={600}>
            <SplitViewSettingsDemo sidebarBehavior="tile" defaultSidebarOpen={{ medium: true }} onSidebarOpenChange={setOpen} />
          </SplitViewResizableDemo>
        </BLProvider>
      </div>
    );
  },
};

/** Per-item `tint`: every list selects in its own colour (the icon disc reads `--split-item-tint`). Groceries
 *  is in Pinned and My Lists — selection is by value, so both copies highlight. Both columns use large titles. */
export const TintedItems: Story = {
  render: () => <Phone w={1080} h={640}><SplitViewRemindersDemo /></Phone>,
};

export const TintedItemsDark: Story = {
  render: () => <Phone w={1080} h={640} appearance="dark"><SplitViewRemindersDemo defaultValue={{ sidebar: 'work' }} /></Phone>,
};

/** Large title after scrolling: the big title has gone under the bar, so the inline title and the hairline
 *  have sprung in. Scroll back up and it unfolds again. */
export const LargeTitleScrolled: Story = {
  render: () => <Phone w={1080} h={640}><SplitViewRemindersDemo scrolled /></Phone>,
};

/** Large titles in the compact stack: the lists screen is the root, the list pushes with its own large title. */
export const LargeTitleCompact: Story = {
  render: () => <Phone w={390} h={760}><SplitViewRemindersDemo defaultCompactColumn="detail" /></Phone>,
};

/** A column that pushes holds a NavigationStack: album → credits in the detail column. The sidebar selection is
 *  the stack's `resetKey`, so picking a section drops back to its first page; `renderPage` draws the album and
 *  credits pages from their keys. */
export const NestedStack: Story = {
  render: () => <Phone w={1080} h={640}><SplitViewLibraryDemo defaultAlbum="static" /></Phone>,
};

export const NestedStackDark: Story = {
  render: () => <Phone w={1080} h={640} appearance="dark"><SplitViewLibraryDemo defaultAlbum="static" /></Phone>,
};

/** At tablet width the sidebar floats over the stack (the toggle on the stack's first page opens it). */
export const NestedStackMedium: Story = {
  render: () => <Phone w={834} h={760}><SplitViewLibraryDemo /></Phone>,
};

/** Compact with a nested stack: the album page is on top. Its back button carries the page below's title,
 *  "Recently Added Albums", or "Back" when that doesn't fit beside the centered title. The edge swipe (and Esc)
 *  pops the album page first; only at the stack's first page does it pop the column, whose back button that
 *  page shows. */
export const NestedStackCompact: Story = {
  render: () => <Phone w={390} h={760} appearance="dark"><SplitViewLibraryDemo defaultCompactColumn="detail" defaultAlbum="tidewater" /></Phone>,
};

/** Compact, at the stack's first page: the back button goes to the sidebar column, named by its title. */
export const NestedStackCompactRoot: Story = {
  render: () => <Phone w={390} h={760}><SplitViewLibraryDemo defaultCompactColumn="detail" /></Phone>,
};

/** Gallery: `defaultSupplementaryOpen={false}`: the list column has slid away and the detail fills its space.
 *  The list button springs it back. */
export const Gallery: Story = {
  render: () => <Phone w={1180} h={660}><SplitViewGalleryDemo defaultSupplementaryOpen={false} /></Phone>,
};

export const GalleryDark: Story = {
  render: () => <Phone w={1180} h={660} appearance="dark"><SplitViewGalleryDemo /></Phone>,
};

/** A NavigationStack nested in the compact detail column: the edge swipe (and Esc) pop the NavigationStack's
 *  page only (the column stays), and once it's at its root the next swipe pops the column. */
export const NestedNavigationStack: Story = {
  render: function NestedNavStory() {
    const [pages, setPages] = useState(['root', 'album']);
    return (
      <Phone w={390} h={640}>
        <SplitView aria-label="Music" defaultCompactColumn="detail" defaultValue={{ sidebar: 'recent' }}>
          <SplitViewSidebar aria-label="Library">
            <SplitViewHeader title="Library" />
            <SplitViewContent className="px-2.5 pt-2">
              <SplitViewItem value="recent" title="Recently Added" />
            </SplitViewContent>
          </SplitViewSidebar>
          <SplitViewDetail aria-label="Albums">
            <NavigationStack pages={pages} onPagesChange={setPages}>
              <NavigationStackPage value="root">
                <NavigationStackBar><NavigationStackTitle>Recently Added</NavigationStackTitle></NavigationStackBar>
                <NavigationStackContent>
                  <div className="px-4 py-3 text-[16px]">
                    <button type="button" className="bl-btn cursor-pointer border-0 bg-transparent p-0 text-[16px] text-primary" onClick={() => setPages(['root', 'album'])}>Open album</button>
                  </div>
                </NavigationStackContent>
              </NavigationStackPage>
              <NavigationStackPage value="album">
                <NavigationStackBar><NavigationStackTitle>Neon Tidewater</NavigationStackTitle></NavigationStackBar>
                <NavigationStackContent>
                  <div className="px-4 py-3 text-[16px]">Swipe from the leading edge: this page pops, the column stays.</div>
                </NavigationStackContent>
              </NavigationStackPage>
            </NavigationStack>
          </SplitViewDetail>
        </SplitView>
      </Phone>
    );
  },
};

/** Collapsed with a NavigationStack at its root: the root page gets a back button to the sidebar, labelled
 *  with its title (`rootBack` defaults to the previous column inside a collapsed SplitView). */
export const NavigationStackRootBack: Story = {
  render: () => (
    <Phone w={390} h={640}>
      <SplitView aria-label="Music" defaultCompactColumn="detail" defaultValue={{ sidebar: 'recent' }}>
        <SplitViewSidebar aria-label="Library">
          <SplitViewHeader title="Library" />
          <SplitViewContent className="px-2.5 pt-2">
            <SplitViewItem value="recent" title="Recently Added" />
          </SplitViewContent>
        </SplitViewSidebar>
        <SplitViewDetail aria-label="Albums">
          <NavigationStack defaultPages={['root']}>
            <NavigationStackPage value="root">
              <NavigationStackBar><NavigationStackTitle>Recently Added</NavigationStackTitle></NavigationStackBar>
              <NavigationStackContent>
                <NavigationStackLargeTitle />
                <div className="px-4 py-3 text-[16px] text-muted-foreground">The back button returns to the Library column.</div>
              </NavigationStackContent>
            </NavigationStackPage>
          </NavigationStack>
        </SplitViewDetail>
      </SplitView>
    </Phone>
  ),
};

/** Header and section options: the sidebar's bar shows its title only once the list scrolls (`showOnScroll`);
 *  "My Lists" is a `prominent` section label; the detail's large title carries a trailing count
 *  (`largeTitleTrailing`) and lines up with the centred content (`largeTitleClassName`). */
export const HeaderOptions: Story = {
  render: () => (
    <Phone w={1100} h={600}>
      <SplitView aria-label="Reminders" defaultValue={{ sidebar: 'today' }} sidebarBehavior="tile">
        <SplitViewSidebar aria-label="Lists" className="bg-muted">
          <SplitViewHeader title="Lists" showOnScroll className="bg-muted" />
          <SplitViewContent className="px-2.5">
            <SplitViewSection title="My Lists" variant="prominent">
              {['Today', 'Groceries', 'Work'].map((t) => <SplitViewItem key={t} value={t.toLowerCase()} title={t} />)}
            </SplitViewSection>
          </SplitViewContent>
        </SplitViewSidebar>
        <SplitViewDetail aria-label="Today">
          <SplitViewHeader title={<span className="text-primary">Today</span>} largeTitle
            largeTitleTrailing={<span className="font-semibold text-primary tabular-nums">4</span>}
            largeTitleClassName="mx-auto max-w-[560px] px-5" />
          <SplitViewContent>
            <div className="mx-auto max-w-[560px] px-5 text-[17px]">
              {['Book the cabin ferry', 'Call Mom back', 'Review SplitView PR', 'Water the ferns'].map((t) => (
                <div key={t} className="py-[11px] shadow-[inset_0_-1px_0_var(--border)]">{t}</div>
              ))}
            </div>
          </SplitViewContent>
        </SplitViewDetail>
      </SplitView>
    </Phone>
  ),
};

/** Nothing selected: the detail column shows the kit's `EmptyState`. */
export const EmptyDetail: Story = {
  render: () => <Phone w={1180} h={700}><SplitViewMailDemo defaultValue={{ sidebar: 'inbox' }} /></Phone>,
};

/** Item states, light and dark: current (pill and row), a tinted item, a description, a trailing count, disabled. */
export const ItemStates: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24 }}>
      {[false, true].map((dark) => (
        <Phone key={String(dark)} w={560} h={360} appearance={dark ? 'dark' : 'light'}>
          <SplitView aria-label="Items" sizeClass="regular" defaultValue={{ sidebar: 'inbox', detail: 'two' }}>
            <SplitViewSidebar aria-label="Mailboxes" width={260} resizable={false}>
              <SplitViewHeader title="Mailboxes" />
              <SplitViewContent className="px-2.5">
                <SplitViewSection title="iCloud">
                  <SplitViewItem value="inbox" title="Inbox" trailing={4} />
                  <SplitViewItem value="flagged" title="Flagged" tint="#FF9500" description="2 unread" />
                  <SplitViewItem value="archive" title="Archive (offline)" disabled />
                </SplitViewSection>
              </SplitViewContent>
            </SplitViewSidebar>
            <SplitViewDetail aria-label="Rows">
              <SplitViewHeader title="Rows" />
              <SplitViewContent>
                <SplitViewItem value="one" title="A row" description="variant row" />
                <SplitViewItem value="two" title="The current row" description="a 14% wash of the tint" />
              </SplitViewContent>
            </SplitViewDetail>
          </SplitView>
        </Phone>
      ))}
    </div>
  ),
};

/* ── The sidebar as a tab bar (compactPresentation="tabs") ── */

const PODCAST_TITLES: Record<string, string> = { home: 'Home', new: 'New', search: 'Search', library: 'Library', shows: 'Shows', saved: 'Saved', downloads: 'Downloaded' };

function PodcastsDemo({ initial = 'shows', defaultSidebarOpen }: { initial?: string; defaultSidebarOpen?: SplitViewProps['defaultSidebarOpen'] }) {
  const [section, setSection] = useState(initial);
  return (
    <SplitView aria-label="Podcasts" value={{ sidebar: section }} onValueChange={(v) => { if (v.sidebar) setSection(v.sidebar); }} defaultSidebarOpen={defaultSidebarOpen}>
      <SplitViewSidebar compactPresentation="tabs" aria-label="Podcasts">
        <SplitViewHeader title="Podcasts" />
        <SplitViewContent className="px-2.5">
          <SplitViewSection>
            <SplitViewItem value="home" title="Home" icon="house" tab />
            <SplitViewItem value="new" title="New" icon="star" tab />
            <SplitViewItem value="search" title="Search" icon="magnifyingglass" tab />
          </SplitViewSection>
          <SplitViewSection title="Library" tab value="library" icon="books-vertical">
            <SplitViewItem value="shows" title="Shows" icon="layers" />
            <SplitViewItem value="saved" title="Saved" icon="bookmark" />
            <SplitViewItem value="downloads" title="Downloaded" icon="arrow-down-circle" />
          </SplitViewSection>
        </SplitViewContent>
      </SplitViewSidebar>
      <SplitViewDetail>
        <NavigationStack defaultPages={['root']} resetKey={section}>
          <NavigationStackPage value="root">
            <NavigationStackBar>
              <NavigationStackLeading><SplitViewSidebarTrigger /></NavigationStackLeading>
              <NavigationStackTitle>{PODCAST_TITLES[section]}</NavigationStackTitle>
            </NavigationStackBar>
            <NavigationStackContent>
              <NavigationStackLargeTitle />
              <div className="flex flex-col gap-2 px-4">
                {Array.from({ length: 14 }, (_, i) => (
                  <div key={i} className="rounded-panel bg-secondary px-3 py-2.5 text-subhead">Episode {i + 1}</div>
                ))}
              </div>
            </NavigationStackContent>
          </NavigationStackPage>
        </NavigationStack>
      </SplitViewDetail>
    </SplitView>
  );
}

/** Compact: the sidebar is the iOS tab bar over the detail. Library is one tab for its section: Shows is selected,
    so its page is on top of the Library tab's first page (the sidebar showing Shows, Saved and Downloaded), with
    "‹ Library" to go back to it. Pressing Library again goes back there too. The content keeps room for the bar. */
export const SidebarTabBar: Story = {
  render: () => <Phone w={390} h={760}><PodcastsDemo /></Phone>,
};

export const SidebarTabBarDark: Story = {
  render: () => <Phone w={390} h={760} appearance="dark"><PodcastsDemo /></Phone>,
};

/** The Library tab's first page: the sidebar showing the section's rows under a large "Library". */
export const SidebarTabBarLibrary: Story = {
  render: () => <Phone w={390} h={760}><PodcastsDemo initial="library" /></Phone>,
};

/** The same tree on a tablet: no tab bar; the sidebar floats over the detail, open here (`defaultSidebarOpen`
    `{ medium: true }`), and the button in the bar shows and hides it. */
export const SidebarTabBarTablet: Story = {
  render: () => <Phone w={834} h={700}><PodcastsDemo defaultSidebarOpen={{ medium: true }} /></Phone>,
};
