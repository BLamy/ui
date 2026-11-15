import { useState } from 'react'
import { Tree } from '@/components/ui/tree'
import { schemaTreeItems, type SchemaColumn, type SchemaInfo, type SchemaTreeNode } from '@/lib/pglite-schema'

const col = (name: string, type: string, o: Partial<SchemaColumn> = {}): SchemaColumn => ({
  name, type, typeOid: 0, nullable: true, default: null, isPrimaryKey: false, references: null, ...o,
})

// What useSchema() / loadSchema() gives; a literal works for a static picture.
const SCHEMA: SchemaInfo = {
  schemas: [{
    name: 'public',
    tables: [
      { schema: 'public', name: 'authors', kind: 'table', comment: null, rowCount: 4,
        columns: [col('id', 'integer', { nullable: false, isPrimaryKey: true }), col('name', 'text', { nullable: false })] },
      { schema: 'public', name: 'books', kind: 'table', comment: null, rowCount: 1204,
        columns: [
          col('id', 'integer', { nullable: false, isPrimaryKey: true }),
          col('author_id', 'integer', { references: { schema: 'public', table: 'authors', column: 'id' } }),
          col('title', 'text', { nullable: false }),
        ] },
      { schema: 'public', name: 'cheap_books', kind: 'view', comment: null, rowCount: null, columns: [col('title', 'text')] },
    ],
  }],
}

// schemaTreeItems maps schemas → tables → columns to Tree items; each node carries its table (and column), so
// onAction's details.node says what was chosen.
export default function DatabaseSchema() {
  const [chosen, setChosen] = useState('Press a table or a column.')
  return (
    <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
      <Tree aria-label="Database schema" items={schemaTreeItems(SCHEMA)} icons={false} density="compact"
        defaultExpanded={['schema:public', 'table:public.books']}
        onAction={(_value, { node }) => {
          const n = node as SchemaTreeNode
          if (n.kind === 'table') setChosen(`select * from ${n.table.name};`)
          else if (n.kind === 'column') setChosen(`select ${n.column.name} from ${n.table.name};`)
        }}
        className="h-64 rounded-panel bg-card p-1 shadow-hairline" />
      <p role="status" className="m-0 font-mono text-caption text-foreground/70">{chosen}</p>
    </div>
  )
}
