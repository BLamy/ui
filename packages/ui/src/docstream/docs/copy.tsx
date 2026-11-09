import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

/** Copies text, falling back to a selection copy where the Clipboard API is unavailable. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0"
    document.body.appendChild(area)
    area.select()
    document.execCommand("copy")
    area.remove()
  }
}

/**
 * Copies text that is still being produced. Hands the clipboard a pending
 * ClipboardItem synchronously so Safari keeps the click's user activation.
 */
export async function copyLazyText(produce: () => string | Promise<string>): Promise<void> {
  const pending = Promise.resolve().then(produce)
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const blob = pending.then((text) => new Blob([text], { type: "text/plain" }))
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })])
      return
    } catch {
      // fall through to writeText / selection copy
    }
  }
  await copyText(await pending)
}

/** `copied` flips true for a moment after `copy()`. */
export function useCopied(ms = 1600) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const copy = async (text: string | (() => string | Promise<string>)) => {
    if (typeof text === "function") await copyLazyText(text)
    else await copyText(text)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), ms)
  }
  return { copied, copy }
}

export function CopyIcon({ copied, size = 14 }: { copied: boolean; size?: number }) {
  return copied ? (
    <Check className="docs-copy-icon docs-copy-icon-done" width={size} height={size} strokeWidth={2.4} aria-hidden="true" />
  ) : (
    <Copy className="docs-copy-icon" width={size} height={size} strokeWidth={2} aria-hidden="true" />
  )
}

export interface CopyButtonProps {
  text: string | (() => string | Promise<string>)
  label?: string
  className?: string
}

/** Icon button that copies `text` and swaps to a tick. */
export function CopyButton({ text, label = "Copy code", className }: CopyButtonProps) {
  const { copied, copy } = useCopied()
  return (
    <button
      type="button"
      className={className ? `docs-copy ${className}` : "docs-copy"}
      onClick={() => void copy(text)}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      data-copied={copied || undefined}
    >
      <CopyIcon copied={copied} />
    </button>
  )
}
