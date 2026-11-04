import type { Meta, StoryObj } from '@storybook/react-vite';
import { Diagram } from '@/components/ui/diagram';
import { DiagramFrame, DiagramPanelField, DiagramPanelSection, type DiagramFrameProps } from '@/components/ui/diagram-frame';
import { useContainerSize } from '@/lib/container';
import { Phone } from '../stories/frame';

const meta: Meta<typeof DiagramFrame> = {
  title: 'Organisms/DiagramFrame',
  component: DiagramFrame,
};
export default meta;
type Story = StoryObj<typeof DiagramFrame>;

const NODES = [
  { id: 'a', label: 'One', x: 40, y: 60, w: 120, h: 56 },
  { id: 'b', label: 'Two', x: 240, y: 60, w: 120, h: 56 },
];
const EDGES = [{ id: 'ab', from: 'a', to: 'b', label: 'then' }];

function Example(props: Partial<DiagramFrameProps>) {
  const [host, size] = useContainerSize();
  return (
    <DiagramFrame
      host={host}
      size={size}
      title="Details"
      status="Two nodes"
      panel={(
        <div className="flex flex-col gap-3.5 px-3.5 pt-1 pb-3.5">
          <DiagramPanelSection title="This node">
            <DiagramPanelField label="Name" slot="story-name" value="One" onCommit={() => {}} />
            <p className="m-0 text-footnote">What’s in a panel is up to what’s made of this.</p>
          </DiagramPanelSection>
        </div>
      )}
      {...props}
    >
      {(bar) => <Diagram defaultNodes={NODES} defaultEdges={EDGES} aria-label="An example" overlay={bar} />}
    </DiagramFrame>
  );
}

/** With the room, the panel's a column beside the board. */
export const Beside: Story = {
  render: () => <Phone w={900} h={360}><Example /></Phone>,
};

/** Closed, with a bar to open it again. */
export const Closed: Story = {
  render: () => <Phone w={900} h={360}><Example defaultOpen={false} /></Phone>,
};

/** Without the room, it's a tray under the board, which is closed to begin with. */
export const UnderTheBoard: Story = {
  render: () => <Phone><Example /></Phone>,
};

/** Open, it doesn't cover the board or dim it. */
export const UnderTheBoardOpen: Story = {
  render: () => <Phone><Example defaultOpen /></Phone>,
};

export const Dark: Story = {
  render: () => <Phone w={900} h={360} dark><Example /></Phone>,
};
