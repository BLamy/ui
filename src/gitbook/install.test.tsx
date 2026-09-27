import { describe, expect, it } from "vitest"
// @ts-ignore react-dom's types aren't installed; only this function is needed.
import { renderToString as untypedRenderToString } from "react-dom/server"
import type { ReactElement } from "react"
import { MarkdownContent } from "../docs/DocsRenderer"
import { resolveDemosToMarkdown } from "../demo/markdown"
import { documentOutline } from "./outline"
import { packageManagerCommands } from "./package-managers"
import { parseMarkdown, trimPartialInlineToken } from "./parse"
import { serializeMarkdown } from "./serialize"

const renderToString = untypedRenderToString as (element: ReactElement) => string

describe("packageManagerCommands", () => {
  const cases: [string, string, string, string][] = [
    ["npm install @brett_lamy/ui", "pnpm add @brett_lamy/ui", "yarn add @brett_lamy/ui", "bun add @brett_lamy/ui"],
    ["npm i -D vitest typescript", "pnpm add -D vitest typescript", "yarn add -D vitest typescript", "bun add -d vitest typescript"],
    ["npm install --save-exact react", "pnpm add -E react", "yarn add -E react", "bun add --exact react"],
    ["npm install", "pnpm install", "yarn install", "bun install"],
    ["npm install -g serve", "pnpm add -g serve", "yarn global add serve", "bun add -g serve"],
    ["npm uninstall left-pad", "pnpm remove left-pad", "yarn remove left-pad", "bun remove left-pad"],
    ["npx shadcn@latest add https://blamy.github.io/ui/r/composer.json", "pnpm dlx shadcn@latest add https://blamy.github.io/ui/r/composer.json", "yarn dlx shadcn@latest add https://blamy.github.io/ui/r/composer.json", "bunx shadcn@latest add https://blamy.github.io/ui/r/composer.json"],
    ["npm run dev -- --port 3000", "pnpm dev --port 3000", "yarn dev --port 3000", "bun run dev -- --port 3000"],
    ["npm test", "pnpm test", "yarn test", "bun run test"],
    ["npm create vite@latest my-app", "pnpm create vite@latest my-app", "yarn create vite@latest my-app", "bun create vite@latest my-app"],
    ["cd app && npm install", "cd app && pnpm install", "cd app && yarn install", "cd app && bun install"],
  ]
  it.each(cases)("%s", (npm, pnpm, yarn, bun) => {
    expect(packageManagerCommands(npm)).toEqual({ npm, pnpm, yarn, bun })
  })

  it("keeps other lines and honours overrides", () => {
    expect(packageManagerCommands("# deps\nnpm i x", { bun: "bun add x --trust" })).toEqual({
      npm: "# deps\nnpm i x",
      pnpm: "# deps\npnpm add x",
      yarn: "# deps\nyarn add x",
      bun: "bun add x --trust",
    })
  })
})

describe("{% command %}", () => {
  it("parses the one-line and block forms, and serializes canonically", () => {
    const one = "{% command %}npm install @brett_lamy/ui{% endcommand %}\n"
    expect(parseMarkdown(one).children).toEqual([{ type: "command", command: "npm install @brett_lamy/ui" }])
    expect(serializeMarkdown(parseMarkdown(one))).toBe(one)

    const block = '{% command bun="bun add x --trust" sync="setup" %}\nnpm install x\nnpm run build\n{% endcommand %}\n'
    expect(parseMarkdown(block).children).toEqual([
      { type: "command", command: "npm install x\nnpm run build", overrides: { bun: "bun add x --trust" }, sync: "setup" },
    ])
    expect(serializeMarkdown(parseMarkdown(block))).toBe(block)
    // A one-command block form serializes as the one-liner; `sync="pm"` is the default.
    expect(serializeMarkdown(parseMarkdown('{% command sync="pm" %}\nnpm i x\n{% endcommand %}'))).toBe("{% command %}npm i x{% endcommand %}\n")
  })

  it("never flashes a half-streamed one-liner as text", () => {
    const full = "Intro\n\n{% command %}npm install @brett_lamy/ui{% endcommand %}"
    for (let n = "Intro\n\n".length + 1; n <= full.length; n++) {
      const doc = parseMarkdown(trimPartialInlineToken(full.slice(0, n)))
      expect(JSON.stringify(doc)).not.toContain("{%")
      // (`{% command %}` alone is the block form's opening line: an empty command, rendered as nothing.)
      const shown = doc.children.filter((b) => b.type !== "command" || b.command)
      expect(shown.map((b) => b.type)).toEqual(n === full.length ? ["paragraph", "command"] : ["paragraph"])
    }
  })

  it("renders the reader's manager (pnpm first) with the terminal glyph and a copy button", () => {
    const html = renderToString(<MarkdownContent markdown="{% command %}npx shadcn@latest add button{% endcommand %}" />)
    expect(html).toContain('data-pm="pnpm"')
    expect(html).toContain("docs-tabs-code-term")
    expect(html).toMatch(/pnpm.*npm.*yarn.*bun/s)
    expect(html).toContain("Copy pnpm command")
    expect(html.replace(/<[^>]+>/g, "")).toContain("pnpm dlx shadcn@latest add button")
  })
})

const INSTALL = `{% tabs title="Installation" sync="install-method" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

\`\`\`tsx
import '@brett_lamy/ui/styles.css'

import { Composer, ComposerInput } from '@brett_lamy/ui'
\`\`\`
{% endtab %}

{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/composer.json{% endcommand %}

Adds \`@/components/ui/composer.tsx\` and installs \`@brett_lamy/ui\`. Import from your alias:

\`\`\`tsx
import { Composer } from '@/components/ui/composer'
\`\`\`
{% endtab %}
{% endtabs %}
`

describe('{% tabs title="…" %} sections', () => {
  it("round-trips title, level and sync", () => {
    const doc = parseMarkdown(INSTALL)
    expect(doc.children[0]).toMatchObject({ type: "tabs", title: "Installation", sync: "install-method" })
    expect(serializeMarkdown(doc)).toBe(INSTALL)
    const h3 = '{% tabs title="Setup" level="3" %}\n{% tab title="A" %}\nx\n{% endtab %}\n{% endtabs %}\n'
    expect(parseMarkdown(h3).children[0]).toMatchObject({ title: "Setup", level: 3 })
    expect(serializeMarkdown(parseMarkdown(h3))).toBe(h3)
  })

  it("renders a heading with an anchor and a pill switch", () => {
    const html = renderToString(<MarkdownContent markdown={INSTALL} />)
    expect(html).toContain('<h2 id="installation" class="docs-tabs-section-title">Installation</h2>')
    expect(html).toContain('class="docs-pills"')
    expect(html).toContain("shadcn CLI")
    expect(html.replace(/<[^>]+>/g, "")).toContain("pnpm add @brett_lamy/ui")
  })

  it("contributes to the outline", () => {
    expect(documentOutline(parseMarkdown(`# Composer\n\n${INSTALL}\n## Usage`))).toEqual([
      { level: 1, text: "Composer", id: "composer" },
      { level: 2, text: "Installation", id: "installation" },
      { level: 2, text: "Usage", id: "usage" },
    ])
  })

  it("survives Copy page as is, and flattens for the plain format", async () => {
    await expect(resolveDemosToMarkdown(INSTALL, undefined)).resolves.toBe(INSTALL)
    const plain = await resolveDemosToMarkdown(INSTALL, undefined, { format: "plain" })
    expect(plain).toBe(`## Installation

**npm**

\`\`\`sh
npm install @brett_lamy/ui
\`\`\`

Import the stylesheet once at your app's entry, then the parts from the package root:

\`\`\`tsx
import '@brett_lamy/ui/styles.css'

import { Composer, ComposerInput } from '@brett_lamy/ui'
\`\`\`

**shadcn CLI**

\`\`\`sh
npx shadcn@latest add https://blamy.github.io/ui/r/composer.json
\`\`\`

Adds \`@/components/ui/composer.tsx\` and installs \`@brett_lamy/ui\`. Import from your alias:

\`\`\`tsx
import { Composer } from '@/components/ui/composer'
\`\`\`
`)
  })
})
