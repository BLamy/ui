import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { MarkdownView } from '@/components/ui/markdown-view'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs'

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
        <Button size="sm" variant={kind === 'xstate' ? 'default' : 'secondary'} aria-pressed={kind === 'xstate'} onPress={() => setKind('xstate')}>XState</Button>
        <Button size="sm" variant={kind === 'tscircuit' ? 'default' : 'secondary'} aria-pressed={kind === 'tscircuit'} onPress={() => setKind('tscircuit')}>tscircuit</Button>
      </div>
      <Tabs selectedKey={mode} onSelectionChange={(key) => setMode(String(key))}>
        <TabList aria-label="Diagram mode">
          <Tab id="editor">Live editor</Tab>
          <Tab id="preview">MarkdownView</Tab>
        </TabList>
        <TabPanel id="editor">
          <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginBlock: '12px' }}>
            {kind === 'xstate' ? 'Rename a state or event and watch the statechart update.' : 'Change the resistance or component position to redraw the circuit. The hosted runtime needs a network connection.'}
          </p>
          <MarkdownEditor
            key={kind}
            aria-label={kind === 'xstate' ? 'XState diagram source' : 'tscircuit example source'}
            value={markdown}
            onValueChange={(value) => setDocuments((current) => ({ ...current, [kind]: value }))}
            minHeight={420}
          />
        </TabPanel>
        <TabPanel id="preview"><MarkdownView markdown={markdown} /></TabPanel>
      </Tabs>
    </div>
  )
}
