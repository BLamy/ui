// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MarkdownView, type CodeBlockNode, type CodeBlockRenderDetails } from '@/components/ui/markdown-view';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const FENCE = ['Before', '', '```ts', 'export const tray = { threshold: 0.4 }', '```', '', 'After'].join('\n');

describe('MarkdownView', () => {
  it('renders the markdown in the kit root and passes the rest of its props to it', () => {
    const { container } = render(<MarkdownView markdown="## Release checklist" id="notes" data-testid="mv" className="my-4" />);
    const root = container.querySelector<HTMLElement>('[data-slot=markdown-view]')!;
    expect(root.id).toBe('notes');
    expect(root.dataset.renderer).toBe('docstream');
    expect(root.className).toContain('wb-md');
    expect(root.className).toContain('my-4');
    expect(root.querySelector('h2')?.textContent).toContain('Release checklist');
  });

  it('colors a fence without WebGPU (the fallback lexer)', () => {
    const { container } = render(<MarkdownView markdown={FENCE} />);
    const code = container.querySelector<HTMLElement>('pre code')!;
    expect(code.dataset.highlighter).toBe('fallback');
    expect(code.querySelector('.docs-tok-keyword')?.textContent).toBe('export');
  });

  it('draws a fence through renderCode, with the block and Docstream\'s highlighted code', () => {
    const renderCode = vi.fn((block: CodeBlockNode, details: CodeBlockRenderDetails) => (
      <figure data-testid="own-code" data-language={block.language ?? ''} data-placement={details.placement}>{details.highlighted}</figure>
    ));
    const { getByTestId } = render(<MarkdownView markdown={FENCE} renderCode={renderCode} />);
    expect(renderCode).toHaveBeenCalled();
    const [block] = renderCode.mock.calls[0]!;
    expect(block.type).toBe('code');
    expect(block.language).toBe('ts');
    const own = getByTestId('own-code');
    expect(own.dataset.placement).toBe('block');
    expect(own.querySelector('code')?.textContent).toContain('threshold');
  });

  it('falls back to Docstream\'s fence when renderCode returns null', () => {
    const { container } = render(<MarkdownView markdown={FENCE} renderCode={() => null} />);
    expect(container.querySelector('pre code')?.textContent).toContain('export const tray');
  });
});
