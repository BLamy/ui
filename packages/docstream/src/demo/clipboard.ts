/* Copy / paste of docstream content that contains `{% demo %}` blocks.

   A copy writes one clipboard item with three representations (react-aria `DragItem` shape,
   so `useClipboard` / `useDrag` can write it; `writeDocstreamClipboard` writes it to a raw
   `DataTransfer`):

   - `text/plain` and `text/markdown`: renderable docstream Markdown — every demo carries its
     files inline (`{% demo … %}` + titled fences + `{% enddemo %}`), resolver files included,
     so pasting it anywhere (a docs page, an LLM, another editor) still renders;
   - `application/x-docstream+json` (`DOCSTREAM_CLIPBOARD_TYPE`): a `DocstreamClipboardPayload`
     — the exact Markdown (src-only demos stay src-only), plus every demo's files and meta by
     `src`, so a docstream editor can restore the structure and register the files in its
     `DemoVFS`. */
import type { DemoNode, DocumentNode } from "../gitbook/ast"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { inlineDemoNode, toInlineFiles } from "./markdown"
import { cssToSurface } from "./surface"
import type { DemoFile, DemoMeta } from "./types"

export const DOCSTREAM_CLIPBOARD_TYPE = "application/x-docstream+json"

export interface DocstreamClipboardPayload {
  /** Always `"docstream"`. */
  kind: "docstream"
  version: 1
  /** The copied content as docstream Markdown, structure exactly as it was. */
  markdown: string
  /** Every demo's files by `src` (inline files, or the resolver's for src-only demos). */
  files: Record<string, DemoFile[]>
  /** `meta.json`-style defaults by `src` (the resolver's meta, else the tag's attributes). */
  meta: Record<string, DemoMeta>
}

/** A demo's files (and meta) as the copying side knows them. */
export interface DemoSourceSnapshot {
  files: DemoFile[]
  meta?: DemoMeta
}

export interface DocstreamClipboard {
  payload: DocstreamClipboardPayload
  /** The renderable Markdown (demos inlined) written as `text/plain` / `text/markdown`. */
  text: string
}

/** A react-aria `DragItem`: one representation per MIME type. */
export type DocstreamClipboardItem = Record<string, string>

/** Every `{% demo %}` node in a document (inside tabs, hints, lists …), in document order. */
export function collectDemoNodes(doc: DocumentNode): DemoNode[] {
  const out: DemoNode[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (!value || typeof value !== "object") return
    const node = value as { type?: unknown }
    if (node.type === "demo") {
      out.push(value as DemoNode)
      return
    }
    for (const child of Object.values(value)) if (child && typeof child === "object") walk(child)
  }
  walk(doc.children)
  return out
}

/** A copy of `doc` with every demo node replaced by `map(node)`. */
export function mapDemoNodes(doc: DocumentNode, map: (node: DemoNode) => DemoNode): DocumentNode {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk)
    if (!value || typeof value !== "object") return value
    if ((value as { type?: unknown }).type === "demo") return map(value as DemoNode)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = v && typeof v === "object" ? walk(v) : v
    return out
  }
  return walk(doc) as DocumentNode
}

/** A demo tag's attributes as `meta.json`-style defaults. */
export function demoNodeMeta(node: DemoNode): DemoMeta {
  const meta: DemoMeta = {}
  if (node.title) meta.title = node.title
  if (node.description) meta.description = node.description
  if (node.height) meta.height = /^\d+(?:\.\d+)?$/.test(node.height) ? Number(node.height) : node.height
  if (node.layout) meta.layout = node.layout
  if (node.variants?.length) meta.variants = node.variants.map((v) => ({ ...v }))
  if (node.entry) meta.entry = node.entry
  if (node.status) meta.status = node.status
  if (node.bleed !== undefined) meta.bleed = node.bleed
  if (node.className) meta.className = node.className
  if (node.surface) meta.surface = cssToSurface(node.surface)
  if (node.variantsWidth) meta.variantsWidth = node.variantsWidth
  return meta
}

export interface CreateDocstreamClipboardOptions {
  /**
   * Files (and meta) for demos that don't carry theirs inline — the host resolver's, read
   * synchronously (see `peekDemoSource`), or a `DemoVFS`'s. Demos it can't answer for stay
   * src-only in both representations.
   */
  lookup?: (node: DemoNode) => DemoSourceSnapshot | undefined
  /** Markdown serializer. Defaults to docstream's `serializeMarkdown`. */
  serialize?: (doc: DocumentNode) => string
}

/** The clipboard representations of a document (or a selection of one). */
export function createDocstreamClipboard(doc: DocumentNode, options: CreateDocstreamClipboardOptions = {}): DocstreamClipboard {
  const serialize = options.serialize ?? serializeMarkdown
  const files: Record<string, DemoFile[]> = {}
  const meta: Record<string, DemoMeta> = {}
  const inlined = mapDemoNodes(doc, (node) => {
    if (node.files?.length) {
      if (node.src) {
        files[node.src] = toInlineFiles(node.files)
        const tagMeta = demoNodeMeta(node)
        if (Object.keys(tagMeta).length) meta[node.src] = tagMeta
      }
      return node
    }
    const found = node.src ? options.lookup?.(node) : undefined
    if (!found?.files.length) return node
    files[node.src] = toInlineFiles(found.files)
    const merged = { ...found.meta, ...demoNodeMeta(node) }
    if (Object.keys(merged).length) meta[node.src] = merged
    return inlineDemoNode(node, found.files, found.meta)
  })
  return {
    payload: { kind: "docstream", version: 1, markdown: serialize(doc), files, meta },
    text: serialize(inlined),
  }
}

/** Parse the Markdown of a copied docstream selection (or a single demo). */
export function createDocstreamClipboardFromMarkdown(markdown: string, options: CreateDocstreamClipboardOptions = {}): DocstreamClipboard {
  const clip = createDocstreamClipboard(parseMarkdown(markdown), options)
  // Keep the author's bytes for the exact representation.
  return { ...clip, payload: { ...clip.payload, markdown } }
}

/** The clipboard as react-aria `DragItem`s (for `useClipboard`'s `getItems` / `useDrag`). */
export function docstreamClipboardItems(clip: DocstreamClipboard): DocstreamClipboardItem[] {
  return [
    {
      "text/plain": clip.text,
      "text/markdown": clip.text,
      [DOCSTREAM_CLIPBOARD_TYPE]: JSON.stringify(clip.payload),
    },
  ]
}

/** Writes the representations straight onto a `DataTransfer` (a copy / cut / dragstart event's). */
export function writeDocstreamClipboard(data: Pick<DataTransfer, "setData">, clip: DocstreamClipboard): void {
  for (const [type, value] of Object.entries(docstreamClipboardItems(clip)[0])) data.setData(type, value)
}

/** Validates a `DOCSTREAM_CLIPBOARD_TYPE` string. */
export function parseDocstreamClipboard(json: string | null | undefined): DocstreamClipboardPayload | null {
  if (!json) return null
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (!raw || typeof raw !== "object") return null
  const value = raw as Partial<DocstreamClipboardPayload>
  if (value.kind !== "docstream" || typeof value.markdown !== "string") return null
  const files: Record<string, DemoFile[]> = {}
  for (const [src, list] of Object.entries(value.files && typeof value.files === "object" ? value.files : {})) {
    if (!Array.isArray(list)) continue
    const clean = list
      .filter((f): f is DemoFile => !!f && typeof f === "object" && typeof f.path === "string" && typeof f.content === "string")
      .map((f) => ({ path: f.path, content: f.content, ...(typeof f.language === "string" && f.language ? { language: f.language } : {}) }))
    if (clean.length) files[src] = clean
  }
  const meta: Record<string, DemoMeta> = {}
  for (const [src, m] of Object.entries(value.meta && typeof value.meta === "object" ? value.meta : {})) {
    if (m && typeof m === "object") meta[src] = m as DemoMeta
  }
  return { kind: "docstream", version: 1, markdown: value.markdown, files, meta }
}

function hasType(types: ArrayLike<string> | null | undefined, type: string) {
  return !!types && Array.prototype.indexOf.call(types, type) >= 0
}

/** True when a `DataTransfer` carries a docstream payload. */
export function hasDocstreamClipboard(data: Pick<DataTransfer, "types"> | null | undefined): boolean {
  return hasType(data?.types, DOCSTREAM_CLIPBOARD_TYPE)
}

/** The docstream payload on a paste / drop `DataTransfer`, if any. */
export function readDocstreamClipboard(data: Pick<DataTransfer, "getData" | "types"> | null | undefined): DocstreamClipboardPayload | null {
  if (!data || !hasDocstreamClipboard(data)) return null
  return parseDocstreamClipboard(data.getData(DOCSTREAM_CLIPBOARD_TYPE))
}

/** Minimal react-aria `DropItem` shape (text items). */
export interface DocstreamDropItem {
  kind: string
  types?: Set<string>
  getText?: (type: string) => Promise<string>
}

/** The docstream payload among react-aria `DropItem`s (`useClipboard`'s `onPaste`, `useDrop`). */
export async function readDocstreamClipboardItems(items: readonly DocstreamDropItem[]): Promise<DocstreamClipboardPayload | null> {
  for (const item of items) {
    if (item.kind === "text" && item.types?.has(DOCSTREAM_CLIPBOARD_TYPE) && item.getText) {
      const payload = parseDocstreamClipboard(await item.getText(DOCSTREAM_CLIPBOARD_TYPE))
      if (payload) return payload
    }
  }
  return null
}

/**
 * A payload for Markdown that arrived without one (only `text/plain` / `text/markdown`):
 * inline-file demos give their files by `src`.
 */
export function docstreamPayloadFromMarkdown(markdown: string): DocstreamClipboardPayload {
  const { payload } = createDocstreamClipboardFromMarkdown(markdown)
  return payload
}
