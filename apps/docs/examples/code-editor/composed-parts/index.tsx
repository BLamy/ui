import { CodeEditor, CodeEditorContent, CodeEditorCopyButton, CodeEditorHeader, CodeEditorTitle } from '@/components/ui/code-editor'

const config = `{
  "name": "@acme/queue",
  "version": "3.3.0",
  "exports": { ".": "./dist/index.js" },
  "peerDependencies": { "pg": "^8.11" }
}`

export default function ComposedBlock() {
  return (
    <CodeEditor readOnly value={config} language="json">
      <CodeEditorHeader>
        <CodeEditorTitle>package.json</CodeEditorTitle>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          JSON · 6 lines
        </span>
        <CodeEditorCopyButton label="Copy package.json" />
      </CodeEditorHeader>
      <CodeEditorContent
        lineNumbers
        highlightLines={[3]}
        maxHeight={220}
      />
    </CodeEditor>
  )
}
