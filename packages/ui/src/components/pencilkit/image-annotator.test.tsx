// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ImageAnnotator, ImageAnnotatorProvider, type ImageAnnotatorEngine } from '@/components/ui/pencilkit/image-annotator';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const SRC = 'data:image/png;base64,AAAA';

describe('ImageAnnotator', () => {
  it('opens on PencilKit by default, titled Markup, with literal black and white inks', async () => {
    render(<ImageAnnotator src={SRC} defaultOpen />);
    const dialog = await screen.findByRole('dialog', { name: 'Annotate image' });
    expect(within(dialog).getByText('Markup')).toBeTruthy();
    const ink = within(dialog).getByRole('group', { name: 'Ink' });
    const swatch = (name: string) => within(ink).getByRole('button', { name }).style.getPropertyValue('--ink');
    // The paper is the image, not the theme: "Black" is black whatever the lightbox's appearance.
    expect(swatch('Black')).toBe('#000000');
    expect(swatch('White')).toBe('#FFFFFF');
  });

  it('names the image and the lightbox from `alt`', async () => {
    render(<ImageAnnotator src={SRC} alt="checkout.png" defaultOpen />);
    const dialog = await screen.findByRole('dialog', { name: 'Annotate: checkout.png' });
    expect(within(dialog).getByRole('img', { name: 'checkout.png' })).toBeTruthy();
  });

  it('draws the surface in the image\'s appearance, not the lightbox\'s', async () => {
    const Engine: ImageAnnotatorEngine = ({ children }) => children({ canvas: <svg data-testid="surface" /> });
    render(<ImageAnnotator src={SRC} defaultOpen engine={Engine} appearance="light" />);
    const surface = await screen.findByTestId('surface');
    const scope = surface.closest<HTMLElement>('[data-slot="image-annotator-surface"]')!;
    expect(scope.dataset.appearance).toBe('light');
    expect(scope.className).toMatch(/\blight\b/);
    // The lightbox around it stays dark.
    expect(scope.closest('[data-slot="dialog-content"]')!.className).toMatch(/\bdark\b/);
  });

  it('takes its engine from the nearest ImageAnnotatorProvider; null makes it a preview', async () => {
    const Engine: ImageAnnotatorEngine = ({ children }) => children({ title: 'Circle it', canvas: <svg /> });
    const { unmount } = render(<ImageAnnotatorProvider engine={Engine}><ImageAnnotator src={SRC} defaultOpen /></ImageAnnotatorProvider>);
    expect(await screen.findByText('Circle it')).toBeTruthy();
    unmount();
    render(<ImageAnnotatorProvider engine={null}><ImageAnnotator src={SRC} defaultOpen /></ImageAnnotatorProvider>);
    const dialog = await screen.findByRole('dialog', { name: 'Preview image' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});
