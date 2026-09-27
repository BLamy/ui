import { SyntaxHighlighting } from '@brett_lamy/ui'

export default function InlineCode() {
  return (
    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: 'var(--bl-label)' }}>
      Create the queue with{' '}
      <SyntaxHighlighting
        variant="inline"
        language="ts"
        code="createQueue({ url: process.env.DATABASE_URL })"
      />
      , then register handlers with{' '}
      <SyntaxHighlighting variant="inline" language="ts" code="queue.define('email', sendEmail)" />.
      Jobs retry with{' '}
      <SyntaxHighlighting variant="inline" language="ts" code="exponential({ jitter: 'full' })" />{' '}
      by default.
    </p>
  )
}
