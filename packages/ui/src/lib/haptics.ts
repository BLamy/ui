/* ══ Haptics engine ══
   One API (impact / selection / notification), two output paths:

   • navigator.vibrate — Android Chrome and other browsers that ship the Vibration API. Every request is played
     as its pattern, immediately.

   • Safari switch — iOS 18+ Safari (and every iOS browser, all WebKit) and macOS Safari. WebKit has no
     Vibration API, but it plays the system "switch" haptic when an <input type="checkbox" switch> is toggled from
     a user gesture. The engine keeps ONE visually hidden <label><input switch></label> pair, created on first use,
     and clicks the label while the page is handling a trusted gesture. Rules that follow from that:
       – A tick needs a live gesture: a trusted click, keydown/keyup, input/change (e.g. a native range being
         dragged), submit, a mouse pointerdown, or the pointerup that ends a drag. Requests made just before the
         gesture can play (react-aria's onPress runs on pointerup, before the click) or asynchronously (timers, rAF)
         are held and played at the next click / drag-ending pointerup (capture phase, passive), or dropped after
         HOLD_MS — never played late.
       – Requests made mid-drag (pointermove, touchmove, wheel, scroll) have no gesture: iOS can't tick there, so
         they are dropped rather than faked with overlays.
       – One tick per gesture. Notification patterns become up to three ticks spaced like the Android pattern, while
         the activation lasts; there is no intensity or duration control — every tick is the same system click.
   The engine never adds overlays, never intercepts, forwards, cancels or re-dispatches page events. The only events
   it stops are its own synthetic click/input/change on the hidden pair, so page listeners (react-aria's focus-visible
   tracking, click-outside handlers) never see them. The hidden switch is inert, so clicking it can't move focus,
   scroll, or close the software keyboard. Nothing runs at import time; the DOM pair and listeners are created on
   first use, and everything is SSR-safe. */

export interface HapticEvent {
  kind: 'impact' | 'selection' | 'notification';
  label: string;
  w: number;
  t?: number;
  n?: number;
}

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationKind = 'success' | 'warning' | 'error';

export const PAT: Record<string, number[]> = {
  light: [8], medium: [16], heavy: [28], selection: [4],
  success: [10, 80, 14], warning: [14, 90, 10, 60, 10], error: [10, 55, 10, 55, 24],
};

type Engine = 'vibrate' | 'switch' | 'none';

/** A held request is dropped if no gesture arrives within this window. */
const HOLD_MS = 350;
/** Pointer travel beyond which a pointerup ends a drag (no click will follow). */
const SLOP = 10;
/** Most ticks a pattern becomes on the switch path. */
const MAX_TICKS = 3;
/** Events whose trusted dispatch lets the switch tick. */
const GESTURES = new Set(['click', 'keydown', 'keyup', 'input', 'change', 'submit']);
/** Mid-drag phases: the switch can't tick here, so requests are dropped instead of held. */
const DRAG = new Set(['pointermove', 'touchmove', 'mousemove', 'wheel', 'scroll', 'drag']);
const STORE = 'bl-ui:haptics';

const hasWindow = () => typeof window !== 'undefined' && typeof document !== 'undefined';

let engine: Engine | null = null;
function detect(): Engine {
  if (engine) return engine;
  if (!hasWindow()) return 'none';
  if (typeof navigator.vibrate === 'function') engine = 'vibrate';
  else if ('switch' in HTMLInputElement.prototype) engine = 'switch';
  else engine = 'none';
  return engine;
}

/* ── Switch path state ── */
let pair: { label: HTMLLabelElement; input: HTMLInputElement } | null = null;
/** True while the engine is clicking its own switch; its synthetic events are stopped at window capture. */
let playing = false;
/** Gesture currently being dispatched (cleared after its task ends). */
let gate: { ev: Event; range: boolean } | null = null;
/** Increments per pointerdown / keydown: one tick per tap or key press. */
let seq = 0;
let playedSeq = -1;
let down: { id: number; x: number; y: number } | null = null;
let moved = false;
let held: { ticks: number[]; w: number } | null = null;
let heldTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function activationOk() {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return ua ? ua.isActive : true;
}

function ensurePair() {
  if (pair && pair.label.isConnected) return pair;
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  // Inert: the label click can't focus it (which would blur a text field and close the keyboard).
  input.inert = true;
  label.setAttribute('aria-hidden', 'true');
  label.setAttribute('data-bl-haptics', '');
  label.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden;'
    + 'clip-path:inset(50%);white-space:nowrap;pointer-events:none;contain:strict;z-index:-1';
  label.appendChild(input);
  document.body.appendChild(label);
  pair = { label, input };
  return pair;
}

function clickSwitch() {
  const p = ensurePair();
  const prev = document.activeElement as HTMLElement | null;
  playing = true;
  try { p.label.click(); } finally { playing = false; }
  // Belt and braces: should a WebKit ever focus the inert switch, hand focus straight back.
  if (document.activeElement === p.input) {
    if (prev && prev !== p.input && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
    else p.input.blur();
  }
}

/** Tick offsets (ms) for a pattern: each pulse starts after the previous pulse and its gap. */
function ticksFor(p: number[]) {
  const out = [0];
  let t = 0;
  for (let i = 1; i < p.length - 1 && out.length < MAX_TICKS; i += 2) {
    t += p[i - 1] + p[i];
    out.push(t);
  }
  return out;
}

function playTicks(ticks: number[]) {
  playedSeq = seq;
  clickSwitch();
  // Later ticks ride the same gesture: WebKit forwards a gesture to timers scheduled inside it (up to ~1s).
  for (const at of ticks.slice(1)) setTimeout(() => { if (activationOk()) clickSwitch(); }, at);
}

function flushHeld() {
  clearTimeout(heldTimer);
  const h = held;
  held = null;
  if (h && playedSeq !== seq && activationOk()) playTicks(h.ticks);
}

function openGate(e: Event, range = false) {
  gate = { ev: e, range };
  setTimeout(() => { if (gate?.ev === e) gate = null; }, 0);
}

/* Passive capture listeners on window. They only observe; the one exception stops the engine's own synthetic
   events so the page never sees the hidden switch toggle. */
function onOwn(e: Event) {
  if (playing && pair && (e.target === pair.label || e.target === pair.input)) e.stopImmediatePropagation();
}
function onGesture(e: Event) {
  if (!e.isTrusted || (pair && (e.target === pair.label || e.target === pair.input))) return;
  if (e.type === 'keydown') seq++;
  const t = e.target as HTMLInputElement | null;
  openGate(e, e.type === 'input' && t?.type === 'range');
  if (e.type === 'click') flushHeld();
}
function onPointerDown(e: PointerEvent) {
  if (!e.isTrusted || !e.isPrimary) return;
  seq++;
  down = { id: e.pointerId, x: e.clientX, y: e.clientY };
  moved = false;
  // A mouse / trackpad press is itself a gesture (macOS Safari); a touch isn't until it ends.
  if (e.pointerType === 'mouse') openGate(e);
}
function onPointerMove(e: PointerEvent) {
  if (down && e.pointerId === down.id && !moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > SLOP) moved = true;
}
function onPointerUp(e: PointerEvent) {
  if (!e.isTrusted || !down || e.pointerId !== down.id) return;
  down = null;
  // A tap is followed by a click, which plays anything held. A drag gets no click: its release is the gesture.
  if (moved) { openGate(e); flushHeld(); }
}

function listen() {
  if (listening || !hasWindow()) return;
  listening = true;
  const opts = { capture: true, passive: true } as const;
  for (const t of ['click', 'input', 'change']) window.addEventListener(t, onOwn, opts);
  for (const t of GESTURES) window.addEventListener(t, onGesture, opts);
  window.addEventListener('pointerdown', onPointerDown, opts);
  window.addEventListener('pointermove', onPointerMove, opts);
  window.addEventListener('pointerup', onPointerUp, opts);
  window.addEventListener('pointercancel', () => { down = null; }, opts);
}

function requestSwitch(p: number[], w: number, cold: boolean) {
  const ticks = ticksFor(p);
  const ev = window.event;
  const phase = ev?.type;
  // The very first request can arrive inside a gesture the listeners (installed just now) never saw: a trusted
  // gesture event, or a synthetic one a gesture's default action dispatched (a label forwarding its click).
  if (!gate && ev && (ev.isTrusted ? GESTURES.has(ev.type) : cold)) openGate(ev);
  if (gate && activationOk()) {
    // One tick per tap / key press; a dragged native range ticks on each of its input events.
    if (gate.range || playedSeq !== seq) playTicks(ticks);
    return;
  }
  if (phase && DRAG.has(phase)) return;
  // Too early (touch pointerdown / pointerup before the click) or async: hold for the next gesture.
  if (!held || w > held.w || ticks.length > held.ticks.length) held = { ticks, w };
  clearTimeout(heldTimer);
  heldTimer = setTimeout(() => { held = null; }, HOLD_MS);
}

function readStored() {
  try { return hasWindow() ? window.localStorage.getItem(STORE) !== 'off' : true; } catch { return true; }
}

let enabled: boolean | null = null;

export const Haptics = {
  _subs: new Set<(m: HapticEvent) => void>(),
  /** Master switch, persisted in localStorage. Off means no output and no events. */
  get enabled(): boolean {
    if (enabled === null) enabled = readStored();
    return enabled;
  },
  set enabled(v: boolean) {
    enabled = !!v;
    try { if (hasWindow()) window.localStorage.setItem(STORE, enabled ? 'on' : 'off'); } catch { /* private mode */ }
  },
  /** The live output path, for indicators and settings screens. */
  get engine(): string {
    const e = detect();
    return e === 'vibrate' ? 'navigator.vibrate() · native'
      : e === 'switch' ? 'switch haptic · Safari (tap-only)'
      : 'no vibration API';
  },
  get info(): Record<string, unknown> {
    if (!hasWindow()) return { engine: 'none' };
    return {
      engine: detect(),
      vibrate: typeof navigator.vibrate === 'function',
      switchInput: 'switch' in HTMLInputElement.prototype,
      userActivation: 'userActivation' in navigator,
    };
  },
  /** Installs the gesture listeners. Called on first use; call it early (e.g. on mount) so the very first
      press-time request finds its click. */
  boot() {
    if (detect() === 'switch') listen();
  },
  _run(p: number[], meta: HapticEvent) {
    if (!this.enabled || !hasWindow()) return;
    meta.t = performance.now();
    this._subs.forEach((f) => { try { f(meta); } catch { /* noop */ } });
    const e = detect();
    if (e === 'vibrate') {
      try { navigator.vibrate(p); } catch { /* noop */ }
    } else if (e === 'switch') {
      const cold = !listening;
      listen();
      requestSwitch(p, meta.w, cold);
    }
  },
  impact(s?: HapticImpactStyle) {
    s = s || 'medium';
    this._run(PAT[s] || PAT['medium'], { kind: 'impact', label: 'impact · ' + s, w: s === 'heavy' ? 3 : s === 'medium' ? 2 : 1 });
  },
  selection() { this._run(PAT['selection'], { kind: 'selection', label: 'selection tick', w: 1 }); },
  notification(k?: HapticNotificationKind) {
    k = k || 'success';
    this._run(PAT[k] || PAT['success'], { kind: 'notification', label: 'notify · ' + k, w: 3 });
  },
  on(f: (m: HapticEvent) => void) { this._subs.add(f); return () => { this._subs.delete(f); }; },
};

// Devtools / test hook (a property assignment, no other work at import).
if (typeof window !== 'undefined') (window as unknown as { __BL_HAPTICS__?: typeof Haptics }).__BL_HAPTICS__ = Haptics;
