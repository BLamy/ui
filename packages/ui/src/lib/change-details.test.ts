// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { sourceOf } from '@ui-sdk/core';
import { changeDetails } from '@/lib/change-details';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

describe('changeDetails', () => {
  it('a change from code, with no event, is programmatic', () => {
    expect(changeDetails({ reason: 'imperative' }).source).toBe('programmatic');
  });

  it("reads the source from the event exactly as UI SDK's sourceOf does", () => {
    const events = [
      new KeyboardEvent('keydown', { key: 'Enter' }),
      new PointerEvent('pointerdown', { pointerType: 'touch' }),
      new MouseEvent('click', { detail: 0 }),
      new MouseEvent('click', { detail: 1 }),
    ];
    for (const event of events) expect(changeDetails({ reason: 'item-press', event }).source).toBe(sourceOf(event));
  });

  it('keeps a source a UI SDK part already knew, and passes the event and reason through', () => {
    const event = new MouseEvent('click', { detail: 1 });
    const details = changeDetails({ reason: 'item-press', event, source: 'keyboard' });
    expect(details).toMatchObject({ reason: 'item-press', event, source: 'keyboard', canceled: false });
  });

  it('can be canceled, and says so', () => {
    const details = changeDetails({ reason: 'imperative' });
    details.cancel();
    expect(details.canceled).toBe(true);
  });
});
