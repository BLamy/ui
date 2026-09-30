import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import LoopQA from './page';

const meta: Meta<typeof LoopQA> = {
  title: 'Blocks/Loop QA',
  component: LoopQA,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof LoopQA>;

/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

/** The block fills whatever box it's given; these stories give it the viewport or a device-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="overflow-hidden rounded-[24px] shadow-[0_12px_40px_black] shadow-black/18" style={{ width, height }}>{children}</div>
    </div>
  );
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

/** All projects, with Ask QA docked beside them. */
export const Projects: Story = { args: { askOpen: true }, render: (args) => <Full><LoopQA {...args} /></Full> };

export const ProjectsDark: Story = { args: { askOpen: true }, render: (args) => dark(<Full><LoopQA {...args} /></Full>) };

/** A project's Overview: tiles, the exploration replay and the latest findings. */
export const Overview: Story = {
  args: { initialProject: 'northwind', askOpen: false },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

/** A run in progress: its card on the Overview and in Ask QA, frozen after three journeys. */
export const RunInProgress: Story = {
  args: { initialProject: 'northwind', liveRunAt: 3, askOpen: true },
  render: (args) => dark(<Full><LoopQA {...args} /></Full>),
};

export const Bugs: Story = {
  args: { initialProject: 'northwind', initialTab: 'bugs', askOpen: false },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

export const SiteMap: Story = {
  args: { initialProject: 'northwind', initialTab: 'sitemap', askOpen: false },
  render: (args) => dark(<Full><LoopQA {...args} /></Full>),
};

export const TestRuns: Story = {
  args: { initialProject: 'northwind', initialTab: 'runs', askOpen: false },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

/** Generated Playwright tests with the selected test's source. */
export const PlaywrightTests: Story = {
  args: { initialProject: 'northwind', initialTab: 'tests', askOpen: false },
  render: (args) => dark(<Full><LoopQA {...args} /></Full>),
};

/** A run: findings, coverage, the exploration and its journeys. */
export const RunDetail: Story = {
  args: { initialProject: 'northwind', initialPage: { kind: 'run', id: 'run-2419' }, askOpen: false },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

/** A bug: the replay at the failure, logs, chronology, root cause and details. */
export const BugDetail: Story = {
  args: { initialProject: 'northwind', initialTab: 'bugs', initialPage: { kind: 'bug', id: 'NW-142' }, askOpen: false },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

export const BugDetailDark: Story = {
  args: { initialProject: 'northwind', initialTab: 'bugs', initialPage: { kind: 'bug', id: 'NW-142' }, askOpen: true },
  render: (args) => dark(<Full><LoopQA {...args} /></Full>),
};

/** Ask QA with an empty thread: the greeting over a centred composer and suggestions. */
export const AskQAEmpty: Story = {
  args: { initialProject: 'northwind', askOpen: true, emptyChat: true },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

/** ⌘K at the root, on a bug — its status and severity commands lead. */
export const CommandMenu: Story = {
  args: { initialProject: 'northwind', initialPage: { kind: 'bug', id: 'NW-142' }, palette: true, askOpen: false },
  render: (args) => dark(<Full><LoopQA {...args} /></Full>),
};

/** ⌘K's Bugs page, with the preview pane. */
export const CommandMenuBugs: Story = {
  args: { initialProject: 'northwind', palette: ['bugs'], askOpen: false },
  render: (args) => <Full><LoopQA {...args} /></Full>,
};

/** iPad: the sidebar floats in from its button; Ask QA waits as a FAB. */
export const Tablet: Story = {
  args: { initialProject: 'northwind', askOpen: false },
  render: (args) => <Device width={834} height={860}><LoopQA {...args} /></Device>,
};

export const Phone: Story = { args: { askOpen: false }, render: (args) => <Device width={390} height={844}><LoopQA {...args} /></Device> };

export const PhoneBug: Story = {
  args: { initialProject: 'northwind', initialPage: { kind: 'bug', id: 'NW-142' }, askOpen: false },
  render: (args) => dark(<Device width={390} height={844}><LoopQA {...args} /></Device>),
};

/** iPad: Ask QA floats over the page as the composer, with the newest reply (the run card) peeking above it. */
export const TabletAskQA: Story = {
  args: { initialProject: 'northwind', askOpen: true, chatExpanded: false },
  render: (args) => <Device width={834} height={860}><LoopQA {...args} /></Device>,
};

export const TabletAskQADark: Story = {
  args: { initialProject: 'northwind', askOpen: true, chatExpanded: false },
  render: (args) => dark(<Device width={834} height={860}><LoopQA {...args} /></Device>),
};

/** Phone, dark: the whole transcript grown over a bug, the composer under it. */
export const PhoneAskQADark: Story = {
  args: { initialProject: 'northwind', initialPage: { kind: 'bug', id: 'NW-142' }, askOpen: true },
  render: (args) => dark(<Device width={390} height={844}><LoopQA {...args} /></Device>),
};

/** Phone: the composer floats over the page (no peek on a phone); drag its grip up for the transcript. */
export const PhoneAskQAComposer: Story = {
  args: { initialProject: 'northwind', askOpen: true, chatExpanded: false },
  render: (args) => <Device width={390} height={844}><LoopQA {...args} /></Device>,
};

export const PhoneAskQA: Story = {
  args: { initialProject: 'northwind', askOpen: true },
  render: (args) => <Device width={390} height={844}><LoopQA {...args} /></Device>,
};
