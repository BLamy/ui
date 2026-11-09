---
description: Plug the editor into the files around a document. Resolve relative paths, add a file chooser, store uploads, claim drops, and embed STL models, Strudel patterns and rrweb recordings that live next to the Markdown.
---

# Files from the host's project

A Markdown file rarely lives alone. It sits in a folder or a repo next to its screenshots, models and recordings, and refers to them with relative paths like `./models/bracket.stl`. The browser can't load those paths by itself. Four optional props connect the editor to wherever the files really are:

| Prop | Signature | What it does |
| --- | --- | --- |
| `resolveAsset` | `(url) => string \| null \| undefined \| Promise<…>` | Turns a URL as written (`./models/part.stl`) into one the browser can load (a `blob:` URL, a signed URL). |
| `pickFile` | `({ kind, current }) => Promise<string \| null \| undefined>` | Adds **Choose file…** to embeds and **Choose image…** to figures. Resolves to the URL to write. |
| `uploadFile` | `(file, { kind }) => Promise<string \| null \| undefined>` | Adds **Upload…** to embeds and figures, and takes dropped or pasted files that aren't images. Resolves to the URL to write. |
| `onDropEmbeds` | `(data: DataTransfer) => Promise<readonly string[]> \| readonly string[] \| null` | Sees every drop first. Return URLs to embed at the drop point, or `null` to let the editor handle it. |

The demo wires all of them to an in-memory project folder. The STL model, the session replay, the Strudel pattern and the wiring diagram are files in that folder, written into the Markdown as relative paths:

{% demo src="files-host/project-folder" %}

```tsx title="DocumentEditor.tsx"
<GitbookEditor
  markdown={markdown}
  onChange={setMarkdown}
  // "./models/bracket.stl" as written → a URL the browser can load
  resolveAsset={(url) => project.blobUrl(url)}
  // "Choose file…" on embeds, "Choose image…" on figures
  pickFile={({ kind }) => openProjectPicker({ imagesOnly: kind === "image" })}
  // "Upload…", plus dropped and pasted files that aren't images
  uploadFile={async (file) => `./${await project.save(file)}`}
/>
```

## resolveAsset: paths as written

The Markdown keeps the path as the author wrote it. Only rendering resolves it, so a document stays portable: move the folder and the paths still point at the right files. `resolveAsset` is called with the URL from the document and returns the URL to load:

- figures and inline images, thumbnails included;
- embeds of `.stl` models, `.strudel` patterns and `.rrweb` recordings.

Return nothing (`null` or `undefined`) and the URL loads as written, through docstream's default resolution. Return a promise and the block shows a pending state until it settles. A rejected promise also falls back to the default.

```ts title="resolve.ts"
const blobs = new Map<string, string>()

/** Files next to the document, as blob: URLs; anything else loads as written. */
export function resolveAsset(url: string) {
  if (!url.startsWith("./")) return null
  const cached = blobs.get(url)
  if (cached) return cached
  return readProjectFile(url).then((file) => {
    const blob = URL.createObjectURL(file)
    blobs.set(url, blob)
    return blob
  })
}
```

{% hint style="warning" %}
Keep `resolveAsset` stable (a module function, or `useCallback`). Every block that uses it re-resolves its URL when the function changes.
{% endhint %}

Video embeds (`.mp4`, YouTube) don't go through `resolveAsset`. Their URL is used as given. docstream's [asset page](https://blamy.github.io/docstream/#/media/assets) has the renderer's side of the same rules.

## pickFile: the host's file chooser

With `pickFile`, every embed block in edit mode gets **Choose file…** next to its URL field, and every image block **Choose image…**. Pressing it calls `pickFile` with `kind` (`"embed"` or `"image"`) and `current`, the URL the block has now. Show any UI you like: a native dialog in a desktop app, a repo tree, an asset library. Resolve with the URL to write into the block, or with nothing when the user cancels, and the block keeps its URL.

```ts
type FilePickKind = "embed" | "image"
type FilePicker = (request: { kind: FilePickKind; current: string }) => Promise<string | null | undefined>
```

Try it in the demo above: **Choose file…** on the model opens the project's file list, and picking another file swaps the model.

## uploadFile: files the user adds

`uploadFile` stores a file that came from outside the project and resolves to the URL to write. It's called for:

- **Upload…** on an embed or image block (a native file input; `accept="image/*"` for images);
- every **dropped** file that isn't an image (an image still goes inline or to a chip, see [Images and attachments](01-images-and-attachments.md));
- every **pasted** file that isn't an image.

`kind` is `"image"` for the upload button on an image block and `"embed"` otherwise. A dropped or pasted file is embedded where it landed once its upload resolves: an image URL becomes a figure, anything else an embed. If the document changed in the meantime, it goes after the selection instead, never over it. Resolve with nothing (or reject) to skip a file.

```ts
type FileUploader = (file: File, request: { kind: FilePickKind }) => Promise<string | null | undefined>
```

With docstream's Vite plugin, `POST /@docstream/source?mount=…&path=…` with the file as the body writes it to disk, so an upload can land next to the Markdown in a dev server.

## onDropEmbeds: claiming drops

`onDropEmbeds` runs first for every drop from outside the editor: not a block moved within it, and not a demo block dragged in by its grip (see [Demo blocks](04-demo-blocks.md#drag-a-demo)). Look at the `DataTransfer` and decide synchronously:

- return `null` to pass: the editor handles the drop (images inline or as chips, other files to `uploadFile`);
- return URLs, or a promise of URLs, to claim it: each one is embedded at the drop point. An image URL becomes a figure, anything else an embed.

Use it when your app already knows where dropped files go, for example by copying them into the project, or when the drop isn't files at all (a row dragged from your own sidebar). The decision is synchronous, the URLs may arrive later. A pasted file never reaches `onDropEmbeds`.

{% demo src="files-host/drop-routing" %}

```tsx title="Editor.tsx"
<GitbookEditor
  onDropEmbeds={(data) => {
    const models = [...data.files].filter((f) => f.name.endsWith(".stl"))
    if (!models.length) return null // not mine: images inline, the rest to uploadFile
    return Promise.all(models.map((f) => project.copy(f, "models"))) // ["./models/part.stl", …]
  }}
  uploadFile={(file) => project.save(file, "uploads")}
/>
```

`embedBlockFor(url)` is exported: it's the block a URL becomes, if you insert dropped URLs yourself.

```ts
import { embedBlockFor } from "@brett_lamy/docstream-editor"

embedBlockFor("./photos/My%20cat.png") // { type: "gbFigure", attrs: { src, alt: "My cat.png", caption: "", … } }
embedBlockFor("./case/part.stl")       // { type: "gbEmbed", attrs: { url: "./case/part.stl" } }
```

## Embedding project files

The embed block plays what its URL points at, in the editor as in the rendered page:

| URL ends in | Plays as | Through `resolveAsset` |
| --- | --- | --- |
| `.stl` | docstream's `StlViewer`, an orbitable WebGL model | yes |
| `.strudel` | docstream's `StrudelPlayer`, a live-coded music pattern | yes |
| `.rrweb` | docstream's replay player (`ReplayFile`), an rrweb recording: a JSON array of events | yes |
| `.mp4`, `.webm`, `.ogg`, YouTube | a video | no |
| a Replay / Loop QA URL | the Replay preview iframe | no |
| anything else | a link | no |

In edit mode the block also has its URL field (placeholder `https://… or ./file.stl, ./session.rrweb`), with **Choose file…** and **Upload…** beside it when the host provides `pickFile` and `uploadFile`. Changing the field changes the player.

```md
{% embed url="./models/bracket.stl" %}

{% embed url="./recordings/checkout.rrweb" title="Checkout failure" %}

{% embed url="./music/printer.strudel" %}
```

A model or pattern without a `title` is captioned with its file name, taken from the URL as written (a `blob:` URL has no name). The replay player loads rrweb only when the block nears the viewport. Strudel loads its audio engine on the first press of play. docstream's media pages cover each player: [3D models](https://blamy.github.io/docstream/#/media/3d-models), [music](https://blamy.github.io/docstream/#/media/music), [session replays](https://blamy.github.io/docstream/#/media/replays).

<details>
<summary>What the demo's host does</summary>

The project folder is a `Map` from `./dir/name` to a `File`. `resolveAsset` looks the path up and returns the file's `blob:` URL. `pickFile` opens a list of the folder's files and resolves with the chosen path. `uploadFile` waits a moment (a pretend network round trip), adds the file under `./uploads/`, picking a fresh name if it's taken, and resolves with the path. Open the demo's **Code** tab for `project.ts`.

The sample model is generated ASCII STL, the recording is docstream's synthetic checkout session (`replayDemoEvents` from `@brett_lamy/docstream/replay/demo`), and the pattern is one line of Strudel.

</details>

## See also

{% content-ref url="01-images-and-attachments.md" %}
Images and attachments
{% endcontent-ref %}

{% content-ref url="03-source-files.md" %}
Source files: edit the code a source-ref points at
{% endcontent-ref %}
