import type { Block, DocumentNode, Inline, ListItemNode } from "./ast"
import { serializeInline, serializeReference } from "./inline"

export function serializeMarkdown(doc: DocumentNode): string {
  let out = serializeBlocks(doc.children).trimEnd()
  if (doc.citations?.length) {
    const defs = doc.citations
      .map((c) => `[^${c.id}]: ${c.url}${c.label ? ` "${c.label}"` : ""}`)
      .join("\n")
    out = out ? `${out}\n\n${defs}` : defs
  }
  return out + "\n"
}

export function serializeBlocks(blocks: Block[]): string {
  return blocks.map(serializeBlock).join("\n\n")
}

function indent(s: string, pad: string): string {
  return s
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n")
}

function serializeBlock(b: Block): string {
  switch (b.type) {
    case "paragraph":
      return serializeInline(b.children)

    case "heading": {
      const inline = serializeInline(b.children)
      return inline ? `${"#".repeat(b.level)} ${inline}` : "#".repeat(b.level)
    }

    case "code": {
      const attrs = [
        b.title ? `title="${b.title}"` : "",
        !b.lineNumbers ? `lineNumbers="false"` : "",
        b.live ? `live="true"` : "",
        b.entry ? `entry="${b.entry}"` : "",
        b.collapsedCodeLines ? `collapsedCodeLines="${b.collapsedCodeLines}"` : "",
        b.expandedCodeLines ? `expandedCodeLines="${b.expandedCodeLines}"` : "",
      ].filter(Boolean)
      const info = [b.language ?? "", ...attrs].filter(Boolean).join(" ")
      return `\`\`\`${info}\n${b.code}\n\`\`\``
    }

    case "hint":
      return `{% hint style="${b.style}" %}\n${serializeBlocks(b.children)}\n{% endhint %}`

    case "tabs":
      return `{% tabs${b.sync ? ` sync="${b.sync}"` : ""} %}\n${b.tabs
        .map((t) => `{% tab title="${t.title}" %}\n${serializeBlocks(t.children)}\n{% endtab %}`)
        .join("\n\n")}\n{% endtabs %}`

    case "expandable":
      return `<details>\n\n<summary>${b.summary}</summary>\n\n${serializeBlocks(b.children)}\n\n</details>`

    case "stepper":
      return `{% stepper %}\n${b.steps
        .map((s) => {
          const title = s.title ? `### ${s.title}\n\n` : ""
          return `{% step %}\n${title}${serializeBlocks(s.children)}\n{% endstep %}`
        })
        .join("\n\n")}\n{% endstepper %}`

    case "embed": {
      const attrs = [
        ` url="${b.url}"`,
        b.title ? ` title="${b.title}"` : "",
        b.poster ? ` poster="${b.poster}"` : "",
        b.autoplay === undefined ? "" : ` autoplay="${b.autoplay}"`,
        b.loop === undefined ? "" : ` loop="${b.loop}"`,
        b.muted === undefined ? "" : ` muted="${b.muted}"`,
        b.controls === undefined ? "" : ` controls="${b.controls}"`,
      ].join("")
      return `{% embed${attrs} %}`
    }

    case "content-ref":
      return `{% content-ref url="${b.url}" %}\n${serializeInline(b.children)}\n{% endcontent-ref %}`

    case "source-ref": {
      const attrs = [
        ` mount="${b.mount}"`,
        ` path="${b.path}"`,
        ` export="${b.exportName}"`,
        ` kind="${b.kind}"`,
        b.title ? ` title="${b.title}"` : "",
      ].join("")
      return `{% source-ref${attrs} %}`
    }

    case "demo": {
      const attrs = [
        ` src="${b.src}"`,
        b.title ? ` title="${b.title}"` : "",
        b.description ? ` description="${b.description}"` : "",
        b.height ? ` height="${b.height}"` : "",
        b.layout ? ` layout="${b.layout}"` : "",
        b.variants?.length
          ? ` variants="${b.variants.map((v) => (v.label === v.id ? v.id : `${v.id}:${v.label}`)).join(",")}"`
          : "",
        b.viewport ? ` viewport="${b.viewport}"` : "",
      ].join("")
      return `{% demo${attrs} %}`
    }

    case "columns":
      return `{% columns %}\n${b.columns
        .map((c) => `{% column %}\n${serializeBlocks(c.children)}\n{% endcolumn %}`)
        .join("\n\n")}\n{% endcolumns %}`

    case "figure": {
      const alt = b.alt ? ` alt="${b.alt}"` : ' alt=""'
      const cap = b.caption ? `<figcaption><p>${b.caption}</p></figcaption>` : "<figcaption></figcaption>"
      return `<figure><img src="${b.src}"${alt}>${cap}</figure>`
    }

    case "list":
      return b.items.map((item, idx) => serializeListItem(item, b.ordered, b.task, idx)).join("\n")

    case "blockquote":
      return serializeBlocks(b.children)
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n")

    case "divider":
      return "---"

    case "table": {
      if (b.view) {
        const cellHtml = (c: Inline[]) => inlineToHtml(c)
        const head = `<thead><tr>${b.header.map((c) => `<th>${cellHtml(c)}</th>`).join("")}</tr></thead>`
        const body = `<tbody>${b.rows
          .map((r) => `<tr>${r.map((c) => `<td>${cellHtml(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody>`
        return `<table data-view="${b.view}">${head}${body}</table>`
      }
      // Escape pipes inside cell text so they don't break the GFM row.
      const cell = (c: Inline[]) => serializeInline(c).replace(/\|/g, "\\|")
      const row = (cells: Inline[][]) => `| ${cells.map(cell).join(" | ")} |`
      const sep = `| ${b.header.map(() => "---").join(" | ")} |`
      return [row(b.header), sep, ...b.rows.map(row)].join("\n")
    }

    case "math":
      return `$$\n${b.formula}\n$$`

    case "updates":
      return `{% updates${b.format ? ` format="${b.format}"` : ""} %}\n${b.updates
        .map(
          (u) =>
            `{% update date="${u.date}" %}\n${serializeBlocks(u.children)}\n{% endupdate %}`
        )
        .join("\n\n")}\n{% endupdates %}`

    case "openapi-operation": {
      const attrs = [
        b.spec ? ` spec="${b.spec}"` : "",
        b.path ? ` path="${b.path}"` : "",
        b.method ? ` method="${b.method}"` : "",
      ].join("")
      const inner = b.specUrl ? `\n[${b.label || b.spec || "OpenAPI"}](${b.specUrl})` : ""
      return `{% openapi-operation${attrs} %}${inner}\n{% endopenapi-operation %}`
    }
  }
}

function inlineToHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === "image") {
        const img = `<img src="${n.src}"${n.alt ? ` alt="${n.alt}"` : ""}>`
        return n.link ? `<a href="${n.link}">${img}</a>` : img
      }
      // HTML card tables round-trip through htmlToInlineMd, which strips
      // tags — plain markers are the only representation that survives.
      if (n.type === "reference") return serializeReference(n)
      let s = n.text
      if (n.code) s = `<code>${s}</code>`
      if (n.bold) s = `<strong>${s}</strong>`
      if (n.italic) s = `<em>${s}</em>`
      if (n.link) s = `<a href="${n.link}">${s}</a>`
      return s
    })
    .join("")
}

function serializeListItem(item: ListItemNode, ordered: boolean, task: boolean, idx: number): string {
  const bullet = ordered ? `${idx + 1}.` : "-"
  const check = task ? `[${item.checked ? "x" : " "}] ` : ""
  const [first, ...rest] = item.children
  const firstText = first?.type === "paragraph" ? serializeInline(first.children) : first ? serializeBlock(first) : ""
  const restText = rest.length ? "\n" + indent(serializeBlocks(rest), "  ") : ""
  return `${bullet} ${check}${firstText}${restText}`
}
