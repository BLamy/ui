/* Web Mercator helpers shared by the tile map and the map agent. */

export const TILE_SIZE = 256;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MapView {
  center: LatLng;
  zoom: number;
}

export type MapPadding = number | { top?: number; right?: number; bottom?: number; left?: number };

export interface MapBoundsTarget {
  bounds: LatLng[];
  padding?: MapPadding;
  maxZoom?: number;
}

/** Either an explicit camera or a set of points the map should frame. */
export type MapTarget = MapView | MapBoundsTarget;

export function isBoundsTarget(target: MapTarget): target is MapBoundsTarget {
  return 'bounds' in target;
}

/** Projects a coordinate to world pixels at the given (fractional) zoom. */
export function project({ lat, lng }: LatLng, zoom: number): Point {
  const n = TILE_SIZE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * n,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n,
  };
}

export function unproject({ x, y }: Point, zoom: number): LatLng {
  const n = TILE_SIZE * 2 ** zoom;
  const t = Math.PI * (1 - (2 * y) / n);
  return {
    lng: (x / n) * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(Math.sinh(t)),
  };
}

export function clampLat(lat: number): number {
  return Math.max(-85.05, Math.min(85.05, lat));
}

export function normalizePadding(padding: MapPadding | undefined) {
  if (typeof padding === 'number') return { top: padding, right: padding, bottom: padding, left: padding };
  return { top: padding?.top ?? 40, right: padding?.right ?? 40, bottom: padding?.bottom ?? 40, left: padding?.left ?? 40 };
}

/** Resolves a target to a camera for a viewport of the given size. */
export function resolveView(target: MapTarget, width: number, height: number, minZoom: number, maxZoom: number): MapView {
  if (!isBoundsTarget(target)) return target;
  const pad = normalizePadding(target.padding);
  const points = target.bounds.length ? target.bounds : [{ lat: 0, lng: 0 }];
  const usableW = Math.max(40, width - pad.left - pad.right);
  const usableH = Math.max(40, height - pad.top - pad.bottom);
  const at0 = points.map((p) => project(p, 0));
  const minX = Math.min(...at0.map((p) => p.x));
  const maxX = Math.max(...at0.map((p) => p.x));
  const minY = Math.min(...at0.map((p) => p.y));
  const maxY = Math.max(...at0.map((p) => p.y));
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const zoomX = Math.log2(usableW / spanX);
  const zoomY = Math.log2(usableH / spanY);
  const zoom = Math.max(minZoom, Math.min(target.maxZoom ?? maxZoom, Math.min(zoomX, zoomY)));
  // Shift the centre so the padded box, not the viewport, is centred on the bounds.
  const scale = 2 ** zoom;
  const boxCenter = { x: ((minX + maxX) / 2) * scale, y: ((minY + maxY) / 2) * scale };
  const offsetX = (pad.left - pad.right) / 2;
  const offsetY = (pad.top - pad.bottom) / 2;
  return { center: unproject({ x: boxCenter.x - offsetX, y: boxCenter.y - offsetY }, zoom), zoom };
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Street-grid walking estimate: straight-line distance × 1.25 at roughly 80 m/min. */
export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.25) / 80));
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  return `${miles.toFixed(miles < 1 ? 1 : 1)} mi`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
