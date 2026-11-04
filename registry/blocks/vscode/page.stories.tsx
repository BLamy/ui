import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BLProvider } from '@/lib/theme';
import { STARTER_PROJECT } from './almostnode/project';
import { createMemoryRuntime } from './memory-runtime';
import VSCode, { type VSCodeProps } from './page';

const meta: Meta<typeof VSCode> = {
  title: 'Blocks/VSCode',
  component: VSCode,
};
export default meta;
type Story = StoryObj<typeof VSCode>;

/* No Node in any of these: the in-memory runtime, with seeded files and output, nothing from the network and the same on
   every run. The real one is tested in Chromium; see the docs page. */
const TRANSCRIPT = [
  { line: 'ls', output: 'README.md  index.js  package.json  src  test.js' },
  { line: 'npm start', output: '\n> hello@1.0.0 start\n> node index.js\n\nHello, browser!\nRunning on linux in /project' },
];

function Frame({ width, height, dark, ...props }: VSCodeProps & { width: number; height: number; dark?: boolean }) {
  const [runtime] = useState(() => createMemoryRuntime({ files: STARTER_PROJECT, transcript: TRANSCRIPT, status: { text: 'Node: Ready', tone: 'safe' } }));
  return (
    <div style={{ width, height }} className="overflow-hidden rounded-xl border border-border">
      <BLProvider dark={dark}>
        <VSCode runtime={runtime} {...props} />
      </BLProvider>
    </div>
  );
}

export const Wide: Story = { render: () => <Frame width={1280} height={800} /> };
export const WideDark: Story = { render: () => <Frame width={1280} height={800} dark /> };
export const WideSearch: Story = { render: () => <Frame width={1280} height={800} initialView="search" /> };
export const WideRun: Story = { render: () => <Frame width={1280} height={800} initialView="run" /> };
export const PhoneExplorer: Story = { render: () => <Frame width={390} height={720} /> };
export const PhoneEditor: Story = { render: () => <Frame width={390} height={720} initialView="editor" /> };
export const PhoneTerminal: Story = { render: () => <Frame width={390} height={720} initialView="terminal" /> };
export const PhoneTerminalDark: Story = { render: () => <Frame width={390} height={720} initialView="terminal" dark /> };
