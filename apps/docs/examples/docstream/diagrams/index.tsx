import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { MarkdownView } from '@/components/ui/markdown-view'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'

const examples = {
  xstate: '```xstate\n' + `import { createMachine } from "xstate"

export const machine = createMachine({
  id: "request",
  initial: "idle",
  states: {
    idle: { on: { FETCH: "loading" } },
    loading: { on: { RESOLVE: "success", REJECT: "failure" } },
    failure: { on: { RETRY: "loading" } },
    success: { type: "final" }
  }
})` + '\n```',
  tscircuit: '```tscircuit\n' + `circuit.add(
  <board width="16mm" height="12mm">
    <resistor name="R1" resistance="1k" footprint="0402" pcbX={-3} schX={-2} />
    <capacitor name="C1" capacitance="100nF" footprint="0603" pcbX={3} schX={2} />
    <trace from=".R1 .pin1" to=".C1 .pin1" />
  </board>
)` + '\n```',
}

export default function DiagramExamples() {
  const [kind, setKind] = useState('xstate')
  const [documents, setDocuments] = useState(examples)
  const [mode, setMode] = useState('editor')
  const markdown = documents[kind as keyof typeof documents]
  return (
    <div style={{ minWidth: 0 }}>
      <div role="group" aria-label="Diagram example" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button size="sm" variant={kind === 'xstate' ? 'default' : 'secondary'} aria-pressed={kind === 'xstate'} onClick={() => setKind('xstate')}>XState</Button>
        <Button size="sm" variant={kind === 'tscircuit' ? 'default' : 'secondary'} aria-pressed={kind === 'tscircuit'} onClick={() => setKind('tscircuit')}>tscircuit</Button>
      </div>
      <Tabs value={mode} onValueChange={(v) => v && setMode(v)}>
        <TabsList aria-label="Diagram mode">
          <TabsTab value="editor">Live editor</TabsTab>
          <TabsTab value="preview">MarkdownView</TabsTab>
        </TabsList>
        <TabsPanel value="editor">
          <p style={{ color: 'color-mix(in oklab, var(--foreground) 70%, transparent)', fontSize: 13, marginBlock: '12px' }}>
            {kind === 'xstate' ? 'Rename a state or event and watch the statechart update.' : 'Change the resistance or component position to redraw the circuit. The hosted runtime needs a network connection.'}
          </p>
          <MarkdownEditor
            key={kind}
            aria-label={kind === 'xstate' ? 'XState diagram source' : 'tscircuit example source'}
            value={markdown}
            onValueChange={(value) => setDocuments((current) => ({ ...current, [kind]: value }))}
            minHeight={420}
          />
        </TabsPanel>
        <TabsPanel value="preview"><MarkdownView markdown={markdown} /></TabsPanel>
      </Tabs>
    </div>
  )
}
