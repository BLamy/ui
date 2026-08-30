import 'ios-vibrator-pro-max';

/* ══ Haptics engine ══
   Android/Chrome: native navigator.vibrate(). iOS/macOS Safari: ios-vibrator-pro-max implements
   navigator.vibrate by layering hidden <input switch> controls over the page:
   real taps toggle a switch natively (system haptic), and during drags an overlay switch rides under the finger
   and flips position so the browser registers toggle after toggle. iOS 18.4+ only grants vibration ~1s after a
   real click; the polyfill owns all of that. It is imported synchronously with this module so its click-passthrough
   layer can wrap interactive elements before the first user gesture. */

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

export const Haptics = {
  enabled: true,
  _subs: new Set<(m: HapticEvent) => void>(),
  _booted: false,
  engine: 'booting…',
  info: {} as Record<string, unknown>,
  boot() {
    if (this._booted) return;
    this._booted = true;
    const ua = navigator.userAgent || '';
    const safari = /Safari\//.test(ua) && !/Chrom|CriOS|FxiOS|EdgiOS|Android/.test(ua);
    this.info = { safari, hadVibrate: typeof navigator.vibrate === 'function', ownVibrate: Object.prototype.hasOwnProperty.call(navigator, 'vibrate') };
    if (!safari) { this.engine = typeof navigator.vibrate === 'function' ? 'navigator.vibrate() · native' : 'no vibration API'; return; }
    this.engine = typeof navigator.vibrate === 'function'
      ? 'vibrate() · ios-vibrator-pro-max@3.0.3'
      : 'no vibration API · unsupported Safari version';
  },
  _run(p: number[], meta: HapticEvent) {
    if (!this.enabled) return;
    meta.t = performance.now(); this._subs.forEach(f => { try { f(meta); } catch { /* noop */ } });
    this.boot();
    try { if (typeof navigator.vibrate === 'function' && navigator.vibrate(p) !== false) return; } catch { /* noop */ }
  },
  impact(s?: HapticImpactStyle) {
    s = s || 'medium';
    this._run(PAT[s] || PAT['medium'], { kind: 'impact', label: 'impact · ' + s, w: s === 'heavy' ? 3 : s === 'medium' ? 2 : 1 });
  },
  _eager: null as unknown,
  selection() { this._run(PAT['selection'], { kind: 'selection', label: 'selection tick', w: 1 }); },
  notification(k?: HapticNotificationKind) {
    k = k || 'success';
    this._run(PAT[k] || PAT['success'], { kind: 'notification', label: 'notify · ' + k, w: 3 });
  },
  on(f: (m: HapticEvent) => void) { this._subs.add(f); return () => { this._subs.delete(f); }; },
};

/* Eager boot: the polyfill must wrap the DOM BEFORE the first real click/drag so macOS Safari
   (trackpad Taptic) and iOS get trusted-gesture haptics — lazy boot missed the gesture it needed. */
if (typeof window !== 'undefined') Haptics.boot();
