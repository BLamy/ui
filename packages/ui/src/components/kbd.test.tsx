// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { setPlatform } from '@ui-sdk/core/testing';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

// UI SDK wraps a shortcut in a left-to-right isolate, so a right-to-left page never reorders it.
const plain = (text: string | null) => (text ?? '').replace(/[⁦⁩]/g, '');

describe('Kbd', () => {
  it('is a keycap around the key you spell out', () => {
    render(<KbdGroup data-testid="group"><Kbd>Esc</Kbd><Kbd className="px-2">Tab</Kbd></KbdGroup>);
    const esc = screen.getByText('Esc');
    expect(esc.tagName).toBe('KBD');
    expect(esc.getAttribute('data-slot')).toBe('kbd');
    expect(screen.getByText('Tab').className).toContain('px-2');
    expect(screen.getByTestId('group').children).toHaveLength(2);
  });

  it('shows a shortcut for the reader’s platform', () => {
    setPlatform('apple');
    const apple = render(<Kbd keys="mod+k" data-testid="keys" />);
    expect(plain(screen.getByTestId('keys').textContent)).toBe('⌘K');
    apple.unmount();
    setPlatform('other');
    render(<Kbd keys="mod+shift+p" data-testid="keys">ignored</Kbd>);
    expect(plain(screen.getByTestId('keys').textContent)).toBe('Ctrl+Shift+P');
  });
});
