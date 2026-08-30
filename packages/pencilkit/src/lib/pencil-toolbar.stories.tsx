import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PFONT, PK_DARK, PK_LIGHT, type PencilTool } from './constants';
import {
  InkPicker,
  PencilActions,
  PencilToolbar,
  PencilToolbarDivider,
  ToolPicker,
  WidthPicker,
} from './pencil-toolbar';

function Frame({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        ...((dark ? PK_DARK : PK_LIGHT) as React.CSSProperties),
        position: 'relative',
        width: 620,
        height: 120,
        borderRadius: 12,
        background: 'var(--tk-bg2)',
        color: 'var(--tk-label)',
        fontFamily: PFONT,
        colorScheme: dark ? 'dark' : 'light',
      }}
    >
      {children}
    </div>
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
          <ToolPicker value={tool} onChange={setTool} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onChange={setInk} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onChange={setWi} />
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
          <ToolPicker value={tool} onChange={setTool} />
          <PencilToolbarDivider />
          <InkPicker value={ink} onChange={setInk} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onChange={setWi} />
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
          <ToolPicker value={tool} onChange={setTool} />
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
          <InkPicker value={ink} onChange={setInk} />
          <PencilToolbarDivider />
          <WidthPicker value={wi} onChange={setWi} />
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
