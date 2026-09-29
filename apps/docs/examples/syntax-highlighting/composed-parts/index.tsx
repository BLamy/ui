import {
  SyntaxHighlighting,
  SyntaxHighlightingContent,
  SyntaxHighlightingCopyButton,
  SyntaxHighlightingHeader,
  SyntaxHighlightingTitle,
} from '@brett_lamy/ui'

const config = `{
  "name": "@acme/queue",
  "version": "3.3.0",
  "exports": { ".": "./dist/index.js" },
  "peerDependencies": { "pg": "^8.11" }
}`

export default function ComposedBlock() {
  return (
    <SyntaxHighlighting code={config} language="json">
      <SyntaxHighlightingHeader>
        <SyntaxHighlightingTitle>package.json</SyntaxHighlightingTitle>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          JSON · 6 lines
        </span>
        <SyntaxHighlightingCopyButton label="Copy package.json" />
      </SyntaxHighlightingHeader>
      <SyntaxHighlightingContent
        lineNumbers
        highlightLines={[3]}
        maxHeight={220}
      />
    </SyntaxHighlighting>
  )
}
