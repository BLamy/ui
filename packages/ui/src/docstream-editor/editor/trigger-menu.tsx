import { useMemo, type ReactNode } from "react"
import type { Editor } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { ReactRenderer } from "@tiptap/react"
import { Glyph } from "./glyph"
import { type IconName } from "@brett_lamy/ui/lib/icon"
import { matchRanges, matchSegments } from "@ui-sdk/core/text-match"
import {
  TriggerMenu,
  TriggerMenuContent,
  TriggerMenuEmpty,
  TriggerMenuGroup,
  TriggerMenuGroupLabel,
  TriggerMenuItem,
  TriggerMenuItemIcon,
  TriggerMenuList,
  type TriggerDefinition,
  type TriggerMenuData,
  type TriggerMenuDataItem,
  type TriggerMenuSelectDetails,
  type TokenInsert,
} from "@ui-sdk/react/trigger-menu"
import { tiptapTriggerAdapter } from "./trigger-adapter"

// The "/" slash menu and the "@" / "#" / "$" reference menus are one UI SDK Trigger Menu per editor,
// reading and writing the document through `tiptapTriggerAdapter`. Each menu extension adds its
// trigger to the editor's menu; the first one mounts it, beside the editor.

/** How a suggestion shows in the list. */
export interface TriggerMenuEntry {
  title: string
  icon: IconName
  /** Secondary text shown after the title (e.g. a display name or email). */
  description?: string
}

/** One trigger an extension adds to the editor's menu. */
export interface EditorTrigger {
  char: string
  /** Names the list for assistive technology. */
  label: string
  /** Shown while nothing matches. */
  empty: string
  /** The token type choosing an item inserts (a reference chip's kind); without it, `onSelect` inserts. */
  type?: string
  items: TriggerDefinition["items"]
  /** How the item with this value shows. */
  entry: (value: string) => TriggerMenuEntry | undefined
  onSelect?: (value: string, details: TriggerMenuSelectDetails, editor: Editor) => void
}

/** `text` with the parts `query` matched wrapped in `<mark>`. */
export function MatchedText({ text, query }: { text: string; query: string }) {
  const ranges = query ? matchRanges(text, query, "contains") : []
  if (!ranges.length) return <>{text}</>
  return (
    <>
      {matchSegments(text, ranges).map((segment, i) =>
        segment.match ? <mark key={i}>{segment.text}</mark> : <span key={i}>{segment.text}</span>,
      )}
    </>
  )
}

/** Whether `query` appears in any of `texts`, ignoring case and the accents the reader's language ignores. */
export function matchesQuery(query: string, ...texts: (string | undefined)[]): boolean {
  if (!query) return true
  return texts.some((text) => !!text && matchRanges(text, query, "contains").length > 0)
}

// A reference token becomes a chip and a space.
function referenceNodes(token: TokenInsert, editor: Editor) {
  const { schema } = editor.state
  const chip = schema.nodes.gbReference
  if (!chip) return token.label ? [schema.text(`${token.label} `)] : null
  return [chip.create({ kind: token.type, id: token.value }), schema.text(" ")]
}

interface MenuProps {
  editor: Editor
  triggers: readonly EditorTrigger[]
}

function EditorTriggerMenu({ editor, triggers }: MenuProps) {
  const adapter = useMemo(() => tiptapTriggerAdapter(editor, { token: referenceNodes }), [editor])
  const definitions = useMemo(
    () => triggers.map((t): TriggerDefinition => ({ char: t.char, items: t.items, ...(t.type ? { type: t.type } : {}) })),
    [triggers],
  )
  const byChar = (char: string | null) => triggers.find((t) => t.char === char)

  const item = (trigger: EditorTrigger, data: TriggerMenuDataItem, query: string): ReactNode => {
    const entry = trigger.entry(data.value)
    if (!entry) return null
    return (
      <TriggerMenuItem
        key={data.value}
        value={data.value}
        label={data.label}
        {...(data.keywords ? { keywords: data.keywords } : {})}
        className={(state) => (state.highlighted ? "slash-item slash-item-active" : "slash-item")}
      >
        <TriggerMenuItemIcon>
          <Glyph name={entry.icon} className="size-4" size={16} />
        </TriggerMenuItemIcon>
        <span>
          <MatchedText text={entry.title} query={query} />
        </span>
        {entry.description && (
          <span className="slash-item-description">
            <MatchedText text={entry.description} query={query} />
          </span>
        )}
      </TriggerMenuItem>
    )
  }

  return (
    <TriggerMenu
      editor={adapter}
      triggers={definitions}
      onSelect={(value, details) => {
        const trigger = byChar(details.trigger)
        if (trigger?.onSelect) trigger.onSelect(value, details, editor)
      }}
    >
      <TriggerMenuContent className="slash-menu">
        {(state) => {
          const trigger = byChar(state.trigger)
          if (!trigger) return null
          return (
            <>
              <TriggerMenuEmpty className="slash-empty">{(empty) => (empty.empty && !empty.loading ? trigger.empty : null)}</TriggerMenuEmpty>
              <TriggerMenuList aria-label={trigger.label} className="slash-list">
                {(list) =>
                  (list.items as TriggerMenuData).map((data, index) => {
                    if (typeof data === "string") return null
                    if ("type" in data && data.type === "separator") return null
                    if ("type" in data && data.type === "group") {
                      return (
                        <TriggerMenuGroup key={`${data.label ?? ""}:${index}`} className="slash-row">
                          {data.label && <TriggerMenuGroupLabel className="slash-group">{data.label}</TriggerMenuGroupLabel>}
                          {data.items.map((child) => (typeof child === "string" ? null : item(trigger, child, list.query)))}
                        </TriggerMenuGroup>
                      )
                    }
                    return item(trigger, data as TriggerMenuDataItem, list.query)
                  })
                }
              </TriggerMenuList>
            </>
          )
        }}
      </TriggerMenuContent>
    </TriggerMenu>
  )
}

interface Registry {
  triggers: EditorTrigger[]
  renderer: ReactRenderer<unknown, MenuProps> | null
  scheduled: boolean
}

const registries = new WeakMap<Editor, Registry>()

function place(editor: Editor, registry: Registry) {
  const element = registry.renderer?.element
  if (!element || editor.isDestroyed) return
  // Beside the editor rather than in <body>, so the menu stays usable inside a modal dialog.
  const dom = editor.view.dom
  const parent = dom.parentElement
  if (parent && element.parentElement !== parent) parent.appendChild(element)
}

function render(editor: Editor, registry: Registry) {
  registry.scheduled = false
  if (editor.isDestroyed) return
  const props: MenuProps = { editor, triggers: [...registry.triggers] }
  if (!registry.triggers.length) {
    registry.renderer?.element.remove()
    registry.renderer?.destroy()
    registry.renderer = null
    return
  }
  if (registry.renderer) registry.renderer.updateProps(props)
  else {
    registry.renderer = new ReactRenderer(EditorTriggerMenu, { editor, props })
    const reposition = () => place(editor, registry)
    editor.on("focus", reposition)
    editor.on("destroy", () => {
      editor.off("focus", reposition)
      registry.renderer?.element.remove()
      registry.renderer?.destroy()
      registry.renderer = null
      registries.delete(editor)
    })
  }
  place(editor, registry)
}

/**
 * Adds a trigger to the editor's Trigger Menu, and returns what removes it. The menu renders a
 * microtask later, so a trigger added while React renders (content set from props) doesn't render
 * inside that render.
 */
export function addEditorTrigger(editor: Editor, trigger: EditorTrigger): () => void {
  let registry = registries.get(editor)
  if (!registry) registries.set(editor, (registry = { triggers: [], renderer: null, scheduled: false }))
  const own = registry
  const schedule = () => {
    if (own.scheduled) return
    own.scheduled = true
    queueMicrotask(() => render(editor, own))
  }
  own.triggers.push(trigger)
  schedule()
  return () => {
    const index = own.triggers.indexOf(trigger)
    if (index < 0) return
    own.triggers.splice(index, 1)
    schedule()
  }
}

/**
 * The plugin a menu extension adds: it puts the extension's trigger in the editor's menu while the
 * view lives, and leaves the keys the menu took (Enter, Tab, the arrows, Escape: it prevents their
 * default, ahead of ProseMirror) out of ProseMirror's keymaps.
 */
export function editorTriggerPlugin(key: string, editor: Editor, trigger: () => EditorTrigger) {
  return new Plugin({
    key: new PluginKey(key),
    view: () => {
      const remove = addEditorTrigger(editor, trigger())
      return { destroy: remove }
    },
    props: {
      handleDOMEvents: {
        keydown: (_view, event) => event.defaultPrevented,
      },
    },
  })
}
