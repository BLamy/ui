// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HoverCard, HoverCardTrigger } from '@/components/ui/hover-card';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function two() {
  render(
    <div>
      <HoverCardTrigger><a href="#a">Ada</a><HoverCard>Ada's card</HoverCard></HoverCardTrigger>
      <HoverCardTrigger><a href="#m">Miles</a><HoverCard>Miles's card</HoverCard></HoverCardTrigger>
    </div>,
  );
  const wrapper = (name: string) => screen.getByText(name).closest('[data-slot=hover-card-trigger]') as HTMLElement;
  return { ada: wrapper('Ada'), miles: wrapper('Miles') };
}

const enter = (el: Element) => fireEvent.pointerEnter(el, { pointerType: 'mouse' });
const leave = (el: Element) => fireEvent.pointerLeave(el, { pointerType: 'mouse' });

describe('HoverCard', () => {
  it('opens after the delay, and not from touch', () => {
    vi.useFakeTimers();
    const { ada } = two();
    fireEvent.pointerEnter(ada, { pointerType: 'touch' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText("Ada's card")).toBeNull();
    enter(ada);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText("Ada's card")).toBeNull();
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByText("Ada's card")).toBeTruthy();
  });

  it('stays open while the pointer is in the card, and closes after it leaves', () => {
    vi.useFakeTimers();
    const { ada } = two();
    enter(ada);
    act(() => { vi.advanceTimersByTime(700); });
    leave(ada);
    const card = screen.getByText("Ada's card");
    enter(card);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("Ada's card")).toBeTruthy();
    leave(card);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText("Ada's card")).toBeNull();
  });

  it('keeps one open at a time and opens the next at once while warm', () => {
    vi.useFakeTimers();
    const { ada, miles } = two();
    enter(ada);
    act(() => { vi.advanceTimersByTime(700); });
    leave(ada);
    act(() => { vi.advanceTimersByTime(300); });
    enter(miles);
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText("Miles's card")).toBeTruthy();
    expect(screen.queryByText("Ada's card")).toBeNull();
  });

  it('closes on Escape', () => {
    vi.useFakeTimers();
    const { ada } = two();
    enter(ada);
    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.queryByText("Ada's card")).toBeNull();
  });
});
