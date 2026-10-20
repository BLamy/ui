import { useCallback, useMemo, useState } from "react"
import { GitbookEditor, type EditorAttachment } from "@brett_lamy/docstream-editor"
import { MarkdownPane, Pane, Split } from "./ui"
import { SHOTS, blobUrlFor } from "./shots"

const SEED = `# Checkout regression

Seen at ![Checkout](./shots/checkout.svg "thumbnail: 0:39.8") in the recording; the receipt the customer sent is ![receipt.svg](attachment:att-receipt).

{% stepper %}
{% step %}
### ![Cart](./shots/cart.svg "thumbnail: 0:12") Open the cart drawer

Two items, total $267.
{% endstep %}
{% step %}
### Place the order

The request fails with a 500.
{% endstep %}
{% endstepper %}

![Cart drawer](./shots/cart.svg)
`

/** Images already in the Markdown: relative paths through `resolveAsset`, `attachment:` chips through `attachments`. */
export default function FromMarkdown() {
  const [markdown, setMarkdown] = useState(SEED)
  const [resolve, setResolve] = useState(true)
  // The host's store already has the receipt: chips look their file up here by id.
  const attachments = useMemo<EditorAttachment[]>(
    () => [{ id: "att-receipt", name: "receipt.svg", src: blobUrlFor("./shots/receipt.svg"), size: SHOTS["./shots/receipt.svg"]!.length, type: "image/svg+xml" }],
    [],
  )
  // "./shots/cart.svg" as written → a blob: URL the browser can load. Nothing for other URLs: they load as written.
  const resolveAsset = useCallback((url: string) => blobUrlFor(url), [])

  return (
    <Split>
      <Pane
        title="GitbookEditor"
        actions={
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} />
            resolveAsset
          </label>
        }
      >
        <GitbookEditor
          key={String(resolve)}
          markdown={markdown}
          onChange={setMarkdown}
          toolbar={false}
          documentProperties={false}
          attachments={attachments}
          {...(resolve ? { resolveAsset } : {})}
        />
      </Pane>
      <MarkdownPane markdown={markdown} />
    </Split>
  )
}
