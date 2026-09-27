import type { DemoNode } from "../gitbook/ast"
import { parseMarkdown } from "../gitbook/parse"
import type { DemoFile, DemoMeta, DemoResolver } from "./types"
import { languageForPath } from "./glob"

export interface ResolveDemosOptions {
  /** Title shown on each file fence. Defaults to `<src>/<path>`. */
  filePath?: (src: string, file: DemoFile) => string
  /**
   * Markdown rendered for one demo. The default is a bold "Example — Title" line,
   * the description, a variants note, then one titled fence per file (entry first).
   */
  render?: (demo: ResolvedDemo) => string
}

export interface ResolvedDemo {
  node: DemoNode
  meta: DemoMeta | undefined
  files: DemoFile[]
  title: string
}

const TAG_RE = /^\s*\{%\s*demo(\s[^%]*?)?\s*\/?%\}\s*$/
const END_RE = /^\s*\{%\s*enddemo\s*%\}\s*$/

/** A fence longer than any backtick run in the content, so nested fences survive. */
export function fenceFor(content: string): string {
  const longest = Math.max(2, ...[...content.matchAll(/`+/g)].map((m) => m[0].length))
  return "`".repeat(longest + 1)
}

function titleFor(src: string, node: DemoNode, meta: DemoMeta | undefined) {
  return node.title ?? meta?.title ?? src.split("/").pop() ?? src
}

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
    const title = filePath ? filePath(node.src, file) : `${node.src}/${file.path}`
    const body = file.content.replace(/\n+$/, "")
    parts.push(`${fence}${language} title="${title}"\n${body}\n${fence}`)
  }
  return parts.join("\n\n")
}

/**
 * Replace every `{% demo %}` tag with the demo's real source files as titled
 * fences, so the Markdown is self-contained (Copy page, `.md` exports, llms.txt).
 * Everything else is returned byte-for-byte; tags inside code fences are left alone.
 * Without a resolver, or for demos the resolver cannot find, tags are replaced by
 * a short note rather than left as syntax other tools would not understand.
 */
export async function resolveDemosToMarkdown(
  markdown: string,
  resolver: DemoResolver | undefined,
  options: ResolveDemosOptions = {},
): Promise<string> {
  const lines = markdown.split("\n")
  const jobs: { index: number; drop: number; promise: Promise<string> }[] = []
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const opener = line.match(/^\s*(`{3,}|~{3,})/)
    if (opener) {
      if (!fence) fence = opener[1]
      else if (line.trim().startsWith(fence[0].repeat(fence.length)) && line.trim().replace(/[`~]/g, "") === "") fence = null
      continue
    }
    if (fence || !TAG_RE.test(line)) continue
    const node = parseMarkdown(line.trim()).children[0]
    if (node?.type !== "demo") continue
    const drop = END_RE.test(lines[i + 1] ?? "") ? 1 : 0
    jobs.push({ index: i, drop, promise: renderDemo(node, resolver, options) })
  }
  if (!jobs.length) return markdown
  const rendered = await Promise.all(jobs.map((job) => job.promise))
  for (let j = jobs.length - 1; j >= 0; j--) {
    lines.splice(jobs[j].index, 1 + jobs[j].drop, rendered[j])
  }
  return lines.join("\n")
}

async function renderDemo(node: DemoNode, resolver: DemoResolver | undefined, options: ResolveDemosOptions): Promise<string> {
  if (!resolver || !node.src) return `> Live demo \`${node.src || "?"}\` (interactive on the docs site).`
  try {
    const [meta, files] = await Promise.all([resolver.meta(node.src), resolver.files(node.src)])
    const demo: ResolvedDemo = { node, meta, files, title: titleFor(node.src, node, meta) }
    return options.render ? options.render(demo) : defaultDemoMarkdown(demo, options.filePath)
  } catch (error) {
    return `> Live demo \`${node.src}\` could not be resolved: ${error instanceof Error ? error.message : String(error)}`
  }
}
