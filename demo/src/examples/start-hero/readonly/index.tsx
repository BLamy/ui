import { GitbookEditor } from "@brett_lamy/docstream-editor"
import { MarkdownContent } from "@brett_lamy/docstream"

const page = `{% hint style="success" %}
Same Markdown, two components. Switch the variant: the editor's chrome mirrors docstream's renderer block for block.
{% endhint %}

## Review checklist

- [x] Copy reviewed by @dana
- [~] Screenshots refreshed
- [!] Pricing table — numbers refuted

{% tabs %}
{% tab title="Summary" %}
Ship on **Thursday** after the #releases sync.
{% endtab %}

{% tab title="Risks" %}
None outstanding.
{% endtab %}
{% endtabs %}

<details>
<summary>Why a read-only editor?</summary>

Review surfaces, previews and diffs that should look exactly like editing, without accepting input.

</details>
`

/* `toolbar={false} editable={false}`: no caret, no toolbar, no menus — and the blocks still look
   exactly like the editable version. The other variant renders the same string with docstream. */
export default function ReadOnly({ variant = "editor" }: { variant?: string }) {
  return variant === "renderer" ? (
    <MarkdownContent markdown={page} />
  ) : (
    <>
      {/* The editor's wrapper is a centred page with scroll room below; let it sit flush here. */}
      <style>{".gb.ro-editor { max-width: none; padding: 0 0 8px; border: 0; background: none }"}</style>
      <GitbookEditor markdown={page} toolbar={false} editable={false} documentProperties={false} className="ro-editor" />
    </>
  )
}
