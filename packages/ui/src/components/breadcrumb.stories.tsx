import { useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Breadcrumb, BreadcrumbItem, type BreadcrumbItemData } from '@/components/ui/breadcrumb';
import { Slider } from '@/components/ui/slider';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Molecules/Breadcrumb',
  component: Breadcrumb,
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] } },
  decorators: [(Story) => <Panel w={560} className="min-h-72"><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Breadcrumb>;

const go = (where: string) => () => console.info('breadcrumb →', where);

const PATH: BreadcrumbItemData[] = [
  { value: 'home', label: 'Home', icon: 'house', href: '#home' },
  { value: 'projects', label: 'Projects', href: '#projects' },
  { value: 'design', label: 'Design system', href: '#design' },
  { value: 'components', label: 'Components', onClick: go('components') },
  { value: 'breadcrumb', label: 'Breadcrumb' },
];

/** Every item but the last is a link (`href`) or a button (`onClick`); the last is the current page. */
export const Default: Story = { args: { items: PATH } };

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Breadcrumb size="sm" items={PATH} />
      <Breadcrumb items={PATH} />
      <Breadcrumb size="lg" items={PATH} />
    </div>
  ),
};

export const Composed: Story = {
  render: (args) => (
    <Breadcrumb {...args}>
      <BreadcrumbItem href="#home" icon="house">Home</BreadcrumbItem>
      <BreadcrumbItem href="#docs">Docs</BreadcrumbItem>
      <BreadcrumbItem>Breadcrumb</BreadcrumbItem>
    </Breadcrumb>
  ),
};

export const CustomSeparator: Story = {
  args: { items: PATH.slice(0, 3), separator: '/' },
};

const siblings = (current: string, ...labels: string[]) => ({
  siblings: labels.map((label) => ({ value: label, label, icon: 'doc', onClick: go(label) })),
  siblingValue: current,
});

/** Like VS Code's: an item with `siblings` opens the other entries of its parent. The checked one is the current. */
export const WithSiblingMenus: Story = {
  args: {
    items: [
      { value: 'home', label: 'Home', icon: 'house', href: '#home' },
      { value: 'ui', label: 'ui', icon: 'folder', ...siblings('ui', 'ui', 'docs', 'catalog', 'registry') },
      { value: 'components', label: 'components', icon: 'folder', ...siblings('components', 'components', 'lib', 'stories') },
      { value: 'breadcrumb.tsx', label: 'breadcrumb.tsx', icon: 'doc', ...siblings('breadcrumb.tsx', 'avatar.tsx', 'badge.tsx', 'breadcrumb.tsx', 'button.tsx', 'card.tsx') },
    ],
  },
};

/** The middle collapses into `…` when the trail does not fit — drag the slider (or the frame's corner) to resize. */
function CollapsingDemo() {
  const [width, setWidth] = useState(300);
  return (
    <div className="flex flex-col gap-4">
      <Slider label="Frame width" showValue min={140} max={520} step={4} value={width} onValueChange={setWidth} />
      <div
        style={{ '--frame': `${width}px` } as CSSProperties}
        className="w-(--frame) max-w-full resize-x overflow-hidden rounded-card border border-border bg-card p-2"
      >
        <Breadcrumb items={PATH} />
      </div>
    </div>
  );
}
export const Collapsing: Story = { render: () => <CollapsingDemo /> };

/** The current page is a button when it has a handler. */
export const CurrentPagePressable: Story = {
  args: {
    items: [
      ...PATH.slice(0, 2),
      { value: 'report', label: 'Weekly report', onClick: go('reload report') },
    ],
  },
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={560} dark className="min-h-72"><Story /></Panel>],
  args: { items: PATH },
};

/** A narrow trail whose hidden middle items are pickers: they open their siblings as submenus of `…`. */
export const CollapsingWithPickers: Story = {
  decorators: [(Story) => <Panel w={300} className="min-h-96"><Story /></Panel>],
  args: {
    items: [
      { value: 'home', label: 'Home', icon: 'house', href: '#home' },
      { value: 'ui', label: 'ui', icon: 'folder', ...siblings('ui', 'ui', 'docs', 'catalog', 'registry') },
      { value: 'packages', label: 'packages', icon: 'folder', ...siblings('packages', 'apps', 'packages', 'tools') },
      { value: 'components', label: 'components', icon: 'folder', ...siblings('components', 'components', 'lib', 'stories') },
      { value: 'breadcrumb.tsx', label: 'breadcrumb.tsx', icon: 'doc', ...siblings('breadcrumb.tsx', 'avatar.tsx', 'breadcrumb.tsx', 'button.tsx') },
    ],
  },
};
