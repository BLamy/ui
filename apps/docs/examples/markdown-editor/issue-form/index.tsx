import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'

export default function IssueForm() {
  const [submitted, setSubmitted] = useState<Record<string, string> | null>(
    null,
  )
  const [body, setBody] = useState('')
  const [tried, setTried] = useState(false)
  const invalid = tried && !body.trim()

  return (
    <FieldGroup
      className="gap-5"
      render={<form
        style={{ maxWidth: 520, margin: '0 auto' }}
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (!body.trim()) return
          setSubmitted(
            Object.fromEntries(new FormData(e.currentTarget)) as Record<
              string,
              string
            >,
          )
        }}
      />}
    >
      <Field name="title">
        <FieldLabel>Title</FieldLabel>
        <Input required defaultValue="Tray snaps back on slow drags" />
      </Field>
      {/* The Field names the editor, describes it and makes it invalid; name= submits the Markdown with the form */}
      <Field name="body" invalid={invalid}>
        <FieldLabel>Description</FieldLabel>
        <MarkdownEditor
          placeholder="Steps to reproduce, expected, actual…"
          size="sm"
          value={body}
          onValueChange={setBody}
        />
        <FieldDescription>Markdown works — lists, links, code blocks.</FieldDescription>
        <FieldError match={invalid}>Describe the issue.</FieldError>
      </Field>
      <Button type="submit" style={{ alignSelf: 'flex-start' }}>
        File issue
      </Button>
      {submitted && (
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: 'var(--muted-foreground)',
          }}
        >
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </FieldGroup>
  )
}
