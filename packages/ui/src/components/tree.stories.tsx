import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tree, TreeGroup, TreeItem, TreeItemCheckbox, TreeItemIndicator, TreeItemLabel, type TreeNode } from '@/components/ui/tree';
import { schemaTreeItems, type SchemaInfo } from '@/lib/pglite-schema';
import { Phone } from '../stories/frame';

const meta: Meta<typeof Tree> = {
  title: 'Organisms/Tree',
  component: Tree,
  argTypes: {
    density: { control: 'inline-radio', options: ['compact', 'default', 'comfortable'] },
    actionOn: { control: 'inline-radio', options: ['press', 'double-press'] },
    mode: { control: 'inline-radio', options: ['single', 'multiple', 'none'] },
  },
};
export default meta;
type Story = StoryObj<typeof Tree>;

/* Fixed data, so the stories look the same on every run. */

const dir = (path: string, children: TreeNode[]): TreeNode => ({ value: path, label: path.split('/').pop()!, children });
const file = (path: string, extra: Partial<TreeNode> = {}): TreeNode => ({ value: path, label: path.split('/').pop()!, ...extra });

const PROJECT: TreeNode[] = [
  dir('apps', [
    dir('apps/docs', [
      dir('apps/docs/pages', [file('apps/docs/pages/introduction.md'), file('apps/docs/pages/tree.md'), file('apps/docs/pages/a-very-long-page-name-that-has-to-give-way.mdx')]),
      file('apps/docs/vite.config.mts'),
    ]),
  ]),
  dir('packages', [
    dir('packages/ui', [
      dir('packages/ui/src', [
        dir('packages/ui/src/components', [
          file('packages/ui/src/components/button.tsx', { trailing: '4 KB' }),
          file('packages/ui/src/components/tree.tsx', { trailing: '31 KB' }),
          file('packages/ui/src/components/list-box.tsx', { trailing: '9 KB' }),
        ]),
        file('packages/ui/src/index.ts'),
        file('packages/ui/src/styles.css'),
      ]),
      file('packages/ui/package.json'),
    ]),
  ]),
  file('.gitignore'),
  file('README.md'),
  file('nx.json', { dimmed: true }),
];

const OPEN = ['apps', 'apps/docs', 'apps/docs/pages', 'packages', 'packages/ui', 'packages/ui/src', 'packages/ui/src/components'];

const GIT = {
  'apps/docs/pages/tree.md': 'added',
  'packages/ui/src/components/tree.tsx': 'modified',
  'packages/ui/src/components/list-box.tsx': 'renamed',
  'packages/ui/src/styles.css': 'deleted',
  'nx.json': 'ignored',
} as const;

function Frame({ w = 340, h = 520, dark, children }: { w?: number; h?: number; dark?: boolean; children?: ReactNode }) {
  return <Phone w={w} h={h} appearance={dark ? 'dark' : 'light'}><div className="absolute inset-0 flex flex-col bg-card py-2">{children}</div></Phone>;
}

function Files(props: Partial<React.ComponentProps<typeof Tree>>) {
  const [selected, setSelected] = useState<string | null>('packages/ui/src/components/tree.tsx');
  return (
    <Tree aria-label="Project files" items={PROJECT} sort defaultExpanded={OPEN} value={selected} onValueChange={setSelected}
      className="min-h-0 flex-1" {...(props as object)} />
  );
}

export const FileTree: Story = { render: (args) => <Frame><Files {...(args as object)} /></Frame> };
export const FileTreeDark: Story = { name: 'File tree, dark', render: () => <Frame dark><Files /></Frame> };
export const FileTreePhone: Story = { name: 'File tree, phone', render: () => <Frame w={390} h={720}><Files density="comfortable" /></Frame> };
export const GitStatus: Story = { render: () => <Frame><Files gitStatus={GIT} /></Frame> };
export const GitStatusDark: Story = { name: 'Git status, dark', render: () => <Frame dark><Files gitStatus={GIT} /></Frame> };
export const Flattened: Story = { render: () => <Frame><Files flatten defaultExpanded={['packages/ui/src', 'packages/ui/src/components']} /></Frame> };

/** Type in the field: only the matches and the folders above them stay, and "No matches" when nothing does. */
export const Search: Story = { render: () => <Frame><Files search /></Frame> };

/** F2, or Rename in the row's menu, edits the label in place. */
function Renaming() {
  const [nodes, setNodes] = useState(PROJECT);
  const [editing, setEditing] = useState<string | null>('packages/ui/src/components/button.tsx');
  const rename = (list: TreeNode[], value: string, label: string): TreeNode[] =>
    list.map((n) => (n.value === value ? { ...n, label } : n.children ? { ...n, children: rename([...n.children], value, label) } : n));
  return (
    <Tree aria-label="Project files" items={nodes} sort defaultExpanded={OPEN} editing={editing} onEditingChange={setEditing}
      onRename={(node, label) => setNodes((list) => rename(list, node.value, label))}
      contextMenu={(node) => (
        <DropdownMenuContent aria-label={`${node.label} actions`}>
          <DropdownMenuItem value="rename" onSelect={() => setEditing(node.value)}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      )}
      className="min-h-0 flex-1" />
  );
}
export const Rename: Story = { render: () => <Frame><Renaming /></Frame> };

const MAILBOXES: TreeNode[] = [
  { value: 'icloud', label: 'iCloud', children: [
    { value: 'inbox', label: 'Inbox', icon: 'tray', trailing: '12' },
    { value: 'drafts', label: 'Drafts', icon: 'doc', trailing: '2' },
    { value: 'sent', label: 'Sent', icon: 'paperplane' },
    { value: 'archive', label: 'Archive', icon: 'archivebox', dimmed: true },
    { value: 'junk', label: 'Junk', icon: 'xmark-bin', disabled: true },
  ] },
  { value: 'work', label: 'Work', children: [{ value: 'work/inbox', label: 'Inbox', icon: 'tray', trailing: '3' }] },
];

/** Any hierarchy: icons from the icon set, a detail, a faded row and a disabled one; ⌘- and ⇧-click select several. */
export const AnyHierarchy: Story = {
  render: () => (
    <Frame h={360}>
      <Tree aria-label="Mailboxes" items={MAILBOXES} icons={false} defaultExpanded="all" mode="multiple" defaultValue={['inbox', 'drafts']} className="min-h-0 flex-1" />
    </Frame>
  ),
};

/** The three densities side by side: 24, 30 and 36px rows. */
export const Density: Story = {
  render: () => (
    <Phone w={760} h={340}>
      <div className="absolute inset-0 grid grid-cols-3 gap-2 bg-card py-2">
        {(['compact', 'default', 'comfortable'] as const).map((density) => (
          <div key={density} className="flex min-h-0 flex-col">
            <p className="m-0 px-4 pb-1 text-caption font-medium text-muted-foreground">{density}</p>
            <Tree aria-label={`Mailboxes, ${density}`} items={MAILBOXES} icons={false} defaultExpanded="all" density={density} defaultValue="inbox" className="min-h-0 flex-1" />
          </div>
        ))}
      </div>
    </Phone>
  ),
};

/** Checkboxes kept apart from the selection, in a tree composed from parts. */
function Checkable() {
  const [checked, setChecked] = useState<string[]>(['photos', 'photos/2025']);
  const item = (value: string, label: string, children?: ReactNode) => (
    <TreeItem value={value}>
      <TreeItemLabel>{children ? <TreeItemIndicator /> : <span className="size-4 shrink-0" />}<TreeItemCheckbox />{label}</TreeItemLabel>
      {children ? <TreeGroup>{children}</TreeGroup> : null}
    </TreeItem>
  );
  return (
    <Tree aria-label="Back up" checkable checked={checked} onCheckedChange={setChecked} defaultExpanded={['photos', 'documents']} mode="none" className="px-4">
      {item('photos', 'Photos', <>{item('photos/2024', '2024')}{item('photos/2025', '2025')}</>)}
      {item('documents', 'Documents', <>{item('documents/taxes', 'Taxes')}{item('documents/letters', 'Letters')}</>)}
      {item('music', 'Music')}
    </Tree>
  );
}
export const CheckableParts: Story = { name: 'Checkable, from parts', render: () => <Frame h={300}><Checkable /></Frame> };

/** A navigation tree from parts: links, with the current page marked. */
export const PartsMode: Story = {
  name: 'From parts',
  render: () => (
    <Frame h={300}>
      <Tree aria-label="Guide" defaultExpanded={['start', 'components']} current="tree" className="px-4">
        <TreeItem value="start">
          <TreeItemLabel><TreeItemIndicator />Getting started</TreeItemLabel>
          <TreeGroup>
            <TreeItem value="install"><TreeItemLabel render={<a href="#install" />}>Installation</TreeItemLabel></TreeItem>
            <TreeItem value="theming"><TreeItemLabel render={<a href="#theming" />}>Theming</TreeItemLabel></TreeItem>
          </TreeGroup>
        </TreeItem>
        <TreeItem value="components">
          <TreeItemLabel><TreeItemIndicator />Components</TreeItemLabel>
          <TreeGroup>
            <TreeItem value="tree"><TreeItemLabel render={<a href="#tree" />}>Tree</TreeItemLabel></TreeItem>
            <TreeItem value="list-box"><TreeItemLabel render={<a href="#list-box" />}>Listbox</TreeItemLabel></TreeItem>
          </TreeGroup>
        </TreeItem>
      </Tree>
    </Frame>
  ),
};

const SCHEMA: SchemaInfo = {
  schemas: [
    { name: 'public', tables: [
      { schema: 'public', name: 'authors', kind: 'table', comment: null, rowCount: 3, columns: [
        { name: 'id', type: 'integer', typeOid: 23, nullable: false, default: null, isPrimaryKey: true, references: null },
        { name: 'name', type: 'text', typeOid: 25, nullable: false, default: null, isPrimaryKey: false, references: null },
      ] },
      { schema: 'public', name: 'books', kind: 'table', comment: null, rowCount: 1204, columns: [
        { name: 'id', type: 'integer', typeOid: 23, nullable: false, default: null, isPrimaryKey: true, references: null },
        { name: 'author_id', type: 'integer', typeOid: 23, nullable: true, default: null, isPrimaryKey: false, references: { schema: 'public', table: 'authors', column: 'id' } },
        { name: 'title', type: 'text', typeOid: 25, nullable: false, default: null, isPrimaryKey: false, references: null },
      ] },
      { schema: 'public', name: 'recent_books', kind: 'view', comment: null, rowCount: null, columns: [] },
    ] },
  ],
};

/** The SQL console's schema tree: `schemaTreeItems(schema)` on a compact Tree, on its own card. */
export const DatabaseSchema: Story = {
  render: () => (
    <Frame h={360}>
      <div className="mx-3 flex min-h-0 flex-1 flex-col">
        <Tree aria-label="Database schema" items={schemaTreeItems(SCHEMA)} icons={false} density="compact" defaultExpanded={['schema:public', 'table:public.books']}
          className="min-h-0 flex-1 rounded-panel bg-card p-1 shadow-hairline" />
      </div>
    </Frame>
  ),
};

export const Loading: Story = { render: () => <Frame h={240}><Tree aria-label="Database schema" items={[]} loading className="min-h-0 flex-1" /></Frame> };
export const LoadingDark: Story = { name: 'Loading, dark', render: () => <Frame h={240} dark><Tree aria-label="Database schema" items={[]} loading className="min-h-0 flex-1" /></Frame> };
export const Empty: Story = { render: () => <Frame h={240}><Tree aria-label="Database schema" items={[]} emptyState="No tables yet" className="min-h-0 flex-1" /></Frame> };
