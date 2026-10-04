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
  { id: 'home', label: 'Home', icon: 'house', href: '#home' },
  { id: 'projects', label: 'Projects', href: '#projects' },
  { id: 'design', label: 'Design system', href: '#design' },
  { id: 'components', label: 'Components', onPress: go('components') },
  { id: 'breadcrumb', label: 'Breadcrumb' },
];

/** Every item but the last is a link (`href`) or a button (`onPress`); the last is the current page. */
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
  items: labels.map((label) => ({ id: label, label, icon: 'doc', onPress: go(label) })),
  selectedId: current,
});

/** Like VS Code's: an item with `items` opens the other entries of its parent. The checked one is the current. */
export const WithSiblingMenus: Story = {
  args: {
    items: [
      { id: 'home', label: 'Home', icon: 'house', href: '#home' },
      { id: 'ui', label: 'ui', icon: 'folder', ...siblings('ui', 'ui', 'docs', 'catalog', 'registry') },
      { id: 'components', label: 'components', icon: 'folder', ...siblings('components', 'components', 'lib', 'stories') },
      { id: 'breadcrumb.tsx', label: 'breadcrumb.tsx', icon: 'doc', ...siblings('breadcrumb.tsx', 'avatar.tsx', 'badge.tsx', 'breadcrumb.tsx', 'button.tsx', 'card.tsx') },
    ],
  },
};

/** The middle collapses into `…` when the trail does not fit — drag the slider (or the frame's corner) to resize. */
function CollapsingDemo() {
  const [width, setWidth] = useState(300);
  return (
    <div className="flex flex-col gap-4">
      <Slider label="Frame width" showValue minValue={140} maxValue={520} step={4} value={width} onChange={setWidth} />
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
      { id: 'report', label: 'Weekly report', onPress: go('reload report') },
    ],
  },
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={560} dark className="min-h-72"><Story /></Panel>],
  args: { items: PATH },
};
