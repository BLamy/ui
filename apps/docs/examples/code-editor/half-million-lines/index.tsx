import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { CodeEditor, type CodeEditorHandle } from '@/components/ui/code-editor'

// No array: a line is worked out when it comes into view, so this file takes no memory.
function getLine(index: number) {
  const block = Math.floor(index / 6)
  switch (index % 6) {
    case 0: return `function step${block}(state, action) {`
    case 1: return `  // Block ${block} of a generated file`
    case 2: return `  const next = reduce(state, action, ${block % 97});`
    case 3: return `  return next === state ? state : { ...next, at: ${block} };`
    case 4: return '}'
    default: return ''
  }
}

// `maxLineLength` says how wide the widest line is, which saves a pass over the file.
export default function HalfMillionLines() {
  const editor = useRef<CodeEditorHandle>(null)
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={() => editor.current?.scrollToLine(1)}>Top</Button>
        <Button size="sm" variant="secondary" onPress={() => editor.current?.scrollToLine(250_000, { align: 'start' })}>Line 250,000</Button>
        <Button size="sm" variant="secondary" onPress={() => editor.current?.scrollToLine(500_000, { align: 'end' })}>The end</Button>
        <Button size="sm" variant="secondary" onPress={() => editor.current?.scrollToLine(1200, { smooth: true })}>Smoothly to 1,200</Button>
      </div>
      <div className="h-72 overflow-hidden rounded-card border border-border">
        <CodeEditor ref={editor} readOnly variant="ghost" lineCount={500_000} getLine={getLine} maxLineLength={64} aria-label="generated.js" />
      </div>
    </div>
  )
}
