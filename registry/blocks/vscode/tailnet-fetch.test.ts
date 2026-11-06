import { describe, expect, it, vi } from 'vitest';
import { createWorkerTailnetFetch } from './almostnode/tailnet-fetch';

describe('VS Code terminal tailnet fetch', () => {
  it('routes tailnet names and addresses through Tailscale, retaining method, headers and body', async () => {
    const send = vi.fn(async () => ({ status: 200, statusText: 'OK', headers: [['content-type', 'text/plain']] as Array<[string, string]>, body: new TextEncoder().encode('through the tailnet') }));
    const fallback = vi.fn<typeof fetch>();
    const fetcher = createWorkerTailnetFetch(send, fallback);
    const response = await fetcher('http://notes.demo-tailnet.ts.net/echo', { method: 'POST', headers: { 'x-test': 'yes' }, body: 'hello' });
    expect(await response.text()).toBe('through the tailnet');
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({
      url: 'http://notes.demo-tailnet.ts.net/echo', method: 'POST', body: new TextEncoder().encode('hello'),
      headers: expect.arrayContaining([['x-test', 'yes']]),
    }), expect.any(AbortSignal));
    await fetcher('http://100.101.102.103/ping');
    expect(send).toHaveBeenCalledTimes(2);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('leaves public and same-origin requests in the isolated Worker', async () => {
    const fallback = vi.fn<typeof fetch>().mockResolvedValue(new Response('network'));
    const send = vi.fn();
    const fetcher = createWorkerTailnetFetch(send, fallback);
    await fetcher('https://registry.npmjs.org/lodash');
    await fetcher('http://localhost:4421/ui/');
    expect(fallback).toHaveBeenCalledTimes(2);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not send an aborted request', async () => {
    const send = vi.fn();
    const fetcher = createWorkerTailnetFetch(send, vi.fn());
    await expect(fetcher('http://100.101.102.103/', { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
