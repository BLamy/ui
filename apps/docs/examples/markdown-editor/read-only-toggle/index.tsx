import { useState } from 'react'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { MarkdownView } from '@/components/ui/markdown-view'

const spec = `## Release 2.4

{% hint style="info" %}
\`TabBar\` now hides with the scroll by default.
{% endhint %}

| Component | Change |
| --- | --- |
| TabView | New pill indicator |
| Credenza | \`compact\` tray is draggable |`

export default function ReadOnlyToggle({
  variant = 'edit',
}: {
  variant?: string
}) {
  const [markdown, setMarkdown] = useState(spec)
  if (variant === 'rendered') return <MarkdownView markdown={markdown} />
  return (
    <MarkdownEditor
      aria-label="Release notes"
      variant="card"
      toolbar
      readOnly={variant === 'readonly'}
      value={markdown}
      onValueChange={setMarkdown}
    />
  )
}
