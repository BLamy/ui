import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  SplitView, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewItem, SplitViewSidebar,
} from './split-view';
import { NavigationStack, type Screen } from './navigation-stack';
import {
  SplitViewGalleryDemo, SplitViewLibraryDemo, SplitViewMailDemo, SplitViewNotesDemo, SplitViewRemindersDemo,
  SplitViewResizableDemo, SplitViewSettingsDemo,
} from '../demos/split-view-demos';
import { BLProvider } from '../lib/theme';
import { Phone } from '../stories/frame';

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
  render: () => <Phone w={1180} h={700} dark><SplitViewMailDemo /></Phone>,
};

/** Two columns: the note list is the sidebar; hide it for a full-width editor. */
export const Notes: Story = {
  render: () => <Phone w={1080} h={620}><SplitViewNotesDemo /></Phone>,
};

/** Sidebar + grouped detail. */
export const Settings: Story = {
  render: () => <Phone w={1060} h={660} dark><SplitViewSettingsDemo /></Phone>,
};

/** Compact: one column at a time. Rows push the next column; back, Esc or an edge swipe pops. */
export const CompactStack: Story = {
  render: () => <Phone w={390} h={760}><SplitViewMailDemo /></Phone>,
};

/** Compact, landed on the message: the same state a regular split collapses into. */
export const CompactPushed: Story = {
  render: () => <Phone w={390} h={760} dark><SplitViewMailDemo defaultCompactColumn="detail" /></Phone>,
};

/** Medium: list and message tile; the sidebar floats over them. Tap the scrim or press Esc to dismiss. */
export const OverlaySidebar: Story = {
  render: function OverlayStory() {
    const [open, setOpen] = useState(true);
    return <Phone w={820} h={640}><SplitViewMailDemo sidebarVisible={open} onSidebarVisibleChange={setOpen} /></Phone>;
  },
};

/** Medium, `displace`: the sidebar pushes the columns aside instead of covering them. */
export const DisplaceSidebar: Story = {
  render: function DisplaceStory() {
    const [open, setOpen] = useState(true);
    return <Phone w={820} h={640}><SplitViewSettingsDemo sidebarBehavior="displace" sidebarVisible={open} onSidebarVisibleChange={setOpen} /></Phone>;
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

/** Medium width with `sidebarVisibility={{ medium: true }}` and a tiled sidebar: the sidebar starts shown
 *  at medium too. Resize across the breakpoints — each class resets to its own visibility, and the parent
 *  (which controls `sidebarVisible`) hears every reset through `onSidebarVisibleChange`. */
export const MediumSidebarVisible: Story = {
  render: function MediumStory() {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ width: 1240, height: 700 }}>
        <BLProvider className="bg-background p-4">
          <div className="mb-2 text-[12.5px] text-muted-foreground">parent state: sidebar {open ? 'visible' : 'hidden'}</div>
          <SplitViewResizableDemo initial={820} height={600}>
            <SplitViewSettingsDemo sidebarBehavior="tile" sidebarVisibility={{ medium: true }} sidebarVisible={open} onSidebarVisibleChange={setOpen} />
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
  render: () => <Phone w={1080} h={640} dark><SplitViewRemindersDemo defaultSelection={{ sidebar: 'work' }} /></Phone>,
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

/** A push/pop stack inside the detail column (`SplitViewStack` + `useSplitViewStack`): album → credits.
 *  The sidebar selection is the stack's `resetKey`, so picking a section drops back to its root. */
export const NestedStack: Story = {
  render: () => <Phone w={1080} h={640}><SplitViewLibraryDemo initialAlbum="static" /></Phone>,
};

/** Compact with a nested stack: the album page is on top. Its back button carries the page below's title,
 *  "Recently Added Albums", truncated to the room the centered title leaves. The edge swipe (and Esc) pops
 *  the album page first; only at the stack's root does it pop the column. */
export const NestedStackCompact: Story = {
  render: () => <Phone w={390} h={760} dark><SplitViewLibraryDemo defaultCompactColumn="detail" initialAlbum="tidewater" /></Phone>,
};

/** Gallery: `supplementaryVisible={false}` — the list column has slid away and the detail fills its space.
 *  The list button springs it back. */
export const Gallery: Story = {
  render: () => <Phone w={1180} h={660}><SplitViewGalleryDemo defaultSupplementaryVisible={false} /></Phone>,
};

export const GalleryDark: Story = {
  render: () => <Phone w={1180} h={660} dark><SplitViewGalleryDemo /></Phone>,
};

/** A NavigationStack nested in the compact detail column: the edge swipe (and Esc) pop the NavigationStack's
 *  screen only — the column stays — and once it's at its root the next swipe pops the column. */
export const NestedNavigationStack: Story = {
  render: function NestedNavStory() {
    const [screens, setScreens] = useState(['root', 'album']);
    const mk = (k: string): Screen => ({
      key: k,
      title: k === 'root' ? 'Recently Added' : 'Neon Tidewater',
      content: (
        <div className="px-4 py-3 text-[16px]">
          {k === 'root'
            ? <button type="button" className="bl-btn cursor-pointer border-0 bg-transparent p-0 text-[16px] text-primary" onClick={() => setScreens(['root', 'album'])}>Open album</button>
            : 'Swipe from the leading edge: this screen pops, the column stays.'}
        </div>
      ),
    });
    return (
      <Phone w={390} h={640}>
        <SplitView aria-label="Music" defaultCompactColumn="detail" defaultSelection={{ sidebar: 'recent' }}>
          <SplitViewSidebar aria-label="Library">
            <SplitViewHeader title="Library" />
            <SplitViewContent className="px-2.5 pt-2">
              <SplitViewItem id="recent" title="Recently Added" />
            </SplitViewContent>
          </SplitViewSidebar>
          <SplitViewDetail aria-label="Albums">
            <div className="relative min-h-0 flex-1">
              <NavigationStack screens={screens.map(mk)} onPop={() => setScreens((s) => s.slice(0, -1))} />
            </div>
          </SplitViewDetail>
        </SplitView>
      </Phone>
    );
  },
};
