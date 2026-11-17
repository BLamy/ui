import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Diagram, DiagramToolbar } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameCoverHeader, DiagramFramePanel, DiagramFrameSection, type DiagramFrameProps } from '@/components/ui/diagram-frame';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDiagramLayout } from '@/lib/diagram-layout/react';
import type { DiagramItem } from '@/lib/diagram-keyboard';
import type { DiagramSelection } from '@/lib/diagram-model';
import { STATECHART_LIKE } from '../stories/diagram-anatomy';
import { Phone } from '../stories/frame';

const meta: Meta<typeof DiagramFrame> = {
  title: 'Organisms/DiagramFrame',
  component: DiagramFrame,
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof DiagramFrame>;

const NODES = [
  { id: 'a', title: 'One', x: 40, y: 60, w: 120, h: 56 },
  { id: 'b', title: 'Two', x: 240, y: 60, w: 120, h: 56 },
];
const EDGES = [{ id: 'ab', from: 'a', to: 'b', title: 'then' }];

function Example({ cover: coverAtFirst, refused, ...props }: Partial<DiagramFrameProps> & { cover?: boolean; refused?: boolean }) {
  const [name, setName] = useState('One');
  const [refusal, setRefusal] = useState<string | null>(refused ? '“two words” can’t be a name.' : null);
  const [cover, setCover] = useState(!!coverAtFirst);
  return (
    <DiagramFrame {...props}>
      <DiagramFrameBoard>
        <Diagram defaultNodes={NODES} defaultEdges={EDGES} editable aria-label="An example" overlay={<DiagramToolbar />} />
        <DiagramFrameBar>Two nodes</DiagramFrameBar>
      </DiagramFrameBoard>
      <DiagramFramePanel title="Details">
        <DiagramFrameSection title="This node">
          <Field invalid={!!refusal}>
            <FieldLabel>Name</FieldLabel>
            <Input size="sm" value={name} onValueCommit={(next) => {
              if (/\s/.test(next)) { setRefusal(`“${next}” can’t be a name.`); return; }
              setRefusal(null);
              setName(next);
            }} />
            <FieldError>{refusal}</FieldError>
          </Field>
          <p className="m-0 text-footnote text-foreground/70">What’s in a panel is up to what’s made of this.</p>
        </DiagramFrameSection>
        <DiagramFrameSection title="Actions">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCover(true)}>Look inside</Button>
            <Button variant="secondary" size="sm">Delete</Button>
          </div>
        </DiagramFrameSection>
      </DiagramFramePanel>
      {cover ? (
        <DiagramFrameCover>
          <DiagramFrameCoverHeader title={`Inside ${name}`} backLabel="Board" onBack={() => setCover(false)} />
          <p className="m-0 p-5 text-subhead text-muted-foreground">What’s inside what’s selected goes here.</p>
        </DiagramFrameCover>
      ) : null}
    </DiagramFrame>
  );
}

/** A phone's screen, edge to edge: the story's canvas has no padding, so nothing's cut off at 390 px. */
const phone = { parameters: { layout: 'fullscreen' } } as const;

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
  ...phone,
  render: () => <Phone w={390} h={844}><Example /></Phone>,
};

/** Compact and open: a page pushed over the board, with a back button that names it. */
export const PhoneOpen: Story = {
  ...phone,
  render: () => <Phone w={390} h={844}><Example defaultOpen /></Phone>,
};

/** `side="start"`: the panel on the leading edge. */
export const Start: Story = {
  render: () => <Phone w={900} h={360}><Example side="start" /></Phone>,
};

/** A cover over all of it: what's inside what's selected, with a bar that goes back. The board and the panel are inert
 *  underneath. */
export const Cover: Story = {
  render: () => <Phone w={900} h={360}><Example cover /></Phone>,
};

export const CoverPhone: Story = {
  ...phone,
  render: () => <Phone w={390} h={844}><Example cover /></Phone>,
};

/** A field that refuses what it's given: the Field's invalid edge and its error, tied to the input. */
export const Refused: Story = {
  render: () => <Phone w={900} h={360}><Example refused /></Phone>,
};

export const Dark: Story = {
  render: () => <Phone w={900} h={360} appearance="dark"><Example /></Phone>,
};

export const PhoneOpenDark: Story = {
  ...phone,
  render: () => <Phone w={390} h={844} appearance="dark"><Example defaultOpen /></Phone>,
};

/** A machine drawn with the Diagram's anatomy in a frame: the panel says what's selected, and which of its chips was
 *  pressed (the board is editable, so the chips are pressable). */
function Cards() {
  const host = useRef<HTMLDivElement>(null);
  const laid = useDiagramLayout(STATECHART_LIKE, { host });
  const [selection, setSelection] = useState<DiagramSelection>({ nodes: ['paused'], edges: [] });
  const [pressed, setPressed] = useState<DiagramItem | null>(null);
  const node = laid.nodes.find((n) => n.id === selection.nodes[0]);
  return (
    <DiagramFrame>
      <DiagramFrameBoard>
        <div ref={host} className="absolute inset-0">
          <Diagram nodes={laid.nodes} edges={laid.edges} background="grid" editable movable={false} connectable={false} selection={selection} onSelectionChange={setSelection} onAction={setPressed} aria-label="Audio Player" overlay={<DiagramToolbar />} />
        </div>
        <DiagramFrameBar>{node ? node.title : 'Audio Player'}</DiagramFrameBar>
      </DiagramFrameBoard>
      <DiagramFramePanel title="State">
        <DiagramFrameSection title={node?.title ?? 'Nothing selected'}>
          {node?.sections?.map((s) => (
            <p key={s.title} className="m-0 text-footnote text-foreground">{s.title}: {s.items.map((i) => i.title).join(', ')}</p>
          )) ?? null}
          <p className="m-0 text-footnote text-foreground/70">{pressed?.item ? `Pressed ${pressed.item}.` : 'Press a chip on the board.'}</p>
        </DiagramFrameSection>
      </DiagramFramePanel>
    </DiagramFrame>
  );
}

export const WithCards: Story = {
  ...phone,
  render: () => <Phone w={1200} h={900}><Cards /></Phone>,
};
export const WithCardsDark: Story = {
  ...phone,
  render: () => <Phone w={1200} h={900} appearance="dark"><Cards /></Phone>,
};
