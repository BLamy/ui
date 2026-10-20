import { useContext, useEffect, useId, useMemo, useState, type ComponentProps, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  File,
  Info,
  Terminal,
  XCircle,
} from "lucide-react"

import type { Block, CodeBlockNode, CommandNode, DocumentNode, Inline, PackageManager, SourceRefNode } from "../gitbook/ast"
import { PACKAGE_MANAGERS, packageManagerCommands } from "../gitbook/package-managers"
import { slugify } from "../gitbook/outline"
import { resolveAsset, useAsset } from "../assets"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { DocstreamDemoContext, DocstreamDemoRuntimeContext, DocstreamDemoVFSContext } from "../demo/context"
import type { DemoVFS } from "../demo/vfs"
import { DemoBlock } from "../demo/DemoViewer"
import type { DemoResolver, InlineDemoRuntime } from "../demo/types"
import { CopyButton } from "./copy"
import { SplitCard, SplitResult, SplitSource } from "./SplitCard"
import { PillTabs, rovingKeyDown } from "./controls"
import { DocPageActions, type DocPageActionsOptions } from "./PageActions"
import { useSyncedTab } from "./tabs-sync"
import { ReplayPreview } from "../replay/ReplayPreview"
import { isReplayQaUrl } from "../replay/url"
import { ReplayFile, isRrwebUrl } from "../replay/ReplayFile"
import { VideoEmbed } from "../video"
import { StlViewer, isStlUrl } from "../stl"
import { StrudelPlayer } from "../strudel/StrudelPlayer"
import { isStrudelFile, isStrudelLanguage } from "../strudel/url"
import { OpenApiOperation } from "../openapi/OpenApiOperation"
import { Mermaid } from "./Mermaid"
import { HighlightedCode } from "./HighlightedCode"
import { CitationSources, InlineReference } from "./reference"
import { DocumentProperties } from "./DocumentProperties"
import { TaskCheckbox, TaskStateChangeContext, type TaskStateChangeHandler } from "./TaskCheckbox"
import { getTaskState } from "../gitbook/tasks"
import { plainText } from "../gitbook/inline"

type MathRenderer = (formula: string) => string
let mathRenderer: MathRenderer | null = null
let mathLoad: Promise<MathRenderer> | null = null
function loadMathRenderer(): Promise<MathRenderer> {
  mathLoad ??= import("./math").then((m) => (mathRenderer = m.renderMathToHtml))
  return mathLoad
}

/** A formula typeset by KaTeX, which loads on first use; until then the TeX shows in its place. */
export function MathFormula({ formula }: { formula: string }) {
  const [render, setRender] = useState<MathRenderer | null>(() => mathRenderer)
  useEffect(() => {
    if (render) return
    let live = true
    loadMathRenderer().then((fn) => live && setRender(() => fn), () => {})
    return () => {
      live = false
    }
  }, [render])
  return render ? (
    <div className="docs-math" dangerouslySetInnerHTML={{ __html: render(formula) }} />
  ) : (
    <div className="docs-math" data-pending="">
      <code>{formula}</code>
    </div>
  )
}

// A math block is a card: the TeX on the left, KaTeX's typesetting on the right (stacked when narrow).
function MathBlock({ formula }: { formula: string }) {
  return (
    <SplitCard className="docs-math-card" data-docstream-math="">
      <SplitSource label="LaTeX" code={formula} language="latex" />
      <SplitResult label="KaTeX">
        <MathFormula formula={formula} />
      </SplitResult>
    </SplitCard>
  )
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
        const emphasized = !!(n.bold || n.italic || n.strike)
        let el: ReactNode
        if (n.type === "reference") {
          if (!emphasized && !n.link) return <InlineReference key={i} node={n} />
          el = <InlineReference node={n} />
        } else if (n.type === "image") {
          const img = (
            <AssetImg
              url={n.src}
              alt={n.alt ?? ""}
              className="docs-inline-img"
              style={{ width: n.width, height: n.height }}
            />
          )
          const linked = n.link ? (
            <a key={i} href={n.link} target="_blank" rel="noreferrer" className="docs-inline-img-link">
              {img}
            </a>
          ) : null
          if (!emphasized) return linked ?? <span key={i}>{img}</span>
          // The image's link is its own anchor; emphasis wraps it.
          el = linked ?? img
          if (n.bold) el = <strong>{el}</strong>
          if (n.italic) el = <em>{el}</em>
          if (n.strike) el = <s>{el}</s>
          return <span key={i}>{el}</span>
        } else el = n.text
        if (n.type === "text" && n.code) el = <code>{el}</code>
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

const SHELL_LANGUAGES = new Set(["sh", "bash", "shell", "zsh", "console", "shellsession", "powershell", "ps1", "bat", "cmd"])

/** A tab set whose every tab is exactly one code block renders as one code block with tabs in its header. */
function codeOnlyTabs(block: Extract<Block, { type: "tabs" }>): CodeBlockNode[] | null {
  if (!block.tabs.length) return null
  const codes: CodeBlockNode[] = []
  for (const tab of block.tabs) {
    const only = tab.children.length === 1 ? tab.children[0] : null
    if (!only || only.type !== "code" || only.live || only.language === "mermaid" || isStrudelLanguage(only.language)) return null
    codes.push(only)
  }
  return codes
}

/** The underline tab strip shared by tab sets and command boxes. */
function TabStrip({ titles, active, onSelect, label, baseId }: {
  titles: string[]
  active: number
  onSelect: (index: number) => void
  label: string
  baseId: string
}) {
  const reduced = useReducedMotion()
  const ids = titles.map((_, i) => String(i))
  return (
    <div
      className="docs-tabs-header"
      role="tablist"
      aria-label={label}
      onKeyDown={(event) => rovingKeyDown(event, ids, String(active), (id) => onSelect(Number(id)))}
    >
      {titles.map((title, i) => (
        <button
          key={i}
          id={`${baseId}-tab-${i}`}
          type="button"
          role="tab"
          data-roving=""
          aria-selected={i === active}
          aria-controls={`${baseId}-panel`}
          tabIndex={i === active ? 0 : -1}
          className={i === active ? "docs-tab-active" : ""}
          onClick={() => onSelect(i)}
        >
          {i === active ? (
            <motion.span
              className="docs-tab-indicator"
              layoutId={`docs-tab-indicator-${baseId}`}
              transition={reduced ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          ) : null}
          <span className="docs-tab-label">{title}</span>
        </button>
      ))}
    </div>
  )
}

/** `{% command %}`: one npm command, shown for the reader's package manager (synced page-wide). */
function CommandBox({ block }: { block: CommandNode }) {
  const [synced, setSynced] = useSyncedTab(block.sync ?? "pm")
  const [local, setLocal] = useState<PackageManager>(PACKAGE_MANAGERS[0])
  const active: PackageManager = synced && (PACKAGE_MANAGERS as readonly string[]).includes(synced) ? (synced as PackageManager) : local
  const commands = useMemo(() => packageManagerCommands(block.command, block.overrides), [block.command, block.overrides])
  const baseId = useId()
  const index = PACKAGE_MANAGERS.indexOf(active)
  const select = (i: number) => {
    const pm = PACKAGE_MANAGERS[i]
    setLocal(pm)
    setSynced(pm)
  }
  return (
    <div className="docs-tabs docs-tabs-code docs-command" data-sync={block.sync ?? "pm"} data-pm={active}>
      <div className="docs-tabs-code-head">
        <span className="docs-tabs-code-term" aria-hidden="true">
          <Terminal width={12} height={12} strokeWidth={2.4} />
        </span>
        <TabStrip titles={[...PACKAGE_MANAGERS]} active={index} onSelect={select} label="Package manager" baseId={baseId} />
        <span className="docs-tabs-code-title" />
        <CopyButton text={commands[active]} label={`Copy ${active} command`} />
      </div>
      <div className="docs-tabs-code-body" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${index}`}>
        <pre>
          <HighlightedCode code={commands[active]} language="sh" lineNumbers={false} />
        </pre>
      </div>
    </div>
  )
}

function Tabs({ block, liveRenderer, sourceRenderer }: { block: Extract<Block, { type: "tabs" }> } & Renderers) {
  const [local, setLocal] = useState(0)
  const [synced, setSynced] = useSyncedTab(block.sync)
  const syncedIndex = synced === null ? -1 : block.tabs.findIndex((t) => t.title === synced)
  const active = Math.min(syncedIndex >= 0 ? syncedIndex : local, Math.max(0, block.tabs.length - 1))
  const baseId = useId()
  const codes = useMemo(() => codeOnlyTabs(block), [block])
  const select = (index: number) => {
    setLocal(index)
    const title = block.tabs[index]?.title
    if (block.sync && title !== undefined) setSynced(title)
  }
  const header = (
    <TabStrip
      titles={block.tabs.map((t) => t.title)}
      active={active}
      onSelect={select}
      label={block.sync ? `${block.sync} options` : "Content tabs"}
      baseId={baseId}
    />
  )

  if (block.title) {
    const Heading = `h${block.level ?? 2}` as const
    const headingId = slugify(block.title)
    return (
      <section className="docs-tabs-section" data-sync={block.sync} aria-labelledby={headingId}>
        <div className="docs-tabs-section-head">
          <Heading id={headingId} className="docs-tabs-section-title">{block.title}</Heading>
          <PillTabs
            options={block.tabs.map((t, i) => ({ id: String(i), label: t.title }))}
            value={String(active)}
            onChange={(id) => select(Number(id))}
            label={`${block.title}: ${block.sync ? `${block.sync} options` : "options"}`}
            tabId={(id) => `${baseId}-tab-${id}`}
            panelId={() => `${baseId}-panel`}
          />
        </div>
        <div className="docs-tabs-section-body" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
          <Blocks blocks={block.tabs[active]?.children ?? []} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
        </div>
      </section>
    )
  }

  if (codes) {
    const code = codes[active]
    const shell = codes.every((c) => c.language && SHELL_LANGUAGES.has(c.language.toLowerCase()))
    const numbered = code.lineNumbers && code.code.includes("\n") && !shell
    return (
      <div className="docs-tabs docs-tabs-code" data-sync={block.sync}>
        <div className="docs-tabs-code-head">
          {shell ? (
            <span className="docs-tabs-code-term" aria-hidden="true">
              <Terminal width={12} height={12} strokeWidth={2.4} />
            </span>
          ) : null}
          {header}
          <span className="docs-tabs-code-title">{code.title}</span>
          <CopyButton text={code.code} label={`Copy ${block.tabs[active]?.title ?? "code"}`} />
        </div>
        <div className="docs-tabs-code-body" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
          <pre className={numbered ? "docs-code-numbered" : ""}>
            <HighlightedCode code={code.code} language={code.language} lineNumbers={numbered} />
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="docs-tabs" data-sync={block.sync}>
      {header}
      <div className="docs-tabs-body" role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`}>
        <Blocks blocks={block.tabs[active]?.children ?? []} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      </div>
    </div>
  )
}

function BlockView({ block, liveRenderer, sourceRenderer }: { block: Block } & Renderers) {
  const onTaskStateChange = useContext(TaskStateChangeContext)
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
      if (isStrudelLanguage(block.language)) {
        return <StrudelPlayer code={block.code} {...(block.title ? { title: block.title } : {})} />
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
        <div className="docs-code" data-language={block.language ?? undefined}>
          {/* A header bar only when there's a title (file name) to show; otherwise just the code
              with a floating copy button. */}
          {block.title ? (
            <div className="docs-code-header">
              <span>{block.title}</span>
              <span className="docs-code-lang">{block.language}</span>
              <CopyButton text={block.code} label={`Copy ${block.title}`} />
            </div>
          ) : (
            <CopyButton text={block.code} className="docs-code-copy-float" />
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
    case "command":
      return block.command ? <CommandBox block={block} /> : null
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
      if (isRrwebUrl(block.url)) {
        return <ReplayFile url={block.url} title={block.title || fileName(block.url)} />
      }
      if (isStlUrl(block.url)) {
        return <AssetStl url={block.url} {...(block.title ? { title: block.title } : {})} />
      }
      if (isStrudelFile(block.url)) {
        return <AssetStrudel url={block.url} {...(block.title ? { title: block.title } : {})} />
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
    case "demo":
      return <DemoBlock node={block} />
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
          {block.src && <AssetImg url={block.src} alt={block.alt} />}
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      )
    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag className={block.task ? "docs-tasklist" : undefined}>
          {block.items.map((item, i) => (
            <li key={i} data-task-state={block.task ? getTaskState(item) : undefined}>
              {block.task && <TaskCheckbox state={getTaskState(item)} label={item.children.filter((b) => b.type === "paragraph").map((b) => b.type === "paragraph" ? plainText(b.children) : "").join(" ") || "Task"}
                onChange={onTaskStateChange ? (state) => onTaskStateChange(item, state) : undefined} />}
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
    // Reference definitions and verbatim-kept tags carry no content of their own.
    case "definition":
    case "raw":
      return null
  }
}

function isReactLanguage(language: string | null): boolean {
  return language === "jsx" || language === "tsx" || language === "react"
}

function Blocks({ blocks, inline, liveRenderer, sourceRenderer }: { blocks: Block[]; inline?: boolean } & Renderers) {
  return (
    <div
      data-docstream-blocks=""
      className={inline ? "docs-blocks-inline" : undefined}
      style={inline ? { display: "inline" } : undefined}
    >
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      ))}
    </div>
  )
}

export interface DocRenderOptions {
  /** Make rendered task checkboxes interactive. Update the supplied item and re-render to persist a choice. */
  onTaskStateChange?: TaskStateChangeHandler
  /** Show the document's frontmatter as a property sheet (default true). */
  documentProperties?: boolean | { defaultOpen?: boolean }
  /** Resolves `{% demo %}` blocks. Provided through context, so nested renderers inherit it. */
  demoResolver?: DemoResolver
  /**
   * Runs the Preview of `{% demo %}` blocks that carry their files inline and have no
   * resolver behind them. Nothing is supplied by default: pass `createAlmostNodeDemoRuntime()`
   * from `@brett_lamy/docstream/playground` (or use its `PlaygroundStreamdown`) to run them.
   * Without one, such demos show their code with a short note.
   */
  demoRuntime?: InlineDemoRuntime
  /** Extra npm dependencies inline demos may import (`{ "@brett_lamy/ui": "^1.2.0" }`). */
  demoDependencies?: Record<string, string>
  /**
   * Demo files held in memory by `src` (`createDemoVFS` / `useDemoVFS`), e.g. demos pasted
   * into an editor. Blocks without inline files use them when no resolver knows `src`.
   */
  demoVFS?: DemoVFS
  /**
   * Render "Copy page ▾" (Copy / View as Markdown, Open in ChatGPT / Claude) above the content.
   * `true` uses the defaults; an object passes options to `DocPageActions`.
   */
  pageActions?: boolean | DocPageActionsOptions
}

function withDemoContext({ demoResolver, demoRuntime, demoDependencies, demoVFS, onTaskStateChange }: DocRenderOptions, children: ReactNode) {
  let out = children
  if (onTaskStateChange) out = <TaskStateChangeContext.Provider value={onTaskStateChange}>{out}</TaskStateChangeContext.Provider>
  if (demoVFS) out = <DocstreamDemoVFSContext.Provider value={demoVFS}>{out}</DocstreamDemoVFSContext.Provider>
  if (demoRuntime || demoDependencies) {
    out = <DemoRuntimeProvider runtime={demoRuntime} dependencies={demoDependencies}>{out}</DemoRuntimeProvider>
  }
  return demoResolver ? <DocstreamDemoContext.Provider value={demoResolver}>{out}</DocstreamDemoContext.Provider> : out
}

/** Merges runtime options over the inherited ones, keeping a stable context value. */
function DemoRuntimeProvider({ runtime, dependencies, children }: { runtime?: InlineDemoRuntime; dependencies?: Record<string, string>; children: ReactNode }) {
  const inherited = useContext(DocstreamDemoRuntimeContext)
  const depsKey = dependencies ? JSON.stringify(dependencies) : ""
  const value = useMemo(
    () => ({
      runtime: runtime ?? inherited.runtime,
      dependencies: dependencies || inherited.dependencies ? { ...inherited.dependencies, ...dependencies } : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runtime, inherited, depsKey],
  )
  return <DocstreamDemoRuntimeContext.Provider value={value}>{children}</DocstreamDemoRuntimeContext.Provider>
}

export function PageActionsBar({ markdown, options }: { markdown: string | (() => string); options: boolean | DocPageActionsOptions | undefined }) {
  if (!options) return null
  return (
    <div className="docs-page-actions-bar">
      <DocPageActions markdown={markdown} {...(options === true ? {} : options)} />
    </div>
  )
}

// Renders a markdown string inline — used for embedded markdown like
// OpenAPI descriptions, which can themselves contain GitBook blocks.
export function MarkdownContent({
  markdown,
  liveRenderer,
  sourceRenderer,
  demoResolver,
  demoRuntime,
  demoDependencies,
  demoVFS,
  pageActions,
  className,
  documentProperties = true,
  onTaskStateChange,
}: { markdown: string; className?: string } & Renderers & DocRenderOptions) {
  const doc = useMemo(() => parseMarkdown(markdown), [markdown])
  return withDemoContext(
    { demoResolver, demoRuntime, demoDependencies, demoVFS, onTaskStateChange },
    <div data-docstream="" className={className}>
      <PageActionsBar markdown={markdown} options={pageActions} />
      {documentProperties && doc.properties ? <DocumentProperties properties={doc.properties} defaultOpen={typeof documentProperties === "object" && documentProperties.defaultOpen} /> : null}
      <Blocks blocks={doc.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      <CitationSources citations={doc.citations} />
    </div>,
  )
}

export function DocsRenderer({
  doc,
  liveRenderer,
  sourceRenderer,
  demoResolver,
  demoRuntime,
  demoDependencies,
  demoVFS,
  pageActions,
  markdown,
  documentProperties = true,
  onTaskStateChange,
}: { doc: DocumentNode; /** Source for page actions; defaults to `serializeMarkdown(doc)`. */ markdown?: string } & Renderers & DocRenderOptions) {
  return withDemoContext(
    { demoResolver, demoRuntime, demoDependencies, demoVFS, onTaskStateChange },
    <article className="docs-article">
      <PageActionsBar markdown={markdown ?? (() => serializeMarkdown(doc))} options={pageActions} />
      {documentProperties && doc.properties ? <DocumentProperties properties={doc.properties} defaultOpen={typeof documentProperties === "object" && documentProperties.defaultOpen} /> : null}
      <Blocks blocks={doc.children} liveRenderer={liveRenderer} sourceRenderer={sourceRenderer} />
      <CitationSources citations={doc.citations} />
    </article>,
  )
}

// Assets go through the host's resolver (AssetResolverProvider) when there is one.
function AssetImg({ url, ...props }: { url: string } & Omit<ComponentProps<"img">, "src">) {
  const src = useAsset(url)
  return <img src={src} {...props} />
}

// A resolved URL (blob:) has no file name in it: the title falls back to the one written in the document.
const fileName = (url: string) => url.split(/[?#]/)[0]!.split("/").pop() || url

function AssetStl({ url, title }: { url: string; title?: string }) {
  const src = useAsset(url)
  return src === undefined ? <div className="docstream-asset-pending" aria-busy="true" /> : <StlViewer src={src} title={title || fileName(url)} />
}

function AssetStrudel({ url, title }: { url: string; title?: string }) {
  const src = useAsset(url)
  return src === undefined ? <div className="docstream-asset-pending" aria-busy="true" /> : <StrudelPlayer src={src} title={title || fileName(url)} />
}
