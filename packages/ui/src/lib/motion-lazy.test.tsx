// @vitest-environment happy-dom
import { StrictMode, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { TextMorph } from '@/components/ui/text-morph';
import { Chevron, type ChevronDirection } from '@/lib/icon';
import { flipPlay, flipSnapshot, preloadMotion } from '@/lib/motion';
import { motionEngine, useMotionRequest } from '@/lib/motion-lazy';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* The engine arrives once for the page, so this file is one story told in order: what the parts do before it has
   loaded, then what they do after. (Each test file starts with no engine: Vitest gives it its own modules.)
   The chunk is on a slow network here: its import does not resolve until the test lets it through, so "before" stays
   before however long those tests take. */
const network = vi.hoisted(() => {
  let deliver!: () => void;
  const arrived = new Promise<void>((resolve) => { deliver = resolve; });
  return { arrived, deliver };
});
vi.mock('@/lib/motion-engine', async (importOriginal) => {
  await network.arrived;
  return importOriginal<typeof import('@/lib/motion-engine')>();
});

/* Idle time is the test's to give: the callbacks the kit schedules, run by hand. */
const idle = new Map<number, () => void>();
let idleId = 0;
vi.stubGlobal('requestIdleCallback', (run: () => void) => {
  idle.set(++idleId, run);
  return idleId;
});
vi.stubGlobal('cancelIdleCallback', (id: number) => void idle.delete(id));

/* happy-dom has no layout. Give it a small one: a letter is 10px wide, the rows of a list are 40px tall and stacked in
   document order, and an AnimatedHeight's content is as tall as `contentHeight`. */
const CH = 10;
let contentHeight = 100;
const resizes = new Set<() => void>();
const resize = () => act(() => resizes.forEach((notify) => notify()));
const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
const rowIndex = (el: Element) => {
  const item = el.closest('[data-slot=list-section-item]');
  return item?.parentElement ? [...item.parentElement.children].indexOf(item) : -1;
};
const saved: Array<[object, string, PropertyDescriptor | undefined]> = [];
const define = (target: object, name: string, descriptor: PropertyDescriptor) => {
  saved.push([target, name, Object.getOwnPropertyDescriptor(target, name)]);
  Object.defineProperty(target, name, { configurable: true, ...descriptor });
};
beforeAll(() => {
  // happy-dom's Web Animations reject `finished` on cancel; framer-motion falls back to its JS driver without them.
  saved.push([Element.prototype, 'animate', Object.getOwnPropertyDescriptor(Element.prototype, 'animate')]);
  delete (Element.prototype as unknown as Record<string, unknown>).animate;
  define(HTMLElement.prototype, 'offsetWidth', {
    get(this: HTMLElement) {
      if (this.dataset.slot !== 'text-morph') return 0;
      const pinned = /^([\d.]+)px$/.exec(this.style.width);
      return pinned ? Number(pinned[1]) : (this.firstElementChild?.textContent ?? '').length * CH;
    },
  });
  define(HTMLElement.prototype, 'offsetHeight', {
    get(this: HTMLElement) { return this.classList.contains('flow-root') ? contentHeight : 0; },
  });
  define(Element.prototype, 'getBoundingClientRect', {
    value(this: HTMLElement) {
      const row = rowIndex(this);
      return row < 0 ? rect(0, 0, this.offsetWidth ?? 0, 20) : rect(0, row * 40, 300, 40);
    },
  });
  define(Range.prototype, 'getBoundingClientRect', {
    value(this: Range) { return rect(this.startOffset * CH, 0, (this.endOffset - this.startOffset) * CH, 20); },
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(private notify: () => void) {}
    observe() { resizes.add(this.notify); }
    unobserve() { resizes.delete(this.notify); }
    disconnect() { resizes.delete(this.notify); }
  });
});
afterAll(() => {
  for (const [target, name, descriptor] of saved.reverse()) {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete (target as Record<string, unknown>)[name];
  }
  vi.unstubAllGlobals();
});
afterEach(cleanup);

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
/** What a query found, or a failed test. */
function found<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('not in the document');
  return value;
}
const morph = (c: HTMLElement) => found(c.querySelector<HTMLElement>('[data-slot=text-morph]'));
const chevron = (c: HTMLElement) => found(c.querySelector<HTMLElement>('[data-slot=chevron]'));
const box = (c: HTMLElement) => found(c.querySelector<HTMLElement>('[data-slot=animated-height]'));
const rowTitles = (c: HTMLElement) => [...c.querySelectorAll('[data-slot=list-section-item]')].map((li) => li.textContent?.replace(/Drag.*$/, ''));
/** The element of each row that slides. */
const sliders = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-slot=list-section-item] > div')];

function Rows({ onOrder }: { onOrder?: (order: string[]) => void }) {
  const [rows, setRows] = useState(['Alpha', 'Bravo', 'Charlie']);
  return (
    <List>
      <ListSection title="Order" onOrderChange={(order) => { onOrder?.(order); setRows(order); }}>
        {rows.map((r) => <ListRow key={r} title={r} />)}
      </ListSection>
    </List>
  );
}
/** Moves the first row down one place with its grip, from the keyboard. */
function moveFirstRowDown(c: HTMLElement) {
  const grip = found(c.querySelector<HTMLElement>('[data-slot=list-section-handle]'));
  act(() => grip.focus());
  fireEvent.keyDown(grip, { key: ' ' });
  fireEvent.keyDown(grip, { key: 'ArrowDown' });
  fireEvent.keyDown(grip, { key: ' ' });
}

/** Renders on the server, then hydrates in the page, and reports anything React had to say about it. */
async function hydrate(ui: React.ReactNode) {
  const html = renderToString(ui);
  const container = document.body.appendChild(document.createElement('div'));
  container.innerHTML = html;
  const served = container.innerHTML;
  const first = container.firstElementChild;
  const recovered: unknown[] = [];
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let root!: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, ui, { onRecoverableError: (error) => recovered.push(error) });
  });
  const complaints = errors.mock.calls.length;
  errors.mockRestore();
  return { container, served, first, recovered, complaints, unmount: () => act(() => { root.unmount(); container.remove(); }) };
}

describe('before the engine has loaded', () => {
  it('loads nothing when the modules are imported', () => {
    expect(motionEngine()).toBeNull();
    expect(idle.size).toBe(0);
  });

  it('asks once, at idle, from an effect, and not at all when everything that asked has unmounted (Strict Mode too)', () => {
    const { unmount } = render(
      <StrictMode>
        <Button>Save</Button>
        <Button>Cancel</Button>
        <Chevron />
        <AnimatedHeight>Body</AnimatedHeight>
        <Rows />
      </StrictMode>,
    );
    // One callback for the page, however many parts are waiting, and nothing fetched until it runs.
    expect(idle.size).toBe(1);
    expect(motionEngine()).toBeNull();
    unmount();
    expect(idle.size).toBe(0);
  });

  it('asks for nothing from a part that cannot animate as it is', () => {
    function Part({ wanted }: { wanted: boolean }) {
      useMotionRequest(wanted);
      return null;
    }
    const { rerender } = render(<Part wanted={false} />);
    render(<List><ListSection title="Plain"><ListRow key="a" title="A" /></ListSection></List>);
    render(<Button size="icon" aria-label="Add"><svg /></Button>);
    expect(idle.size).toBe(0);
    rerender(<Part wanted />);
    expect(idle.size).toBe(1);
  });

  it('fetches it when the idle callback runs: one request for the page, and no more callbacks after', async () => {
    render(<Button>Save</Button>);
    expect(idle.size).toBe(1);
    act(() => idle.forEach((run) => run()));
    idle.clear();
    render(<StrictMode><Button>Cancel</Button><Chevron /></StrictMode>);
    expect(idle.size).toBe(0);
    // On its way, and not here.
    await wait(20);
    expect(motionEngine()).toBeNull();
  });

  it('hydrates a server-rendered Button without a mismatch, and keeps its element', async () => {
    const page = await hydrate(<Button>Save changes</Button>);
    expect(page.served).toContain('<span data-slot="text-morph" class="inline-block"><span>Save changes</span></span>');
    expect(page.recovered).toEqual([]);
    expect(page.complaints).toBe(0);
    expect(page.container.innerHTML).toBe(page.served);
    expect(page.container.firstElementChild).toBe(page.first);
    await page.unmount();
  });

  it('a label that changes simply shows: no morph, no pinned width, the same element, nothing thrown', () => {
    const { container, rerender } = render(<Button>Continue</Button>);
    const button = found(container.querySelector('button'));
    const label = morph(container);
    act(() => button.focus());
    rerender(<Button>Confirm</Button>);
    expect(button.textContent).toBe('Confirm');
    expect(label.hasAttribute('data-morphing')).toBe(false);
    expect(label.style.width).toBe('');
    expect(label.children).toHaveLength(1);
    expect(morph(container)).toBe(label);
    expect(document.activeElement).toBe(button);
  });

  it('a chevron turns at once', () => {
    const { container, rerender } = render(<Chevron />);
    const span = chevron(container);
    expect(span.style.transform).toBe('none');
    rerender(<Chevron direction="down" />);
    expect(span.style.transform).toBe('rotate(90deg)');
    rerender(<Chevron direction="right" />);
    expect(span.style.transform).toBe('none');
    // The short way round, and it keeps count: right → up is a quarter turn back, up → right a quarter turn on.
    rerender(<Chevron direction="up" />);
    expect(span.style.transform).toBe('rotate(-90deg)');
    rerender(<Chevron direction="left" />);
    expect(span.style.transform).toBe('rotate(-180deg)');
    expect(chevron(container)).toBe(span);
  });

  it('an AnimatedHeight holds its content’s height and takes a new one at once, without remounting what it holds', async () => {
    contentHeight = 100;
    const { container, getByRole } = render(<AnimatedHeight><input aria-label="Name" /></AnimatedHeight>);
    const input = getByRole('textbox');
    act(() => input.focus());
    expect(box(container).style.height).toBe('100px');
    contentHeight = 160;
    await resize();
    expect(box(container).style.height).toBe('160px');
    expect(getByRole('textbox')).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it('a reordered row moves at once, on plain elements', async () => {
    const onOrder = vi.fn();
    const { container } = render(<Rows onOrder={onOrder} />);
    const before = sliders(container);
    moveFirstRowDown(container);
    await wait(0);
    expect(onOrder).toHaveBeenCalledWith(['Bravo', 'Alpha', 'Charlie']);
    expect(rowTitles(container)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(sliders(container).every((el) => !el.style.transform)).toBe(true);
    // The same elements, in their new order.
    expect(new Set(sliders(container))).toEqual(new Set(before));
  });

  it('a FLIP leaves the elements where they are', () => {
    const { container } = render(<div><span>a</span></div>);
    const el = found(container.querySelector('span'));
    expect(() => flipPlay(flipSnapshot([el]), { lift: true })).not.toThrow();
    expect(el.style.transform).toBe('');
    expect(el.style.zIndex).toBe('');
  });

  it('is still not here, though every one of those changes asked for it', async () => {
    await wait(20);
    expect(motionEngine()).toBeNull();
  });
});

describe('once the engine has loaded', () => {
  it('arrives without anything rendering again or being replaced', async () => {
    let renders = 0;
    function Counted() {
      renders++;
      return <Button>Save</Button>;
    }
    const { container } = render(<><Counted /><Chevron direction="down" /><AnimatedHeight>Body</AnimatedHeight><Rows /></>);
    const html = container.innerHTML;
    const elements = [...container.querySelectorAll('*')];
    network.deliver();
    await act(() => preloadMotion());
    expect(motionEngine()).not.toBeNull();
    expect(renders).toBe(1);
    expect(container.innerHTML).toBe(html);
    expect([...container.querySelectorAll('*')]).toEqual(elements);
  });

  it('is one engine for every caller, and there is nothing left to ask for', async () => {
    const engine = motionEngine();
    expect(engine).not.toBeNull();
    await preloadMotion();
    expect(motionEngine()).toBe(engine);
    render(<Button>Save</Button>);
    expect(idle.size).toBe(0);
  });

  it('a label morphs: the letters fly on a layer of their own while the width springs, then it is plain text again', async () => {
    const { container, rerender } = render(<Button>Continue</Button>);
    const button = found(container.querySelector('button'));
    const label = morph(container);
    act(() => button.focus());
    rerender(<Button>Confirm</Button>);
    expect(label.hasAttribute('data-morphing')).toBe(true);
    expect(label.style.width).toBe(`${8 * CH}px`);
    const layer = found(label.querySelector('[aria-hidden=true]'));
    // "Confirm" arriving, and the letters of "Continue" it does not share ("t", "u", "e", the second "n") leaving.
    expect([...layer.children].map((el) => el.textContent).join('')).toBe('Confirmtnue');
    expect(found(label.firstElementChild).textContent).toBe('Confirm');
    expect(document.activeElement).toBe(button);
    await wait(1000);
    expect(label.hasAttribute('data-morphing')).toBe(false);
    expect(label.style.width).toBe('');
    expect(label.children).toHaveLength(1);
    expect(button.textContent).toBe('Confirm');
    expect(morph(container)).toBe(label);
  });

  it('a label does not morph under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: /reduce/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    try {
      const { container, rerender } = render(<TextMorph>Continue</TextMorph>);
      rerender(<TextMorph>Confirm</TextMorph>);
      expect(morph(container).hasAttribute('data-morphing')).toBe(false);
      expect(morph(container).style.width).toBe('');
      expect(morph(container).textContent).toBe('Confirm');
    } finally {
      vi.stubGlobal('matchMedia', undefined);
    }
  });

  it('a chevron turns on the spring, from where it is, and ends on its angle', async () => {
    const turn = (direction: ChevronDirection) => <Chevron direction={direction} />;
    const { container, rerender } = render(turn('right'));
    const span = chevron(container);
    rerender(turn('down'));
    // Under way, not there yet.
    expect(span.style.transform).not.toBe('rotate(90deg)');
    await wait(900);
    expect(span.style.transform).toBe('rotate(90deg)');
    // A second turn carries on from the first (the engine holds the angle now): left is 180°, not −180°.
    rerender(turn('left'));
    await wait(900);
    expect(span.style.transform).toBe('rotate(180deg)');
    expect(chevron(container)).toBe(span);
  });

  it('an AnimatedHeight springs to a new height, and what it holds stays mounted and focused', async () => {
    contentHeight = 100;
    const { container, getByRole } = render(<AnimatedHeight><input aria-label="Name" /></AnimatedHeight>);
    const input = getByRole('textbox');
    act(() => input.focus());
    // Its first measurement is where it starts, not a change.
    expect(box(container).style.height).toBe('100px');
    contentHeight = 220;
    await resize();
    expect(box(container).style.height).not.toBe('220px');
    await wait(1200);
    expect(box(container).style.height).toBe('220px');
    expect(getByRole('textbox')).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it('a reordered row’s neighbour slides to its place on the same element; the row that is held does not', async () => {
    const { container } = render(<Rows />);
    const before = sliders(container);
    const [alpha, bravo, charlie] = before;
    moveFirstRowDown(container);
    await wait(50);
    expect(rowTitles(container)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(sliders(container)).toEqual([bravo, alpha, charlie]);
    // Bravo moved up a place (40px): it is drawn on its way from where it was. Alpha was held, Charlie did not move.
    expect(bravo.style.transform).toMatch(/translateY\((?!0px)[\d.]+px\)/);
    expect(alpha.style.transform).toBe('');
    expect(charlie.style.transform).toBe('');
    await wait(1200);
    expect(bravo.style.transform).toBe('none');
  });

  it('a row does not slide under reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: /reduce/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    try {
      const { container } = render(<Rows />);
      moveFirstRowDown(container);
      await wait(50);
      expect(rowTitles(container)).toEqual(['Bravo', 'Alpha', 'Charlie']);
      expect(sliders(container).every((el) => !el.style.transform)).toBe(true);
    } finally {
      vi.stubGlobal('matchMedia', undefined);
    }
  });

  it('hydrates server markup without a mismatch though the engine is already here', async () => {
    const ui = (
      <>
        <Button>Save changes</Button>
        <Chevron direction="down" />
        <AnimatedHeight>Body</AnimatedHeight>
        <Rows />
      </>
    );
    const page = await hydrate(ui);
    expect(page.recovered).toEqual([]);
    expect(page.complaints).toBe(0);
    expect(page.container.firstElementChild).toBe(page.first);
    expect(found(page.container.querySelector('[data-slot=text-morph]')).outerHTML).toBe('<span data-slot="text-morph" class="inline-block"><span>Save changes</span></span>');
    expect(chevron(page.container).style.transform).toBe('rotate(90deg)');
    await page.unmount();
  });
});
