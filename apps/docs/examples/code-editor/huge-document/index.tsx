import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CodeEditor, type CodeEditorChange, type CodeEditorHandle } from '@/components/ui/code-editor'

function makeLines() {
  const lines: string[] = []
  for (let i = 0; i < 500_000; i++) lines.push(i % 5 === 0 ? `// Block ${i / 5}` : `const value${i} = compute(${i}, "row ${i}");`)
  return lines.join('\n')
}

function makeLine() {
  const pieces = ['function a(b,c){return b+c}', 'var d="text",e=/x/g;', 'f=g/2|0;', 'if(h)i.j(k)&&l();', 'm=n?.o??p;']
  let out = ''
  for (let i = 0; out.length < 1 << 20; i++) out += pieces[(i * 7) % pieces.length]
  return `/*! A bundle, the way it arrives */\n${out}\n//# sourceMappingURL=bundle.js.map`
}

// `onEdit` gets every change without the whole text being joined: on a file this size, that's what you want instead of
// `onChange`, which would join it on every key. `getValue()` on the ref joins it when you ask.
export default function HugeDocument({ variant = 'lines' }: { variant?: string }) {
  const lines = variant === 'lines'
  const text = useMemo(() => (lines ? makeLines() : makeLine()), [lines])
  const editor = useRef<CodeEditorHandle>(null)
  const [last, setLast] = useState<CodeEditorChange | null>(null)
  const [length, setLength] = useState<number | null>(null)
  const go = () => {
    if (lines) {
      editor.current?.setSelection({ anchor: { line: 500_000, column: 0 }, focus: { line: 500_000, column: 0 } })
      editor.current?.scrollToLine(500_000)
    } else {
      editor.current?.setSelection({ anchor: { line: 2, column: 524_288 }, focus: { line: 2, column: 524_288 } })
      editor.current?.scrollToLine(2, { column: 524_288 })
    }
    editor.current?.focus()
  }
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onPress={go}>{lines ? 'To the end' : 'To the middle of the long line'}</Button>
        <Button size="sm" variant="secondary" onPress={() => setLength(editor.current?.getValue().length ?? null)}>Join the text</Button>
        <span className="ml-auto font-mono text-caption text-muted-foreground">
          {last ? `${last.origin} at ${last.from.line.toLocaleString('en-US')}:${last.from.column.toLocaleString('en-US')}` : 'Type somewhere'}
          {length === null ? '' : ` · ${length.toLocaleString('en-US')} characters`}
        </span>
      </div>
      <div className="h-72">
        <CodeEditor key={variant} ref={editor} defaultValue={text} language="js" onEdit={setLast} aria-label={lines ? 'generated.js' : 'bundle.js'} />
      </div>
    </div>
  )
}
