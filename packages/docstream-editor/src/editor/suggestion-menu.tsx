import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react"
import type { SuggestionProps } from "@tiptap/suggestion"
import { ReactRenderer } from "@tiptap/react"
import type { LucideIcon } from "lucide-react"

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
}

export interface MenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export const SuggestionMenuView = forwardRef<MenuHandle, MenuProps<SuggestionMenuItem>>(
  function SuggestionMenuView({ items, command, clientRect, emptyLabel = "No matches" }, ref) {
    const [index, setIndex] = useState(0)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

    useEffect(() => setIndex(0), [items])

    // Keep the active item visible while arrowing through a long list.
    useEffect(() => {
      itemRefs.current[index]?.scrollIntoView({ block: "nearest" })
    }, [index])

    useImperativeHandle(ref, () => ({
      onKeyDown(event) {
        if (event.key === "ArrowDown") {
          setIndex((i) => (i + 1) % Math.max(items.length, 1))
          return true
        }
        if (event.key === "ArrowUp") {
          setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1))
          return true
        }
        if (event.key === "Enter") {
          if (items[index]) command(items[index])
          return true
        }
        return false
      },
    }))

    const menuRef = useRef<HTMLDivElement>(null)
    const rect = clientRect?.()
    const [pos, setPos] = useState<{ left: number; top: number }>(() => ({
      left: rect ? rect.left : 0,
      top: rect ? rect.bottom + 6 : 0,
    }))

    // Position below the cursor, but flip above when there isn't room below
    // (e.g. triggered near the bottom of the viewport). Measured after render.
    useLayoutEffect(() => {
      const r = clientRect?.()
      const el = menuRef.current
      if (!r || !el) return
      const margin = 6
      const menuH = el.offsetHeight
      const menuW = el.offsetWidth
      const spaceBelow = window.innerHeight - r.bottom
      let top = r.bottom + margin
      if (spaceBelow < menuH + margin && r.top - margin > menuH) {
        top = r.top - menuH - margin
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - menuH - margin))
      let left = Math.min(r.left, window.innerWidth - menuW - margin)
      left = Math.max(margin, left)
      if (left !== pos.left || top !== pos.top) setPos({ left, top })
    }, [clientRect, items, pos.left, pos.top])

    if (!rect) return null

    return (
      <div
        ref={menuRef}
        className="slash-menu"
        style={{ position: "fixed", left: pos.left, top: pos.top }}
      >
        {items.length === 0 && <div className="slash-empty">{emptyLabel}</div>}
        {items.map((item, i) => (
          <div key={`${item.group ?? ""}:${item.title}:${i}`} className="slash-row">
            {item.group && item.group !== items[i - 1]?.group && (
              <div className="slash-group">{item.group}</div>
            )}
            <button
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              className={`slash-item ${i === index ? "slash-item-active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                command(item)
              }}
            >
              <item.icon className="size-4" />
              <span>{item.title}</span>
              {item.description && <span className="slash-item-description">{item.description}</span>}
            </button>
          </div>
        ))}
      </div>
    )
  }
)

/**
 * The Suggestion render lifecycle wired to SuggestionMenuView — shared by the
 * slash menu and the reference menus.
 */
export function createSuggestionRender<Item extends SuggestionMenuItem>(emptyLabel?: string) {
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
    ...(emptyLabel !== undefined ? { emptyLabel } : {}),
  })
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
        document.body.appendChild(r.element)
      })
    },
    onUpdate: (props: SuggestionProps<Item>) => {
      if (opening) opening.props = props
      renderer?.updateProps(menuProps(props))
    },
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "Escape") {
        opening = null
        renderer?.destroy()
        renderer?.element.remove()
        renderer = null
        return true
      }
      return renderer?.ref?.onKeyDown(event) ?? false
    },
    onExit: () => {
      opening = null
      renderer?.element.remove()
      renderer?.destroy()
      renderer = null
    },
  })
}
