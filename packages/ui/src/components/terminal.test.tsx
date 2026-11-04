// @vitest-environment happy-dom
import { act, createRef, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TerminalHandle } from '@/components/ui/terminal';
import { createTerminalShell } from '@/lib/terminal-line';

/* wterm needs a real layout and WebAssembly, so the real thing is tested in Chromium (see the docs page). This is what
   Terminal adds around it. */
const instances: Array<{ props: Record<string, unknown>; instance: FakeInstance }> = [];

class FakeInstance {
  cols = 80;
  rows = 24;
  bridge = {};
  element: HTMLElement;
  written: Array<string | Uint8Array> = [];
  fit = vi.fn(() => { this.cols = 100; this.rows = 30; });
  setThemeColors = vi.fn();
  constructor(element: HTMLElement) { this.element = element; }
  write(data: string | Uint8Array) { this.written.push(data); }
}

vi.mock('@wterm/react', async () => {
  const { useImperativeHandle, useRef } = await import('react');
  return {
    Terminal: function FakeWTerm({ ref, ...props }: Record<string, unknown> & { ref?: React.Ref<unknown> }) {
      const element = useRef<HTMLDivElement>(null);
      const instance = useRef<FakeInstance | null>(null);
      useImperativeHandle(ref, () => ({
        write: (data: string) => instance.current?.write(data),
        resize: vi.fn(),
        focus: vi.fn(),
        get instance() { return instance.current; },
      }));
      const { className, style, onFocusCapture, 'data-slot': slot } = props as Record<string, never>;
      return (
        <div
          data-slot={slot}
          ref={(el) => {
            element.current = el;
            if (el && !instance.current) {
              instance.current = new FakeInstance(el);
              instances.push({ props, instance: instance.current });
            }
          }}
          className={className}
          style={style}
          onFocusCapture={onFocusCapture}
        />
      );
    },
  };
});
vi.mock('@wterm/ghostty', () => ({ GhosttyCore: { load: vi.fn(async () => ({ dispose: vi.fn(), ghostty: true })) } }));

const { Terminal } = await import('@/components/ui/terminal');

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLElement | null = null;
const render = async (element: ReactElement) => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root?.render(element); });
  return host;
};

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  instances.length = 0;
});

const ready = async (index = 0) => {
  const { props, instance } = instances[index];
  await act(async () => { (props.onReady as (i: FakeInstance) => void)(instance); });
  return { props, instance };
};

describe('Terminal', () => {
  it('is the conventions\' root: data-slot, and className and style last', async () => {
    const el = await render(<Terminal core="builtin" className="my-class p-5" style={{ opacity: 0.5 }} />);
    const terminal = el.querySelector<HTMLElement>('[data-slot=terminal]');
    expect(terminal).not.toBeNull();
    expect(terminal?.className).toContain('my-class');
    expect(terminal?.className).toContain('p-5');
    expect(terminal?.className).not.toContain(' p-2');
    expect(terminal?.style.opacity).toBe('0.5');
  });

  it('always fits its container', async () => {
    await render(<Terminal core="builtin" />);
    expect(instances[0].props.autoResize).toBe(true);
    const { instance } = await ready();
    expect(instance.fit).toHaveBeenCalled();
  });

  it('waits for Ghostty\'s core before starting wterm, and passes it on', async () => {
    const el = await render(<Terminal />);
    await act(async () => { await Promise.resolve(); });
    expect(el.querySelector('[data-slot=terminal]')).not.toBeNull();
    expect(instances).toHaveLength(1);
    expect(instances[0].props.core).toMatchObject({ ghostty: true });
  });

  it('uses the built-in core when asked, and yours when given', async () => {
    await render(<Terminal core="builtin" />);
    expect(instances[0].props.core).toBeUndefined();
    const mine = { mine: true } as never;
    await render(<Terminal core={mine} />);
    expect(instances[1].props.core).toBe(mine);
  });

  it('with onCommand, typing goes to a line editor that draws through wterm', async () => {
    const onCommand = vi.fn();
    await render(<Terminal core="builtin" prompt="$ " onCommand={onCommand} />);
    const { props, instance } = await ready();
    expect(instance.written.join('')).toContain('$ ');
    await act(async () => { (props.onData as (data: string) => void)('ls\r'); });
    expect(onCommand).toHaveBeenCalledWith('ls', expect.anything());
  });

  it('runs the latest onCommand', async () => {
    const first = vi.fn();
    const second = vi.fn();
    await render(<Terminal core="builtin" onCommand={first} />);
    const { props } = await ready();
    await act(async () => { root?.render(<Terminal core="builtin" onCommand={second} />); });
    await act(async () => { (props.onData as (data: string) => void)('x\r'); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });

  it('without a shell, onData gets the keys', async () => {
    const onData = vi.fn();
    await render(<Terminal core="builtin" onData={onData} />);
    (instances[0].props.onData as (data: string) => void)('a');
    expect(onData).toHaveBeenCalledWith('a');
  });

  it('with neither, leaves onData off, which makes wterm echo', async () => {
    await render(<Terminal core="builtin" />);
    expect(instances[0].props.onData).toBeUndefined();
  });

  it('readOnly swallows keys and hides the cursor', async () => {
    const onData = vi.fn();
    await render(<Terminal core="builtin" readOnly onData={onData} />);
    const { props, instance } = await ready();
    (props.onData as (data: string) => void)('a');
    expect(onData).not.toHaveBeenCalled();
    expect(instance.written).toContain('\x1b[?25l');
  });

  it('gives focus back after wterm takes it, unless it should keep it', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const el = await render(<Terminal core="builtin" />);
    const terminal = el.querySelector<HTMLElement>('[data-slot=terminal]') as HTMLElement;
    const input = document.createElement('textarea');
    terminal.append(input);
    input.focus();
    expect(document.activeElement).toBe(input);
    await ready();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('a shell passed in survives unmounting, and the next Terminal shows what it printed', async () => {
    const shell = createTerminalShell({ prompt: '$ ', onCommand: (_line, io) => { io.write('output\n'); } });
    await render(<Terminal core="builtin" shell={shell} />);
    const first = await ready();
    await act(async () => { (first.props.onData as (data: string) => void)('x\r'); });
    await act(async () => { root?.unmount(); });
    root = null;
    await render(<Terminal core="builtin" shell={shell} />);
    const second = await ready(1);
    expect(second.instance.written.join('')).toContain('output');
  });

  it('the handle writes above the prompt, and reads the grid', async () => {
    const ref = createRef<TerminalHandle>();
    await render(<Terminal core="builtin" ref={ref} prompt="$ " onCommand={() => {}} />);
    const { instance } = await ready();
    ref.current?.write('note\n');
    expect(instance.written.join('')).toContain('note\r\n');
    expect(ref.current?.cols).toBe(100);
    expect(ref.current?.rows).toBe(30);
    expect(ref.current?.shell).not.toBeNull();
  });

  it('the handle without a shell writes straight through, and clears with sequences', async () => {
    const ref = createRef<TerminalHandle>();
    await render(<Terminal core="builtin" ref={ref} />);
    const { instance } = await ready();
    ref.current?.write('raw');
    ref.current?.clear();
    expect(instance.written).toEqual(['raw', '\x1b[3J\x1b[2J\x1b[H']);
  });

  it('passes on resizes, to a shell too', async () => {
    const onResize = vi.fn();
    const shell = createTerminalShell({ onCommand: () => {} });
    const resize = vi.spyOn(shell, 'resize');
    await render(<Terminal core="builtin" shell={shell} onResize={onResize} />);
    await act(async () => { (instances[0].props.onResize as (c: number, r: number) => void)(40, 10); });
    expect(resize).toHaveBeenCalledWith(40, 10);
    expect(onResize).toHaveBeenCalledWith(40, 10);
  });
});
