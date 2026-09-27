/* SyntaxHighlighting page examples. Each `// #region` is shown verbatim as the example's code. */
import type { CSSProperties } from 'react'
import {
  SyntaxHighlighting,
  SyntaxHighlightingContent,
  SyntaxHighlightingCopyButton,
  SyntaxHighlightingHeader,
  SyntaxHighlightingTitle,
  SyntaxTokens,
  useSyntaxTokens,
} from '@brett_lamy/ui'
import raw from './syntax-highlighting.tsx?raw'
import { examples } from './chrome'

// #region sh_file
const queue = `import type { Adapter, JobRecord } from './adapters/types'
import { defaultRetry, type RetryPolicy } from './retry'

export class Queue {
  constructor(private adapter: Adapter) {}

  /** Claim up to \`limit\` jobs that are due, skipping locked rows. */
  async claim(limit = 10): Promise<JobRecord[]> {
    const rows = await this.adapter.claim({ limit, now: new Date() })
    return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }))
  }

  retry(job: JobRecord, policy: RetryPolicy = defaultRetry) {
    if (job.attempts >= policy.maxAttempts) return this.adapter.fail(job.id)
    return this.adapter.reschedule(job.id, policy.delay(job.attempts))
  }
}`

export function FileViewer() {
  return (
    <SyntaxHighlighting
      code={queue}
      language="ts"
      title="src/queue.ts"
      showCopy
      lineNumbers
      highlightLines={[[8, 11]]}
    />
  )
}
// #endregion

// #region sh_inline
export function InlineCode() {
  return (
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--bl-label)' }}>
      Create the queue with{' '}
      <SyntaxHighlighting variant="inline" language="ts" code="createQueue({ url: process.env.DATABASE_URL })" />
      , then register handlers with{' '}
      <SyntaxHighlighting variant="inline" language="ts" code="queue.define('email', sendEmail)" />. Jobs
      retry with <SyntaxHighlighting variant="inline" language="ts" code="exponential({ jitter: 'full' })" /> by
      default.
    </p>
  )
}
// #endregion

// #region sh_diff
const change = `export function delay(attempt: number) {
  return Math.min(base * 2 ** (attempt - 1), maxDelay)
  const backoff = Math.min(base * 2 ** (attempt - 1), maxDelay)
  return applyJitter(backoff, jitter, random)
}`

export function DiffSnippet() {
  return (
    <SyntaxHighlighting
      code={change}
      language="ts"
      title="src/retry.ts"
      lineNumbers
      removedLines={[2]}
      addedLines={[[3, 4]]}
    />
  )
}
// #endregion

// #region sh_copy
export function InstallSnippet() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* No title: the copy button floats top-right (on hover, and always on touch). */}
      <SyntaxHighlighting
        showCopy
        language="bash"
        code={'pnpm add @brett_lamy/ui\npnpm add -D tailwindcss @tailwindcss/vite'}
      />
      <SyntaxHighlighting
        showCopy
        title="main.tsx"
        language="tsx"
        code={"import '@brett_lamy/ui/styles.css'\nimport { BLProvider } from '@brett_lamy/ui'"}
      />
    </div>
  )
}
// #endregion

// #region sh_theme
const palettes: Record<string, CSSProperties> = {
  default: {},
  github: {
    '--bl-syntax-keyword': 'light-dark(#cf222e, #ff7b72)',
    '--bl-syntax-string': 'light-dark(#0a3069, #a5d6ff)',
    '--bl-syntax-number': 'light-dark(#0550ae, #79c0ff)',
    '--bl-syntax-constant': 'light-dark(#0550ae, #79c0ff)',
    '--bl-syntax-function': 'light-dark(#8250df, #d2a8ff)',
    '--bl-syntax-type': 'light-dark(#953800, #ffa657)',
    '--bl-syntax-operator': 'inherit',
    '--bl-syntax-comment': 'light-dark(#59636e, #9198a1)',
    '--bl-syntax-comment-style': 'normal',
    '--bl-syntax-radius': '6px',
  } as CSSProperties,
  midnight: {
    '--bl-syntax-surface': '#0f1226',
    '--bl-syntax-fg': '#d7dcff',
    '--bl-syntax-border': '#2a2f55',
    '--bl-syntax-header-bg': '#161a36',
    '--bl-syntax-line-number': '#4b5286',
    '--bl-syntax-keyword': '#ff79c6',
    '--bl-syntax-string': '#f1fa8c',
    '--bl-syntax-number': '#bd93f9',
    '--bl-syntax-function': '#50fa7b',
    '--bl-syntax-type': '#8be9fd',
    '--bl-syntax-comment': '#6272a4',
    '--bl-syntax-highlight': 'rgba(255,121,198,.14)',
    '--bl-syntax-highlight-bar': '#ff79c6',
    '--bl-label': '#d7dcff',
  } as CSSProperties,
}

export function ThemedBlock({ palette }: { palette: string }) {
  // Set --bl-syntax-* on the block or on any ancestor (a page, a theme root).
  return (
    <div style={palettes[palette]}>
      <SyntaxHighlighting
        code={queue.split('\n').slice(6, 11).join('\n')}
        language="ts"
        title="src/queue.ts"
        lineNumbers
        startLine={7}
        highlightLines={[9]}
      />
    </div>
  )
}
// #endregion

// #region sh_parts
const config = `{
  "name": "@acme/queue",
  "version": "3.3.0",
  "exports": { ".": "./dist/index.js" },
  "peerDependencies": { "pg": "^8.11" }
}`

export function ComposedBlock() {
  return (
    <SyntaxHighlighting code={config} language="json">
      <SyntaxHighlightingHeader>
        <SyntaxHighlightingTitle>package.json</SyntaxHighlightingTitle>
        <span style={{ fontSize: 11, color: 'var(--bl-label2)' }}>JSON · 6 lines</span>
        <SyntaxHighlightingCopyButton label="Copy package.json" />
      </SyntaxHighlightingHeader>
      <SyntaxHighlightingContent lineNumbers highlightLines={[3]} maxHeight={220} />
    </SyntaxHighlighting>
  )
}
// #endregion

// #region sh_hook
const log = `12:00:01 INFO  worker started (concurrency=4)
12:00:02 WARN  job 8123 retry 2/5 in 4000ms
12:00:03 ERROR job 8124 failed: connection reset
12:00:04 INFO  job 8125 done in 182ms`

export function LogTable() {
  // useSyntaxTokens gives you the lines; lay them out however you like.
  const { lines, highlighter } = useSyntaxTokens(log)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <table style={{ borderCollapse: 'collapse', font: '12.5px/1.7 var(--font-mono)', color: 'var(--bl-label)' }}>
        <tbody>
          {lines.map((tokens, i) => (
            <tr key={i} style={{ borderTop: i ? '1px solid var(--bl-sep)' : undefined }}>
              <td style={{ padding: '2px 12px 2px 0', color: 'var(--bl-label3)' }}>#{i + 1}</td>
              <td style={{ padding: '2px 0', whiteSpace: 'pre' }}>
                <SyntaxTokens tokens={tokens} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span style={{ fontSize: 12, color: 'var(--bl-label2)' }}>highlighter: {highlighter}</span>
    </div>
  )
}
// #endregion

// #region sh_engines
const snippet = `def backoff(attempt: int, base: float = 1.0) -> float:
    """Exponential backoff in seconds, capped at a minute."""
    return min(base * 2 ** (attempt - 1), 60.0)`

export function Engines() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <SyntaxHighlighting code={snippet} language="python" title="gpu-lexer (WebGPU)" />
      <SyntaxHighlighting code={snippet} language="python" title='engine="fallback"' engine="fallback" />
    </div>
  )
}
// #endregion

export const SYNTAX_HIGHLIGHTING_LIVE = examples(raw, [
  { id: 'sh_file', title: 'File viewer · filename, line numbers, highlighted range', h: 420, Render: () => <FileViewer /> },
  { id: 'sh_inline', title: 'Inline code in running text', h: 120, Render: () => <InlineCode /> },
  { id: 'sh_diff', title: 'A change · addedLines and removedLines', h: 220, Render: () => <DiffSnippet /> },
  { id: 'sh_copy', title: 'Copyable snippets', h: 220, Render: () => <InstallSnippet /> },
  {
    id: 'sh_theme',
    title: 'Theming with --bl-syntax-* properties',
    h: 240,
    variants: [
      { id: 'default', label: 'Default' },
      { id: 'github', label: 'GitHub' },
      { id: 'midnight', label: 'Midnight' },
    ],
    variantsWidth: 250,
    Render: ({ variant }) => <ThemedBlock palette={variant || 'default'} />,
  },
  { id: 'sh_parts', title: 'Composed from parts', h: 260, Render: () => <ComposedBlock /> },
  { id: 'sh_hook', title: 'useSyntaxTokens · your own layout', h: 200, Render: () => <LogTable /> },
  { id: 'sh_engines', title: 'GPU and fallback side by side', h: 280, Render: () => <Engines /> },
])
