/* "Copy demo": writes the docstream clipboard (Markdown with the demo's files inline, plus the
   `application/x-docstream+json` payload) onto a copy event, so pasting into a docstream editor
   recreates the demo with its files. While the triggering element has focus, a window listener
   claims the copy event (its target is the selection or the body, not the element) and fills the
   event's DataTransfer: Cmd/Ctrl+C copies that way, and a click focuses the element and runs the
   browser's copy command. Where that is unavailable, the Markdown is copied as plain text
   (editors still parse its inline-file demos). */
import { useEffect, useRef, useState, type FocusEventHandler, type MutableRefObject } from "react"
import { Button } from "@ui-sdk/react/button"
import { CopyIcon, copyText } from "../docs/copy"
import { writeDocstreamClipboard, type DocstreamClipboard } from "./clipboard"

export interface DocstreamCopy<T extends HTMLElement> {
  ref: MutableRefObject<T | null>
  /** Focus handlers that arm the copy listener: Cmd/Ctrl+C on the focused element copies too. */
  props: { onFocus: FocusEventHandler<T>; onBlur: FocusEventHandler<T> }
  /** Copies; resolves false when there was nothing to copy. */
  copy: () => Promise<boolean>
}

/**
 * Copies a `DocstreamClipboard` (all three representations) from a click. Spread `props` on
 * the triggering element (a focusable one, e.g. a `<button>`) and give it `ref`.
 */
export function useDocstreamCopy<T extends HTMLElement = HTMLButtonElement>(produce: () => DocstreamClipboard | null): DocstreamCopy<T> {
  const ref = useRef<T | null>(null)
  const latest = useRef(produce)
  latest.current = produce
  const wrote = useRef(false)
  const disarm = useRef<(() => void) | null>(null)
  useEffect(() => () => disarm.current?.(), [])

  const arm = () => {
    if (disarm.current || typeof window === "undefined") return
    const onCopy = (event: ClipboardEvent) => {
      const clip = latest.current()
      if (!clip || !event.clipboardData) return
      event.preventDefault()
      writeDocstreamClipboard(event.clipboardData, clip)
      wrote.current = true
    }
    window.addEventListener("copy", onCopy)
    disarm.current = () => {
      window.removeEventListener("copy", onCopy)
      disarm.current = null
    }
  }

  const copy = async (): Promise<boolean> => {
    const clip = latest.current()
    if (!clip) return false
    const el = ref.current
    wrote.current = false
    if (el && typeof document !== "undefined" && typeof document.execCommand === "function") {
      // The copy event targets the selection when there is one; clear it so nothing else (an
      // editor around us) claims the event, and the armed listener writes our representations.
      const selection = typeof window !== "undefined" ? window.getSelection() : null
      const ranges: Range[] = []
      if (selection) for (let i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i))
      try {
        if (document.activeElement !== el) el.focus({ preventScroll: true })
        if (document.activeElement === el) arm()
        selection?.removeAllRanges()
        document.execCommand("copy")
      } catch {
        // fall through to the plain-text copy
      } finally {
        if (selection && ranges.length && !selection.rangeCount) for (const range of ranges) selection.addRange(range)
      }
    }
    if (!wrote.current) await copyText(clip.text)
    return true
  }

  return { ref, props: { onFocus: arm, onBlur: () => disarm.current?.() }, copy }
}

export interface CopyDemoButtonProps {
  /** The clipboard to write, computed on click. `null` disables the copy. */
  clipboard: () => DocstreamClipboard | null
  label?: string
  className?: string
}

/** Icon button: copies the demo (Markdown + files + docstream payload) and swaps to a tick. */
export function CopyDemoButton({ clipboard, label = "Copy demo", className }: CopyDemoButtonProps) {
  const { ref, props, copy } = useDocstreamCopy(clipboard)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <Button
      {...props}
      ref={ref}
      className={className ? `docs-copy ${className}` : "docs-copy"}
      onClick={() => {
        void copy().then((ok) => {
          if (!ok) return
          setCopied(true)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => setCopied(false), 1600)
        })
      }}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : `${label} (Markdown with its files — paste into a docstream editor)`}
      data-copied={copied || undefined}
      data-docstream-copy-demo=""
    >
      <CopyIcon copied={copied} />
    </Button>
  )
}
