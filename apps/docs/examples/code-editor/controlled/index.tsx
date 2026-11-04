import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CodeEditor, type CodeEditorChange, type CodeEditorSelection } from '@/components/ui/code-editor'

const source = `const queue = createQueue({ url: process.env.DATABASE_URL })

queue.define('email', sendEmail)
queue.enqueue('email', { to: 'ada@example.com' })
`

const place = (selection: CodeEditorSelection | null) => (selection ? `Ln ${selection.focus.line}, Col ${selection.focus.column + 1}` : '')

// `value` and `onChange`, as an input has. Passing back what it gave you costs nothing, and anything else is
// worked out as the edit it amounts to, so the caret stays where it means something, and undo can take it back.
export default function Controlled() {
  const [value, setValue] = useState(source)
  const [selection, setSelection] = useState<CodeEditorSelection | null>(null)
  const [change, setChange] = useState<CodeEditorChange | null>(null)
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-2">
      <div className="h-60">
        <CodeEditor
          value={value}
          onChange={(next, c) => {
            setValue(next)
            setChange(c)
          }}
          onSelectionChange={setSelection}
          language="ts"
          aria-label="queue.ts"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onPress={() => setValue(`// Formatted by something else\n${value}`)}>Change it from outside</Button>
        <span className="font-mono text-caption text-muted-foreground">{place(selection)}</span>
        <span className="ml-auto font-mono text-caption text-muted-foreground">{change ? `${change.origin} at ${change.from.line}:${change.from.column}` : 'No changes yet'}</span>
      </div>
    </div>
  )
}
