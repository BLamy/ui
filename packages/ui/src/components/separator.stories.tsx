import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Separator> = {
  title: 'Atoms/Separator',
  component: Separator,
  // `parameters.dark` switches the frame; a Dark story's own frame would nest inside this one.
  decorators: [(Story, { parameters }) => <Panel dark={parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-foreground">
      <div className="text-[17px] font-semibold">BL UI</div>
      <Separator />
      <div className="text-[15px] text-muted-foreground">iOS-flavored primitives on UI SDK.</div>
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

/** `decorative`: the word already says the two ways are separate, so screen readers skip the lines. */
export const Decorative: Story = {
  render: () => (
    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <Separator decorative className="w-auto flex-1" />or<Separator decorative className="w-auto flex-1" />
    </div>
  ),
};

export const Dark: Story = {
  parameters: { dark: true },
  render: () => (
    <div className="flex flex-col gap-4">
      <Card>
        {['Wi-Fi', 'Bluetooth', 'Cellular'].map((t, i) => (
          <div key={t}>
            {i ? <Separator inset decorative /> : null}
            <div className="flex h-row items-center px-4 text-body text-foreground">{t}</div>
          </div>
        ))}
      </Card>
      <div className="flex h-5 items-center gap-3 text-subhead text-primary">
        <span>Docs</span><Separator orientation="vertical" /><span>Components</span>
      </div>
    </div>
  ),
};
