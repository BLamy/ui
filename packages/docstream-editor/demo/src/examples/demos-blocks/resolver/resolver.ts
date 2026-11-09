/* A DemoResolver without a file system: components imported here, their sources as raw strings.
   The docs site itself uses createGlobDemoResolver over a folder; any object with these methods works. */
import type { DemoComponent, DemoFile, DemoMeta, DemoResolver } from "@brett_lamy/docstream/demo"
import Counter from "./widgets/Counter"
import Badge from "./widgets/Badge"
import counterSource from "./widgets/Counter.tsx?raw"
import badgeSource from "./widgets/Badge.tsx?raw"

const DEMOS: Record<string, { component: DemoComponent; files: DemoFile[]; meta: DemoMeta }> = {
  "widgets/counter": { component: Counter, files: [{ path: "index.tsx", content: counterSource }], meta: { title: "Counter", description: "From the host's resolver." } },
  "widgets/badge": {
    component: Badge,
    files: [{ path: "index.tsx", content: badgeSource }],
    meta: { title: "Badge", variants: [{ id: "soft", label: "Soft" }, { id: "solid", label: "Solid" }] },
  },
}

export const demoResolver: DemoResolver = {
  list: () => Object.keys(DEMOS),
  meta: async (src) => DEMOS[src]?.meta,
  files: async (src) => DEMOS[src]?.files ?? [],
  load: async (src) => {
    const demo = DEMOS[src]
    if (!demo) throw new Error(`Unknown demo ${src}`)
    return demo.component
  },
}
