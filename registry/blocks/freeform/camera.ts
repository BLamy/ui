/* The board's camera: a screen point is `board * z + (x, y)`. */
import type { Pt, Rect } from './geometry';
import { MAX_ZOOM, MIN_ZOOM, type Camera } from './model';

export const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

export const toBoard = (c: Camera, sx: number, sy: number): Pt => ({ x: (sx - c.x) / c.z, y: (sy - c.y) / c.z });
export const toScreen = (c: Camera, p: Pt): Pt => ({ x: p.x * c.z + c.x, y: p.y * c.z + c.y });

/** Zoom by `factor`, keeping the board point under the screen point (sx, sy) where it is. */
export function zoomAt(c: Camera, factor: number, sx: number, sy: number): Camera {
  const z = clampZoom(c.z * factor);
  const k = z / c.z;
  return { z, x: sx - (sx - c.x) * k, y: sy - (sy - c.y) * k };
}

/** A camera that shows `r` centered in a view of `size`, with `pad` px of air, zoomed in no further than 100%. */
export function fitCamera(r: Rect | null, size: { width: number; height: number }, pad = 72): Camera {
  if (!r || r.w <= 0 || r.h <= 0) return { x: size.width / 2, y: size.height / 2, z: 1 };
  const z = clampZoom(Math.min(1, (size.width - pad * 2) / r.w, (size.height - pad * 2) / r.h));
  return { z, x: size.width / 2 - (r.x + r.w / 2) * z, y: size.height / 2 - (r.y + r.h / 2) * z };
}
