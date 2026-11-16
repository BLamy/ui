import { Extension, type Editor } from "@tiptap/core"
import type { IconName } from "@brett_lamy/ui/lib/icon"

import type { PMNode } from "./convert"
import { editorTriggerPlugin, type EditorTrigger } from "./trigger-menu"

const para = (text = ""): PMNode =>
  text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" }

interface SlashItem {
  title: string
  keywords: string
  icon: IconName
  run: (editor: Editor) => void
}

const insertBlock = (content: PMNode) => (editor: Editor) =>
  editor.chain().focus().insertContent(content).run()

/** What a new XState diagram starts as: enough to show how to write a state that waits on something, as well as one that doesn't. */
export const XSTATE_STARTER = JSON.stringify({
  id: "request",
  initial: "idle",
  states: {
    idle: { on: { FETCH: "loading" } },
    loading: { invoke: { src: "fetchPage", onDone: "success", onError: "failure" } },
    failure: { on: { RETRY: "loading" } },
    success: { type: "final" },
  },
}, null, 2)

/** What a new workerd config starts as: a Worker and its Durable Object, which draws as the two, bound. */
export const WORKERD_STARTER = `using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [ (name = "main", worker = .main) ],
  sockets = [ (name = "http", address = "*:8080", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ROOMS", durableObjectNamespace = "Room") ],
  durableObjectNamespaces = [ (className = "Room", uniqueKey = "rooms", enableSql = true) ],
  durableObjectStorage = (inMemory = ()),
);`

export const SLASH_ITEMS: SlashItem[] = [
  { title: "Heading 1", keywords: "h1 title", icon: "heading-1", run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { title: "Heading 2", keywords: "h2 section", icon: "heading-2", run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { title: "Heading 3", keywords: "h3 subsection", icon: "heading-3", run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  { title: "Bullet list", keywords: "ul unordered", icon: "list", run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "Numbered list", keywords: "ol ordered", icon: "list-number", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "Task list", keywords: "todo checkbox", icon: "checklist", run: (e) => e.chain().focus().toggleList("taskList", "taskItem").run() },
  { title: "Quote", keywords: "blockquote", icon: "quote", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "Divider", keywords: "hr rule separator", icon: "minus", run: (e) => e.chain().focus().setHorizontalRule().run() },
  { title: "Code block", keywords: "snippet pre", icon: "doc-code", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  {
    title: "Hint",
    keywords: "callout info warning danger success admonition",
    icon: "lightbulb",
    run: insertBlock({ type: "gbHint", attrs: { style: "info" }, content: [para()] }),
  },
  {
    title: "Tabs",
    keywords: "tabbed switcher",
    icon: "rectangle-top",
    run: insertBlock({
      type: "gbTabs",
      content: [
        { type: "gbTab", attrs: { title: "First tab" }, content: [para()] },
        { type: "gbTab", attrs: { title: "Second tab" }, content: [para()] },
      ],
    }),
  },
  {
    title: "Install command",
    keywords: "command npm pnpm yarn bun npx package manager install terminal shell",
    icon: "terminal",
    run: insertBlock({ type: "gbCommand", attrs: { command: "", overrides: null, sync: null } }),
  },
  {
    title: "Expandable",
    keywords: "details accordion collapse",
    icon: "chevron-down-square",
    run: insertBlock({ type: "gbExpandable", attrs: { summary: "Click to expand" }, content: [para()] }),
  },
  {
    title: "Stepper",
    keywords: "steps guide step-by-step",
    icon: "checklist",
    run: insertBlock({
      type: "gbStepper",
      content: [
        { type: "gbStep", attrs: { title: "First step" }, content: [para()] },
        { type: "gbStep", attrs: { title: "Second step" }, content: [para()] },
      ],
    }),
  },
  {
    title: "Embed",
    keywords: "youtube video iframe url",
    icon: "play-rectangle",
    run: insertBlock({ type: "gbEmbed", attrs: { url: "" } }),
  },
  {
    title: "Page link",
    keywords: "content-ref reference",
    icon: "link",
    run: insertBlock({ type: "gbContentRef", attrs: { url: "", label: "Page link" } }),
  },
  {
    title: "Demo",
    keywords: "example live preview component playground",
    icon: "macwindow",
    run: insertBlock({ type: "gbDemo", attrs: { src: "", title: "" } }),
  },
  {
    title: "Columns",
    keywords: "two column layout",
    icon: "rectangle-split",
    run: insertBlock({
      type: "gbColumns",
      content: [
        { type: "gbColumn", content: [para()] },
        { type: "gbColumn", content: [para()] },
      ],
    }),
  },
  {
    title: "Image",
    keywords: "figure picture photo",
    icon: "photo",
    run: insertBlock({ type: "gbFigure", attrs: { src: "", alt: "", caption: "" } }),
  },
  {
    title: "Math",
    keywords: "tex latex formula equation",
    icon: "sum",
    run: insertBlock({ type: "gbMath", attrs: { formula: "e = mc^2" } }),
  },
  {
    title: "Table",
    keywords: "grid cells",
    icon: "table",
    run: (e) => e.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run(),
  },
  {
    title: "Updates",
    keywords: "changelog release notes",
    icon: "megaphone",
    run: insertBlock({
      type: "gbUpdates",
      attrs: { format: "full" },
      content: [
        {
          type: "gbUpdate",
          attrs: { date: new Date().toISOString().slice(0, 10) },
          content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "What changed" }] },
            para(),
          ],
        },
      ],
    }),
  },
  {
    title: "OpenAPI operation",
    keywords: "api swagger endpoint rest",
    icon: "webhook",
    run: insertBlock({
      type: "gbOpenapi",
      attrs: { spec: "", path: "/", method: "get", specUrl: "", label: "" },
    }),
  },
  {
    title: "Mermaid diagram",
    keywords: "chart graph flowchart",
    icon: "flowchart",
    run: insertBlock({
      type: "codeBlock",
      attrs: { language: "mermaid", title: null, lineNumbers: false },
      content: [{ type: "text", text: "graph TD\n  A --> B" }],
    }),
  },
  {
    title: "XState diagram",
    keywords: "state machine statechart graph transitions",
    icon: "flowchart",
    run: insertBlock({
      type: "codeBlock",
      attrs: { language: "xstate", title: null, lineNumbers: false },
      content: [{ type: "text", text: XSTATE_STARTER }],
    }),
  },
  {
    title: "workerd config",
    keywords: "capnp cloudflare worker durable object services diagram",
    icon: "flowchart",
    run: insertBlock({
      type: "codeBlock",
      attrs: { language: "capnp", title: null, lineNumbers: false },
      content: [{ type: "text", text: WORKERD_STARTER }],
    }),
  },
  {
    title: "tscircuit example",
    keywords: "circuit pcb schematic electronics tsx",
    icon: "flowchart",
    run: insertBlock({
      type: "codeBlock",
      attrs: { language: "tscircuit", title: null, lineNumbers: false },
      content: [{ type: "text", text: 'circuit.add(\n  <board width="10mm" height="10mm">\n    <resistor name="R1" resistance="1k" footprint="0402" />\n  </board>\n)' }],
    }),
  },
  {
    title: "Strudel music",
    keywords: "audio song beat pattern live code tidal",
    icon: "music-note",
    run: insertBlock({
      type: "codeBlock",
      attrs: { language: "strudel", title: null, lineNumbers: false },
      content: [{ type: "text", text: 'note("c e g b").s("triangle")' }],
    }),
  },
  {
    title: "Citation",
    keywords: "cite footnote source reference superscript",
    icon: "superscript",
    run: (e) => {
      // Next free numeric citation id in the document.
      let max = 0
      e.state.doc.descendants((node) => {
        if (node.type.name === "gbReference" && node.attrs.kind === "citation") {
          const n = Number(node.attrs.id)
          if (Number.isInteger(n) && n > max) max = n
        }
      })
      e.chain()
        .focus()
        .insertContent([{ type: "gbReference", attrs: { kind: "citation", id: String(max + 1) } }])
        .run()
    },
  },
]

export type { SlashItem }

/** The "/" trigger for `items`: each is matched by its title and keywords, and choosing one replaces the typed command with it. */
function slashTrigger(items: SlashItem[]): EditorTrigger {
  return {
    char: "/",
    label: "Blocks",
    empty: "No matching blocks",
    items: items.map((item, index) => ({
      value: String(index),
      label: item.title,
      keywords: item.keywords.split(/\s+/).filter(Boolean),
    })),
    entry: (value) => {
      const item = items[Number(value)]
      return item && { title: item.title, icon: item.icon }
    },
    onSelect: (value, details, editor) => {
      const item = items[Number(value)]
      if (!item) return
      details.insert("")
      item.run(editor)
    },
  }
}

/**
 * Build a slash-command extension. Pass a custom `items` list to override the
 * default GitBook blocks. The default instance is exported as `SlashMenu`.
 */
export function createSlashMenu(items: SlashItem[] = SLASH_ITEMS) {
  return Extension.create({
    name: "slashMenu",
    addProseMirrorPlugins() {
      return [editorTriggerPlugin("slashMenu", this.editor as Editor, () => slashTrigger(items))]
    },
  })
}

export const SlashMenu = createSlashMenu()
