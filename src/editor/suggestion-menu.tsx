import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react"
import type { PluginKey } from "@tiptap/pm/state"
import { SuggestionPluginKey, exitSuggestion, type SuggestionProps } from "@tiptap/suggestion"
import { ReactRenderer } from "@tiptap/react"
import type { LucideIcon } from "lucide-react"
import {
  announce,
  bindLayer,
  createChange,
  createController,
  createListbox,
  definePrimitive,
  dispatch,
  openAttrs,
  position,
  selects,
  type Anchor,
  type ChangeDetails,
} from "@ui-sdk/core"
import { matchRanges, matchSegments } from "@ui-sdk/core/text-match"
import { createParts } from "@ui-sdk/react/primitive"

// A list of suggestions at the caret of an editor that keeps focus: ProseMirror hands it the query, the
// caret's rectangle and its keys, and UI SDK's listbox, layer and positioning do the rest.

type SuggestionMenuOpenChangeReason = "escape-key" | "outside-press" | "window-blur"

type SuggestionMenuOptions = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean, details: ChangeDetails<SuggestionMenuOpenChangeReason>) => void
  onSelect?: (value: string, details: ChangeDetails<"item-press">) => void
  anchor?: Anchor | null
  input?: HTMLElement | null
  query?: string
  status?: string
  loop?: boolean
  controller?: SuggestionMenuController
}

type SuggestionMenuController = {
  keydown: (event: KeyboardEvent) => boolean
}

const createSuggestionMenuController = () => createController<SuggestionMenuController>()

type State = { open: boolean; highlighted: string | null; navigated: boolean }
type OptionProps = { value: string; label?: string; disabled?: boolean }

const STATUS_PAUSE = 400

const suggestionMenu = definePrimitive({
  name: "suggestion-menu",
  options: {
    open: "boolean",
    defaultOpen: "boolean",
    onOpenChange: "callback",
    onSelect: "callback",
    anchor: "value",
    input: "value",
    query: "string",
    status: "string",
    loop: "boolean",
    controller: "value",
  },
  controlled: ["open"],
  state: (options: SuggestionMenuOptions): State => ({
    open: options.open ?? options.defaultOpen ?? true,
    highlighted: null,
    navigated: false,
  }),
  sync: (options) => (options.open === undefined ? {} : { open: options.open }),
  api: (context) => {
    const change = createChange(context)
    const listbox = createListbox<State>(context, {
      key: "highlighted",
      focus: "virtual",
      loop: () => context.options().loop ?? true,
    })
    listbox.move("first")

    let { query, status } = context.options()
    let statusTimer: ReturnType<typeof setTimeout> | undefined
    const say = (text: string | undefined) => {
      clearTimeout(statusTimer)
      if (!text) return
      statusTimer = setTimeout(() => {
        if (context.store.get().open) announce(text)
      }, STATUS_PAUSE)
    }
    say(status)
    context.onDestroy(() => clearTimeout(statusTimer))
    context.onOptions((options) => {
      if (options.query !== query) {
        query = options.query
        context.store.set({ navigated: false })
        listbox.move("first")
      }
      if (options.status !== status) {
        status = options.status
        say(status)
      }
    })

    const choose = (key: string | null, event?: Event) => {
      const option = key === null ? undefined : context.props<OptionProps>("option", key)
      if (!option || option.disabled) return false
      dispatch(context, "onSelect", option.value, { reason: "item-press", event })
      return true
    }

    return {
      listbox,
      choose,
      anchor: () => context.options().anchor,
      input: () => context.options().input ?? undefined,
      dismiss: (reason: SuggestionMenuOpenChangeReason, event?: Event) => change("open", false, { reason, event }),
      keydown(event: KeyboardEvent): boolean {
        const state = context.store.get()
        if (!state.open || event.isComposing) return false
        if (event.key === "Escape") {
          change("open", false, { reason: "escape-key", event })
          return true
        }
        if (event.key === "Enter") {
          choose(state.highlighted, event)
          return true
        }
        if (event.key === "Tab" && !event.shiftKey) return choose(state.highlighted, event)
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "PageDown" && event.key !== "PageUp") return false
        if (listbox.keydown(event) === undefined) return false
        context.store.set({ navigated: true })
        return true
      },
    }
  },
  slots: (slot) => ({
    content: slot<{}, { open: boolean }>({
      present: (state) => state.open,
      state: (state) => ({ open: state.open }),
      // A popover from its first render: never in the page's flow, where revealing the highlighted option would scroll the page to it.
      attrs: (state) => ({ popover: "manual", ...openAttrs(state.open) }),
      bind: (el, { api, store, id }) => {
        const layer = bindLayer(el, {
          topLayer: true,
          contains: (target) => !!api.input()?.contains(target),
          onDismiss: (reason, event) => api.dismiss(reason, event),
        })
        const placed = position(() => api.anchor(), el, { side: "bottom", align: "start", sideOffset: 6, collisionPadding: 6 })
        // The editor keeps focus, so it points at the list and, once an arrow key has moved the highlight, at the option.
        const input = api.input()
        const describe = () => {
          const state = store.get()
          const active = state.navigated ? api.listbox.activeId(state) : undefined
          if (active) input?.setAttribute("aria-activedescendant", active)
          else input?.removeAttribute("aria-activedescendant")
        }
        input?.setAttribute("aria-controls", `${id}-list`)
        describe()
        const unsubscribe = store.subscribe(describe)
        return () => {
          unsubscribe()
          input?.removeAttribute("aria-controls")
          input?.removeAttribute("aria-activedescendant")
          placed()
          layer()
        }
      },
    }),
    list: slot({
      role: "listbox",
      keys: { none: "The editor keeps focus and hands its keys to keydown." },
      attrs: (_state, part) => ({ id: `${part.id}-list` }),
    }),
    option: slot<OptionProps, { highlighted: boolean; disabled: boolean }>({
      role: "option",
      focus: "active-descendant",
      props: { value: "string", label: "string", disabled: "boolean" },
      selects: selects({ highlighted: ({ key }) => [key, null] }),
      state: (state, part) => ({ highlighted: state.highlighted === part.key, disabled: !!part.props.disabled }),
      attrs: (state, part) => ({
        ...part.api.listbox.attrs(state, part),
        "aria-selected": String(state.highlighted === part.key),
      }),
      press: ({ key, api }, event) => void api.choose(key, event),
      on: {
        // A press must not take focus, or the caret, out of the editor.
        pointerdown: (event) => event.preventDefault(),
        mousedown: (event) => event.preventDefault(),
        pointermove: (event, { key, api }) => api.listbox.highlight(key, { event }),
      },
      bind: (el, part) => part.api.listbox.bind(el, part),
    }),
    group: slot({ role: "group" }),
    "group-label": slot({}),
    empty: slot({}),
  }),
  agent: { actions: ["choose"] },
})

// Shared popup used by the "/" slash menu and the "@"/"#"/"$" reference menus.

export interface SuggestionMenuItem {
  title: string
  icon: LucideIcon
  /** Secondary text shown after the title (e.g. a display name or email). */
  description?: string
  /** Section header; shown when it differs from the previous item's group. */
  group?: string
}

export interface MenuProps<Item extends SuggestionMenuItem> {
  items: Item[]
  command: (item: Item) => void
  clientRect: (() => DOMRect | null) | null
  emptyLabel?: string
  /** The text typed after the trigger: its matches are marked in each item, and a change moves the highlight back to the first item. */
  query?: string
  /** Names the list for assistive technology (default "Suggestions"). */
  label?: string
  /** The element that keeps focus while the menu is open (the editor); it is pointed at the list and the highlighted item. */
  input?: HTMLElement | null
  /** Escape, a press outside the menu and the editor, or the window losing focus asked the menu to close. */
  onDismiss?: () => void
}

export interface MenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

const Menu = createParts(suggestionMenu, {
  content: "div",
  list: "div",
  option: "div",
  group: "div",
  "group-label": "div",
  empty: "div",
})

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

const NO_RECT = { x: 0, y: 0, width: 0, height: 0 }

export const SuggestionMenuView = forwardRef<MenuHandle, MenuProps<SuggestionMenuItem>>(
  function SuggestionMenuView({ items, command, clientRect, emptyLabel = "No matches", query = "", label = "Suggestions", input, onDismiss }, ref) {
    const [controller] = useState(createSuggestionMenuController)
    useImperativeHandle(ref, () => ({ onKeyDown: (event) => controller.keydown(event) ?? false }), [controller])

    const anchor = useMemo(() => (clientRect ? { getBoundingClientRect: () => clientRect() ?? NO_RECT } : null), [clientRect])

    // Items carry no id of their own: a title names one, numbered when it repeats.
    const { entries, byValue } = useMemo(() => {
      const seen = new Map<string, number>()
      const byValue = new Map<string, SuggestionMenuItem>()
      const entries = items.map((item) => {
        const base = item.group ? `${item.group}: ${item.title}` : item.title
        const count = (seen.get(base) ?? 0) + 1
        seen.set(base, count)
        const value = count === 1 ? base : `${base} (${count})`
        byValue.set(value, item)
        return { value, item }
      })
      return { entries, byValue }
    }, [items])

    const sections = useMemo(() => {
      const sections: { group: string | undefined; entries: typeof entries }[] = []
      for (const entry of entries) {
        const last = sections[sections.length - 1]
        if (last && last.group === entry.item.group) last.entries.push(entry)
        else sections.push({ group: entry.item.group, entries: [entry] })
      }
      return sections
    }, [entries])

    const status = items.length
      ? `${items.length} ${items.length === 1 ? "suggestion" : "suggestions"}. Up and Down to choose, Enter to insert.`
      : emptyLabel

    if (!clientRect?.()) return null

    const option = ({ value, item }: (typeof entries)[number]): ReactNode => (
      <Menu.Option
        key={value}
        value={value}
        label={item.title}
        className={(state) => (state.highlighted ? "slash-item slash-item-active" : "slash-item")}
      >
        <item.icon className="size-4" aria-hidden="true" />
        <span>
          <MatchedText text={item.title} query={query} />
        </span>
        {item.description && (
          <span className="slash-item-description">
            <MatchedText text={item.description} query={query} />
          </span>
        )}
      </Menu.Option>
    )

    return (
      <Menu.Root
        controller={controller}
        anchor={anchor}
        input={input}
        query={query}
        status={status}
        onOpenChange={(open) => {
          if (!open) onDismiss?.()
        }}
        onSelect={(value) => {
          const item = byValue.get(value)
          if (item) command(item)
        }}
      >
        <Menu.Content className="slash-menu">
          {items.length === 0 && <Menu.Empty className="slash-empty">{emptyLabel}</Menu.Empty>}
          <Menu.List aria-label={label} className="slash-list" hidden={items.length === 0}>
            {sections.map((section) =>
              section.group ? (
                <Menu.Group key={`${section.group}: ${section.entries[0]!.value}`} aria-label={section.group} className="slash-row">
                  <Menu.GroupLabel className="slash-group" aria-hidden="true">
                    {section.group}
                  </Menu.GroupLabel>
                  {section.entries.map(option)}
                </Menu.Group>
              ) : (
                section.entries.map(option)
              ),
            )}
          </Menu.List>
        </Menu.Content>
      </Menu.Root>
    )
  },
)

export interface SuggestionRenderOptions {
  /** Names the list for assistive technology. */
  label?: string
  /** The Suggestion plugin's key, when it isn't the default one: dismissing the menu exits that suggestion. */
  pluginKey?: PluginKey
}

/**
 * The Suggestion render lifecycle wired to SuggestionMenuView — shared by the
 * slash menu and the reference menus.
 */
export function createSuggestionRender<Item extends SuggestionMenuItem>(emptyLabel?: string, { label, pluginKey }: SuggestionRenderOptions = {}) {
  // The view only reads SuggestionMenuItem fields, so retyping it per Item is safe.
  const View = SuggestionMenuView as unknown as ForwardRefExoticComponent<
    MenuProps<Item> & RefAttributes<MenuHandle>
  >
  let renderer: ReactRenderer<MenuHandle, MenuProps<Item>> | null = null
  // The menu opening, between onStart and the microtask that mounts it (see onStart).
  let opening: { props: SuggestionProps<Item> } | null = null
  const menuProps = (props: SuggestionProps<Item>): MenuProps<Item> => ({
    items: props.items,
    command: props.command,
    clientRect: props.clientRect ?? null,
    query: props.query,
    input: props.editor.view.dom,
    onDismiss: () => {
      if (!props.editor.isDestroyed) exitSuggestion(props.editor.view, pluginKey ?? SuggestionPluginKey)
    },
    ...(emptyLabel !== undefined ? { emptyLabel } : {}),
    ...(label !== undefined ? { label } : {}),
  })
  const close = () => {
    opening = null
    renderer?.element.remove()
    renderer?.destroy()
    renderer = null
  }
  return () => ({
    onStart: (props: SuggestionProps<Item>) => {
      // A suggestion can start inside a transaction React dispatched while rendering (content
      // set from props); mounting the menu there would flushSync during render. Mount it just
      // after, with the latest props, unless it closed in between.
      const pending = { props }
      opening = pending
      queueMicrotask(() => {
        if (opening !== pending) return
        opening = null
        const r = new ReactRenderer(View, {
          editor: pending.props.editor,
          props: menuProps(pending.props),
        })
        renderer = r
        // Beside the editor rather than in <body>, so the menu stays usable inside a modal dialog.
        const dom = pending.props.editor.view.dom
        ;(dom.parentElement ?? dom.ownerDocument.body).appendChild(r.element)
      })
    },
    onUpdate: (props: SuggestionProps<Item>) => {
      if (opening) opening.props = props
      renderer?.updateProps(menuProps(props))
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (opening && event.key === "Escape") {
        opening = null
        return true
      }
      return renderer?.ref?.onKeyDown(event) ?? false
    },
    onExit: close,
  })
}
