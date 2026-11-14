// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { createParts } from '@ui-sdk/react/primitive';
import { afterEach, describe, expect, it } from 'vitest';
import { selectionIndicator } from '@/lib/selection-indicator-primitive';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const { Root: Indicator } = createParts(selectionIndicator, { root: 'span' });
const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
// Happy-dom lays nothing out: one selected item writes a 0px box, none or several write nothing.
const width = (el: HTMLElement) => el.style.getPropertyValue('--selection-indicator-width');

function Group({ attribute, on, nested = false }: { attribute?: string; on: { pressed?: string; marked?: string }; nested?: boolean }) {
  return (
    <div role="group">
      <Indicator attribute={attribute} data-testid="indicator" />
      <button type="button" data-slot="toggle" data-pressed={on.pressed === 'a' ? '' : undefined} data-marked={on.marked === 'a' ? '' : undefined}>
        A
        {nested ? <span data-slot="toggle" data-pressed="" /> : null}
      </button>
      <button type="button" data-slot="toggle" data-pressed={on.pressed === 'b' ? '' : undefined} data-marked={on.marked === 'b' ? '' : undefined}>B</button>
    </div>
  );
}

describe('selectionIndicator', () => {
  it('follows the one selected item, and clears while none is', async () => {
    const view = render(<Group on={{ pressed: 'a' }} />);
    const indicator = view.getByTestId('indicator');
    await tick();
    expect(width(indicator)).toBe('0px');
    view.rerender(<Group on={{}} />);
    await tick();
    expect(width(indicator)).toBe('');
  });

  it('counts only the group\'s own items, not a toggle nested inside one', async () => {
    const view = render(<Group on={{ pressed: 'b' }} nested />);
    await tick();
    // Two elements carry data-pressed, but only one is an item of this group.
    expect(width(view.getByTestId('indicator'))).toBe('0px');
  });

  it('follows a new attribute option', async () => {
    const view = render(<Group on={{ pressed: 'a', marked: 'b' }} />);
    const indicator = view.getByTestId('indicator');
    await tick();
    view.rerender(<Group attribute="data-marked" on={{ pressed: 'a', marked: 'b' }} />);
    await tick();
    expect(width(indicator)).toBe('0px');
    // Changes of the new attribute are watched: nothing marked, nothing drawn.
    view.rerender(<Group attribute="data-marked" on={{ pressed: 'a' }} />);
    await tick();
    expect(width(indicator)).toBe('');
  });
});
