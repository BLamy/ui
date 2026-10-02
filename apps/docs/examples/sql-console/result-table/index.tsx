import { ResultTable } from '@/components/ui/result-table'

// ResultTable takes a plain result — no database needed. Fields carry PGlite's
// type OIDs (dataTypeID), which is how dates, numerics and JSON are formatted.
const result = {
  fields: [
    { name: 'id', dataTypeID: 23 },
    { name: 'title', dataTypeID: 25 },
    { name: 'price', dataTypeID: 1700 },
    { name: 'published', dataTypeID: 1082 },
    { name: 'in_stock', dataTypeID: 16 },
    { name: 'meta', dataTypeID: 3802 },
    { name: 'cover', dataTypeID: 17 },
    { name: 'added_at', dataTypeID: 1184 },
  ],
  rows: [
    {
      id: 1, title: 'A Wizard of Earthsea', price: '12.50', published: new Date('1968-11-01'), in_stock: true,
      meta: { pages: 183, series: 'Earthsea' }, cover: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), added_at: new Date('2026-01-02T03:04:05Z'),
    },
    {
      id: 2, title: 'The Left Hand of Darkness', price: '14.99', published: new Date('1969-03-01'), in_stock: false,
      meta: { pages: 304, awards: ['Hugo', 'Nebula'], blurb: 'A lone human envoy on a planet where people have no fixed sex, and a winter that does not end. '.repeat(2) },
      cover: null, added_at: new Date('2026-01-02T03:04:05Z'),
    },
    { id: 3, title: null, price: null, published: null, in_stock: null, meta: null, cover: null, added_at: null },
  ],
  command: 'SELECT',
}

export default function Results() {
  return <ResultTable result={result} durationMs={3.2} maxHeight="20rem" resizable />
}
