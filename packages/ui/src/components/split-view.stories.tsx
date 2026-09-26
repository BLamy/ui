import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SplitView } from './split-view';
import {
  SplitViewMailDemo, SplitViewNotesDemo, SplitViewResizableDemo, SplitViewSettingsDemo,
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
