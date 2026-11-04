import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Terminal, type TerminalProps } from '@/components/ui/terminal';
import { createTerminalShell } from '@/lib/terminal-line';
import { Phone } from '../stories/frame';
import { BLProvider } from '@/lib/theme';

const meta: Meta<typeof Terminal> = {
  title: 'Organisms/Terminal',
  component: Terminal,
};
export default meta;
type Story = StoryObj<typeof Terminal>;

/* All of it a pure function of its arguments: visual regression compares these at zero tolerance. */

const BUILD_LOG = [
  '\x1b[1mnpm run build\x1b[0m',
  '',
  '\x1b[32m✓\x1b[0m 412 modules transformed.',
  '\x1b[2mdist/\x1b[0mindex.html                 \x1b[2m0.46 kB\x1b[0m',
  '\x1b[2mdist/assets/\x1b[0m\x1b[35mindex-4f1a.css\x1b[0m       \x1b[2m18.20 kB\x1b[0m',
  '\x1b[2mdist/assets/\x1b[0m\x1b[36mindex-9c2e.js\x1b[0m       \x1b[2m142.87 kB\x1b[0m',
  '\x1b[33mwarning\x1b[0m: 1 chunk is larger than 100 kB',
  '\x1b[31merror\x1b[0m: failed to resolve "./missing"',
  '\x1b[34minfo\x1b[0m: see \x1b[4mhttps://example.com/build\x1b[0m',
  '',
].join('\r\n');

const PALETTE_ROWS = [
  ...[0, 1].map((bright) =>
    Array.from({ length: 8 }, (_, i) => `\x1b[${(bright ? 90 : 30) + i}m${String(i + bright * 8).padStart(3)} \x1b[0m`).join('')),
  ...[0, 1].map((bright) =>
    Array.from({ length: 8 }, (_, i) => `\x1b[${(bright ? 100 : 40) + i}m${String(i + bright * 8).padStart(3)} \x1b[0m`).join('')),
  '\x1b[1mbold\x1b[0m \x1b[2mdim\x1b[0m \x1b[3mitalic\x1b[0m \x1b[4munderline\x1b[0m \x1b[7minverse\x1b[0m \x1b[9mstrike\x1b[0m',
].join('\r\n');

function Panel({ dark, height = 320, children }: { dark?: boolean; height?: number; children: React.ReactNode }) {
  return (
    <div style={{ width: 720, height }} className="overflow-hidden rounded-xl border border-border">
      <BLProvider dark={dark}>{children}</BLProvider>
    </div>
  );
}

const writes = (text: string): Pick<TerminalProps, 'onReady' | 'readOnly'> => ({ readOnly: true, onReady: (t) => t.write(text) });

export const Output: Story = {
  render: () => <Panel><Terminal {...writes(BUILD_LOG)} /></Panel>,
};

export const OutputDark: Story = {
  render: () => <Panel dark><Terminal {...writes(BUILD_LOG)} /></Panel>,
};

export const Palette: Story = {
  render: () => <Panel height={200}><Terminal {...writes(PALETTE_ROWS)} /></Panel>,
};

export const PaletteDark: Story = {
  render: () => <Panel dark height={200}><Terminal {...writes(PALETTE_ROWS)} /></Panel>,
};

export const Small: Story = {
  render: () => <Panel height={200}><Terminal size="sm" {...writes(BUILD_LOG)} /></Panel>,
};

/* A shell of plain functions, so what shows is the same on every run. */
const echo: TerminalProps['onCommand'] = (line, io) => {
  if (line === 'clear') return io.clear();
  io.write(`you ran: ${line}\n`);
};

/** A prompt with a command already run. Type here: it has line editing, history and Ctrl-C. */
function LineMode({ dark, width }: { dark?: boolean; width?: number }) {
  const [shell] = useState(() => {
    const made = createTerminalShell({
      prompt: '\x1b[32m~/project\x1b[0m \x1b[2m$\x1b[0m ',
      greeting: 'Type a command. ↑ and ↓ walk the history, Ctrl-C cancels, Tab completes.',
      complete: ({ word }) => ['build', 'bundle', 'test', 'clear'].filter((c) => c.startsWith(word)),
      onCommand: (line, io) => echo!(line, io),
    });
    made.run('npm run build');
    return made;
  });
  const content = <Terminal shell={shell} />;
  return width ? <Phone w={width} h={420} dark={dark}>{content}</Phone> : <Panel dark={dark}>{content}</Panel>;
}

export const Prompt: Story = { render: () => <LineMode /> };

export const PromptDark: Story = { render: () => <LineMode dark /> };

/* Narrow, the way a window dragged to a phone's width is: long lines wrap. */
export const PhoneFrame: Story = {
  name: 'Phone',
  render: () => (
    <Phone w={390} h={520}>
      <Terminal {...writes(`${BUILD_LOG}a long line that does not fit in a window this narrow, so it wraps onto the next row of the grid\r\n`)} />
    </Phone>
  ),
};

export const PhonePrompt: Story = { render: () => <LineMode width={390} /> };

/** A resizable box, to see the grid refit. */
export const Resizable: Story = {
  render: function Render() {
    const [size, setSize] = useState('');
    return (
      <div className="flex flex-col gap-2">
        <div data-testid="size" className="font-mono text-caption text-muted-foreground">{size || ' '}</div>
        <div style={{ width: 480, height: 240, minWidth: 200, minHeight: 120, resize: 'both' }} className="overflow-hidden rounded-xl border border-border">
          <BLProvider>
            <Terminal readOnly onResize={(cols, rows) => setSize(`${cols} × ${rows}`)} onReady={(t) => { setSize(`${t.cols} × ${t.rows}`); t.write('Drag the corner of this box.\r\n'); }} />
          </BLProvider>
        </div>
      </div>
    );
  },
};
