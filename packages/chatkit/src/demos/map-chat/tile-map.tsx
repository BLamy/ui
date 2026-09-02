import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { MAP_ICONS, type MapIconName } from './map-icons';
import {
  TILE_SIZE,
  clampLat,
  isBoundsTarget,
  project,
  resolveView,
  unproject,
  type LatLng,
  type MapTarget,
  type MapView,
  type Point,
} from './geo';

export interface MapPin {
  id: string;
  position: LatLng;
  label?: string;
  /** Pin fill colour; defaults per kind. */
  color?: string;
  icon?: MapIconName;
  /** Replaces the icon — used for numbered route stops. */
  badge?: ReactNode;
  /** Short bubble anchored above the marker, like an ETA. */
  callout?: ReactNode;
  kind?: 'place' | 'stop' | 'user';
  selected?: boolean;
}

export interface MapRoute {
  points: LatLng[];
  color?: string;
}

export type TileUrlFn = (z: number, x: number, y: number) => string;

export interface TileMapProps {
  /**
   * Camera the map flies to whenever this object's identity changes. Pass a
   * `{ center, zoom }` or `{ bounds, padding }`; user gestures move the camera
   * without touching this prop.
   */
  view: MapTarget;
  onViewChange?: (view: MapView) => void;
  pins?: MapPin[];
  route?: MapRoute | null;
  onPinClick?: (pin: MapPin) => void;
  /** Fired on a tap that did not pan the map or hit a pin. */
  onMapClick?: () => void;
  tileUrl?: TileUrlFn;
  attribution?: ReactNode;
  /** Chrome colours for labels and controls; match it to the tile set. */
  scheme?: 'dark' | 'light';
  /** CSS filter applied to the tiles, e.g. to deepen a grey basemap for a dark UI. */
  tileFilter?: string;
  minZoom?: number;
  maxZoom?: number;
  /** Animate camera changes (`view` prop, zoom buttons, double-tap). */
  animate?: boolean;
  /** Enables drag, wheel, and pinch gestures. */
  interactive?: boolean;
  /** Renders the zoom stack (and a locate button when `onLocate` is set). */
  controls?: boolean;
  onLocate?: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Esri's muted grey canvas basemaps. Served without a key up to zoom 16; attribute Esri.
 * Pair `esriDarkGrayTiles` with a `tileFilter` to deepen it for dark UIs.
 */
export const esriDarkGrayTiles: TileUrlFn = (z, x, y) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
export const esriLightGrayTiles: TileUrlFn = (z, x, y) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`;
export const ESRI_ATTRIBUTION = 'Tiles © Esri, HERE, Garmin, © OpenStreetMap contributors';

/** The standard OpenStreetMap style. Fine for light use; attribute OSM. */
export const osmTiles: TileUrlFn = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/** CARTO's raster basemaps. These now watermark tiles without an API key; kept for hosts that have one. */
export const cartoDarkTiles: TileUrlFn = (z, x, y) =>
  `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`;
export const cartoVoyagerTiles: TileUrlFn = (z, x, y) =>
  `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`;
export const CARTO_ATTRIBUTION = '© OpenStreetMap contributors © CARTO';

const FLY_MS = 900;
const TAP_SLOP = 4;
const loadedTiles = new Set<string>();

interface Size {
  width: number;
  height: number;
}

interface Gesture {
  cam: MapView;
  anchor: Point;
  distance: number;
  moved: boolean;
}

function ease(t: number) {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function pointerStats(pointers: Map<number, Point>) {
  const pts = [...pointers.values()];
  const anchor = pts.reduce((acc, p) => ({ x: acc.x + p.x / pts.length, y: acc.y + p.y / pts.length }), { x: 0, y: 0 });
  const distance = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
  return { anchor, distance };
}

export function TileMap({
  view,
  onViewChange,
  pins = [],
  route,
  onPinClick,
  onMapClick,
  tileUrl = esriDarkGrayTiles,
  attribution = ESRI_ATTRIBUTION,
  scheme = 'dark',
  tileFilter,
  minZoom = 3,
  maxZoom = 16,
  animate = true,
  interactive = true,
  controls = false,
  onLocate,
  children,
  className,
  style,
}: TileMapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [cam, setCam] = useState<MapView>(() => {
    if (!isBoundsTarget(view)) return view;
    const pts = view.bounds.length ? view.bounds : [{ lat: 0, lng: 0 }];
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return { center: { lat, lng }, zoom: 13 };
  });
  const camRef = useRef(cam);
  camRef.current = cam;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const animRef = useRef(0);
  const firstFlyRef = useRef(true);
  const pointers = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const [dragging, setDragging] = useState(false);

  const clampView = useCallback(
    (next: MapView): MapView => ({
      center: { lat: clampLat(next.center.lat), lng: ((((next.center.lng + 180) % 360) + 360) % 360) - 180 },
      zoom: Math.max(minZoom, Math.min(maxZoom, next.zoom)),
    }),
    [minZoom, maxZoom],
  );

  const commit = useCallback(
    (next: MapView) => {
      const clamped = clampView(next);
      camRef.current = clamped;
      setCam(clamped);
      onViewChange?.(clamped);
    },
    [clampView, onViewChange],
  );

  const flyTo = useCallback(
    (target: MapView, duration = FLY_MS) => {
      cancelAnimationFrame(animRef.current);
      const from = camRef.current;
      const to = clampView(target);
      if (!animate || duration <= 0 || prefersReducedMotion()) {
        commit(to);
        return;
      }
      // Long hops arc out and back in so the map does not scrub across tiles.
      const a = project(from.center, to.zoom);
      const b = project(to.center, to.zoom);
      const hop = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, sizeRef.current.width);
      const bump = Math.max(0, Math.min(2.5, Math.log2(Math.max(1, hop))));
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const e = ease(t);
        commit({
          center: {
            lat: from.center.lat + (to.center.lat - from.center.lat) * e,
            lng: from.center.lng + (to.center.lng - from.center.lng) * e,
          },
          zoom: from.zoom + (to.zoom - from.zoom) * e - Math.sin(Math.PI * t) * bump,
        });
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    },
    [animate, clampView, commit],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setSize({ width: root.clientWidth, height: root.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const measured = size.width > 0 && size.height > 0;
  useEffect(() => {
    if (!measured) return;
    const target = resolveView(view, sizeRef.current.width, sizeRef.current.height, minZoom, maxZoom);
    flyTo(target, firstFlyRef.current ? 0 : FLY_MS);
    firstFlyRef.current = false;
    // Only the target identity (and the first measurement) should move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, measured]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const zoomAround = useCallback(
    (point: Point, delta: number, animated = false) => {
      const cur = camRef.current;
      const { width, height } = sizeRef.current;
      const nextZoom = Math.max(minZoom, Math.min(maxZoom, cur.zoom + delta));
      const scale = 2 ** (nextZoom - cur.zoom);
      const c = project(cur.center, cur.zoom);
      // Keep the world point under `point` fixed while the zoom changes.
      const world = { x: c.x + (point.x - width / 2), y: c.y + (point.y - height / 2) };
      const next = {
        x: world.x * scale - (point.x - width / 2),
        y: world.y * scale - (point.y - height / 2),
      };
      const target = { center: unproject(next, nextZoom), zoom: nextZoom };
      if (animated) flyTo(target, 320);
      else commit(target);
    },
    [commit, flyTo, minZoom, maxZoom],
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(animRef.current);
      const rect = root.getBoundingClientRect();
      const speed = e.deltaMode === 1 ? 0.06 : e.ctrlKey ? 0.01 : 0.0025;
      zoomAround({ x: e.clientX - rect.left, y: e.clientY - rect.top }, -e.deltaY * speed);
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [interactive, zoomAround]);

  const local = (e: ReactPointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const anchorGesture = (moved = false) => {
    const stats = pointerStats(pointers.current);
    gestureRef.current = { cam: camRef.current, anchor: stats.anchor, distance: stats.distance, moved };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-map-ui]')) return;
    cancelAnimationFrame(animRef.current);
    rootRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    anchorGesture(gestureRef.current?.moved ?? false);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const { anchor, distance } = pointerStats(pointers.current);
    const dx = anchor.x - gesture.anchor.x;
    const dy = anchor.y - gesture.anchor.y;
    if (!gesture.moved && Math.hypot(dx, dy) < TAP_SLOP && pointers.current.size === 1) return;
    if (!gesture.moved) {
      gesture.moved = true;
      setDragging(true);
    }
    const { width, height } = sizeRef.current;
    const zoomDelta = gesture.distance > 0 && distance > 0 ? Math.log2(distance / gesture.distance) : 0;
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, gesture.cam.zoom + zoomDelta));
    const scale = 2 ** (nextZoom - gesture.cam.zoom);
    const c = project(gesture.cam.center, gesture.cam.zoom);
    const world = { x: c.x + (gesture.anchor.x - width / 2), y: c.y + (gesture.anchor.y - height / 2) };
    const next = {
      x: world.x * scale - (anchor.x - width / 2),
      y: world.y * scale - (anchor.y - height / 2),
    };
    commit({ center: unproject(next, nextZoom), zoom: nextZoom });
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const gesture = gestureRef.current;
    if (pointers.current.size === 0) {
      gestureRef.current = null;
      setDragging(false);
      if (gesture && !gesture.moved && e.type === 'pointerup') {
        const target = e.target as HTMLElement;
        if (!target.closest('.ck-tile-map__pin')) onMapClick?.();
      }
    } else {
      anchorGesture(gesture?.moved ?? true);
    }
  };

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!interactive || (e.target as HTMLElement).closest('[data-map-ui]')) return;
    const rect = rootRef.current?.getBoundingClientRect();
    zoomAround({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }, 1, true);
  };

  const zoomBy = (delta: number) => zoomAround({ x: size.width / 2, y: size.height / 2 }, delta, true);

  const toScreen = (p: LatLng): Point => {
    const c = project(cam.center, cam.zoom);
    const q = project(p, cam.zoom);
    return { x: q.x - c.x + size.width / 2, y: q.y - c.y + size.height / 2 };
  };

  const z = Math.round(cam.zoom);
  const ordered = [...pins].sort((a, b) => Number(a.selected ?? false) - Number(b.selected ?? false));

  return (
    <div
      ref={rootRef}
      data-slot="tile-map"
      data-scheme={scheme}
      data-dragging={dragging || undefined}
      className={cn('ck-tile-map', className)}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
    >
      <div className="ck-tile-map__tiles" aria-hidden style={tileFilter ? { filter: tileFilter } : undefined}>
        {measured && z - 1 >= minZoom && (
          <TileLayer z={z - 1} cam={cam} size={size} tileUrl={tileUrl} fallback />
        )}
        {measured && <TileLayer z={z} cam={cam} size={size} tileUrl={tileUrl} />}
      </div>
      {measured && route && route.points.length > 1 && (
        <svg className="ck-tile-map__route" width={size.width} height={size.height} aria-hidden>
          <polyline
            className="ck-tile-map__route-halo"
            points={route.points.map((p) => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')}
          />
          <polyline
            className="ck-tile-map__route-line"
            style={{ stroke: route.color }}
            points={route.points.map((p) => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')}
          />
        </svg>
      )}
      {measured && (
        <div className="ck-tile-map__pins">
          {ordered.map((pin) => {
            const s = toScreen(pin.position);
            const kind = pin.kind ?? 'place';
            return (
              <button
                key={pin.id}
                type="button"
                className="ck-tile-map__pin"
                data-kind={kind}
                data-selected={pin.selected || undefined}
                style={{ transform: `translate3d(${s.x}px, ${s.y}px, 0)`, '--ck-pin-color': pin.color } as CSSProperties}
                aria-label={pin.label ?? pin.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onPinClick?.(pin);
                }}
              >
                {pin.callout != null && <span className="ck-tile-map__pin-callout">{pin.callout}</span>}
                <span className="ck-tile-map__pin-marker">
                  {kind === 'user' ? null : pin.badge != null ? (
                    <span className="ck-tile-map__pin-badge">{pin.badge}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={MAP_ICONS[pin.icon ?? 'pin']} />
                    </svg>
                  )}
                </span>
                {pin.label && kind !== 'user' && <span className="ck-tile-map__pin-label">{pin.label}</span>}
              </button>
            );
          })}
        </div>
      )}
      {controls && (
        <div className="ck-tile-map__controls" data-map-ui>
          {onLocate && (
            <button type="button" className="ck-tile-map__control" aria-label="Show my location" onClick={onLocate}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={MAP_ICONS.locate} /></svg>
            </button>
          )}
          <div className="ck-tile-map__zoom">
            <button type="button" className="ck-tile-map__control" aria-label="Zoom in" onClick={() => zoomBy(1)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d={MAP_ICONS.plus} /></svg>
            </button>
            <button type="button" className="ck-tile-map__control" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d={MAP_ICONS.minus} /></svg>
            </button>
          </div>
        </div>
      )}
      {children}
      {attribution && <div className="ck-tile-map__attribution" data-map-ui>{attribution}</div>}
    </div>
  );
}

interface TileLayerProps {
  z: number;
  cam: MapView;
  size: Size;
  tileUrl: TileUrlFn;
  /** Coarser tiles kept underneath while the current level loads. */
  fallback?: boolean;
}

function TileLayer({ z, cam, size, tileUrl, fallback }: TileLayerProps) {
  const scale = 2 ** (cam.zoom - z);
  const c = project(cam.center, z);
  const ax = size.width / 2 - c.x * scale;
  const ay = size.height / 2 - c.y * scale;
  const n = 2 ** z;
  const x0 = Math.floor(-ax / scale / TILE_SIZE);
  const x1 = Math.floor((size.width - ax) / scale / TILE_SIZE);
  const y0 = Math.max(0, Math.floor(-ay / scale / TILE_SIZE));
  const y1 = Math.min(n - 1, Math.floor((size.height - ay) / scale / TILE_SIZE));
  const tiles: ReactNode[] = [];
  if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 120) {
    for (let x = x0; x <= x1; x++) {
      const wx = ((x % n) + n) % n;
      for (let y = y0; y <= y1; y++) {
        const key = `${z}/${wx}/${y}`;
        tiles.push(
          <img
            key={`${x}/${y}`}
            className="ck-tile-map__tile"
            src={tileUrl(z, wx, y)}
            alt=""
            draggable={false}
            decoding="async"
            data-loaded={loadedTiles.has(key) || undefined}
            onLoad={(e) => {
              loadedTiles.add(key);
              e.currentTarget.dataset.loaded = 'true';
            }}
            style={{ transform: `translate(${x * TILE_SIZE}px, ${y * TILE_SIZE}px)` }}
          />,
        );
      }
    }
  }
  return (
    <div
      className="ck-tile-map__layer"
      data-fallback={fallback || undefined}
      style={{ transform: `translate3d(${ax}px, ${ay}px, 0) scale(${scale})` }}
    >
      {tiles}
    </div>
  );
}
