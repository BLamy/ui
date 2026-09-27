import type { DemoInlineFile, DemoNode } from "../gitbook/ast"
import { TAG_ATTRS } from "../gitbook/attrs"
import { flattenForPlainMarkdown } from "../gitbook/flatten"
import { demoBody, fenceTracker, parseBlocks, parseMarkdown } from "../gitbook/parse"
import { fenceFor, serializeBlocks, serializeMarkdown } from "../gitbook/serialize"
import type { DemoFile, DemoMeta, DemoResolver } from "./types"
import { languageForPath } from "./glob"
import { surfaceToCss } from "./surface"

export { fenceFor }

/**
 * - `"inline"` (default): every `{% demo src=… %}` keeps its tag and gains its files as
 *   inline fences (`{% demo … %}` + titled fences + `{% enddemo %}`), so the Markdown is
 *   still a docstream page: it renders back identically where the resolver exists and
 *   self-contained everywhere else.
 * - `"plain"`: for LLM prompts and plain Markdown tools — each demo becomes a bold
 *   "Example — Title" line, its description, a variants note and one titled fence per
 *   file (the pre-1.2 output); `{% command %}` boxes become npm ```` ```sh ```` fences and
 *   titled tab sets become a heading plus one bold-labelled part per tab
 *   (`flattenForPlainMarkdown`). Not renderable as docstream any more.
 */
export type DemoMarkdownFormat = "inline" | "plain"

export interface ResolveDemosOptions {
  /** Output shape. Defaults to `"inline"` (renderable docstream Markdown). */
  format?: DemoMarkdownFormat
  /** `"plain"` only: title shown on each file fence. Defaults to `<src>/<path>`. */
  filePath?: (src: string, file: DemoFile) => string
  /**
   * Markdown rendered for one demo, replacing the whole `{% demo %}` block whatever the
   * `format`. Called only for demos with files (resolved, or inline).
   */
  render?: (demo: ResolvedDemo) => string
}

export interface ResolvedDemo {
  node: DemoNode
  meta: DemoMeta | undefined
  files: DemoFile[]
  title: string
}

const TAG_RE = new RegExp(String.raw`^(\s*)\{%\s*demo(\s${TAG_ATTRS})?\s*\/?%\}\s*$`)

function titleFor(src: string, node: DemoNode, meta: DemoMeta | undefined) {
  return node.title ?? meta?.title ?? (src.split("/").pop() || src || "Demo")
}

/** The pre-1.2 "plain" rendering of one demo: prose plus titled fences. */
export function defaultDemoMarkdown(demo: ResolvedDemo, filePath?: ResolveDemosOptions["filePath"]): string {
  const { node, meta, files, title } = demo
  const description = node.description ?? meta?.description
  const variants = node.variants ?? meta?.variants
  const parts = [`**Example — ${title}**`]
  if (description) parts.push(description)
  if (variants?.length) {
    parts.push(`Variants (the \`variant\` prop): ${variants.map((v) => `\`${v.id}\`${v.label !== v.id ? ` (${v.label})` : ""}`).join(", ")}.`)
  }
  if (!files.length) parts.push(`> Demo \`${node.src}\` has no source files.`)
  for (const file of files) {
    const fence = fenceFor(file.content)
    const language = file.language ?? languageForPath(file.path) ?? ""
    const title = filePath ? filePath(node.src, file) : node.src ? `${node.src}/${file.path}` : file.path
    const body = file.content.replace(/\n+$/, "")
    parts.push(`${fence}${language} title="${title}"\n${body}\n${fence}`)
  }
  return parts.join("\n\n")
}

/** Resolver / viewer files as inline demo files: trailing newlines dropped, language filled in. */
export function toInlineFiles(files: DemoFile[]): DemoInlineFile[] {
  return files.map((file) => {
    const language = file.language ?? languageForPath(file.path)
    return { path: file.path, content: file.content.replace(/\n+$/, ""), ...(language ? { language } : {}) }
  })
}

/**
 * A demo as a self-contained block-form `{% demo %}`: the node's attributes, with the
 * folder's `meta.json` defaults folded in (so the block renders the same without the
 * resolver) — title, description, height, layout, variants, entry and the look fields
 * `status`, `bleed`, `className`, `surface` (as CSS declarations) and `variantsWidth` —
 * and `files` as inline fences. Tag attributes win over `meta.json` where both exist.
 */
export function inlineDemoNode(node: DemoNode, files: DemoFile[], meta?: DemoMeta): DemoNode {
  const inline = toInlineFiles(files)
  const height = node.height ?? (meta?.height === undefined || meta.height === "" ? undefined : String(meta.height))
  const title = node.title ?? meta?.title
  const description = node.description ?? meta?.description
  const layout = node.layout ?? meta?.layout
  const variants = node.variants?.length ? node.variants : meta?.variants?.length ? meta.variants : undefined
  const entry = node.entry ?? (meta?.entry && inline[0]?.path !== meta.entry ? meta.entry : undefined)
  const status = node.status ?? meta?.status
  const bleed = node.bleed ?? meta?.bleed
  const className = node.className ?? meta?.className
  const surface = node.surface ?? (meta?.surface ? surfaceToCss(meta.surface) : undefined)
  const variantsWidth = node.variantsWidth ?? (meta?.variantsWidth === undefined || meta.variantsWidth === "" ? undefined : String(meta.variantsWidth))
  return {
    type: "demo",
    src: node.src,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(height ? { height } : {}),
    ...(layout ? { layout } : {}),
    ...(variants ? { variants } : {}),
    ...(node.viewport ? { viewport: node.viewport } : {}),
    ...(entry ? { entry } : {}),
    ...(status ? { status } : {}),
    ...(bleed === undefined ? {} : { bleed }),
    ...(className ? { className } : {}),
    ...(surface ? { surface } : {}),
    ...(variantsWidth ? { variantsWidth } : {}),
    ...(inline.length ? { files: inline } : {}),
  }
}

/** `inlineDemoNode` serialized: `{% demo … %}` + titled fences + `{% enddemo %}`. */
export function inlineDemoMarkdown(node: DemoNode, files: DemoFile[], meta?: DemoMeta): string {
  return serializeBlocks([inlineDemoNode(node, files, meta)])
}

/**
 * Make every `{% demo %}` in a page carry its real source files (Copy page, `.md`
 * exports, llms.txt). By default the result is still docstream Markdown — see
 * `DemoMarkdownFormat`. Everything outside demo blocks is returned byte-for-byte, and
 * tags inside code fences are left alone.
 *
 * `"inline"`: blocks that already carry inline files, and demos the resolver cannot
 * resolve (or no resolver), are left exactly as written — they are valid docstream.
 * `"plain"`: unresolvable demos become a short note rather than tag syntax other tools
 * would not understand.
 */
export async function resolveDemosToMarkdown(
  markdown: string,
  resolver: DemoResolver | undefined,
  options: ResolveDemosOptions = {},
): Promise<string> {
  // Plain output also flattens docstream-only presentation blocks (command boxes, titled tabs).
  if (options.format === "plain" && /\{%\s*(?:command\b|tabs\s(?:[^%\n]|%(?!\}))*\btitle=)/.test(markdown)) {
    markdown = serializeMarkdown(flattenForPlainMarkdown(parseMarkdown(markdown)))
  }
  const lines = markdown.split("\n")
  const jobs: { index: number; end: number; indent: string; promise: Promise<string | null> }[] = []
  const fences = fenceTracker()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (fences.step(line)) continue
    const tag = line.match(TAG_RE)
    if (!tag) continue
    const indent = tag[1]
    const body = demoBody(lines, i + 1, /\/\s*%\}\s*$/.test(line))
    const end = body ? body.next : i + 1
    const block = lines.slice(i, end).map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l))
    const node = parseBlocks(block)[0]
    if (node?.type !== "demo") continue
    jobs.push({ index: i, end, indent, promise: renderDemo(node, block[0], resolver, options) })
    i = end - 1
  }
  if (!jobs.length) return markdown
  const rendered = await Promise.all(jobs.map((job) => job.promise))
  for (let j = jobs.length - 1; j >= 0; j--) {
    const out = rendered[j]
    if (out === null) continue
    const { index, end, indent } = jobs[j]
    const text = indent ? out.split("\n").map((l) => (l ? indent + l : l)).join("\n") : out
    lines.splice(index, end - index, text)
  }
  return lines.join("\n")
}

/**
 * `inlineDemoMarkdown`, but keeping the author's tag line byte-for-byte when folding in
 * `meta.json` added no attributes (only the files are new).
 */
function inlineDemoKeepingTag(tagLine: string, node: DemoNode, files: DemoFile[], meta: DemoMeta | undefined): string {
  const next = inlineDemoNode(node, files, meta)
  const out = serializeBlocks([next])
  const bare = (n: DemoNode): DemoNode => {
    const { files: _files, open: _open, ...rest } = n
    return rest
  }
  if (serializeBlocks([bare(next)]) !== serializeBlocks([bare(node)])) return out
  const tag = tagLine.trim().replace(/\s*\/\s*%\}$/, " %}")
  return tag + out.slice(out.indexOf("\n"))
}

/** The replacement for one demo block, or null to keep it byte-for-byte. */
async function renderDemo(node: DemoNode, tagLine: string, resolver: DemoResolver | undefined, options: ResolveDemosOptions): Promise<string | null> {
  const plain = options.format === "plain"
  const inlineFiles: DemoFile[] | undefined = node.files?.length ? node.files : undefined
  let meta: DemoMeta | undefined
  let files: DemoFile[] | undefined
  let failure: string | undefined
  if (resolver && node.src && !(inlineFiles && !plain && !options.render)) {
    try {
      ;[meta, files] = await Promise.all([resolver.meta(node.src), resolver.files(node.src)])
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    }
  }
  // Resolver files are the authority; inline files stand in when it cannot help.
  const chosen = files?.length ? files : inlineFiles
  if (!chosen) {
    if (!plain) return null
    if (failure !== undefined) return `> Live demo \`${node.src}\` could not be resolved: ${failure}`
    if (!resolver || !node.src) return `> Live demo \`${node.src || "?"}\` (interactive on the docs site).`
  }
  const demo: ResolvedDemo = { node, meta, files: chosen ?? [], title: titleFor(node.src, node, meta) }
  if (options.render) return options.render(demo)
  if (plain) return defaultDemoMarkdown(demo, options.filePath)
  return chosen === inlineFiles ? null : inlineDemoKeepingTag(tagLine, node, chosen!, meta)
}
