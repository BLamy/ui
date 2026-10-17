import { Node, mergeAttributes } from "@tiptap/core"
import { CodeBlock } from "@tiptap/extension-code-block"
import { gpuHighlightPlugin } from "./gpu-highlight"
import { useEffect, useMemo, useState } from "react"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import {
  AlertTriangle,
  AppWindow,
  AtSign,
  CheckCircle2,
  ChevronDown,
  FolderGit2,
  FolderOpen,
  Hash,
  Heading,
  Info,
  Link2,
  FileCode2,
  GripVertical,
  Plus,
  X,
  XCircle,
} from "lucide-react"

// The root entry (unlike `/replay`) keeps rrweb behind a dynamic import. The editor never
// imports `/playground`: live previews run only through a host-supplied `liveRenderer`.
import { DocsRenderer, MathFormula, PeleDiagram, ReplayPreview, SplitResult, isReplayQaUrl } from "@brett_lamy/docstream"
import { useAsset } from "@brett_lamy/docstream/assets"
import { OpenApiOperation } from "@brett_lamy/docstream/openapi"
import { packageManagerCommands, type DemoInlineFile, type DocumentNode, type HintStyle, type SourceRefNode } from "@brett_lamy/docstream/gitbook"
import { VideoEmbed } from "@brett_lamy/docstream/video"
import { StlViewer, isStlUrl } from "@brett_lamy/docstream/stl"
import { StrudelPlayer, isStrudelFile, isStrudelLanguage } from "@brett_lamy/docstream/strudel"
import { DemoViewer, prefetchDemoSources, useDemoVFSEntry, writeDocstreamClipboard } from "@brett_lamy/docstream/demo"
import { pmToCommand, pmToDemo } from "./convert"
import { clipboardForDoc, setActiveDemoDrag } from "./demo-clipboard"
import { SourceFileEditor } from "./SourceFileEditor"
import { useEditorRuntime, type FilePickKind } from "./runtime"
import { GbAttachment } from "./attachments"

function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
  return debounced
}

// ---------- Hint ----------

const HINT_META: Record<HintStyle, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "gb-hint-info" },
  success: { icon: CheckCircle2, cls: "gb-hint-success" },
  warning: { icon: AlertTriangle, cls: "gb-hint-warning" },
  danger: { icon: XCircle, cls: "gb-hint-danger" },
}

function HintView({ node, updateAttributes, editor }: NodeViewProps) {
  const style = (node.attrs.style as HintStyle) ?? "info"
  const { icon: Icon, cls } = HINT_META[style] ?? HINT_META.info
  return (
    <NodeViewWrapper className={`gb-hint ${cls}`}>
      <div className="gb-hint-gutter" contentEditable={false}>
        <Icon className="size-4" />
        {editor.isEditable && (
          <select
            className="gb-hint-style"
            value={style}
            onChange={(e) => updateAttributes({ style: e.target.value })}
          >
            {Object.keys(HINT_META).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
      <NodeViewContent className="gb-hint-body" />
    </NodeViewWrapper>
  )
}

export const GbHint = Node.create({
  name: "gbHint",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { style: { default: "info" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-hint]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-hint": node.attrs.style }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(HintView)
  },
})

// ---------- Tabs ----------

function TabsView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const active = Math.min(node.attrs.active ?? 0, node.childCount - 1)
  const titles: string[] = []
  node.forEach((child) => titles.push(child.attrs.title))

  const childPos = (index: number) => {
    let pos = getPos()! + 1
    for (let k = 0; k < index; k++) pos += node.child(k).nodeSize
    return pos
  }

  const renameTab = (index: number, title: string) => {
    editor.view.dispatch(
      editor.state.tr.setNodeAttribute(childPos(index), "title", title)
    )
  }

  const addTab = () => {
    const type = editor.schema.nodes.gbTab
    const tab = type.create({ title: `Tab ${node.childCount + 1}` }, [
      editor.schema.nodes.paragraph.create(),
    ])
    editor.view.dispatch(editor.state.tr.insert(childPos(node.childCount), tab))
    updateAttributes({ active: node.childCount })
  }

  const removeTab = (index: number) => {
    if (node.childCount <= 1) return
    const pos = childPos(index)
    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.child(index).nodeSize))
    updateAttributes({ active: Math.max(0, active - (index <= active ? 1 : 0)) })
  }

  const editable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const level = node.attrs.level === 3 || node.attrs.level === 4 ? node.attrs.level : 2
  // `{% tabs title="…" %}`: the set renders as a section — heading, then the switch on its row.
  const section = !!title || node.attrs.titled === true

  const tabStrip = (
    <>
        {titles.map((t, idx) => (
          <div
            key={idx}
            className={`gb-tabs-tab ${idx === active ? "gb-tabs-tab-active" : ""}`}
            onClick={() => updateAttributes({ active: idx })}
          >
            {editor.isEditable && idx === active ? (
              <input
                className="gb-tabs-title-input"
                value={t}
                size={Math.max(t.length, 3)}
                onChange={(e) => renameTab(idx, e.target.value)}
              />
            ) : (
              <span>{t}</span>
            )}
            {editor.isEditable && titles.length > 1 && (
              <button className="gb-icon-btn" onClick={() => removeTab(idx)} title="Remove tab">
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        {editable && (
          <button className="gb-icon-btn" onClick={addTab} title="Add tab">
            <Plus className="size-3.5" />
          </button>
        )}
        {editable && !section && (
          <button
            className="gb-icon-btn gb-tabs-add-title"
            onClick={() => updateAttributes({ titled: true })}
            title="Add a section title (renders the tabs as a titled section)"
          >
            <Heading className="size-3.5" />
          </button>
        )}
    </>
  )

  if (section) {
    const HeadingTag = `h${level}` as "h2" | "h3" | "h4"
    return (
      <NodeViewWrapper className="gb-tabs gb-tabs-section" data-level={level}>
        <div className="gb-tabs-section-head" contentEditable={false}>
          <HeadingTag className="gb-tabs-section-title">
            {editable ? (
              <input
                className="gb-inline-input gb-tabs-section-input"
                value={title}
                placeholder="Section title…"
                autoFocus={!title}
                onChange={(e) => updateAttributes({ title: e.target.value || null })}
                onBlur={(e) => {
                  if (!e.target.value) updateAttributes({ title: null, titled: false })
                }}
              />
            ) : (
              title
            )}
          </HeadingTag>
          {editable && (
            <select
              className="gb-tabs-level"
              value={level}
              title="Heading level"
              onChange={(e) => updateAttributes({ level: Number(e.target.value) === 2 ? null : Number(e.target.value) })}
            >
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
            </select>
          )}
          <div className="gb-tabs-pills">{tabStrip}</div>
        </div>
        <NodeViewContent className="gb-tabs-content" data-active={active} />
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="gb-tabs">
      <div className="gb-tabs-header" contentEditable={false}>
        {tabStrip}
      </div>
      <NodeViewContent className="gb-tabs-content" data-active={active} />
    </NodeViewWrapper>
  )
}

export const GbTabs = Node.create({
  name: "gbTabs",
  group: "block",
  content: "gbTab+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      active: { default: 0, rendered: false },
      // `{% tabs sync="key" %}` — tab sets sharing a key follow the reader's last choice.
      sync: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-sync") || null,
        renderHTML: (attributes) => (attributes.sync ? { "data-sync": attributes.sync } : {}),
      },
      // `{% tabs title="Installation" level="3" %}` — a titled set renders as a section heading.
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-title") || null,
        renderHTML: (attributes) => (attributes.title ? { "data-title": attributes.title } : {}),
      },
      level: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute("data-level")) || null,
        renderHTML: (attributes) => (attributes.level ? { "data-level": attributes.level } : {}),
      },
      // UI only: a title field is open but still empty.
      titled: { default: false, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-tabs]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-tabs": "" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(TabsView)
  },
})

export const GbTab = Node.create({
  name: "gbTab",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return { title: { default: "Tab" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-tab]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-tab": node.attrs.title, class: "gb-tab" }), 0]
  },
})

// ---------- Expandable ----------

function ExpandableView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-expandable">
      <div className="gb-expandable-summary" contentEditable={false}>
        <ChevronDown className="size-4" />
        {editor.isEditable ? (
          <input
            className="gb-inline-input"
            value={node.attrs.summary}
            placeholder="Expandable title…"
            onChange={(e) => updateAttributes({ summary: e.target.value })}
          />
        ) : (
          <span>{node.attrs.summary}</span>
        )}
      </div>
      <NodeViewContent className="gb-expandable-body" />
    </NodeViewWrapper>
  )
}

export const GbExpandable = Node.create({
  name: "gbExpandable",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { summary: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-expandable]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-expandable": "" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ExpandableView)
  },
})

// ---------- Stepper ----------

export const GbStepper = Node.create({
  name: "gbStepper",
  group: "block",
  content: "gbStep+",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-gb-stepper]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-stepper": "", class: "gb-stepper" }), 0]
  },
})

function StepView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  let index = 0
  try {
    const $pos = editor.state.doc.resolve(getPos()!)
    index = $pos.index($pos.depth)
  } catch {
    /* position can be momentarily stale during edits */
  }
  return (
    <NodeViewWrapper className="gb-step">
      <div className="gb-step-rail" contentEditable={false}>
        <div className="gb-step-badge">{index + 1}</div>
        <div className="gb-step-line" />
      </div>
      <div className="gb-step-main">
        <div contentEditable={false}>
          {editor.isEditable ? (
            <input
              className="gb-inline-input gb-step-title"
              value={node.attrs.title}
              placeholder="Step title…"
              onChange={(e) => updateAttributes({ title: e.target.value })}
            />
          ) : (
            <div className="gb-step-title">{node.attrs.title}</div>
          )}
        </div>
        <NodeViewContent className="gb-step-body" />
      </div>
    </NodeViewWrapper>
  )
}

export const GbStep = Node.create({
  name: "gbStep",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return { title: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-step]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-step": "" }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(StepView)
  },
})

// ---------- Embed ----------

function embedPreview(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  return null
}

function isDirectVideo(url: string): boolean {
  return /\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(url)
}

function booleanAttribute(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

/** "Choose file…": asks the host's `pickFile` for a path and sets it. Rendered only when the host has one. */
function PickFileButton({ kind, current, onPick, label }: { kind: FilePickKind; current: string; onPick: (url: string) => void; label: string }) {
  const { pickFile } = useEditorRuntime()
  if (!pickFile) return null
  return (
    <button
      type="button"
      className="gb-pick-file"
      onClick={async () => {
        const url = await pickFile({ kind, current })
        if (url) onPick(url)
      }}
    >
      <FolderOpen className="size-3.5" aria-hidden="true" /> {label}
    </button>
  )
}

// STL and Strudel files go through the host's asset resolver (a blob: URL of a local file, say).
// A resolved URL (blob:) has no file name in it: the title falls back to the one written in the document.
const fileName = (url: string) => url.split(/[?#]/)[0]!.split("/").pop() || url

function ResolvedStl({ url, title }: { url: string; title?: string }) {
  const src = useAsset(url)
  return src === undefined ? <div className="docstream-asset-pending" aria-busy="true" /> : <StlViewer src={src} title={title || fileName(url)} />
}

function ResolvedStrudel({ url, title }: { url: string; title?: string }) {
  const src = useAsset(url)
  return src === undefined ? <div className="docstream-asset-pending" aria-busy="true" /> : <StrudelPlayer src={src} title={title || fileName(url)} />
}

function EmbedView({ node, updateAttributes, editor }: NodeViewProps) {
  const url = node.attrs.url as string
  const preview = embedPreview(url)
  const title = typeof node.attrs.title === "string" && node.attrs.title ? node.attrs.title : url
  const poster = typeof node.attrs.poster === "string" ? node.attrs.poster : undefined
  const autoplay = booleanAttribute(node.attrs.autoplay)
  const loop = booleanAttribute(node.attrs.loop)
  const muted = booleanAttribute(node.attrs.muted)
  const controls = booleanAttribute(node.attrs.controls)
  return (
    <NodeViewWrapper className="gb-embed" contentEditable={false}>
      {isReplayQaUrl(url) ? (
        <ReplayPreview source={url} title="Replay preview" />
      ) : isStlUrl(url) ? (
        <ResolvedStl url={url} {...(node.attrs.title ? { title } : {})} />
      ) : isStrudelFile(url) ? (
        <ResolvedStrudel url={url} {...(node.attrs.title ? { title } : {})} />
      ) : preview || isDirectVideo(url) ? (
        <VideoEmbed
          src={preview ?? url}
          className="gb-embed-frame"
          title={title}
          {...(autoplay === undefined ? {} : { autoplay })}
          {...(loop === undefined ? {} : { loop })}
          {...(muted === undefined ? {} : { muted })}
          {...(controls === undefined ? {} : { controls })}
          {...(poster === undefined ? {} : { poster })}
        />
      ) : (
        <a className="gb-embed-link" href={url} target="_blank" rel="noreferrer">
          <Link2 className="size-4" /> {url || "Embed URL…"}
        </a>
      )}
      {editor.isEditable && (
        <div className="gb-embed-fields">
          <input
            className="gb-inline-input gb-embed-input"
            value={url}
            placeholder="https://… or ./file.stl"
            aria-label="Embed URL"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
          <PickFileButton kind="embed" current={url} label="Choose file…" onPick={(next) => updateAttributes({ url: next })} />
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const GbEmbed = Node.create({
  name: "gbEmbed",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      url: { default: "" },
      title: { default: null },
      autoplay: { default: null },
      loop: { default: null },
      muted: { default: null },
      controls: { default: null },
      poster: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-embed]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-embed": node.attrs.url })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView)
  },
})

// ---------- Content ref ----------

function ContentRefView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-content-ref" contentEditable={false}>
      <Link2 className="size-4 shrink-0" />
      {editor.isEditable ? (
        <>
          <input
            className="gb-inline-input"
            value={node.attrs.label}
            placeholder="Label…"
            onChange={(e) => updateAttributes({ label: e.target.value })}
          />
          <input
            className="gb-inline-input gb-content-ref-url"
            value={node.attrs.url}
            placeholder="page.md or https://…"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
        </>
      ) : (
        <span>
          {node.attrs.label} <span className="gb-content-ref-url">{node.attrs.url}</span>
        </span>
      )}
    </NodeViewWrapper>
  )
}

export const GbContentRef = Node.create({
  name: "gbContentRef",
  group: "block",
  atom: true,
  addAttributes() {
    // `linked`: the label is written as a link to the page (`[Card](card.md)`, GitBook's form).
    // `children`: the label's inlines when they say more than plain / linked text (emphasis, several runs).
    return {
      url: { default: "" },
      label: { default: "" },
      linked: { default: true, rendered: false },
      children: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-content-ref]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-content-ref": node.attrs.url })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ContentRefView)
  },
})

// ---------- Source ref ----------

function SourceRefView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const { sourceClient, sourcePreview = true, sourceAutoSave = true, onSourceSaved, onSourceError } = useEditorRuntime()
  const reference = useMemo<SourceRefNode>(() => ({
    type: "source-ref",
    mount: String(node.attrs.mount || "source"),
    path: String(node.attrs.path || ""),
    exportName: String(node.attrs.exportName || "default"),
    kind: node.attrs.kind === "story" ? "story" : "component",
    title: String(node.attrs.title || ""),
  }), [node.attrs.exportName, node.attrs.kind, node.attrs.mount, node.attrs.path, node.attrs.title])
  return (
    <NodeViewWrapper className={sourceClient && reference.path ? "gb-source-ref-block gb-source-ref-block-editing" : "gb-source-ref-block"} contentEditable={false}>
      <div className="gb-source-ref">
        <FileCode2 className="size-4 shrink-0" />
        {editable ? (
          <>
            <input className="gb-inline-input gb-source-ref-mount" value={node.attrs.mount} placeholder="mount" onChange={(event) => updateAttributes({ mount: event.target.value })} />
            <input className="gb-inline-input gb-source-ref-path" value={node.attrs.path} placeholder="src/Button.tsx" onChange={(event) => updateAttributes({ path: event.target.value })} />
            <input className="gb-inline-input gb-source-ref-export" value={node.attrs.exportName} placeholder="Button" onChange={(event) => updateAttributes({ exportName: event.target.value })} />
            <select className="gb-source-ref-kind" value={node.attrs.kind} onChange={(event) => updateAttributes({ kind: event.target.value })}>
              <option value="component">component</option>
              <option value="story">story</option>
            </select>
          </>
        ) : (
          <span>{node.attrs.title || `${node.attrs.path}#${node.attrs.exportName}`}</span>
        )}
      </div>
      {sourceClient && reference.path ? (
        <SourceFileEditor
          reference={reference}
          client={sourceClient}
          preview={sourcePreview}
          autoSave={editable ? sourceAutoSave : false}
          onSaved={onSourceSaved}
          onError={onSourceError}
          className="gb-source-ref-editor"
        />
      ) : null}
    </NodeViewWrapper>
  )
}

export const GbSourceRef = Node.create({
  name: "gbSourceRef",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      mount: { default: "source" },
      path: { default: "" },
      exportName: { default: "default" },
      kind: { default: "component" },
      title: { default: "" },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-source-ref]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-source-ref": `${node.attrs.mount}:${node.attrs.path}` })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(SourceRefView)
  },
})

// ---------- Demo ----------

/** Inline demo files editor: a tab per file (path editable), a code area, add / remove. */
function DemoFilesEditor({ files, entry, onChange }: {
  files: DemoInlineFile[]
  entry: string
  onChange: (files: DemoInlineFile[], entry?: string | null) => void
}) {
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, Math.max(0, files.length - 1))
  const file = files[index]
  const update = (patch: Partial<DemoInlineFile>) => {
    const next = files.map((f, i) => {
      if (i !== index) return f
      const merged = { ...f, ...patch }
      if (!merged.language) delete merged.language
      return merged
    })
    // Renaming the entry file keeps it the entry.
    const renamed = patch.path !== undefined && file && entry === file.path ? patch.path : undefined
    onChange(next, renamed)
  }
  const add = () => {
    const taken = new Set(files.map((f) => f.path))
    let n = files.length + 1
    let path = files.length ? `file${n}.tsx` : "index.tsx"
    while (taken.has(path)) path = `file${++n}.tsx`
    onChange([...files, { path, content: "", language: "tsx" }])
    setSelected(files.length)
  }
  const remove = (i: number) => {
    const removed = files[i]
    onChange(files.filter((_, k) => k !== i), removed && entry === removed.path ? null : undefined)
    setSelected(Math.max(0, i - 1))
  }
  return (
    <div className="gb-demo-files">
      <div className="gb-demo-files-tabs" role="tablist" aria-label="Demo files">
        {files.map((f, i) => (
          <div key={i} className={i === index ? "gb-demo-file-tab gb-demo-file-tab-active" : "gb-demo-file-tab"} onClick={() => setSelected(i)}>
            {i === index ? (
              <input
                className="gb-demo-file-path"
                value={f.path}
                size={Math.max(f.path.length, 6)}
                placeholder="index.tsx"
                aria-label="File path"
                onChange={(e) => update({ path: e.target.value })}
              />
            ) : (
              <span>{f.path || "untitled"}</span>
            )}
            {f.path && entry === f.path ? <span className="gb-demo-file-entry">entry</span> : null}
            <button type="button" className="gb-icon-btn" title={`Remove ${f.path || "file"}`} onClick={(e) => { e.stopPropagation(); remove(i) }}>
              <X className="size-3" />
            </button>
          </div>
        ))}
        <button type="button" className="gb-icon-btn" title="Add file" onClick={add}>
          <Plus className="size-3.5" />
        </button>
      </div>
      {file ? (
        <div className="gb-demo-file-body">
          <div className="gb-demo-file-meta">
            <input
              className="gb-inline-input gb-demo-file-lang"
              value={file.language ?? ""}
              placeholder="lang"
              aria-label="Language"
              onChange={(e) => update({ language: e.target.value })}
            />
            <label className="gb-demo-file-entry-toggle">
              <input
                type="radio"
                checked={entry ? entry === file.path : index === 0}
                onChange={() => onChange(files, index === 0 ? null : file.path)}
              />
              Entry
            </label>
          </div>
          <textarea
            className="gb-demo-file-code"
            value={file.content}
            spellCheck={false}
            rows={Math.min(24, Math.max(4, file.content.split("\n").length + 1))}
            aria-label={`Edit ${file.path}`}
            onChange={(e) => update({ content: e.target.value })}
            onKeyDown={(e) => {
              if (e.key !== "Tab" || e.shiftKey) return
              e.preventDefault()
              const el = e.currentTarget
              const { selectionStart: a, selectionEnd: b } = el
              update({ content: `${el.value.slice(0, a)}  ${el.value.slice(b)}` })
              requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
            }}
          />
        </div>
      ) : (
        <div className="gb-demo-files-empty">No inline files — the demo resolves from its <code>src</code>.</div>
      )}
    </div>
  )
}

/** A string attribute carried as `data-<name>` in the editor's HTML (clipboard between editors). */
function dataAttr(key: string, name = key) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes[key] ? { [`data-${name}`]: String(attributes[key]) } : {},
  }
}

function DemoView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const editable = editor.isEditable
  const { demoResolver, demoRuntime, demoDependencies, demoVFS } = useEditorRuntime()
  const demo = useMemo(() => pmToDemo(node.attrs), [node.attrs])
  const [filesOpen, setFilesOpen] = useState(false)
  // Typing into `src` or a file would otherwise re-resolve / re-run every keystroke.
  const src = useDebouncedValue(demo.src)
  const files = useDebouncedValue(demo.files)
  const entry = useDebouncedValue(demo.entry)
  const hasFiles = !!demo.files?.length
  // The resolver is the authority when it knows `src`; inline files stand in otherwise
  // (DemoViewer falls back to them), so a pasted docs page looks like the page.
  const vfsEntry = useDemoVFSEntry(demoVFS, src)
  const preview = (!!demoResolver && !!src) || !!files?.length || !!vfsEntry?.files.length
  // Fetch the resolver's files ahead, so copying this block can inline them synchronously.
  useEffect(() => {
    if (demoResolver && src && (!demoResolver.list || demoResolver.list().includes(src))) void prefetchDemoSources(demoResolver, [src])
  }, [demoResolver, src])
  // Drag this block (its files included) into another docstream editor, or within this one.
  const onDragStart = (event: React.DragEvent) => {
    const pos = typeof getPos === "function" ? getPos() : undefined
    if (!event.dataTransfer || pos === undefined) return
    // Ours, not ProseMirror's / TipTap's: TipTap's cross-editor drag tracking (a window
    // listener) would otherwise delete the source editor's selection on drop.
    event.stopPropagation()
    const clip = clipboardForDoc({ type: "doc", children: [pmToDemo(node.attrs)] }, { ...(demoResolver ? { resolver: demoResolver } : {}), ...(demoVFS ? { vfs: demoVFS } : {}) })
    event.dataTransfer.clearData()
    writeDocstreamClipboard(event.dataTransfer, clip)
    event.dataTransfer.effectAllowed = "copyMove"
    setActiveDemoDrag({ editor, pos })
  }
  const setFiles = (next: DemoInlineFile[], nextEntry?: string | null) => {
    updateAttributes({
      files: next.length ? next : null,
      ...(nextEntry !== undefined ? { entry: nextEntry || null } : {}),
    })
  }
  return (
    <NodeViewWrapper className={preview || (editable && filesOpen) ? "gb-demo-block gb-demo-block-preview" : "gb-demo-block"} contentEditable={false}>
      <div className="gb-demo">
        <span
          className="gb-demo-grip"
          draggable
          role="button"
          aria-label="Drag demo"
          title="Drag this demo (with its files) — into another editor to copy it"
          data-gb-demo-grip=""
          onDragStart={onDragStart}
          onDragEnd={() => window.setTimeout(() => setActiveDemoDrag(null), 0)}
        >
          <GripVertical className="size-3.5" />
        </span>
        <AppWindow className="size-4 shrink-0" />
        {editable ? (
          <>
            <input className="gb-inline-input gb-demo-src" value={node.attrs.src} placeholder="page/example" onChange={(event) => updateAttributes({ src: event.target.value })} />
            <input className="gb-inline-input gb-demo-title" value={node.attrs.title} placeholder="Title" onChange={(event) => updateAttributes({ title: event.target.value })} />
            <button
              type="button"
              className={filesOpen ? "gb-demo-files-toggle gb-demo-files-toggle-active" : "gb-demo-files-toggle"}
              title="Edit the files carried inline by this demo"
              aria-expanded={filesOpen}
              onClick={() => setFilesOpen((open) => !open)}
            >
              <FileCode2 className="size-3.5" />
              {hasFiles ? `${demo.files!.length} file${demo.files!.length === 1 ? "" : "s"}` : "Files"}
            </button>
          </>
        ) : (
          <>
            <code className="gb-demo-src">{demo.src || "demo"}</code>
            {demo.title ? <span className="gb-demo-title">{demo.title}</span> : null}
          </>
        )}
      </div>
      {editable && filesOpen ? (
        <DemoFilesEditor files={demo.files ?? []} entry={demo.entry ?? ""} onChange={setFiles} />
      ) : null}
      {preview ? (
        <div className="gb-demo-preview">
          <DemoViewer
            key={src}
            {...(demoResolver ? { resolver: demoResolver } : {})}
            src={src}
            title={demo.title}
            description={demo.description}
            height={demo.height}
            layout={demo.layout}
            variants={demo.variants}
            viewport={demo.viewport}
            files={files}
            entry={entry}
            status={demo.status}
            bleed={demo.bleed}
            canvasClassName={demo.className}
            surface={demo.surface}
            variantsWidth={demo.variantsWidth}
            {...(demoRuntime ? { runtime: demoRuntime } : {})}
            {...(demoDependencies ? { dependencies: demoDependencies } : {})}
          />
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}

/**
 * `{% demo %}` — every tag attribute is kept on the node, and the block form's inline
 * files (`files`, in document order) with it, so it round-trips losslessly.
 */
export const GbDemo = Node.create({
  name: "gbDemo",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: "" },
      title: { default: "" },
      description: { default: "" },
      height: { default: "" },
      layout: { default: null },
      variants: { default: null, rendered: false },
      viewport: { default: null },
      entry: { default: null },
      // Look (`status="Live" bleed="true" className="…" surface="…" variantsWidth="220"`),
      // kept verbatim; the tag's values win over the resolver's meta.json.
      status: dataAttr("status"),
      bleed: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-bleed")
          return raw === null ? null : raw !== "false"
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.bleed === "boolean" ? { "data-bleed": String(attributes.bleed) } : {},
      },
      className: dataAttr("className", "canvas-class"),
      surface: dataAttr("surface"),
      variantsWidth: dataAttr("variantsWidth", "variants-width"),
      // `{ path, content, language? }[]` — the files between `{% demo %}` and `{% enddemo %}`.
      files: {
        default: null,
        rendered: false,
        parseHTML: (element) => {
          const raw = element.getAttribute("data-files")
          if (!raw) return null
          try {
            return JSON.parse(raw)
          } catch {
            return null
          }
        },
        renderHTML: (attributes) => (attributes.files ? { "data-files": JSON.stringify(attributes.files) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-demo]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-demo": node.attrs.src })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(DemoView)
  },
})

// ---------- Command (package-manager install box) ----------

const COMMAND_MANAGERS = ["pnpm", "yarn", "bun"] as const

function CommandView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const command = useMemo(() => pmToCommand(node.attrs), [node.attrs])
  const derived = useMemo(() => packageManagerCommands(command.command), [command.command])
  // docstream's own command box, so the editor shows exactly what readers get.
  const doc = useMemo<DocumentNode>(() => ({ type: "doc", children: [command] }), [command])
  const setOverride = (pm: (typeof COMMAND_MANAGERS)[number], value: string) => {
    const next = { ...(command.overrides ?? {}) }
    if (value) next[pm] = value
    else delete next[pm]
    updateAttributes({ overrides: Object.keys(next).length ? next : null })
  }
  return (
    <NodeViewWrapper className="gb-command" contentEditable={false}>
      {command.command ? (
        <div className="gb-command-preview">
          <DocsRenderer doc={doc} />
        </div>
      ) : null}
      {editable ? (
        <div className="gb-command-fields">
          <label className="gb-command-field gb-command-field-npm">
            <span>npm</span>
            <textarea
              className="gb-command-input"
              value={command.command}
              placeholder="npm install <package>"
              spellCheck={false}
              rows={Math.max(1, command.command.split("\n").length)}
              onChange={(e) => updateAttributes({ command: e.target.value })}
            />
          </label>
          {COMMAND_MANAGERS.map((pm) => (
            <label key={pm} className="gb-command-field">
              <span>{pm}</span>
              <input
                className="gb-inline-input gb-command-override"
                value={command.overrides?.[pm] ?? ""}
                placeholder={derived[pm] || `${pm} (derived)`}
                spellCheck={false}
                title={`Override the derived ${pm} command (leave empty to derive it)`}
                onChange={(e) => setOverride(pm, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}

/** `{% command %}npm install x{% endcommand %}` — one npm command shown for the reader's package manager. */
export const GbCommand = Node.create({
  name: "gbCommand",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      command: { default: "" },
      // `{ pnpm?, yarn?, bun? }` — verbatim commands replacing the derived ones.
      overrides: { default: null, rendered: false },
      // Sync key; null means docstream's default ("pm").
      sync: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-command]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-command": "" }), node.attrs.command]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CommandView)
  },
})

// ---------- Columns ----------

export const GbColumns = Node.create({
  name: "gbColumns",
  group: "block",
  content: "gbColumn{2,}",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-gb-columns]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-columns": "", class: "gb-columns" }), 0]
  },
})

export const GbColumn = Node.create({
  name: "gbColumn",
  content: "block+",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: "div[data-gb-column]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-column": "", class: "gb-column" }), 0]
  },
})

// ---------- Figure ----------

function FigureImg({ url, alt }: { url: string; alt: string }) {
  return <img src={useAsset(url)} alt={alt} className="gb-figure-img" />
}

function FigureView({ node, updateAttributes, editor }: NodeViewProps) {
  const { src, alt, caption } = node.attrs
  return (
    <NodeViewWrapper className="gb-figure" contentEditable={false}>
      {src ? (
        <FigureImg url={src} alt={alt} />
      ) : (
        <div className="gb-figure-placeholder">No image</div>
      )}
      {editor.isEditable ? (
        <div className="gb-figure-fields">
          <div className="gb-embed-fields">
            <input
              className="gb-inline-input"
              value={src}
              placeholder="Image URL…"
              aria-label="Image URL"
              onChange={(e) => updateAttributes({ src: e.target.value })}
            />
            <PickFileButton kind="image" current={src} label="Choose image…" onPick={(next) => updateAttributes({ src: next })} />
          </div>
          <input
            className="gb-inline-input"
            value={caption}
            placeholder="Caption…"
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
        </div>
      ) : (
        caption && <figcaption className="gb-figure-caption">{caption}</figcaption>
      )}
    </NodeViewWrapper>
  )
}

export const GbFigure = Node.create({
  name: "gbFigure",
  group: "block",
  atom: true,
  addAttributes() {
    // `title`: a Markdown image's `![alt](src "title")`.
    return { src: { default: "" }, alt: { default: "" }, caption: { default: "" }, title: { default: null, rendered: false } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-figure]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-figure": node.attrs.src })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView)
  },
})

// ---------- Math ----------

// Docstream's math card: the TeX (editable here) on the left, KaTeX's typesetting on the right, stacked when narrow.
function MathView({ node, updateAttributes, editor }: NodeViewProps) {
  const formula = String(node.attrs.formula ?? "")
  const preview = useDebouncedValue(formula)
  return (
    <NodeViewWrapper className="gb-math docs-split-card docs-math-card" data-docstream-math="" contentEditable={false}>
      <div className="docs-split-grid">
        <div className="docs-split-pane docs-split-source-pane">
          <div className="docs-split-head">
            <span className="docs-split-label">LaTeX</span>
          </div>
          {editor.isEditable ? (
            <textarea
              className="gb-math-input docs-split-source"
              aria-label="TeX"
              value={formula}
              rows={Math.max(1, formula.split("\n").length)}
              onChange={(e) => updateAttributes({ formula: e.target.value })}
            />
          ) : (
            <pre className="gb-math-formula docs-split-source">{formula}</pre>
          )}
        </div>
        <SplitResult label="KaTeX">
          <MathFormula formula={preview} />
        </SplitResult>
      </div>
    </NodeViewWrapper>
  )
}

export const GbMath = Node.create({
  name: "gbMath",
  group: "block",
  atom: true,
  addAttributes() {
    return { formula: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-math]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-math": "" }), node.attrs.formula]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView)
  },
})

// ---------- Code block with GitBook title/lineNumbers ----------

function CodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const code = node.textContent
  const previewCode = useDebouncedValue(code)
  const language = String(node.attrs.language ?? "").toLowerCase()
  const mermaid = language === "mermaid"
  const strudel = isStrudelLanguage(language)
  const { liveRenderer } = useEditorRuntime()
  const live = !!liveRenderer && !!node.attrs.live && (language === "jsx" || language === "tsx" || language === "react")
  const entry = String(node.attrs.entry || (language === "tsx" ? "/src/main.tsx" : "/src/main.jsx"))
  const files = useMemo(() => ({ [entry]: previewCode }), [entry, previewCode])

  // Mermaid: docstream's card, with this block's code as the source pane — edit on the left, Pele draws on the right.
  if (mermaid) {
    return (
      <NodeViewWrapper className="gb-code gb-code-mermaid docs-mermaid-preview docs-split-card" data-docstream-mermaid="">
        <div className="docs-split-grid">
        <div className="docs-split-pane docs-split-source-pane">
          <div className="docs-split-head" contentEditable={false}>
            <span className="docs-split-label">Mermaid</span>
            {editor.isEditable ? (
              <input
                className="gb-inline-input gb-code-lang"
                aria-label="Language"
                value={node.attrs.language ?? ""}
                placeholder="lang"
                onChange={(e) => updateAttributes({ language: e.target.value || null })}
              />
            ) : null}
          </div>
          <pre className="docs-split-source">
            <NodeViewContent {...({ as: "code" } as object)} />
          </pre>
        </div>
        <PeleDiagram code={previewCode} />
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="gb-code">
      {strudel ? (
        <div className="gb-code-preview gb-code-strudel-preview" contentEditable={false}>
          <StrudelPlayer code={previewCode} {...(node.attrs.title ? { title: node.attrs.title } : {})} />
        </div>
      ) : null}
      {live && liveRenderer ? (
        <div className="gb-code-preview gb-code-almost-preview" contentEditable={false}>
          {liveRenderer({ files, entry, title: node.attrs.title || "Live preview" })}
        </div>
      ) : null}
      <div className="gb-code-header" contentEditable={false}>
        {editor.isEditable ? (
          <>
            <input
              className="gb-inline-input gb-code-title"
              value={node.attrs.title ?? ""}
              placeholder="Title (optional)"
              onChange={(e) => updateAttributes({ title: e.target.value || null })}
            />
            <input
              className="gb-inline-input gb-code-lang"
              value={node.attrs.language ?? ""}
              placeholder="lang"
              onChange={(e) => updateAttributes({ language: e.target.value || null })}
            />
            <label className="gb-code-linenos">
              <input
                type="checkbox"
                checked={!!node.attrs.lineNumbers}
                onChange={(e) => updateAttributes({ lineNumbers: e.target.checked })}
              />
              #
            </label>
            <label className="gb-code-live">
              <input
                type="checkbox"
                checked={!!node.attrs.live}
                onChange={(e) => updateAttributes({ live: e.target.checked })}
              />
              Live
            </label>
            {node.attrs.live && (
              <input
                className="gb-inline-input gb-code-entry"
                value={node.attrs.entry ?? ""}
                placeholder="entry (e.g. src/main.jsx)"
                onChange={(e) => updateAttributes({ entry: e.target.value || null })}
              />
            )}
          </>
        ) : (
          <>
            {node.attrs.title && <span className="gb-code-title">{node.attrs.title}</span>}
            {node.attrs.language && <span className="gb-code-lang">{node.attrs.language}</span>}
            {node.attrs.live && <span className="gb-code-live-badge">Live</span>}
          </>
        )}
      </div>
      <pre className={node.attrs.lineNumbers ? "gb-code-numbered" : ""}>
        <NodeViewContent {...({ as: "code" } as object)} />
      </pre>
    </NodeViewWrapper>
  )
}

export const GbCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
      lineNumbers: { default: false },
      // The source wrote `lineNumbers="…"` explicitly: kept so the fence round-trips byte-for-byte.
      lineNumbersExplicit: { default: null, rendered: false },
      live: { default: false },
      entry: { default: null },
      collapsedCodeLines: { default: null, rendered: false },
      expandedCodeLines: { default: null, rendered: false },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeView)
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), gpuHighlightPlugin(this.name)]
  },
})

// ---------- Inline image (GitHub badge style) ----------

function InlineImageView({ node }: NodeViewProps) {
  const { src, alt, width, height, link } = node.attrs
  const resolved = useAsset(src)
  const img = (
    <img
      src={resolved}
      alt={alt}
      className="gb-inline-img"
      style={{ width: width || undefined, height: height || undefined }}
    />
  )
  return (
    <NodeViewWrapper as="span" className="gb-inline-img-wrap" contentEditable={false}>
      {link ? <a href={link}>{img}</a> : img}
    </NodeViewWrapper>
  )
}

export const GbInlineImage = Node.create({
  name: "gbInlineImage",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      width: { default: "" },
      height: { default: "" },
      link: { default: "" },
    }
  },
  parseHTML() {
    return [{ tag: "img[data-gb-inline-img]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-gb-inline-img": "", src: node.attrs.src })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineImageView)
  },
})

// ---------- Reference chips (@mention, #tag, [^n] citation) ----------

function ReferenceView({ node }: NodeViewProps) {
  const { kind, id, url, label } = node.attrs
  return (
    <NodeViewWrapper as="span" className="gb-ref-wrap" contentEditable={false}>
      {kind === "citation" ? (
        <span className="gb-cite" title={label || url || undefined}>
          {id}
        </span>
      ) : (
        <span className={`gb-ref gb-ref-${kind}`}>
          {kind === "mention" ? (
            <AtSign className="gb-ref-icon" />
          ) : kind === "codebase" ? (
            <FolderGit2 className="gb-ref-icon" />
          ) : (
            <Hash className="gb-ref-icon" />
          )}
          {id}
        </span>
      )}
    </NodeViewWrapper>
  )
}

export const GbReference = Node.create({
  name: "gbReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: { default: "mention" },
      id: { default: "" },
      url: { default: "" },
      label: { default: "" },
    }
  },
  parseHTML() {
    return [{ tag: "span[data-gb-ref]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    const sigil =
      node.attrs.kind === "mention"
        ? "@"
        : node.attrs.kind === "tag"
          ? "#"
          : node.attrs.kind === "codebase"
            ? "$"
            : "^"
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-gb-ref": node.attrs.kind, "data-gb-ref-id": node.attrs.id }),
      `${sigil}${node.attrs.id}`,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReferenceView)
  },
})

// ---------- Updates (changelog) ----------

export const GbUpdates = Node.create({
  name: "gbUpdates",
  group: "block",
  content: "gbUpdate+",
  defining: true,
  addAttributes() {
    return { format: { default: null } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-updates]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-updates": "", class: "gb-updates" }), 0]
  },
})

function UpdateView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-update">
      <div className="gb-update-date" contentEditable={false}>
        {editor.isEditable ? (
          <input
            type="date"
            className="gb-inline-input"
            value={node.attrs.date}
            onChange={(e) => updateAttributes({ date: e.target.value })}
          />
        ) : (
          <span>{node.attrs.date}</span>
        )}
      </div>
      <NodeViewContent className="gb-update-body" />
    </NodeViewWrapper>
  )
}

export const GbUpdate = Node.create({
  name: "gbUpdate",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes() {
    return { date: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-update]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-update": node.attrs.date }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(UpdateView)
  },
})

// ---------- OpenAPI operation ----------

function OpenapiView({ node, updateAttributes, editor }: NodeViewProps) {
  const { spec, path, method, specUrl } = node.attrs
  return (
    <NodeViewWrapper className="gb-openapi" contentEditable={false}>
      {editor.isEditable && (
        <div className="gb-openapi-fields">
          <input
            className="gb-inline-input"
            value={spec}
            placeholder="spec name"
            onChange={(e) => updateAttributes({ spec: e.target.value })}
          />
          <input
            className="gb-inline-input"
            value={method}
            placeholder="get"
            onChange={(e) => updateAttributes({ method: e.target.value })}
          />
          <input
            className="gb-inline-input gb-openapi-path"
            value={path}
            placeholder="/path"
            onChange={(e) => updateAttributes({ path: e.target.value })}
          />
          <input
            className="gb-inline-input gb-openapi-url"
            value={specUrl}
            placeholder="https://…/openapi.yaml"
            onChange={(e) => updateAttributes({ specUrl: e.target.value })}
          />
        </div>
      )}
      <OpenApiOperation specUrl={specUrl} path={path} method={method || "get"} />
    </NodeViewWrapper>
  )
}

export const GbOpenapi = Node.create({
  name: "gbOpenapi",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      spec: { default: "" },
      path: { default: "" },
      method: { default: "get" },
      specUrl: { default: "" },
      label: { default: "" },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-openapi]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-openapi": node.attrs.path })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(OpenapiView)
  },
})

// ---------- Reference definitions (`[label]: url "title"`) ----------

function DefinitionView({ node, updateAttributes, editor }: NodeViewProps) {
  const { label, url, title } = node.attrs
  return (
    <NodeViewWrapper className="gb-definition" contentEditable={false}>
      {editor.isEditable ? (
        <>
          <span className="gb-definition-bracket">[</span>
          <input
            className="gb-inline-input gb-definition-label"
            value={label}
            placeholder="label"
            onChange={(e) => updateAttributes({ label: e.target.value })}
          />
          <span className="gb-definition-bracket">]:</span>
          <input
            className="gb-inline-input gb-definition-url"
            value={url}
            placeholder="https://…"
            onChange={(e) => updateAttributes({ url: e.target.value })}
          />
          <input
            className="gb-inline-input gb-definition-title"
            value={title ?? ""}
            placeholder="Title (optional)"
            onChange={(e) => updateAttributes({ title: e.target.value || null })}
          />
        </>
      ) : (
        <code>{`[${label}]: ${url}${title ? ` "${title}"` : ""}`}</code>
      )}
    </NodeViewWrapper>
  )
}

/**
 * A reference-style link definition, where the Markdown put it. Links written `[text][label]`,
 * `[text][]` or `[label]` resolve through it; it renders nothing in docs.
 */
export const GbDefinition = Node.create({
  name: "gbDefinition",
  group: "block",
  atom: true,
  addAttributes() {
    return { label: { default: "" }, url: { default: "" }, title: { default: null } }
  },
  parseHTML() {
    return [
      {
        tag: "div[data-gb-definition]",
        getAttrs: (el) => ({
          label: (el as HTMLElement).getAttribute("data-gb-definition") ?? "",
          url: (el as HTMLElement).getAttribute("data-url") ?? "",
          title: (el as HTMLElement).getAttribute("data-title"),
        }),
      },
    ]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-gb-definition": node.attrs.label,
        "data-url": node.attrs.url,
        ...(node.attrs.title !== null ? { "data-title": node.attrs.title } : {}),
      }),
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(DefinitionView)
  },
})

// ---------- Lines kept verbatim (unknown `{% tags %}`) ----------

function RawView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-raw" contentEditable={false}>
      {editor.isEditable ? (
        <input
          className="gb-inline-input gb-raw-input"
          value={node.attrs.markdown}
          onChange={(e) => updateAttributes({ markdown: e.target.value })}
        />
      ) : (
        <code>{node.attrs.markdown}</code>
      )}
    </NodeViewWrapper>
  )
}

/** A line docstream keeps as written without modelling it (an unknown `{% tag %}`). */
export const GbRaw = Node.create({
  name: "gbRaw",
  group: "block",
  atom: true,
  addAttributes() {
    return { markdown: { default: "" } }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-raw]", getAttrs: (el) => ({ markdown: (el as HTMLElement).getAttribute("data-gb-raw") ?? "" }) }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-raw": node.attrs.markdown })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(RawView)
  },
})

/**
 * A link without text (`[](url)`): an empty inline that carries the link mark (and any emphasis), since
 * ProseMirror has no empty text runs.
 */
export const GbEmptyLink = Node.create({
  name: "gbEmptyLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "span[data-gb-empty-link]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-gb-empty-link": "", class: "gb-empty-link" })]
  },
})

export const gitbookNodes = [
  GbHint,
  GbTabs,
  GbTab,
  GbExpandable,
  GbStepper,
  GbStep,
  GbEmbed,
  GbContentRef,
  GbSourceRef,
  GbDemo,
  GbCommand,
  GbColumns,
  GbColumn,
  GbFigure,
  GbMath,
  GbUpdates,
  GbUpdate,
  GbOpenapi,
  GbInlineImage,
  GbReference,
  GbAttachment,
  GbDefinition,
  GbRaw,
  GbEmptyLink,
]
