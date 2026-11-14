import type { Meta, StoryObj } from '@storybook/react-vite';
import { StlViewer, type StlViewerProps } from '@/components/ui/stl-viewer';
import { Pad } from '../stories/frame';

/* A small ASCII STL inline (a square pyramid, 6 triangles, 40 × 40 × 30 mm) as a data: URL, so the story needs no
   network and no fixture file. */
const facets: [number[], number[][]][] = [
  [[0, 0, -1], [[0, 0, 0], [40, 40, 0], [40, 0, 0]]],
  [[0, 0, -1], [[0, 0, 0], [0, 40, 0], [40, 40, 0]]],
  [[0, -0.83, 0.55], [[0, 0, 0], [40, 0, 0], [20, 20, 30]]],
  [[0.83, 0, 0.55], [[40, 0, 0], [40, 40, 0], [20, 20, 30]]],
  [[0, 0.83, 0.55], [[40, 40, 0], [0, 40, 0], [20, 20, 30]]],
  [[-0.83, 0, 0.55], [[0, 40, 0], [0, 0, 0], [20, 20, 30]]],
];
const PYRAMID = [
  'solid pyramid',
  ...facets.flatMap(([n, vs]) => [
    `facet normal ${n.join(' ')}`, 'outer loop', ...vs.map((v) => `vertex ${v.join(' ')}`), 'endloop', 'endfacet',
  ]),
  'endsolid pyramid',
].join('\n');
const SRC = `data:model/stl;charset=utf-8,${encodeURIComponent(PYRAMID)}`;

const meta: Meta<StlViewerProps> = {
  title: 'Organisms/StlViewer',
  component: StlViewer,
  args: { src: SRC, title: 'Pyramid', autoRotate: false },
  argTypes: {
    src: { control: false },
    color: { control: 'color' },
    autoRotate: { control: 'boolean' },
  },
  decorators: [(Story, ctx) => <Pad w={520} dark={!!ctx.parameters.dark}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<StlViewerProps>;

/** A model by URL (here an inline ASCII file), in the theme's primary color, with its triangle count and size. */
export const Default: Story = {};

/** `color` sets the model's color; any CSS color. */
export const Tinted: Story = { args: { color: 'var(--success)' } };

/** The same model on a dark surface. */
export const Dark: Story = { parameters: { dark: true } };
