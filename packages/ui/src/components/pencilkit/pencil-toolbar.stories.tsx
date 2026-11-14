import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PencilTool } from '@/components/ui/pencilkit/constants';
import { ThemeScope } from '@/lib/theme';
import {
  InkPicker,
  PencilActions,
  PencilToolbar,
  PencilToolbarDivider,
  ToolPicker,
  WidthPicker,
} from '@/components/ui/pencilkit/pencil-toolbar';

function Frame({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <ThemeScope appearance={dark ? 'dark' : 'light'} className="relative h-[120px] w-[620px] rounded-xl bg-muted font-sans text-foreground">
      {children}
    </ThemeScope>
  );
}

const meta: Meta = {
  title: 'Molecules/Pencil Toolbar',
  parameters: { layout: 'centered' },
};
export default meta;

type Story = StoryObj;

export const FullToolbar: Story = {
  render: () => {
    const [tool, setTool] = useState<PencilTool>('pen');
    const [ink, setInk] = useState(0);
    const [wi, setWi] = useState(1);
    return (
      <Frame>
        <PencilToolbar>
          <ToolPicker value={tool} onValueChange={(v) => setTool(v)} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onValueChange={(v) => setInk(v)} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onValueChange={(v) => setWi(v)} />
          <PencilToolbarDivider />
          <PencilActions canUndo canRedo />
        </PencilToolbar>
      </Frame>
    );
  },
};

export const FullToolbarDark: Story = {
  render: () => {
    const [tool, setTool] = useState<PencilTool>('marker');
    const [ink, setInk] = useState(1);
    const [wi, setWi] = useState(2);
    return (
      <Frame dark>
        <PencilToolbar>
          <ToolPicker value={tool} onValueChange={(v) => setTool(v)} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onValueChange={(v) => setInk(v)} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onValueChange={(v) => setWi(v)} />
          <PencilToolbarDivider />
          <PencilActions canUndo={false} canRedo={false} />
        </PencilToolbar>
      </Frame>
    );
  },
};

export const ToolPickerOnly: Story = {
  render: () => {
    const [tool, setTool] = useState<PencilTool>('pencil');
    return (
      <Frame>
        <PencilToolbar>
          <ToolPicker value={tool} onValueChange={(v) => setTool(v)} />
        </PencilToolbar>
      </Frame>
    );
  },
};

export const InkAndWidth: Story = {
  render: () => {
    const [ink, setInk] = useState(2);
    const [wi, setWi] = useState(3);
    return (
      <Frame>
        <PencilToolbar>
          <InkPicker value={ink} onValueChange={(v) => setInk(v)} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onValueChange={(v) => setWi(v)} />
        </PencilToolbar>
      </Frame>
    );
  },
};

export const Actions: Story = {
  render: () => (
    <Frame>
      <PencilToolbar>
        <PencilActions canUndo canRedo={false} />
      </PencilToolbar>
    </Frame>
  ),
};
