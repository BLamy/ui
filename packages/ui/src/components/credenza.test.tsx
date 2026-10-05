// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Credenza } from '@/components/ui/credenza';

afterEach(cleanup);

/** An open Credenza in its host, and a key listener standing in for a NavigationStack behind it. */
function open(props: { isDismissable?: boolean; compact?: boolean } = {}) {
  const onClose = vi.fn();
  const behind = vi.fn();
  window.addEventListener('keydown', behind);
  const { container } = render(
    <div>
      <Credenza open onClose={onClose} title="Sign in" {...props}>
        <button type="button">Continue</button>
      </Credenza>
    </div>,
  );
  const sheet = screen.getByRole('dialog');
  const scrim = container.querySelector('.bg-overlay') as HTMLElement;
  const done = () => window.removeEventListener('keydown', behind);
  return { onClose, behind, sheet, scrim, done };
}

describe('Credenza dismissal', () => {
  it('closes on Escape, a press on the scrim and the close button', () => {
    const { onClose, behind, sheet, scrim, done } = open();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Continue' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(behind).not.toHaveBeenCalled();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    done();
  });

  it('with isDismissable={false} has no close button, and Escape and the scrim leave it open', () => {
    const { onClose, behind, scrim, done } = open({ isDismissable: false });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Continue' }), { key: 'Escape' });
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
    // Escape is still the Credenza's: it doesn't reach the views behind.
    expect(behind).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    done();
  });

  it('drops the grabber from a tray that can’t be dismissed', () => {
    const grabber = (sheet: HTMLElement) => sheet.firstElementChild?.getAttribute('aria-hidden') === 'true';
    const tray = open({ compact: true });
    expect(grabber(tray.sheet)).toBe(true);
    tray.done();
    cleanup();
    const gate = open({ compact: true, isDismissable: false });
    expect(grabber(gate.sheet)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    gate.done();
  });
});

describe('Credenza focus', () => {
  it('hands focus to the next view in one mounted open, once focus is inside it', async () => {
    function Flow() {
      const [view, setView] = useState('card');
      return (
        <div>
          <Credenza open isDismissable={false} view={view} title={view === 'card' ? 'Payment' : 'Verify'}>
            {view === 'card'
              ? <button type="button" onClick={() => setView('code')}>Pay</button>
              : <input aria-label="Code" data-autofocus />}
          </Credenza>
        </div>
      );
    }
    render(<Flow />);
    const pay = screen.getByRole('button', { name: 'Pay' });
    pay.focus();
    fireEvent.click(pay);
    // The old view slides out first; when it goes, focus lands on the new view's field rather than <body>.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Code' })), { timeout: 3000 });
  });
});
