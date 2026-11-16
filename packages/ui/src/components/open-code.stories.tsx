import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OpenCode, type OpenCodeBaseProps, type OpenCodeProps } from '@/components/ui/open-code';
import type { OpenCodeHostBridge, OpenCodeRuntime } from '@/lib/open-code-host';
import { BLProvider } from '@/lib/theme';
import { Phone } from '../stories/frame';

const meta: Meta<typeof OpenCode> = {
  title: 'Organisms/OpenCode',
  component: OpenCode,
  args: { autoStart: true, browserTools: false, variant: 'card' },
  argTypes: { variant: { control: 'inline-radio', options: ['card', 'plain'] }, appearance: { control: 'inline-radio', options: ['light', 'dark'] } },
};
export default meta;
type Story = StoryObj<typeof OpenCode>;

/** The story's args without a host: each story passes the stub `host`. */
const base = ({ host: _host, createHost: _createHost, ...args }: OpenCodeProps): OpenCodeBaseProps => args;

/* No live runtime: a stub host and a recorded-looking runtime that draws a still frame into the terminal's mount point,
   so every state is a pure function of the story. */

const host: OpenCodeHostBridge = {
  id: 'story-workspace',
  directory: '/workspace',
  workspaceBridge: {
    exists: () => false,
    mkdir: () => {},
    readFile: () => undefined,
    writeFile: () => {},
    readdir: () => [],
    stat: () => undefined,
  },
  processBridge: { exec: async () => ({ stdout: '', stderr: '', code: 0 }) },
};

const SCREEN = [
  '┌ OpenCode v2.2.4 ─────────────────────────────── /workspace ┐',
  '│                                                            │',
  '│  > Make the counter start at 10                            │',
  '│                                                            │',
  '│  ● Read index.html                                         │',
  '│  ● Edit app.js   +1 −1                                     │',
  '│                                                            │',
  '│  The counter now starts at 10. Reload the preview to see.  │',
  '│                                                            │',
  '└ build · claude-sonnet ─────────────────── ctrl+p commands ─┘',
].join('\n');

const runtime: OpenCodeRuntime = {
  version: '2.2.4',
  async mount({ container, themeMode }) {
    const screen = document.createElement('pre');
    screen.textContent = SCREEN;
    screen.className = 'm-0 h-full overflow-hidden p-2 font-mono text-caption leading-[18px]';
    screen.dataset.theme = themeMode;
    container.replaceChildren(screen);
    return { dispose: () => screen.remove() };
  },
};

const never = () => new Promise<OpenCodeRuntime>(() => {});
const broken = async (): Promise<OpenCodeRuntime> => {
  throw new Error('The OpenCode runtime could not be loaded from https://runtime.invalid/runtime.js.');
};

function Page({ children, dark, h = 520 }: { children: ReactNode; dark?: boolean; h?: number }) {
  return (
    <div style={{ width: 880, height: h }} className="overflow-hidden rounded-xl">
      <BLProvider appearance={dark ? 'dark' : 'light'}>
        <div className="flex h-full flex-col p-4">{children}</div>
      </BLProvider>
    </div>
  );
}

/** Waiting at Start (`autoStart={false}`): the empty terminal says what it is for and holds the Start button. */
export const Idle: Story = {
  args: { autoStart: false },
  render: (args) => <Page><OpenCode {...base(args)} host={host} loadRuntime={async () => runtime} className="h-full" /></Page>,
};

/** The runtime is loading. */
export const Starting: Story = {
  render: (args) => <Page><OpenCode {...base(args)} host={host} loadRuntime={never} className="h-full" /></Page>,
};

/** Running: the terminal drawn by the runtime. */
export const Running: Story = {
  render: (args) => <Page><OpenCode {...base(args)} host={host} loadRuntime={async () => runtime} className="h-full" /></Page>,
};

export const RunningDark: Story = {
  render: (args) => <Page dark><OpenCode {...base(args)} host={host} loadRuntime={async () => runtime} className="h-full" /></Page>,
};

/** The runtime failed to load: a destructive callout above the terminal, and Start in the empty terminal tries again. */
export const LoadError: Story = {
  render: (args) => <Page><OpenCode {...base(args)} host={host} loadRuntime={broken} className="h-full" /></Page>,
};

/* A host whose container has two servers listening: the app preview opens beside the terminal (under it when compact),
   with a port switch, Reload and Close. The preview URLs are the host service worker's (`/__virtual__/<port>/`); with
   no worker behind them in Storybook the frame shows whatever the server answers, which is the layout's point here. */
const virtualUrl = (port: number) => (typeof window === 'undefined' ? `http://localhost/__virtual__/${port}/` : new URL(`/__virtual__/${port}/`, window.location.href).href);
const previewHost: OpenCodeHostBridge = {
  ...host,
  previews: {
    ready: async () => {},
    list: () => [
      { port: 5173, url: virtualUrl(5173), name: 'Vite app' },
      { port: 8787, url: virtualUrl(8787), name: 'API' },
    ],
    subscribe: () => () => {},
    fetch: async () => new Response('<!doctype html><title>App</title><h1>Counter: 10</h1>', { headers: { 'content-type': 'text/html' } }),
  },
};

/** With previews: the app beside the terminal, its port switch (Vite app, API), Reload and Close. */
export const WithPreview: Story = {
  render: (args) => <Page><OpenCode {...base(args)} host={previewHost} loadRuntime={async () => runtime} className="h-full" /></Page>,
};

/** The same in a phone-sized pane: the preview stacks under the terminal. */
export const WithPreviewPhone: Story = {
  args: { variant: 'plain' },
  render: (args) => (
    <Phone>
      <div className="absolute inset-0 flex flex-col">
        <OpenCode {...base(args)} host={previewHost} loadRuntime={async () => runtime} className="min-h-0 flex-1" />
      </div>
    </Phone>
  ),
};

/** `variant="plain"` filling a phone-sized pane: no border or radius, and the preview would stack under the terminal. */
export const PlainInPhone: Story = {
  args: { variant: 'plain' },
  render: (args) => (
    <Phone>
      <div className="absolute inset-0 flex flex-col">
        <OpenCode {...base(args)} host={host} loadRuntime={async () => runtime} className="min-h-0 flex-1" />
      </div>
    </Phone>
  ),
};
