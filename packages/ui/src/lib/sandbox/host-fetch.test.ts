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
});
