import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Haptics } from '@touchkit/ui';
import { cn } from '../../lib/cn';
import { FloatingSheet, type FloatingSheetAppearance, type FloatingSheetTone } from '../../lib/floating-sheet';
import { ProgressStepper, type ProgressStep } from '../../lib/progress-stepper';
import { distanceMeters, type LatLng, type MapTarget } from '../map-chat/geo';
import { MAP_ICONS, type MapIconName } from '../map-chat/map-icons';
import { esriLightGrayTiles, TileMap, type MapPin, type MapRoute } from '../map-chat/tile-map';

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
  tone = 'light',
  gutter = 0,
  accent = '#eb1700',
  onClose,
  className,
  style,
}: DeliveryTrackingDemoProps) {
  const [uncontrolledStage, setUncontrolledStage] = useState(1);
  const stageIndex = Math.max(0, Math.min(DELIVERY_STAGES.length - 1, controlledStage ?? uncontrolledStage));
  const stage = DELIVERY_STAGES[stageIndex];
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      : [{ id: 'car', position: car, kind: 'place' as const, icon: 'car' as const, color: '#1c1c1e', callout: `${etaMinutes} min` }]),
  ];
  const route: MapRoute = { points: ROUTE, color: '#1c1c1e' };

  const steps: ProgressStep[] = DELIVERY_STAGES.map((s, i) => ({ id: s.id, label: s.step, icon: <Icon name={STEP_ICONS[i]} size={16} /> }));

  const total = ORDER_ITEMS.reduce((sum, item) => sum + item.qty * item.price, 0);

  return (
    <div
      data-slot="delivery-tracking-demo"
      data-stage={stage.id}
      className={cn('ck-delivery', className)}
      style={{ '--ck-delivery-accent': accent, ...style } as CSSProperties}
    >
      <TileMap
        className="ck-delivery__map"
        view={view}
        pins={pins}
        route={route}
        tileUrl={esriLightGrayTiles}
        scheme="light"
        minZoom={12}
        maxZoom={16}
      >
        <div className="ck-delivery__map-bar" data-map-ui>
          <button type="button" className="ck-delivery__map-button" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
          <button type="button" className="ck-delivery__map-button ck-delivery__map-button--pill">
            <Icon name="help" size={18} />
            Help
          </button>
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
        className="ck-delivery__sheet"
      >
        <FloatingSheet.Body>
          <div className="ck-delivery__body ck-scroll">
            <header className="ck-delivery__header">
              <h2 className="ck-delivery__title">{stage.title}</h2>
              <p className="ck-delivery__subtitle">
                Pickup at 12:13 PM · {STORE_ADDRESS}
              </p>
            </header>

            <ProgressStepper steps={steps} current={stageIndex} className="ck-delivery__stepper" />
            <p className="ck-delivery__status">
              <Icon name="clock" size={15} />
              {stage.status}
            </p>

            <section className="ck-delivery__card">
              <h3 className="ck-delivery__card-title">Pickup instructions</h3>
              <p className="ck-delivery__card-text">
                Head to the counter and give your name. Orders are on the shelf to the right of the register.
              </p>
              <div className="ck-delivery__actions">
                <button
                  type="button"
                  className="ck-delivery__button"
                  data-variant="primary"
                  onClick={() => {
                    Haptics.selection();
                    if (controlledStage == null) setUncontrolledStage(3);
                  }}
                >
                  <Icon name="message" size={17} />
                  I'm here
                </button>
                <button type="button" className="ck-delivery__button" data-variant="secondary">
                  <Icon name="phone" size={17} />
                  Call store
                </button>
              </div>
            </section>

            <button
              type="button"
              className="ck-delivery__disclosure"
              aria-expanded={detailsOpen}
              onClick={() => {
                Haptics.selection();
                setDetailsOpen((v) => !v);
              }}
            >
              Order details
              <span className="ck-delivery__chevron" data-open={detailsOpen || undefined}>
                <Icon name="chevronDown" size={16} />
              </span>
            </button>
            {detailsOpen && (
              <ul className="ck-delivery__items">
                {ORDER_ITEMS.map((item) => (
                  <li key={item.name} className="ck-delivery__item">
                    <span className="ck-delivery__item-qty">{item.qty}×</span>
                    <span className="ck-delivery__item-name">{item.name}</span>
                    <span className="ck-delivery__item-price">${(item.qty * item.price).toFixed(2)}</span>
                  </li>
                ))}
                <li className="ck-delivery__item" data-total>
                  <span className="ck-delivery__item-name">Total</span>
                  <span className="ck-delivery__item-price">${total.toFixed(2)}</span>
                </li>
              </ul>
            )}

            <button type="button" className="ck-delivery__promo" onClick={() => setOpen(true)}>
              <span className="ck-delivery__promo-icon">
                <Icon name="gift" size={18} />
              </span>
              <span className="ck-delivery__promo-text">Save up to $25 on gift cards</span>
              <Icon name="chevronRight" size={18} />
            </button>

            <Section title="Gift cards" action="See all">
              <div className="ck-delivery__carousel ck-scroll">
                {GIFT_CARDS.map((card) => (
                  <button key={card.id} type="button" className="ck-delivery__gift" style={{ background: card.gradient }}>
                    <span className="ck-delivery__gift-brand">DoorDash</span>
                    <span className="ck-delivery__gift-label">{card.label}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="From this store" action="Browse menu">
              <div className="ck-delivery__carousel ck-scroll">
                {['Morning bun', 'Baguette', 'Olive focaccia', 'Seeded rye'].map((name, i) => (
                  <div key={name} className="ck-delivery__tile">
                    <div className="ck-delivery__tile-image" style={{ background: `hsl(${28 + i * 9} 62% ${66 - i * 4}%)` }} />
                    <span className="ck-delivery__tile-name">{name}</span>
                    <span className="ck-delivery__tile-meta">${(4 + i * 1.5).toFixed(2)}</span>
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
    <section className="ck-delivery__section">
      <header className="ck-delivery__section-head">
        <h3 className="ck-delivery__section-title">{title}</h3>
        {action && (
          <button type="button" className="ck-delivery__section-action">
            {action}
            <Icon name="chevronRight" size={15} />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
