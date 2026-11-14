// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MessageScroller, MessageScrollerItem } from '@/components/ui/message-scroller';
import { Conversation, ConversationMessages, Suggestion, UserMessage, WorkLog, ToolCall } from '@/components/ui/conversation';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

// happy-dom lays nothing out: the viewport is 400 px tall and 2000 px inside.
const isViewport = (el: HTMLElement) => el.getAttribute('data-slot') === 'message-scroller-viewport';
const tops = new WeakMap<HTMLElement, number>();
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return isViewport(this) ? 400 : 0; } });
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return isViewport(this) ? 2000 : 0; } });
Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  configurable: true,
  get(this: HTMLElement) { return tops.get(this) ?? 0; },
  set(this: HTMLElement, v: number) { tops.set(this, v); },
});
HTMLElement.prototype.scrollTo = function scrollTo(this: HTMLElement, opts?: ScrollToOptions | number) {
  if (typeof opts === 'object' && opts.top != null) this.scrollTop = opts.top;
} as typeof HTMLElement.prototype.scrollTo;

afterEach(cleanup);

const items = [
  <MessageScrollerItem key="u1" value="u1" anchor><p>Hello</p></MessageScrollerItem>,
  <MessageScrollerItem key="a1" value="a1"><p>Hi there</p></MessageScrollerItem>,
];
const viewport = () => screen.getByRole('region', { name: 'Messages' });
const jump = () => document.querySelector('[data-slot=message-scroller-jump]') as HTMLElement;
const scrollTo = (top: number) => act(() => {
  viewport().scrollTop = top;
  fireEvent.scroll(viewport());
});

describe('MessageScroller', () => {
  it('is a labelled region around a log', () => {
    render(<MessageScroller streaming>{items}</MessageScroller>);
    expect(viewport().getAttribute('tabindex')).toBe('0');
    const log = screen.getByRole('log');
    expect(log.getAttribute('aria-busy')).toBe('true');
    expect(log.querySelectorAll('[data-mid]')).toHaveLength(2);
  });

  it('follows the end, and hides the jump pill while the reader is there', () => {
    render(<MessageScroller>{items}</MessageScroller>);
    expect(viewport().scrollTop).toBe(1600);
    expect(jump().hasAttribute('data-closed')).toBe(true);
    expect(jump().hasAttribute('inert')).toBe(true);
  });

  it('shows the jump pill once the reader scrolls away, and it goes back to the end', () => {
    render(<MessageScroller>{items}</MessageScroller>);
    scrollTo(100);
    expect(jump().hasAttribute('data-open')).toBe(true);
    expect(jump().hasAttribute('inert')).toBe(false);
    act(() => screen.getByRole('button', { name: 'Jump to latest' }).click());
    expect(viewport().scrollTop).toBe(1600);
    fireEvent.scroll(viewport());
    expect(jump().hasAttribute('data-closed')).toBe(true);
  });

  it('lets go on scroll intent, and says a reply is streaming while away from it', () => {
    render(<MessageScroller streaming>{items}</MessageScroller>);
    act(() => { fireEvent.wheel(viewport(), { deltaY: -40 }); });
    // 100 px up: not far enough for the pill on its own, but following stopped while a reply streams.
    scrollTo(1500);
    expect(jump().hasAttribute('data-open')).toBe(true);
    // Its name starts with what it shows ("Streaming"), WCAG 2.5.3.
    expect(screen.getByRole('button', { name: 'Streaming, jump to latest' }).hasAttribute('data-streaming')).toBe(true);
  });
});

describe('MessageScroller naming', () => {
  it('takes its region name and a ref', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<MessageScroller aria-label="Inspector thread" ref={ref}>{items}</MessageScroller>);
    expect(screen.getByRole('region', { name: 'Inspector thread' })).toBeTruthy();
    expect(ref.current?.contains(screen.getByRole('log'))).toBe(true);
  });

  it('anchors items wherever they sit under it', () => {
    render(
      <MessageScroller>
        <div>
          <MessageScrollerItem value="w1" anchor>Wrapped</MessageScrollerItem>
        </div>
      </MessageScroller>,
    );
    expect(document.querySelector('[data-mid=w1]')?.hasAttribute('data-anchor')).toBe(true);
  });
});

describe('Conversation', () => {
  it('WorkLog is a disclosure of its tool calls', () => {
    render(<WorkLog summary="Worked for 4s"><ToolCall title="Read file" /></WorkLog>);
    const trigger = screen.getByRole('button', { name: /Worked for 4s/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Read file')).toBeTruthy();
  });

  it('Suggestion takes onClick', () => {
    const onClick = vi.fn();
    render(<Suggestion onClick={onClick}>Explain this</Suggestion>);
    act(() => screen.getByRole('button', { name: 'Explain this' }).click());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders messages as the scroller’s items, user messages anchoring', () => {
    render(
      <Conversation>
        <ConversationMessages threadKey="t1">
          <UserMessage key="u1" value="u1">Hello</UserMessage>
        </ConversationMessages>
      </Conversation>,
    );
    expect(document.querySelector('[data-mid=u1]')?.hasAttribute('data-anchor')).toBe(true);
  });
});
