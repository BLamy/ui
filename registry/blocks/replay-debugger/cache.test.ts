import { describe, expect, it } from 'vitest';
import { CachedClock, cacheIndex, createCachedHost, navigateCached, storyOf } from '@/components/ui/replay-debugger';
import { SHOP_RECORDING as cache } from './shop-recording';

/* The facts full-stack-osx-demo's apps/inspector/demos/node/expect.json checks by replaying recording.dat with the
   linker: the same answers have to come out of the JSON, with no engine. */
const source = cache.sources[0];
const lineOf = (text: string) => source.contents.split('\n').findIndex((l) => l.includes(text)) + 1;
const rateLine = lineOf('const rate = owner.vip');

describe('a recording read from its JSON cache', () => {
  it('is the recording expect.json describes', () => {
    expect(cache.format).toBe('bl-replay-cache/2');
    expect(cache.recording.buildId).toBe('macOS-node-20261111-3f00472bf854-d79da1fcf860');
    expect(cache.recording.steps).toBe(174);
    expect(source.url).toBe('shop.js');
    expect(cache.console.map((m) => m.text)).toEqual(['skipped: bad order line: ",1,1"', 'Alice pays 2.4', 'Bob pays 17.85', 'grand total 20.25']);
  });

  it('knows a line ran twice, and the stack and values at its second run', async () => {
    const hits = cache.hits[source.id][rateLine];
    expect(hits).toHaveLength(2);
    const host = createCachedHost(cache);
    const pause = await host.pause(hits[1]);
    if (pause.superseded) throw new Error('superseded');
    expect(pause.frames.data?.frames?.map((f) => [f.functionName, f.location?.[0]?.line])).toEqual([
      ['applyDiscount', 24],
      ['total', 19],
      ['checkout', 41],
    ]);
    const frameId = pause.frames.data!.frames![0].frameId;
    expect((await host.evaluate(hits[1], frameId, 'amount')).returned).toEqual({ value: 17.85 });
    expect((await host.evaluate(hits[1], frameId, 'owner.name')).returned).toEqual({ value: 'Bob' });
    expect((await host.evaluate(hits[1], frameId, 'owner.vip')).returned).toEqual({ value: false });
    expect((await host.evaluate(hits[1], frameId, 'amount * 2')).exception).toBeDefined();
  });

  it('steps from the table and continues to breakpoints from the hits', () => {
    const [first, second] = cache.hits[source.id][rateLine];
    const start = cache.steps[0].index;
    expect(navigateCached(cache, start, 'continue', [{ sourceId: source.id, line: rateLine }])).toBe(first);
    expect(navigateCached(cache, first, 'continue', [{ sourceId: source.id, line: rateLine }])).toBe(second);
    expect(navigateCached(cache, second, 'rewind', [{ sourceId: source.id, line: rateLine }])).toBe(first);
    expect(navigateCached(cache, second, 'continue', [{ sourceId: source.id, line: rateLine }])).toBe(-1);
    // Into applyDiscount and back out of it.
    const into = navigateCached(cache, first, 'stepOut');
    expect(cacheIndex(cache).step(into)?.depth).toBeLessThan(cacheIndex(cache).step(first)!.depth);
    for (const step of cache.steps) for (const target of step.nav) if (target >= 0) expect(cacheIndex(cache).step(target)).toBeDefined();
  });

  it('puts the playhead on the step at or before a time', () => {
    const clock = new CachedClock(cache);
    const [a, b] = cache.steps;
    expect(clock.positionAt(a.ms - 5)).toMatchObject({ step: -1, idle: { kind: 'before', nextStep: a.index } });
    expect(clock.positionAt(a.ms).step).toBe(a.index);
    expect(clock.positionAt(b.ms).step).toBe(b.index);
    expect(clock.timeOf(b.index)).toBe(b.ms);
  });

  it('tells the run as a story, with the values beside each line', () => {
    const story = storyOf(cache);
    expect(story).toHaveLength(cache.steps.length);
    const second = story.filter((e) => e.line === rateLine)[1];
    expect(second.functionName).toBe('applyDiscount');
    expect(second.values).toContainEqual({ name: 'amount', text: '17.85' });
    expect(story.filter((e) => e.logged).map((e) => e.logged!.text)).toContain('Bob pays 17.85');
  });
});
