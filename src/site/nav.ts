/* The sidebar as a tree: every navigation item gets a value that is unique in the tree, which is what UI SDK's
   Tree lists as expanded and marks as the current page. Groups (a title over some items) are not items themselves:
   their children sit at the group's own level. Pure, so it runs on the server. */
import type { DocsNavItem } from "./tree"

export interface NavNode {
  /** Unique in the tree. A page's is `page:<slug>` (the first place it's listed). */
  value: string
  item: DocsNavItem
  children: NavNode[]
}

/** What UI SDK's `Tree` takes as `items`: the whole shape, collapsed branches included. */
export interface NavTreeItem {
  value: string
  label: string
  href?: string
  children?: NavTreeItem[]
}

export const pageValue = (slug: string) => `page:${slug}`

/** The navigation with a value per item. */
export function navNodes(items: readonly DocsNavItem[]): NavNode[] {
  const seen = new Set<string>()
  const unique = (base: string) => {
    let value = base
    for (let n = 2; seen.has(value); n++) value = `${base}~${n}`
    seen.add(value)
    return value
  }
  const walk = (list: readonly DocsNavItem[], path: string): NavNode[] =>
    list.map((item) => {
      const here = `${path}/${item.title}`
      const value = unique(item.kind === "page" ? pageValue(item.slug) : `${item.kind}:${here}`)
      return { value, item, children: item.kind === "link" ? [] : walk(item.children, here) }
    })
  return walk(items, "")
}

/** The items of a level, with each group replaced by its children. */
function flat(nodes: readonly NavNode[]): NavNode[] {
  return nodes.flatMap((node) => (node.item.kind === "group" ? flat(node.children) : [node]))
}

/** The tree's shape as data. `href` makes an item a link. */
export function navTreeItems(nodes: readonly NavNode[], href: (slug: string) => string): NavTreeItem[] {
  return flat(nodes).map((node) => {
    const children = navTreeItems(node.children, href)
    return {
      value: node.value,
      label: node.item.title,
      ...(node.item.kind === "page" ? { href: href(node.item.slug) } : node.item.kind === "link" ? { href: node.item.href } : {}),
      ...(children.length ? { children } : {}),
    }
  })
}

/** Every item by its value. */
export function navIndex(nodes: readonly NavNode[], into = new Map<string, NavNode>()): Map<string, NavNode> {
  for (const node of nodes) {
    into.set(node.value, node)
    navIndex(node.children, into)
  }
  return into
}

/** The branches that show a page: its ancestors, and the page itself when it has pages under it. */
export function navOpenFor(nodes: readonly NavNode[], slug: string): string[] {
  const walk = (list: readonly NavNode[], trail: string[]): string[] | null => {
    for (const node of list) {
      const branch = node.item.kind !== "group" && node.children.length > 0
      const here = branch ? [...trail, node.value] : trail
      if (node.item.kind === "page" && node.item.slug === slug) return here
      const below = walk(node.children, here)
      if (below) return below
    }
    return null
  }
  return walk(nodes, []) ?? []
}

/** The value of the item for a page, or null when the sidebar doesn't list it. */
export function navCurrent(nodes: readonly NavNode[], slug: string): string | null {
  for (const node of nodes) {
    if (node.item.kind === "page" && node.item.slug === slug) return node.value
    const below = navCurrent(node.children, slug)
    if (below) return below
  }
  return null
}
