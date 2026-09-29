import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton, SkeletonText } from './skeleton';
import { Card, CardContent } from './card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Skeleton> = {
  title: 'Atoms/Skeleton',
  component: Skeleton,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = { args: { className: 'h-24 w-full' } };

const rows = (
  <Card>
    {[0, 1, 2].map((i) => (
      <CardContent key={i} className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-10" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton shape="text" className="w-2/3" />
          <Skeleton shape="text" className="h-3 w-1/3" />
        </div>
      </CardContent>
    ))}
  </Card>
);

export const ListRows: Story = { render: () => rows };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => rows };

/** Every shape, plus a SkeletonText paragraph. */
export const Shapes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" width={44} height={44} />
        <Skeleton shape="rect" width={72} height={44} />
        <Skeleton shape="rounded" width={112} height={34} />
        <Skeleton shape="text" width={120} />
      </div>
      <SkeletonText lines={3} />
      <SkeletonText lines={2} lastLineWidth="40%" lineHeight={11} gap={6} />
    </div>
  ),
};
