import type { ComponentType, ReactNode } from "react"
import type { DemoLayout, DemoVariantOption } from "../gitbook/ast"

export type DemoVariant = DemoVariantOption

/** Defaults for a demo folder, usually its `meta.json`. `{% demo %}` attributes override them. */
export interface DemoMeta {
  title?: string
  description?: string
  /** Preview height: pixels, or any CSS length (`"60vh"`, `"auto"`). */
  height?: number | string
  variants?: DemoVariant[]
  /** Entry file, relative to the demo folder. Defaults to `index.tsx`. */
  entry?: string
  layout?: DemoLayout
  /** Drop the padded preview surface for demos that bring their own full-bleed frame. */
  bleed?: boolean
}

export interface DemoFile {
  /** Path relative to the demo folder (`index.tsx`, `parts/Card.tsx`). */
  path: string
  content: string
  /** Highlighting language; defaults to the file extension. */
  language?: string
}

/** Props the loaded demo component receives. */
export interface DemoComponentProps {
  variant?: string
}

export type DemoComponent = ComponentType<DemoComponentProps>

/**
 * How a host turns `{% demo src="<page>/<example>" %}` into something renderable.
 * `createGlobDemoResolver` builds one from Vite `import.meta.glob` maps.
 */
export interface DemoResolver {
  /** Every known demo id (optional; used by tooling and llms.txt generators). */
  list?(): string[]
  meta(src: string): Promise<DemoMeta | undefined>
  /** The demo's source files, entry first. These are exactly what the Code view shows. */
  files(src: string): Promise<DemoFile[]>
  /** The component to render in-page. */
  load(src: string): Promise<DemoComponent>
  /**
   * Optional deep link that renders the demo alone (e.g. `?demo=<src>`); the host
   * routes it to `<DemoFullscreen>`. When present, the viewer shows an
   * "Open in new tab" link next to its in-page fullscreen button.
   */
  href?(src: string, options?: { variant?: string }): string | undefined
}

/** What an inline-demo runtime gets: the block's own files, ready to run. */
export interface InlineDemoRuntimeProps {
  /** The block's `src` (may be empty); useful as a cache key or label. */
  src: string
  title: string
  /** The inline files, entry first, paths relative to the demo folder. */
  files: DemoFile[]
  /** Path of the entry file (its default export is the component). */
  entry: string
  /** The selected variant, passed to the component as its `variant` prop. */
  variant?: string
  /** Extra npm dependencies (`{ "@brett_lamy/ui": "^1.2.0" }`) the files may import. */
  dependencies?: Record<string, string>
}

/**
 * Renders the Preview of a `{% demo %}` block that carries its files inline and has
 * no resolver behind it. `@brett_lamy/docstream/playground` provides an almost-node
 * implementation (`createAlmostNodeDemoRuntime`), which `PlaygroundStreamdown` (the
 * package root's `GitbookStreamdown`) wires in by default.
 */
export type InlineDemoRuntime = (props: InlineDemoRuntimeProps) => ReactNode

export interface DemoRuntimeOptions {
  runtime?: InlineDemoRuntime
  /** Extra npm dependencies handed to the runtime for every inline demo. */
  dependencies?: Record<string, string>
}
