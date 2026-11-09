import type { DemoComponent, DemoFile, DemoMeta, DemoResolver } from "@brett_lamy/docstream"
import { Greeting } from "./Greeting"

/* A hand-written DemoResolver: no Vite globs, no files on disk — just the four methods.
   A real one might fetch from a CMS, a database, or a registry API. */
interface Entry {
  meta: DemoMeta
  files: DemoFile[]
  component: DemoComponent
}

const GREETING_SOURCE = `export function Greeting({ variant = "hello" }) {
  return <p>{variant === "hello" ? "Hello" : "Goodbye"}, docstream!</p>
}`

const DEMOS: Record<string, Entry> = {
  "memory/greeting": {
    meta: {
      title: "Greeting (from memory)",
      description: "Resolved by an in-memory `DemoResolver` — no `import.meta.glob`.",
      status: "Custom resolver",
      variants: [
        { id: "hello", label: "Hello" },
        { id: "bye", label: "Goodbye" },
      ],
    },
    files: [{ path: "Greeting.tsx", content: GREETING_SOURCE, language: "tsx" }],
    component: Greeting,
  },
}

const lookup = (src: string) => {
  const entry = DEMOS[src]
  if (!entry) throw new Error(`Unknown demo: ${src}`)
  return entry
}

export const memoryResolver: DemoResolver = {
  list: () => Object.keys(DEMOS),
  meta: async (src) => DEMOS[src]?.meta,
  files: async (src) => lookup(src).files,
  // Simulate a network round trip so the loading state shows.
  load: (src) => new Promise((resolve) => setTimeout(() => resolve(lookup(src).component), 400)),
}
