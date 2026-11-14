// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FloatingSheet } from '@/components/ui/floating-sheet';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* On the server there is no host to measure: the sheet, its surface, the Body and the Foot still render (closed), so
   the first paint has them and hydration doesn't remount them. */
describe('FloatingSheet on the server', () => {
  it('renders its surface, Body and Foot before the host is measured', () => {
    const html = renderToString(
      <FloatingSheet label="Order" peek={120}>
        <FloatingSheet.Body><p>Arriving in 12 minutes</p></FloatingSheet.Body>
        <FloatingSheet.Foot><button type="button">Track</button></FloatingSheet.Foot>
      </FloatingSheet>,
    );
    expect(html).toContain('data-layer-host=""');
    expect(html).toContain('data-slot="floating-sheet-surface"');
    expect(html).toContain('Arriving in 12 minutes');
    expect(html).toContain('Track');
  });
});
