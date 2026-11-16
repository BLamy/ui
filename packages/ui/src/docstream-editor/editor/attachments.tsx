import { Node, mergeAttributes } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { Glyph } from "./glyph"
import { useEffect, useState } from "react"
import { Button } from "@ui-sdk/react/button"
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogTitle } from "@ui-sdk/react/dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@ui-sdk/react/hover-card"

import { controlNodeView } from "./controls"
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

const SIZE_UNITS = ["MB", "GB", "TB", "PB"]

/**
 * A size in decimal (SI) units: "280 B", "627 kB", "1.3 MB", one decimal from MB up and none
 * below; "" for an unknown size.
 */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return ""
  if (Math.round(bytes) < 1000) return `${Math.round(bytes)} B`
  if (Math.round(bytes / 1000) < 1000) return `${Math.round(bytes / 1000)} kB`
  let value = bytes / 1e6
  let unit = 0
  // Round first so 999.96 MB reads "1.0 GB", not "1000.0 MB".
  while (Math.round(value * 10) / 10 >= 1000 && unit < SIZE_UNITS.length - 1) {
    value /= 1000
    unit++
  }
  return `${value.toFixed(1)} ${SIZE_UNITS[unit]}`
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

// ---------- Chip ----------

const HOVER_DELAY = 150
const HIDE_GRACE = 120

function AttachmentView({ node, selected, editor }: NodeViewProps) {
  const { attachments, onAttachmentOpen } = useEditorRuntime()
  const id = String(node.attrs.id ?? "")
  const stored = attachments?.find((a) => a.id === id)
  const attachment: EditorAttachment = { ...stored, id, name: stored?.name || String(node.attrs.name || "image") }
  const size = formatBytes(attachment.size)

  const [hovered, setHovered] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [viewing, setViewing] = useState(false)

  // A fresh selection of the chip re-arms a card dismissed with Escape.
  useEffect(() => {
    if (selected) setDismissed(false)
  }, [selected])

  // Selecting the chip in the document shows its card too, as hovering or focusing it does.
  const held = selected && editor.isFocused
  const cardOpen = !viewing && !dismissed && (hovered || held)

  const open = () => {
    setHovered(false)
    if (onAttachmentOpen) onAttachmentOpen(attachment)
    else setViewing(true)
  }

  return (
    <NodeViewWrapper as="span" className="gb-attachment-wrap" contentEditable={false}>
      <HoverCard
        open={cardOpen}
        delay={HOVER_DELAY}
        closeDelay={HIDE_GRACE}
        onOpenChange={(next, details) => {
          setHovered(next)
          if (next) setDismissed(false)
          else if (details.reason === "escape-key") setDismissed(true)
          else if (held) details.cancel()
        }}
      >
        <HoverCardTrigger
          render={<Button render={<span />} />}
          className="gb-attachment"
          aria-label={size ? `${attachment.name}, ${size}` : attachment.name}
          data-attachment-id={id}
          // Keep the caret where it is — the chip is a button, not a text target.
          onMouseDown={(e) => e.preventDefault()}
          onClick={open}
        >
          <span className="gb-attachment-thumb">
            {attachment.src ? (
              <img src={attachment.src} alt="" draggable={false} />
            ) : (
              <Glyph name="photo" className="gb-attachment-thumb-icon" size={24} />
            )}
          </span>
          <span className="gb-attachment-name">{attachment.name}</span>
          {size && <span className="gb-attachment-size">{size}</span>}
        </HoverCardTrigger>
        <HoverCardContent render={<span />} className="gb-attachment-card" side="top" sideOffset={8} collisionPadding={8}>
          {attachment.src ? (
            <img className="gb-attachment-card-img" src={attachment.src} alt="" />
          ) : (
            <span className="gb-attachment-card-empty">
              <Glyph name="photo" className="size-5" size={24} />
            </span>
          )}
          <span className="gb-attachment-card-meta">
            <span className="gb-attachment-card-name">{attachment.name}</span>
            {size && <span className="gb-attachment-card-size"> · {size}</span>}
          </span>
        </HoverCardContent>
      </HoverCard>
      <Dialog open={viewing} onOpenChange={setViewing}>
        <DialogBackdrop className="gb-attachment-backdrop" />
        <DialogContent render={<span />} className="gb-attachment-viewer">
          <DialogTitle render={<span />} className="gb-attachment-viewer-title">
            {attachment.name}
          </DialogTitle>
          {attachment.src ? (
            <img className="gb-attachment-viewer-img" src={attachment.src} alt={attachment.name} />
          ) : (
            <span className="gb-attachment-viewer-empty">
              <Glyph name="photo" className="size-6" size={24} />
              {attachment.name}
            </span>
          )}
          <DialogClose className="gb-attachment-viewer-close" aria-label="Close">
            <Glyph name="xmark" className="size-4" size={24} />
          </DialogClose>
        </DialogContent>
      </Dialog>
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
    return controlNodeView(AttachmentView)
  },
})
