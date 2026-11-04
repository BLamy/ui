import { CodeEditor } from '@/components/ui/code-editor'

export default function InlineCode() {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 15,
        lineHeight: 1.7,
        color: 'var(--foreground)',
      }}
    >
      Create the queue with{' '}
      <CodeEditor
        readOnly
        variant="inline"
        language="ts"
        value="createQueue({ url: process.env.DATABASE_URL })"
      />
      , then register handlers with{' '}
      <CodeEditor
        readOnly
        variant="inline"
        language="ts"
        value="queue.define('email', sendEmail)"
      />
      . Jobs retry with{' '}
      <CodeEditor
        readOnly
        variant="inline"
        language="ts"
        value="exponential({ jitter: 'full' })"
      />{' '}
      by default.
    </p>
  )
}
