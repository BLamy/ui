import { useCallback, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { Workspace, type WorkspaceTabNode, type WorkspaceLayoutInput, type WorkspacePresentation, type WorkspaceTabSide } from '@/components/ui/workspace';
import { BLProvider } from '@/lib/theme';
import { Phone } from '../stories/frame';

interface Args { tabSide?: WorkspaceTabSide; presentation?: WorkspacePresentation; dark?: boolean }
const meta: Meta<Args> = { title: 'Organisms/Workspace' };
export default meta;
type Story = StoryObj<Args>;

type Kind = 'code' | 'preview' | 'terminal' | 'notes';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <Button variant="secondary" onClick={() => setCount(count + 1)}>Clicked {count} times</Button>
  );
}

const BODY: Record<Kind, (title: string) => ReactNode> = {
  code: (title) => (
    <pre className="m-0 p-4 font-mono text-caption text-muted-foreground">{`// ${title}\nexport function App() {\n  return <Workspace />\n}`}</pre>
  ),
  preview: () => <div className="grid h-full place-items-center p-4"><Counter /></div>,
  terminal: () => <pre className="m-0 p-4 font-mono text-caption text-muted-foreground">{'$ pnpm dev\n  ready on :5173'}</pre>,
  notes: () => <textarea aria-label="Notes" defaultValue="Drafts keep their text when their tab moves." className="box-border size-full resize-none border-0 bg-transparent p-4 text-footnote text-foreground outline-none" />,
};

const layout = (extra?: Partial<WorkspaceLayoutInput<Kind>>): WorkspaceLayoutInput<Kind> => ({
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      {
        type: 'split',
        orientation: 'vertical',
        size: 60,
        children: [
          {
            type: 'tabset',
            id: 'editors',
            size: 70,
            tabs: [
              { id: 'app', title: 'app.tsx', data: 'code' },
              { id: 'styles', title: 'styles.css', data: 'code' },
            ],
          },
          { type: 'tabset', id: 'terminals', size: 30, tabs: [{ id: 'term', title: 'Terminal', data: 'terminal' }] },
        ],
      },
      {
        type: 'tabset',
        id: 'side',
        tabs: [
          { id: 'preview', title: 'Preview', data: 'preview' },
          { id: 'notes', title: 'Notes', data: 'notes' },
        ],
      },
    ],
  },
  ...extra,
});

function Demo({ tabSide, presentation, dark, input = layout(), h = 520 }: Args & { input?: WorkspaceLayoutInput<Kind>; h?: number }) {
  const renderTabContent = useCallback((tab: WorkspaceTabNode<Kind>) => BODY[tab.data](tab.title ?? tab.id), []);
  return (
    <div className="w-full overflow-hidden rounded-card shadow-hairline" style={{ height: h }}>
      <BLProvider appearance={dark ? 'dark' : 'light'} className="size-full">
        <Workspace<Kind>
          aria-label="Editor"
          tabSide={tabSide}
          presentation={presentation}
          defaultLayout={input}
          renderTabContent={renderTabContent}
          renderEmptyTabset={() => (
            <div className="grid h-full place-items-center text-footnote text-muted-foreground">Drag a tab here.</div>
          )}
        />
      </BLProvider>
    </div>
  );
}

/** Editors and a terminal on the left, a preview and notes on the right. Drag a tab along its strip, into another
    strip, or onto an edge of a pane to split it there; Space picks a focused tab up and the arrow keys move it. Click
    the counter or type a note, then move its tab: it keeps its state. */
export const Default: Story = {
  args: { tabSide: 'top', presentation: 'auto', dark: false },
  argTypes: {
    tabSide: { control: 'inline-radio', options: ['top', 'bottom', 'start', 'end'] },
    presentation: { control: 'inline-radio', options: ['auto', 'docked', 'tabs'] },
  },
  render: (args) => <Demo {...args} />,
};

export const Dark: Story = { ...Default, args: { ...Default.args, dark: true } };

/** `tabSide="start"`: every strip runs down the leading edge; Up and Down move between tabs. */
export const TabsAtStart: Story = { ...Default, args: { ...Default.args, tabSide: 'start' } };

/** A maximized pane covers the others (the button in its strip restores them). */
export const Maximized: Story = {
  render: () => <Demo input={layout({ maximizedTabsetId: 'editors' })} />,
};

/** A pane with no tabs left shows `renderEmptyTabset` (here, a hint), and is a drop target for any tab. */
export const EmptyTabset: Story = {
  render: () => (
    <Demo
      input={{
        version: 1,
        root: {
          type: 'split',
          orientation: 'horizontal',
          children: [
            { type: 'tabset', id: 'editors', tabs: [{ id: 'app', title: 'app.tsx', data: 'code' }, { id: 'preview', title: 'Preview', data: 'preview' }] },
            { type: 'tabset', id: 'empty', keepWhenEmpty: true, tabs: [] },
          ],
        },
      }}
    />
  ),
};

/** On a phone (a compact box) the workspace shows every tab in one strip along the bottom, one at a time, and nothing
    can be dragged; the layout is kept for when the box grows again. Each tab keeps its state. */
export const Compact: Story = {
  args: { dark: false },
  render: ({ dark }) => (
    <Phone w={390} h={720} appearance={dark ? 'dark' : 'light'}>
      <Demo input={layout()} h={720} dark={dark} />
    </Phone>
  ),
};

export const CompactDark: Story = { ...Compact, args: { dark: true } };
