// @vitest-environment happy-dom
import { checkServer, mount } from '@ui-sdk/core/testing';
import { describe, expect, it } from 'vitest';
import { spreadsheet } from '@/lib/spreadsheet-primitive';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

const ROWS = [['Name', 'Qty'], ['pear', '3'], ['apple', '10']];
const MARKUP = `<root><grid aria-label="Fruit"><rowgroup id="body">
  <row id="0" row="0"><cell id="0:0" row="0" col="0">pear</cell><cell id="0:1" row="0" col="1">3</cell></row>
  <row id="1" row="1"><cell id="1:0" row="1" col="0">apple</cell><cell id="1:1" row="1" col="1">10</cell></row>
</rowgroup></grid></root>`;

describe('spreadsheet primitive', () => {
  // Keys, pointer and focus are covered through the React parts in components/spreadsheet.test.tsx.
  it('edits through its api and records history', () => {
    const view = mount(spreadsheet, { defaultValue: ROWS }, MARKUP);
    try {
      expect(view.api.edit({ row: 1, col: 1 }, '12')).toBe(true);
      expect(view.state.value).toEqual([['Name', 'Qty'], ['pear', '3'], ['apple', '12']]);
      expect(view.changes.at(-1)).toMatchObject({ key: 'value', reason: 'imperative' });
      expect(view.api.undo()).toBe(true);
      expect(view.state.value).toEqual(ROWS);
      expect(view.changes.at(-1)).toMatchObject({ key: 'value', reason: 'undo' });
      expect(view.api.redo()).toBe(true);
      expect(view.state.value[2][1]).toBe('12');
    } finally {
      view.unmount();
    }
  });

  it('renders on the server, reading no browser globals', () => {
    const html = checkServer(spreadsheet, { defaultValue: ROWS }, MARKUP);
    expect(html).toContain('role="grid"');
    expect(html).toContain('aria-rowcount="3"');
  });
});
