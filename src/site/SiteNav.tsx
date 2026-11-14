"use client"

/* The sidebar: the site's pages as UI SDK's Tree of links. One tab stop, arrow keys between the rows, Right and Left
   open and close a section, typing finds a page. Every page is a real link, so it opens in a new tab and works
   before hydration. The page being read is the tree's `current` item. */
import { useId, useMemo } from "react"
import { Tree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel } from "@ui-sdk/react/tree"
import { ChevronRight } from "lucide-react"

import { navCurrent, navIndex, navTreeItems, type NavNode } from "./nav"
import { pressesInPlace } from "./press"

export interface SiteNavProps {
  nodes: NavNode[]
  /** The slug of the page being read. */
  current: string
  /** The values of the open sections. */
  expanded: string[]
  onExpandedChange: (expanded: string[]) => void
  href: (slug: string) => string
  go: (slug: string) => void
}

function Group({ node, depth, href }: { node: NavNode; depth: number; href: SiteNavProps["href"] }) {
  const id = useId()
  return (
    // A named group of the tree's items: the tree role allows one between it and its items.
    <li className="ds-site-nav-group" role="group" aria-labelledby={id}>
      <div id={id} className="ds-site-nav-group-title">{node.item.title}</div>
      <ul className="ds-site-nav-list" data-depth={depth} role="none">
        <Items nodes={node.children} depth={depth} href={href} />
      </ul>
    </li>
  )
}

function Items({ nodes, depth, href }: { nodes: NavNode[]; depth: number; href: SiteNavProps["href"] }) {
  return nodes.map((node) => {
    const { item } = node
    if (item.kind === "group") return <Group key={node.value} node={node} depth={depth} href={href} />
    const branch = node.children.length > 0
    const indicator = branch ? (
      <TreeItemIndicator className="ds-site-nav-toggle">
        <ChevronRight size={14} aria-hidden="true" />
      </TreeItemIndicator>
    ) : null
    const label = <span className="ds-site-nav-label">{item.title}</span>
    return (
      <TreeItem key={node.value} value={node.value} label={item.title} render={<li />}>
        {item.kind === "page" ? (
          <TreeItemLabel className="ds-site-nav-link" render={<a href={href(item.slug)} />}>
            {label}
            {indicator}
          </TreeItemLabel>
        ) : item.kind === "link" ? (
          <TreeItemLabel className="ds-site-nav-link" render={<a href={item.href} target="_blank" rel="noreferrer" />}>
            {label}
            <span className="ds-site-nav-external" aria-hidden="true">↗</span>
          </TreeItemLabel>
        ) : (
          <TreeItemLabel className="ds-site-nav-link ds-site-nav-folder">
            {label}
            {indicator}
          </TreeItemLabel>
        )}
        {branch ? (
          <TreeGroup render={<ul className="ds-site-nav-list ds-site-nav-children" data-depth={depth + 1} />}>
            <Items nodes={node.children} depth={depth + 1} href={href} />
          </TreeGroup>
        ) : null}
      </TreeItem>
    )
  })
}

export function SiteNav({ nodes, current, expanded, onExpandedChange, href, go }: SiteNavProps) {
  const items = useMemo(() => navTreeItems(nodes, href), [nodes, href])
  const index = useMemo(() => navIndex(nodes), [nodes])
  return (
    <Tree
      aria-label="Pages"
      mode="none"
      items={items}
      current={navCurrent(nodes, current)}
      expanded={expanded}
      onExpandedChange={onExpandedChange}
      // A page's row is its link: pressing it goes there, and only its chevron (or an arrow key) closes its section.
      expandOnPress={false}
      onAction={(value, { event }) => {
        const node = index.get(value)
        if (!node) return
        if (node.item.kind === "folder") {
          onExpandedChange(expanded.includes(value) ? expanded.filter((v) => v !== value) : [...expanded, value])
        } else if (node.item.kind === "page" && pressesInPlace(event)) {
          event?.preventDefault()
          if (node.children.length && !expanded.includes(value)) onExpandedChange([...expanded, value])
          go(node.item.slug)
        }
      }}
      render={<ul className="ds-site-nav-list" data-depth={0} />}
    >
      <Items nodes={nodes} depth={0} href={href} />
    </Tree>
  )
}
