// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameCoverHeader, DiagramFramePanel, DiagramFrameSection, useDiagramFrame } from '@/components/ui/diagram-frame';
import { settle } from '../../test/agent-harness';

/* DiagramFrame: the panel is an AdaptivePane (a column, a drawer or a pushed page), the bar's trigger opens it and focus
   goes in and comes back, a cover makes everything under it inert and its header goes back, a closed pushed page doesn't
   keep a column closed, and the panel passes its props on. Strict: UI SDK's warnings fail it. */

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

  it('opens without taking focus when asked to (from what’s selected on the board), and its column is a region with its name', async () => {
    function Opener() {
      const { setOpen } = useDiagramFrame();
      return <button type="button" onClick={() => setOpen(true, { focus: false })}>Select something</button>;
    }
    render(
      <div style={{ position: 'relative', width: 800, height: 500 }}>
        <DiagramFrame presentation="column" defaultOpen={false}>
          <DiagramFrameBoard><Opener /><DiagramFrameBar>In Idle</DiagramFrameBar></DiagramFrameBoard>
          <DiagramFramePanel title="Simulation"><button type="button">SUBMIT</button></DiagramFramePanel>
        </DiagramFrame>
      </div>,
    );
    await settle();
    const opener = screen.getByRole('button', { name: 'Select something' });
    opener.focus();
    fireEvent.click(opener);
    await settle();
    expect(screen.getByRole('region', { name: 'Simulation' })).toBeTruthy();
    expect(document.activeElement).toBe(opener);
  });

  it('makes the board and the panel inert under a cover', async () => {
    render(<Frame presentation="column" cover />);
    await settle();
    expect(document.querySelector('[data-slot=diagram-frame-board]')?.hasAttribute('inert')).toBe(true);
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(document.querySelector('[data-slot=diagram-frame]')?.hasAttribute('data-covered')).toBe(true);
  });
});

describe('DiagramFrameCoverHeader', () => {
  function Covered() {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ position: 'relative', width: 800, height: 500 }}>
        <DiagramFrame presentation="column">
          <DiagramFrameBoard><button type="button">On the board</button></DiagramFrameBoard>
          <DiagramFramePanel title="Services">Body</DiagramFramePanel>
          {open ? (
            <DiagramFrameCover>
              <DiagramFrameCoverHeader title="Uploads’ machine" backLabel="Services" onBack={() => setOpen(false)} />
            </DiagramFrameCover>
          ) : null}
        </DiagramFrame>
      </div>
    );
  }

  it('goes back with the bar’s back button, which has focus when the cover opens, and says what it goes back to', async () => {
    render(<Covered />);
    await settle();
    const back = screen.getByRole('button', { name: 'Back to Services' });
    expect(document.activeElement).toBe(back);
    expect(screen.getByRole('heading', { name: 'Uploads’ machine' })).toBeTruthy();
    fireEvent.click(back);
    await settle();
    expect(screen.queryByRole('heading', { name: 'Uploads’ machine' })).toBeNull();
    expect(document.querySelector('[data-slot=diagram-frame]')?.hasAttribute('data-covered')).toBe(false);
  });
});

describe('DiagramFrame panel', () => {
  it('takes a title that isn’t text, and passes its other props to the pane', async () => {
    render(
      <div style={{ position: 'relative', width: 800, height: 500 }}>
        <DiagramFrame presentation="column">
          <DiagramFrameBoard />
          <DiagramFramePanel title={<span>Edit <b>2</b></span>} aria-label="Edit" data-testid="pane">Body</DiagramFramePanel>
        </DiagramFrame>
      </div>,
    );
    await settle();
    expect(screen.getByTestId('pane')).toBeTruthy();
    expect(document.querySelector('[data-slot=diagram-frame]')?.getAttribute('data-size-class')).toBeTruthy();
  });

  it('shows a column again when it widens, after a phone’s pushed page was closed', async () => {
    function Resizable() {
      const [presentation, setPresentation] = useState<'push' | 'column'>('push');
      return (
        <div style={{ position: 'relative', width: 800, height: 500 }}>
          <button type="button" onClick={() => setPresentation('column')}>Widen</button>
          <DiagramFrame presentation={presentation} defaultOpen>
            <DiagramFrameBoard><DiagramFrameBar>Status</DiagramFrameBar></DiagramFrameBoard>
            <DiagramFramePanel title="Simulation">Body</DiagramFramePanel>
          </DiagramFrame>
        </div>
      );
    }
    render(<Resizable />);
    await settle();
    // Back to the board, on the phone.
    fireEvent.click(screen.getByRole('button', { name: 'Back to Board' }));
    await settle();
    expect(document.querySelector('[data-slot=diagram-frame]')?.hasAttribute('data-open')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Widen' }));
    await settle();
    expect(document.querySelector('[data-slot=diagram-frame]')?.hasAttribute('data-open')).toBe(true);
  });
});
