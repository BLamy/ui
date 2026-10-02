import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResultTable, type ResultSet } from '@/components/ui/result-table';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ResultTable> = {
  title: 'Molecules/ResultTable',
  component: ResultTable,
  decorators: [(Story) => <Panel w={900}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ResultTable>;

const books: ResultSet = {
  command: 'SELECT',
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
    { id: 1, title: 'A Wizard of Earthsea', price: '12.50', published: new Date('1968-11-01'), in_stock: true, meta: { pages: 183 }, cover: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), added_at: new Date('2026-01-02T03:04:05Z') },
    { id: 2, title: 'The Left Hand of Darkness', price: '14.99', published: new Date('1969-03-01'), in_stock: false, meta: { pages: 304, awards: ['Hugo', 'Nebula'], blurb: 'A lone human envoy on a planet where people have no fixed sex, and a winter that never ends.' }, cover: null, added_at: new Date('2026-01-02T03:04:05Z') },
    { id: 3, title: null, price: null, published: null, in_stock: null, meta: null, cover: null, added_at: null },
  ],
};

export const Default: Story = { args: { result: books, durationMs: 3.2 } };
export const Resizable: Story = { args: { result: books, durationMs: 3.2, resizable: true } };
export const Comfortable: Story = { args: { result: books, durationMs: 3.2, density: 'comfortable' } };
export const Write: Story = { args: { result: { command: 'INSERT', rowCount: 2, fields: [], rows: [] }, durationMs: 1.4 } };
export const Empty: Story = { args: { result: { command: 'SELECT', fields: books.fields, rows: [] }, durationMs: 0.8 } };
export const Paged: Story = {
  args: {
    maxRows: 5,
    result: {
      command: 'SELECT',
      fields: [{ name: 'n', dataTypeID: 23 }, { name: 'square', dataTypeID: 23 }],
      rows: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, square: (i + 1) ** 2 })),
    },
  },
};
export const Dark: Story = {
  args: { result: books, durationMs: 3.2 },
  decorators: [(Story) => <Panel w={900} dark><Story /></Panel>],
};
