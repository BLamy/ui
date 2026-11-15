// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeEditor } from '@/components/ui/code-editor';
import { actOn, entry, expectNamed, mount, run } from '../../test/agent-harness';

/* CodeEditor's controls primitive (lib/code-editor-primitive) driven only through the agent bridge: an editable editor is
   named by its `aria-label`, `getValue` reads its text, and `setValue` replaces it as one edit that reaches
   `onValueChange` with reason `imperative` and `source: 'agent'`, and that `cancel()` refuses. */

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

// One bridge per file: it has no destroy, and remembers components earlier tests removed as off the page.
const agent = createAgent();

// happy-dom has no layout: give the editor a box to window into.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 400 });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400, toJSON: () => ({}) }) as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

const typed = () => [...document.querySelectorAll('[data-slot="code-editor-text"]')].map((t) => t.textContent ?? '').join('\n');

describe('CodeEditor is agent-ready', () => {
  it('names an editable editor by its label, reads its text and replaces it as the agent', async () => {
    const onValueChange = vi.fn();
    await mount(<CodeEditor defaultValue="let a = 1" aria-label="Script" onValueChange={onValueChange} />);
    expectNamed(agent.snapshot(), ['Script']);
    expect(entry(agent.snapshot(), 'Script')).toMatchObject({ component: 'code-editor', actions: expect.arrayContaining(['getValue', 'setValue']) });
    expect(screen.getByRole('textbox', { name: 'Script' })).toBeTruthy();

    const read = await run(agent, [{ ref: 'Script', action: 'getValue' }]);
    expect(read.steps[0]!.result).toBe('let a = 1');

    // `true` is the bridge's plain success: the step reports no result.
    const wrote = await run(agent, [{ ref: 'Script', action: 'setValue', args: ['let a = 2\nlet b = 3'] }]);
    expect(wrote.steps[0]!.result).toBeUndefined();
    expect(onValueChange).toHaveBeenLastCalledWith('let a = 2\nlet b = 3', expect.objectContaining({ reason: 'imperative', source: 'agent' }));
    expect(typed()).toBe('let a = 2\nlet b = 3');
  });

  it('a setValue the app refuses with details.cancel() changes nothing', async () => {
    await mount(
      <CodeEditor defaultValue="keep" aria-label="Locked" onValueChange={(_text, details) => { if (details.source === 'agent') details.cancel(); }} />,
    );
    const result = await actOn(agent, [{ ref: 'Locked', action: 'setValue', args: ['gone'] }]);
    expect(result.steps[0]!.result).toBe(false);
    expect(typed()).toBe('keep');
  });

  it('a controlled editor takes what the host passes back', async () => {
    function Host() {
      const [value, setValue] = useState('a');
      return <CodeEditor value={value} onValueChange={(next) => setValue(next.toUpperCase())} aria-label="Shout" />;
    }
    await mount(<Host />);
    await run(agent, [{ ref: 'Shout', action: 'setValue', args: ['abc'] }]);
    expect(typed()).toBe('ABC');
  });

  it('a read-only editor offers its text but no edit', async () => {
    await mount(<CodeEditor readOnly variant="plain" lines={['one', 'two']} aria-label="Log" gutters={[{ id: 'bp', width: 16, render: () => null, onClick: () => {}, label: (n) => `bp ${n}` }]} />);
    const log = agent.snapshot().find((e) => !e.offPage && e.component === 'code-editor');
    expect(log).toBeTruthy();
    const read = await run(agent, [{ ref: log!.ref, action: 'getValue' }]);
    expect(read.steps[0]!.result).toBe('one\ntwo');
    const result = await actOn(agent, [{ ref: log!.ref, action: 'setValue', args: ['x'] }]);
    expect(result.steps[0]!.result).toBe(false);
    expect(typed()).toBe('one\ntwo');
  });
});
