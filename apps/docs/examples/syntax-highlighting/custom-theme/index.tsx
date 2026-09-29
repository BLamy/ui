import type { CSSProperties } from 'react'
import { SyntaxHighlighting } from '@brett_lamy/ui'

// Lines 7–11 of src/queue.ts
const excerpt = `
  /** Claim up to \`limit\` jobs that are due, skipping locked rows. */
  async claim(limit = 10): Promise<JobRecord[]> {
    const rows = await this.adapter.claim({ limit, now: new Date() })
    return rows.map((row) => ({ ...row, attempts: row.attempts + 1 }))
  }`.slice(1)

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
    '--foreground': '#d7dcff',
  } as CSSProperties,
}

export default function CustomTheme({
  variant = 'default',
}: {
  variant?: string
}) {
  // Set --bl-syntax-* on the block or on any ancestor (a page, a theme root).
  return (
    <div style={palettes[variant]}>
      <SyntaxHighlighting
        code={excerpt}
        language="ts"
        title="src/queue.ts"
        lineNumbers
        startLine={7}
        highlightLines={[9]}
      />
    </div>
  )
}
