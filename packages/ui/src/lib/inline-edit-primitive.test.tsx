// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgent } from '@ui-sdk/react/agent';
import { createParts } from '@ui-sdk/react/primitive';
import { inlineEdit } from '@/lib/inline-edit-primitive';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const Edit = createParts(inlineEdit, { root: 'div', input: 'input' });

describe('inlineEdit', () => {
  it('an agent can neither start nor rename an id the owner marked read-only', async () => {
    const agent = createAgent();
    const onCommit = vi.fn();
    render(
      <Edit.Root aria-label="Rename in Notes" editable={(id) => id !== 'locked'} textOf={(id) => id} onCommit={onCommit}>
        {({ editing }) => (editing ? <Edit.Input aria-label={`Rename ${editing}`} /> : null)}
      </Edit.Root>,
    );
    const locked = await act(() => agent.act({ steps: [
      { ref: 'Rename in Notes', action: 'rename', args: ['locked', 'x'] },
      { ref: 'Rename in Notes', action: 'start', args: ['locked'] },
    ] }));
    expect(locked.steps.map((step) => step.result)).toEqual([false, false]);
    expect(onCommit).not.toHaveBeenCalled();
    const open = await act(() => agent.act({ steps: [{ ref: 'Rename in Notes', action: 'rename', args: ['draft', 'Plan'] }] }));
    expect(open.ok).toBe(true);
    expect(open.steps[0]!.result).not.toBe(false);
    expect(onCommit).toHaveBeenCalledWith('draft', 'Plan', expect.objectContaining({ reason: 'imperative' }));
  });
});
