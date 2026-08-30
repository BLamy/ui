/* ══ Haptics engine ══
   Android/Chrome: native navigator.vibrate(). iOS/macOS Safari: we load ios-vibrator-pro-max — the vibrator.dev
   polyfill — which implements navigator.vibrate by layering hidden <input switch> controls over the page:
   real taps toggle a switch natively (system haptic), and during drags an overlay switch rides under the finger
   and flips position so the browser registers toggle after toggle. iOS 18.4+ only grants vibration ~1s after a
   real click; the polyfill owns all of that. If the CDN import fails we click our own in-viewport switch. */

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
  _sw: null as HTMLLabelElement | null,
  _booted: false,
  engine: 'booting…',
  info: {} as Record<string, unknown>,
  boot() {
    if (this._booted) return;
    this._booted = true;
    const ua = navigator.userAgent || '';
    const safari = /Safari\//.test(ua) && !/Chrom|CriOS|FxiOS|EdgiOS|Android/.test(ua);
    this.info = { safari, hadVibrate: !!(navigator as any).vibrate, ownVibrate: Object.prototype.hasOwnProperty.call(navigator, 'vibrate') };
    if (!safari) { this.engine = (navigator as any).vibrate ? 'navigator.vibrate() · native' : 'no vibration API'; return; }
    /* Safari never ships a native vibrate — anything present is a stub, and the polyfill's install
       gate is `!navigator.vibrate`, so a stub silently disables it. Clear it before importing. */
    if ((navigator as any).vibrate) { try { delete (navigator as any).vibrate; } catch (e) { /* noop */ } this.info['clearedStub'] = !(navigator as any).vibrate; }
    if ((navigator as any).vibrate) { this.engine = 'navigator.vibrate() · pre-defined stub (unclearable)'; return; }
    const watch = setTimeout(() => { if (!(navigator as any).vibrate) Haptics.engine = '<input switch> fallback · polyfill timed out'; }, 8000);
    window.addEventListener('tk-vib', (e: Event) => {
      clearTimeout(watch);
      const detail = (e as CustomEvent).detail;
      Haptics.engine = detail !== 'ok' ? '<input switch> fallback · import failed: ' + detail
        : (navigator as any).vibrate ? 'vibrate() · ios-vibrator-pro-max@3.0.3'
        : '<input switch> fallback · polyfill declined install (Safari <18?)';
    }, { once: true });
    try {
      const s = document.createElement('script'); s.type = 'module';
      s.textContent = 'try{await import("https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm");window.dispatchEvent(new CustomEvent("tk-vib",{detail:"ok"}))}catch(e){try{await import("https://esm.sh/ios-vibrator-pro-max@3.0.3");window.dispatchEvent(new CustomEvent("tk-vib",{detail:"ok"}))}catch(f){window.dispatchEvent(new CustomEvent("tk-vib",{detail:String(f&&f.message||f)}))}}';
      document.head.appendChild(s);
    } catch (e) { clearTimeout(watch); this.engine = '<input switch> fallback'; }
  },
  _mkSw(): HTMLLabelElement {
    if (this._sw) return this._sw;
    const l = document.createElement('label'); l.setAttribute('aria-hidden', 'true');
    l.style.cssText = 'position:fixed;bottom:2px;left:2px;width:44px;height:26px;opacity:0.02;overflow:hidden;pointer-events:none;z-index:1;';
    const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', '');
    try { (i as any).switch = true; } catch (e) { /* noop */ }
    l.appendChild(i); (document.body || document.documentElement).appendChild(l); this._sw = l; return l;
  },
  _run(p: number[], meta: HapticEvent) {
    if (!this.enabled) return;
    meta.t = performance.now(); this._subs.forEach(f => { try { f(meta); } catch (e) { /* noop */ } });
    this.boot();
    try { if ((navigator as any).vibrate && navigator.vibrate(p) !== false) return; } catch (e) { /* noop */ }
    let t = 0;  // last resort: click a real in-viewport <input switch> label at each vibration onset
    for (let k = 0; k < p.length; k += 2) {
      if (k === 0) { try { this._mkSw().click(); } catch (e) { /* noop */ } }
      else { t += (p[k - 1] || 0) + (p[k - 2] || 0); setTimeout(() => { try { this._mkSw().click(); } catch (e) { /* noop */ } }, t); }
    }
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
