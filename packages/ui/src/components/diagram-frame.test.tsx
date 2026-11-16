// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameInput, DiagramFramePanel, DiagramFrameSection } from '@/components/ui/diagram-frame';
import { settle } from '../../test/agent-harness';

/* DiagramFrame: the panel is an AdaptivePane (a column, a drawer or a pushed page), the bar's trigger opens it and focus
   goes in and comes back, a cover makes everything under it inert, and DiagramFrameInput commits on Enter or blur and
   puts the text back on Escape. Strict: UI SDK's warnings fail it. */

beforeAll(() => { globalThis.__UI_SDK_STRICT__ = true; });
afterEach(cleanup);

function Frame({ presentation, defaultOpen, cover = false, onOpenChange }: { presentation?: 'column' | 'drawer' | 'push'; defaultOpen?: boolean; cover?: boolean; onOpenChange?: () => void }) {
  return (
    <div style={{ position: 'relative', width: 800, height: 500 }}>
      <DiagramFrame presentation={presentation} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
        <DiagramFrameBoard>
          <button type="button">On the board</button>
          <DiagramFrameBar>In Idle</DiagramFrameBar>
        </DiagramFrameBoard>
        <DiagramFramePanel title="Simulation">
          <DiagramFrameSection title="Events it can take">
            <button type="button">SUBMIT</button>
          </DiagramFrameSection>
        </DiagramFramePanel>
        {cover ? <DiagramFrameCover><button type="button">Back</button></DiagramFrameCover> : null}
      </DiagramFrame>
    </div>
  );
}

describe('DiagramFrame', () => {
  it('opens as a column by default, and closes to a bar whose trigger brings it back with focus', async () => {
    render(<Frame presentation="column" />);
    await settle();
    expect(screen.getByRole('heading', { name: 'Simulation' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Events it can take' })).toBeTruthy();
    expect(screen.queryByText('In Idle')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close Simulation' }));
    await settle();
    expect(screen.getByRole('status').textContent).toBe('In Idle');
    const trigger = screen.getByRole('button', { name: 'Simulation' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    await settle();
    expect(document.activeElement?.getAttribute('data-slot')).toBe('diagram-frame-panel-body');
  });

  it('starts closed where it would go over the board, and says why it opened', async () => {
    const onOpenChange = vi.fn();
    render(<Frame presentation="push" onOpenChange={onOpenChange} />);
    await settle();
    const trigger = screen.getByRole('button', { name: 'Simulation' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(document.querySelector('[data-slot=diagram-frame]')?.hasAttribute('data-open')).toBe(true);
  });

  it('honors defaultOpen over the presentation’s default', async () => {
    render(<Frame presentation="column" defaultOpen={false} />);
    await settle();
    expect(screen.getByRole('button', { name: 'Simulation' })).toBeTruthy();
  });

  it('makes the board and the panel inert under a cover', async () => {
    render(<Frame presentation="column" cover />);
    await settle();
    expect(document.querySelector('[data-slot=diagram-frame-board]')?.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(document.querySelector('[data-slot=diagram-frame]')?.hasAttribute('data-covered')).toBe(true);
  });
});

describe('DiagramFrameInput', () => {
  function Rename({ onCommit, refuse = false }: { onCommit: (v: string) => void; refuse?: boolean }) {
    const [name, setName] = useState('idle');
    return <DiagramFrameInput label="Name" value={name} onValueCommit={(v) => { onCommit(v); if (!refuse) setName(v); }} />;
  }

  it('commits on Enter, not on each key', () => {
    const onCommit = vi.fn();
    render(<Rename onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'waiting' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('waiting');
    expect(input.value).toBe('waiting');
  });

  it('commits on leaving, and puts back what the owner refuses', () => {
    const onCommit = vi.fn();
    render(<Rename onCommit={onCommit} refuse />);
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'nope' } });
    act(() => { fireEvent.blur(input); });
    expect(onCommit).toHaveBeenCalledWith('nope');
    expect(input.value).toBe('idle');
  });

  it('puts the text back on Escape, and keeps Escape to itself', () => {
    const onCommit = vi.fn();
    const outside = vi.fn();
    render(<div onKeyDown={outside}><Rename onCommit={onCommit} /></div>);
    const input = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'oops' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('idle');
    expect(outside).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
