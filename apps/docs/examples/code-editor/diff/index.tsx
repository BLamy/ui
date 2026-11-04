import { CodeEditor } from '@/components/ui/code-editor'

const change = `export function delay(attempt: number) {
  return Math.min(base * 2 ** (attempt - 1), maxDelay)
  const backoff = Math.min(base * 2 ** (attempt - 1), maxDelay)
  return applyJitter(backoff, jitter, random)
}`

export default function DiffSnippet() {
  return (
    <CodeEditor
      readOnly
      value={change}
      language="ts"
      title="src/retry.ts"
      lineNumbers
      removedLines={[2]}
      addedLines={[[3, 4]]}
    />
  )
}
