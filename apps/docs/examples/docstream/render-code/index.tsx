import { CodeEditor } from '@/components/ui/code-editor'
import { MarkdownView, type CodeBlockNode, type CodeBlockRenderDetails } from '@/components/ui/markdown-view'

const answer = [
  'Lower the threshold in the tray config:',
  '',
  '```ts title="tray.config.ts"',
  'export const tray = {',
  '  detents: [0.4, 1],',
  '  threshold: 0.3,',
  '}',
  '```',
  '',
  'Then run the visual tests:',
  '',
  '```bash',
  'pnpm nx run ui:test-vr',
  '```',
].join('\n')

// Fences drawn by the kit's CodeEditor (read-only), so a reply's code looks like the code everywhere else in the app.
// Return null to keep Docstream's rendering, here for one-line fences.
function renderCode(block: CodeBlockNode, details: CodeBlockRenderDetails) {
  if (details.placement !== 'block' || !block.code.includes('\n')) return null
  return (
    <CodeEditor
      readOnly
      value={block.code}
      language={block.language ?? undefined}
      title={block.title ?? undefined}
      lineNumbers={block.lineNumbers}
      showCopy
      style={{ margin: '12px 0' }}
    />
  )
}

export default function RenderCode() {
  return <MarkdownView markdown={answer} renderCode={renderCode} style={{ width: '100%' }} />
}
