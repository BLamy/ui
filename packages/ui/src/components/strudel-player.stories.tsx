import type { Meta, StoryObj } from '@storybook/react-vite';
import { StrudelPlayer, type StrudelPlayerProps } from '@/components/ui/strudel-player';
import { Pad } from '../stories/frame';

/* Inline code, so nothing is fetched: Strudel (and its samples) load only on the first press of play, which these
   stories never make. The player rests idle. */
const CODE = `setcps(.55)
stack(
  s("bd*4, ~ hh*2 ~ hh, ~ cp").gain(.8),
  note("<c2 a1 f1 g1>").s("sawtooth").lpf(700),
  note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>").s("triangle").room(.4).gain(.25)
)`;

const meta: Meta<StrudelPlayerProps> = {
  title: 'Organisms/StrudelPlayer',
  component: StrudelPlayer,
  args: { code: CODE, title: 'Four on the floor', showCode: false, rack: true, showRack: false },
  argTypes: {
    code: { control: 'text' },
    src: { control: false },
    samples: { control: false },
    onCodeChange: { control: false },
  },
  decorators: [(Story, ctx) => <Pad w={720} dark={!!ctx.parameters.dark}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<StrudelPlayerProps>;

/** Idle: play/stop, the title and the piano roll of the pattern's first cycles. */
export const Idle: Story = {};

/** `showCode` opens the pattern under the player. */
export const WithCode: Story = { args: { showCode: true } };

/** `showRack` opens the equipment rack generated from the code. */
export const WithRack: Story = { args: { showRack: true } };

/** The player on a dark surface. */
export const Dark: Story = { parameters: { dark: true } };
