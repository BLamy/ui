import { Node, mergeAttributes } from "@tiptap/core"
import { CodeBlock } from "@tiptap/extension-code-block"
import { gpuHighlightPlugin } from "./gpu-highlight"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { Button } from "@ui-sdk/react/button"
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@ui-sdk/react/collapsible"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import { Textarea } from "@ui-sdk/react/textarea"
import {
  AlertTriangle,
  AppWindow,
  AtSign,
  CheckCircle2,
  ChevronDown,
  FolderGit2,
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
// The Strudel player and its file checks come from the root too: the `/strudel` entry also carries the rack's parser
// (acorn), which waits until a reader opens the rack.
import { DocsRenderer, ImageThumbnail, leadingThumbnail, MathFormula, PeleDiagram, ReplayFile, ReplayPreview, SplitResult, StrudelPlayer, isReplayQaUrl, isRrwebUrl, isStrudelFile, isStrudelLanguage, thumbnailLabel } from "@brett_lamy/ui/docstream"
import { useAsset } from "@brett_lamy/ui/docstream/assets"
import { OpenApiOperation } from "@brett_lamy/ui/docstream/openapi"
import { packageManagerCommands, parseBlocks, type DemoInlineFile, type DocumentNode, type HintStyle, type SourceRefNode } from "@brett_lamy/ui/docstream/gitbook"
import { VideoEmbed } from "@brett_lamy/ui/docstream/video"
import { StlViewer, isStlUrl } from "@brett_lamy/ui/docstream/stl"
import { XStatePreview, isXStateLanguage } from "@brett_lamy/ui/docstream/xstate"
import { CapnpEmbed, CapnpPreview, isCapnpLanguage, isCapnpUrl, isWorkerdConfig } from "@brett_lamy/ui/docstream/capnp"
import { TsCircuitPreview, isTsCircuitLanguage } from "@brett_lamy/ui/docstream/tscircuit"
import { DemoViewer, prefetchDemoSources, useDemoVFSEntry, writeDocstreamClipboard } from "@brett_lamy/ui/docstream/demo"
import { pmToCommand, pmToDemo } from "./convert"
import { clipboardForDoc, setActiveDemoDrag } from "./demo-clipboard"
import { SourceFileEditor } from "./SourceFileEditor"
import { useEditorRuntime } from "./runtime"
import { GbAttachment } from "./attachments"
import { ChoiceSelect, FlagCheckbox, PickFileButton, UploadFileButton, controlNodeView, type ChoiceOption } from "./controls"

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

const HINT_OPTIONS = (Object.keys(HINT_META) as HintStyle[]).map((style) => ({ value: style, label: style }))

function HintView({ node, updateAttributes, editor }: NodeViewProps) {
  const style = (node.attrs.style as HintStyle) ?? "info"
  const { icon: Icon, cls } = HINT_META[style] ?? HINT_META.info
  return (
    <NodeViewWrapper className={`gb-hint ${cls}`}>
      <div className="gb-hint-gutter" contentEditable={false}>
        <Icon className="size-4" aria-hidden="true" />
        {editor.isEditable && (
          <ChoiceSelect
            className="gb-hint-style"
            label="Hint style"
            value={style}
            options={HINT_OPTIONS}
            onValueChange={(next) => updateAttributes({ style: next })}
          />
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
    return controlNodeView(HintView)
  },
})

// ---------- Tabs ----------

const LEVEL_OPTIONS: ChoiceOption<"2" | "3" | "4">[] = [
  { value: "2", label: "H2" },
  { value: "3", label: "H3" },
  { value: "4", label: "H4" },
]

/** The column of a tab strip a tab, and the controls laid over it, sit in. */
const tabColumn = (index: number) => ({ "--gb-tab": index + 1 }) as CSSProperties

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

  // Each tab's section is its tab panel: labelled by the tab, shown only while it's selected. The
  // sections are ProseMirror's (the tab node views below), so they're pointed at once rendered.
  const strip = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const tabs = strip.current?.querySelectorAll<HTMLElement>('[role="tab"]')
    if (!tabs) return
    node.forEach((_child, _offset, idx) => {
      const pos = getPos()
      const panel = pos === undefined ? null : editor.view.nodeDOM(childPos(idx))
      const tab = tabs[idx]
      if (!(panel instanceof HTMLElement) || !tab?.id) return
      panel.id = `${tab.id}-panel`
      panel.setAttribute("aria-labelledby", tab.id)
      tab.setAttribute("aria-controls", panel.id)
      panel.hidden = idx !== active
    })
  })

  const editable = editor.isEditable
  const title = typeof node.attrs.title === "string" ? node.attrs.title : ""
  const level = node.attrs.level === 3 || node.attrs.level === 4 ? node.attrs.level : 2
  // `{% tabs title="…" %}`: the set renders as a section — heading, then the switch on its row.
  const section = !!title || node.attrs.titled === true
  const removable = editable && titles.length > 1

  // Tabs carry no id: a tab is its place in the set.
  const tabStrip = (
    <>
      <TabsList className="gb-tabs-list" aria-label={title || "Tabs"}>
        {titles.map((t, idx) => (
          <TabsTab
            key={idx}
            value={String(idx)}
            className={(state) => (state.selected ? "gb-tabs-tab gb-tabs-tab-active" : "gb-tabs-tab")}
            style={tabColumn(idx)}
            data-renaming={editable && idx === active ? "" : undefined}
            {...(t ? {} : { "aria-label": `Tab ${idx + 1}` })}
          >
            <span className="gb-tabs-tab-label">{t}</span>
          </TabsTab>
        ))}
      </TabsList>
      {editable && titles[active] !== undefined && (
        <Input
          className="gb-tabs-title-input"
          style={tabColumn(active)}
          aria-label="Tab title"
          value={titles[active]}
          onValueChange={(value) => renameTab(active, value)}
        />
      )}
      {removable &&
        titles.map((t, idx) => (
          <Button
            key={idx}
            className="gb-icon-btn gb-tabs-remove"
            style={tabColumn(idx)}
            aria-label={`Remove ${t || `tab ${idx + 1}`}`}
            title="Remove tab"
            onClick={() => removeTab(idx)}
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        ))}
      {editable && (
        <Button className="gb-icon-btn" aria-label="Add tab" title="Add tab" onClick={addTab}>
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      )}
      {editable && !section && (
        <Button
          className="gb-icon-btn gb-tabs-add-title"
          aria-label="Add a section title"
          title="Add a section title (renders the tabs as a titled section)"
          onClick={() => updateAttributes({ titled: true })}
        >
          <Heading className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    </>
  )

  const selectTab = (value: string | null) => {
    if (value !== null && Number(value) !== active) updateAttributes({ active: Number(value) })
  }

  if (section) {
    const HeadingTag = `h${level}` as "h2" | "h3" | "h4"
    return (
      <Tabs value={String(active)} onValueChange={selectTab} render={<NodeViewWrapper className="gb-tabs gb-tabs-section" data-level={level} />}>
        <div className="gb-tabs-section-head" contentEditable={false}>
          <HeadingTag className="gb-tabs-section-title">
            {editable ? (
              <Input
                className="gb-inline-input gb-tabs-section-input"
                aria-label="Section title"
                value={title}
                placeholder="Section title…"
                autoFocus={!title}
                onValueChange={(value) => updateAttributes({ title: value || null })}
                onBlur={(e) => {
                  if (!e.target.value) updateAttributes({ title: null, titled: false })
                }}
              />
            ) : (
              title
            )}
          </HeadingTag>
          {editable && (
            <ChoiceSelect
              className="gb-tabs-level"
              label="Heading level"
              value={String(level) as "2" | "3" | "4"}
              options={LEVEL_OPTIONS}
              onValueChange={(next) => updateAttributes({ level: next === "2" ? null : Number(next) })}
            />
          )}
          <div ref={strip} className="gb-tabs-pills gb-tabs-strip" data-removable={removable ? "" : undefined}>
            {tabStrip}
          </div>
        </div>
        <NodeViewContent className="gb-tabs-content" data-active={active} />
      </Tabs>
    )
  }

  return (
    <Tabs value={String(active)} onValueChange={selectTab} render={<NodeViewWrapper className="gb-tabs" />}>
      <div ref={strip} className="gb-tabs-header gb-tabs-strip" data-removable={removable ? "" : undefined} contentEditable={false}>
        {tabStrip}
      </div>
      <NodeViewContent className="gb-tabs-content" data-active={active} />
    </Tabs>
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
    return controlNodeView(TabsView)
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
  addNodeView() {
    // A tab panel. The tabs view labels it by its tab and hides it while another tab is selected;
    // those attribute changes are the view's, not edits, so ProseMirror ignores them.
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("div")
      dom.className = "gb-tab"
      dom.setAttribute("role", "tabpanel")
      dom.setAttribute("data-gb-tab", node.attrs.title)
      const pos = getPos()
      if (pos !== undefined) {
        const $pos = editor.state.doc.resolve(pos)
        const tabs = $pos.parent
        if (tabs.type.name === "gbTabs") dom.hidden = $pos.index() !== Math.min(tabs.attrs.active ?? 0, tabs.childCount - 1)
      }
      return {
        dom,
        contentDOM: dom,
        update(next) {
          if (next.type.name !== "gbTab") return false
          dom.setAttribute("data-gb-tab", next.attrs.title)
          return true
        },
        ignoreMutation: (mutation) => mutation.type === "attributes" && mutation.target === dom,
      }
    }
  },
})

// ---------- Expandable ----------

function ExpandableView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-expandable">
      <div className="gb-expandable-summary" contentEditable={false}>
        <ChevronDown className="size-4" aria-hidden="true" />
        {editor.isEditable ? (
          <Input
            className="gb-inline-input"
            aria-label="Expandable title"
            value={node.attrs.summary}
            placeholder="Expandable title…"
            onValueChange={(summary) => updateAttributes({ summary })}
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
    return controlNodeView(ExpandableView)
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

// A step heading that opens with a thumbnail image (`### ![shot](a.jpg "thumbnail: 0:39.8") Title`).
const THUMB_HEADING = /^(\s*#{1,6}[ \t]+!\[[^\]]*\]\([^)]*\)[ \t]*)/

function stepThumbnail(heading: unknown) {
  if (typeof heading !== "string") return null
  const [block] = parseBlocks(heading.split("\n").filter((line) => line.trim()))
  const lead = block?.type === "heading" ? leadingThumbnail(block.children) : null
  const prefix = THUMB_HEADING.exec(heading)?.[1]
  return lead && prefix ? { ...lead, prefix } : null
}

function StepView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const md = (node.attrs.md ?? null) as { heading?: string } | null
  const thumb = useMemo(() => stepThumbnail(md?.heading), [md?.heading])
  // Retitling keeps the heading's thumbnail: the heading as written is rewritten around the new title.
  const setTitle = (title: string) =>
    updateAttributes(thumb ? { title, md: { ...md, heading: `${thumb.prefix}${title}` } } : { title })
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
        <div contentEditable={false} className={thumb ? "gb-step-head gb-step-head-thumb" : "gb-step-head"}>
          {thumb ? <ImageThumbnail image={thumb.image} label={thumb.label} /> : null}
          {editor.isEditable ? (
            <Input
              className="gb-inline-input gb-step-title"
              aria-label="Step title"
              value={node.attrs.title}
              placeholder="Step title…"
              onValueChange={setTitle}
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
    return controlNodeView(StepView)
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
      ) : isRrwebUrl(url) ? (
        // An rrweb recording file, through the host's asset resolver like STL and Strudel files.
        <ReplayFile url={url} title={node.attrs.title ? title : fileName(url)} />
      ) : isStlUrl(url) ? (
        <ResolvedStl url={url} {...(node.attrs.title ? { title } : {})} />
      ) : isCapnpUrl(url) ? (
        <CapnpEmbed url={url} {...(node.attrs.title ? { title } : {})} />
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
          <Link2 className="size-4" aria-hidden="true" /> {url || "Embed URL…"}
        </a>
      )}
      {editor.isEditable && (
        <div className="gb-embed-fields">
          <Input
            className="gb-inline-input gb-embed-input"
            value={url}
            placeholder="https://… or ./file.stl, ./session.rrweb"
            aria-label="Embed URL"
            onValueChange={(next) => updateAttributes({ url: next })}
          />
          <PickFileButton kind="embed" current={url} label="Choose file…" onPick={(next) => updateAttributes({ url: next })} />
          <UploadFileButton kind="embed" label="Upload…" onPick={(next) => updateAttributes({ url: next })} />
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
      // A recording's HAR, console log, debugger evidence and captions (`.rrweb` embeds), carried through edits.
      har: { default: null },
      log: { default: null },
      evidence: { default: null },
      captions: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-gb-embed]" }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-gb-embed": node.attrs.url })]
  },
  addNodeView() {
    return controlNodeView(EmbedView)
  },
})

// ---------- Content ref ----------

function ContentRefView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-content-ref" contentEditable={false}>
      <Link2 className="size-4 shrink-0" aria-hidden="true" />
      {editor.isEditable ? (
        <>
          <Input
            className="gb-inline-input"
            aria-label="Page link label"
            value={node.attrs.label}
            placeholder="Label…"
            onValueChange={(label) => updateAttributes({ label })}
          />
          <Input
            className="gb-inline-input gb-content-ref-url"
            aria-label="Page link URL"
            value={node.attrs.url}
            placeholder="page.md or https://…"
            onValueChange={(url) => updateAttributes({ url })}
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
    return controlNodeView(ContentRefView)
  },
})

// ---------- Source ref ----------

const KIND_OPTIONS: ChoiceOption<"component" | "story">[] = [
  { value: "component", label: "component" },
  { value: "story", label: "story" },
]

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
        <FileCode2 className="size-4 shrink-0" aria-hidden="true" />
        {editable ? (
          <>
            <Input className="gb-inline-input gb-source-ref-mount" aria-label="Source mount" value={node.attrs.mount} placeholder="mount" onValueChange={(mount) => updateAttributes({ mount })} />
            <Input className="gb-inline-input gb-source-ref-path" aria-label="Source path" value={node.attrs.path} placeholder="src/Button.tsx" onValueChange={(path) => updateAttributes({ path })} />
            <Input className="gb-inline-input gb-source-ref-export" aria-label="Export name" value={node.attrs.exportName} placeholder="Button" onValueChange={(exportName) => updateAttributes({ exportName })} />
            <ChoiceSelect className="gb-source-ref-kind" label="Source kind" value={reference.kind ?? "component"} options={KIND_OPTIONS} onValueChange={(kind) => updateAttributes({ kind })} />
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
    return controlNodeView(SourceRefView)
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
  const entryPath = entry || files[0]?.path || ""
  // Files carry no id (a path can repeat while it's typed): a file is its place in the list.
  return (
    <Tabs className="gb-demo-files" value={file ? String(index) : null} onValueChange={(value) => value !== null && setSelected(Number(value))}>
      <div className="gb-demo-files-tabs gb-tabs-strip" data-removable="">
        <TabsList className="gb-tabs-list" aria-label="Demo files">
          {files.map((f, i) => (
            <TabsTab
              key={i}
              value={String(i)}
              className={(state) => (state.selected ? "gb-demo-file-tab gb-demo-file-tab-active" : "gb-demo-file-tab")}
              style={tabColumn(i)}
              data-renaming={i === index ? "" : undefined}
            >
              <span className="gb-tabs-tab-label">{f.path || "untitled"}</span>
              {f.path && entry === f.path ? <span className="gb-demo-file-entry">entry</span> : null}
            </TabsTab>
          ))}
        </TabsList>
        {file ? (
          <Input
            className="gb-demo-file-path"
            style={tabColumn(index)}
            value={file.path}
            placeholder="index.tsx"
            aria-label="File path"
            onValueChange={(path) => update({ path })}
          />
        ) : null}
        {files.map((f, i) => (
          <Button
            key={i}
            className="gb-icon-btn gb-tabs-remove"
            style={tabColumn(i)}
            aria-label={`Remove ${f.path || "file"}`}
            title={`Remove ${f.path || "file"}`}
            onClick={() => remove(i)}
          >
            <X className="size-3" aria-hidden="true" />
          </Button>
        ))}
        <Button className="gb-icon-btn" aria-label="Add file" title="Add file" onClick={add}>
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {files.map((f, i) => (
        <TabsPanel key={i} value={String(i)} className="gb-demo-file-body">
          <div className="gb-demo-file-meta">
            <Input
              className="gb-inline-input gb-demo-file-lang"
              value={f.language ?? ""}
              placeholder="lang"
              aria-label="Language"
              onValueChange={(language) => update({ language })}
            />
            {/* On or off for this file: on makes it the entry; off goes back to the first file, so
                the first file, while it's the entry by default, can't be turned off. */}
            <FlagCheckbox
              className="gb-demo-file-entry-toggle"
              label="Entry file"
              checked={entryPath === f.path}
              readOnly={i === 0 && entryPath === f.path}
              onCheckedChange={(on) => onChange(files, on && i !== 0 ? f.path : null)}
            >
              Entry
            </FlagCheckbox>
          </div>
          <Textarea
            className="gb-demo-file-code"
            value={f.content}
            spellCheck={false}
            rows={Math.min(24, Math.max(4, f.content.split("\n").length + 1))}
            aria-label={`Edit ${f.path}`}
            onValueChange={(content) => update({ content })}
            onKeyDown={(e) => {
              // Tab indents the code. Shift+Tab and Escape still leave the field.
              if (e.key !== "Tab" || e.shiftKey) return
              e.preventDefault()
              const el = e.currentTarget
              const { selectionStart: a, selectionEnd: b } = el
              update({ content: `${el.value.slice(0, a)}  ${el.value.slice(b)}` })
              requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
            }}
          />
        </TabsPanel>
      ))}
      {file ? null : (
        <div className="gb-demo-files-empty">No inline files — the demo resolves from its <code>src</code>.</div>
      )}
    </Tabs>
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
    <Collapsible
      open={editable && filesOpen}
      onOpenChange={setFilesOpen}
      disabled={!editable}
      render={<NodeViewWrapper className={preview || (editable && filesOpen) ? "gb-demo-block gb-demo-block-preview" : "gb-demo-block"} contentEditable={false} />}
    >
      <div className="gb-demo">
        <span
          className="gb-demo-grip"
          draggable
          aria-hidden="true"
          title="Drag this demo (with its files) — into another editor to copy it"
          data-gb-demo-grip=""
          onDragStart={onDragStart}
          onDragEnd={() => window.setTimeout(() => setActiveDemoDrag(null), 0)}
        >
          <GripVertical className="size-3.5" />
        </span>
        <AppWindow className="size-4 shrink-0" aria-hidden="true" />
        {editable ? (
          <>
            <Input className="gb-inline-input gb-demo-src" aria-label="Demo source" value={node.attrs.src} placeholder="page/example" onValueChange={(next) => updateAttributes({ src: next })} />
            <Input className="gb-inline-input gb-demo-title" aria-label="Demo title" value={node.attrs.title} placeholder="Title" onValueChange={(title) => updateAttributes({ title })} />
            <CollapsibleTrigger
              className={(state) => (state.open ? "gb-demo-files-toggle gb-demo-files-toggle-active" : "gb-demo-files-toggle")}
              title="Edit the files carried inline by this demo"
            >
              <FileCode2 className="size-3.5" aria-hidden="true" />
              {hasFiles ? `${demo.files!.length} file${demo.files!.length === 1 ? "" : "s"}` : "Files"}
            </CollapsibleTrigger>
          </>
        ) : (
          <>
            <code className="gb-demo-src">{demo.src || "demo"}</code>
            {demo.title ? <span className="gb-demo-title">{demo.title}</span> : null}
          </>
        )}
      </div>
      <CollapsiblePanel className="gb-demo-files-panel">
        <DemoFilesEditor files={demo.files ?? []} entry={demo.entry ?? ""} onChange={setFiles} />
      </CollapsiblePanel>
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
    </Collapsible>
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
    return controlNodeView(DemoView)
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
          <Field className="gb-command-field gb-command-field-npm">
            <FieldLabel>npm</FieldLabel>
            <Textarea
              className="gb-command-input"
              value={command.command}
              placeholder="npm install <package>"
              spellCheck={false}
              rows={Math.max(1, command.command.split("\n").length)}
              onValueChange={(next) => updateAttributes({ command: next })}
            />
          </Field>
          {COMMAND_MANAGERS.map((pm) => (
            <Field key={pm} className="gb-command-field">
              <FieldLabel>{pm}</FieldLabel>
              <Input
                className="gb-inline-input gb-command-override"
                value={command.overrides?.[pm] ?? ""}
                placeholder={derived[pm] || `${pm} (derived)`}
                spellCheck={false}
                title={`Override the derived ${pm} command (leave empty to derive it)`}
                onValueChange={(value) => setOverride(pm, value)}
              />
            </Field>
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
    return controlNodeView(CommandView)
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
            <Input
              className="gb-inline-input"
              value={src}
              placeholder="Image URL…"
              aria-label="Image URL"
              onValueChange={(next) => updateAttributes({ src: next })}
            />
            <PickFileButton kind="image" current={src} label="Choose image…" onPick={(next) => updateAttributes({ src: next })} />
            <UploadFileButton kind="image" label="Upload…" onPick={(next) => updateAttributes({ src: next })} />
          </div>
          <Input
            className="gb-inline-input"
            aria-label="Caption"
            value={caption}
            placeholder="Caption…"
            onValueChange={(next) => updateAttributes({ caption: next })}
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
    return controlNodeView(FigureView)
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
            <Textarea
              className="gb-math-input docs-split-source"
              aria-label="TeX"
              value={formula}
              rows={Math.max(1, formula.split("\n").length)}
              onValueChange={(next) => updateAttributes({ formula: next })}
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
    return controlNodeView(MathView)
  },
})

// ---------- Code block with GitBook title/lineNumbers ----------

function CodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const code = node.textContent
  const previewCode = useDebouncedValue(code)
  const language = String(node.attrs.language ?? "").toLowerCase()
  const mermaid = language === "mermaid"
  const xstate = isXStateLanguage(language)
  const tscircuit = isTsCircuitLanguage(language)
  // A workerd config draws as its services; other Cap'n Proto stays code.
  const capnp = isCapnpLanguage(language) && isWorkerdConfig(code)
  const diagram = mermaid || xstate || tscircuit || capnp
  const diagramKind = xstate ? "xstate" : tscircuit ? "tscircuit" : capnp ? "capnp" : "mermaid"
  const strudel = isStrudelLanguage(language)
  const { liveRenderer } = useEditorRuntime()
  const live = !!liveRenderer && !!node.attrs.live && (language === "jsx" || language === "tsx" || language === "react")
  const entry = String(node.attrs.entry || (language === "tsx" ? "/src/main.tsx" : "/src/main.jsx"))
  const files = useMemo(() => ({ [entry]: previewCode }), [entry, previewCode])

  // The editable code stays in ProseMirror; the shared preview follows debounced edits.
  if (diagram) {
    return (
      <NodeViewWrapper className={`gb-code gb-code-mermaid gb-code-${diagramKind} docs-${diagramKind}-preview docs-split-card`} {...{ [`data-docstream-${diagramKind}`]: "" }}>
        <div className="docs-split-grid">
        <div className="docs-split-pane docs-split-source-pane">
          <div className="docs-split-head" contentEditable={false}>
            <span className="docs-split-label">{xstate ? "XState" : tscircuit ? "tscircuit" : capnp ? "workerd config" : "Mermaid"}</span>
            {editor.isEditable ? (
              <Input
                className="gb-inline-input gb-code-lang"
                aria-label="Language"
                value={node.attrs.language ?? ""}
                placeholder="lang"
                onValueChange={(language) => updateAttributes({ language: language || null })}
              />
            ) : null}
          </div>
          <pre className="docs-split-source">
            <NodeViewContent {...({ as: "code" } as object)} />
          </pre>
        </div>
        <div className="gb-diagram-result" contentEditable={false}>
          {xstate ? <XStatePreview code={previewCode} /> : tscircuit ? <TsCircuitPreview code={previewCode} /> : capnp ? <CapnpPreview code={previewCode} /> : <PeleDiagram code={previewCode} />}
        </div>
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
            <Input
              className="gb-inline-input gb-code-title"
              aria-label="Code title"
              value={node.attrs.title ?? ""}
              placeholder="Title (optional)"
              onValueChange={(title) => updateAttributes({ title: title || null })}
            />
            <Input
              className="gb-inline-input gb-code-lang"
              aria-label="Language"
              value={node.attrs.language ?? ""}
              placeholder="lang"
              onValueChange={(language) => updateAttributes({ language: language || null })}
            />
            <FlagCheckbox className="gb-code-linenos" label="Line numbers" checked={!!node.attrs.lineNumbers} onCheckedChange={(lineNumbers) => updateAttributes({ lineNumbers })}>
              #
            </FlagCheckbox>
            <FlagCheckbox className="gb-code-live" checked={!!node.attrs.live} onCheckedChange={(live) => updateAttributes({ live })}>
              Live
            </FlagCheckbox>
            {node.attrs.live && (
              <Input
                className="gb-inline-input gb-code-entry"
                aria-label="Entry file"
                value={node.attrs.entry ?? ""}
                placeholder="entry (e.g. src/main.jsx)"
                onValueChange={(entry) => updateAttributes({ entry: entry || null })}
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
    return controlNodeView(CodeView)
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), gpuHighlightPlugin(this.name)]
  },
})

// ---------- Inline image (GitHub badge style) ----------

function InlineImageView({ node }: NodeViewProps) {
  const { src, alt, width, height, link } = node.attrs
  const title = (node.attrs.md as { title?: string } | null)?.title
  // `![alt](src "thumbnail: 0:39.8")`: docstream's thumbnail, with its badge and hover card.
  const label = thumbnailLabel({ type: "image", src, ...(title ? { title } : {}) })
  if (label !== null) {
    return (
      <NodeViewWrapper as="span" className="gb-inline-thumb" contentEditable={false}>
        <ImageThumbnail image={{ type: "image", src, alt, ...(title ? { title } : {}), ...(link ? { link } : {}) }} label={label} />
      </NodeViewWrapper>
    )
  }
  return <PlainInlineImage src={src} alt={alt} width={width} height={height} link={link} />
}

function PlainInlineImage({ src, alt, width, height, link }: { src: string; alt: string; width: string; height: string; link: string }) {
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
    return controlNodeView(InlineImageView)
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
    return controlNodeView(ReferenceView)
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
          <Input
            type="date"
            className="gb-inline-input"
            aria-label="Update date"
            value={node.attrs.date}
            onValueChange={(date) => updateAttributes({ date })}
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
    return controlNodeView(UpdateView)
  },
})

// ---------- OpenAPI operation ----------

function OpenapiView({ node, updateAttributes, editor }: NodeViewProps) {
  const { spec, path, method, specUrl } = node.attrs
  return (
    <NodeViewWrapper className="gb-openapi" contentEditable={false}>
      {editor.isEditable && (
        <div className="gb-openapi-fields">
          <Input
            className="gb-inline-input"
            aria-label="Spec name"
            value={spec}
            placeholder="spec name"
            onValueChange={(next) => updateAttributes({ spec: next })}
          />
          <Input
            className="gb-inline-input"
            aria-label="HTTP method"
            value={method}
            placeholder="get"
            onValueChange={(next) => updateAttributes({ method: next })}
          />
          <Input
            className="gb-inline-input gb-openapi-path"
            aria-label="Operation path"
            value={path}
            placeholder="/path"
            onValueChange={(next) => updateAttributes({ path: next })}
          />
          <Input
            className="gb-inline-input gb-openapi-url"
            aria-label="Spec URL"
            value={specUrl}
            placeholder="https://…/openapi.yaml"
            onValueChange={(next) => updateAttributes({ specUrl: next })}
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
    return controlNodeView(OpenapiView)
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
          <Input
            className="gb-inline-input gb-definition-label"
            aria-label="Reference label"
            value={label}
            placeholder="label"
            onValueChange={(next) => updateAttributes({ label: next })}
          />
          <span className="gb-definition-bracket">]:</span>
          <Input
            className="gb-inline-input gb-definition-url"
            aria-label="Reference URL"
            value={url}
            placeholder="https://…"
            onValueChange={(next) => updateAttributes({ url: next })}
          />
          <Input
            className="gb-inline-input gb-definition-title"
            aria-label="Reference title"
            value={title ?? ""}
            placeholder="Title (optional)"
            onValueChange={(next) => updateAttributes({ title: next || null })}
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
    return controlNodeView(DefinitionView)
  },
})

// ---------- Lines kept verbatim (unknown `{% tags %}`) ----------

function RawView({ node, updateAttributes, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper className="gb-raw" contentEditable={false}>
      {editor.isEditable ? (
        <Input
          className="gb-inline-input gb-raw-input"
          aria-label="Markdown"
          value={node.attrs.markdown}
          onValueChange={(markdown) => updateAttributes({ markdown })}
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
    return controlNodeView(RawView)
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
