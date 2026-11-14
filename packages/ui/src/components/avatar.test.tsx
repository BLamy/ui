// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarGroup } from '@/components/ui/avatar-group';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Lets UI SDK commit what an event started (popups settle a tick later). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const avatarOf = (container: Element) => container.querySelector<HTMLElement>('[data-slot="avatar"]')!;

describe('Avatar', () => {
  it('shows initials from a name, on a gradient hashed from it, and is an image named after them', () => {
    const named = render(<Avatar name="Ada Lovelace" />);
    const root = avatarOf(named.container);
    expect(root.textContent).toBe('AL');
    expect(root.style.getPropertyValue('--avatar-size')).toBe('40px');
    expect(root.style.getPropertyValue('--avatar-bg')).toContain('linear-gradient');
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBe(root);
    // The initials are the picture, not words to read out.
    expect(root.querySelector('[data-slot="avatar-fallback"]')!.getAttribute('aria-hidden')).toBe('true');
    named.unmount();
    // Beside the name in a row, the caller hides it so the name is read once.
    const hidden = render(<Avatar name="Ada Lovelace" aria-hidden />);
    expect(screen.queryByRole('img')).toBeNull();
    hidden.unmount();
    // With no name there is nothing to call it.
    const anonymous = render(<Avatar initials="?" />);
    expect(avatarOf(anonymous.container).hasAttribute('role')).toBe(false);
    anonymous.unmount();
    const contact = render(<Avatar name="Wei Chen" size={64} shape="square" />);
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

  it('adds a presence dot, and says the status as part of the person', () => {
    const { container, rerender } = render(<Avatar name="Ada" status="idle" />);
    const dot = container.querySelector<HTMLElement>('[data-slot="avatar-status"]')!;
    expect(dot.getAttribute('data-status')).toBe('idle');
    expect(dot.className).toContain('bg-warning');
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('img', { name: 'Ada, Idle' })).toBe(avatarOf(container));
    // Its name is words, not the token.
    rerender(<Avatar name="Ada" status="dnd" />);
    expect(screen.getByRole('img', { name: 'Ada, Do not disturb' })).toBeTruthy();
    // With no name, the dot carries the status by itself.
    rerender(<Avatar initials="?" status="online" />);
    expect(screen.getByRole('img', { name: 'Online' }).getAttribute('data-status')).toBe('online');
  });

  it('keeps white initials legible whatever the name (3.5:1 at the top stop, 4.5:1 in the middle)', () => {
    // OKLCH → linear sRGB (clipped to the gamut, as a browser paints it) → WCAG contrast with white.
    const luminance = (L: number, C: number, h: number) => {
      const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
      const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
      const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
      const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
      const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
        .map((v) => Math.min(1, Math.max(0, v)));
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const contrast = (y: number) => 1.05 / (y + 0.05);
    // Enough names to land on every hue the hash can produce.
    const { container } = render(<>{Array.from({ length: 1500 }, (_, i) => <Avatar key={i} name={`Person ${i}`} />)}</>);
    const hues = new Set<number>();
    for (const el of container.querySelectorAll<HTMLElement>('[data-slot="avatar"]')) {
      const stops = [...el.style.getPropertyValue('--avatar-bg').matchAll(/oklch\(([\d.]+) ([\d.]+) (\d+)\)/g)].map(([, L, C, h]) => [Number(L), Number(C), Number(h)] as const);
      expect(stops).toHaveLength(2);
      const [[L1, C1, h], [L2, C2]] = stops;
      hues.add(h);
      expect(contrast(luminance(L1, C1, h))).toBeGreaterThanOrEqual(3.5);
      expect(contrast(luminance((L1 + L2) / 2, (C1 + C2) / 2, h))).toBeGreaterThanOrEqual(4.5);
    }
    expect(hues.size).toBeGreaterThan(250);
  });

  it('colours the same person the same way, whatever the spacing of their name', () => {
    const a = render(<Avatar name="Wei Chen" />);
    const bg = avatarOf(a.container).style.getPropertyValue('--avatar-bg');
    a.unmount();
    const b = render(<Avatar name=" Wei  Chen" />);
    expect(avatarOf(b.container).style.getPropertyValue('--avatar-bg')).toBe(bg);
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
    [<Avatar key="a" name="Ada Lovelace" />, <Avatar key="g" name="Grace Hopper" />, <Avatar key="l" name="Linus Torvalds" />, <Avatar key="m" name="Margaret Hamilton" />]
  );

  it('a plain stack is a group named after how many people it holds, unless it has a label', () => {
    render(<AvatarGroup>{people}</AvatarGroup>);
    expect(screen.getByRole('group', { name: '4 people' })).toBeTruthy();
  });

  it('folds the avatars past max into a +N bubble', () => {
    render(<AvatarGroup max={2} label="Authors">{people}</AvatarGroup>);
    const group = screen.getByRole('group', { name: 'Authors' });
    expect(Array.from(group.children).map((child) => child.textContent)).toEqual(['AL', 'GH', '+2']);
    expect(group.lastElementChild!.hasAttribute('data-overflow')).toBe(true);
    // Avatars take the group's size unless they have one.
    expect((group.firstElementChild as HTMLElement).style.getPropertyValue('--avatar-size')).toBe('32px');
  });

  it('passes DOM props to its root', () => {
    render(<AvatarGroup id="team" data-testid="stack" className="mt-2">{people}</AvatarGroup>);
    const group = screen.getByTestId('stack');
    expect(group.id).toBe('team');
    expect(group.getAttribute('data-slot')).toBe('avatar-group');
    expect(group.className).toContain('mt-2');
  });

  it('with menu, is a button named after how many people it holds, which lists everyone in a menu', async () => {
    const onAction = vi.fn();
    render(<AvatarGroup menu max={2} onAction={onAction}>{people}</AvatarGroup>);
    const trigger = screen.getByRole('button', { name: '4 people' });
    fireEvent.click(trigger);
    await settle();
    const menu = screen.getByRole('menu', { name: '4 people' });
    const items = within(menu).getAllByRole('menuitem');
    // Each item is named once, by the person's name: the avatar inside it is hidden.
    expect(items).toHaveLength(4);
    for (const [i, name] of ['Ada Lovelace', 'Grace Hopper', 'Linus Torvalds', 'Margaret Hamilton'].entries()) {
      expect(within(menu).getByRole('menuitem', { name })).toBe(items[i]);
    }
    expect(items.every((item) => item.querySelector('[data-slot="avatar"]')!.getAttribute('aria-hidden') === 'true')).toBe(true);
    fireEvent.click(items[2]);
    await settle();
    // The value is the avatar's key.
    expect(onAction).toHaveBeenCalledWith('l', expect.anything());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('with its menu, card avatars are not buttons inside the trigger; without it, each is its own named button', () => {
    const cards = [
      <Avatar key="a" name="Ada Lovelace" card={<p>Ada</p>} />,
      <Avatar key="m" name="Miles Davis" card={<p>Miles</p>} />,
    ];
    const { container, unmount } = render(<AvatarGroup menu>{cards}</AvatarGroup>);
    expect(container.querySelector('button button')).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['2 people']);
    unmount();
    render(<AvatarGroup>{cards}</AvatarGroup>);
    const group = screen.getByRole('group', { name: '2 people' });
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Ada Lovelace', 'Miles Davis']);
  });
});
