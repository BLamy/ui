import { describe, expect, it } from "vitest"
import { createDocsSearchIndex } from "./search"
import { buildDocsTree, findLinkedPage, resolveRelativePath, slugForPath, type DocsNavItem } from "./tree"

const titles = (items: DocsNavItem[]): unknown[] =>
  items.map((i) => (i.kind === "link" ? i.title : i.children.length ? { [i.title]: titles(i.children) } : i.title))

describe("buildDocsTree", () => {
  const files = {
    "./docs/README.md": "# docstream\n\nWelcome.",
    "./docs/02-guides/02-install.md": "---\ndescription: Get it running.\n---\n\n# Installing\n\nRun npm.",
    "./docs/02-guides/01-quick-start.md": "# Quick start\n\nSee [install](02-install.md#npm).",
    "./docs/02-guides/advanced/README.md": "# Advanced\n\nDeep end.",
    "./docs/02-guides/advanced/plugins.md": "Plugins without a heading.",
    "./docs/01-concepts/ast.md": "---\norder: 2\n---\n# The AST",
    "./docs/01-concepts/parser.md": "---\norder: 1\n---\n# The parser",
    "./docs/01-concepts/secret.md": "---\nhidden: true\n---\n# Secret",
    "./docs/images/logo.png": "binary",
    "./docs/notes.txt": "not markdown",
  }
  const tree = buildDocsTree(files)

  it("keeps only Markdown and strips the shared root", () => {
    expect(tree.root).toBe("docs/")
    expect(tree.pages.map((p) => p.path).sort()).toEqual([
      "01-concepts/ast.md",
      "01-concepts/parser.md",
      "01-concepts/secret.md",
      "02-guides/01-quick-start.md",
      "02-guides/02-install.md",
      "02-guides/advanced/README.md",
      "02-guides/advanced/plugins.md",
      "README.md",
    ])
  })

  it("builds groups from folders, ordered by prefix and frontmatter order", () => {
    expect(titles(tree.nav)).toEqual([
      "docstream",
      { Concepts: ["The parser", "The AST"] },
      { Guides: ["Quick start", "Installing", { Advanced: ["Plugins"] }] },
    ])
  })

  it("derives slugs, titles, descriptions and breadcrumbs", () => {
    const install = tree.bySlug.get("guides/install")!
    expect(install.title).toBe("Installing")
    expect(install.description).toBe("Get it running.")
    expect(install.body).toBe("Run npm.")
    expect(install.breadcrumbs).toEqual(["Guides"])
    expect(tree.bySlug.get("guides/advanced/plugins")!.breadcrumbs).toEqual(["Guides", "Advanced"])
    expect(tree.bySlug.get("")!.title).toBe("docstream")
  })

  it("keeps hidden pages routable but out of the sidebar and the reading order", () => {
    expect(tree.bySlug.get("concepts/secret")).toBeDefined()
    expect(tree.order.map((p) => p.slug)).toEqual(["", "concepts/parser", "concepts/ast", "guides/quick-start", "guides/install", "guides/advanced", "guides/advanced/plugins"])
  })

  it("keeps frontmatter with reader-facing keys in the body", () => {
    const t = buildDocsTree({ "a.md": "---\nstatus: draft\ntitle: A\n---\n# A\n\nText" })
    expect(t.pages[0]!.body.startsWith("---\nstatus: draft")).toBe(true)
    expect(t.pages[0]!.title).toBe("A")
  })

  it("follows SUMMARY.md when present", () => {
    const t = buildDocsTree({
      "SUMMARY.md": "# Table of contents\n\n* [Welcome](README.md)\n\n## Guides\n\n* [Setup](guides/install.md)\n  * [Deeper](guides/deeper.md)\n* [GitHub](https://github.com)\n",
      "README.md": "# Home",
      "guides/install.md": "# Install",
      "guides/deeper.md": "# Deeper",
      "guides/orphan.md": "# Orphan",
    })
    expect(titles(t.nav)).toEqual(["Welcome", { Guides: [{ Setup: ["Deeper"] }, "GitHub"] }])
    expect(t.bySlug.get("guides/install")!.title).toBe("Setup")
    expect(t.bySlug.get("guides/orphan")).toBeDefined()
    expect(t.order.map((p) => p.slug)).toEqual(["", "guides/install", "guides/deeper"])
  })

  it("accepts an array of files and an explicit root", () => {
    const t = buildDocsTree([{ path: "site/docs/a.md", content: "# A" }, { path: "site/b.md", content: "# B" }], { root: "site" })
    expect(t.pages.map((p) => p.slug).sort()).toEqual(["b", "docs/a"])
  })
})

describe("links", () => {
  it("resolves relative paths and leaves external URLs alone", () => {
    expect(resolveRelativePath("guides/a.md", "../b.md#x")).toEqual({ path: "b.md", hash: "x" })
    expect(resolveRelativePath("guides/a.md", "/c/d.md")).toEqual({ path: "c/d.md", hash: "" })
    expect(resolveRelativePath("a.md", "https://x.dev/b.md")).toBeNull()
    expect(resolveRelativePath("a.md", "mailto:me@x.dev")).toBeNull()
    expect(slugForPath("01-guides/README.md")).toBe("guides")
  })

  it("finds the page a link points at", () => {
    const tree = buildDocsTree({ "README.md": "# Home", "01-guides/README.md": "# Guides", "01-guides/02-install.md": "# Install" })
    const home = tree.bySlug.get("")!
    expect(findLinkedPage(tree, home, "01-guides/02-install.md#npm")).toMatchObject({ page: { slug: "guides/install" }, hash: "npm" })
    expect(findLinkedPage(tree, home, "01-guides/")!.page.slug).toBe("guides")
    expect(findLinkedPage(tree, home, "#top")).toMatchObject({ page: home, hash: "top" })
    expect(findLinkedPage(tree, home, "missing.md")).toBeNull()
  })
})

describe("search", () => {
  const tree = buildDocsTree({
    "README.md": "# Home\n\nIntro text.",
    "theming.md": "# Theming\n\nColors.\n\n## Dark mode\n\nSet data-theme to switch palettes.\n\n```css\n:root { --gb-radius: 8px }\n```",
    "streaming.md": "# Streaming\n\nRender while the model is still typing. Dark patterns are bad.",
  })
  const index = createDocsSearchIndex(tree)

  it("ranks title and heading matches above body text, with anchors", () => {
    const hits = index.search("dark")
    expect(hits[0]).toMatchObject({ heading: "Dark mode", anchor: "dark-mode", page: { slug: "theming" } })
    expect(hits.map((h) => h.page.slug)).toContain("streaming")
  })

  it("requires every term and searches code", () => {
    expect(index.search("radius")[0]!.page.slug).toBe("theming")
    expect(index.search("dark typing").map((h) => h.page.slug)).toEqual(["streaming"])
    expect(index.search("   ")).toEqual([])
  })

  it("keeps underscores inside words", async () => {
    const { searchableText } = await import("./search")
    expect(searchableText("Use _emphasis_ with @brett_lamy/docstream and snake_case.")).toBe("Use emphasis with @brett_lamy/docstream and snake_case.")
  })

  it("highlights the match inside the snippet", () => {
    const hit = index.search("palettes")[0]!
    expect(hit.snippet.slice(...hit.highlight!)).toBe("palettes")
  })
})
