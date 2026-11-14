// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  InkPicker, PencilActions, PencilToolbar, PencilToolbarDivider, PencilToolButton, ToolPicker, WidthPicker,
} from '@/components/ui/pencilkit/pencil-toolbar';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const pressedIn = (group: HTMLElement) => within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'));

describe('ToolPicker', () => {
  it('is a named group of toggles with the current tool pressed, and one tab stop', () => {
    render(<ToolPicker value="marker" />);
    const group = screen.getByRole('group', { name: 'Tool' });
    expect(pressedIn(group)).toEqual(['marker']);
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
    expect(screen.getByRole('button', { name: 'marker' }).getAttribute('title')).toBe('marker');
  });

  it('reports a new tool with why, and nothing for the current one', () => {
    const onValueChange = vi.fn();
    render(<ToolPicker value="pen" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'eraser' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('eraser', expect.objectContaining({ reason: 'item-press' }));
    // The value is the caller's: the picker shows the new tool once it is handed back.
    expect(pressedIn(screen.getByRole('group'))).toEqual(['pen']);
    fireEvent.click(screen.getByRole('button', { name: 'pen' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('moves focus with the arrow keys without changing the tool', () => {
    const onValueChange = vi.fn();
    render(<ToolPicker value="pen" tools={['pen', 'eraser']} onValueChange={onValueChange} />);
    const [pen, eraser] = screen.getAllByRole('button');
    pen.focus();
    fireEvent.keyDown(pen, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(eraser);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('InkPicker and WidthPicker', () => {
  it('report the index of the ink or width that was pressed', () => {
    const onInk = vi.fn();
    const onWidth = vi.fn();
    render(
      <>
        <InkPicker value={0} inks={['black', 'white', 'tomato']} onValueChange={onInk} />
        <WidthPicker value={1} widths={[{ m: 1, d: 4 }, { m: 2, d: 8 }, { m: 3, d: 12 }]} onValueChange={onWidth} />
      </>,
    );
    expect(pressedIn(screen.getByRole('group', { name: 'Ink' }))).toEqual(['Ink black']);
    expect(pressedIn(screen.getByRole('group', { name: 'Width' }))).toEqual(['Width 2']);
    fireEvent.click(screen.getByRole('button', { name: 'Ink tomato' }));
    expect(onInk).toHaveBeenLastCalledWith(2, expect.objectContaining({ reason: 'item-press' }));
    fireEvent.click(screen.getByRole('button', { name: 'Width 1' }));
    expect(onWidth).toHaveBeenLastCalledWith(0, expect.objectContaining({ reason: 'item-press' }));
  });
});

describe('PencilActions and PencilToolButton', () => {
  it('runs undo, redo and clear, and keeps what cannot run reachable but inert', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onClear = vi.fn();
    render(<PencilToolbar><PencilActions canUndo canRedo={false} onUndo={onUndo} onRedo={onRedo} onClear={onClear} /></PencilToolbar>);
    const history = screen.getByRole('group', { name: 'History' });
    fireEvent.click(within(history).getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    const redo = within(history).getByRole('button', { name: 'Redo' });
    expect(redo.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(redo);
    expect(onRedo).not.toHaveBeenCalled();
    // Clear follows undo unless told otherwise.
    fireEvent.click(within(history).getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('names a tool button by its label, and fills it while active', () => {
    const onClick = vi.fn();
    render(<PencilToolButton icon="pencil-tip" label="Draw" active onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Draw' });
    expect(button.getAttribute('title')).toBe('Draw');
    expect(button.className).toContain('bg-primary');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('PencilToolbar', () => {
  it('scrolls its pickers in a ScrollArea and pins the actions beside it', () => {
    const { container } = render(
      <PencilToolbar>
        <ToolPicker value="pen" />
        <PencilToolbarDivider />
        <PencilActions canUndo />
      </PencilToolbar>,
    );
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')!;
    expect(within(viewport as HTMLElement).getByRole('group', { name: 'Tool' })).toBeTruthy();
    expect(within(viewport as HTMLElement).queryByRole('group', { name: 'History' })).toBeNull();
    const pinned = container.querySelector('[data-slot="pencil-toolbar-pinned"]')!;
    expect(within(pinned as HTMLElement).getByRole('group', { name: 'History' })).toBeTruthy();
  });

  it('keeps one plain row when it holds only actions', () => {
    const { container } = render(<PencilToolbar><PencilActions canUndo /></PencilToolbar>);
    expect(container.querySelector('[data-slot="pencil-toolbar-pinned"]')).toBeNull();
    expect(within(container.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement).getByRole('group', { name: 'History' })).toBeTruthy();
  });
});

describe('PencilToolbar as a UI SDK Toolbar', () => {
  function Bar() {
    return (
      <PencilToolbar>
        <ToolPicker value="pen" tools={['pen', 'eraser']} />
        <PencilToolbarDivider />
        <InkPicker value={0} inks={['black', 'tomato']} />
        <PencilToolbarDivider />
        <PencilActions canUndo canRedo={false} />
      </PencilToolbar>
    );
  }

  it('is a named toolbar with separators between its groups and one tab stop', () => {
    render(<Bar />);
    const toolbar = screen.getByRole('toolbar', { name: 'Drawing tools' });
    expect(within(toolbar).getAllByRole('separator')).toHaveLength(2);
    const stops = within(toolbar).getAllByRole('button').filter((b) => b.getAttribute('tabindex') !== '-1');
    expect(stops.map((b) => b.getAttribute('aria-label'))).toEqual(['pen']);
  });

  it('moves with the arrow keys from Tool to Ink to History, without pressing anything', () => {
    render(<Bar />);
    const order = ['pen', 'eraser', 'Ink black', 'Ink tomato', 'Undo', 'Redo', 'Clear'];
    const first = screen.getByRole('button', { name: 'pen' });
    first.focus();
    for (const name of order.slice(1)) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      expect(document.activeElement?.getAttribute('aria-label')).toBe(name);
    }
    expect(screen.getByRole('button', { name: 'pen' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('draws a plain decorative divider outside a PencilToolbar', () => {
    const { container } = render(<div><PencilToolbarDivider /></div>);
    expect(screen.queryByRole('separator')).toBeNull();
    expect(container.querySelector('[data-slot="pencil-toolbar-divider"]')?.getAttribute('aria-hidden')).toBe('true');
  });
});
