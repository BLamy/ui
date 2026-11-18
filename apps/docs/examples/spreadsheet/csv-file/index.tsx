import { useState } from 'react'
import { FileInput, FileInputDropzone, FileInputTrigger } from '@brett_lamy/ui/sdk/react/file-input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spreadsheet } from '@/components/ui/spreadsheet'
import { delimiterForPath, parseCsv, stringifyCsv, type CsvFormat } from '@/lib/csv'

// A CSV or TSV from your computer: it is read in the browser, edited in place and saved as a copy in the same
// format (delimiter, line endings, BOM). Nothing is uploaded. The chooser and the drop target are UI SDK's
// FileInput, which also takes a file pasted while focus is inside the zone.
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
      <FileInput accept={['.csv', '.tsv', 'text/csv', 'text/tab-separated-values']} value={[]} onValueChange={(files) => { void open(files[0]) }}>
        <FileInputDropzone className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 data-dragging:border-primary data-dragging:bg-secondary">
          <span className="text-detail">{file ? file.name : 'Drop a .csv or .tsv file here, or'}</span>
          <div className="flex gap-2">
            {file ? <Button variant="secondary" size="sm" onClick={save}>Save a Copy</Button> : null}
            <FileInputTrigger className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Choose File…</FileInputTrigger>
          </div>
        </FileInputDropzone>
      </FileInput>
      {file ? (
        <Spreadsheet aria-label={file.name} value={file.rows} onValueChange={(rows) => setFile({ ...file, rows })} className="h-[420px]" />
      ) : null}
    </div>
  )
}
