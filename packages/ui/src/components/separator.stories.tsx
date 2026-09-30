import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Separator> = {
  title: 'Atoms/Separator',
  component: Separator,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-foreground">
      <div className="text-[17px] font-semibold">BL UI</div>
      <Separator />
      <div className="text-[15px] text-muted-foreground">iOS-flavored primitives on react-aria.</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-3 text-[15px] text-primary">
      <span>Docs</span><Separator orientation="vertical" /><span>Components</span><Separator orientation="vertical" /><span>Themes</span>
    </div>
  ),
};

export const InsetList: Story = {
  render: () => (
    <Card>
      {['Wi-Fi', 'Bluetooth', 'Cellular'].map((t, i) => (
        <div key={t}>
          {i ? <Separator inset /> : null}
          <div className="px-4 py-[11px] text-[17px] text-foreground">{t}</div>
        </div>
      ))}
    </Card>
  ),
};
