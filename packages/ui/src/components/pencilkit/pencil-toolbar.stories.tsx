import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { pencilInks, type PencilTool } from '@/components/ui/pencilkit/constants';
import { ToolbarSeparator } from '@/components/ui/toolbar';
import { ThemeScope } from '@/lib/theme';
import { Phone as PhoneFrame } from '../../stories/frame';
import { EmptyState } from '@/components/ui/empty-state';
import { PencilCanvas } from '@/components/ui/pencilkit/pencil-canvas';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';
import {
  PencilActions,
  PencilInkPicker,
  PencilToolbar,
  PencilToolbarPinned,
  PencilToolPicker,
  PencilWidthPicker,
} from '@/components/ui/pencilkit/pencil-toolbar';

/** A strip of paper the toolbar floats over, `width` px wide. */
function Frame({ dark, width = 640, children }: { dark?: boolean; width?: number; children: React.ReactNode }) {
  return (
    <ThemeScope
      appearance={dark ? 'dark' : 'light'}
      className="relative grid h-[120px] w-(--w) place-items-center rounded-xl bg-muted px-2.5 font-sans text-foreground"
      // the frame's width is the story's
      style={{ '--w': `${width}px` } as React.CSSProperties}
    >
      {children}
    </ThemeScope>
  );
}

/** The whole palette: tools, inks, widths, and the history pinned at the end. */
function Full({ tool: t0 = 'pen', ink: i0 = pencilInks[0].value, width: w0 = 1, canUndo = true, canRedo = true }: {
  tool?: PencilTool; ink?: string; width?: number; canUndo?: boolean; canRedo?: boolean;
}) {
  const [tool, setTool] = useState<PencilTool>(t0);
  const [ink, setInk] = useState(i0);
  const [width, setWidth] = useState(w0);
  return (
    <PencilToolbar>
      <PencilToolPicker value={tool} onValueChange={setTool} />
      <ToolbarSeparator />
      <PencilInkPicker value={ink} onValueChange={setInk} />
      <ToolbarSeparator />
      <PencilWidthPicker value={width} onValueChange={setWidth} />
      <PencilToolbarPinned>
        <ToolbarSeparator />
        <PencilActions canUndo={canUndo} canRedo={canRedo} />
      </PencilToolbarPinned>
    </PencilToolbar>
  );
}

const meta: Meta = {
  title: 'Molecules/Pencil Toolbar',
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj;

/** Everything fits in a 640px frame. */
export const FullToolbar: Story = { render: () => <Frame><Full /></Frame> };

/** Dark: the black swatch reads as white (inks follow the theme) and every swatch keeps a visible ring. */
export const FullToolbarDark: Story = {
  render: () => <Frame dark><Full tool="marker" ink={pencilInks[1].value} width={1.7} canUndo={false} canRedo={false} /></Frame>,
};

/** At a phone's width the toolbar runs out of room, so the ink and width pickers fold into one button showing the
 *  current ink; it opens both rows in a popover. Every tool and undo, redo and clear stay in view. */
export const Narrow: Story = { render: () => <Frame width={360}><Full /></Frame> };

/** Narrow, in dark. */
export const NarrowDark: Story = { render: () => <Frame dark width={360}><Full /></Frame> };

/** Narrow, with the folded ink and width popover open. */
export const NarrowOpen: Story = {
  render: () => <div className="pt-32"><Frame width={360}><Full /></Frame></div>,
  play: async ({ canvasElement }) => {
    (canvasElement.querySelector('[aria-label^="Ink"]') as HTMLButtonElement | null)?.click();
  },
};

/** A drawing on a phone: the canvas fills the screen and the toolbar floats at the bottom, folded to fit. */
export const Phone: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => {
    const history = usePencilHistory();
    const [tool, setTool] = useState<PencilTool>('pen');
    const [ink, setInk] = useState(pencilInks[2].value);
    const [width, setWidth] = useState(1);
    return (
      <PhoneFrame h={844}>
        <div className="absolute inset-0 bg-background">
          <PencilCanvas tool={tool} ink={ink} width={width} strokes={history.strokes} onStrokesChange={history.onStrokesChange}
            emptyState={<EmptyState title="Draw anywhere" description="Pick an ink and a width from the round button." />} />
          <PencilToolbar className="absolute inset-x-2.5 bottom-6 mx-auto">
            <PencilToolPicker value={tool} onValueChange={setTool} />
            <ToolbarSeparator />
            <PencilInkPicker value={ink} onValueChange={setInk} />
            <ToolbarSeparator />
            <PencilWidthPicker value={width} onValueChange={setWidth} />
            <PencilToolbarPinned>
              <ToolbarSeparator />
              <PencilActions onUndo={history.undo} onRedo={history.redo} onClear={history.clear}
                canUndo={history.canUndo} canRedo={history.canRedo} canClear={history.canClear} />
            </PencilToolbarPinned>
          </PencilToolbar>
        </div>
      </PhoneFrame>
    );
  },
};

/** `presentation="popover"` on a wide toolbar: each picker is one button whatever the room (here the width alone). */
export const Folded: Story = {
  render: () => (
    <Frame>
      <PencilToolbar>
        <PencilToolPicker />
        <ToolbarSeparator />
        <PencilInkPicker />
        <ToolbarSeparator />
        <PencilWidthPicker presentation="popover" />
      </PencilToolbar>
    </Frame>
  ),
};

/** `variant="plain"`: no card, for a bar that sits in another surface (the image annotator's footer). */
export const Plain: Story = {
  render: () => (
    <Frame>
      <PencilToolbar variant="plain">
        <PencilToolPicker />
        <ToolbarSeparator />
        <PencilInkPicker />
      </PencilToolbar>
    </Frame>
  ),
};

/** The pickers uncontrolled (`defaultValue`): each keeps its own choice. */
export const Pickers: Story = {
  render: () => (
    <Frame>
      <PencilToolbar>
        <PencilToolPicker defaultValue="pencil" />
        <ToolbarSeparator />
        <PencilInkPicker defaultValue={pencilInks[2].value} />
        <ToolbarSeparator />
        <PencilWidthPicker defaultValue={2.6} />
      </PencilToolbar>
    </Frame>
  ),
};

/** The history group alone, with Redo unavailable (still focusable, `aria-disabled`). */
export const Actions: Story = {
  render: () => (
    <Frame>
      <PencilToolbar>
        <PencilActions canUndo canRedo={false} />
      </PencilToolbar>
    </Frame>
  ),
};
