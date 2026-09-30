/* Small drawn previews for the insert menus: a shape's outline and a sticky note. */
import { cn } from '@/lib/utils';
import type { ShapeKind } from './model';
import { shapePath } from './shapes';

export function ShapeGlyph({ kind, size = 28, className }: { kind: ShapeKind; size?: number; className?: string }) {
  // A 24-unit box, inset so strokes aren't clipped.
  const w = 22, h = kind === 'arrow' || kind === 'bubble' ? 16 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={cn('block', className)}>
      <path d={shapePath(kind, w, h)} transform={`translate(1 ${(24 - h) / 2})`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function StickyGlyph({ color, size = 36 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="block rounded-[3px] shadow-[0_4px_8px_-3px] shadow-black/35" style={{ width: size, height: size, background: color }} />;
}
