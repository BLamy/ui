// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastQueue } from '@/components/ui/toast';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const first = (q: ReturnType<typeof createToastQueue>) => q.aria.visibleToasts[0];
/** The visible toast matching `pick`, failing the test when there is none. */
function find(q: ReturnType<typeof createToastQueue>, pick: (data: { id: string; title: string }) => boolean) {
  const t = q.aria.visibleToasts.find((x) => pick(x.content.data));
  if (!t) throw new Error('no such toast');
  return t;
}

describe('ToastQueue', () => {
  it('uses the variant default timeout, and 0 means until closed', () => {
    const q = createToastQueue();
    q.show({ title: 'a' });
    q.show({ title: 'b', variant: 'hud' });
    q.show({ title: 'c' }, { timeout: 0 });
    const by = (title: string) => find(q, (d) => d.title === title);
    expect(by('a').timeout).toBe(5000);
    expect(by('b').timeout).toBe(1600);
    expect(by('c').timeout).toBeUndefined();
  });

  it('update keeps the timeout the toast was shown with', () => {
    const q = createToastQueue();
    const id = q.show({ title: 'Saving' }, { timeout: 12000 });
    q.update(id, { title: 'Saved', tone: 'success' });
    expect(first(q).content.data.title).toBe('Saved');
    expect(first(q).timeout).toBe(12000);
  });

  it('update keeps a toast that stays until closed staying until closed', () => {
    const q = createToastQueue();
    const id = q.show({ title: 'Pinned' }, { timeout: 0 });
    q.update(id, { title: 'Still pinned' });
    expect(first(q).timeout).toBeUndefined();
  });

  it('update on a loading toast starts the default timeout, and an explicit timeout wins', () => {
    const q = createToastQueue();
    const a = q.show({ title: 'Uploading', loading: true });
    q.update(a, { title: 'Uploaded' });
    expect(find(q, (d) => d.id === a).timeout).toBe(5000);
    const b = q.show({ title: 'Working', loading: true });
    q.update(b, { title: 'Done' }, { timeout: 2500 });
    expect(find(q, (d) => d.id === b).timeout).toBe(2500);
  });

  it('showing a toast with a visible one’s id updates it in place instead of stacking', () => {
    const q = createToastQueue();
    q.show({ id: 'x', title: 'one' });
    q.show({ id: 'x', title: 'two' });
    expect(q.aria.visibleToasts).toHaveLength(1);
    expect(first(q).content.data.title).toBe('two');
  });

  it('one HUD at a time: a new HUD takes over the visible one', () => {
    const q = createToastQueue();
    q.show({ title: 'Copied', variant: 'hud' });
    q.show({ title: 'Copied again', variant: 'hud' });
    expect(q.aria.visibleToasts).toHaveLength(1);
    expect(first(q).content.data.title).toBe('Copied again');
  });

  it('keeps the newest first, which is the one in front of the pile', () => {
    const q = createToastQueue();
    q.show({ title: 'old' });
    q.show({ title: 'new' });
    expect(q.aria.visibleToasts.map((t) => t.content.data.title)).toEqual(['new', 'old']);
  });
});
