import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { pencilInks, type PencilTool } from '@/components/ui/pencilkit/constants';
import { ToolbarSeparator } from '@/components/ui/toolbar';
import { ThemeScope } from '@/lib/theme';
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

/** At a phone's width the groups scroll sideways under an edge fade; undo, redo and clear stay pinned. */
export const Narrow: Story = { render: () => <Frame width={360}><Full /></Frame> };

/** Narrow, in dark. */
export const NarrowDark: Story = { render: () => <Frame dark width={360}><Full /></Frame> };

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
