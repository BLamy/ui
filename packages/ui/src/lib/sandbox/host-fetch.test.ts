import { describe, expect, it, vi } from 'vitest';
import { createHostFetch } from './host-fetch';

const privateOnly = (url: string) => new URL(url).hostname.endsWith('.internal');

describe('createHostFetch', () => {
  it('hands the requests it is told to the page, keeping method, headers and body', async () => {
    const send = vi.fn(async () => ({ status: 201, statusText: 'Created', headers: [['content-type', 'text/plain']] as Array<[string, string]>, body: new TextEncoder().encode('from the page') }));
    const fallback = vi.fn<typeof fetch>();
    const fetcher = createHostFetch(privateOnly, send, fallback);
    const response = await fetcher('http://notes.internal/echo', { method: 'POST', headers: { 'x-test': 'yes' }, body: 'hello' });
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe('from the page');
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      url: 'http://notes.internal/echo', method: 'POST', body: new TextEncoder().encode('hello'), redirect: 'follow',
      headers: expect.arrayContaining([['x-test', 'yes']]),
    }), expect.any(AbortSignal));
    await fetcher(new Request('http://db.internal/ping'));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'http://db.internal/ping', method: 'GET', body: null }), expect.any(AbortSignal));
    expect(fallback).not.toHaveBeenCalled();
  });

  it('leaves every other request to the Worker\'s own fetch', async () => {
    const fallback = vi.fn<typeof fetch>().mockResolvedValue(new Response('network'));
    const send = vi.fn();
    const fetcher = createHostFetch(privateOnly, send, fallback);
    await fetcher('https://registry.npmjs.org/lodash');
    await fetcher('http://localhost:4421/ui/', { method: 'POST' });
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenLastCalledWith('http://localhost:4421/ui/', { method: 'POST' });
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send an aborted request', async () => {
    const send = vi.fn();
    const fetcher = createHostFetch(privateOnly, send, vi.fn());
    await expect(fetcher('http://notes.internal/', { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });

  it('answers a status that has no body without one, whatever the page sent along', async () => {
    for (const status of [204, 205, 304]) {
      // The way a page answers when it reads every response the same way: an empty array, never null.
      const send = async () => ({ status, statusText: 'Whatever', headers: [['etag', '"1"']] as Array<[string, string]>, body: new Uint8Array(0) });
      const response = await createHostFetch(() => true, send, vi.fn())('http://notes.internal/item', { method: 'DELETE' });
      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
      expect(response.headers.get('etag')).toBe('"1"');
    }
  });

  it('fails as a fetch fails when the page answers with something a response can\'t be', async () => {
    const answer = (status: number, statusText = '') => createHostFetch(() => true, async () => ({ status, statusText, headers: [], body: null }), vi.fn())('http://notes.internal/');
    // What a page's `fetch` gives for a redirect it was told not to follow.
    await expect(answer(0)).rejects.toThrow(new TypeError('The page answered with the status 0, which a response can\'t have.'));
    await expect(answer(99)).rejects.toBeInstanceOf(TypeError);
    await expect(answer(600)).rejects.toBeInstanceOf(TypeError);
    await expect(answer(200, 'not\na status')).rejects.toBeInstanceOf(TypeError);
    await expect(answer(599)).resolves.toMatchObject({ status: 599 });
  });
});
