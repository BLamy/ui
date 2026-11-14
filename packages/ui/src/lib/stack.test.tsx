// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { bindLayer, createChange, definePrimitive, type ChangeDetails } from '@ui-sdk/core';
import { mount } from '@ui-sdk/core/testing';
import { createParts } from '@ui-sdk/react/primitive';
import { bindEdgeSwipe } from '@/lib/edge-swipe';
import { createStack, type StackExit, type StackOptions, type StackReason } from '@/lib/stack';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

type NavState = { pages: string[]; exiting: StackExit[]; on: boolean };
type NavReason = StackReason | 'item-press';
type NavOptions = {
  pages?: string[];
  defaultPages?: string[];
  onPagesChange?: (pages: string[], details: ChangeDetails<NavReason>) => void;
  back?: StackOptions<NavState, NavReason>['back'];
  initialFocus?: (key: string) => HTMLElement | null | undefined | void;
  /** Whether it is a stack now; off, its pages stay but nothing pops. */
  on?: boolean;
  /** Pages that never unmount (`createStack`'s `persistent`). */
  persistent?: boolean;
};

const nav = definePrimitive({
  name: 'nav',
  options: { pages: 'list', defaultPages: 'list', onPagesChange: 'callback', back: 'value', initialFocus: 'value', on: 'boolean', persistent: 'boolean' },
  controlled: ['pages'],
  state: (options: NavOptions): NavState => ({
    pages: options.pages ?? options.defaultPages ?? ['home'],
    exiting: [],
    on: options.on ?? true,
  }),
  sync: (options) => ({ on: options.on ?? true, ...(options.pages === undefined ? {} : { pages: options.pages }) }),
  api: (context) => {
    const change = createChange(context);
    const { back, initialFocus, persistent } = context.options();
    const stack = createStack<NavState, NavReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      set: (value, details) => change('pages', value, details),
      back,
      active: () => context.store.get().on,
      persistent,
    });
    return { stack, initialFocus, persistent };
  },
  slots: (slot) => ({
    root: slot({}),
    page: slot<{ value: string }>({
      props: { value: 'string' },
      present: (state, { api, key }) => !!api.persistent || api.stack.present(state, key),
      attrs: (state, { api, key }) => api.stack.pageAttrs(state, key),
      bind: (el, { api, key }) =>
        api.stack.bindPage(el, key, api.initialFocus && { initialFocus: () => api.initialFocus?.(key) }),
    }),
  }),
});

const markup = `<root>
  <page value="home"><button>Open</button></page>
  <page value="detail"><button>Back</button><button>More</button></page>
  <page value="more"><p>Nothing to press</p></page>
  <page value="other"><button>Done</button></page>
</root>`;

const views: { unmount: () => void }[] = [];
afterEach(() => {
  views.splice(0).forEach((view) => view.unmount());
  cleanup();
  document.body.replaceChildren();
});

function open(options: NavOptions = {}) {
  const view = mount(nav, options, markup);
  views.push(view);
  const page = (key: string) => view.part('page', key)!;
  const button = (key: string, name: string) => [...page(key).querySelectorAll('button')].find((el) => el.textContent === name)!;
  return { view, stack: view.api.stack, page, button };
}

/** An exit (or a settle) that lasts until `finish` runs, like a CSS transition. */
function animating(el: HTMLElement) {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => (finish = resolve));
  const animation = { finished, effect: null } as unknown as Animation;
  el.getAnimations = () => [animation];
  // A duration, so `animateOut`'s safety timeout outlasts the test.
  el.style.transitionDuration = '10s';
  return finish;
}

const escape = () => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
};
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('createStack pages', () => {
  it('push, pop, popTo and replace change the pages, each with its reason', () => {
    const onPagesChange = vi.fn();
    const { view, stack } = open({ onPagesChange });
    expect(stack.push('detail', { reason: 'item-press' })).toBe(true);
    expect(stack.push('more')).toBe(true);
    expect(view.state.pages).toEqual(['home', 'detail', 'more']);
    expect(stack.replace('other')).toBe(true);
    expect(view.state.pages).toEqual(['home', 'detail', 'other']);
    expect(stack.popTo('home')).toBe(true);
    expect(view.state.pages).toEqual(['home']);
    expect(onPagesChange.mock.calls.map(([, details]) => details.reason)).toEqual(['item-press', 'imperative', 'imperative', 'imperative']);
  });

  it('refuses what changes nothing', () => {
    const { view, stack } = open({ defaultPages: ['home', 'detail'] });
    expect(stack.push('home')).toBe(false);
    expect(stack.replace('home')).toBe(false);
    expect(stack.popTo('detail')).toBe(false);
    expect(stack.popTo('missing')).toBe(false);
    expect(stack.pop()).toBe(true);
    expect(stack.pop()).toBe(false);
    expect(view.state.pages).toEqual(['home']);
  });

  it('a canceled change keeps the pages', () => {
    const { view, stack } = open({ onPagesChange: (_pages, details) => details.cancel() });
    expect(stack.push('detail')).toBe(false);
    expect(view.state.pages).toEqual(['home']);
  });

  it('only pages in the stack render, and the ones under the top are inert and say so', () => {
    const { stack, page } = open();
    expect(page('home').isConnected).toBe(true);
    expect(page('detail').isConnected).toBe(false);
    expect(page('home').getAttribute('tabindex')).toBe('-1');
    stack.push('detail');
    expect(page('detail').isConnected).toBe(true);
    expect(page('home').hasAttribute('inert')).toBe(true);
    expect(page('home').hasAttribute('data-covered')).toBe(true);
    expect(page('detail').hasAttribute('inert')).toBe(false);
  });

  it("a pushed page enters from its starting style, and pages there from the start don't", async () => {
    const { view, stack, page } = open({ defaultPages: ['home', 'detail'] });
    expect(page('detail').hasAttribute('data-starting-style')).toBe(false);
    stack.push('more');
    expect(page('more').hasAttribute('data-starting-style')).toBe(true);
    await view.settle();
    await vi.waitFor(() => expect(page('more').hasAttribute('data-starting-style')).toBe(false));
  });

  it('a popped page stays, with its ending style, until its animation ends', async () => {
    const { view, stack, page } = open({ defaultPages: ['home', 'detail'] });
    const finish = animating(page('detail'));
    stack.pop();
    expect(view.state.exiting).toEqual([{ key: 'detail', covered: false }]);
    expect(page('detail').isConnected).toBe(true);
    expect(page('detail').hasAttribute('data-ending-style')).toBe(true);
    expect(page('home').hasAttribute('data-covered')).toBe(false);
    finish();
    await view.settle();
    expect(view.state.exiting).toEqual([]);
    expect(page('detail').isConnected).toBe(false);
  });

  it('a replaced page leaves covered, under the page that took its place', async () => {
    const { view, stack, page } = open({ defaultPages: ['home', 'detail'] });
    const finish = animating(page('detail'));
    stack.replace('other');
    expect(view.state.exiting).toEqual([{ key: 'detail', covered: true }]);
    expect(page('detail').hasAttribute('data-covered')).toBe(true);
    expect(page('other').hasAttribute('data-starting-style')).toBe(true);
    finish();
    await view.settle();
    expect(page('detail').isConnected).toBe(false);
  });

  it('popTo animates out the top page only', () => {
    const { view, stack, page } = open({ defaultPages: ['home', 'detail', 'more'] });
    animating(page('detail'));
    animating(page('more'));
    stack.popTo('home');
    expect(view.state.exiting).toEqual([{ key: 'more', covered: false }]);
    expect(page('detail').isConnected).toBe(false);
  });

  it('a page pushed again while it leaves comes back', () => {
    const { view, stack, page } = open({ defaultPages: ['home', 'detail'] });
    animating(page('detail'));
    stack.pop();
    stack.push('detail');
    expect(view.state.exiting).toEqual([]);
    expect(page('detail').hasAttribute('data-ending-style')).toBe(false);
    expect(page('detail').inert).toBe(false);
  });
});

describe('createStack with controlled pages, rendered by React', () => {
  const { Root, Page } = createParts(nav, { root: 'div', page: 'section' });
  function Nav({ pages, onPagesChange }: { pages: string[]; onPagesChange?: NavOptions['onPagesChange'] }) {
    return (
      <Root pages={pages} onPagesChange={onPagesChange}>
        <Page value="home"><button>Open</button></Page>
        <Page value="detail"><button>Back</button></Page>
      </Root>
    );
  }
  const pageEl = (container: HTMLElement, key: string) =>
    [...container.querySelectorAll<HTMLElement>('section')].find((el) => el.textContent === (key === 'home' ? 'Open' : 'Back'));

  it('a controlled pop still plays the exit of the page it takes off', async () => {
    const { container, rerender } = render(<Nav pages={['home', 'detail']} />);
    const detail = pageEl(container, 'detail')!;
    expect(detail).toBeDefined();
    const finish = animating(detail);
    rerender(<Nav pages={['home']} />);
    // The render that carries the shorter pages keeps the page, and the stack starts its exit right after (the
    // effects `rerender` flushes). Before, the page unbound in that render and vanished without an exit.
    expect(detail.isConnected).toBe(true);
    expect(detail.hasAttribute('data-ending-style')).toBe(true);
    expect(detail.hasAttribute('data-covered')).toBe(false);
    await act(async () => {
      finish();
      await frame();
    });
    await vi.waitFor(() => expect(pageEl(container, 'detail')).toBeUndefined());
  });

  it('a controlled push enters, and asks the owner first', async () => {
    const onPagesChange = vi.fn();
    const { container, rerender } = render(<Nav pages={['home']} onPagesChange={onPagesChange} />);
    expect(pageEl(container, 'detail')).toBeUndefined();
    rerender(<Nav pages={['home', 'detail']} onPagesChange={onPagesChange} />);
    await act(async () => {});
    // The render that adds the page binds it before the stack hears of the push: it still enters.
    expect(pageEl(container, 'detail')!.hasAttribute('data-starting-style')).toBe(true);
    expect(pageEl(container, 'detail')!.hasAttribute('data-covered')).toBe(false);
    expect(pageEl(container, 'home')!.hasAttribute('data-covered')).toBe(true);
    act(() => void escape());
    expect(onPagesChange).toHaveBeenCalledWith(['home'], expect.objectContaining({ reason: 'escape-key' }));
  });
});

describe('createStack focus', () => {
  it('focus moves into a pushed page, to the first element Tab reaches', async () => {
    const { view, stack, button } = open();
    button('home', 'Open').focus();
    stack.push('detail');
    await view.settle();
    expect(document.activeElement).toBe(button('detail', 'Back'));
  });

  it('a page with nothing to focus takes focus itself', async () => {
    const { view, stack, page, button } = open();
    button('home', 'Open').focus();
    stack.push('more');
    await view.settle();
    expect(document.activeElement).toBe(page('more'));
  });

  it('initialFocus names where focus goes, and nothing returned leaves it', async () => {
    const targets: Record<string, () => HTMLElement | null> = {};
    const { view, stack, button } = open({ initialFocus: (key) => targets[key]?.() });
    targets.detail = () => button('detail', 'More');
    targets.other = () => null;
    button('home', 'Open').focus();
    stack.push('detail');
    await view.settle();
    expect(document.activeElement).toBe(button('detail', 'More'));
    stack.push('other');
    await view.settle();
    expect(document.activeElement).toBe(button('detail', 'More'));
  });

  it('focus outside the stack stays where it is', async () => {
    const { view, stack } = open();
    const outside = document.body.appendChild(document.createElement('button'));
    outside.focus();
    stack.push('detail');
    await view.settle();
    stack.pop();
    await view.settle();
    expect(document.activeElement).toBe(outside);
  });

  it('a pop returns focus to what had it before the push', async () => {
    const { view, stack, button } = open();
    button('home', 'Open').focus();
    stack.push('detail');
    await view.settle();
    stack.pop();
    expect(document.activeElement).toBe(button('home', 'Open'));
  });

  it('popTo returns focus to what pushed the lowest page it takes off', async () => {
    const { view, stack, button } = open();
    button('home', 'Open').focus();
    stack.push('detail');
    await view.settle();
    stack.push('other');
    await view.settle();
    stack.popTo('home');
    expect(document.activeElement).toBe(button('home', 'Open'));
  });

  it('a page that replaced another returns focus where that one would have', async () => {
    const { view, stack, button } = open();
    button('home', 'Open').focus();
    stack.push('detail');
    await view.settle();
    stack.replace('other');
    await view.settle();
    expect(document.activeElement).toBe(button('other', 'Done'));
    stack.pop();
    expect(document.activeElement).toBe(button('home', 'Open'));
  });

  it('when what had focus is gone, focus recovers into the page that shows', async () => {
    const { view, stack, page, button } = open();
    const opener = page('home').appendChild(document.createElement('button'));
    opener.focus();
    stack.push('detail');
    await view.settle();
    opener.remove();
    stack.pop();
    expect(document.activeElement).toBe(button('home', 'Open'));
  });

  it("a page that isn't bound still gives focus back to its opener (a side drawer's host page is only a key)", async () => {
    // Only the pushed page has an element; the first one ("home") is the rest of the app.
    const view = mount(nav, {}, `<root><page value="detail"><button>Back</button></page></root>`);
    views.push(view);
    const opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    view.api.stack.push('detail');
    await view.settle();
    // Focus followed the push in from the unbound page.
    expect(document.activeElement?.textContent).toBe('Back');
    view.api.stack.pop();
    await view.settle();
    expect(document.activeElement).toBe(opener);
  });
});

describe('createStack persistent pages', () => {
  const { Root, Page } = createParts(nav, { root: 'div', page: 'section' });
  function Columns(props: { pages?: string[]; defaultPages?: string[] }) {
    return (
      <Root {...props} persistent>
        <Page value="home"><button>Open</button></Page>
        <Page value="detail"><button>Back</button></Page>
      </Root>
    );
  }

  it('a page that leaves stays mounted and inert, with no exit, even while its transition runs', async () => {
    const { container } = render(<Columns defaultPages={['home', 'detail']} />);
    const [home, detail] = [...container.querySelectorAll<HTMLElement>('section')];
    // A transition that runs while the layout moves the page away, as in a browser.
    const finish = animating(detail);
    detail.querySelector('button')!.focus();
    act(() => void escape());
    expect(detail.isConnected).toBe(true);
    expect(detail.hasAttribute('data-ending-style')).toBe(false);
    expect(detail.inert).toBe(true);
    await act(async () => {
      finish();
      await frame();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    // Nothing cleared the inert the page's attrs hold: it is out of the tab order and the accessibility tree.
    expect(detail.inert).toBe(true);
    expect(home.inert).toBe(false);
    // Focus still moves with the pages.
    expect(document.activeElement).toBe(home.querySelector('button'));
  });

  it('a page pushed onto a persistent stack plays no enter, and the one under it goes inert', async () => {
    const { container, rerender } = render(<Columns pages={['home']} />);
    const [home, detail] = [...container.querySelectorAll<HTMLElement>('section')];
    expect(detail.inert).toBe(true);
    home.querySelector('button')!.focus();
    rerender(<Columns pages={['home', 'detail']} />);
    await act(async () => {});
    expect(detail.hasAttribute('data-starting-style')).toBe(false);
    expect(detail.inert).toBe(false);
    expect(home.inert).toBe(true);
    expect(document.activeElement).toBe(detail.querySelector('button'));
  });
});

describe('createStack Escape and nesting', () => {
  it('Escape pops the top page, and on the first page it is left alone', async () => {
    const onPagesChange = vi.fn();
    const { view, stack } = open({ onPagesChange });
    stack.push('detail');
    await view.settle();
    expect(escape().defaultPrevented).toBe(true);
    expect(view.state.pages).toEqual(['home']);
    expect(onPagesChange).toHaveBeenLastCalledWith(['home'], expect.objectContaining({ reason: 'escape-key', event: expect.any(KeyboardEvent) }));
    expect(escape().defaultPrevented).toBe(false);
  });

  it('on its first page, Escape goes to whatever is around the stack', () => {
    const { view } = open();
    const dismissed = vi.fn();
    const off = bindLayer(view.root, { onDismiss: dismissed });
    escape();
    expect(dismissed).toHaveBeenCalledWith('escape-key', expect.anything());
    off();
  });

  /** An inner stack on the outer one's `detail` page, both with a page to go back to, mounted in either order. */
  function nested(innerFirst = false, options: NavOptions = {}) {
    const mountInner = () => open({ ...options, defaultPages: ['home', 'more'] });
    const mountOuter = () => open({ ...options, defaultPages: ['home', 'detail'] });
    const first = innerFirst ? mountInner() : mountOuter();
    const second = innerFirst ? mountOuter() : mountInner();
    const [inner, outer] = innerFirst ? [first, second] : [second, first];
    outer.page('detail').append(inner.view.root);
    return { inner, outer };
  }

  it('a stack inside another one\'s top page pops first', () => {
    const { inner, outer } = nested();
    escape();
    expect(inner.view.state.pages).toEqual(['home']);
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
    escape();
    expect(outer.view.state.pages).toEqual(['home']);
  });

  it('the inner stack pops first whichever had a page to go back to first', () => {
    const { inner, outer } = nested(true);
    escape();
    expect(inner.view.state.pages).toEqual(['home']);
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
  });

  it('a stack under a covered page leaves Escape to the stack that covers it', () => {
    const { inner, outer } = nested();
    outer.stack.push('other');
    escape();
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
    expect(inner.view.state.pages).toEqual(['home', 'more']);
    escape();
    expect(inner.view.state.pages).toEqual(['home']);
  });

  it('nested stacks with a popup open: the popup closes, then the inner stack pops, then the outer', () => {
    const { inner, outer } = nested();
    const popup = inner.page('more').appendChild(document.createElement('div'));
    const close = vi.fn();
    const off = bindLayer(popup, { onDismiss: close });
    escape();
    expect(close).toHaveBeenCalledWith('escape-key', expect.anything());
    expect(inner.view.state.pages).toEqual(['home', 'more']);
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
    off();
    escape();
    expect(inner.view.state.pages).toEqual(['home']);
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
    escape();
    expect(outer.view.state.pages).toEqual(['home']);
  });

  it('a press in a page still dismisses a layer opened before the stack had a page to go back to', () => {
    const { view, stack, button } = open();
    const popup = document.body.appendChild(document.createElement('div'));
    const close = vi.fn();
    const off = bindLayer(popup, { onDismiss: close });
    stack.push('detail');
    button('detail', 'Back').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(close).toHaveBeenCalledWith('outside-press', expect.anything());
    expect(view.state.pages).toEqual(['home', 'detail']);
    off();
  });

  it('a press anywhere never pops the stack', () => {
    const { view } = open({ defaultPages: ['home', 'detail'] });
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
    expect(view.state.pages).toEqual(['home', 'detail']);
  });

  it('a stack that left the page hears Escape no more', () => {
    const { view } = open({ defaultPages: ['home', 'detail'] });
    view.unmount();
    views.length = 0;
    expect(escape().defaultPrevented).toBe(false);
  });
});

describe('createStack platform back', () => {
  /** `bindBack` as the stack sees it: what is bound now, newest last; a back goes to the newest that takes it. */
  function backs() {
    const bound: ((event: Event) => boolean | void)[] = [];
    const back: NavOptions['back'] = (_el, { onBack }) => {
      bound.push(onBack);
      return () => void bound.splice(bound.indexOf(onBack), 1);
    };
    const goBack = () => [...bound].reverse().find((onBack) => onBack(new Event('close')) !== false);
    return { bound, back, goBack };
  }

  it("asks for the platform's back only while there's a page to go back to", () => {
    const { bound, back } = backs();
    const { stack } = open({ back });
    expect(bound).toHaveLength(0);
    stack.push('detail');
    expect(bound).toHaveLength(1);
    stack.push('more');
    expect(bound).toHaveLength(1);
    stack.popTo('home');
    expect(bound).toHaveLength(0);
  });

  it('a back pops the top page, with its reason', () => {
    const onPagesChange = vi.fn();
    const { back, goBack } = backs();
    const { view } = open({ back, onPagesChange, defaultPages: ['home', 'detail'] });
    goBack();
    expect(view.state.pages).toEqual(['home']);
    expect(onPagesChange).toHaveBeenCalledWith(['home'], expect.objectContaining({ reason: 'back' }));
  });

  it('backs go innermost first, in order: inner stack, then outer', () => {
    const { back, goBack } = backs();
    const outer = open({ back, defaultPages: ['home', 'detail'] });
    const inner = open({ back, defaultPages: ['home', 'more'] });
    outer.page('detail').append(inner.view.root);
    goBack();
    expect(inner.view.state.pages).toEqual(['home']);
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
    goBack();
    expect(outer.view.state.pages).toEqual(['home']);
  });

  it('a stack under a covered page passes a back on to the stack that covers it', () => {
    const { back, goBack } = backs();
    const outer = open({ back, defaultPages: ['home', 'detail'] });
    const inner = open({ back, defaultPages: ['home', 'more'] });
    outer.page('detail').append(inner.view.root);
    outer.stack.push('other');
    goBack();
    expect(inner.view.state.pages).toEqual(['home', 'more']);
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
  });

  it('a canceled pop still takes the back, rather than passing it on', () => {
    const { back, goBack } = backs();
    const outer = open({ back, defaultPages: ['home', 'detail'] });
    const inner = open({ back, defaultPages: ['home', 'more'], onPagesChange: (_pages, details) => details.cancel() });
    outer.page('detail').append(inner.view.root);
    goBack();
    expect(outer.view.state.pages).toEqual(['home', 'detail']);
  });
});

describe('createStack swipe', () => {
  it('refuses a swipe on its first page', () => {
    const { stack } = open();
    expect(stack.swipe.onStart()).toBe(false);
    stack.push('detail');
    expect(stack.swipe.onStart()).toBe(true);
  });

  it('a swipe moves the top page and the one under it, and nothing else', () => {
    const { stack, page } = open({ defaultPages: ['home', 'detail', 'more'] });
    stack.swipe.onStart();
    stack.swipe.onMove(0.25);
    for (const key of ['detail', 'more']) {
      expect(page(key).hasAttribute('data-swiping')).toBe(true);
      expect(page(key).style.getPropertyValue('--stack-progress')).toBe('0.25');
    }
    expect(page('home').hasAttribute('data-swiping')).toBe(false);
  });

  it('a finished swipe pops, a canceled one springs back, and both let go of the pages', () => {
    const onPagesChange = vi.fn();
    const { view, stack, page } = open({ onPagesChange, defaultPages: ['home', 'detail', 'more'] });
    const event = new PointerEvent('pointerup');
    stack.swipe.onStart();
    stack.swipe.onMove(0.2);
    stack.swipe.onEnd(false, { event });
    expect(view.state.pages).toEqual(['home', 'detail', 'more']);
    expect(page('more').hasAttribute('data-swiping')).toBe(false);
    expect(page('more').style.getPropertyValue('--stack-progress')).toBe('');
    stack.swipe.onStart();
    stack.swipe.onMove(0.6);
    stack.swipe.onEnd(true, { event });
    expect(view.state.pages).toEqual(['home', 'detail']);
    expect(page('detail').hasAttribute('data-swiping')).toBe(false);
    expect(onPagesChange).toHaveBeenCalledWith(['home', 'detail'], expect.objectContaining({ reason: 'swipe', event }));
  });

  it('a released swipe keeps data-swipe-settling on its pages until their transitions finish', async () => {
    const { stack, page } = open({ defaultPages: ['home', 'detail'] });
    const finishHome = animating(page('home'));
    const finishDetail = animating(page('detail'));
    stack.swipe.onStart();
    stack.swipe.onMove(0.7);
    stack.swipe.onEnd(true, { event: new PointerEvent('pointerup') });
    // Set in the same task as the pop, so the release runs on the settle spring from where the finger let go.
    expect(page('home').hasAttribute('data-swipe-settling')).toBe(true);
    expect(page('detail').hasAttribute('data-swipe-settling')).toBe(true);
    expect(page('detail').hasAttribute('data-ending-style')).toBe(true);
    await frame();
    await Promise.resolve();
    expect(page('home').hasAttribute('data-swipe-settling')).toBe(true);
    finishHome();
    finishDetail();
    await vi.waitFor(() => expect(page('home').hasAttribute('data-swipe-settling')).toBe(false));
  });

  it('a push or a pop from a button is not a settle', () => {
    const { stack, page } = open({ defaultPages: ['home', 'detail'] });
    stack.pop();
    expect(page('home').hasAttribute('data-swipe-settling')).toBe(false);
  });

  it('connects to bindEdgeSwipe as its options', async () => {
    const { view, stack } = open({ defaultPages: ['home', 'detail'] });
    view.root.getBoundingClientRect = () => new DOMRect(0, 0, 300, 600);
    const off = bindEdgeSwipe(view.root, { ...stack.swipe });
    const at = (type: string, x: number) =>
      new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, clientX: x, clientY: 300 });
    view.root.dispatchEvent(at('pointerdown', 5));
    document.dispatchEvent(at('pointermove', 80));
    document.dispatchEvent(at('pointermove', 200));
    await view.settle();
    document.dispatchEvent(at('pointerup', 200));
    expect(view.state.pages).toEqual(['home']);
    off();
  });
});

describe('createStack active', () => {
  it('switched off, the pages stay but nothing pops: no Escape, no back, no swipe', () => {
    const bound: unknown[] = [];
    const back: NavOptions['back'] = (_el, { onBack }) => {
      bound.push(onBack);
      return () => void bound.splice(bound.indexOf(onBack), 1);
    };
    const { view, stack, page } = open({ defaultPages: ['home', 'detail'], on: false, back });
    expect(page('detail').isConnected).toBe(true);
    expect(escape().defaultPrevented).toBe(false);
    expect(view.state.pages).toEqual(['home', 'detail']);
    expect(bound).toHaveLength(0);
    expect(stack.swipe.onStart()).toBe(false);
    expect(stack.pops()).toBe(false);
  });

  it('switched off, a change of pages moves no focus and plays no exit', async () => {
    const { view, stack, page, button } = open({ defaultPages: ['home', 'detail'], on: false });
    button('home', 'Open').focus();
    animating(page('detail'));
    stack.pop();
    expect(view.state.exiting).toEqual([]);
    stack.push('other');
    await view.settle();
    expect(document.activeElement).toBe(button('home', 'Open'));
    expect(page('other').hasAttribute('data-starting-style')).toBe(false);
    // Not a stack, so nothing is covered.
    expect(page('home').hasAttribute('inert')).toBe(false);
  });

  it('switched on while its pages stay, it pops as a stack (Escape)', async () => {
    const { Root, Page } = createParts(nav, { root: 'div', page: 'section' });
    const onPagesChange = vi.fn();
    const Nav = ({ on }: { on: boolean }) => (
      <Root defaultPages={['home', 'detail']} on={on} onPagesChange={onPagesChange}>
        <Page value="home">Home</Page>
        <Page value="detail">Detail</Page>
      </Root>
    );
    const { rerender } = render(<Nav on={false} />);
    expect(escape().defaultPrevented).toBe(false);
    rerender(<Nav on />);
    await act(async () => {});
    act(() => void escape());
    expect(onPagesChange).toHaveBeenCalledWith(['home'], expect.objectContaining({ reason: 'escape-key' }));
  });
});
