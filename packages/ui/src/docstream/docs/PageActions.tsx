/* "Copy page ▾": copy the page as Markdown, view it as Markdown, or open it in ChatGPT / Claude.
   Copy and View give renderable docstream Markdown: each {% demo %} keeps its tag and carries its
   real files inline, so pasting the page into docstream renders the same page (demos included). */
import type { ReactNode } from "react"
import { Glyph } from "../ui/glyph"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu"

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
  /**
   * Options for resolving `{% demo %}` blocks. The default `format: "inline"` keeps the page
   * renderable by docstream; `{ format: "plain" }` gives the pre-1.2 prose + fences form.
   */
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

/** The page as renderable Markdown (demo files inline) for copying or exporting. */
async function pageMarkdown(props: DocPageActionsProps, resolver: DemoResolver | undefined) {
  const source = typeof props.markdown === "function" ? await props.markdown() : props.markdown
  const resolved = await resolveDemosToMarkdown(source, resolver, props.demoOptions)
  return props.transform ? props.transform(resolved) : resolved
}

/** A shadcn-style split button: "Copy page" plus a menu of Markdown / AI actions. */
export function DocPageActions(props: DocPageActionsProps) {
  const resolver = useDemoResolver(props.resolver)
  const { copied, copy } = useCopied()
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
    { id: "copy", icon: <CopyIcon copied={false} />, label: "Copy as Markdown", hint: "Copy this page, demos included", run: () => void copyPage() },
    props.markdownUrl
      ? { id: "view", icon: <Glyph name="doc-text" size={15} />, label: "View as Markdown", hint: "Open the page as plain text", href: props.markdownUrl }
      : { id: "view", icon: <Glyph name="doc-text" size={15} />, label: "View as Markdown", hint: "Open the page as plain text", run: () => void viewMarkdown() },
    { id: "chatgpt", icon: <OpenAIGlyph />, label: "Open in ChatGPT", hint: "Ask questions about this page", href: `https://chatgpt.com/?hints=search&q=${encodeURIComponent(ask)}` },
    { id: "claude", icon: <AnthropicGlyph />, label: "Open in Claude", hint: "Ask questions about this page", href: `https://claude.ai/new?q=${encodeURIComponent(ask)}` },
  ]
  const wanted = props.actions ?? ["copy", "view", "chatgpt", "claude"]
  const items = wanted.map((id) => all.find((item) => item.id === id)).filter((item): item is MenuItem => !!item)

  return (
    <div className={props.className ? `docs-page-actions ${props.className}` : "docs-page-actions"}>
      <button type="button" className="docs-page-actions-main" onClick={() => void copyPage()} aria-label="Copy page as Markdown">
        <CopyIcon copied={copied} size={13} />
        <span aria-live="polite">{copied ? "Copied" : "Copy page"}</span>
      </button>
      <Menu>
        <MenuTrigger className="docs-page-actions-more" aria-label="More page actions">
          <Glyph name="chevron-down" size={13} sw={2.4} className="docs-page-actions-caret" />
        </MenuTrigger>
        <MenuContent aria-label="Page actions" className="docs-page-actions-menu" side="bottom" align="end" sideOffset={6}>
          {items.map((item) => {
            const body = (
              <>
                <span className="docs-page-actions-icon">{item.icon}</span>
                <span className="docs-page-actions-text">
                  <span className="docs-page-actions-label">
                    {item.label}
                    {item.href ? <Glyph name="arrow-up-right" size={12} /> : null}
                  </span>
                  <span className="docs-page-actions-hint">{item.hint}</span>
                </span>
              </>
            )
            return item.href ? (
              <MenuItem key={item.id} value={item.id} label={item.label} className="docs-page-actions-item" render={<a href={item.href} target="_blank" rel="noreferrer" />}>
                {body}
              </MenuItem>
            ) : (
              <MenuItem key={item.id} value={item.id} label={item.label} className="docs-page-actions-item" onSelect={() => item.run?.()}>
                {body}
              </MenuItem>
            )
          })}
        </MenuContent>
      </Menu>
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
