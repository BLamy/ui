/* Resolves `{% demo src="<page>/<example>" %}` to the example's meta, files and component.
   Examples are real folders — apps/docs/examples/<page>/<example>/{index.tsx, meta.json, …} — and `blocks/<slug>`
   maps to the registry block folder registry/blocks/<slug> (entry page.tsx). What renders and what readers see
   are the same files; nothing here holds code strings.
   (Same shape docstream's createGlobDemoResolver produces; phase 2 swaps this for it.) */
import type { ComponentType } from 'react'
import type { BlockMeta } from '@brett_lamy/registry/blocks/types'
import type { DemoText } from './page-md'

export interface DemoVariant {
  id: string
  label: string
}

/** An example's meta.json. */
export interface DemoMeta {
  title: string
  description?: string
  /** Preview height hint (px). */
  height?: number
  /** Header switch between variants, passed to the component as `variant`. */
  variants?: DemoVariant[]
  /** Entry file (default index.tsx; page.tsx for blocks). */
  entry?: string
  /** `auto` (default): multi-file viewer when the example has more than one file, code under the demo otherwise. */
  layout?: 'auto' | 'single' | 'multi'
  /** Drop the padded preview surface (demos that bring their own full-bleed frame). */
  bleed?: boolean
  /** Token family of the preview surface: BL UI (default) or Workbench. */
  theme?: 'bl' | 'wb'
  /** Header status label; false hides it. */
  status?: string | false
  /** Width of the variant switch (px). */
  variantsWidth?: number
}

export type DemoComponent = ComponentType<{ variant?: string }>
type Loaded = { default: DemoComponent }
type Source = string | (() => Promise<string>)

export interface ResolvedDemo {
  src: string
  kind: 'example' | 'block'
  meta: DemoMeta
  entry: string
  /** File name → source, entry first. Examples are eager; block sources load on demand. */
  files: Record<string, Source>
  /** The component, when already loaded (examples). */
  component?: DemoComponent
  load: () => Promise<Loaded>
}

export type DemoResolver = (src: string) => ResolvedDemo | undefined

const EX = '../examples/'
const exMeta = import.meta.glob<DemoMeta>('../examples/*/*/meta.json', { eager: true, import: 'default' })
const exModules = import.meta.glob<Loaded>('../examples/*/*/*.tsx', { eager: true })
const exRaw = import.meta.glob<string>('../examples/*/*/**/*.{ts,tsx,css,json}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

const BL = '../../../registry/blocks/'
const blockMeta = import.meta.glob<BlockMeta>('../../../registry/blocks/*/meta.json', { eager: true, import: 'default' })
const blockPages = import.meta.glob<Loaded>('../../../registry/blocks/*/page.tsx')
const blockRaw = import.meta.glob<string>(
  ['../../../registry/blocks/*/**/*.{ts,tsx,css,json}', '!../../../registry/blocks/*/**/*.stories.tsx'],
  { query: '?raw', import: 'default' },
)

function resolveExample(src: string): ResolvedDemo | undefined {
  const dir = EX + src + '/'
  const meta = exMeta[dir + 'meta.json']
  if (!meta) return undefined
  const entry = meta.entry ?? 'index.tsx'
  const mod = exModules[dir + entry]
  if (!mod) return undefined
  const names = Object.keys(exRaw)
    .filter((p) => p.startsWith(dir) && !p.endsWith('/meta.json'))
    .map((p) => p.slice(dir.length))
    .sort((a, b) => (a === entry ? -1 : b === entry ? 1 : a.localeCompare(b)))
  const files = Object.fromEntries(names.map((n) => [n, exRaw[dir + n]]))
  return { src, kind: 'example', meta, entry, files, component: mod.default, load: async () => mod }
}

function resolveBlock(slug: string): ResolvedDemo | undefined {
  const dir = BL + slug + '/'
  const meta = blockMeta[dir + 'meta.json']
  const load = blockPages[dir + 'page.tsx']
  if (!meta || !load) return undefined
  const files: Record<string, Source> = {}
  for (const f of meta.files) if (blockRaw[dir + f]) files[f] = blockRaw[dir + f]
  return {
    src: 'blocks/' + slug,
    kind: 'block',
    meta: { title: meta.title, description: meta.description, entry: 'page.tsx', layout: 'multi', bleed: true },
    entry: 'page.tsx',
    files,
    load,
  }
}

export const resolveDemo: DemoResolver = (src) =>
  src.startsWith('blocks/') ? resolveBlock(src.slice('blocks/'.length)) : resolveExample(src)

/** Every registry block slug (for the nav count and `?block=` links). */
export const BLOCK_SLUGS = Object.keys(blockMeta)
  .map((p) => p.slice(BL.length, -'/meta.json'.length))
  .sort()

/** Multi-file viewer or code under the demo: the tag's `layout`, else the meta's, else by file count. */
export function demoLayout(demo: ResolvedDemo, attr?: string): 'single' | 'multi' {
  const l = attr ?? demo.meta.layout ?? 'auto'
  if (l === 'single' || l === 'multi') return l
  return Object.keys(demo.files).length > 1 ? 'multi' : 'single'
}

/** A demo's files as text (for "Copy page"), loading lazy sources. */
export async function demoText(src: string): Promise<DemoText | undefined> {
  const d = resolveDemo(src)
  if (!d) return undefined
  const files = await Promise.all(
    Object.entries(d.files).map(async ([n, s]) => [n, typeof s === 'string' ? s : await s()] as [string, string]),
  )
  return { title: d.meta.title, files }
}
