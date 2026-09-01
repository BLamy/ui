import { useState, type ReactNode } from "react"
import { LayoutGroup, motion } from "framer-motion"
import "katex/dist/katex.min.css"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  File,
  Info,
  XCircle,
} from "lucide-react"

import type { Block, DocumentNode, Inline, SourceRefNode } from "../gitbook/ast"
import { resolveAsset } from "../assets"
import { parseMarkdown } from "../gitbook/parse"
import { ReplayPreview, isReplayQaUrl } from "../replay"
import { VideoEmbed } from "../video"
import { OpenApiOperation } from "../openapi/OpenApiOperation"
import { Mermaid } from "./Mermaid"
import { HighlightedCode } from "./HighlightedCode"
import { CitationSources, InlineReference } from "./reference"
import { renderMathToHtml } from "./math"

function MathBlock({ formula }: { formula: string }) {
  return <div className="docs-math" dangerouslySetInnerHTML={{ __html: renderMathToHtml(formula) }} />
}

export interface LivePreviewProps {
  files: Record<string, string>
  entry: string
  title: string
  collapsedCodeLines?: number
  expandedCodeLines?: number
}

export type LivePreviewRenderer = (props: LivePreviewProps) => ReactNode

export type SourceReferenceRenderer = (reference: SourceRefNode) => ReactNode

function InlineText({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "reference") return <InlineReference key={i} node={n} />
        if (n.type === "image") {
          const img = (
            <img
              src={resolveAsset(n.src)}
              alt={n.alt ?? ""}
              className="docs-inline-img"
              style={{ width: n.width, height: n.height }}
            />
          )
          return n.link ? (
            <a key={i} href={n.link} target="_blank" rel="noreferrer" className="docs-inline-img-link">
              {img}
            </a>
          ) : (
            <span key={i}>{img}</span>
          )
        }
        let el: ReactNode = n.text
        if (n.code) el = <code>{el}</code>
        if (n.bold) el = <strong>{el}</strong>
        if (n.italic) el = <em>{el}</em>
        if (n.strike) el = <s>{el}</s>
        if (n.link)
          el = (
            <a href={n.link} target="_blank" rel="noreferrer">
              {el}
            </a>
          )
        return <span key={i}>{el}</span>
      })}
    </>
  )
}

const HINT_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

function embedSrc(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  return yt ? `https://www.youtube.com/embed/${yt[1]}` : null
}

function isDirectVideo(url: string): boolean {
  return /\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(url)
}

interface Renderers {
  liveRenderer?: LivePreviewRenderer
  sourceRenderer?: SourceReferenceRenderer
}

function Tabs({ block, liveRenderer, sourceRenderer }: { block: Extract<Block, { type: "tabs" }> } & Renderers) {
  const [active, setActive] = useState(0)
  return (
    <div className="docs-tabs">
      <LayoutGroup>
        <div className="docs-tabs-header" role="tablist" aria-label="Content tabs">
          {block.tabs.map((t, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={i === active ? "docs-tab-active" : ""}
              onClick={() => setActive(i)}
            >
              {i === active ? (
                <motion.span
                  className="docs-tab-indicator"
                  layoutId="docs-tab-indicator"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              ) : null}
              <span className="docs-tab-label">{t.title}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <div className="docs-tabs-body" role="tabpanel">
        <Blocks blocks={block.tabs[active]?.children ?? []} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      </div>
    </div>
  )
}

function BlockView({ block, liveRenderer, sourceRenderer }: { block: Block } & Renderers) {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <InlineText nodes={block.children} />
        </p>
      )
    case "heading": {
      const Tag = `h${block.level}` as const
      return (
        <Tag>
          <InlineText nodes={block.children} />
        </Tag>
      )
    }
    case "code":
      if (block.language === "mermaid") {
        return (
          <Mermaid
            code={block.code}
            collapsedCodeLines={block.collapsedCodeLines}
            expandedCodeLines={block.expandedCodeLines}
          />
        )
      }
      if (block.live && isReactLanguage(block.language) && liveRenderer) {
        const entry = block.entry ?? "/src/main.jsx"
        return liveRenderer({
          files: { [entry]: block.code },
          entry,
          title: block.title ?? "Live React preview",
          collapsedCodeLines: block.collapsedCodeLines,
          expandedCodeLines: block.expandedCodeLines,
        })
      }
      return (
        <div className="docs-code">
          {(block.title || block.language) && (
            <div className="docs-code-header">
              <span>{block.title}</span>
              <span className="docs-code-lang">{block.language}</span>
            </div>
          )}
          <pre className={block.lineNumbers ? "docs-code-numbered" : ""}>
            <HighlightedCode
              code={block.code}
              language={block.language}
              lineNumbers={block.lineNumbers}
            />
          </pre>
        </div>
      )
    case "hint": {
      const Icon = HINT_ICONS[block.style] ?? Info
      return (
        <div className={`docs-hint docs-hint-${block.style}`}>
          <Icon className="docs-hint-icon" />
          <div>
            <Blocks blocks={block.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
          </div>
        </div>
      )
    }
    case "tabs":
      return <Tabs block={block} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
    case "expandable":
      return (
        <details className="docs-expandable">
          <summary>{block.summary}</summary>
          <div className="docs-expandable-body">
            <Blocks blocks={block.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
          </div>
        </details>
      )
    case "stepper":
      return (
        <div className="docs-stepper">
          {block.steps.map((s, i) => (
            <div key={i} className="docs-step">
              <div className="docs-step-rail">
                <div className="docs-step-badge">{i + 1}</div>
                {i < block.steps.length - 1 && <div className="docs-step-line" />}
              </div>
              <div className="docs-step-main">
                {s.title && <div className="docs-step-title">{s.title}</div>}
                <Blocks blocks={s.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
              </div>
            </div>
          ))}
        </div>
      )
    case "embed": {
      if (isReplayQaUrl(block.url)) {
        return <ReplayPreview source={block.url} title="Replay preview" />
      }
      const src = embedSrc(block.url)
      return src || isDirectVideo(block.url) ? (
        <VideoEmbed
          src={src ?? block.url}
          className="docs-embed"
          title={block.title ?? block.url}
          {...(block.autoplay === undefined ? {} : { autoplay: block.autoplay })}
          {...(block.loop === undefined ? {} : { loop: block.loop })}
          {...(block.muted === undefined ? {} : { muted: block.muted })}
          {...(block.controls === undefined ? {} : { controls: block.controls })}
          {...(block.poster === undefined ? {} : { poster: resolveAsset(block.poster) })}
        />
      ) : (
        <a className="docs-content-ref" href={block.url} target="_blank" rel="noreferrer">
          <File className="size-4" /> {block.url}
        </a>
      )
    }
    case "content-ref":
      return (
        <a className="docs-content-ref" href={block.url}>
          <File className="size-4" />
          <span>
            <InlineText nodes={block.children} />
          </span>
          <ChevronRight className="size-4 ml-auto" />
        </a>
      )
    case "source-ref":
      return sourceRenderer ? (
        sourceRenderer(block)
      ) : (
        <div className="docs-source-ref" data-docstream-source-ref="">
          <File className="size-4" />
          <span>{block.title ?? `${block.path}#${block.exportName}`}</span>
          <code>{block.mount}:{block.path}</code>
        </div>
      )
    case "columns":
      return (
        <div className="docs-columns">
          {block.columns.map((c, i) => (
            <div key={i} className="docs-column">
              <Blocks blocks={c.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
            </div>
          ))}
        </div>
      )
    case "figure":
      return (
        <figure className="docs-figure">
          {block.src && <img src={resolveAsset(block.src)} alt={block.alt} />}
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      )
    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag className={block.task ? "docs-tasklist" : undefined}>
          {block.items.map((item, i) => (
            <li key={i}>
              {block.task && <input type="checkbox" checked={!!item.checked} readOnly />}
              <Blocks blocks={item.children} inline liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
            </li>
          ))}
        </Tag>
      )
    }
    case "blockquote":
      return (
        <blockquote>
          <Blocks blocks={block.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
        </blockquote>
      )
    case "divider":
      return <hr />
    case "table":
      if (block.view === "cards") {
        const cards = block.rows.length ? block.rows : [block.header]
        return (
          <div className="docs-cards">
            {cards.map((row, i) => (
              <div key={i} className="docs-card">
                {row.map((cell, j) => (
                  <div key={j} className={j === 0 ? "docs-card-title" : "docs-card-body"}>
                    <InlineText nodes={cell} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      }
      return (
        <table className="docs-table">
          <thead>
            <tr>
              {block.header.map((cell, i) => (
                <th key={i}>
                  <InlineText nodes={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>
                    <InlineText nodes={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case "math":
      return <MathBlock formula={block.formula} />
    case "updates":
      return (
        <div className="docs-updates">
          {block.updates.map((u, i) => (
            <div key={i} className="docs-update">
              <div className="docs-update-date">{u.date}</div>
              <div className="docs-update-body">
                <Blocks blocks={u.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
              </div>
            </div>
          ))}
        </div>
      )
    case "openapi-operation":
      return (
        <OpenApiOperation
          specUrl={block.specUrl}
          path={block.path}
          method={block.method || "get"}
        />
      )
  }
}

function isReactLanguage(language: string | null): boolean {
  return language === "jsx" || language === "tsx" || language === "react"
}

function Blocks({ blocks, inline, liveRenderer, sourceRenderer }: { blocks: Block[]; inline?: boolean } & Renderers) {
  return (
    <div className={inline ? "docs-blocks-inline" : undefined} style={inline ? { display: "inline" } : undefined}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      ))}
    </div>
  )
}

// Renders a markdown string inline — used for embedded markdown like
// OpenAPI descriptions, which can themselves contain GitBook blocks.
export function MarkdownContent({
  markdown,
  liveRenderer,
  sourceRenderer,
  className,
}: { markdown: string; className?: string } & Renderers) {
  const doc = parseMarkdown(markdown)
  return (
    <div data-docstream="" className={className}>
      <Blocks blocks={doc.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      <CitationSources citations={doc.citations} />
    </div>
  )
}

export function DocsRenderer({ doc, liveRenderer, sourceRenderer }: { doc: DocumentNode } & Renderers) {
  return (
    <article className="docs-article">
      <Blocks blocks={doc.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      <CitationSources citations={doc.citations} />
    </article>
  )
}
