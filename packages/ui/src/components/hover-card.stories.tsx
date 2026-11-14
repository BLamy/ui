import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardHeader, HoverCardTrigger, createHoverCardController } from '@/components/ui/hover-card';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof HoverCardContent> = {
  title: 'Molecules/HoverCard',
  component: HoverCardContent,
};
export default meta;
type Story = StoryObj<typeof HoverCardContent>;

function Demo({ open = true, arrow = false }: { open?: boolean; arrow?: boolean }) {
  return (
    <div className="grid h-60 place-items-start justify-center pt-8">
      <HoverCard defaultOpen={open}>
        <HoverCardTrigger href="#ada" className="font-semibold text-primary">@ada</HoverCardTrigger>
        <HoverCardContent arrow={arrow}>
          <HoverCardHeader icon={<Avatar name="Ada Lovelace" size={44} />} title="Ada Lovelace" description="@ada"
            trailing={<Button size="sm" variant="secondary">Follow</Button>} />
          <p className="mt-3 mb-0 text-footnote text-muted-foreground">Maintainer · reviews the motion and layout parts.</p>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

export const Open: Story = { render: () => <Screen h={300}><Demo /></Screen> };
export const Arrow: Story = { render: () => <Screen h={300}><Demo arrow /></Screen> };
export const Dark: Story = { render: () => <Screen dark h={300}><Demo /></Screen> };
export const HoverToOpen: Story = { render: () => <Screen h={300}><Demo open={false} /></Screen> };

const PEOPLE = [
  { handle: 'ada', name: 'Ada Lovelace', role: 'Maintainer' },
  { handle: 'grace', name: 'Grace Hopper', role: 'Reviewer' },
  { handle: 'alan', name: 'Alan Turing', role: 'Contributor' },
];

/** One card for many triggers: each mention hands the card its payload through a controller, and the card moves
    along as the pointer sweeps across them. Rest the pointer on a mention. */
function Mentions({ dark = false }: { dark?: boolean }) {
  const [card] = useState(() => createHoverCardController<(typeof PEOPLE)[number]>());
  return (
    <Screen dark={dark} h={320}>
      <p className="m-0 px-1 pt-6 text-body text-foreground">
        Reviewed by{' '}
        {PEOPLE.map((p, i) => (
          <span key={p.handle}>
            <HoverCardTrigger controller={card} payload={p} href={`#${p.handle}`} className="font-semibold text-primary">@{p.handle}</HoverCardTrigger>
            {i < PEOPLE.length - 1 ? ', ' : '.'}
          </span>
        ))}
      </p>
      <HoverCard controller={card}>
        <HoverCardContent<(typeof PEOPLE)[number]>>
          {({ payload }) => payload ? (
            <HoverCardHeader icon={<Avatar name={payload.name} size={44} />} title={payload.name} description={`@${payload.handle} · ${payload.role}`} />
          ) : null}
        </HoverCardContent>
      </HoverCard>
    </Screen>
  );
}
export const SharedController: Story = { render: () => <Mentions /> };
export const SharedControllerDark: Story = { render: () => <Mentions dark /> };
