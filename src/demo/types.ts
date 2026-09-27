import type { ComponentType } from "react"
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
