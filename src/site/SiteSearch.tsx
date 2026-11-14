"use client"

/* Search: UI SDK's Command in a Dialog. The field keeps focus and points at the highlighted hit, arrows move the
   highlight, Enter follows it; the dialog traps focus, closes on Escape or a press outside and gives focus back.
   Matching is docstream's own full-text index, so Command filters nothing. Every hit is a link to its page (and
   heading), so it opens in a new tab too. Before anything is typed it lists the first pages. */
import { useMemo, useRef, useState } from "react"
import { Command, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandList } from "@ui-sdk/react/command"
import { Dialog, DialogBackdrop, DialogContent, type DialogController } from "@ui-sdk/react/dialog"
import { useShortcut } from "@ui-sdk/react/shortcuts"
import { FileText, Hash, Search } from "lucide-react"

import { pressesInPlace } from "./press"
import { createDocsSearchIndex, type DocsSearchResult } from "./search"
import type { DocsTree } from "./tree"

export interface SiteSearchProps {
  tree: DocsTree
  /** Opens and closes the dialog; the header's search button is its trigger. */
  controller: DialogController
  /** The keys that opened it, which close it again while it's open. */
  shortcut: string
  href: (slug: string, hash?: string) => string
  onPick: (result: DocsSearchResult) => void
}

function Snippet({ result }: { result: DocsSearchResult }) {
  if (!result.snippet) return null
  const { snippet, highlight } = result
  return (
    <span className="ds-site-search-hit-snippet">
      {highlight ? (
        <>
          {snippet.slice(0, highlight[0])}
          <mark>{snippet.slice(highlight[0], highlight[1])}</mark>
          {snippet.slice(highlight[1])}
        </>
      ) : (
        snippet
      )}
    </span>
  )
}

function Palette({ tree, controller, shortcut, href, onPick }: SiteSearchProps) {
  const index = useMemo(() => createDocsSearchIndex(tree), [tree])
  const [query, setQuery] = useState("")
  const field = useRef<HTMLDivElement>(null)
  // The page's ⌘K is paused under the dialog; this one, the dialog's own, closes it again.
  useShortcut(shortcut, () => void controller.close(), { layer: field, description: "Close search" })

  const hits = useMemo(() => {
    const results: DocsSearchResult[] = query ? index.search(query, 30) : tree.order.slice(0, 8).map((page) => ({ page, snippet: "", score: 0 }))
    return new Map(results.map((result) => [`${result.page.slug}#${result.anchor ?? ""}`, result]))
  }, [index, tree, query])

  const items = [...hits].map(([value, r]) => (
    <CommandItem key={value} value={value} label={r.heading ?? r.page.title} className="ds-site-search-hit" render={<a href={href(r.page.slug, r.anchor ?? "")} />}>
      {r.heading ? <Hash size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
      <span className="ds-site-search-hit-main">
        <span className="ds-site-search-hit-title">
          {r.heading ? (
            <>
              {r.heading} <span className="ds-site-search-hit-page">· {r.page.title}</span>
            </>
          ) : (
            r.page.title
          )}
        </span>
        {query ? <Snippet result={r} /> : r.page.breadcrumbs.length ? <span className="ds-site-search-hit-path">{r.page.breadcrumbs.join(" › ")}</span> : null}
      </span>
    </CommandItem>
  ))

  return (
    <Command
      filter={false}
      query={query}
      onQueryChange={setQuery}
      onAction={(value, { event }) => {
        const result = hits.get(value)
        if (!result || !pressesInPlace(event)) return
        event?.preventDefault()
        onPick(result)
      }}
    >
      <div ref={field} className="ds-site-search-field">
        <Search size={17} aria-hidden="true" />
        <CommandInput type="search" aria-label="Search documentation" placeholder="Search the docs…" />
        <kbd>esc</kbd>
      </div>
      <CommandEmpty className="ds-site-search-empty">{(state) => (state.empty && query ? `No results for “${query}”` : null)}</CommandEmpty>
      <CommandList className="ds-site-search-results" aria-label={query ? "Results" : "Pages"}>
        {query ? (
          items
        ) : (
          <CommandGroup>
            <CommandGroupLabel className="ds-site-search-caption">Pages</CommandGroupLabel>
            {items}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}

export function SiteSearch(props: SiteSearchProps) {
  return (
    <Dialog controller={props.controller}>
      <DialogBackdrop className="ds-site-search-layer" />
      <DialogContent className="ds-site-search" aria-label="Search documentation">
        <Palette {...props} />
      </DialogContent>
    </Dialog>
  )
}
