import type { Meta, StoryObj } from '@storybook/react-vite';
import { SPLIT_SAMPLE } from './data';
import InterfaceBuilder, { type InterfaceBuilderProps } from './page';

interface Args extends InterfaceBuilderProps {
  width: number;
  height: number;
}

const meta: Meta<Args> = {
  title: 'Pages/InterfaceBuilder',
  render: ({ width, height, ...props }) => (
    <div style={{ width, height, overflow: 'hidden' }}>
      <InterfaceBuilder {...props} />
    </div>
  ),
  args: { width: 1400, height: 880 },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "Xcode's storyboard for React apps made of BL UI: scenes composed from the kit's containers and edited in place, segues, outlets, delegates and the first responder in React's terms, Framer-style motion, and the app as code.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<Meta<Args>>;

/** The Plant Pal sample: a TabView of NavigationStacks, sheets, delegates and the responder chain. */
export const PlantPal: Story = {};

/** A scene selected inside the TabView that shows it, edited in place. */
export const SelectedInPlace: Story = { args: { initialSelection: { kind: 'node', scene: 'garden', ids: ['plant-list'] } } };

/** The Mail sample on iPad: a three-column SplitView. */
export const Mail: Story = { args: { defaultDocument: SPLIT_SAMPLE } };

/** Running: the storyboard as a live prototype. */
export const Running: Story = { args: { initialRunning: true } };
