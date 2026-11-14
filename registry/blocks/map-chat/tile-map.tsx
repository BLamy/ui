import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import type { Viewport } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { HoverCard, HoverCardContent, HoverCardTrigger, createHoverCardController } from '@/components/ui/hover-card';
import { PlainButton as Button } from '@/components/ui/plain-button';
import { changeDetails } from '@/lib/change-details';
import { useContainerSize } from '@/lib/container';
import { prefersReducedMotion } from '@/lib/reduced-motion';
import { cn } from '@/lib/utils';
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
import { tileMap, type TileMapViewportChangeDetails } from './tile-map-primitive';

export type { TileMapViewportChangeDetails, TileMapViewportReason } from './tile-map-primitive';

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
  /** The camera moved: `details.reason` says why (`drag`, `pinch`, `wheel`, `zoom-key`, `move-key`, or `imperative` for
   *  the zoom buttons, a double-click and flying to `view`). */
  onViewChange?: (view: MapView, details: TileMapViewportChangeDetails) => void;
  pins?: MapPin[];
  route?: MapRoute | null;
  onPinClick?: (pin: MapPin) => void;
  /**
   * A hover card about a pin (the place it marks), opened while the pointer rests on its marker or label or keyboard
   * focus lands on it, as a maps app previews a place before you pick it. Return nothing for pins without one. Any
   * pan or zoom closes it: the pins move out from under it.
   */
  pinPreview?: (pin: MapPin) => ReactNode;
  /** Fired on a tap that did not pan the map or hit a pin. */
  onMapClick?: () => void;
  /** The map's accessible name. Default "Map". */
  'aria-label'?: string;
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
  /** Enables the gestures (drag, wheel, pinch) and the keys of the focused map (arrows pan, + − zoom, 0 goes back to
   *  `view`). */
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

/** Host font, falling back to the system stack. */
export const MAP_FONT = "font-[family-name:var(--bl-font,-apple-system,BlinkMacSystemFont,'SF_Pro_Text',sans-serif)]";

/** The basemap's own colours per tile set (content, like the tiles): backdrop and ink, the label halo, the glass
    controls that float on the map, and the route halo. Fed to the utilities below as --tile-map-* variables. */
export const TILE_MAP_COLORS = {
  dark: {
    backdrop: '#0d0f14',
    ink: '#f5f5f7',
    label: '#fff',
    labelHalo: '#000',
    labelHaloSoft: 'rgba(0,0,0,.9)',
    glass: 'rgba(24,24,30,.78)',
    glassBorder: 'rgba(255,255,255,.12)',
    glassShadow: 'rgba(0,0,0,.35)',
    glassHover: 'rgba(48,48,58,.85)',
    divider: 'rgba(255,255,255,.1)',
    attribution: 'rgba(10,10,14,.55)',
    attributionInk: 'rgba(255,255,255,.55)',
    routeHalo: 'rgba(255,255,255,.85)',
  },
  light: {
    backdrop: '#eef0f3',
    ink: '#1c1c1e',
    label: '#1c1c1e',
    labelHalo: '#fff',
    labelHaloSoft: 'rgba(255,255,255,.9)',
    glass: 'rgba(255,255,255,.86)',
    glassBorder: 'rgba(0,0,0,.08)',
    glassShadow: 'rgba(0,0,0,.14)',
    glassHover: 'rgba(245,245,247,.95)',
    divider: 'rgba(0,0,0,.08)',
    attribution: 'rgba(255,255,255,.7)',
    attributionInk: 'rgba(0,0,0,.55)',
    routeHalo: 'rgba(255,255,255,.9)',
  },
} as const;

/** The user-location pin and the default pin colour (content: the map's own blue, not the theme accent). */
export const TILE_MAP_USER_BLUE = '#0a84ff';
/** Callout bubble over a pin (content). */
const CALLOUT_FILL = '#1c1c1e';

const tileMapVars = (scheme: 'dark' | 'light') =>
  Object.fromEntries(Object.entries(TILE_MAP_COLORS[scheme]).map(([k, v]) => ['--tile-map-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v])) as CSSProperties;

/* Map chrome, painted from the --tile-map-* colours of the current tile set. */
const CHROME = {
  root: 'bg-(--tile-map-backdrop) text-(--tile-map-ink)',
  label: 'text-(--tile-map-label) [text-shadow:0_0_2px_var(--tile-map-label-halo),0_0_4px_var(--tile-map-label-halo),0_1px_3px_var(--tile-map-label-halo-soft)]',
  glass: 'border-(--tile-map-glass-border) bg-(--tile-map-glass) text-(--tile-map-ink) shadow-[0_6px_18px_var(--tile-map-glass-shadow)]',
  control: 'text-(--tile-map-ink)',
  hover: 'hover:bg-(--tile-map-glass-hover)',
  divider: 'border-t-(--tile-map-divider)',
  attribution: 'bg-(--tile-map-attribution) text-(--tile-map-attribution-ink)',
};

const CONTROL =
  'grid size-10 cursor-pointer place-items-center p-0 [transition:background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';
const PIN_SHADOW_RAISED = 'shadow-[0_4px_12px_rgba(0,0,0,.5),0_0_0_1px_rgba(0,0,0,.25)]';

const FLY_MS = 900;
const loadedTiles = new Set<string>();

interface Size {
  width: number;
  height: number;
}

function ease(t: number) {
  return 1 - (1 - t) ** 3;
}

/* The camera (a center and a zoom level) as UI SDK's viewport over a world of Web Mercator pixels at level 0, and back.
   The viewport's zoom is `2 ** level`; its x, y put the world's origin where the center lands in the middle. */
function toViewport(cam: MapView, size: Size): Viewport {
  const c = project(cam.center, cam.zoom);
  return { x: size.width / 2 - c.x, y: size.height / 2 - c.y, zoom: 2 ** cam.zoom };
}
function fromViewport(vp: Viewport, size: Size): MapView {
  const zoom = Math.log2(vp.zoom);
  return { center: unproject({ x: size.width / 2 - vp.x, y: size.height / 2 - vp.y }, zoom), zoom };
}

export function TileMap({
  view,
  onViewChange,
  pins = [],
  route,
  onPinClick,
  pinPreview,
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
  'aria-label': ariaLabel = 'Map',
}: TileMapProps) {
  // The frame, measured: the camera is a center, so a resize keeps it in the middle.
  const [rootRef, size] = useContainerSize<HTMLDivElement>({ width: 0, height: 0 });
  // One hover card for every pin: each pin is a trigger handing it its id, and the card points at that pin's
  // marker (read on every check, so it follows the pin while the map moves).
  const [card] = useState(() => createHoverCardController<string>());
  const [cardAnchor] = useState(() => ({
    getBoundingClientRect: () => {
      const id = card.getPayload();
      const pin = id == null ? null : rootRef.current?.querySelector<HTMLElement>(`[data-pin="${CSS.escape(id)}"]`);
      const marker = pin?.querySelector<HTMLElement>('[data-slot="tile-map-pin-marker"]') ?? pin;
      return marker?.getBoundingClientRect() ?? { x: 0, y: 0, width: 0, height: 0 };
    },
  }));
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

  const clampView = useCallback(
    (next: MapView): MapView => ({
      center: { lat: clampLat(next.center.lat), lng: ((((next.center.lng + 180) % 360) + 360) % 360) - 180 },
      zoom: Math.max(minZoom, Math.min(maxZoom, next.zoom)),
    }),
    [minZoom, maxZoom],
  );

  const commit = useCallback(
    (next: MapView, details: TileMapViewportChangeDetails = changeDetails({ reason: 'imperative' })) => {
      const clamped = clampView(next);
      camRef.current = clamped;
      setCam(clamped);
      onViewChange?.(clamped, details);
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

  const measured = size.width > 0 && size.height > 0;
  const home = () => flyTo(resolveView(view, sizeRef.current.width, sizeRef.current.height, minZoom, maxZoom));
  useEffect(() => {
    if (!measured) return;
    const target = resolveView(view, sizeRef.current.width, sizeRef.current.height, minZoom, maxZoom);
    flyTo(target, firstFlyRef.current ? 0 : FLY_MS);
    firstFlyRef.current = false;
    // Only the target identity (and the first measurement) should move the camera.
  }, [view, measured]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // Navigation is UI SDK's viewport (tile-map-primitive.ts), always controlled from the camera: a gesture or a key asks
  // for a viewport, and the camera it stands for (wrapped round the world, clamped to the poles and the levels) is
  // committed. Any of them stops a flight and closes the pin's card.
  const handle = usePrimitive(tileMap, {
    viewport: toViewport(cam, size),
    onViewportChange: (next, details) => {
      cancelAnimationFrame(animRef.current);
      if (pinPreview) card.close();
      commit(fromViewport(next, sizeRef.current), details);
    },
    interactive,
    minZoom: 2 ** minZoom,
    maxZoom: 2 ** maxZoom,
    onTap: () => onMapClick?.(),
    onHome: home,
  });

  const zoomAround = useCallback(
    (point: Point, delta: number) => {
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
      flyTo({ center: unproject(next, nextZoom), zoom: nextZoom }, 320);
    },
    [flyTo, minZoom, maxZoom],
  );

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!interactive || (e.target as HTMLElement).closest('[data-map-ui]')) return;
    const rect = rootRef.current?.getBoundingClientRect();
    zoomAround({ x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) }, 1);
  };

  const zoomBy = (delta: number) => zoomAround({ x: size.width / 2, y: size.height / 2 }, delta);

  const toScreen = (p: LatLng): Point => {
    const c = project(cam.center, cam.zoom);
    const q = project(p, cam.zoom);
    return { x: q.x - c.x + size.width / 2, y: q.y - c.y + size.height / 2 };
  };

  const previewOf = (id: string | undefined) => {
    const pin = id == null ? undefined : pins.find((p) => p.id === id);
    return pin ? pinPreview?.(pin) : null;
  };

  const z = Math.round(cam.zoom);
  const ordered = [...pins].sort((a, b) => Number(a.selected ?? false) - Number(b.selected ?? false));
  const tone = CHROME;
  const routePoints = route?.points.map((p) => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ');

  const content = (
    <>
      <div data-slot="tile-map-tiles" className="absolute inset-0 overflow-hidden" aria-hidden style={tileFilter ? { filter: tileFilter } : undefined}>
        {measured && z - 1 >= minZoom && (
          <TileLayer z={z - 1} cam={cam} size={size} tileUrl={tileUrl} fallback />
        )}
        {measured && <TileLayer z={z} cam={cam} size={size} tileUrl={tileUrl} />}
      </div>
      {measured && route && route.points.length > 1 && (
        <svg data-slot="tile-map-route" className="pointer-events-none absolute inset-0 overflow-visible" width={size.width} height={size.height} aria-hidden>
          <polyline fill="none" stroke={TILE_MAP_COLORS[scheme].routeHalo} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" points={routePoints} />
          <polyline
            fill="none"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...(route.color ? { stroke: route.color } : { className: 'stroke-[color:var(--primary)]' })}
            points={routePoints}
          />
        </svg>
      )}
      {measured && (
        <div data-slot="tile-map-pins" className="pointer-events-none absolute inset-0">
          {ordered.map((pin) => {
            const s = toScreen(pin.position);
            const kind = pin.kind ?? 'place';
            const user = kind === 'user';
            /* Raw button: a press on a pin that moves still pans the map (the primitive hands it over past the drag threshold).
               A pin with a preview is the card's trigger. */
            const pinProps = {
              type: 'button' as const,
              'data-slot': 'tile-map-pin',
              'data-pin': pin.id,
              'data-kind': kind,
              'data-selected': pin.selected || undefined,
              className: cn(
                'group/pin pointer-events-none absolute top-0 left-0 flex h-0 w-0 cursor-pointer flex-col items-center gap-[3px] border-0 bg-transparent p-0 [font:inherit] text-white',
                pin.selected && 'z-2',
              ),
              style: {
                transform: `translate3d(${s.x}px, ${s.y}px, 0)`,
                '--ck-pin-color': pin.color ?? (kind === 'stop' ? 'var(--primary)' : TILE_MAP_USER_BLUE),
              } as CSSProperties,
              'aria-label': pin.label ?? pin.id,
              onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                onPinClick?.(pin);
              },
            };
            const marker = (
              <>
                {pin.callout != null && (
                  <span className="pointer-events-auto absolute bottom-[23px] left-1/2 [transform:translateX(-50%)] rounded-ctl bg-(--tile-map-callout) px-2.5 py-[5px] text-footnote leading-[1.1] font-bold tracking-[-.01em] whitespace-nowrap text-white shadow-[0_4px_12px_rgba(0,0,0,.25)] after:absolute after:-bottom-[5px] after:left-1/2 after:size-2.5 after:[transform:translateX(-50%)_rotate(45deg)] after:rounded-[2px] after:bg-inherit">
                    {pin.callout}
                  </span>
                )}
                <span
                  data-slot="tile-map-pin-marker"
                  className={cn(
                    'pointer-events-auto grid shrink-0 place-items-center rounded-[50%] border-solid border-white [transition:transform_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),box-shadow_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-[:hover]/pin:[transform:scale(1.18)] motion-reduce:[transition:none]',
                    user
                      ? '-mt-[9px] size-[18px] animate-[ck-tile-map-pulse_2.4s_ease-out_infinite] border-3 bg-(--tile-map-user) shadow-[0_0_0_6px_color-mix(in_srgb,var(--tile-map-user)_22%,transparent),0_2px_6px_rgba(0,0,0,.45)] motion-reduce:animate-none'
                      : cn(
                          '-mt-[15px] size-[30px] border-[2.5px] bg-(--ck-pin-color) shadow-[0_2px_6px_rgba(0,0,0,.45),0_0_0_1px_rgba(0,0,0,.25)]',
                          'group-[:hover]/pin:shadow-[0_4px_12px_rgba(0,0,0,.5),0_0_0_1px_rgba(0,0,0,.25)]',
                          pin.selected && PIN_SHADOW_RAISED,
                        ),
                    pin.selected && '[transform:scale(1.18)]',
                  )}
                >
                  {user ? null : pin.badge != null ? (
                    <span className="text-footnote leading-none font-bold tracking-[-.02em]">{pin.badge}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={MAP_ICONS[pin.icon ?? 'pin']} />
                    </svg>
                  )}
                </span>
                {pin.label && !user && (
                  <span
                    className={cn(
                      'pointer-events-auto max-w-[150px] shrink-0 overflow-hidden px-0.5 text-center text-caption leading-[1.15] text-ellipsis whitespace-nowrap',
                      pin.selected ? 'font-bold' : 'font-semibold',
                      tone.label,
                    )}
                  >
                    {pin.label}
                  </span>
                )}
              </>
            );
            return pinPreview?.(pin) ? (
              <HoverCardTrigger key={pin.id} controller={card} payload={pin.id} render={<button {...pinProps} />}>
                {marker}
              </HoverCardTrigger>
            ) : (
              <button key={pin.id} {...pinProps}>
                {marker}
              </button>
            );
          })}
        </div>
      )}
      {pinPreview ? (
        <HoverCard controller={card}>
          <HoverCardContent<string> anchor={cardAnchor} side="top" sideOffset={10} arrow>
            {({ payload }) => previewOf(payload)}
          </HoverCardContent>
        </HoverCard>
      ) : null}
      {controls && (
        <div data-slot="tile-map-controls" className="pointer-events-auto absolute top-3.5 right-3.5 z-3 flex flex-col gap-2.5" data-map-ui>
          {onLocate && (
            <Button
              aria-label="Show my location"
              onClick={onLocate}
              className={cn(CONTROL, 'rounded-panel border backdrop-blur-[14px]', tone.glass, tone.control, tone.hover)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={MAP_ICONS.locate} /></svg>
            </Button>
          )}
          <div data-slot="tile-map-zoom" className={cn('flex flex-col overflow-hidden rounded-panel border backdrop-blur-[14px]', tone.glass)}>
            <Button aria-label="Zoom in" onClick={() => zoomBy(1)} className={cn(CONTROL, 'rounded-none border-0 bg-transparent', tone.control, tone.hover)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d={MAP_ICONS.plus} /></svg>
            </Button>
            <Button aria-label="Zoom out" onClick={() => zoomBy(-1)} className={cn(CONTROL, 'rounded-none border-0 border-t bg-transparent', tone.divider, tone.control, tone.hover)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d={MAP_ICONS.minus} /></svg>
            </Button>
          </div>
        </div>
      )}
      {children}
      {attribution && (
        <div
          data-slot="tile-map-attribution"
          className={cn('pointer-events-auto absolute bottom-1.5 left-2 z-3 rounded-md px-1.5 py-0.5 text-[10px] leading-[1.3]', tone.attribution)}
          data-map-ui
        >
          {attribution}
        </div>
      )}
    </>
  );

  return usePart(handle, 'root', {}, {
    ref: rootRef,
    ...{ 'data-scheme': scheme },
    'aria-label': ariaLabel,
    className: cn(
      'relative isolate h-full min-h-0 w-full min-w-0 touch-none overflow-clip outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
      interactive && 'cursor-grab data-dragging:cursor-grabbing',
      MAP_FONT,
      tone.root,
      className,
    ),
    style: { ...tileMapVars(scheme), '--tile-map-callout': CALLOUT_FILL, '--tile-map-user': TILE_MAP_USER_BLUE, ...style } as CSSProperties,
    onDoubleClick,
    children: content,
  }, 'div');
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
            className={cn(
              'pointer-events-none absolute top-0 left-0 size-[256px] opacity-0 [image-rendering:auto] data-loaded:opacity-100',
              fallback ? 'transition-none' : '[transition:opacity_var(--duration-spring-smooth)_var(--ease-spring-smooth)] motion-reduce:transition-none',
            )}
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
      data-slot="tile-map-layer"
      data-fallback={fallback || undefined}
      className="absolute top-0 left-0 origin-top-left will-change-transform"
      style={{ transform: `translate3d(${ax}px, ${ay}px, 0) scale(${scale})` }}
    >
      {tiles}
    </div>
  );
}
