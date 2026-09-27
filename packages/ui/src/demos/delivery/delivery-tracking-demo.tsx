import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Haptics } from '../../lib/haptics';
import { springs } from '../../lib/motion';
import { useAppearance } from '../../lib/theme';
import { Button } from 'react-aria-components';
import { AnimatePresence, motion } from 'framer-motion';
import { FloatingSheet, type FloatingSheetAppearance, type FloatingSheetTone } from '../../components/chat/floating-sheet';
import { ProgressStepper, type ProgressStep } from '../../components/chat/progress-stepper';
import { distanceMeters, type LatLng, type MapTarget } from '../map-chat/geo';
import { MAP_ICONS, type MapIconName } from '../map-chat/map-icons';
import { esriDarkGrayTiles, esriLightGrayTiles, MAP_FONT, TileMap, type MapPin, type MapRoute } from '../map-chat/tile-map';

export interface DeliveryStage {
  id: string;
  /** Milestone label in the stepper. */
  step: string;
  title: string;
  status: string;
  /** How far along the route the customer's car has travelled at this stage. */
  travel: number;
}

export const DELIVERY_STAGES: DeliveryStage[] = [
  { id: 'received', step: 'Order placed', title: 'We got your order', status: 'Sending it to the kitchen…', travel: 0 },
  { id: 'preparing', step: 'Preparing', title: 'Preparing your order', status: 'Your order is being prepared', travel: 0.32 },
  { id: 'ready', step: 'Ready', title: 'Your order is ready', status: 'Head to the counter when you arrive', travel: 0.86 },
  { id: 'picked-up', step: 'Picked up', title: 'Enjoy your meal', status: 'Thanks for ordering with us', travel: 1 },
];

export interface DeliveryTrackingDemoProps {
  /** Order stage to show; leave unset and the demo advances on its own. */
  stage?: number;
  /** Advance through the stages while uncontrolled. */
  autoAdvance?: boolean;
  /** Milliseconds each stage lasts while auto-advancing. */
  stageMs?: number;
  /** Height of the order card resting over the map. */
  peek?: number;
  appearance?: FloatingSheetAppearance;
  /** Light or dark map and sheet. Defaults to the ambient `AppearanceProvider` value, else light. */
  tone?: FloatingSheetTone;
  /** Inset of the sheet from the host edges; `0` docks it like a system sheet. */
  gutter?: number;
  /** Accent for the stepper, pins, and primary button. */
  accent?: string;
  onClose?: () => void;
  className?: string;
  style?: CSSProperties;
}

const STORE: LatLng = { lat: 40.7189, lng: -73.9945 };
const STORE_NAME = 'Bread Alone Bakery';
const STORE_ADDRESS = '199 Grand St';
/* A few blocks of the Lower East Side, driven to the store. */
const ROUTE: LatLng[] = [
  { lat: 40.7231, lng: -73.9879 },
  { lat: 40.7213, lng: -73.9892 },
  { lat: 40.7197, lng: -73.9901 },
  { lat: 40.7181, lng: -73.9913 },
  { lat: 40.7171, lng: -73.9933 },
  { lat: 40.7178, lng: -73.9941 },
  STORE,
];
const STEP_ICONS: MapIconName[] = ['receipt', 'chef', 'bag', 'check'];

const ORDER_ITEMS = [
  { qty: 1, name: 'Sourdough loaf', price: 9.5 },
  { qty: 2, name: 'Almond croissant', price: 5.25 },
  { qty: 1, name: 'Cold brew, large', price: 5.0 },
];

const GIFT_CARDS = [
  { id: 'a', label: 'Happy birthday', gradient: 'linear-gradient(135deg,#ff5f6d,#ffc371)' },
  { id: 'b', label: 'Thank you', gradient: 'linear-gradient(135deg,#43cea2,#185a9d)' },
  { id: 'c', label: 'Dinner on me', gradient: 'linear-gradient(135deg,#7f53ac,#647dee)' },
  { id: 'd', label: 'Congrats', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)' },
];

/** `font: inherit` for buttons, leaving size and weight to the caller. */
const FONT_INHERIT = '[font-family:inherit] [font-style:inherit] [font-variant:inherit] [font-stretch:inherit] leading-[inherit]';
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bl-tint';
const MAP_BUTTON = cn(
  'pointer-events-auto inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 rounded-[999px] border-0 bg-white p-0 text-[15px] font-semibold text-[#191919] shadow-[0_2px_10px_rgba(0,0,0,.14),0_0_0_1px_rgba(0,0,0,.04)] data-hovered:bg-[#f6f6f8]',
  FONT_INHERIT,
  FOCUS_RING,
);
const MAP_BUTTON_DARK = cn(
  'pointer-events-auto inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 rounded-[999px] border-0 bg-[#1c1c1e] p-0 text-[15px] font-semibold text-[#f5f5f7] shadow-[0_2px_10px_rgba(0,0,0,.4),0_0_0_1px_rgba(255,255,255,.08)] data-hovered:bg-[#2c2c2e]',
  FONT_INHERIT,
  FOCUS_RING,
);
const ACTION_BUTTON = cn(
  'inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[999px] border-0 px-3.5 py-0 text-[15px] font-bold [transition:transform_var(--duration-spring-snappy)_var(--ease-spring-snappy),filter_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-pressed:[transform:scale(.97)]',
  FONT_INHERIT,
  FOCUS_RING,
);
const CAROUSEL = '-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function Icon({ name, size = 18 }: { name: MapIconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={MAP_ICONS[name]} />
    </svg>
  );
}

/** Point `t` (0–1) of the way along a polyline, by distance. */
function alongRoute(points: LatLng[], t: number): LatLng {
  const legs = points.slice(1).map((p, i) => distanceMeters(points[i], p));
  const total = legs.reduce((a, b) => a + b, 0);
  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < legs.length; i++) {
    if (remaining <= legs[i] || i === legs.length - 1) {
      const f = legs[i] === 0 ? 1 : Math.min(1, remaining / legs[i]);
      const a = points[i];
      const b = points[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    remaining -= legs[i];
  }
  return points[points.length - 1];
}

/** Eases a number toward its target over `ms`, so the car glides between stages. */
function useTween(target: number, ms = 1400) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/**
 * A DoorDash-style order tracker: a light TileMap under an opaque FloatingSheet that rests
 * at `peek` with the order status and grows into the full page. Everything on the sheet is
 * plain composable content — the stepper, cards and carousel are siblings the host can
 * reorder or replace.
 */
export function DeliveryTrackingDemo({
  stage: controlledStage,
  autoAdvance = true,
  stageMs = 6500,
  peek = 344,
  appearance = 'sheet',
  tone: toneProp,
  gutter = 0,
  accent = '#eb1700',
  onClose,
  className,
  style,
}: DeliveryTrackingDemoProps) {
  const ambient = useAppearance();
  const tone: FloatingSheetTone = toneProp ?? ambient ?? 'light';
  const dark = tone === 'dark';
  const mapButton = dark ? MAP_BUTTON_DARK : MAP_BUTTON;
  const [uncontrolledStage, setUncontrolledStage] = useState(1);
  const stageIndex = Math.max(0, Math.min(DELIVERY_STAGES.length - 1, controlledStage ?? uncontrolledStage));
  const stage = DELIVERY_STAGES[stageIndex];
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();

  useEffect(() => {
    if (controlledStage != null || !autoAdvance) return;
    const timer = setInterval(() => {
      setUncontrolledStage((s) => (s + 1) % DELIVERY_STAGES.length);
    }, stageMs);
    return () => clearInterval(timer);
  }, [controlledStage, autoAdvance, stageMs]);

  const travel = useTween(stage.travel);
  const car = useMemo(() => alongRoute(ROUTE, travel), [travel]);
  const remainingMeters = useMemo(() => {
    const legs = ROUTE.slice(1).map((p, i) => distanceMeters(ROUTE[i], p));
    return legs.reduce((a, b) => a + b, 0) * (1 - travel);
  }, [travel]);
  const etaMinutes = Math.max(1, Math.round(remainingMeters / 250));
  const arrived = stage.travel >= 1;

  const view = useMemo<MapTarget>(
    () => ({ bounds: ROUTE, padding: { top: 84, right: 56, bottom: peek + 72, left: 56 }, maxZoom: 16 }),
    [peek],
  );

  const pins: MapPin[] = [
    { id: 'store', position: STORE, kind: 'place', icon: 'store', color: accent, label: STORE_NAME },
    ...(arrived
      ? []
      : [{ id: 'car', position: car, kind: 'place' as const, icon: 'car' as const, color: dark ? '#3a3a3c' : '#1c1c1e', callout: `${etaMinutes} min` }]),
  ];
  const route: MapRoute = { points: ROUTE, color: dark ? '#f5f5f7' : '#1c1c1e' };

  const steps: ProgressStep[] = DELIVERY_STAGES.map((s, i) => ({ id: s.id, label: s.step, icon: <Icon name={STEP_ICONS[i]} size={16} /> }));

  const total = ORDER_ITEMS.reduce((sum, item) => sum + item.qty * item.price, 0);

  return (
    <div
      data-slot="delivery-tracking-demo"
      data-stage={stage.id}
      className={cn(
        'relative h-full min-h-0 w-full overflow-hidden',
        dark
          ? 'bg-[#0d0f14] text-[#f5f5f7] scheme-dark [--bl-bg:#000] [--bl-card:#1c1c1e] [--bl-card2:#2c2c2e] [--bl-label:#f5f5f7] [--bl-label2:rgba(235,235,245,.62)] [--bl-label3:rgba(235,235,245,.32)] [--bl-sep:rgba(84,84,88,.6)] [--bl-fill:rgba(120,120,128,.24)]'
          : 'bg-[#eef0f3] text-[#191919] scheme-light [--bl-bg:#f2f2f7] [--bl-card:#fff] [--bl-card2:#f4f4f6] [--bl-label:#191919] [--bl-label2:rgba(60,60,67,.62)] [--bl-label3:rgba(60,60,67,.32)] [--bl-sep:rgba(60,60,67,.16)] [--bl-fill:rgba(120,120,128,.14)]',
        '[--bl-tint:var(--ck-delivery-accent,#eb1700)]',
        MAP_FONT,
        className,
      )}
      style={{ '--ck-delivery-accent': accent, ...style } as CSSProperties}
    >
      <TileMap
        className="absolute inset-0"
        view={view}
        pins={pins}
        route={route}
        tileUrl={dark ? esriDarkGrayTiles : esriLightGrayTiles}
        scheme={dark ? 'dark' : 'light'}
        tileFilter={dark ? 'brightness(.72) saturate(.85) contrast(1.05)' : undefined}
        minZoom={12}
        maxZoom={16}
      >
        <div className="pointer-events-none absolute top-3.5 right-3.5 left-3.5 z-4 flex items-center justify-between" data-map-ui>
          <Button className={mapButton} aria-label="Close" onPress={onClose}>
            <Icon name="x" size={20} />
          </Button>
          <Button className={cn(mapButton, 'pr-3.5 pl-3')}>
            <Icon name="help" size={18} />
            Help
          </Button>
        </div>
      </TileMap>

      <FloatingSheet
        open={open}
        onOpenChange={setOpen}
        peek={peek}
        gutter={gutter}
        radius={20}
        appearance={appearance}
        tone={tone}
        bodyAlign="start"
        minimizable={false}
        scrim={false}
        hideOnScroll={false}
        label="Order status"
      >
        <FloatingSheet.Body>
          <div className="ck-scroll box-border h-full min-h-0! overflow-x-hidden overflow-y-auto px-5 pt-0.5 pb-8">
            <header className="mb-[18px]">
              {/* A new stage moves forward: the old title leaves up, the new one rises in (and the header's
                  height follows). */}
              <h2 className="relative m-0 text-[24px] leading-[1.2] font-bold tracking-[-.02em]">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={stage.title}
                    className="block"
                    initial={{ y: 18, opacity: 0, filter: 'blur(3px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -18, opacity: 0, filter: 'blur(3px)' }}
                    transition={springs.smooth}
                  >
                    {stage.title}
                  </motion.span>
                </AnimatePresence>
              </h2>
              <p className="m-0 mt-1.5 text-[15px] text-bl-label2">
                Pickup at 12:13 PM · {STORE_ADDRESS}
              </p>
            </header>

            <ProgressStepper steps={steps} current={stageIndex} className="mb-3!" />
            <p className="m-0 mb-[18px] flex items-center gap-[7px] text-[14px] text-bl-label2">
              <Icon name="clock" size={15} />
              {/* The status moves forward with the stepper: the old line leaves up, the new one rises. */}
              <span className="relative min-w-0 flex-1 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={stage.status}
                    className="block"
                    initial={{ y: 14, opacity: 0, filter: 'blur(2px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -14, opacity: 0, filter: 'blur(2px)' }}
                    transition={springs.smooth}
                  >
                    {stage.status}
                  </motion.span>
                </AnimatePresence>
              </span>
            </p>

            <section className="rounded-[14px] bg-bl-card2 p-4">
              <h3 className="m-0 mb-1 text-[16px] font-bold">Pickup instructions</h3>
              <p className="m-0 mb-3.5 text-[14px] leading-[1.4] text-bl-label2">
                Head to the counter and give your name. Orders are on the shelf to the right of the register.
              </p>
              <div className="flex gap-2.5">
                <Button
                  className={cn(ACTION_BUTTON, 'bg-[color:var(--ck-delivery-accent,#eb1700)] text-white data-hovered:[filter:brightness(1.06)]')}
                  data-variant="primary"
                  onPress={() => {
                    Haptics.selection();
                    if (controlledStage == null) setUncontrolledStage(3);
                  }}
                >
                  <Icon name="message" size={17} />
                  I'm here
                </Button>
                <Button className={cn(ACTION_BUTTON, 'bg-[rgba(120,120,128,.16)] text-bl-label')} data-variant="secondary">
                  <Icon name="phone" size={17} />
                  Call store
                </Button>
              </div>
            </section>

            <Button
              className={cn(
                'm-0 mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-[999px] border border-bl-sep bg-transparent px-3.5 py-[9px] text-[14px] font-semibold text-bl-label data-hovered:bg-bl-fill',
                FONT_INHERIT,
              )}
              aria-expanded={detailsOpen}
              aria-controls={detailsOpen ? detailsId : undefined}
              onPress={() => {
                Haptics.selection();
                setDetailsOpen((v) => !v);
              }}
            >
              Order details
              <span
                className={cn('grid place-items-center [transition:transform_var(--duration-spring-bouncy)_var(--ease-spring-bouncy)] motion-reduce:transition-none', detailsOpen && '[transform:rotate(180deg)]')}
                data-open={detailsOpen || undefined}
              >
                <Icon name="chevronDown" size={16} />
              </span>
            </Button>
            {/* The details open as a height morph (the sheet's body grows with them). */}
            <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.ul
                key="details"
                id={detailsId}
                className="m-0 mt-3 list-none overflow-hidden border-t border-bl-sep p-0 pt-1"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={springs.tray}
              >
                {ORDER_ITEMS.map((item) => (
                  <li key={item.name} className="flex gap-2.5 border-b border-bl-sep py-[9px] text-[14px]">
                    <span className="w-6 text-bl-label2">{item.qty}×</span>
                    <span className="min-w-0 flex-1">{item.name}</span>
                    <span className="tabular-nums">${(item.qty * item.price).toFixed(2)}</span>
                  </li>
                ))}
                <li className="flex gap-2.5 py-[9px] text-[14px] font-bold" data-total>
                  <span className="min-w-0 flex-1">Total</span>
                  <span className="tabular-nums">${total.toFixed(2)}</span>
                </li>
              </motion.ul>
            )}
            </AnimatePresence>

            <Button
              className={cn(
                'm-0 mt-[18px] flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-0 bg-bl-card2 px-3.5 py-3 text-left text-[15px] font-semibold text-bl-label',
                dark ? 'data-hovered:bg-[#3a3a3c]' : 'data-hovered:bg-[#ededf0]',
                FONT_INHERIT,
              )}
              onPress={() => setOpen(true)}
            >
              <span className={cn('grid size-8 place-items-center rounded-[50%] text-[color:var(--ck-delivery-accent,#eb1700)] shadow-[0_0_0_1px_var(--bl-sep)]', dark ? 'bg-[#1c1c1e]' : 'bg-white')}>
                <Icon name="gift" size={18} />
              </span>
              <span className="min-w-0 flex-1">Save up to $25 on gift cards</span>
              <Icon name="chevronRight" size={18} />
            </Button>

            <Section title="Gift cards" action="See all">
              <div className={CAROUSEL}>
                {GIFT_CARDS.map((card) => (
                  <Button
                    key={card.id}
                    className="flex h-[104px] w-[168px] shrink-0 cursor-pointer snap-start flex-col justify-between rounded-[14px] border-0 [background:var(--ck-gift-bg)] px-3.5 py-3 text-left [font:inherit] text-white shadow-[0_6px_18px_rgba(0,0,0,.14)]"
                    style={{ '--ck-gift-bg': card.gradient } as CSSProperties}
                  >
                    <span className="text-[11px] font-bold tracking-[.06em] uppercase opacity-85">DoorDash</span>
                    <span className="text-[17px] font-bold tracking-[-.01em]">{card.label}</span>
                  </Button>
                ))}
              </div>
            </Section>

            <Section title="From this store" action="Browse menu">
              <div className={CAROUSEL}>
                {['Morning bun', 'Baguette', 'Olive focaccia', 'Seeded rye'].map((name, i) => (
                  <div key={name} className="flex w-[136px] shrink-0 snap-start flex-col gap-1">
                    <div
                      className="aspect-[1.15] w-full rounded-[12px] [background:var(--ck-tile-bg)]"
                      style={{ '--ck-tile-bg': `hsl(${28 + i * 9} 62% ${66 - i * 4}%)` } as CSSProperties}
                    />
                    <span className="mt-1 text-[14px] font-semibold">{name}</span>
                    <span className="text-[13px] text-bl-label2">${(4 + i * 1.5).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </FloatingSheet.Body>
      </FloatingSheet>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <section className="mt-[26px]">
      <header className="m-0 mb-3 flex items-center justify-between">
        <h3 className="m-0 text-[19px] font-bold tracking-[-.015em]">{title}</h3>
        {action && (
          <Button className={cn('inline-flex cursor-pointer items-center gap-0.5 border-0 bg-transparent p-0 text-[14px] font-semibold text-bl-label2', FONT_INHERIT)}>
            {action}
            <Icon name="chevronRight" size={15} />
          </Button>
        )}
      </header>
      {children}
    </section>
  );
}
