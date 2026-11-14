// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  PencilActions, PencilInkPicker, PencilToolbar, PencilToolbarPinned, PencilToolPicker, PencilWidthPicker,
} from '@/components/ui/pencilkit/pencil-toolbar';
import { ToolbarSeparator } from '@/components/ui/toolbar';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const pressedIn = (group: HTMLElement) => within(group).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'));

describe('PencilToolPicker', () => {
  it('is a named group of toggles named by tool, with the current tool pressed, and one tab stop', () => {
    render(<PencilToolPicker value="marker" />);
    const group = screen.getByRole('group', { name: 'Tool' });
    expect(pressedIn(group)).toEqual(['Marker']);
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Pen', 'Marker', 'Pencil', 'Eraser']);
    expect(within(group).getAllByRole('button').map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
    // The name shows in a Tooltip, not a native title.
    expect(screen.getByRole('button', { name: 'Marker' }).getAttribute('title')).toBeNull();
  });

  it('reports a new tool with why, and nothing for the current one', () => {
    const onValueChange = vi.fn();
    render(<PencilToolPicker value="pen" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith('eraser', expect.objectContaining({ reason: 'item-press' }));
    // The value is the caller's: the picker shows the new tool once it is handed back.
    expect(pressedIn(screen.getByRole('group'))).toEqual(['Pen']);
    fireEvent.click(screen.getByRole('button', { name: 'Pen' }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('keeps its own value when uncontrolled, starting at defaultValue', () => {
    const onValueChange = vi.fn();
    render(<PencilToolPicker defaultValue="pencil" onValueChange={onValueChange} />);
    expect(pressedIn(screen.getByRole('group'))).toEqual(['Pencil']);
    fireEvent.click(screen.getByRole('button', { name: 'Marker' }));
    expect(pressedIn(screen.getByRole('group'))).toEqual(['Marker']);
    expect(onValueChange).toHaveBeenLastCalledWith('marker', expect.anything());
  });

  it('moves focus with the arrow keys without changing the tool', () => {
    const onValueChange = vi.fn();
    render(<PencilToolPicker value="pen" tools={['pen', 'eraser']} onValueChange={onValueChange} />);
    const [pen, eraser] = screen.getAllByRole('button');
    pen.focus();
    fireEvent.keyDown(pen, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(eraser);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('PencilInkPicker and PencilWidthPicker', () => {
  it('take and report the ink and the width themselves, named by label', () => {
    const onInk = vi.fn();
    const onWidth = vi.fn();
    render(
      <>
        <PencilInkPicker
          value="black"
          inks={[{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }, { value: 'tomato', label: 'Tomato' }]}
          onValueChange={onInk}
        />
        <PencilWidthPicker
          value={2}
          widths={[{ scale: 1, dot: 4, label: 'Thin' }, { scale: 2, dot: 8, label: 'Medium' }, { scale: 3, dot: 12, label: 'Thick' }]}
          onValueChange={onWidth}
        />
      </>,
    );
    expect(pressedIn(screen.getByRole('group', { name: 'Ink' }))).toEqual(['Black']);
    expect(pressedIn(screen.getByRole('group', { name: 'Width' }))).toEqual(['Medium']);
    fireEvent.click(screen.getByRole('button', { name: 'Tomato' }));
    expect(onInk).toHaveBeenLastCalledWith('tomato', expect.objectContaining({ reason: 'item-press' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thin' }));
    expect(onWidth).toHaveBeenLastCalledWith(1, expect.objectContaining({ reason: 'item-press' }));
  });

  it('default to the first ink and the regular width, with every swatch named', () => {
    render(<><PencilInkPicker /><PencilWidthPicker /></>);
    expect(pressedIn(screen.getByRole('group', { name: 'Ink' }))).toEqual(['Black']);
    expect(within(screen.getByRole('group', { name: 'Ink' })).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Black', 'White', 'Blue', 'Green', 'Yellow', 'Pink']);
    expect(pressedIn(screen.getByRole('group', { name: 'Width' }))).toEqual(['Regular']);
  });
});

describe('PencilActions', () => {
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
});

describe('PencilToolbar', () => {
  it('scrolls its pickers in a ScrollArea and keeps PencilToolbarPinned beside it', () => {
    const { container } = render(
      <PencilToolbar>
        <PencilToolPicker value="pen" />
        <PencilToolbarPinned>
          <ToolbarSeparator />
          <PencilActions canUndo />
        </PencilToolbarPinned>
      </PencilToolbar>,
    );
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
    expect(within(viewport).getByRole('group', { name: 'Tool' })).toBeTruthy();
    expect(within(viewport).queryByRole('group', { name: 'History' })).toBeNull();
    const pinned = container.querySelector('[data-slot="pencil-toolbar-pinned"]') as HTMLElement;
    expect(within(pinned).getByRole('group', { name: 'History' })).toBeTruthy();
  });

  it('sits in the flow: it does not position itself', () => {
    render(<PencilToolbar><PencilActions canUndo /></PencilToolbar>);
    expect(screen.getByRole('toolbar').className).not.toMatch(/\babsolute\b/);
  });
});

describe('PencilToolbar as a UI SDK Toolbar', () => {
  function Bar() {
    return (
      <PencilToolbar>
        <PencilToolPicker value="pen" tools={['pen', 'eraser']} />
        <ToolbarSeparator />
        <PencilInkPicker value="black" inks={[{ value: 'black', label: 'Black' }, { value: 'tomato', label: 'Tomato' }]} />
        <PencilToolbarPinned>
          <ToolbarSeparator />
          <PencilActions canUndo canRedo={false} />
        </PencilToolbarPinned>
      </PencilToolbar>
    );
  }

  it('is a named toolbar with separators between its groups and one tab stop', () => {
    render(<Bar />);
    const toolbar = screen.getByRole('toolbar', { name: 'Drawing tools' });
    expect(within(toolbar).getAllByRole('separator')).toHaveLength(2);
    const stops = within(toolbar).getAllByRole('button').filter((b) => b.getAttribute('tabindex') !== '-1');
    expect(stops.map((b) => b.getAttribute('aria-label'))).toEqual(['Pen']);
  });

  it('moves with the arrow keys from Tool to Ink to History, without pressing anything', () => {
    render(<Bar />);
    const order = ['Pen', 'Eraser', 'Black', 'Tomato', 'Undo', 'Redo', 'Clear'];
    screen.getByRole('button', { name: 'Pen' }).focus();
    for (const name of order.slice(1)) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      expect(document.activeElement?.getAttribute('aria-label')).toBe(name);
    }
    expect(screen.getByRole('button', { name: 'Pen' }).getAttribute('aria-pressed')).toBe('true');
  });
});
