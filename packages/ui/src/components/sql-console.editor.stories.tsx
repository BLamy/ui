import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { SqlConsoleEditor, SqlConsoleEditorFooter, type SqlConsoleEditorProps } from '@/components/ui/sql-console';
import { Panel } from '../stories/primitive-frame';

/* The SQL console's editor on its own, outside a console. A textarea over a highlighted copy of its text. */

const meta: Meta<typeof SqlConsoleEditor> = {
  title: 'Organisms/SqlConsole/Editor',
  component: SqlConsoleEditor,
  decorators: [(Story) => <Panel w={640}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof SqlConsoleEditor>;

const script = `-- Authors with the most books
select a.name, count(*)::int as books
from authors a
join books b on b.author_id = a.id
where b.price < 15.00 and b.title <> 'Solaris'
group by a.name
order by books desc;`;

function Editor(props: SqlConsoleEditorProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return <SqlConsoleEditor {...props} defaultValue={undefined} value={value} onValueChange={setValue} onRun={() => {}} />;
}

export const Default: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: script } };
export const Empty: Story = { render: (args) => <Editor {...args} />, args: { placeholder: 'select now();' } };
/** `errorPosition` (Postgres' 1-based `position`) underlines the token it stopped at and rings the box in the destructive
    color; the textarea is `aria-invalid` and described by your error text. */
export const Invalid: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Editor {...args} aria-describedby="sql-editor-story-error" />
      <p id="sql-editor-story-error" className="m-0 text-footnote text-destructive">relation &quot;boooks&quot; does not exist</p>
    </div>
  ),
  args: { defaultValue: 'select * from boooks;', errorPosition: 15 },
};
/** A run in flight: Run reads "Running…" and is disabled. */
export const Pending: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: script, pending: true } };
export const Disabled: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: script, disabled: true } };
export const WithHistory: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: 'select 1;', history: ['select 2;', 'select 1;'] } };
/** Your controls before Run, and fewer lines. */
export const CustomFooter: Story = {
  render: (args) => (
    <Editor {...args}>
      <SqlConsoleEditorFooter><Button variant="ghost" size="sm">Format</Button></SqlConsoleEditorFooter>
    </Editor>
  ),
  args: { defaultValue: script, rows: 4 },
};
export const NoFooter: Story = { render: (args) => <Editor {...args}>{false}</Editor>, args: { defaultValue: script, rows: 4 } };
export const Dark: Story = {
  render: (args) => <Editor {...args} />,
  args: { defaultValue: script },
  decorators: [(Story) => <Panel w={640} dark><Story /></Panel>],
};
