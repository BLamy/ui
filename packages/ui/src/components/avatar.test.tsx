// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Lets UI SDK commit what an event started (popups settle a tick later). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const avatarOf = (container: Element) => container.querySelector<HTMLElement>('[data-slot="avatar"]')!;

describe('Avatar', () => {
  it('shows initials from a name or a contact, on a gradient hashed from it', () => {
    const named = render(<Avatar name="Ada Lovelace" />);
    const root = avatarOf(named.container);
    expect(root.textContent).toBe('AL');
    expect(root.style.getPropertyValue('--avatar-size')).toBe('40px');
    expect(root.style.getPropertyValue('--avatar-bg')).toContain('linear-gradient');
    // Without a label it is decoration beside a name: no role, nothing to announce twice.
    expect(root.hasAttribute('role')).toBe(false);
    named.unmount();
    const contact = render(<Avatar c={{ f: 'Wei', l: 'Chen' }} size={64} shape="square" />);
    expect(avatarOf(contact.container).textContent).toBe('WC');
    expect(avatarOf(contact.container).style.getPropertyValue('--avatar-size')).toBe('64px');
    expect(avatarOf(contact.container).className).toContain('rounded-(--avatar-radius)');
  });

  it('is an image named by aria-label when it stands alone', () => {
    render(<Avatar name="Ada Lovelace" aria-label="Ada Lovelace" initials="A" icon={<svg data-testid="glyph" />} />);
    const root = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(root.getAttribute('data-slot')).toBe('avatar');
    // A glyph replaces the initials.
    expect(screen.getByTestId('glyph')).toBeTruthy();
    expect(root.textContent).toBe('');
  });

  it('keeps the initials until its image loads, and for good if it fails', () => {
    const { container } = render(<Avatar name="Ada Lovelace" src="/ada.png" />);
    const root = avatarOf(container);
    const image = root.querySelector('img')!;
    expect(image.getAttribute('data-slot')).toBe('avatar-image');
    expect(image.getAttribute('alt')).toBe('');
    expect(root.querySelector('[data-slot="avatar-fallback"]')!.textContent).toBe('AL');
    fireEvent.load(image);
    expect(root.getAttribute('data-loading-status')).toBe('loaded');
    expect(root.querySelector('[data-slot="avatar-fallback"]')).toBeNull();
    cleanup();
    const failed = render(<Avatar name="Ada Lovelace" src="/missing.png" />);
    fireEvent.error(avatarOf(failed.container).querySelector('img')!);
    expect(avatarOf(failed.container).getAttribute('data-loading-status')).toBe('error');
    expect(avatarOf(failed.container).querySelector('[data-slot="avatar-fallback"]')!.textContent).toBe('AL');
  });

  it('reports its loading status, and takes an image and fallback of your own', () => {
    const onLoadingStatusChange = vi.fn();
    const { container } = render(
      <Avatar name="Ada" onLoadingStatusChange={onLoadingStatusChange}>
        <AvatarImage src="/ada.png" alt="Ada Lovelace" />
        <AvatarFallback>?</AvatarFallback>
      </Avatar>,
    );
    expect(avatarOf(container).textContent).toBe('?');
    expect(container.querySelector('img')!.getAttribute('alt')).toBe('Ada Lovelace');
    fireEvent.load(container.querySelector('img')!);
    expect(onLoadingStatusChange).toHaveBeenLastCalledWith('loaded', expect.objectContaining({ reason: expect.any(String) }));
  });

  it('adds a presence dot that says the status', () => {
    const { rerender } = render(<Avatar name="Ada" status="idle" />);
    const dot = screen.getByRole('img', { name: 'Idle' });
    expect(dot.getAttribute('data-status')).toBe('idle');
    expect(dot.className).toContain('bg-warning');
    // Its name is words, not the token.
    rerender(<Avatar name="Ada" status="dnd" />);
    expect(screen.getByRole('img', { name: 'Do not disturb' }).getAttribute('data-status')).toBe('dnd');
  });

  it('shows its card while the pointer rests on it, and is itself the card’s trigger', async () => {
    const { container } = render(<Avatar name="Ada Lovelace" card={<p>Wrote the first program.</p>} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    vi.useFakeTimers();
    const root = avatarOf(container);
    // A card's trigger is a button with a name: the person's.
    expect(screen.getByRole('button', { name: 'Ada Lovelace' })).toBe(root);
    expect(root.getAttribute('type')).toBe('button');
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(1);
    expect(screen.queryByText('Wrote the first program.')).toBeNull();
    fireEvent.pointerEnter(root, { pointerType: 'mouse' });
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText('Wrote the first program.')).toBeTruthy();
    expect(root.hasAttribute('data-open')).toBe(true);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByText('Wrote the first program.')).toBeNull();
  });

  it('with a card it is in the Tab order, and keyboard focus opens the card after the delay', async () => {
    render(<><button type="button">Before</button><Avatar name="Ada Lovelace" card={<p>Wrote the first program.</p>} /></>);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    const root = screen.getByRole('button', { name: 'Ada Lovelace' });
    expect(root.tabIndex).toBe(0);
    vi.useFakeTimers();
    act(() => { root.focus(); });
    expect(document.activeElement).toBe(root);
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText('Wrote the first program.')).toBeTruthy();
    // Escape closes it and leaves focus on the avatar.
    fireEvent.keyDown(root, { key: 'Escape' });
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByText('Wrote the first program.')).toBeNull();
    expect(document.activeElement).toBe(root);
  });
});

describe('AvatarGroup', () => {
  const people = (
    [<Avatar key="a" name="Ada Lovelace" />, <Avatar key="g" name="Grace Hopper" />, <Avatar key="l" name="Linus Torvalds" />, <Avatar key="m" c={{ f: 'Margaret', l: 'Hamilton' }} />]
  );

  it('a plain stack is a group named after how many people it holds, unless it has a label', () => {
    render(<AvatarGroup menu={false}>{people}</AvatarGroup>);
    expect(screen.getByRole('group', { name: '4 people' })).toBeTruthy();
  });

  it('folds the avatars past max into a +N bubble', () => {
    render(<AvatarGroup max={2} menu={false} label="Authors">{people}</AvatarGroup>);
    const group = screen.getByRole('group', { name: 'Authors' });
    expect(Array.from(group.children).map((child) => child.textContent)).toEqual(['AL', 'GH', '+2']);
    expect(group.lastElementChild!.hasAttribute('data-overflow')).toBe(true);
    // Avatars take the group's size unless they have one.
    expect((group.firstElementChild as HTMLElement).style.getPropertyValue('--avatar-size')).toBe('32px');
  });

  it('is a button named after how many people it holds, which lists everyone in a menu', async () => {
    const onSelect = vi.fn();
    render(<AvatarGroup max={2} onSelect={onSelect}>{people}</AvatarGroup>);
    const trigger = screen.getByRole('button', { name: '4 people' });
    fireEvent.click(trigger);
    await settle();
    const menu = screen.getByRole('menu', { name: '4 people' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['ALAda Lovelace', 'GHGrace Hopper', 'LTLinus Torvalds', 'MHMargaret Hamilton']);
    fireEvent.click(items[2]);
    await settle();
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('with its menu, card avatars are not buttons inside the trigger; without it, each is its own named button', () => {
    const cards = [
      <Avatar key="a" name="Ada Lovelace" card={<p>Ada</p>} />,
      <Avatar key="m" name="Miles Davis" card={<p>Miles</p>} />,
    ];
    const { container, unmount } = render(<AvatarGroup>{cards}</AvatarGroup>);
    expect(container.querySelector('button button')).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['2 people']);
    unmount();
    render(<AvatarGroup menu={false}>{cards}</AvatarGroup>);
    const group = screen.getByRole('group', { name: '2 people' });
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Ada Lovelace', 'Miles Davis']);
  });
});
