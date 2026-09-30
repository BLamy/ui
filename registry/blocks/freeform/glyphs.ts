/* Toolbar glyphs the icon set doesn't have, on its 24px grid (see IconShape in @/lib/icon). */
import type { IconShape } from '@/lib/icon';

export const G_SELECT: IconShape[] = [{ d: 'M5.5 3.5 18.8 10l-5.7 1.9L10.7 18z', f: 2 }];
export const G_SHAPES: IconShape[] = [{ r: [3.5, 11, 9, 9, 2] }, { c: [15, 9, 5.2] }];
export const G_CONNECTOR: IconShape[] = [{ c: [5.5, 18, 2.2] }, { c: [18.5, 6, 2.2] }, { d: 'M7.7 18H12a3 3 0 0 0 3-3V9a3 3 0 0 1 1.3-2.5' }];
export const G_GROUP: IconShape[] = [{ r: [3.5, 3.5, 10, 10, 1.5] }, { r: [10.5, 10.5, 10, 10, 1.5] }];

export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export const G_ALIGN: Record<AlignKind, IconShape[]> = {
  left: [{ d: 'M4 3.5v17' }, { r: [7, 6, 12, 4, 1] }, { r: [7, 14, 7, 4, 1] }],
  hcenter: [{ d: 'M12 3.5v17' }, { r: [5, 6, 14, 4, 1] }, { r: [7.5, 14, 9, 4, 1] }],
  right: [{ d: 'M20 3.5v17' }, { r: [5, 6, 12, 4, 1] }, { r: [10, 14, 7, 4, 1] }],
  top: [{ d: 'M3.5 4h17' }, { r: [6, 7, 4, 12, 1] }, { r: [14, 7, 4, 7, 1] }],
  vcenter: [{ d: 'M3.5 12h17' }, { r: [6, 5, 4, 14, 1] }, { r: [14, 7.5, 4, 9, 1] }],
  bottom: [{ d: 'M3.5 20h17' }, { r: [6, 5, 4, 12, 1] }, { r: [14, 10, 4, 7, 1] }],
};

export const G_TEXT_ALIGN = {
  left: [{ d: 'M4 6h16' }, { d: 'M4 12h10' }, { d: 'M4 18h13' }],
  center: [{ d: 'M4 6h16' }, { d: 'M7 12h10' }, { d: 'M5.5 18h13' }],
  right: [{ d: 'M4 6h16' }, { d: 'M10 12h10' }, { d: 'M7 18h13' }],
} satisfies Record<string, IconShape[]>;
