// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ArtifactChatContainer, useArtifactChatContainer, type ArtifactChatContainerProps } from '@/components/ui/artifact-chat-container';
import { BLProvider } from '@/lib/theme';
import { useSizeClassScope } from '@/lib/container';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

/* happy-dom has no layout: the container reports `width`, everything else nothing. */
let width = 900;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.slot === 'artifact-chat-container' ? width : 0;
    },
  });
});
afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
  width = 900;
});

const settle = (ms = 80) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const root = () => document.querySelector<HTMLElement>('[data-slot=artifact-chat-container]')!;
const column = () => document.querySelector<HTMLElement>('[data-slot=artifact-chat-column]');

let scope: string | undefined;
function Probe() {
  scope = useSizeClassScope();
  const { layout } = useArtifactChatContainer();
  return <p>Layout {layout}</p>;
}

function App(props: Partial<ArtifactChatContainerProps>) {
  return (
    <BLProvider>
      <ArtifactChatContainer {...props}>
        <ArtifactChatContainer.Content>
          <Probe />
        </ArtifactChatContainer.Content>
        <ArtifactChatContainer.Chat>
          <p>Transcript</p>
        </ArtifactChatContainer.Chat>
        <ArtifactChatContainer.Composer>
          <textarea aria-label="Message" />
        </ArtifactChatContainer.Composer>
      </ArtifactChatContainer>
    </BLProvider>
  );
}

describe('ArtifactChatContainer', () => {
  it('docks the chat beside the content above its breakpoint, measured on its own box, and provides that size class', () => {
    width = 900;
    render(<App breakpoint={760} />);
    expect(root().getAttribute('data-size-class')).toBe('medium');
    expect(root().getAttribute('data-layout')).toBe('split');
    expect(scope).toBe('medium');
    expect(screen.getByText('Layout split')).toBeTruthy();
    // The shared composer and transcript live in the column's docks.
    expect(column()?.contains(screen.getByRole('textbox', { name: 'Message' }))).toBe(true);
    expect(column()?.contains(screen.getByText('Transcript'))).toBe(true);
  });

  it('switches to the floating chat below its breakpoint without remounting the composer or the content', async () => {
    width = 700;
    const { rerender } = render(<App breakpoint={600} />);
    const message = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    const content = document.querySelector('[data-slot=artifact-chat-content]');
    message.value = 'half a thought';
    // The breakpoint now lies above the container's width.
    rerender(<App breakpoint={760} />);
    await settle();
    expect(root().getAttribute('data-size-class')).toBe('compact');
    expect(root().getAttribute('data-layout')).toBe('compact');
    expect(scope).toBe('compact');
    expect(document.querySelector('[data-slot=floating-chat]')).not.toBeNull();
    // Same elements, same draft: only the dock changed.
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(message);
    expect(message.value).toBe('half a thought');
    expect(document.querySelector('[data-slot=artifact-chat-content]')).toBe(content);
    expect(document.querySelector('[data-slot=floating-chat]')?.contains(message)).toBe(true);
    // The column played its exit and went.
    expect(column()).toBeNull();
    // And back: the column slides in (it didn't on first paint) and takes the composer again.
    rerender(<App breakpoint={600} />);
    expect(column()?.hasAttribute('data-starting-style')).toBe(true);
    await settle();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(message);
    expect(column()?.contains(message)).toBe(true);
  });

  it('mounted in a compact container, it starts floating: no column exit and no composer flight on first paint', async () => {
    width = 390;
    const ending: string[] = [];
    const observer = new MutationObserver((records) => {
      // Every time the attribute was added, even if it has gone again by now.
      for (const record of records) if (record.oldValue === null) ending.push((record.target as HTMLElement).dataset.slot ?? '');
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['data-ending-style'] });
    try {
      // No scope around it, so it starts out regular until it has measured its own box.
      render(
        <ArtifactChatContainer>
          <ArtifactChatContainer.Content><p>Doc</p></ArtifactChatContainer.Content>
          <ArtifactChatContainer.Chat><p>Transcript</p></ArtifactChatContainer.Chat>
          <ArtifactChatContainer.Composer><textarea aria-label="Message" /></ArtifactChatContainer.Composer>
        </ArtifactChatContainer>,
      );
      await settle();
      expect(root().getAttribute('data-layout')).toBe('compact');
      expect(column()).toBeNull();
      expect(ending).toEqual([]);
      // The composer is where the floating chat put it, not flying in from the column.
      const composer = screen.getByRole('textbox', { name: 'Message' }).closest<HTMLElement>('[data-slot=composer]');
      expect(composer?.style.transform ?? '').toBe('');
    } finally {
      observer.disconnect();
    }
  });

  it("doesn't animate the column in on first paint", () => {
    render(<App breakpoint={600} />);
    expect(column()?.hasAttribute('data-starting-style')).toBe(false);
  });

  it('reports the floating chat opening with its details, and a canceled change keeps it as it is', async () => {
    width = 390;
    const onChatOpenChange = vi.fn((_open: boolean, details: { cancel: () => void }) => details.cancel());
    let api: ReturnType<typeof useArtifactChatContainer> | undefined;
    function Opener() {
      api = useArtifactChatContainer();
      return null;
    }
    render(
      <BLProvider>
        <ArtifactChatContainer onChatOpenChange={onChatOpenChange}>
          <ArtifactChatContainer.Content><Opener /></ArtifactChatContainer.Content>
          <ArtifactChatContainer.Composer><textarea aria-label="Message" /></ArtifactChatContainer.Composer>
        </ArtifactChatContainer>
      </BLProvider>,
    );
    expect(api?.layout).toBe('floating');
    act(() => api!.setChatOpen(true));
    expect(onChatOpenChange).toHaveBeenCalledTimes(1);
    expect(onChatOpenChange.mock.calls[0][0]).toBe(true);
    expect(onChatOpenChange.mock.calls[0][1]).toMatchObject({ reason: 'imperative', source: 'programmatic', canceled: true });
    expect(api?.chatOpen).toBe(false);
    onChatOpenChange.mockImplementation(() => undefined);
    act(() => api!.setChatOpen(true));
    expect(api?.chatOpen).toBe(true);
    await settle();
  });
});
