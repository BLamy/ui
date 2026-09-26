/* Docs-only chrome around the examples: a rounded, hairline-bordered window the example renders inside, and
   the builder that turns a page's regions into LIVE entries. None of this is part of the example code. */
import type { ReactNode } from 'react'
import type { LiveSpec } from '../frame'
import { exampleSource } from './source'

/** A rounded window with the page background; `width` caps it (phone-sized examples), centered. */
export function Window({
  width,
  children,
  bg = 'var(--bl-bg)',
}: {
  width?: number
  children?: ReactNode
  bg?: string
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export interface ExampleDef extends Omit<LiveSpec, 'code' | 'theme' | 'h'> {
  id: string
  theme?: LiveSpec['theme']
  h?: number
  /** Per-variant regions: the code panel follows the header switch. */
  regionFor?: (variant: string) => string
}

/** LIVE entries for a page: each example's code is its own region of the page's source file. */
export function examples(raw: string, defs: ExampleDef[]): Record<string, LiveSpec> {
  return Object.fromEntries(
    defs.map(({ id, theme = 'bl', h = 400, regionFor, ...rest }) => [
      id,
      {
        theme,
        h,
        ...rest,
        code: exampleSource(raw, regionFor ? regionFor(rest.variants?.[0]?.id ?? '') : id),
        codeFor: regionFor ? (v: string) => exampleSource(raw, regionFor(v)) : undefined,
      } satisfies LiveSpec,
    ]),
  )
}
