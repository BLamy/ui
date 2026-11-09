---
description: How relative image, model, music and recording paths turn into URLs. A GitHub base for repo docs, or your own resolver for files in a folder, a bundle or a database.
---

# Assets and relative paths

Markdown written in a repo points at files next to it: `![Diagram](images/flow.png)`, `{% embed url="models/part.stl" %}`. Those paths mean nothing to the browser showing your page, so docstream lets the host say where they live. The document keeps the paths **as written**, and so does Copy page. Only rendering resolves them.

Two mechanisms, from simplest to most flexible. (A [`DocsSite`](../02-docs-site/04-loading-files.md#files-beside-your-pages) brings its own resolver: files you hand it beside the Markdown load straight from its VFS.)

| | `setAssetBase` | `AssetResolverProvider` |
| --- | --- | --- |
| Shape | One global base URL, for GitHub | A function you supply, per React subtree |
| Maps | `images/x.png` → `https://raw.githubusercontent.com/<repo>/<branch>/<dir>/images/x.png` | Any URL → any URL, `blob:` included, sync or async |
| Use for | Rendering a repo's README or docs | Desktop apps, local folders, uploads, signed URLs, bundlers |

## What goes through it

| In the document | Resolved with |
| --- | --- |
| Images: `![alt](src)`, `<img src>`, figures, thumbnails | the resolver, then `resolveAsset` |
| `{% embed %}` of `.stl`, `.strudel`, `.rrweb` | the resolver, then `resolveAsset` |
| An embed's `poster` | `resolveAsset` only |
| A video's own `url` (`.mp4`, `.webm`, `.ogg`) and YouTube | not resolved: used as written |
| An OpenAPI block's spec link: `[api](specs/api.json)` | the resolver, then `resolveAsset` |
| Links and content refs | not resolved (inside a `DocsSite`, a link to a file in its VFS opens that file) |

## setAssetBase and resolveAsset

```ts title="readme-viewer.ts"
import { setAssetBase, resolveAsset } from "@brett_lamy/docstream"
// or: import { setAssetBase, resolveAsset } from "@brett_lamy/docstream/assets"

// Rendering docs/guide/intro.md from BLamy/docstream@main:
setAssetBase("BLamy/docstream", "main", "docs/guide/intro.md")

resolveAsset("images/flow.png")
// "https://raw.githubusercontent.com/BLamy/docstream/main/docs/guide/images/flow.png"
resolveAsset("./models/part.stl")
// "https://raw.githubusercontent.com/BLamy/docstream/main/docs/guide/models/part.stl"
resolveAsset("https://cdn.example.com/a.png") // unchanged: http(s), data: and blob: pass through

setAssetBase(null, null, null) // clear it: every path is used as written again
```

The base is the **directory** of `filePath`, so paths resolve relative to the file being rendered, as on GitHub. A leading `./` is dropped. A path that starts with `/` or `../` is appended to the base as is. The base is module-global: one per page, set before you render.

## AssetResolverProvider

For anything that isn't "a file on GitHub", give docstream a function. It receives each URL **as written in the document** and returns the URL to load. Return `null` or `undefined` to fall back to `resolveAsset`. Return a promise to resolve asynchronously: images render without a `src`, and models, music and recordings hold a pending frame (`.docstream-asset-pending`) until it settles.

Try it: edit the Markdown, switch to **Async** to see the pending state, or drop an `.stl`, `.strudel`, `.rrweb` or image file onto the demo. The log shows each call docstream makes.

{% demo src="media-assets/resolver" %}

```tsx title="FolderDocs.tsx"
import { useCallback } from "react"
import { AssetResolverProvider, MarkdownContent, type AssetResolver } from "@brett_lamy/docstream"

// A folder the user opened (File System Access API, Electron, a zip…).
function useFolderResolver(folder: FileSystemDirectoryHandle): AssetResolver {
  return useCallback<AssetResolver>(async (url) => {
    if (/^[a-z]+:/i.test(url)) return null // absolute URL: use it as written
    let dir = folder
    const parts = url.replace(/^\.\//, "").split("/")
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part)
    const file = await (await dir.getFileHandle(parts.at(-1)!)).getFile()
    return URL.createObjectURL(file)
  }, [folder])
}

export function FolderDocs({ folder, markdown }: { folder: FileSystemDirectoryHandle; markdown: string }) {
  const resolve = useFolderResolver(folder)
  return (
    <AssetResolverProvider resolve={resolve}>
      <MarkdownContent markdown={markdown} />
    </AssetResolverProvider>
  )
}
```

{% hint style="warning" %}
Keep the resolver's identity stable (`useCallback`, `useMemo`, or define it outside the component). Each asset re-resolves whenever the function changes, which with `blob:` URLs means new object URLs on every render.
{% endhint %}

A rejected promise falls back to `resolveAsset(url)`, so a missing file shows the browser's own broken image, or the viewer's "Couldn't load" message, rather than breaking the page. Model, music and recording titles keep the file name as written even when the resolved URL is an anonymous `blob:`.

## useAsset in your own components

`useAsset(url)` is the hook the built-in blocks use. It returns the resolved URL, or `undefined` while an async resolver is working:

```tsx title="Thumbnail.tsx"
import { useAsset } from "@brett_lamy/docstream"

export function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const url = useAsset(src) // undefined while pending
  return url === undefined ? <span className="skeleton" /> : <img src={url} alt={alt} />
}
```

`AssetResolverContext` is exported too, for reading the current resolver directly. `AssetResolver` is the function type: `(url: string) => string | null | undefined | Promise<string | null | undefined>`.

## On this site

This site serves its sample media from Vite's `public/` folder under the `/docstream/` base, so the pages here use root-relative URLs such as `/docstream/models/bracket.stl`. A root-relative URL comes through unchanged as long as the resolver returns nothing for it and no `setAssetBase` base is set. Once a base is set, `resolveAsset` prefixes every path that isn't `http(s):`, `data:` or `blob:`, root-relative ones included.

## See also

{% content-ref url="03-3d-models.md" %}
3D models
{% endcontent-ref %}

{% content-ref url="../03-writing/01-markdown-basics.md" %}
Images and figures in Markdown
{% endcontent-ref %}
