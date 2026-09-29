import { SyntaxHighlighting } from '@brett_lamy/ui'

const snippet = `def backoff(attempt: int, base: float = 1.0) -> float:
    """Exponential backoff in seconds, capped at a minute."""
    return min(base * 2 ** (attempt - 1), 60.0)`

export default function Engines() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <SyntaxHighlighting
        code={snippet}
        language="python"
        title="gpu-lexer (WebGPU)"
      />
      <SyntaxHighlighting
        code={snippet}
        language="python"
        title='engine="fallback"'
        engine="fallback"
      />
    </div>
  )
}
