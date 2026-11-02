import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof HoverCard> = {
  title: 'Molecules/HoverCard',
  component: HoverCard,
};
export default meta;
type Story = StoryObj<typeof HoverCard>;

function Demo({ open = true, arrow = false }: { open?: boolean; arrow?: boolean }) {
  return (
    <div className="grid h-60 place-items-start justify-center pt-8">
      <HoverCardTrigger defaultOpen={open}>
        <a href="#ada" className="font-semibold text-primary">@ada</a>
        <HoverCard placement="bottom" arrow={arrow}>
          <HoverCardHeader media={<Avatar name="Ada Lovelace" size={44} />} title="Ada Lovelace" subtitle="@ada"
            action={<Button size="sm" variant="secondary">Follow</Button>} />
          <p className="mt-3 mb-0 text-footnote text-muted-foreground">Maintainer · reviews the motion and layout parts.</p>
        </HoverCard>
      </HoverCardTrigger>
    </div>
  );
}

export const Open: Story = { render: () => <Screen h={300}><Demo /></Screen> };
export const Arrow: Story = { render: () => <Screen h={300}><Demo arrow /></Screen> };
export const Dark: Story = { render: () => <Screen dark h={300}><Demo /></Screen> };
export const HoverToOpen: Story = { render: () => <Screen h={300}><Demo open={false} /></Screen> };
