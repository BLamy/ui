import { describe, expect, it } from 'vitest';
import { isTailnetUrl } from './almostnode/tailnet-fetch';

describe('which of the terminal\'s requests go to the page\'s tailnet connection', () => {
  it('takes HTTP to tailnet names and addresses', () => {
    expect(isTailnetUrl('http://notes.demo-tailnet.ts.net/echo')).toBe(true);
    expect(isTailnetUrl('https://notes.demo-tailnet.ts.net/')).toBe(true);
    expect(isTailnetUrl('http://100.101.102.103/ping')).toBe(true);
  });

  it('leaves package downloads, the site itself and everything that is not HTTP in the Worker', () => {
    expect(isTailnetUrl('https://registry.npmjs.org/lodash')).toBe(false);
    expect(isTailnetUrl('http://localhost:4421/ui/')).toBe(false);
    expect(isTailnetUrl('ws://notes.demo-tailnet.ts.net/')).toBe(false);
    expect(isTailnetUrl('not a url')).toBe(false);
  });
});
