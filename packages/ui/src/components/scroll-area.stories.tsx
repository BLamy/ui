import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ScrollArea> = {
  title: 'Atoms/ScrollArea',
  component: ScrollArea,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ScrollArea>;

const tags = Array.from({ length: 40 }, (_, i) => `v1.${40 - i}.0`);

export const Vertical: Story = {
  render: () => (
    <Card>
      <ScrollArea className="h-64" aria-label="Releases">
        <div className="px-4 py-3 text-[13px] font-semibold text-muted-foreground">Releases</div>
        {tags.map((t, i) => (
          <div key={t}>
            {i ? <Separator inset /> : null}
            <div className="px-4 py-2.5 text-[15px] text-foreground">{t}</div>
          </div>
        ))}
      </ScrollArea>
    </Card>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea orientation="horizontal" aria-label="Albums">
      <div className="flex w-max gap-3 pb-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="grid size-28 shrink-0 place-items-center rounded-xl bg-card text-[15px] font-semibold text-muted-foreground">
            Album {i + 1}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};
