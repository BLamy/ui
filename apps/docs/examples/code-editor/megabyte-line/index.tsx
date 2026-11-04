import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { CodeEditor, type CodeEditorHandle } from '@/components/ui/code-editor'

/** Something like minified code: the same seed gives the same megabyte. */
function minified(size: number) {
  const names = ['a', 'b', 'e', 'n', 'r', 't', 'o', 'Ne', 'qt', 'Zn']
  const props = ['type', 'props', 'memoizedState', 'return', 'child', 'then', 'length']
  let state = 7
  const next = (n: number) => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) % n
  const name = () => names[next(names.length)]
  const prop = () => props[next(props.length)]
  const shapes = [
    () => `function ${name()}(${name()},${name()}){return ${name()}.${prop()}===${name()}?${name()}:${next(9)}}`,
    () => `var ${name()}=${name()}.${prop()},${name()}="react.element";`,
    () => `if(typeof ${name()}.${prop()}=="function")${name()}.${prop()}(${name()});`,
    () => `const ${name()}=/["'\`]/g.test(${name()}),${name()}=\`a\${${name()}?\`\${${name()}}\`:'b'}\`;`,
    () => `${name()}=${name()}/${next(8) + 2}|0;`,
  ]
  const parts: string[] = []
  for (let length = 0; length < size; ) {
    const part = shapes[next(shapes.length)]()
    parts.push(part)
    length += part.length
  }
  return parts.join('').slice(0, size)
}

// A megabyte on line 2. The page only ever holds a few hundred characters of it: scroll
// sideways, or jump, and look at it in the inspector. A selection can span the whole line.
export default function MegabyteLine() {
  const lines = useMemo(() => ['/*! bundle.js */', minified(1 << 20), '//# sourceMappingURL=bundle.js.map'], [])
  const editor = useRef<CodeEditorHandle>(null)
  const go = (column: number) => editor.current?.scrollToLine(2, { column })
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={() => go(0)}>Start</Button>
        <Button size="sm" variant="secondary" onPress={() => go(500_000)}>Column 500,000</Button>
        <Button size="sm" variant="secondary" onPress={() => go(1_048_000)}>The end</Button>
        <Button size="sm" variant="secondary" onPress={() => editor.current?.selectAll()}>Select all</Button>
      </div>
      <div className="h-40 overflow-hidden rounded-card border border-border">
        <CodeEditor ref={editor} readOnly variant="ghost" lines={lines} aria-label="bundle.js" />
      </div>
    </div>
  )
}
