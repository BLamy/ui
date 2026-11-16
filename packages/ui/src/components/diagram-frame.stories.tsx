import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Diagram, DiagramToolbar } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameInput, DiagramFramePanel, DiagramFrameSection, type DiagramFrameProps } from '@/components/ui/diagram-frame';
import { Phone } from '../stories/frame';

const meta: Meta<typeof DiagramFrame> = {
  title: 'Organisms/DiagramFrame',
  component: DiagramFrame,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof DiagramFrame>;

const NODES = [
  { id: 'a', label: 'One', x: 40, y: 60, w: 120, h: 56 },
  { id: 'b', label: 'Two', x: 240, y: 60, w: 120, h: 56 },
];
const EDGES = [{ id: 'ab', from: 'a', to: 'b', label: 'then' }];

function Example({ cover, ...props }: Partial<DiagramFrameProps> & { cover?: boolean }) {
  return (
    <DiagramFrame {...props}>
      <DiagramFrameBoard>
        <Diagram defaultNodes={NODES} defaultEdges={EDGES} editable aria-label="An example" overlay={<DiagramToolbar side="top" />} />
        <DiagramFrameBar>Two nodes</DiagramFrameBar>
      </DiagramFrameBoard>
      <DiagramFramePanel title="Details">
        <DiagramFrameSection title="This node">
          <DiagramFrameInput label="Name" value="One" onValueCommit={() => {}} />
          <p className="m-0 text-footnote text-foreground/70">What’s in a panel is up to what’s made of this.</p>
        </DiagramFrameSection>
        <DiagramFrameSection title="Actions">
          <div><Button variant="secondary" size="sm">Delete</Button></div>
        </DiagramFrameSection>
      </DiagramFramePanel>
      {cover ? (
        <DiagramFrameCover>
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
            <Button variant="secondary" size="sm">Back to the board</Button>
            <span className="text-footnote font-semibold">Inside One</span>
          </div>
        </DiagramFrameCover>
      ) : null}
    </DiagramFrame>
  );
}

/** With the room (regular), the panel's a column beside the board, open to begin with. */
export const Column: Story = {
  render: () => <Phone w={900} h={360}><Example /></Phone>,
};

/** Closed: a bar floats at the foot of the board, with a status and the button that opens it. */
export const Closed: Story = {
  render: () => <Phone w={900} h={360}><Example defaultOpen={false} /></Phone>,
};

/** Medium: a drawer over the board that doesn't dim it, so the board stays in sight and in reach. */
export const Drawer: Story = {
  render: () => <Phone w={620} h={420}><Example defaultOpen /></Phone>,
};

/** Compact (a phone): closed to begin with, as it would go over the board. */
export const Phone390: Story = {
  name: 'Phone',
  render: () => <Phone w={390} h={720}><Example /></Phone>,
};

/** Compact and open: a page pushed over the board, with a back button that names it. */
export const PhoneOpen: Story = {
  render: () => <Phone w={390} h={720}><Example defaultOpen /></Phone>,
};

/** `side="start"`: the panel on the leading edge. */
export const Start: Story = {
  render: () => <Phone w={900} h={360}><Example side="start" /></Phone>,
};

/** A cover over all of it: what's inside what's selected. The board and the panel are inert underneath. */
export const Cover: Story = {
  render: () => <Phone w={900} h={360}><Example cover /></Phone>,
};

export const Dark: Story = {
  render: () => <Phone w={900} h={360} appearance="dark"><Example /></Phone>,
};

export const PhoneOpenDark: Story = {
  render: () => <Phone w={390} h={720} appearance="dark"><Example defaultOpen /></Phone>,
};
