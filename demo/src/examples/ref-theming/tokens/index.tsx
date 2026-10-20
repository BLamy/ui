import { GitbookEditor } from "@brett_lamy/docstream-editor"
import { THEMES } from "./themes"

const page = `## Themed editor

{% hint style="info" %}
Hints, tabs, code and chrome all read the same tokens.
{% endhint %}

{% tabs %}
{% tab title="One" %}
Ask @dana in #design.
{% endtab %}

{% tab title="Two" %}
Second tab.
{% endtab %}
{% endtabs %}

- [x] Tokens from the host
- [ ] Nothing else to configure

\`\`\`css title="theme.css"
:root { --primary: #7c3aed; }
\`\`\`
`

export default function ThemedEditor({ variant = "default" }: { variant?: string }) {
  const css = THEMES[variant] ?? THEMES.default!
  return (
    <div className={`theme-${variant}`} style={{ display: "grid", gap: 12, padding: 12, borderRadius: 14, background: "var(--background)", color: "var(--foreground)" }}>
      <style>{`${css}\n.gb.themed { max-width: none; padding: 4px 16px 16px; border: 1px solid var(--gb-border); border-radius: var(--gb-radius) }`}</style>
      <GitbookEditor markdown={page} documentProperties={false} className="themed" />
      <pre style={{ margin: 0, padding: 12, borderRadius: 10, background: "var(--muted)", color: "var(--muted-foreground)", font: "12px/1.5 ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap" }}>{css}</pre>
    </div>
  )
}
