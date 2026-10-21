import { useState } from 'react'
import { DropZone, FileTrigger, Text } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { Spreadsheet } from '@/components/ui/spreadsheet'
import { delimiterForPath, parseCsv, stringifyCsv, type CsvFormat } from '@/lib/csv'

// A CSV or TSV from your computer: it is read in the browser, edited in place and saved as a copy in the same
// format (delimiter, line endings, BOM). Nothing is uploaded.
export default function CsvFile() {
  const [file, setFile] = useState<{ name: string; rows: string[][]; format: CsvFormat } | null>(null)
  const open = async (f: File | undefined) => {
    if (!f) return
    const { rows, ...format } = parseCsv(await f.text(), { delimiter: delimiterForPath(f.name) })
    setFile({ name: f.name, rows, format })
  }
  const save = () => {
    if (!file) return
    const url = URL.createObjectURL(new Blob([stringifyCsv(file.rows, file.format)], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: file.name }).click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return (
    <div className="flex w-full max-w-[760px] flex-col gap-3">
      <DropZone
        aria-label="Drop a CSV file"
        onDrop={async (e) => {
          for (const item of e.items) if (item.kind === 'file') { void open(await item.getFile()); break }
        }}
        className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 data-[drop-target]:border-primary data-[drop-target]:bg-secondary"
      >
        <Text slot="label" className="text-detail">{file ? file.name : 'Drop a .csv or .tsv file here, or'}</Text>
        <div className="flex gap-2">
          {file ? <Button variant="secondary" size="sm" onPress={save}>Save a Copy</Button> : null}
          <FileTrigger acceptedFileTypes={['.csv', '.tsv', 'text/csv', 'text/tab-separated-values']} onSelect={(files) => { void open(files?.[0]) }}>
            <Button variant="secondary" size="sm">Choose File…</Button>
          </FileTrigger>
        </div>
      </DropZone>
      {file ? (
        <Spreadsheet aria-label={file.name} value={file.rows} onChange={(rows) => setFile({ ...file, rows })} className="h-[420px]" />
      ) : null}
    </div>
  )
}
