import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'

interface Book { id: string; title: string; author: string; year: number }

const BOOKS: Book[] = [
  { id: 'b1', title: 'Solaris', author: 'Stanisław Lem', year: 1961 },
  { id: 'b2', title: 'Kindred', author: 'Octavia E. Butler', year: 1979 },
  { id: 'b3', title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', year: 1968 },
  { id: 'b4', title: 'The Dispossessed', author: 'Ursula K. Le Guin', year: 1974 },
  { id: 'b5', title: 'Neuromancer', author: 'William Gibson', year: 1984 },
]

const COLUMNS: DataTableColumn<Book>[] = [
  { id: 'title', header: 'Title', flex: 2, minWidth: 140 },
  { id: 'author', header: 'Author', flex: 2, minWidth: 140 },
  { id: 'year', header: 'Year', width: 72, align: 'end' },
]

// A fetch in flight shows placeholder rows, not "No rows". Press Reload to see it again.
export default function Loading() {
  const [rows, setRows] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!loading) return undefined
    const timer = setTimeout(() => {
      setRows(BOOKS)
      setLoading(false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [loading])
  return (
    <div className="flex h-[300px] w-full flex-col gap-2">
      <Button variant="outline" size="sm" className="self-start" disabled={loading} onClick={() => { setRows([]); setLoading(true) }}>Reload</Button>
      <DataTable aria-label="Books" rows={rows} columns={COLUMNS} loading={loading} className="min-h-0 flex-1" />
    </div>
  )
}
