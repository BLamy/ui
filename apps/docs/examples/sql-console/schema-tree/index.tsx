import { useState } from 'react'
import { Tree } from '@/components/ui/tree'
import { schemaTreeItems, type SchemaColumn, type SchemaInfo, type SchemaTable, type SchemaTreeNode } from '@/lib/pglite-schema'

const col = (name: string, type: string, o: Partial<SchemaColumn> = {}): SchemaColumn => ({
  name, type, typeOid: 0, nullable: true, default: null, isPrimaryKey: false, references: null, ...o,
})

// schemaTreeItems takes the result of useSchema() / loadSchema(); a literal works
// for a static picture. Enter (or a click) on a row calls onAction with its node.
const authors = {
  schema: 'public', name: 'authors', kind: 'table' as const, comment: null, rowCount: 4,
  columns: [col('id', 'integer', { nullable: false, isPrimaryKey: true }), col('name', 'text', { nullable: false }), col('born', 'date')],
}
const books = {
  schema: 'public', name: 'books', kind: 'table' as const, comment: null, rowCount: 8,
  columns: [
    col('id', 'integer', { nullable: false, isPrimaryKey: true }),
    col('title', 'text', { nullable: false }),
    col('author_id', 'integer', { references: { schema: 'public', table: 'authors', column: 'id' } }),
    col('price', 'numeric(8,2)', { nullable: false }),
    col('tags', 'text[]', { nullable: false }),
  ],
}
const cheap = {
  schema: 'public', name: 'cheap_books', kind: 'view' as const, comment: null, rowCount: null,
  columns: [col('id', 'integer'), col('title', 'text'), col('price', 'numeric(8,2)')],
}
const schema: SchemaInfo = { schemas: [{ name: 'public', tables: [authors, books, cheap] }] }

export default function DatabaseSchema() {
  const [picked, setPicked] = useState<SchemaTable | null>(null)
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <Tree aria-label="Database schema" items={schemaTreeItems(schema)} icons={false} density="compact" defaultExpanded="all"
        onAction={(_value, { node }) => {
          const n = node as SchemaTreeNode
          if (n.kind === 'table') setPicked(n.table)
        }}
        className="h-80 rounded-panel bg-card p-1 shadow-hairline" />
      <p role="status" className="text-caption text-foreground/65">
        {picked ? `select * from ${picked.name} limit 100;` : 'Press Enter on a table.'}
      </p>
    </div>
  )
}
