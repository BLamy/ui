import type { Meta, StoryObj } from '@storybook/react-vite';
import '@touchkit/workbench/styles.css';
import { MapChatDemo, type MapChatDemoProps } from './map-chat-demo';
import '../../styles.css';

interface Args extends MapChatDemoProps {
  width: number;
  height: number;
}

const meta: Meta<Args> = {
  title: 'Pages/MapChat',
  render: ({ width, height, ...props }) => (
    <div style={{ width, height, overflow: 'hidden' }}>
      <MapChatDemo {...props} />
    </div>
  ),
  args: { width: 430, height: 800, layout: 'floating', peek: 236 },
  argTypes: { layout: { control: 'radio', options: ['auto', 'floating', 'split'] } },
  parameters: {
    docs: {
      description: {
        component:
          'An always-floating chat over a TileMap. The scripted guide calls map tools (search, show on map, plan route, save trip) and streams its reply; place chips fly the camera. Tiles load from Esri, so this needs network.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Floating: Story = {};
export const Seeded: Story = { args: { initialPrompt: 'Plan an afternoon in DUMBO' } };
export const Split: Story = { args: { width: 1100, height: 720, layout: 'split' } };
