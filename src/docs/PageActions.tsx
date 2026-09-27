/* "Copy page ▾": copy the page as Markdown (with {% demo %} blocks resolved into their real files),
   view it as Markdown, or open it in ChatGPT / Claude. */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, ChevronDown, FileText } from "lucide-react"

import { useDemoResolver } from "../demo/context"
import { resolveDemosToMarkdown, type ResolveDemosOptions } from "../demo/markdown"
import type { DemoResolver } from "../demo/types"
import { CopyIcon, useCopied } from "./copy"

export type DocPageAction = "copy" | "view" | "chatgpt" | "claude"

export interface DocPageActionsOptions {
  /**
   * Public URL of this page as Markdown (e.g. `/md/button.md`). "View as Markdown" opens it and the
   * ChatGPT / Claude prompts reference it. Without it, "View" opens the resolved Markdown as a
   * blob and the prompts reference `pageUrl` (default: the current location).
   */
  markdownUrl?: string
  pageUrl?: string
  /** The question handed to ChatGPT / Claude. */
  prompt?: (url: string) => string
  /** Which menu entries to show, in order. Defaults to all four. */
  actions?: DocPageAction[]
  /** Final touch on the copied Markdown (e.g. append a "Source:" footer). */
  transform?: (markdown: string) => string
  /** Options for resolving `{% demo %}` blocks. */
  demoOptions?: ResolveDemosOptions
  /** Overrides the resolver from context. */
  resolver?: DemoResolver
  className?: string
}

export interface DocPageActionsProps extends DocPageActionsOptions {
  /** The page's Markdown source (or a function producing it on demand). */
  markdown: string | (() => string | Promise<string>)
}

const OpenAIGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    {[0, 60, 120].map((a) => (
      <rect key={a} x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" transform={`rotate(${a} 12 12)`} />
    ))}
  </svg>
)

const AnthropicGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.3 3.54h-3.67l6.7 16.92H24zM6.7 3.54 0 20.46h3.74l1.37-3.55h7.01l1.37 3.55h3.74L10.54 3.54zm-.37 10.22 2.29-5.94 2.29 5.94z" />
  </svg>
)

const defaultPrompt = (url: string) => `Read ${url}, I want to ask questions about it.`

interface MenuItem {
  id: DocPageAction
  icon: ReactNode
  label: string
  hint: string
  href?: string
  run?: () => void
}

/** Resolves the page Markdown (demos inlined) for copying or exporting. */
async function pageMarkdown(props: DocPageActionsProps, resolver: DemoResolver | undefined) {
  const source = typeof props.markdown === "function" ? await props.markdown() : props.markdown
  const resolved = await resolveDemosToMarkdown(source, resolver, props.demoOptions)
  return props.transform ? props.transform(resolved) : resolved
}

/** A shadcn-style split button: "Copy page" plus a menu of Markdown / AI actions. */
export function DocPageActions(props: DocPageActionsProps) {
  const resolver = useDemoResolver(props.resolver)
  const { copied, copy } = useCopied()
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const root = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onDown)
    // Focus the first item once the menu is in the DOM.
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus())
    return () => {
      document.removeEventListener("pointerdown", onDown)
      cancelAnimationFrame(frame)
    }
  }, [open])

  const copyPage = () => copy(() => pageMarkdown(props, resolver))
  const here = typeof location === "undefined" ? "" : location.href
  const target = props.markdownUrl ? absolute(props.markdownUrl) : props.pageUrl ?? here
  const ask = (props.prompt ?? defaultPrompt)(target)

  const viewMarkdown = async () => {
    const text = await pageMarkdown(props, resolver)
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }))
    window.open(url, "_blank", "noopener")
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const all: MenuItem[] = [
    { id: "copy", icon: <CopyIcon copied={false} />, label: "Copy as Markdown", hint: "Copy this page for LLMs", run: () => void copyPage() },
    props.markdownUrl
      ? { id: "view", icon: <FileText width={15} height={15} aria-hidden="true" />, label: "View as Markdown", hint: "Open the page as plain text", href: props.markdownUrl }
      : { id: "view", icon: <FileText width={15} height={15} aria-hidden="true" />, label: "View as Markdown", hint: "Open the page as plain text", run: () => void viewMarkdown() },
    { id: "chatgpt", icon: <OpenAIGlyph />, label: "Open in ChatGPT", hint: "Ask questions about this page", href: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(ask)}` },
    { id: "claude", icon: <AnthropicGlyph />, label: "Open in Claude", hint: "Ask questions about this page", href: `https://claude.ai/new?q=${encodeURIComponent(ask)}` },
  ]
  const wanted = props.actions ?? ["copy", "view", "chatgpt", "claude"]
  const items = wanted.map((id) => all.find((item) => item.id === id)).filter((item): item is MenuItem => !!item)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")]
    const index = entries.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (event.key === "ArrowDown") next = (index + 1) % entries.length
    else if (event.key === "ArrowUp") next = (index - 1 + entries.length) % entries.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = entries.length - 1
    else if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    } else if (event.key === "Tab") {
      close(false)
      return
    }
    if (next < 0) return
    event.preventDefault()
    entries[next]?.focus()
  }

  return (
    <div ref={root} className={props.className ? `docs-page-actions ${props.className}` : "docs-page-actions"}>
      <button type="button" className="docs-page-actions-main" onClick={() => void copyPage()} aria-label="Copy page as Markdown">
        <CopyIcon copied={copied} size={13} />
        <span aria-live="polite">{copied ? "Copied" : "Copy page"}</span>
      </button>
      <button
        ref={trigger}
        type="button"
        className="docs-page-actions-more"
        aria-label="More page actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <ChevronDown width={13} height={13} strokeWidth={2.4} aria-hidden="true" className={open ? "docs-page-actions-caret-open" : undefined} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Page actions"
            className="docs-page-actions-menu"
            onKeyDown={onMenuKey}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: reduced ? { duration: 0.1 } : { type: "spring", bounce: 0.2, duration: 0.32 } }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.97, transition: { duration: 0.12 } }}
            style={{ transformOrigin: "top right" }}
          >
            {items.map((item) => {
              const body = (
                <>
                  <span className="docs-page-actions-icon">{item.icon}</span>
                  <span className="docs-page-actions-text">
                    <span className="docs-page-actions-label">
                      {item.label}
                      {item.href ? <ArrowUpRight width={12} height={12} aria-hidden="true" /> : null}
                    </span>
                    <span className="docs-page-actions-hint">{item.hint}</span>
                  </span>
                </>
              )
              return item.href ? (
                <a key={item.id} role="menuitem" tabIndex={-1} className="docs-page-actions-item" href={item.href} target="_blank" rel="noreferrer" onClick={() => close(false)}>
                  {body}
                </a>
              ) : (
                <button key={item.id} type="button" role="menuitem" tabIndex={-1} className="docs-page-actions-item" onClick={() => { item.run?.(); close() }}>
                  {body}
                </button>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function absolute(url: string): string {
  if (typeof location === "undefined") return url
  try {
    return new URL(url, location.href).toString()
  } catch {
    return url
  }
}
