import { Node, mergeAttributes } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import { ImageIcon } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"

import { useEditorRuntime } from "./runtime"

/** A file the host owns, referenced from the document by an attachment chip. */
export interface EditorAttachment {
  id: string
  name: string
  /** Full image URL (typically a data URL). Also used for the chip thumbnail. */
  src?: string
  /** Size in bytes. */
  size?: number
  /** MIME type. */
  type?: string
}

/** The URL scheme attachment chips serialize to: `![name](attachment:<id>)`. */
export const ATTACHMENT_SCHEME = "attachment:"

export function newAttachmentId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `att-${rand}`
}

/**
 * The name a pasted/dropped file gets in the document. Clipboard screenshots
 * usually arrive as "image.png"; unnamed ones get that too. Characters that
 * would break `![alt](src)` / `alt="…"` are replaced.
 */
export function attachmentName(file: File): string {
  const name = (file.name || "image.png").replace(/[[\]"<>\r\n]/g, "_").trim()
  return name || "image.png"
}

/** "84 KB", "1.3 MB". */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

/**
 * Image files carried by a paste or drop. Clipboard data that also has plain
 * text (e.g. a Word/Excel selection, which ships a rendered PNG alongside the
 * text) is left to the normal text paste.
 */
export function imageFilesFrom(data: DataTransfer | null, { ignoreWithText = false } = {}): File[] {
  if (!data) return []
  const files = Array.from(data.files ?? []).filter((f) => f.type.startsWith("image/"))
  if (!files.length) return []
  if (ignoreWithText && data.getData("text/plain").trim()) return []
  return files
}

/** The files in a paste or drop that aren't images (recordings, models, …). */
export function otherFilesFrom(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((f) => !f.type.startsWith("image/"))
}

/** Ids of every attachment chip in a document. */
export function collectAttachmentIds(doc: ProseMirrorNode): Set<string> {
  const ids = new Set<string>()
  doc.descendants((node) => {
    if (node.type.name === "gbAttachment" && node.attrs.id) ids.add(String(node.attrs.id))
    return node.isBlock || node.type.name === "doc"
  })
  return ids
}

// ---------- Hover card ----------

const HOVER_DELAY = 150
const HIDE_GRACE = 120
const GAP = 8
const MARGIN = 8

function AttachmentHoverCard({
  anchor,
  attachment,
}: {
  anchor: HTMLElement
  attachment: EditorAttachment
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const place = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    const a = anchor.getBoundingClientRect()
    const { width, height } = card.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = a.top - GAP - height
    if (top < MARGIN && a.bottom + GAP + height <= vh - MARGIN) top = a.bottom + GAP
    top = Math.max(MARGIN, top)
    const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - width / 2), Math.max(MARGIN, vw - MARGIN - width))
    setPos({ top, left })
  }, [anchor])

  useLayoutEffect(place, [place, attachment.src])

  const size = formatBytes(attachment.size)
  const style: CSSProperties = pos
    ? { top: pos.top, left: pos.left }
    : { top: 0, left: 0, visibility: "hidden" }
  return createPortal(
    <div ref={cardRef} className="gb-attachment-card" style={style} role="tooltip">
      {attachment.src ? (
        <img className="gb-attachment-card-img" src={attachment.src} alt={attachment.name} onLoad={place} />
      ) : (
        <div className="gb-attachment-card-empty">
          <ImageIcon className="size-5" />
        </div>
      )}
      <div className="gb-attachment-card-meta">
        <span className="gb-attachment-card-name">{attachment.name}</span>
        {size && <span className="gb-attachment-card-size"> · {size}</span>}
      </div>
    </div>,
    document.body
  )
}

// ---------- Built-in viewer ----------

function AttachmentViewer({ attachment, onClose }: { attachment: EditorAttachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [onClose])

  return createPortal(
    <div
      className="gb-attachment-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={attachment.name}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClose}
    >
      {attachment.src ? (
        <img className="gb-attachment-viewer-img" src={attachment.src} alt={attachment.name} />
      ) : (
        <div className="gb-attachment-viewer-empty">
          <ImageIcon className="size-6" />
          {attachment.name}
        </div>
      )}
    </div>,
    document.body
  )
}

// ---------- Chip ----------

function AttachmentView({ node, selected, editor }: NodeViewProps) {
  const { attachments, onAttachmentOpen } = useEditorRuntime()
  const id = String(node.attrs.id ?? "")
  const stored = attachments?.find((a) => a.id === id)
  const attachment: EditorAttachment = { ...stored, id, name: stored?.name || String(node.attrs.name || "image") }
  const size = formatBytes(attachment.size)

  const chipRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [viewing, setViewing] = useState(false)
  const showTimer = useRef<number | undefined>(undefined)
  const hideTimer = useRef<number | undefined>(undefined)

  const clearTimers = () => {
    window.clearTimeout(showTimer.current)
    window.clearTimeout(hideTimer.current)
  }
  useEffect(() => clearTimers, [])

  // A fresh selection of the chip re-arms a card dismissed with Escape.
  useEffect(() => {
    if (selected) setDismissed(false)
  }, [selected])

  const cardOpen =
    !viewing && !dismissed && (hovered || focused || (selected && editor.isFocused))

  useEffect(() => {
    if (!cardOpen) return
    const hide = () => {
      clearTimers()
      setHovered(false)
      setDismissed(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide()
    }
    window.addEventListener("scroll", hide, true)
    document.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("scroll", hide, true)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [cardOpen])

  const open = () => {
    clearTimers()
    setHovered(false)
    if (onAttachmentOpen) onAttachmentOpen(attachment)
    else setViewing(true)
  }

  const closeViewer = useCallback(() => setViewing(false), [])

  return (
    <NodeViewWrapper as="span" className="gb-attachment-wrap" contentEditable={false}>
      <span
        ref={chipRef}
        className="gb-attachment"
        role="button"
        tabIndex={0}
        aria-label={size ? `${attachment.name}, ${size}` : attachment.name}
        data-attachment-id={id}
        onMouseEnter={() => {
          window.clearTimeout(hideTimer.current)
          setDismissed(false)
          showTimer.current = window.setTimeout(() => setHovered(true), HOVER_DELAY)
        }}
        onMouseLeave={() => {
          window.clearTimeout(showTimer.current)
          hideTimer.current = window.setTimeout(() => setHovered(false), HIDE_GRACE)
        }}
        onFocus={() => {
          setDismissed(false)
          setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        // Keep the caret where it is — the chip is a button, not a text target.
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault()
          open()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            open()
          }
        }}
      >
        <span className="gb-attachment-thumb">
          {attachment.src ? (
            <img src={attachment.src} alt="" draggable={false} />
          ) : (
            <ImageIcon className="gb-attachment-thumb-icon" />
          )}
        </span>
        <span className="gb-attachment-name">{attachment.name}</span>
        {size && <span className="gb-attachment-size">{size}</span>}
      </span>
      {cardOpen && chipRef.current && <AttachmentHoverCard anchor={chipRef.current} attachment={attachment} />}
      {viewing && <AttachmentViewer attachment={attachment} onClose={closeViewer} />}
    </NodeViewWrapper>
  )
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    gbAttachment: {
      /** Delete every attachment chip with this id. */
      removeAttachment: (id: string) => ReturnType
    }
  }
}

/**
 * Inline attachment chip (`![name](attachment:<id>)`). The file itself lives in
 * the host's attachment store; the node only carries the id and display name.
 */
export const GbAttachment = Node.create({
  name: "gbAttachment",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      id: { default: "" },
      name: { default: "" },
    }
  },
  parseHTML() {
    return [
      {
        tag: "span[data-gb-attachment]",
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute("data-gb-attachment") ?? "",
          name: (el as HTMLElement).getAttribute("data-name") ?? "",
        }),
      },
    ]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-gb-attachment": node.attrs.id, "data-name": node.attrs.name }),
      String(node.attrs.name),
    ]
  },
  renderText({ node }) {
    return String(node.attrs.name)
  },
  addCommands() {
    return {
      removeAttachment:
        (id) =>
        ({ tr, state, dispatch }) => {
          const ranges: Array<[number, number]> = []
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.id === id) ranges.push([pos, pos + node.nodeSize])
          })
          if (!ranges.length) return false
          if (dispatch) {
            for (const [from, to] of ranges.reverse()) tr.delete(from, to)
          }
          return true
        },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView)
  },
})
