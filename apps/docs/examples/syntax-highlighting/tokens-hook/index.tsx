import { SyntaxTokens, useSyntaxTokens } from '@brett_lamy/ui'

const log = `12:00:01 INFO  worker started (concurrency=4)
12:00:02 WARN  job 8123 retry 2/5 in 4000ms
12:00:03 ERROR job 8124 failed: connection reset
12:00:04 INFO  job 8125 done in 182ms`

export default function LogTable() {
  // useSyntaxTokens gives you the lines; lay them out however you like.
  const { lines, highlighter } = useSyntaxTokens(log)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          font: '12.5px/1.7 var(--font-mono)',
          color: 'var(--bl-label)',
        }}
      >
        <tbody>
          {lines.map((tokens, i) => (
            <tr
              key={i}
              style={{ borderTop: i ? '1px solid var(--bl-sep)' : undefined }}
            >
              <td
                style={{ padding: '2px 12px 2px 0', color: 'var(--bl-label3)' }}
              >
                #{i + 1}
              </td>
              <td style={{ padding: '2px 0', whiteSpace: 'pre' }}>
                <SyntaxTokens tokens={tokens} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <span style={{ fontSize: 12, color: 'var(--bl-label2)' }}>
        highlighter: {highlighter}
      </span>
    </div>
  )
}
