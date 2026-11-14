import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { SqlEditor, SqlEditorFooter, type SqlEditorProps } from '@/components/ui/sql-editor';
import { Panel } from '../stories/primitive-frame';

/* The SQL console's editor on its own (it ships with the console). A textarea over a highlighted copy of its text. */

const meta: Meta<typeof SqlEditor> = {
  title: 'Molecules/SqlEditor',
  component: SqlEditor,
  decorators: [(Story) => <Panel w={640}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof SqlEditor>;

const script = `-- Authors with the most books
select a.name, count(*)::int as books
from authors a
join books b on b.author_id = a.id
where b.price < 15.00 and b.title <> 'Solaris'
group by a.name
order by books desc;`;

function Editor(props: SqlEditorProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return <SqlEditor {...props} defaultValue={undefined} value={value} onValueChange={setValue} onRun={() => {}} />;
}

export const Default: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: script } };
export const Empty: Story = { render: (args) => <Editor {...args} />, args: { placeholder: 'select now();' } };
/** `error.position` underlines the token Postgres stopped at. */
export const Invalid: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: 'select * from boooks;', error: { position: 15 } } };
/** A run in flight: Run reads "Running…" and is disabled. */
export const Pending: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: script, pending: true } };
export const Disabled: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: script, disabled: true } };
export const WithHistory: Story = { render: (args) => <Editor {...args} />, args: { defaultValue: 'select 1;', history: ['select 2;', 'select 1;'] } };
/** Your controls before Run, and fewer lines. */
export const CustomFooter: Story = {
  render: (args) => (
    <Editor {...args}>
      <SqlEditorFooter><Button variant="ghost" size="sm">Format</Button></SqlEditorFooter>
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
