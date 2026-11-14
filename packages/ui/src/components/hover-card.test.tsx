// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  HoverCard, HoverCardContent, HoverCardHeader, HoverCardTrigger, createHoverCardController,
} from '@/components/ui/hover-card';
import { BLProvider } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); vi.useRealTimers(); });

const enter = (el: Element, pointerType = 'mouse') => fireEvent.pointerEnter(el, { pointerType });
const leave = (el: Element) => fireEvent.pointerLeave(el, { pointerType: 'mouse' });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const card = () => document.querySelector<HTMLElement>('[data-slot=hover-card-content]');

/* The parts settle on real timers, then the test takes over the clock. */
async function mount(ui: Parameters<typeof render>[0]) {
  render(ui);
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  vi.useFakeTimers();
}

function Profile(props: Parameters<typeof HoverCard>[0] & { onRowClick?: () => void }) {
  const { onRowClick, ...root } = props;
  return (
    <div onClick={onRowClick}>
      <HoverCard {...root}>
        <HoverCardTrigger href="#ada">@ada</HoverCardTrigger>
        <HoverCardContent arrow>
          <HoverCardHeader title="Ada Lovelace" subtitle="@ada" action={<button type="button">Follow</button>} />
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

describe('HoverCard', () => {
  it('keeps its trigger a link, and opens after the delay but never from touch', async () => {
    const onOpenChange = vi.fn();
    await mount(<Profile onOpenChange={onOpenChange} />);
    const link = screen.getByRole('link', { name: '@ada' });
    expect(link.getAttribute('href')).toBe('#ada');

    enter(link, 'touch');
    wait(1000);
    expect(card()).toBeNull();

    enter(link);
    wait(300);
    expect(card()).toBeNull();
    wait(400);
    expect(card()!.textContent).toContain('Ada Lovelace');
    expect(card()!.getAttribute('data-side')).toBe('bottom');
    expect(card()!.querySelector('[data-slot=hover-card-arrow]')).not.toBeNull();
    expect(link.hasAttribute('data-open')).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-hover' }));
  });

  it('stays open while the pointer is in the card, and closes on Escape', async () => {
    const onOpenChange = vi.fn();
    await mount(<Profile onOpenChange={onOpenChange} />);
    const link = screen.getByRole('link', { name: '@ada' });
    enter(link);
    wait(700);
    leave(link);
    enter(card()!);
    wait(1000);
    expect(card()).not.toBeNull();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    wait(50);
    expect(card()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('does not press what is around its trigger when something in the card is pressed', async () => {
    const onRowClick = vi.fn();
    await mount(<Profile defaultOpen onRowClick={onRowClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('link', { name: '@ada' }));
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('opens when keyboard focus stays on its trigger, and Escape closes it with focus left on the link', async () => {
    const onOpenChange = vi.fn();
    await mount(<Profile onOpenChange={onOpenChange} />);
    const link = screen.getByRole('link', { name: '@ada' });
    act(() => { link.focus(); });
    wait(300);
    expect(card()).toBeNull();
    wait(400);
    expect(card()!.textContent).toContain('Ada Lovelace');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-focus' }));
    fireEvent.keyDown(link, { key: 'Escape' });
    wait(50);
    expect(card()).toBeNull();
    expect(document.activeElement).toBe(link);
  });

  it('is as wide as the room UI SDK measured beside its trigger, not the window', async () => {
    await mount(<Profile defaultOpen />);
    expect(card()!.className).toContain('max-w-(--available-width)');
    expect(card()!.className).not.toMatch(/vw|vh/);
  });

  it('never opens while disabled', async () => {
    await mount(<Profile disabled />);
    enter(screen.getByRole('link', { name: '@ada' }));
    wait(1000);
    expect(card()).toBeNull();
  });

  it('shares one card between many triggers: the next takes it over at once, with its payload', async () => {
    const people = createHoverCardController<string>();
    await mount(
      <BLProvider>
        <HoverCardTrigger controller={people} payload="Ada" href="#ada">@ada</HoverCardTrigger>
        <HoverCardTrigger controller={people} payload="Miles" render={<button type="button" />}>@miles</HoverCardTrigger>
        <HoverCard controller={people}>
          <HoverCardContent<string> side="right" align="start">{(state) => `${state.payload}'s card`}</HoverCardContent>
        </HoverCard>
      </BLProvider>,
    );
    const ada = screen.getByRole('link', { name: '@ada' });
    const miles = screen.getByRole('button', { name: '@miles' });
    enter(ada);
    wait(700);
    expect(card()!.textContent).toBe("Ada's card");
    expect(card()!.parentElement).toBe(document.querySelector('[data-slot=bl-provider]'));

    leave(ada);
    enter(miles);
    wait(10);
    expect(card()!.textContent).toBe("Miles's card");
    expect(miles.hasAttribute('data-open')).toBe(true);
    expect(ada.hasAttribute('data-open')).toBe(false);

    act(() => { people.close(); });
    wait(50);
    expect(card()).toBeNull();
    act(() => { void people.open({ payload: 'A pin', anchor: { x: 40, y: 40 } }); });
    wait(10);
    expect(card()!.textContent).toBe("A pin's card");
  });
});
