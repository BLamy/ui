---
description: Paste or drop an image and choose where the file goes, into the Markdown as a data URL or to your own store behind a compact attachment chip.
---

# Images and attachments

Paste a screenshot into `GitbookEditor` and it becomes part of the document. One prop decides how. `imagePaste="inline"` (the default) writes the image into the Markdown as a figure with a data URL, so the document carries its own file. `imagePaste="chip"` puts a small attachment chip at the caret. The file goes to *your* code, and the Markdown only holds an id.

{% demo src="files-images/paste-modes" %}

Use the buttons if you don't have an image on the clipboard. They fire the same `paste` and `drop` events a real ⌘V or drag from Finder does, so they take the same path through the editor.

## Inline images (the default)

```tsx title="Notes.tsx"
import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"

export function Notes() {
  const [markdown, setMarkdown] = useState("")
  return <GitbookEditor markdown={markdown} onChange={setMarkdown} />
}
```

Each pasted or dropped image file is read with `FileReader` and inserted as an image block: a pasted image at the caret, a dropped one where it lands. The file name becomes the `alt` text. Clipboard screenshots, which have no name, get `image.png`, and `[`, `]`, `"`, `<`, `>` and line breaks in a name become `_`. Several files at once become several blocks.

The block serializes as GitBook figure HTML with the image inline:

```md
<figure><img src="data:image/png;base64,iVBORw0KGgo…" alt="screenshot-1.png"><figcaption></figcaption></figure>
```

That Markdown renders anywhere, with no server, but it is large: a 100 KB screenshot adds about 130 KB of base64 text. Choose chips, or [upload the file](02-host-files.md#uploadfile-files-the-user-adds), once documents get images regularly.

{% hint style="info" %}
A paste whose clipboard also has plain text, such as a selection copied from Word or Excel (which put a rendered PNG beside the text), pastes as text, not as an image. Drops don't have this rule.
{% endhint %}

## Attachment chips

```tsx title="Composer.tsx"
import { useState } from "react"
import { GitbookEditor, type EditorAttachment } from "@brett_lamy/docstream-editor"

export function Composer() {
  const [markdown, setMarkdown] = useState("")
  const [attachments, setAttachments] = useState<EditorAttachment[]>([])

  return (
    <GitbookEditor
      markdown={markdown}
      onChange={setMarkdown}
      imagePaste="chip"
      attachments={attachments}
      // Once per image: { id, name, src (data URL), size, type, file }
      onAttachmentAdd={({ file, ...attachment }) => setAttachments((all) => [...all, attachment])}
      // Chips deleted, cut or cleared by the user
      onAttachmentRemove={(ids) => setAttachments((all) => all.filter((a) => !ids.includes(a.id)))}
    />
  )
}
```

In chip mode a pasted or dropped image becomes an inline chip with a thumbnail, the file name and its size. The editor makes a fresh id (`att-` and 12 random characters), inserts the chip at once, reads the file, and then calls `onAttachmentAdd` with the id, the name, `size`, `type`, the original `File` and `src`, the file as a data URL. If the file can't be read, `onAttachmentAdd` still fires, without `src`. A space keeps the chip off the word before it.

The chip serializes as an image with an `attachment:` URL:

```md
The checkout button overlaps the total. ![screenshot-1.png](attachment:att-38f647a30a79)
```

Hover a chip (or select it with the keyboard) to see the full image in a card. Click it, or press Enter or Space while it's focused, to open the built-in full-screen viewer. Escape closes it.

### The host's store

The document holds only the id and the name. Everything else comes from `attachments`, the array you pass back in. A chip finds its entry by id and takes the thumbnail, full image and size from it. So `src` doesn't have to stay a data URL: upload the `File` in `onAttachmentAdd` and replace `src` with the uploaded URL when it's done.

`EditorAttachment`:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | `string` | The id in the Markdown (`attachment:<id>`). |
| `name` | `string` | Shown on the chip. The name in the store wins over the one in the document. |
| `src` | `string` | Thumbnail and full image: a data URL, an uploaded URL, a `blob:` URL. Without it the chip shows an image icon. |
| `size` | `number` | Bytes, shown as "84 KB" (`formatBytes`, exported). |
| `type` | `string` | MIME type. |

The chip props:

| Prop | Type | Purpose |
| --- | --- | --- |
| `imagePaste` | `"inline" \| "chip"` | `"chip"` turns pasted and dropped images into chips. Default `"inline"`. |
| `attachments` | `EditorAttachment[]` | Your store. Chips look up their file here by id. |
| `onAttachmentAdd` | `(attachment: EditorAttachment & { file: File }) => void` | Once per new image. Add it to `attachments`. |
| `onAttachmentRemove` | `(ids: string[]) => void` | Chips left the document: deleted, cut, or cleared. Not called when you replace `markdown` yourself. |
| `onAttachmentOpen` | `(attachment: EditorAttachment) => void` | A chip was clicked or activated. Omit it for the built-in viewer. |

In the demo above, switch to **chip**, paste two images, then:

- delete a chip with Backspace: `onAttachmentRemove` fires and the store shrinks;
- press **removeAttachment** in the store: the host deletes the chip, the same callback fires;
- tick **custom onAttachmentOpen** and click a chip: the host's viewer opens instead of the built-in one.

### Removing a chip from outside

`removeAttachment(id)` is an editor command. It deletes every chip with that id and returns `false` when there is none. Get the editor from `onEditorReady`:

```tsx title="Composer.tsx"
const editor = useRef<Parameters<NonNullable<GitbookEditorProps["onEditorReady"]>>[0]>(null)

<GitbookEditor onEditorReady={(ed) => (editor.current = ed)} … />

// e.g. from a "Remove" button in your own attachment tray
editor.current?.commands.removeAttachment("att-38f647a30a79")
```

## Images already in the Markdown

What a document already contains is shown the same way whatever `imagePaste` says:

- An image whose URL starts with `attachment:` always loads as a chip, looked up in `attachments`.
- A standalone image line, or `<figure>` HTML, is an image block with a URL field and a caption field while editing.
- An image inside a paragraph (a badge, an icon) stays inline.
- An image with a `thumbnail:` title, `![Checkout](shot.png "thumbnail: 0:39.8")`, renders as docstream's thumbnail with its badge and hover card. First in a stepper step's heading, it sits beside the title input, and editing the title keeps it.

Relative URLs (`./shots/cart.svg`) load through the host's [`resolveAsset`](02-host-files.md#resolveasset-paths-as-written). The demo below maps a few paths to in-memory SVG files. Untick **resolveAsset** and they no longer load.

{% demo src="files-images/from-markdown" %}

```md
Seen at ![Checkout](./shots/checkout.svg "thumbnail: 0:39.8") in the recording; the receipt is ![receipt.svg](attachment:att-receipt).

{% stepper %}
{% step %}
### ![Cart](./shots/cart.svg "thumbnail: 0:12") Open the cart drawer
{% endstep %}
{% endstepper %}
```

<details>
<summary>Rendering chips outside the editor</summary>

`attachment:` is the editor's own scheme. docstream's renderers know nothing about your store, so a chip's Markdown renders as an image with an `attachment:…` URL, which won't load. Before you hand the Markdown to a renderer (or publish it), rewrite `attachment:<id>` to the stored URL, or wrap the renderer in `AssetResolverProvider` (from `@brett_lamy/docstream/assets`) with a resolver that maps `attachment:<id>` to it. docstream's images load through that resolver.

`serializeEditorMarkdown(ast)` is the serializer that writes chips as `![name](attachment:<id>)`. A name with an unbalanced `]` keeps the `<img>` form instead. See [Conversion](../04-reference/02-conversion.md).

</details>

## See also

{% content-ref url="02-host-files.md" %}
Files from the host's project: resolveAsset, pickFile, uploadFile, onDropEmbeds
{% endcontent-ref %}

{% content-ref url="https://blamy.github.io/docstream/#/media/assets" %}
Assets and relative paths in docstream's renderer
{% endcontent-ref %}
