import { useState } from 'react'
import { Button, Form, Input, Label, MarkdownEditor, TextField } from '@brett_lamy/ui'

export default function IssueForm() {
  const [submitted, setSubmitted] = useState<Record<string, string> | null>(null)
  const [body, setBody] = useState('')
  const [tried, setTried] = useState(false)
  const invalid = tried && !body.trim()

  return (
    <Form
      style={{ maxWidth: 520, margin: '0 auto' }}
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (!body.trim()) return
        setSubmitted(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>)
      }}
    >
      <TextField name="title" isRequired defaultValue="Tray snaps back on slow drags">
        <Label variant="field">Title</Label>
        <Input />
      </TextField>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label variant="field" id="issue-body-label">
          Description
        </Label>
        {/* name= submits the Markdown with the form */}
        <MarkdownEditor
          name="body"
          aria-labelledby="issue-body-label"
          aria-describedby="issue-body-help"
          placeholder="Steps to reproduce, expected, actual…"
          size="sm"
          invalid={invalid}
          value={body}
          onValueChange={setBody}
        />
        <span
          id="issue-body-help"
          style={{
            padding: '0 4px',
            fontSize: 13,
            color: invalid ? 'var(--bl-red)' : 'var(--bl-label2)',
          }}
        >
          {invalid ? 'Describe the issue.' : 'Markdown works — lists, links, code blocks.'}
        </span>
      </div>
      <Button type="submit" style={{ alignSelf: 'flex-start' }}>
        File issue
      </Button>
      {submitted && (
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--bl-label2)' }}>
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </Form>
  )
}
