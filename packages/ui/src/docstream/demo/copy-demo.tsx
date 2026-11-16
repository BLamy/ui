/* "Copy demo": writes the docstream clipboard (Markdown with the demo's files inline, plus the
   `application/x-docstream+json` payload) through react-aria's `useClipboard`, so pasting into
   a docstream editor recreates the demo with its files. A button click has no copy event of
   its own, so the button focuses itself and runs the browser's copy command; react-aria's
   listener then fills the event's DataTransfer. Where that is unavailable, the Markdown is
   copied as plain text (editors still parse its inline-file demos). */
import { useEffect, useRef, useState, type DOMAttributes, type MutableRefObject } from "react"
import { useClipboard } from "react-aria"
import { CopyIcon, copyText } from "../docs/copy"
import { docstreamClipboardItems, type DocstreamClipboard } from "./clipboard"

export interface DocstreamCopy<T extends HTMLElement> {
  ref: MutableRefObject<T | null>
  /** react-aria `useClipboard`'s focus handlers: Cmd/Ctrl+C on the focused element copies too. */
  props: DOMAttributes<T>
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
  const { clipboardProps } = useClipboard({
    getItems: () => {
      const clip = latest.current()
      return clip ? docstreamClipboardItems(clip) : []
    },
    onCopy: () => {
      wrote.current = true
    },
  })

  const copy = async (): Promise<boolean> => {
    const clip = latest.current()
    if (!clip) return false
    const el = ref.current
    wrote.current = false
    if (el && typeof document !== "undefined" && typeof document.execCommand === "function") {
      // The copy event targets the selection when there is one; clear it so it targets
      // this (focused) element and nothing else — an editor around us — claims the event.
      const selection = typeof window !== "undefined" ? window.getSelection() : null
      const ranges: Range[] = []
      if (selection) for (let i = 0; i < selection.rangeCount; i++) ranges.push(selection.getRangeAt(i))
      try {
        if (document.activeElement !== el) el.focus({ preventScroll: true })
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

  return { ref, props: clipboardProps as DOMAttributes<T>, copy }
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
    <button
      {...props}
      ref={ref}
      type="button"
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
    </button>
  )
}
