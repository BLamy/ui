import { MarkdownView } from '@/components/ui/markdown-view'

const notes = `## Release 2.4

{% hint style="info" %}
**Heads up:** The \`Tabs\` bar now hides with the scroll by default.
Pass \`hideOnScroll={false}\` to pin it.
{% endhint %}

| Component | Change | Breaking |
| --- | --- | --- |
| Tabs | New \`TabsPill\` part | No |
| List | \`header\` measures itself | No |
| Credenza | \`compact\` tray is draggable | Yes |

> Upgrade with \`pnpm up @brett_lamy/ui\`.`

export default function ReleaseNotes() {
  return (
    <div
      style={{
        padding: '6px 22px',
        borderRadius: 14,
        background: 'var(--card)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <MarkdownView markdown={notes} />
    </div>
  )
}
