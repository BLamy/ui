/* TouchKit — Cocoa Touch container controllers, ported to JSX.
   NavigationStack · SplitView · TabBar (composable — nest it anywhere) · List/Section/Row · IndexBar · Haptics.
   Interaction semantics follow react-aria listbox patterns: arrow-key nav, aria-selected, Esc pops, focus rings.
   Haptics: navigator.vibrate() where real; ios-vibrator-pro-max polyfill (vibrator.dev) on iOS/macOS Safari.
   Credenza: responsive dialog/tray with Family-style height-morphing states (framer-motion, lazy CDN).
   SideDrawer: fixed column / overlay sheet / pushed page — composition decides. */
const {useState, useEffect, useLayoutEffect, useRef} = React;
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const EASE = 'cubic-bezier(.32,.72,0,1)';
const BARH = 52;
const use = React.use || React.useContext;   /* React 19 use(); useContext on 18 — same call shape for context */

/* ══ Chrome coordination ══
   Nav bar and tab bar hide together on scroll-down and come back on scroll-up. The scrolling screen
   publishes here so a <TabBar> anywhere in the tree follows without prop drilling.
   Dynamic Island: --tk-safe-top (px, set by the device frame — env(safe-area-inset-top) on real hardware)
   is the floor. The bar collapses to exactly that height and no further, so the opaque strip that pushes
   content out from under the camera island never goes away. */
const chromeStore = {hidden:false, subs:new Set(),
  set(v) { if (v === this.hidden) return; this.hidden = v; this.subs.forEach(f=>f(v)); }};
function useChromeHidden() {
  const [h, setH] = useState(chromeStore.hidden);
  useEffect(()=>{ const f = v => setH(v); chromeStore.subs.add(f); setH(chromeStore.hidden);
    return ()=>{ chromeStore.subs.delete(f); }; }, []);
  return h;
}
/* Safe-area top inset (Dynamic Island) threaded down from the app frame, so it survives frame changes
   without remounting. --tk-safe-top is still set for CSS that wants it. */
const TKSafeCtx = React.createContext(0);

/* How far down sticky list headers must stop — whatever chrome is above the list (0 when the list is in a
   bare scroller, so it never needs to know where it lives). While the chrome is hidden every offset moves
   up by one bar height, floored at the safe-area strip — that's how headers ride along with the bar. */
const TKStickyCtx = React.createContext(0);
const chromeOffset = (top, hidden) => hidden ? Math.max(0, top - BARH) : top;

/* ══ injected keyframes (framework-owned) ══ */
(function(){ if (document.getElementById('tk-kf')) return; const s = document.createElement('style'); s.id = 'tk-kf'; s.textContent = `
@keyframes tkSpin{to{transform:rotate(360deg)}}
@keyframes tkRing{from{transform:scale(.35);opacity:.85}to{transform:scale(2.4);opacity:0}}
@keyframes tkHapIn{0%{opacity:0;transform:translateY(8px)}10%{opacity:1;transform:none}72%{opacity:1}100%{opacity:0;transform:translateY(-4px)}}
@keyframes tkBub{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.tk-scroll{scrollbar-width:thin;scrollbar-color:rgba(128,128,140,.35) transparent}
.tk-scroll::-webkit-scrollbar{width:3px}
.tk-scroll::-webkit-scrollbar-thumb{background:rgba(128,128,140,.35);border-radius:2px}
.tk-scroll::-webkit-scrollbar-track{background:transparent}
.tk-btn{-webkit-tap-highlight-color:transparent}
.tk-hl:active{background:var(--tk-press)!important}
input::placeholder{color:var(--tk-label3)}
@keyframes tkShimmer{from{background-position:200% 0}to{background-position:0% 0}}
.tk-shimmer{background:linear-gradient(90deg,var(--tk-label3) 40%,var(--tk-label) 50%,var(--tk-label3) 60%) 0 0/200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:tkShimmer 2.4s linear infinite}
.tk-range{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;margin:0;cursor:pointer}
.tk-range::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(var(--tk-tint),var(--tk-tint)) 0/var(--tk-range-fill,50%) 100% no-repeat,var(--tk-fill2)}
.tk-range::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.28),0 0 1px rgba(0,0,0,.22);margin-top:-11px}
.tk-range::-moz-range-track{height:4px;border-radius:2px;background:var(--tk-fill2)}
.tk-range::-moz-range-progress{height:4px;border-radius:2px;background:var(--tk-tint)}
.tk-range::-moz-range-thumb{width:26px;height:26px;border:0;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.28)}
`; document.head.appendChild(s); })();

/* ══ Haptics engine ══
   Android/Chrome: native navigator.vibrate(). iOS/macOS Safari: we load ios-vibrator-pro-max — the vibrator.dev
   polyfill — which implements navigator.vibrate by layering hidden <input switch> controls over the page:
   real taps toggle a switch natively (system haptic), and during drags an overlay switch rides under the finger
   and flips position so the browser registers toggle after toggle. iOS 18.4+ only grants vibration ~1s after a
   real click; the polyfill owns all of that. If the CDN import fails we click our own in-viewport switch. */
const PAT = {light:[8], medium:[16], heavy:[28], selection:[4], success:[10,80,14], warning:[14,90,10,60,10], error:[10,55,10,55,24]};
const Haptics = {
  enabled: true, _subs: new Set(), _sw: null, _booted: false,
  engine: 'booting…', info: {},
  boot(){ if (this._booted) return; this._booted = true;
    const ua = navigator.userAgent || '';
    const safari = /Safari\//.test(ua) && !/Chrom|CriOS|FxiOS|EdgiOS|Android/.test(ua);
    this.info = {safari, hadVibrate: !!navigator.vibrate, ownVibrate: Object.prototype.hasOwnProperty.call(navigator, 'vibrate')};
    if (!safari) { this.engine = navigator.vibrate ? 'navigator.vibrate() · native' : 'no vibration API'; return; }
    /* Safari never ships a native vibrate — anything present is a stub, and the polyfill's install
       gate is `!navigator.vibrate`, so a stub silently disables it. Clear it before importing. */
    if (navigator.vibrate) { try { delete navigator.vibrate; } catch(e){} this.info.clearedStub = !navigator.vibrate; }
    if (navigator.vibrate) { this.engine = 'navigator.vibrate() · pre-defined stub (unclearable)'; return; }
    const watch = setTimeout(()=>{ if (!navigator.vibrate) Haptics.engine = '<input switch> fallback · polyfill timed out'; }, 8000);
    window.addEventListener('tk-vib', e=>{ clearTimeout(watch);
      Haptics.engine = e.detail !== 'ok' ? '<input switch> fallback · import failed: ' + e.detail
        : navigator.vibrate ? 'vibrate() · ios-vibrator-pro-max@3.0.3'
        : '<input switch> fallback · polyfill declined install (Safari <18?)';
    }, {once:true});
    try {
      const s = document.createElement('script'); s.type = 'module';
      s.textContent = 'try{await import("https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm");window.dispatchEvent(new CustomEvent("tk-vib",{detail:"ok"}))}catch(e){try{await import("https://esm.sh/ios-vibrator-pro-max@3.0.3");window.dispatchEvent(new CustomEvent("tk-vib",{detail:"ok"}))}catch(f){window.dispatchEvent(new CustomEvent("tk-vib",{detail:String(f&&f.message||f)}))}}';
      document.head.appendChild(s);
    } catch(e) { clearTimeout(watch); this.engine = '<input switch> fallback'; }
  },
  _mkSw(){ if (this._sw) return this._sw;
    const l = document.createElement('label'); l.setAttribute('aria-hidden','true');
    l.style.cssText = 'position:fixed;bottom:2px;left:2px;width:44px;height:26px;opacity:0.02;overflow:hidden;pointer-events:none;z-index:1;';
    const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch','');
    try { i.switch = true; } catch(e){}
    l.appendChild(i); (document.body||document.documentElement).appendChild(l); this._sw = l; return l; },
  _run(p, meta){ if (!this.enabled) return;
    meta.t = performance.now(); this._subs.forEach(f=>{ try{f(meta)}catch(e){} });
    this.boot();
    try { if (navigator.vibrate && navigator.vibrate(p) !== false) return; } catch(e){}
    let t = 0;  // last resort: click a real in-viewport <input switch> label at each vibration onset
    for (let k = 0; k < p.length; k += 2) {
      if (k === 0) { try{this._mkSw().click()}catch(e){} }
      else { t += (p[k-1]||0) + (p[k-2]||0); setTimeout(()=>{ try{this._mkSw().click()}catch(e){} }, t); }
    } },
  impact(s){ s = s||'medium'; this._run(PAT[s]||PAT.medium, {kind:'impact', label:'impact · '+s, w:s==='heavy'?3:s==='medium'?2:1}); },
  _eager: null,
  selection(){ this._run(PAT.selection, {kind:'selection', label:'selection tick', w:1}); },
  notification(k){ k = k||'success'; this._run(PAT[k]||PAT.success, {kind:'notification', label:'notify · '+k, w:3}); },
  on(f){ this._subs.add(f); return ()=>this._subs.delete(f); }
};
/* Eager boot: the polyfill must wrap the DOM BEFORE the first real click/drag so macOS Safari
   (trackpad Taptic) and iOS get trusted-gesture haptics — lazy boot missed the gesture it needed. */
if (typeof window !== 'undefined') Haptics.boot();

/* framer-motion — lazy CDN load (UMD → window.Motion); consumers re-render on arrival */
function loadMotion(){ if (window.Motion || window.__tkFM) return; window.__tkFM = 1;
  const add = (src, onFail) => { const s = document.createElement('script'); s.src = src;
    s.onload = ()=>window.dispatchEvent(new Event('tk-fm')); s.onerror = onFail || null; document.head.appendChild(s); };
  add('https://unpkg.com/framer-motion@10.18.0/dist/framer-motion.js',
    ()=>add('https://cdn.jsdelivr.net/npm/framer-motion@10.18.0/dist/framer-motion.js'));
}
function useMotion(){ const [, bump] = useState(0);
  useEffect(()=>{ loadMotion(); if (window.Motion) return;
    const h = ()=>bump(x=>x+1); window.addEventListener('tk-fm', h); return ()=>window.removeEventListener('tk-fm', h); }, []);
  return window.Motion || null;
}
function MeasureH({onH, children}) {
  const r = useRef(null);
  useLayoutEffect(()=>{ const el = r.current; if (!el) return; onH(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(()=>{ if (r.current) onH(r.current.offsetHeight); }); ro.observe(el); return ()=>ro.disconnect(); }, [children]);
  return <div ref={r}>{children}</div>;
}

/* ══ Icons ══ */
const IC = {
  chev:[{d:'M9 5.5l6.5 6.5L9 18.5'}],
  chevL:[{d:'M15 5l-7 7 7 7'}],
  sidebar:[{d:'M3.5 5.5h17v13h-17z',rx:1},{d:'M9.5 5.5v13'}],
  search:[{c:[11,11,6.2]},{d:'M15.7 15.7L20.3 20.3'}],
  person:[{c:[12,12,8.6]},{c:[12,9.8,2.9]},{d:'M6.9 18.3c1-2.5 2.9-3.8 5.1-3.8s4.1 1.3 5.1 3.8'}],
  person2:[{c:[9,8.8,3]},{d:'M3.6 18.6c.9-2.7 3-4.1 5.4-4.1s4.5 1.4 5.4 4.1'},{c:[16.8,9.6,2.4]},{d:'M16.4 14.7c2.1.2 3.6 1.4 4.3 3.4'}],
  sliders:[{d:'M4 8h4.6'},{d:'M13.4 8H20'},{c:[11,8,2.2]},{d:'M4 16h8.6'},{d:'M17.4 16H20'},{c:[15,16,2.2]}],
  star:[{d:'M12 3.8l2.34 4.98 5.26.66-3.87 3.74 1 5.42L12 15.98 7.27 18.6l1-5.42L4.4 9.44l5.26-.66L12 3.8z'}],
  starF:[{d:'M12 3.8l2.34 4.98 5.26.66-3.87 3.74 1 5.42L12 15.98 7.27 18.6l1-5.42L4.4 9.44l5.26-.66L12 3.8z',f:1}],
  clock:[{c:[12,12,8.4]},{d:'M12 7.2V12l3.1 1.9'}],
  phone:[{d:'M6.9 3.9c.8-.8 2-.7 2.7.2l1.2 1.6c.6.8.5 1.9-.2 2.6l-.7.7c.4 1.2 2.1 2.9 3.3 3.3l.7-.7c.7-.7 1.8-.8 2.6-.2l1.6 1.2c.9.7 1 2 .2 2.7l-1 1c-.8.8-2 1.1-3.1.7-2-.7-4.2-2.2-5.9-3.9-1.7-1.7-3.2-3.9-3.9-5.9-.4-1.1-.1-2.3.7-3.1l1-1z',f:1}],
  message:[{d:'M12 3.8c4.8 0 8.6 3.2 8.6 7.1s-3.8 7.1-8.6 7.1c-.9 0-1.8-.1-2.6-.3l-3.9 1.7.9-3.1c-1.5-1.3-2.4-3.2-2.4-5.4 0-3.9 3.2-7.1 8-7.1z',f:1}],
  mail:[{d:'M3 5.8h18v12.4H3z',rx:1},{d:'M4.5 7.5l7.5 5.5 7.5-5.5'}],
  video:[{d:'M3 6.8h11.5v10.4H3z',rx:1},{d:'M14.8 10.7l4.7-2.8v8.2l-4.7-2.8z',f:1}],
  trash:[{d:'M5 7h14'},{d:'M9.3 7V5.4c0-.8.6-1.4 1.4-1.4h2.6c.8 0 1.4.6 1.4 1.4V7'},{d:'M7 7l.9 11.1c.1 1.1 1 1.9 2.1 1.9h4c1.1 0 2-.8 2.1-1.9L17 7'},{d:'M10.2 10.5v5.2'},{d:'M13.8 10.5v5.2'}],
  check:[{d:'M5.5 12.6l4.3 4.3 8.7-9.3'}],
  xcirc:[{c:[12,12,9],f:1},{d:'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6',bg:1}],
  x:[{d:'M6.8 6.8l10.4 10.4M17.2 6.8L6.8 17.2'}],
  moon:[{d:'M19.8 14.3A8.3 8.3 0 1 1 9.7 4.2a6.8 6.8 0 0 0 10.1 10.1z'}],
  layers:[{d:'M12 3.6l8.2 4.6L12 12.8 3.8 8.2 12 3.6z'},{d:'M4.6 12.4L12 16.6l7.4-4.2'}],
  wave:[{d:'M4.5 10.2v3.6'},{d:'M8.25 7.5v9'},{d:'M12 4.8v14.4'},{d:'M15.75 7.5v9'},{d:'M19.5 10.2v3.6'}],
  info:[{c:[12,12,8.6]},{d:'M12 11v5.2'},{d:'M12 7.9v.01'}],
  pulse:[{c:[12,12,3],f:1},{c:[12,12,8]}],
  drop:[{d:'M12 3.5c3.2 3.9 6 7 6 10.2a6 6 0 1 1-12 0C6 10.5 8.8 7.4 12 3.5z'}],
  bell:[{d:'M12 4.2a5.8 5.8 0 0 1 5.8 5.8c0 2.9.9 4.4 1.9 5.4H4.3c1-1 1.9-2.5 1.9-5.4A5.8 5.8 0 0 1 12 4.2z'},{d:'M10.1 19.2a2 2 0 0 0 3.8 0'}]
};
function Icon({name, size, sw, style}) {
  size = size||22; sw = sw||1.8;
  const els = IC[name] || IC.info;
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{display:'block', flexShrink:0, ...style}} aria-hidden="true">
    {els.map((e,i)=> e.c
      ? <circle key={i} cx={e.c[0]} cy={e.c[1]} r={e.c[2]} fill={e.f?'currentColor':'none'} stroke={e.f?'none':'currentColor'} strokeWidth={sw}/>
      : <path key={i} d={e.d} fill={e.f?'currentColor':'none'} stroke={e.f?'none':(e.bg?'var(--tk-bg,#fff)':'currentColor')} strokeWidth={e.bg?2:sw} strokeLinecap="round" strokeLinejoin="round"/>)}
  </svg>;
}

/* ══ Small controls ══ */
const hue = s => { let h = 0; for (const ch of s) h = (h*31 + ch.charCodeAt(0)) % 360; return h; };
function Avatar({c, size}) {
  size = size||40; const h = hue(c.f + c.l);
  return <span style={{width:size, height:size, borderRadius:'50%', flexShrink:0, display:'grid', placeItems:'center',
    background:`linear-gradient(180deg, hsl(${h} 62% 64%), hsl(${h} 55% 47%))`, color:'#fff',
    fontSize:size*0.38, fontWeight:600, letterSpacing:'.5px', userSelect:'none'}}>{c.f[0]}{c.l[0]}</span>;
}
function TKSwitch({checked, onChange}) {
  return <label style={{position:'relative', display:'inline-block', width:51, height:31, flexShrink:0}}>
    <input type="checkbox" checked={checked} onChange={e=>{Haptics.impact('light'); onChange(e.target.checked);}}
      style={{position:'absolute', inset:0, opacity:0, margin:0, cursor:'pointer', width:'100%', height:'100%'}}/>
    <span style={{position:'absolute', inset:0, borderRadius:16, background:checked?'var(--tk-green)':'var(--tk-fill2)', transition:'background .25s'}}/>
    <span style={{position:'absolute', top:2, left:checked?22:2, width:27, height:27, borderRadius:'50%', background:'#fff',
      boxShadow:'0 3px 8px rgba(0,0,0,.22), 0 1px 1px rgba(0,0,0,.14)', transition:'left .25s cubic-bezier(.3,.9,.4,1.05)', pointerEvents:'none'}}/>
  </label>;
}
function Segmented({options, value, onChange}) {
  return <div role="radiogroup" style={{display:'flex', gap:2, background:'var(--tk-fill,#e4e4ea)', borderRadius:9, padding:2}}>
    {options.map(o=>{ const on = o.id===value;
      return <button key={o.id} className="tk-btn" role="radio" aria-checked={on} onClick={()=>{ if(!on){Haptics.selection(); onChange(o.id);} }}
        style={{flex:1, border:0, padding:'5px 12px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', whiteSpace:'nowrap',
          background:on?'var(--tk-card,#fff)':'transparent', color:'var(--tk-label,#16161a)',
          boxShadow:on?'0 1px 4px rgba(0,0,0,.14)':'none', transition:'background .2s, box-shadow .2s'}}>{o.label}</button>;})}
  </div>;
}
function Spinner({spin, size}) {
  size = size||22;
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{display:'block', animation:spin?'tkSpin .75s steps(8) infinite':'none'}} aria-hidden="true">
    {[0,1,2,3,4,5,6,7].map(i=><rect key={i} x="11.1" y="2.8" width="1.8" height="5.2" rx="0.9" fill="currentColor" opacity={(i+1)/8} transform={`rotate(${i*45} 12 12)`}/>)}
  </svg>;
}
function HapticIndicator({visible, bottom}) {
  const [ev, setEv] = useState(null); const n = useRef(0);
  useEffect(()=>Haptics.on(m=>{ n.current++; setEv({...m, n:n.current}); }), []);
  if (!visible || !ev) return null;
  const eng = Haptics.engine;
  return <div key={ev.n} style={{position:'absolute', left:12, bottom, zIndex:900, pointerEvents:'none',
      display:'flex', alignItems:'center', gap:9, padding:'6px 12px 6px 8px', borderRadius:99,
      background:'var(--tk-card)', boxShadow:'0 6px 24px rgba(0,0,0,.22), 0 0 0 1px var(--tk-sep)',
      animation:'tkHapIn 1.1s ease forwards'}}>
    <span style={{position:'relative', width:22, height:22, display:'grid', placeItems:'center'}}>
      <span style={{width:8+ev.w*2, height:8+ev.w*2, borderRadius:'50%', background:'var(--tk-tint)'}}/>
      <span style={{position:'absolute', inset:0, borderRadius:'50%', border:'2px solid var(--tk-tint)', animation:'tkRing .6s ease-out forwards'}}/>
    </span>
    <span>
      <span style={{display:'block', fontSize:11.5, fontWeight:700, color:'var(--tk-label)', fontFamily:'ui-monospace,Menlo,monospace'}}>{ev.label}</span>
      <span style={{display:'block', fontSize:9.5, color:'var(--tk-label3)', fontFamily:'ui-monospace,Menlo,monospace'}}>{eng}</span>
    </span>
  </div>;
}

/* ══ List primitives ══ */
/* A list works out its own sticky offset: whatever chrome sits above it (nav bar, none, …) plus its own
   header if it has one. `stickyTop` overrides both. */
function TKList({children, inset, header, stickyTop, style}) {
  const hRef = useRef(null);
  const [hh, setHh] = useState(0);
  const above = use(TKStickyCtx);
  const chromeHid = useChromeHidden();
  useLayoutEffect(()=>{ const el = hRef.current;
    if (!el) { setHh(0); return; }
    const m = () => setHh(el.offsetHeight); m();
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(m); ro.observe(el); return ()=>ro.disconnect(); }
  }, [header]);
  const top = stickyTop != null ? stickyTop : above + (header ? hh : 0);
  return <TKStickyCtx.Provider value={top}>
    <div style={{padding:inset?'0 16px':0, ...style}}>
      {header ? <div ref={hRef} style={{position:'sticky', top:chromeOffset(above, chromeHid), zIndex:24, background:'var(--tk-stick)',
        backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', transition:'top .28s ' + EASE}}>{header}</div> : null}
      {children}
    </div>
  </TKStickyCtx.Provider>;
}
function TKSection({title, footer, children, sticky, innerRef, stickyTop}) {
  const ctxTop = use(TKStickyCtx);
  const top = chromeOffset(stickyTop != null ? stickyTop : ctxTop, useChromeHidden());
  return <div ref={innerRef}>
    {title != null ? (sticky
      ? <div style={{position:'sticky', top, zIndex:20, padding:'3px 16px', fontSize:13.5, fontWeight:600, color:'var(--tk-label)',
          background:'var(--tk-stick)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', transition:'top .28s ' + EASE}}>{title}</div>
      : <div style={{padding:'4px 16px 7px', fontSize:12.5, fontWeight:500, letterSpacing:'.4px', textTransform:'uppercase', color:'var(--tk-label2)'}}>{title}</div>) : null}
    <div style={{borderRadius:sticky?0:12, overflow:'hidden'}}>{children}</div>
    {footer ? <div style={{padding:'7px 16px 0', fontSize:12.8, lineHeight:1.45, color:'var(--tk-label2)'}}>{footer}</div> : null}
    <div style={{height:sticky?0:22}}/>
  </div>;
}
const openRows = new Set();
function TKRow(p) {
  const [px, setPx] = useState(0);
  const [anim, setAnim] = useState(true);
  const [dead, setDead] = useState(false);
  const el = useRef(null); const g = useRef(null); const me = useRef(null);
  useEffect(()=>{ const close = ()=>setPx(0); me.current = close; openRows.add(close); return ()=>openRows.delete(close); }, []);
  const closeOthers = ()=>openRows.forEach(f=>{ if (f !== me.current) f(); });
  const del = ()=>{ setAnim(true); setPx(-(el.current?el.current.offsetWidth:300)); setDead(true);
    Haptics.notification('warning'); setTimeout(()=>p.onDelete && p.onDelete(), 300); };
  const start = e => { if (!p.onDelete || p.edit || e.button) return;
    if (p.isEdge && p.isEdge(e.clientX)) return;
    g.current = {x0:e.clientX, y0:e.clientY, base:px, on:false, fired:false, nx:px}; };
  const mv = e => { const d = g.current; if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)*1.4) { d.on = true; closeOthers(); setAnim(false);
        try { el.current.setPointerCapture(e.pointerId); } catch(err){} }
      else if (Math.abs(dy) > 12) { g.current = null; return; }
      else return;
    }
    const w = el.current.offsetWidth;
    let nx = Math.min(0, d.base + dx); if (nx < -w*0.92) nx = -w*0.92;
    const commit = nx < -w*0.55;
    if (commit && !d.fired) { d.fired = true; Haptics.impact('medium'); }
    else if (!commit && d.fired) { d.fired = false; Haptics.impact('light'); }
    d.nx = nx; setPx(nx); };
  const end = () => { const d = g.current; if (!d) return; g.current = null; if (!d.on) return;
    setAnim(true); const w = el.current.offsetWidth;
    if (d.nx < -w*0.55) del();
    else if (d.nx < -64) setPx(-88);
    else setPx(0); };
  const press = () => { if (g.current && g.current.on) return;
    if (px < 0) { setPx(0); return; }
    p.onPress && p.onPress(); };
  const inEdit = p.edit !== undefined && p.edit !== null;
  return <div style={{position:'relative', overflow:'hidden', maxHeight:dead?0:200, opacity:dead?0:1, transition:'max-height .32s ease, opacity .28s'}}>
    {p.onDelete && px < 0 ? <div style={{position:'absolute', top:0, bottom:0, right:0, width:-px, display:'flex', overflow:'hidden'}}>
      <button className="tk-btn" onClick={del} style={{flex:1, border:0, background:'var(--tk-red)', color:'#fff', fontSize:15, fontWeight:600,
        fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'flex-start', paddingLeft:Math.max(14,(-px-88)/2+14)}}>Delete</button>
    </div> : null}
    <button ref={el} data-tkrow type="button" role={p.rowRole} aria-selected={p.rowRole ? (p.selected || p.checked || false) : undefined}
      className={'tk-btn' + (p.onPress ? ' tk-hl' : '')}
      onPointerDown={start} onPointerMove={mv} onPointerUp={end} onPointerCancel={end} onClick={press}
      style={{display:'flex', alignItems:'center', gap:12, width:'100%', minHeight:46, padding:'0 16px', border:0, textAlign:'left',
        fontFamily:'inherit', fontSize:17, color:p.destructive?'var(--tk-red)':'var(--tk-label)',
        background:p.selected?'var(--tk-press)':'var(--tk-card)', cursor:(p.onPress||p.onDelete)?'pointer':'default',
        transform:`translateX(${px}px)`, transition:(anim?'transform .3s '+EASE+', ':'')+'background .15s',
        touchAction:'pan-y', position:'relative', boxSizing:'border-box'}}>
      {inEdit ? <span aria-hidden="true" style={{width:p.edit?30:0, marginRight:p.edit?0:-12, opacity:p.edit?1:0, overflow:'hidden',
          display:'flex', alignItems:'center', flexShrink:0, transition:'width .25s '+EASE+', opacity .2s, margin-right .25s'}}>
        <span style={{width:22, height:22, borderRadius:'50%', boxSizing:'border-box', flexShrink:0,
          border:p.checked?'none':'1.6px solid var(--tk-label3)', background:p.checked?'var(--tk-tint)':'transparent',
          display:'grid', placeItems:'center', transition:'background .15s'}}>
          {p.checked ? <Icon name="check" size={13} sw={3} style={{color:'#fff'}}/> : null}
        </span>
      </span> : null}
      {p.leading || null}
      <div style={{flex:1, display:'flex', alignItems:'center', gap:10, minWidth:0, minHeight:46, padding:'7px 0',
          boxShadow:p.divider===false?'none':'inset 0 -1px 0 var(--tk-sep)', justifyContent:p.center?'center':'flex-start'}}>
        <div style={{flex:p.center?'none':1, minWidth:0}}>
          <div style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', lineHeight:1.3}}>{p.title}</div>
          {p.subtitle ? <div style={{fontSize:13, color:'var(--tk-label2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1}}>{p.subtitle}</div> : null}
        </div>
        {p.trailing || null}
        {p.accessory === 'chevron' ? <Icon name="chev" size={15} sw={2.6} style={{color:'var(--tk-label3)'}}/>
          : p.accessory === 'check' ? <span style={{width:22, flexShrink:0}}>{p.checked ? <Icon name="check" size={20} sw={2.4} style={{color:'var(--tk-tint)'}}/> : null}</span>
          : null}
      </div>
    </button>
  </div>;
}

/* ══ IndexBar — generic jump rail (haptic tick per stop) ══
   Give it jump points of your own:
     <IndexBar items={[{key:'m4', label:'●', preview:'Why is the build slow?'}]} onJump={key => …}/>
   …or give it nothing but `avail` and it falls back to the UIKit A–Z form:
     <IndexBar avail={new Set(['A','B'])} onLetter={L => …}/>
   Hover peeks the stop under the cursor (no tick, no jump); drag commits it. */
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function ibPoints(items, avail) {
  if (items && items.length) return items.map((it, i) => (it && typeof it === 'object')
    ? {key:it.key != null ? String(it.key) : String(i), label:it.label != null ? String(it.label) : '',
       preview:it.preview != null ? it.preview : null, caption:it.caption || null, dim:!!it.dim}
    : {key:String(it), label:String(it), preview:null, caption:null, dim:false});
  const av = avail || new Set();
  return AL.map(L => ({key:L, label:L, preview:null, caption:null, dim:!av.has(L)}));
}
function IndexBar({items, avail, onJump, onLetter, top, bottom, width = 22, label = 'Jump to section'}) {
  const pts = ibPoints(items, avail);
  const rail = useRef(null); const track = useRef(null); const geo = useRef(null);
  const act = useRef(-1); const ptsRef = useRef(pts); ptsRef.current = pts;
  const [cur, setCur] = useState(-1); const [hov, setHov] = useState(-1); const [on, setOn] = useState(false);
  const measure = () => { const r = rail.current, t = track.current; if (!r || !t) return null;
    const rb = r.getBoundingClientRect(), tb = t.getBoundingClientRect();
    return (geo.current = {rTop:rb.top, tTop:tb.top, tH:tb.height}); };
  const at = y => { const g = geo.current || measure(); if (!g || !g.tH) return -1;
    const n = ptsRef.current.length;
    return Math.max(0, Math.min(n - 1, Math.floor((y - g.tTop) / g.tH * n))); };
  const fire = i => { const p = ptsRef.current[i];
    if (!p || i === act.current) return;
    act.current = i; setCur(i); Haptics.selection();
    if (onJump) onJump(p.key, p, i); else if (onLetter) onLetter(p.key);
  };
  const down = e => { if (e.button) return;
    measure(); setOn(true); setHov(-1); fire(at(e.clientY));
    // No pointer capture here: the vibrator polyfill slides a native <input switch> under the finger during
    // drags, and capture would starve it of events. Window listeners track the scrub instead.
    const mm = ev => fire(at(ev.clientY));
    const uu = () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', uu);
      window.removeEventListener('pointercancel', uu); setOn(false); setCur(-1); act.current = -1; };
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', uu); window.addEventListener('pointercancel', uu); };
  const hover = e => { if (on || e.pointerType === 'touch') return;
    if (!geo.current) measure();
    const i = at(e.clientY); if (i !== hov) setHov(i); };
  const idx = on ? cur : hov;
  const p = idx >= 0 ? pts[idx] : null;
  const g = geo.current;
  const cy = g && p ? (g.tTop - g.rTop) + (idx + 0.5) * (g.tH / pts.length) : 0;
  const bub = {position:'absolute', right:width + 10, top:cy, transform:'translateY(-50%)', background:'var(--tk-card)',
    boxShadow:'0 8px 28px rgba(0,0,0,.28), 0 0 0 1px var(--tk-sep)', animation:'tkBub .16s ' + EASE,
    pointerEvents:'none', opacity:on ? 1 : .93};
  return <div ref={rail} onPointerDown={down} onPointerMove={hover} onPointerLeave={()=>setHov(-1)}
      style={{position:'absolute', right:0, top, bottom, width, zIndex:80, display:'flex', flexDirection:'column',
        justifyContent:'center', alignItems:'center', touchAction:'none', cursor:'pointer', userSelect:'none', WebkitUserSelect:'none'}}
      aria-label={label}>
    <div ref={track} style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%'}}>
      {pts.map((q, i)=>{ const hot = idx === i;
        return <div key={q.key + i} style={{display:'flex', alignItems:'center', justifyContent:'center', height:13.5, width:'100%',
          transform:hot ? 'scale(1.5)' : 'none', transition:'transform .12s'}}>
          {q.label
            ? <span style={{fontSize:10.5, fontWeight:700, lineHeight:'13.5px', color:q.dim ? 'var(--tk-label3)' : 'var(--tk-tint)'}}>{q.label}</span>
            : <span style={{width:hot ? 6 : 5, height:hot ? 6 : 5, borderRadius:'50%', background:q.dim ? 'var(--tk-label3)' : 'var(--tk-tint)',
                opacity:q.dim ? .55 : 1}}/>}
        </div>; })}
    </div>
    {p && (p.preview != null)
      ? <div style={{...bub, maxWidth:250, minWidth:120, borderRadius:14, padding:'9px 13px', boxSizing:'border-box'}}>
          {p.caption ? <div style={{fontSize:9.5, fontWeight:800, letterSpacing:'.6px', textTransform:'uppercase',
            color:'var(--tk-tint)', marginBottom:3}}>{p.caption}</div> : null}
          <div style={{fontSize:13, lineHeight:1.35, color:'var(--tk-label)', fontWeight:550, display:'-webkit-box',
            WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', textWrap:'pretty'}}>{p.preview}</div>
        </div>
      : p ? <div style={{...bub, width:54, height:54, borderRadius:27, display:'grid', placeItems:'center',
          fontSize:25, fontWeight:800, color:'var(--tk-tint)'}}>{p.label}</div> : null}
  </div>;
}

/* ══ TabBar / EditBar ══ */
function TabBar({items, selected, onSelect, hideOnScroll = true}) {
  const hid = useChromeHidden() && hideOnScroll;
  return <div style={{position:'absolute', left:0, right:0, bottom:0, zIndex:120, display:'flex', height:62,
      background:'var(--tk-bar)', backdropFilter:'blur(20px) saturate(1.7)', WebkitBackdropFilter:'blur(20px) saturate(1.7)',
      borderTop:'1px solid var(--tk-sep)', paddingBottom:4, boxSizing:'border-box',
      transform:hid ? 'translateY(100%)' : 'none', transition:'transform .3s ' + EASE}}>
    {items.map(it=>{ const onT = it.id === selected;
      return <button key={it.id} className="tk-btn" onClick={()=>{ if(!onT) Haptics.selection(); onSelect(it.id); }} aria-current={onT?'page':undefined}
        style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:0,
          background:'none', cursor:'pointer', color:onT?'var(--tk-tint)':'var(--tk-label3)', fontFamily:'inherit', padding:0, transition:'color .15s'}}>
        <Icon name={it.icon} size={25} sw={onT?2.1:1.8}/>
        <span style={{fontSize:10, fontWeight:600, letterSpacing:'.1px'}}>{it.title}</span>
      </button>;})}
  </div>;
}
function EditBar({count, allFav, onFav, onDelete}) {
  const b = {border:0, background:'none', fontFamily:'inherit', fontSize:16.5, cursor:'pointer', padding:'8px 4px'};
  return <div style={{position:'absolute', left:0, right:0, bottom:0, zIndex:130, display:'flex', alignItems:'center', height:62,
      padding:'0 16px 4px', boxSizing:'border-box', background:'var(--tk-bar)', backdropFilter:'blur(20px) saturate(1.7)',
      WebkitBackdropFilter:'blur(20px) saturate(1.7)', borderTop:'1px solid var(--tk-sep)'}}>
    <button className="tk-btn" disabled={!count} onClick={onFav} style={{...b, color:'var(--tk-tint)', opacity:count?1:.35}}>{allFav?'Unfavorite':'Favorite'}</button>
    <span style={{flex:1, textAlign:'center', fontSize:13, color:'var(--tk-label2)'}}>{count?count+' selected':'Select items'}</span>
    <button className="tk-btn" disabled={!count} onClick={onDelete} style={{...b, color:'var(--tk-red)', opacity:count?1:.35}}>Delete</button>
  </div>;
}

/* ══ NavigationStack ══ */
function ScreenWrap({sc, depth, top, ghost, entering, nav, backTitle, reg, defIns, z}) {
  const started = useRef(false);
  const [in_, setIn] = useState(!entering);
  const [out, setOut] = useState(false);
  const [scr, setScr] = useState(false);
  const [hid, setHid] = useState(false);
  const safeTop = use(TKSafeCtx);
  const lastY = useRef(0);
  const scroller = useRef(null); const inner = useRef(null); const spin = useRef(null);
  const pl = useRef(null); const [refr, setRefr] = useState(false);
  useLayoutEffect(()=>{ if (entering && !started.current) { started.current = true; setIn(false);
    requestAnimationFrame(()=>requestAnimationFrame(()=>setIn(true))); } }, [entering]);
  useEffect(()=>{ if (ghost) requestAnimationFrame(()=>setOut(true)); }, [ghost]);
  const isUnder = !ghost && depth < top;
  const tx = ghost ? (out?'103%':'0%') : (!in_ ? '103%' : isUnder ? '-28%' : '0%');
  const ins = sc.bottomInset != null ? sc.bottomInset : (defIns||0);
  const barH = safeTop + BARH;
  const hideChrome = sc.hideChromeOnScroll !== false;
  useEffect(()=>()=>chromeStore.set(false), []);
  const onScroll = e => { const y = e.currentTarget.scrollTop; const s = y > (sc.largeTitle?44:8); if (s !== scr) setScr(s);
    if (hideChrome && !ghost) {
      const dy = y - lastY.current;
      if (y < barH * 0.7) { if (hid) { setHid(false); chromeStore.set(false); } }
      else if (dy > 5) { if (!hid) { setHid(true); chromeStore.set(true); } }
      else if (dy < -5) { if (hid) { setHid(false); chromeStore.set(false); } }
    }
    lastY.current = y;
  };
  const showTitle = sc.titleOnScroll ? scr : (sc.largeTitle ? scr : true);
  const onKey = e => {
    if (e.key === 'Escape' && nav.canPop && depth > 0) { nav.pop(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = [...e.currentTarget.querySelectorAll('[data-tkrow]')].filter(r=>r.offsetParent);
      const i = rows.indexOf(document.activeElement);
      const n = e.key === 'ArrowDown' ? (i < 0 ? 0 : Math.min(i+1, rows.length-1)) : (i < 0 ? rows.length-1 : Math.max(i-1, 0));
      if (rows[n]) { rows[n].focus(); e.preventDefault(); }
    } };
  // pull-to-refresh
  const pDown = e => { if (!sc.onRefresh || refr || e.button) return;
    if (scroller.current.scrollTop > 2) return;
    pl.current = {y0:e.clientY, x0:e.clientX, on:false, armed:false}; };
  const pMove = e => { const d = pl.current; if (!d) return;
    const dy = e.clientY - d.y0, dx = e.clientX - d.x0;
    if (!d.on) {
      if (dy > 10 && dy > Math.abs(dx)*1.3 && scroller.current.scrollTop <= 1) { d.on = true;
        try { scroller.current.setPointerCapture(e.pointerId); } catch(err){} }
      else if (dy < -6) { pl.current = null; return; }
      else return;
    }
    const t = Math.min(110, 56*Math.log1p(Math.max(0, dy-10)/40)); d.t = t;
    const c = inner.current, sp = spin.current;
    if (c) { c.style.transition = 'none'; c.style.transform = `translateY(${t}px)`; }
    if (sp) { sp.style.opacity = String(Math.min(1, t/58)); sp.style.transform = `translateX(-50%) rotate(${t*3.2}deg) scale(${Math.min(1, .5 + t/90)})`; }
    const armed = t > 54;
    if (armed && !d.armed) { d.armed = true; Haptics.impact('light'); }
    if (!armed && d.armed) d.armed = false; };
  const pEnd = () => { const d = pl.current; if (!d) return; pl.current = null; if (!d.on) return;
    const c = inner.current, sp = spin.current;
    if (d.armed) { setRefr(true); Haptics.impact('medium');
      if (c) { c.style.transition = 'transform .25s ease'; c.style.transform = 'translateY(52px)'; }
      if (sp) { sp.style.opacity = '1'; sp.style.transform = 'translateX(-50%)'; }
      setTimeout(()=>{ setRefr(false);
        if (c) { c.style.transition = 'transform .4s '+EASE; c.style.transform = 'translateY(0)'; }
        if (sp) sp.style.opacity = '0';
        sc.onRefresh && sc.onRefresh();
        setTimeout(()=>{ if (c) { c.style.transition = ''; c.style.transform = ''; } }, 420);
      }, 1100);
    } else {
      if (c) { c.style.transition = 'transform .3s '+EASE; c.style.transform = 'translateY(0)';
        setTimeout(()=>{ if (c) { c.style.transition = ''; c.style.transform = ''; } }, 320); }
      if (sp) sp.style.opacity = '0';
    } };
  return <div ref={el=>reg(sc.key, {el})} data-screen-label={typeof sc.title === 'string' ? sc.title : sc.key}
      style={{position:'absolute', inset:0, zIndex:10+z, background:sc.grouped?'var(--tk-bg2)':'var(--tk-bg)',
        transform:`translateX(${tx})`, transition:`transform .42s ${EASE}`, willChange:'transform', overflow:'hidden',
        boxShadow:depth>0?'-10px 0 30px rgba(0,0,0,.16)':'none', pointerEvents:ghost?'none':'auto'}}>
    <div ref={scroller} className="tk-scroll" onScroll={onScroll} onKeyDown={onKey}
        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pEnd} onPointerCancel={pEnd}
        style={{position:'absolute', inset:0, overflowY:'auto', overflowX:'hidden', overscrollBehavior:'contain', WebkitOverflowScrolling:'touch'}}>
      <div ref={inner} style={{maxWidth:sc.maxW||'none', margin:'0 auto', width:'100%', boxSizing:'border-box'}}>
        {sc.largeTitle
          ? <div style={{padding:(barH+2)+'px 16px 6px'}}>
              <div style={{fontSize:34, fontWeight:800, letterSpacing:'-.5px', lineHeight:1.15}}>{sc.title}</div>
              {sc.subheader ? <div style={{marginTop:10}}>{sc.subheader}</div> : null}
            </div>
          : <div style={{height:barH}}/>}
        <TKStickyCtx.Provider value={barH}>{sc.content}</TKStickyCtx.Provider>
        <div style={{height:ins+28}}/>
      </div>
    </div>
    {sc.onRefresh ? <div ref={spin} style={{position:'absolute', top:barH+8, left:'50%', transform:'translateX(-50%)', opacity:0,
        color:'var(--tk-label2)', zIndex:5, pointerEvents:'none', transition:'opacity .2s'}}><Spinner spin={refr}/></div> : null}
    <div style={{position:'absolute', top:0, left:0, right:0, height:barH, zIndex:30, display:'flex', alignItems:'flex-end', padding:'0 6px', boxSizing:'border-box',
        paddingTop:safeTop, transform:hid ? 'translateY(' + (-(barH - safeTop)) + 'px)' : 'none', transition:'transform .3s ' + EASE}}>
      <div style={{position:'absolute', inset:0, background:'var(--tk-bar)', backdropFilter:'blur(18px) saturate(1.7)',
        WebkitBackdropFilter:'blur(18px) saturate(1.7)', borderBottom:'1px solid var(--tk-sep)', opacity:scr?1:0, transition:'opacity .25s'}}/>
      {/* Under-island strip: stays put while the bar slides away, so content never runs under the camera. */}
      {safeTop ? <div style={{position:'absolute', left:0, right:0, top:0, height:safeTop, background:'var(--tk-bar)',
        backdropFilter:'blur(18px) saturate(1.7)', WebkitBackdropFilter:'blur(18px) saturate(1.7)',
        transform:hid ? 'translateY(' + (barH - safeTop) + 'px)' : 'none', transition:'transform .3s ' + EASE, opacity:scr || hid ? 1 : 0}}/> : null}
      <div style={{display:'flex', alignItems:'center', width:'100%', height:BARH, opacity:hid ? 0 : 1, transition:'opacity .2s'}}>
      <div style={{position:'relative', display:'flex', alignItems:'center', minWidth:44, zIndex:1}}>
        {(depth > 0 || ghost)
          ? <button className="tk-btn" onClick={nav.canPop?nav.pop:undefined} style={{display:'flex', alignItems:'center', border:0, background:'none',
              color:'var(--tk-tint)', fontSize:17, fontFamily:'inherit', padding:'6px 8px 6px 0', cursor:'pointer', maxWidth:160}}>
              <Icon name="chevL" size={24} sw={2.4}/>
              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{backTitle && backTitle.length <= 12 ? backTitle : 'Back'}</span>
            </button>
          : (sc.leading || null)}
      </div>
      <div style={{position:'absolute', left:'50%', transform:'translateX(-50%)', maxWidth:'52%', fontSize:17, fontWeight:600,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', opacity:showTitle?1:0, transition:'opacity .2s', pointerEvents:'none', color:'var(--tk-label)'}}>{sc.title}</div>
      <div style={{position:'relative', marginLeft:'auto', display:'flex', alignItems:'center', zIndex:1}}>{sc.trailing || null}</div>
      </div>
    </div>
    {sc.overlay || null}
    <div ref={el=>reg(sc.key, {dim:el})} style={{position:'absolute', inset:0, background:'#000', opacity:isUnder?.12:0,
      transition:'opacity .42s', pointerEvents:'none', zIndex:200}}/>
  </div>;
}

/* Back-gesture history bridge: on touch devices the system edge-swipe would navigate the page itself away
   (blank screen). While any stack can pop we keep one history sentinel armed; the system gesture then lands
   as popstate and pops OUR stack instead of the page. */
const NavPops = new Set();
let tkArmed = false;
let tkCoarse = typeof matchMedia !== 'undefined' && matchMedia('(any-pointer: coarse)').matches;
function armHistory(){ if (!tkCoarse || tkArmed) return;
  try { history.pushState({tkNav:1}, ''); tkArmed = true; } catch(e) { tkCoarse = false; } }
if (typeof window !== 'undefined' && !window.__tkPopstate) { window.__tkPopstate = 1;
  window.addEventListener('popstate', ()=>{ if (!tkArmed) return; tkArmed = false;
    let best = null; NavPops.forEach(g=>{ const s = g(); if (s.depth > 1) best = s; });
    if (best) { best.pop();
      setTimeout(()=>{ let can = false; NavPops.forEach(g=>{ if (g().depth > 1) can = true; }); if (can) armHistory(); }, 80); } }); }

function NavigationStack({screens, onPop, defIns, safeTop}) {
  const contRef = useRef(null);
  const regMap = useRef({});
  const reg = (k, part) => { regMap.current[k] = {...regMap.current[k], ...part}; };
  const [anim, setAnim] = useState({enter:null, exit:null});
  const prevRef = useRef(screens);
  const skipRef = useRef(false);
  const tRef = useRef(null);
  const onPopRef = useRef(onPop); onPopRef.current = onPop;
  const drag = useRef(null);
  const keysJ = screens.map(s=>s.key).join('¦');
  useLayoutEffect(()=>{
    const old = prevRef.current; prevRef.current = screens;
    const ok = old.map(s=>s.key), nk = screens.map(s=>s.key);
    if (ok.join('¦') === keysJ) return;
    clearTimeout(tRef.current);
    const pref = (a,b)=>a.every((k,i)=>b[i]===k);
    if (nk.length > ok.length && pref(ok, nk)) {
      setAnim({enter:nk[nk.length-1], exit:null});
      armHistory();
      tRef.current = setTimeout(()=>setAnim({enter:null, exit:null}), 460);
    } else if (nk.length < ok.length && pref(nk, ok)) {
      if (skipRef.current) { skipRef.current = false; setAnim({enter:null, exit:null}); return; }
      setAnim({enter:null, exit:old.slice(nk.length)});
      tRef.current = setTimeout(()=>setAnim({enter:null, exit:null}), 460);
    } else setAnim({enter:null, exit:null});
  }, [keysJ]);
  const ghosts = anim.exit || [];
  const canPop = screens.length > 1;
  const depthRef = useRef(0); depthRef.current = screens.length;
  useEffect(()=>{ const g = ()=>({depth:depthRef.current, pop:()=>onPopRef.current && onPopRef.current()});
    NavPops.add(g); return ()=>NavPops.delete(g); }, []);
  const down = e => {
    if (e.button || anim.enter || anim.exit || screens.length < 2) return;
    const rect = contRef.current.getBoundingClientRect();
    if (e.clientX - rect.left > 36) return;
    const topR = regMap.current[screens[screens.length-1].key];
    const undR = regMap.current[screens[screens.length-2].key];
    if (!topR || !topR.el || !undR || !undR.el) return;
    drag.current = {x0:e.clientX, y0:e.clientY, w:rect.width, topR, undR, last:e.clientX, lt:performance.now(), vel:0, moved:false, on:false};
    try { contRef.current.setPointerCapture(e.pointerId); } catch(err){} };
  const move = e => { const d = drag.current; if (!d) return;
    const raw = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {  // slop: engage only on a clearly horizontal rightward drag
      if (raw > 8 && raw > Math.abs(dy) * 1.2) d.on = true;
      else { if (Math.abs(dy) > 14) drag.current = null; return; }
    }
    const dx = Math.max(0, raw); d.moved = true; d.dx = dx;
    d.vel = (e.clientX - d.last) / Math.max(1, performance.now() - d.lt); d.last = e.clientX; d.lt = performance.now();
    const p = dx / d.w;
    try {
      d.topR.el.style.transition = 'none'; d.topR.el.style.transform = `translateX(${dx}px)`;
      d.undR.el.style.transition = 'none'; d.undR.el.style.transform = `translateX(${-28*(1-p)}%)`;
      if (d.undR.dim) { d.undR.dim.style.transition = 'none'; d.undR.dim.style.opacity = String(.12*(1-p)); }
    } catch(err) { drag.current = null; } };
  const up = () => { const d = drag.current; if (!d) return; drag.current = null;
    if (!d.moved || !d.on) { clean(d); return; }
    const p = (d.dx||0) / d.w;
    const commit = p > .32 || d.vel > .55;
    const ease = 'transform .26s ease-out';
    if (commit) {
      Haptics.impact('light');
      d.topR.el.style.transition = ease; d.topR.el.style.transform = 'translateX(104%)';
      d.undR.el.style.transition = ease; d.undR.el.style.transform = 'translateX(0%)';
      if (d.undR.dim) { d.undR.dim.style.transition = 'opacity .26s'; d.undR.dim.style.opacity = '0'; }
      skipRef.current = true;
      setTimeout(()=>{ onPopRef.current && onPopRef.current(); requestAnimationFrame(()=>clean(d)); }, 250);
    } else {
      d.topR.el.style.transition = ease; d.topR.el.style.transform = 'translateX(0px)';
      d.undR.el.style.transition = ease; d.undR.el.style.transform = 'translateX(-28%)';
      if (d.undR.dim) { d.undR.dim.style.transition = 'opacity .26s'; d.undR.dim.style.opacity = '.12'; }
      setTimeout(()=>clean(d), 290);
    } };
  const clean = d => [d.topR, d.undR].forEach(r=>{ try { if (r && r.el) { r.el.style.transition = ''; r.el.style.transform = ''; }
    if (r && r.dim) { r.dim.style.transition = ''; r.dim.style.opacity = ''; } } catch(e){} });
  const topIdx = screens.length - 1;
  const rendered = [
    ...screens.map((sc,i)=>({sc, i, ghost:false})),
    ...ghosts.map((sc,j)=>({sc, i:screens.length+j, ghost:true}))
  ];
  const total = rendered.length - 1;
  const inner = <div ref={contRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{position:'absolute', inset:0, overflow:'hidden', touchAction:'pan-y'}}>
    {rendered.map(r=><ScreenWrap key={r.sc.key} sc={r.sc} depth={r.i} top={r.ghost?total:topIdx} ghost={r.ghost}
      entering={!r.ghost && anim.enter === r.sc.key && r.i === topIdx}
      nav={{pop:()=>onPopRef.current && onPopRef.current(), canPop:canPop && !r.ghost}}
      backTitle={r.i > 0 ? (r.ghost ? (screens[screens.length-1] && screens[screens.length-1].title) : screens[r.i-1].title) : null}
      reg={reg} defIns={defIns} z={r.i}/>)}
  </div>;
  return safeTop != null ? <TKSafeCtx.Provider value={parseFloat(safeTop) || 0}>{inner}</TKSafeCtx.Provider> : inner;
}

/* ══ SplitView ══ */
function SplitView({wc, sidebar, master, detail, drawerOpen, onCloseDrawer}) {
  if (wc === 'regular') {
    return <div style={{display:'flex', height:'100%'}}>
      <div style={{width:264, flexShrink:0, borderRight:'1px solid var(--tk-sep)', background:'var(--tk-side)', transition:'background .25s'}}>{sidebar}</div>
      <div style={{width:370, flexShrink:0, borderRight:'1px solid var(--tk-sep)', position:'relative', background:'var(--tk-bg)'}}>{master}</div>
      <div style={{flex:1, position:'relative', background:'var(--tk-bg2)', minWidth:0}}>{detail}</div>
    </div>;
  }
  return <div style={{position:'absolute', inset:0, overflow:'hidden'}}>
    <div style={{position:'absolute', inset:0}}>{master}</div>
    <div onClick={onCloseDrawer} style={{position:'absolute', inset:0, background:'var(--tk-scrim)', opacity:drawerOpen?1:0,
      pointerEvents:drawerOpen?'auto':'none', transition:'opacity .3s', zIndex:300}}/>
    <div style={{position:'absolute', top:0, bottom:0, left:0, width:300, background:'var(--tk-card)', zIndex:301,
      transform:drawerOpen?'translateX(0)':'translateX(-105%)', transition:'transform .34s '+EASE,
      boxShadow:drawerOpen?'12px 0 40px rgba(0,0,0,.22)':'none'}}>{sidebar}</div>
  </div>;
}

/* ══ Credenza — responsive dialog ⇄ tray with Family-style state morphing ══
   Desktop: centered dialog. Compact: floating bottom tray, drag-down to dismiss. The card spring-animates its
   height to each view; views cross through with scale + blur; titles and the back chevron morph in place. */
function Credenza({open, onClose, onBack, canBack, view, title, compact, children}) {
  const FM = useMotion();
  const [h, setH] = useState(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(()=>{ if (!open) return; const k = e => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', k); return ()=>window.removeEventListener('keydown', k); }, [open]);
  const circle = (icon, fn, label) => <button className="tk-btn" onClick={fn} aria-label={label}
    style={{width:30, height:30, borderRadius:'50%', border:0, background:'var(--tk-fill)', color:'var(--tk-label2)',
      display:'grid', placeItems:'center', cursor:'pointer', flexShrink:0, padding:0}}><Icon name={icon} size={15} sw={2.6}/></button>;
  const card = {background:'var(--tk-card)', color:'var(--tk-label)', overflow:'hidden', boxSizing:'border-box',
    boxShadow:'0 24px 80px rgba(0,0,0,.34), 0 0 0 1px var(--tk-sep)'};
  const trayPos = {position:'absolute', left:10, right:10, bottom:10, borderRadius:28, zIndex:401};
  const dlgPos = {position:'absolute', left:'50%', top:'50%', width:400, maxWidth:'calc(100% - 44px)', borderRadius:24, zIndex:401};
  if (!FM) { if (!open) return null;
    return <div style={{position:'absolute', inset:0, zIndex:400}}>
      <div onClick={onClose} style={{position:'absolute', inset:0, background:'var(--tk-scrim)'}}/>
      <div style={{...card, ...(compact ? trayPos : {...dlgPos, transform:'translate(-50%,-50%)'})}}>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 14px 6px'}}>
          {canBack ? circle('chevL', onBack, 'Back') : null}
          <span style={{fontSize:18, fontWeight:700, letterSpacing:'-.2px', flex:1, minWidth:0}}>{title}</span>
          {circle('x', onClose, 'Close')}
        </div>
        {children}
      </div>
    </div>; }
  const m = FM.motion, AP = FM.AnimatePresence;
  const spring = {type:'spring', stiffness:520, damping:44, mass:1};
  const header = <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 14px 6px', position:'relative', zIndex:2}}>
    <AP initial={false}>{canBack ? <m.div key="bk" initial={{opacity:0, scale:.4, width:0, marginRight:-10}}
      animate={{opacity:1, scale:1, width:30, marginRight:0}} exit={{opacity:0, scale:.4, width:0, marginRight:-10}}
      transition={{duration:.2}} style={{display:'grid', placeItems:'center', overflow:'hidden', flexShrink:0}}>{circle('chevL', onBack, 'Back')}</m.div> : null}</AP>
    <div style={{position:'relative', flex:1, height:26, minWidth:0}}>
      <AP initial={false}>
        <m.div key={String(title)} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} transition={{duration:.17}}
          style={{position:'absolute', left:0, top:0, fontSize:18, fontWeight:700, letterSpacing:'-.2px', whiteSpace:'nowrap', lineHeight:'26px'}}>{title}</m.div>
      </AP>
    </div>
    {circle('x', onClose, 'Close')}
  </div>;
  const body = <m.div initial={false} animate={h == null ? {} : {height:h}} transition={spring} style={{overflow:'hidden', position:'relative'}}>
    <AP initial={false} mode="popLayout">
      <m.div key={String(view)} initial={{opacity:0, scale:.97, filter:'blur(6px)'}} animate={{opacity:1, scale:1, filter:'blur(0px)'}}
        exit={{opacity:0, scale:.97, filter:'blur(6px)'}} transition={{duration:.21, ease:'easeOut'}} style={{width:'100%'}}>
        <MeasureH onH={setH}>{children}</MeasureH>
      </m.div>
    </AP>
  </m.div>;
  return <AP>
    {open ? <m.div key="scrim" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.24}}
      style={{position:'absolute', inset:0, background:'var(--tk-scrim)', zIndex:400}}/> : null}
    {open ? (compact
      ? <m.div key="tray" initial={{y:'112%'}} animate={{y:'0%'}} exit={{y:'118%'}} transition={spring}
          drag="y" dragConstraints={{top:0, bottom:0}} dragElastic={{top:.02, bottom:.55}}
          onDragEnd={(ev, inf)=>{ if (inf.offset.y > 120 || inf.velocity.y > 500) { Haptics.impact('light'); closeRef.current(); } }}
          style={{...card, ...trayPos, touchAction:'none'}}>
          <div aria-hidden="true" style={{position:'absolute', top:7, left:'50%', transform:'translateX(-50%)', width:38, height:5, borderRadius:3, background:'var(--tk-fill2)', zIndex:3}}/>
          {header}{body}
        </m.div>
      : <m.div key="dlg" initial={{x:'-50%', y:'-45%', opacity:0, scale:.95}} animate={{x:'-50%', y:'-50%', opacity:1, scale:1}}
          exit={{x:'-50%', y:'-48%', opacity:0, scale:.97}} transition={spring} style={{...card, ...dlgPos}}>
          {header}{body}
        </m.div>) : null}
  </AP>;
}

/* ══ SideDrawer — one panel, three hosts ══
   mode="fixed": docks as a column beside the detail view (extra-wide). mode="overlay": shadcn-style sheet from
   the right, scrim click dismisses (desktop/tablet). On phones, compose the same content as a pushed screen. */
function SideDrawer({mode, open, onClose, title, width, children}) {
  width = width || 320;
  const head = <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 14px 6px', flexShrink:0}}>
    <span style={{fontSize:16.5, fontWeight:700, letterSpacing:'-.2px', whiteSpace:'nowrap'}}>{title}</span>
    <button className="tk-btn" onClick={onClose} aria-label={'Close ' + title} style={{border:0, background:'var(--tk-fill)', width:28, height:28,
      borderRadius:'50%', display:'grid', placeItems:'center', cursor:'pointer', color:'var(--tk-label2)', padding:0}}><Icon name="x" size={14} sw={2.6}/></button>
  </div>;
  const col = <React.Fragment>{head}<div className="tk-scroll" style={{flex:1, overflowY:'auto', minHeight:0}}>{children}</div></React.Fragment>;
  if (mode === 'fixed') {
    return <div aria-hidden={!open} style={{width:open ? width : 0, flexShrink:0, overflow:'hidden', transition:'width .34s ' + EASE,
        borderLeft:open ? '1px solid var(--tk-sep)' : 'none', background:'var(--tk-bg)'}}>
      <div style={{width, height:'100%', display:'flex', flexDirection:'column', boxSizing:'border-box'}}>{col}</div>
    </div>;
  }
  return <div aria-hidden={!open} style={{position:'absolute', inset:0, zIndex:350, pointerEvents:open ? 'auto' : 'none'}}>
    <div onClick={onClose} style={{position:'absolute', inset:0, background:'var(--tk-scrim)', opacity:open ? 1 : 0, transition:'opacity .3s'}}/>
    <div style={{position:'absolute', top:0, bottom:0, right:0, width:'min(' + width + 'px, 88%)', display:'flex', flexDirection:'column',
      background:'var(--tk-bg)', borderLeft:'1px solid var(--tk-sep)', boxShadow:open ? '-16px 0 48px rgba(0,0,0,.25)' : 'none',
      transform:open ? 'none' : 'translateX(106%)', transition:'transform .34s ' + EASE}}>{col}</div>
  </div>;
}
function ActivityView({c}) {
  const base = [
    ['phone','Outgoing call','2 min · yesterday'], ['message','iMessage','\u201csee you at 6\u201d · yesterday'],
    ['video','FaceTime','12 min · Mon'], ['mail','Mail','Re: schedule · Mon'],
    ['phone','Missed call','Sun'], ['message','iMessage','photo · Sat'],
    ['phone','Incoming call','6 min · Fri'], ['mail','Mail','Invite · last week']
  ];
  const h = hue(c.f + c.l); const n = 4 + (h % 4);
  const rows = Array.from({length:n}, (_, i)=>base[(h + i * 3 + i * i) % base.length]);
  return <div style={{padding:'4px 14px 18px'}}>
    <div style={{display:'flex', alignItems:'center', gap:10, padding:'8px 2px 14px'}}>
      <Avatar c={c} size={34}/>
      <div>
        <div style={{fontSize:15, fontWeight:700}}>{c.f} {c.l}</div>
        <div style={{fontSize:12, color:'var(--tk-label2)'}}>Last 30 days</div>
      </div>
    </div>
    <div style={{background:'var(--tk-card)', borderRadius:12, overflow:'hidden', boxShadow:'0 0 0 1px var(--tk-sep)'}}>
      {rows.map((r, i)=><div key={i} style={{display:'flex', alignItems:'center', gap:11, padding:'9px 12px', boxShadow:i < rows.length - 1 ? 'inset 0 -1px 0 var(--tk-sep)' : 'none'}}>
        <span style={{width:30, height:30, borderRadius:8, background:'var(--tk-fill)', display:'grid', placeItems:'center', color:'var(--tk-tint)', flexShrink:0}}><Icon name={r[0]} size={16} sw={2}/></span>
        <span style={{flex:1, minWidth:0}}>
          <span style={{display:'block', fontSize:14.5, fontWeight:600}}>{r[1]}</span>
          <span style={{display:'block', fontSize:12, color:'var(--tk-label2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r[2]}</span>
        </span>
      </div>)}
    </div>
    {NOTES[c.id] ? <div style={{marginTop:14, background:'var(--tk-card)', borderRadius:12, padding:'10px 13px', boxShadow:'0 0 0 1px var(--tk-sep)'}}>
      <div style={{fontSize:11.5, fontWeight:700, letterSpacing:'.4px', textTransform:'uppercase', color:'var(--tk-label2)', marginBottom:4}}>Notes</div>
      <div style={{fontSize:13.5, lineHeight:1.5}}>{NOTES[c.id]}</div>
    </div> : null}
    <div style={{marginTop:14, fontSize:11.5, color:'var(--tk-label3)', lineHeight:1.5, padding:'0 2px'}}>Same panel, three hosts — fixed column at 1280px+, overlay sheet on desktop &amp; tablet, pushed page on phone.</div>
  </div>;
}
function QRSvg({seed, size}) {
  size = size || 168; const N = 21, u = size / N;
  let s = 0; for (const ch of seed) s = (s * 33 + ch.charCodeAt(0)) >>> 0;
  const rnd = ()=>{ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const cells = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const corner = (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
    if (!corner && rnd() < .45) cells.push(<rect key={r + '-' + c} x={c * u + u * .04} y={r * u + u * .04} width={u * .92} height={u * .92} rx={u * .28} fill="currentColor"/>);
  }
  const eye = (x, y) => <g key={x + '-' + y}>
    <rect x={x + u * .5} y={y + u * .5} width={6 * u} height={6 * u} rx={u * 1.5} fill="none" stroke="currentColor" strokeWidth={u * .9}/>
    <rect x={x + u * 2} y={y + u * 2} width={3 * u} height={3 * u} rx={u * .7} fill="currentColor"/>
  </g>;
  return <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} style={{display:'block'}} aria-hidden="true">
    {cells}{eye(0, 0)}{eye((N - 7) * u, 0)}{eye(0, (N - 7) * u)}
  </svg>;
}
function PillBtn({label, onPress, tone}) {
  return <button className="tk-btn" onClick={onPress} style={{width:'100%', border:0, borderRadius:14, padding:'13px 12px', fontSize:16, fontWeight:600,
    fontFamily:'inherit', cursor:'pointer', background:tone === 'soft' ? 'var(--tk-fill)' : 'var(--tk-tint)',
    color:tone === 'soft' ? 'var(--tk-label)' : '#fff', boxSizing:'border-box'}}>{label}</button>;
}
const SHARE_T = {menu:'Share Contact', qr:'QR Code', vcard:'Export vCard', done:'Shared'};
function ShareViews({c, view, go, onClose}) {
  const opt = (icon, t, d, fn) => <button key={t} className="tk-btn tk-hl" onClick={fn}
    style={{display:'flex', alignItems:'center', gap:12, width:'100%', border:0, textAlign:'left', background:'var(--tk-fill)',
      borderRadius:14, padding:'11px 12px', marginBottom:8, cursor:'pointer', fontFamily:'inherit', color:'var(--tk-label)', boxSizing:'border-box'}}>
    <span style={{width:34, height:34, borderRadius:10, background:'var(--tk-card)', display:'grid', placeItems:'center', color:'var(--tk-tint)', boxShadow:'0 0 0 1px var(--tk-sep)', flexShrink:0}}><Icon name={icon} size={18} sw={2}/></span>
    <span style={{flex:1, minWidth:0}}>
      <span style={{display:'block', fontSize:15.5, fontWeight:600}}>{t}</span>
      <span style={{display:'block', fontSize:12.5, color:'var(--tk-label2)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{d}</span></span>
    <Icon name="chev" size={14} sw={2.6} style={{color:'var(--tk-label3)'}}/>
  </button>;
  if (view === 'qr') return <div style={{padding:'12px 20px 20px', textAlign:'center'}}>
    <div style={{display:'inline-grid', placeItems:'center', padding:16, borderRadius:20, background:'#fff', color:'#111', boxShadow:'0 0 0 1px var(--tk-sep)'}}>
      <QRSvg seed={c.id}/></div>
    <div style={{fontSize:13, color:'var(--tk-label2)', margin:'12px 0 14px', lineHeight:1.45}}>Scanning adds {c.f} {c.l} — name, {c.ph}, and email.</div>
    <PillBtn label="Save to Photos" onPress={()=>go('done')}/>
  </div>;
  if (view === 'vcard') return <div style={{padding:'12px 16px 16px'}}>
    <div style={{borderRadius:14, background:'var(--tk-fill)', padding:'2px 0', marginBottom:12}}>
      {[['Name', c.f + ' ' + c.l], ['Mobile', c.ph], ['Email', c.em], ['Group', c.g || '—']].map((f, i)=>
        <div key={f[0]} style={{display:'flex', justifyContent:'space-between', gap:12, padding:'8px 14px', boxShadow:i < 3 ? 'inset 0 -1px 0 var(--tk-sep)' : 'none'}}>
          <span style={{fontSize:13.5, color:'var(--tk-label2)', flexShrink:0}}>{f[0]}</span>
          <span style={{fontSize:13.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f[1]}</span></div>)}
    </div>
    <div style={{fontSize:12.5, color:'var(--tk-label2)', margin:'0 2px 12px'}}>Everything on the card ships in one .vcf file.</div>
    <PillBtn label={'Export ' + c.f + '.vcf'} onPress={()=>go('done')}/>
  </div>;
  if (view === 'done') return <div style={{padding:'18px 20px 22px', textAlign:'center'}}>
    <span style={{display:'inline-grid', placeItems:'center', width:54, height:54, borderRadius:'50%', background:'var(--tk-green)', color:'#fff', marginBottom:10}}><Icon name="check" size={26} sw={3}/></span>
    <div style={{fontSize:17, fontWeight:700}}>Card shared</div>
    <div style={{fontSize:13, color:'var(--tk-label2)', margin:'4px 0 16px'}}>{c.f} {c.l} is on the way.</div>
    <PillBtn label="Done" onPress={onClose}/>
  </div>;
  return <div style={{padding:'10px 16px 14px'}}>
    <div style={{fontSize:13, color:'var(--tk-label2)', margin:'0 2px 10px'}}>Pick how to share {c.f}’s card.</div>
    {opt('pulse', 'QR Code', 'Scan in person', ()=>go('qr'))}
    {opt('mail', 'Export vCard', 'Send the .vcf anywhere', ()=>go('vcard'))}
    {opt('message', 'Copy Link', 'touchkit.app/c/' + c.id, ()=>go('done'))}
  </div>;
}

/* ══════════ Demo app — composed from TouchKit ══════════ */
const GROUPS = [
  {name:'Work', color:'#0A84FF'}, {name:'Family', color:'#34C759'},
  {name:'Friends', color:'#FF9F0A'}, {name:'Climbing', color:'#FF375F'}
];
const RAW = [
['Amelia','Adler','Producer','Northlake Studio','Work',1],
['Tunde','Abara','Data Engineer','Fielder Labs','Work',0],
['Sofia','Alvarez','Pediatrician','Bayview Clinic','Friends',0],
['Marcus','Bishop','Architect','Form & Field','Work',0],
['Elena','Barros','Chef','Copper Kitchen','Friends',1],
['Rowan','Blackwood','Novelist','','',0],
['June','Calloway','Illustrator','Inkwell Co','Friends',0],
['Wei','Chen','iOS Engineer','Parallel','Work',1],
['Mateus','Costa','Physiotherapist','Motionworks','Climbing',0],
['Yara','Delacroix','Curator','MOAD','',0],
['Rafael','Duarte','Barista','Cortado','Friends',0],
['Nia','Ellery','Attorney','Ellery & Park','Work',0],
['Vivian','Eng','Product Designer','Parallel','Work',0],
['Cole','Farrow','Photographer','','',0],
['Margaux','Fontaine','Sommelier','Vin Petit','Friends',0],
['Declan','Gallagher','Contractor','Gallagher Bros','Family',0],
['Lian','Guo','Research Lead','Fielder Labs','Work',0],
['Imogen','Hale','Violinist','City Symphony','',1],
['Theo','Holloway','Teacher','Lakeside High','Family',0],
['Mei','Huang','Cardiologist','St. Annes','',0],
['Camila','Ibarra','Landscape Architect','Terrafirma','Work',0],
['Freya','Jansen','Pilot','Meridian Air','',0],
['Dev','Joshi','Backend Engineer','Parallel','Work',0],
['Anya','Kowalski','Climbing Coach','Boulder Barn','Climbing',1],
['Omar','Khan','Journalist','The Ledger','',0],
['Haruki','Kimura','Game Designer','Pixelfold','Friends',0],
['Astrid','Lindqvist','UX Researcher','Parallel','Work',0],
['Camille','Laurent','Pastry Chef','Mille-Feuille','Friends',0],
['Kevin','Lam','Accountant','Lam & Co','Family',0],
['Colette','Moreau','Editor','Gullwing Press','Work',0],
['Jasper','Mercer','Bartender','The Alcove','Friends',0],
['Priya','Menon','Neurologist','St. Annes','',0],
['Kenji','Nakamura','Woodworker','Grain Studio','Climbing',0],
['Petra','Novak','Translator','','',0],
['Chidi','Okafor','Founder','Lattice Health','Work',1],
['Lucia','Ortiz','Muralist','','Friends',0],
['Dmitri','Petrov','Chess Coach','','',0],
['Linh','Pham','Florist','Stem & Co','Family',0],
['Saoirse','Quinn','Marine Biologist','Coastal Institute','',0],
['Ezra','Rhodes','Sound Engineer','Northlake Studio','Work',0],
['Isabela','Rosario','Yoga Instructor','Stillpoint','Friends',0],
['Tomas','Reyes','Electrician','Reyes Electric','Family',0],
['Hana','Sato','Animator','Pixelfold','Work',1],
['Julian','Sterling','Financial Advisor','Sterling Wealth','',0],
['Beatriz','Silva','Dentist','Smile SF','Family',0],
['Aiko','Tanaka','Ceramicist','Kiln House','Friends',0],
['August','Thorne','Park Ranger','Redwood NP','Climbing',0],
['Rin','Ueda','Concept Artist','Pixelfold','Work',0],
['Miriam','Vance','Librarian','Central Library','Family',0],
['Zsofia','Varga','Physicist','Ion Lab','',0],
['Desmond','Whitfield','Jazz Pianist','Blue Door','Friends',0],
['Clara','Winters','Veterinarian','Paws Clinic','Family',0],
['Lin','Yang','Route Setter','Boulder Barn','Climbing',1],
['Nadia','Zhang','VC Partner','Crescent Capital','Work',0],
['Piotr','Zielinski','Baker','Rye & Co','Friends',0]
];
const CONTACTS = RAW.map((r,i)=>({
  id:(r[0]+r[1]).toLowerCase().replace(/[^a-z]/g,''), f:r[0], l:r[1], role:r[2], com:r[3], g:r[4], fav:!!r[5],
  ph:`(628) 555-0${(113 + i*37) % 900 + 100}`,
  em:(r[0]+'.'+r[1]).toLowerCase().replace(/[^a-z.]/g,'')+'@'+(r[3]?r[3].toLowerCase().replace(/[^a-z]/g,''):'hey')+'.com'
}));
const RECENTS = new Set(['ameliaadler','weichen','anyakowalski','hanasato','chidiokafor','junecalloway','ezrarhodes','linyang']);
const RINGTONES = ['Reflection','Chimes','Circuit','Cosmic','Duet','Night Owl','Presto','Radiate','Signal','Silk','Stargaze','Summit'];
const NOTES = {
  weichen:'Ships the haptics engine. Wants the index-scrub tick at exactly 4ms.',
  anyakowalski:'Tuesday 6am sessions. Bring chalk, she never has spare.',
  ameliaadler:'Prefers async voice memos over meetings.',
  hanasato:'Working on the onboarding animation — check in Friday.',
  chidiokafor:'Intro to the Parallel design team pending.'
};
const TINTS = ['#0A84FF','#5E5CE6','#30B0C7','#34C759','#FF9F0A','#FF375F'];

function sq(color, icon) {
  return <span style={{width:29, height:29, borderRadius:7, background:color, display:'grid', placeItems:'center', flexShrink:0}}>
    <Icon name={icon} size={17} sw={2} style={{color:'#fff'}}/></span>;
}
function Card({children, mb}) {
  return <div style={{background:'var(--tk-card)', borderRadius:12, overflow:'hidden', marginBottom:mb==null?18:mb}}>{children}</div>;
}
function Field({k, v, tint, last}) {
  return <div style={{padding:'9px 16px', boxShadow:last?'none':'inset 0 -1px 0 var(--tk-sep)'}}>
    <div style={{fontSize:12.5, color:'var(--tk-label2)'}}>{k}</div>
    <div style={{fontSize:16.5, color:tint?'var(--tk-tint)':'var(--tk-label)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis'}}>{v}</div>
  </div>;
}
function SearchField({q, setQ}) {
  return <div style={{display:'flex', alignItems:'center', gap:7, background:'var(--tk-fill)', borderRadius:11, padding:'7px 9px'}}>
    <Icon name="search" size={17} sw={2.2} style={{color:'var(--tk-label2)'}}/>
    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search" aria-label="Search contacts"
      style={{flex:1, border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontSize:17,
        color:'var(--tk-label)', padding:0, minWidth:0, userSelect:'text', WebkitUserSelect:'text'}}/>
    {q ? <button className="tk-btn" onClick={()=>setQ('')} aria-label="Clear search"
      style={{border:0, background:'none', padding:0, cursor:'pointer', color:'var(--tk-label3)', display:'grid'}}><Icon name="xcirc" size={18}/></button> : null}
  </div>;
}
function DetailView({c, fav, onFav, ringtone, onRing, onDelete, onShare}) {
  if (!c) return null;
  return <div style={{padding:'0 16px'}}>
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 0 18px'}}>
      <Avatar c={c} size={92}/>
      <div style={{fontSize:26, fontWeight:700, marginTop:12, letterSpacing:'-.3px'}}>{c.f} {c.l}</div>
      <div style={{fontSize:14.5, color:'var(--tk-label2)', marginTop:3}}>{c.role}{c.com?' · '+c.com:''}</div>
      <div style={{display:'flex', gap:10, marginTop:18, width:'100%', maxWidth:430}}>
        {[['message','Message'],['phone','Call'],['video','Video'],['mail','Mail']].map(a=>
          <button key={a[0]} className="tk-btn tk-hl" onClick={()=>Haptics.impact('light')}
            style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'11px 0 9px', border:0,
              borderRadius:12, background:'var(--tk-card)', color:'var(--tk-tint)', cursor:'pointer', fontFamily:'inherit'}}>
            <Icon name={a[0]} size={20}/><span style={{fontSize:11.5}}>{a[1]}</span>
          </button>)}
      </div>
    </div>
    <Card>
      <Field k="mobile" v={c.ph} tint/>
      <Field k="email" v={c.em} tint last={!c.g}/>
      {c.g ? <Field k="group" v={c.g} last/> : null}
    </Card>
    <Card><TKRow title="Ringtone" accessory="chevron" onPress={onRing}
      trailing={<span style={{fontSize:16, color:'var(--tk-label2)'}}>{ringtone}</span>}/>
    <TKRow title="Share Contact" accessory="chevron" onPress={onShare} divider={false}
      trailing={<span style={{fontSize:13, color:'var(--tk-label3)'}}>Credenza</span>}/></Card>
    {NOTES[c.id] ? <Card><div style={{padding:'10px 16px 12px'}}>
      <div style={{fontSize:12.5, color:'var(--tk-label2)', marginBottom:3}}>Notes</div>
      <div style={{fontSize:15.5, lineHeight:1.45}}>{NOTES[c.id]}</div></div></Card> : null}
    <Card><TKRow title="Favorite" divider={false}
      leading={<Icon name={fav?'starF':'star'} size={21} style={{color:fav?'#FF9F0A':'var(--tk-label3)'}}/>}
      trailing={<TKSwitch checked={fav} onChange={onFav}/>}/></Card>
    <Card><TKRow title="Delete Contact" center destructive onPress={onDelete} divider={false}/></Card>
  </div>;
}
function RingtonePick({value, onPick}) {
  return <TKList inset><TKSection footer="Selection ticks fire through Haptics.selection() — the same call the A–Z index uses.">
    {RINGTONES.map((r,i)=><TKRow key={r} title={r} accessory="check" checked={value===r} rowRole="option"
      onPress={()=>{onPick(r); Haptics.selection();}} divider={i<RINGTONES.length-1}/>)}
  </TKSection></TKList>;
}
function AboutView() {
  const map = [
    ['UINavigationController','<NavigationStack> — push, pop, edge-swipe back'],
    ['UISplitViewController','<SplitView> — collapses columns into the stack'],
    ['UITabBarController','<TabBar> — nest it anywhere in the tree'],
    ['UITableView','<List> · <Section sticky> · <Row swipeable>'],
    ['Section index titles','<IndexBar> — haptic tick per letter'],
    ['Sheets / trays','<Credenza> — dialog ⇄ tray, morphing states'],
    ['Inspector column','<SideDrawer> — fixed · overlay · pushed page'],
    ['UIFeedbackGenerator','Haptics.impact / .selection / .notification']
  ];
  return <TKList inset>
    <div style={{padding:'2px 4px 18px', fontSize:15.5, lineHeight:1.5, color:'var(--tk-label2)'}}>
      TouchKit ports Cocoa Touch's container controllers to JSX. Like Android XML views, the tree is the behavior —
      nest containers differently and navigation changes, no mode flags. One haptics engine drives every interaction.</div>
    <TKSection title="Dictionary">
      {map.map((m,i)=><div key={m[0]} style={{padding:'9px 16px', background:'var(--tk-card)', boxShadow:i<map.length-1?'inset 0 -1px 0 var(--tk-sep)':'none'}}>
        <div style={{fontSize:12.5, color:'var(--tk-label2)'}}>{m[0]}</div>
        <div style={{fontFamily:'ui-monospace,Menlo,monospace', fontSize:13.5, color:'var(--tk-tint)', marginTop:2}}>{m[1]}</div>
      </div>)}
    </TKSection>
    <TKSection title="Semantics" footer="Rows are real buttons with listbox roles, arrow-key navigation, Esc pops the stack, visible focus rings — the react-aria interaction model, swap-in ready.">
      <TKRow title="Version" trailing={<span style={{color:'var(--tk-label2)', fontSize:16}}>0.1.0</span>} divider={false}/>
    </TKSection>
  </TKList>;
}
/* ══ Haptics Playground — the vibrator.dev homepage set: magic toggle, brightness, haptic slider,
   slide-to-unlock, timer wheels. Every surface calls Haptics/navigator.vibrate inside the live gesture. ══ */
function Sun({size, color}) {
  return <svg width={size||20} height={size||20} viewBox="0 0 24 24" fill="none" stroke={color||'currentColor'} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/></svg>;
}
function ShowMagicRow() {
  const [on, setOn] = useState(false);
  const [note, setNote] = useState(null);
  const toggle = async v => {
    setOn(v); Haptics.impact('light');
    try {
      const m = window.__tkVibM || (window.__tkVibM = await import('https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm'));
      if (m.enableDebugMode) { m.enableDebugMode(v); setNote(v ? 'Overlay switches are now visible' : null); }
      else setNote('debug API missing in this build');
    } catch(e) { setNote('polyfill only loads in Safari'); }
  };
  return <TKRow leading={sq('#BF5AF2','wave')} title="Show the magic!" divider={false}
    subtitle={note || 'Reveal the hidden switch overlays the polyfill drives'}
    trailing={<TKSwitch checked={on} onChange={toggle}/>}/>;
}
function BrightnessSlider() {
  const [v, setV] = useState(0.55);
  const ref = useRef(null); const det = useRef(9);
  const move = e => {
    const r = ref.current.getBoundingClientRect();
    const nv = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); setV(nv);
    const d = Math.round(nv*16); if (d !== det.current) { det.current = d; Haptics.selection(); }
  };
  return <div ref={ref} role="slider" aria-label="Brightness" aria-valuenow={Math.round(v*100)} tabIndex={0}
    onPointerDown={e=>{ e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
    onPointerMove={e=>{ if (e.buttons) move(e); }}
    onKeyDown={e=>{ if (e.key==='ArrowLeft'||e.key==='ArrowRight'){ setV(x=>Math.min(1,Math.max(0,x+(e.key==='ArrowRight'?0.0625:-0.0625)))); Haptics.selection(); e.preventDefault(); } }}
    style={{position:'relative', height:64, borderRadius:18, background:'var(--tk-fill2)', overflow:'hidden', touchAction:'none', cursor:'ew-resize'}}>
    <div style={{position:'absolute', top:0, bottom:0, left:0, width:(v*100)+'%', background:'rgba(255,255,255,.94)'}}/>
    <span style={{position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', color:'rgba(60,60,67,.62)', display:'grid'}}><Sun size={22}/></span>
  </div>;
}
function HapticSlider() {
  const [v, setV] = useState(0.5);
  const last = useRef(0);
  return <div style={{display:'flex', alignItems:'center', gap:14}}>
    <input type="range" className="tk-range" min="0" max="1" step="0.01" value={v} aria-label="Haptic slider"
      style={{flex:1, '--tk-range-fill':(v*100)+'%'}}
      onChange={e=>{ setV(+e.target.value);
        const now = performance.now(); if (now - last.current > 16) { last.current = now; Haptics.selection(); } }}/>
    <span style={{fontFamily:'ui-monospace,Menlo,monospace', fontSize:14.5, color:'var(--tk-label2)', width:36, textAlign:'right', flexShrink:0}}>{v.toFixed(2)}</span>
  </div>;
}
function SlideToUnlock() {
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef(null); const xr = useRef(0); const det = useRef(0);
  const travel = () => { const r = ref.current && ref.current.getBoundingClientRect(); return r ? r.width - 8 - 48 : 220; };
  const move = e => {
    if (done) return;
    const r = ref.current.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left - 28) / travel()));
    xr.current = nx; setX(nx);
    const d = Math.round(nx*12); if (d !== det.current) { det.current = d; Haptics.selection(); }
  };
  const up = () => {
    setDrag(false);
    if (done) return;
    if (xr.current > 0.92) {
      setDone(true); xr.current = 1; setX(1); Haptics.notification('success');
      setTimeout(()=>{ setDone(false); xr.current = 0; setX(0); det.current = 0; }, 1500);
    } else { xr.current = 0; setX(0); det.current = 0; }
  };
  return <div ref={ref} style={{position:'relative', height:56, borderRadius:28, background:'var(--tk-fill)',
      boxShadow:'inset 0 1px 3px rgba(0,0,0,.12)', overflow:'hidden'}}>
    <span aria-hidden="true" className={done?'':'tk-shimmer'} style={{position:'absolute', inset:0, display:'grid', placeItems:'center',
      fontSize:17, letterSpacing:'.4px', color:done?'var(--tk-green)':undefined, fontWeight:done?600:400, opacity:done?1:Math.max(0, 1 - x*1.7)}}>
      {done ? 'unlocked' : 'slide to unlock'}</span>
    <button className="tk-btn" aria-label="Slide to unlock"
      onPointerDown={e=>{ e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); }}
      onPointerMove={e=>{ if (drag) move(e); }}
      onPointerUp={up} onPointerCancel={up}
      style={{position:'absolute', top:4, left:4 + x*travel(), width:48, height:48, borderRadius:24, border:0, padding:0,
        background:'var(--tk-card)', boxShadow:'0 2px 6px rgba(0,0,0,.22)', cursor:'grab', touchAction:'none',
        display:'grid', placeItems:'center', color:done?'var(--tk-green)':'var(--tk-label2)',
        transition:drag?'none':'left .38s '+EASE}}>
      <Icon name={done?'check':'chev'} size={22} sw={2.4}/></button>
  </div>;
}
function WheelDrum({n, init, label}) {
  const H = 34, VIS = 5;
  const [off, setOff] = useState(-(init||0)*H);
  const [anim, setAnim] = useState(false);
  const st = useRef({drag:false, y0:0, off0:0, y:0, t:0, v:0, raf:0, det:init||0});
  const clampHard = o => Math.min(0, Math.max(-(n-1)*H, o));
  const tick = o => { const d = Math.max(0, Math.min(n-1, Math.round(-o/H))); if (d !== st.current.det) { st.current.det = d; Haptics.selection(); } };
  const settle = o => { const t = clampHard(Math.round(o/H)*H); setAnim(true); setOff(t); tick(t); };
  const down = e => {
    cancelAnimationFrame(st.current.raf);
    e.currentTarget.setPointerCapture(e.pointerId);
    st.current = {...st.current, drag:true, y0:e.clientY, off0:off, y:e.clientY, t:performance.now(), v:0};
    setAnim(false);
  };
  const move = e => {
    const s = st.current; if (!s.drag) return;
    const now = performance.now();
    if (now - s.t > 4) { s.v = (e.clientY - s.y) / (now - s.t); s.y = e.clientY; s.t = now; }
    let o = s.off0 + (e.clientY - s.y0);
    const c = clampHard(o); if (o !== c) o = c + (o - c)*0.32;
    setOff(o); tick(o);
  };
  const up = () => {
    const s = st.current; if (!s.drag) return; s.drag = false;
    let o = off, v = s.v*16;
    if (Math.abs(v) < 1.2) { settle(o); return; }
    const glide = () => {
      o += v; v *= 0.93;
      if (o > 0 || o < -(n-1)*H) { o = clampHard(o); v = 0; }
      setOff(o); tick(o);
      if (Math.abs(v) > 0.6) st.current.raf = requestAnimationFrame(glide); else settle(o);
    };
    st.current.raf = requestAnimationFrame(glide);
  };
  const idx = -off/H;
  return <div style={{display:'flex', alignItems:'center', gap:7, flex:1, minWidth:0, justifyContent:'center'}}>
    <div role="spinbutton" aria-label={label} aria-valuenow={st.current.det} tabIndex={0}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onWheel={e=>{ e.preventDefault(); const d = e.deltaY > 0 ? 1 : -1; settle(clampHard((Math.round(-off/H)+d)*-H)); }}
      onKeyDown={e=>{ if (e.key==='ArrowUp'||e.key==='ArrowDown'){ settle(clampHard((Math.round(-off/H)+(e.key==='ArrowDown'?1:-1))*-H)); e.preventDefault(); } }}
      style={{position:'relative', height:H*VIS, width:52, overflow:'hidden', touchAction:'none', cursor:'ns-resize', flexShrink:0}}>
      <div style={{position:'absolute', left:-4, right:-4, top:(VIS-1)/2*H, height:H, borderRadius:9, background:'var(--tk-fill)'}}/>
      <div style={{position:'absolute', left:0, right:0, top:(VIS-1)/2*H, transform:'translateY('+off+'px)',
          transition:anim?'transform .3s cubic-bezier(.25,.8,.25,1)':'none'}}>
        {Array.from({length:n}, (_,i)=>{
          const dist = Math.min(2.6, Math.abs(i - idx));
          return <div key={i} style={{height:H, display:'grid', placeItems:'center', fontSize:21,
            color:'var(--tk-label)', opacity:Math.max(0.16, 1 - dist*0.34), fontVariantNumeric:'tabular-nums'}}>{i}</div>;
        })}
      </div>
      <div style={{position:'absolute', left:0, right:0, top:0, height:H*1.4, background:'linear-gradient(var(--tk-card), transparent)', pointerEvents:'none'}}/>
      <div style={{position:'absolute', left:0, right:0, bottom:0, height:H*1.4, background:'linear-gradient(transparent, var(--tk-card))', pointerEvents:'none'}}/>
    </div>
    <span style={{fontSize:13, fontWeight:600, color:'var(--tk-label2)'}}>{label}</span>
  </div>;
}
function HapticsPlayground() {
  const [, bump] = useState(0);
  useEffect(()=>{
    const h = ()=>setTimeout(()=>bump(x=>x+1), 40);
    window.addEventListener('tk-vib', h);
    const t = setInterval(()=>bump(x=>x+1), 1200);
    const stop = setTimeout(()=>clearInterval(t), 10000);
    return ()=>{ window.removeEventListener('tk-vib', h); clearInterval(t); clearTimeout(stop); };
  }, []);
  return <TKList inset>
    <div style={{padding:'2px 4px 14px', fontSize:15, lineHeight:1.5, color:'var(--tk-label2)'}}>
      The playground from <span style={{fontFamily:'ui-monospace,Menlo,monospace', fontSize:13.5}}>vibrator.dev</span> — on an iPhone or MacBook, in Safari, you'll feel haptic feedback as you slide these elements. <span style={{color:'var(--tk-label3)'}}>(If you don't feel anything, drag slower.)</span></div>
    <div style={{padding:'0 4px 16px', fontFamily:'ui-monospace,Menlo,monospace', fontSize:12, color:'var(--tk-label3)'}}>engine: {Haptics.engine}</div>
    <TKSection><ShowMagicRow/></TKSection>
    <TKSection title="Brightness">
      <div style={{background:'var(--tk-card)', borderRadius:12, padding:14}}><BrightnessSlider/></div>
    </TKSection>
    <TKSection title="Haptic slider">
      <div style={{background:'var(--tk-card)', borderRadius:12, padding:'10px 14px'}}><HapticSlider/></div>
    </TKSection>
    <TKSection title="Slide to unlock">
      <div style={{background:'var(--tk-card)', borderRadius:12, padding:10}}><SlideToUnlock/></div>
    </TKSection>
    <TKSection title="Timer" footer="A selection tick per detent — Haptics.selection(), the same call the A–Z index scrubber makes. Flick a wheel: ticks ride the momentum. Playground set recreated from vibrator.dev — ios-vibrator-pro-max by @samdenty (MIT).">
      <div style={{background:'var(--tk-card)', borderRadius:12, padding:'8px 10px', display:'flex', gap:2}}>
        <WheelDrum n={24} init={1} label="hours"/>
        <WheelDrum n={60} init={30} label="min"/>
        <WheelDrum n={60} init={15} label="sec"/>
      </div>
    </TKSection>
  </TKList>;
}
function SettingsView({s}) {
  const tests = [
    ['Impact · Light', ()=>Haptics.impact('light')],
    ['Impact · Medium', ()=>Haptics.impact('medium')],
    ['Impact · Heavy', ()=>Haptics.impact('heavy')],
    ['Selection tick', ()=>Haptics.selection()],
    ['Notification · Success', ()=>Haptics.notification('success')],
    ['Notification · Warning', ()=>Haptics.notification('warning')],
    ['Notification · Error', ()=>Haptics.notification('error')]
  ];
  return <TKList inset>
    <TKSection title="Composition" footer="TouchKit has no tab-bar mode flag — behavior falls out of how containers nest in JSX. This switch remounts the demo with the other tree; state survives.">
      <TKRow leading={sq('#5E5CE6','layers')} title="NavigationStack inside TabView" subtitle="Bar persists — each tab keeps its stack"
        accessory="check" checked={s.comp==='nav-in-tabs'} onPress={()=>{s.setComp('nav-in-tabs'); Haptics.impact('light');}}/>
      <TKRow leading={sq('#0A84FF','layers')} title="TabView inside NavigationStack" subtitle="Bar rides the root view — pushes cover it"
        accessory="check" checked={s.comp==='tabs-in-nav'} onPress={()=>{s.setComp('tabs-in-nav'); Haptics.impact('light');}} divider={false}/>
    </TKSection>
    <TKSection title="Contacts table view" footer="UITableView styles: .plain keeps sticky letter headers; .insetGrouped floats each letter section as a card.">
      <TKRow leading={sq('#30B0C7','layers')} title="Plain" subtitle="Edge-to-edge rows, sticky headers"
        accessory="check" checked={s.listStyle==='plain'} onPress={()=>{s.setListStyle('plain'); Haptics.selection();}}/>
      <TKRow leading={sq('#34C759','layers')} title="Grouped" subtitle="Inset card sections"
        accessory="check" checked={s.listStyle==='grouped'} onPress={()=>{s.setListStyle('grouped'); Haptics.selection();}} divider={false}/>
    </TKSection>
    <TKSection title="Haptics">
      <TKRow leading={sq('#FF9F0A','wave')} title="Haptics" trailing={<TKSwitch checked={s.hap} onChange={s.setHap}/>}/>
      <TKRow leading={sq('#8E8E93','pulse')} title="Pulse indicator" subtitle="Visualize haptic events on-screen"
        trailing={<TKSwitch checked={s.ind} onChange={s.setInd}/>}/>
      <TKRow leading={sq('#BF5AF2','wave')} title="Haptics Playground" subtitle="Sliders · slide to unlock · timer wheels"
        accessory="chevron" onPress={()=>{ s.openPlay(); Haptics.impact('light'); }} divider={false}/>
    </TKSection>
    <TKSection title="Test patterns" footer={'Engine here: ' + Haptics.engine + '. Pulses appear on-screen while the indicator is on.'}>
      {tests.map((t,i)=><TKRow key={t[0]} title={t[0]} onPress={t[1]} divider={i<tests.length-1}
        trailing={<Icon name="wave" size={19} sw={2} style={{color:'var(--tk-tint)'}}/>}/>)}
    </TKSection>
    <TKSection title="Appearance">
      <TKRow leading={sq('#3A3A3C','moon')} title="Dark Mode" trailing={<TKSwitch checked={s.dark} onChange={s.setDark}/>}/>
      <TKRow leading={sq(s.tint,'drop')} title="Tint" divider={false} trailing={
        <span style={{display:'flex', gap:8}}>{TINTS.map(c=>
          <button key={c} className="tk-btn" onClick={()=>{s.setTint(c); Haptics.selection();}} aria-label={'Tint '+c}
            style={{width:24, height:24, borderRadius:'50%', border:0, cursor:'pointer', background:c, padding:0,
              boxShadow:s.tint===c?('0 0 0 2px var(--tk-card), 0 0 0 4px '+c):'none', transition:'box-shadow .15s'}}/>)}</span>}/>
    </TKSection>
    <TKSection title="About">
      <TKRow leading={sq('#0A84FF','info')} title="About TouchKit" accessory="chevron" onPress={s.openAbout} divider={false}/>
    </TKSection>
  </TKList>;
}
function Sidebar({wc, tab, onTab, filter, onFilter, counts, drawer, onClose}) {
  const row = (id, icon, label, count, selected, onClick, dot) =>
    <button key={id} className="tk-btn" onClick={onClick}
      style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'8px 10px', border:0, borderRadius:9,
        background:selected?'var(--tk-press)':'transparent', color:'var(--tk-label)', fontFamily:'inherit', fontSize:15.5,
        cursor:'pointer', textAlign:'left', boxSizing:'border-box'}}>
      {dot ? <span style={{width:11, height:11, borderRadius:'50%', background:dot, flexShrink:0, margin:'0 4px'}}/>
           : <Icon name={icon} size={19} sw={2} style={{color:'var(--tk-tint)'}}/>}
      <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{label}</span>
      {count != null ? <span style={{fontSize:13.5, color:'var(--tk-label3)'}}>{count}</span> : null}
    </button>;
  const sec = t => <div style={{padding:'16px 10px 5px', fontSize:11.5, fontWeight:600, letterSpacing:'.5px', textTransform:'uppercase', color:'var(--tk-label2)'}}>{t}</div>;
  return <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column', boxSizing:'border-box'}}>
    <div style={{padding:'14px 14px 2px', display:'flex', alignItems:'center', gap:8}}>
      <span style={{width:24, height:24, borderRadius:6, background:'linear-gradient(135deg, var(--tk-tint), #5E5CE6)', display:'grid', placeItems:'center', flexShrink:0}}>
        <Icon name="wave" size={14} sw={2.2} style={{color:'#fff'}}/></span>
      <span style={{fontSize:16, fontWeight:800, letterSpacing:'-.2px'}}>TouchKit</span>
      {drawer ? <button className="tk-btn" onClick={onClose} aria-label="Close sidebar"
        style={{marginLeft:'auto', border:0, background:'none', cursor:'pointer', color:'var(--tk-label3)', display:'grid', padding:4}}>
        <Icon name="xcirc" size={22}/></button> : null}
    </div>
    <div className="tk-scroll" style={{flex:1, overflowY:'auto', padding:'0 10px 12px'}}>
      {wc === 'regular' ? <React.Fragment>
        {sec('App')}
        {row('t1','person','Contacts',null,tab==='contacts',()=>{Haptics.selection(); onTab('contacts');})}
        {row('t2','sliders','Settings',null,tab==='settings',()=>{Haptics.selection(); onTab('settings');})}
      </React.Fragment> : null}
      {sec('Library')}
      {row('all','person2','All Contacts',counts.all,tab==='contacts'&&filter.type==='all',()=>onFilter({type:'all'}))}
      {row('fav','star','Favorites',counts.fav,tab==='contacts'&&filter.type==='fav',()=>onFilter({type:'fav'}))}
      {row('rec','clock','Recents',counts.rec,tab==='contacts'&&filter.type==='rec',()=>onFilter({type:'rec'}))}
      {sec('Groups')}
      {GROUPS.map(g=>row('g'+g.name,null,g.name,counts.groups[g.name]||0,tab==='contacts'&&filter.type==='group'&&filter.g===g.name,()=>onFilter({type:'group',g:g.name}),g.color))}
    </div>
    <div style={{padding:'10px 16px', fontSize:11.5, color:'var(--tk-label3)', borderTop:'1px solid var(--tk-sep)'}}>TouchKit 0.1 · demo data</div>
  </div>;
}

/* ══ App root ══ */
function App(props) {
  const rootRef = useRef(null);
  const secEls = useRef({});
  /* Dynamic Island floor for this app frame — the nav bar never collapses past it. */
  const safeIns = props.safeTop === true || props.safeTop === 'true' ? 59 : (parseFloat(props.safeTop) || 0);
  const [wc, setWc] = useState('regular');
  const [tab, setTab] = useState('contacts');
  const [sel, setSel] = useState(null);
  const [ring, setRing] = useState(false);
  const [sub, setSub] = useState(null);
  const [filter, setFilter] = useState({type:'all'});
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState(()=>new Set());
  const [act, setAct] = useState(false);
  const [share, setShare] = useState(null);
  const [xw, setXw] = useState(false);
  const [listStyle, setListStyle] = useState(props.listStyle === 'grouped' ? 'grouped' : 'plain');
  const [comp, setComp] = useState(props.composition === 'tabs-in-nav' ? 'tabs-in-nav' : 'nav-in-tabs');
  const [dark, setDark] = useState(!!props.dark);
  const [tint, setTint] = useState(props.tint || '#0A84FF');
  const [hap, setHap] = useState(true);
  const [ind, setInd] = useState(props.indicator === true || props.indicator === 'true');
  const [favs, setFavs] = useState(()=>new Set(CONTACTS.filter(c=>c.fav).map(c=>c.id)));
  const [gone, setGone] = useState(()=>new Set());
  const [tones, setTones] = useState({});
  useEffect(()=>{ setComp(props.composition === 'tabs-in-nav' ? 'tabs-in-nav' : 'nav-in-tabs'); }, [props.composition]);
  useEffect(()=>{ setDark(!!props.dark && props.dark !== 'false'); }, [props.dark]);
  useEffect(()=>{ if (props.tint) setTint(props.tint); }, [props.tint]);
  useEffect(()=>{ setInd(props.indicator === true || props.indicator === 'true'); }, [props.indicator]);
  useEffect(()=>{ setListStyle(props.listStyle === 'grouped' ? 'grouped' : 'plain'); }, [props.listStyle]);
  useEffect(()=>{ Haptics.boot(); loadMotion(); }, []);
  useEffect(()=>{ Haptics.enabled = hap; }, [hap]);
  useLayoutEffect(()=>{ const el = rootRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(en=>{ const w = en[0].contentRect.width; setWc(w < 640 ? 'compact' : w < 1024 ? 'medium' : 'regular'); setXw(w >= 1280); });
    ro.observe(el); return ()=>ro.disconnect(); }, []);
  const collapsed = wc !== 'regular';
  const alive = CONTACTS.filter(c=>!gone.has(c.id));
  const counts = {all:alive.length, fav:alive.filter(c=>favs.has(c.id)).length, rec:alive.filter(c=>RECENTS.has(c.id)).length,
    groups:GROUPS.reduce((a,g)=>{ a[g.name] = alive.filter(c=>c.g===g.name).length; return a; }, {})};
  const matchF = c => filter.type==='all' ? true : filter.type==='fav' ? favs.has(c.id) : filter.type==='rec' ? RECENTS.has(c.id) : c.g === filter.g;
  const ql = q.trim().toLowerCase();
  const matchQ = c => !ql || (c.f+' '+c.l+' '+c.com+' '+c.role).toLowerCase().includes(ql);
  const visible = alive.filter(c=>matchF(c) && matchQ(c));
  const sections = AL.map(L=>({L, items:visible.filter(c=>c.l[0].toUpperCase()===L)})).filter(s=>s.items.length);
  const avail = new Set(sections.map(s=>s.L));
  const selC = sel ? visible.concat(alive).find(c=>c.id===sel) || null : null;
  const listTitle = filter.type==='all' ? 'Contacts' : filter.type==='fav' ? 'Favorites' : filter.type==='rec' ? 'Recents' : filter.g;
  const selN = pick.size;
  const jump = L => {
    const i = AL.indexOf(L); let t = null;
    for (let j = i; j >= 0; j--) if (avail.has(AL[j])) { t = AL[j]; break; }
    if (!t) for (let j = i+1; j < AL.length; j++) if (avail.has(AL[j])) { t = AL[j]; break; }
    const el = t && secEls.current[t]; if (!el) return;
    const s = el.closest('.tk-scroll'); if (!s) return;
    s.scrollTop = s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top - BARH - safeIns + 1;
  };
  const togglePick = id => { const n = new Set(pick); n.has(id) ? n.delete(id) : n.add(id); setPick(n); Haptics.selection(); };
  const delOne = id => { setGone(g=>new Set([...g, id])); if (sel === id) setSel(null); };
  const exitEdit = () => { setEdit(false); setPick(new Set()); };
  const popContacts = () => { if (ring) setRing(false); else if (act && wc === 'compact') setAct(false); else setSel(null); };
  const popActive = () => { if (tab === 'contacts') popContacts(); else setSub(null); };
  const grouped = listStyle === 'grouped';
  const listContent = <div style={{padding:grouped ? '0 16px' : 0}}>
    {sections.length === 0 ? <div style={{padding:'60px 24px', textAlign:'center', color:'var(--tk-label2)', fontSize:15}}>No results{ql?' for \u201c'+q+'\u201d':''}</div> : null}
    {sections.map(s=><TKSection key={s.L} sticky={!grouped} title={s.L} innerRef={el=>{ if (el) secEls.current[s.L] = el; }}>
      {s.items.map((c,i)=><TKRow key={c.id} rowRole="option"
        title={<span>{c.f} <span style={{fontWeight:600}}>{c.l}</span></span>}
        subtitle={c.role + (c.com ? ' · ' + c.com : '')}
        leading={<Avatar c={c}/>}
        trailing={favs.has(c.id) ? <Icon name="starF" size={13} style={{color:'#FF9F0A'}}/> : null}
        accessory={edit ? undefined : 'chevron'}
        edit={edit} checked={pick.has(c.id)} selected={!collapsed && sel === c.id && !edit}
        onPress={()=>{ if (edit) togglePick(c.id); else { Haptics.selection(); setSel(c.id); setRing(false); } }}
        onDelete={edit ? undefined : ()=>delOne(c.id)}
        divider={i < s.items.length-1}/>)}
    </TKSection>)}
    {sections.length ? <div style={{padding:'16px 0 4px', textAlign:'center', fontSize:14.5, color:'var(--tk-label2)'}}>
      {visible.length} Contact{visible.length===1?'':'s'}{gone.size ? ' · pull down to restore ' + gone.size + ' deleted' : ''}</div> : null}
  </div>;
  const listScreen = {
    key:'list', title:edit ? (selN ? selN + ' Selected' : 'Select Contacts') : listTitle, largeTitle:true, grouped:grouped,
    subheader:<SearchField q={q} setQ={setQ}/>,
    leading:collapsed ? <button className="tk-btn" onClick={()=>{setDrawer(true); Haptics.impact('light');}} aria-label="Show sidebar"
      style={{border:0, background:'none', cursor:'pointer', color:'var(--tk-tint)', display:'grid', padding:'8px 10px'}}>
      <Icon name="sidebar" size={22} sw={1.9}/></button> : null,
    trailing:<button className="tk-btn" onClick={()=>{ edit ? exitEdit() : setEdit(true); Haptics.impact('light'); }}
      style={{border:0, background:'none', cursor:'pointer', color:'var(--tk-tint)', fontFamily:'inherit', fontSize:17,
        fontWeight:edit?700:400, padding:'8px 10px'}}>{edit?'Done':'Select'}</button>,
    content:listContent,
    overlay:<IndexBar avail={avail} onLetter={jump} top={BARH+4+safeIns} bottom={collapsed?74:10}/>,
    onRefresh:()=>{ if (gone.size) { setGone(new Set()); Haptics.notification('success'); } }
  };
  const detailScreen = selC ? {
    key:'detail', title:selC.f + ' ' + selC.l, titleOnScroll:true, grouped:true, maxW:640,
    trailing:<button className="tk-btn" aria-label="Contact activity" onClick={()=>{ Haptics.impact('light'); setAct(a=>!a); }}
      style={{border:0, background:'none', cursor:'pointer', color:'var(--tk-tint)', display:'grid', padding:'8px 10px'}}>
      <Icon name="clock" size={22} sw={2}/></button>,
    content:<DetailView c={selC} fav={favs.has(selC.id)} ringtone={tones[selC.id] || 'Reflection'}
      onFav={v=>{ const n = new Set(favs); v ? n.add(selC.id) : n.delete(selC.id); setFavs(n); }}
      onRing={()=>setRing(true)}
      onShare={()=>{ Haptics.impact('light'); setShare('menu'); }}
      onDelete={()=>delOne(selC.id)}/>
  } : null;
  const ringScreen = selC && ring ? {
    key:'ring', title:'Ringtone', grouped:true, maxW:640,
    content:<RingtonePick value={tones[selC.id] || 'Reflection'} onPick={r=>setTones({...tones, [selC.id]:r})}/>
  } : null;
  const activityScreen = selC && act && wc === 'compact' ? {
    key:'activity', title:'Activity', grouped:true, maxW:640,
    content:<ActivityView c={selC}/>
  } : null;
  const goShare = v => { if (v === 'done') Haptics.notification('success'); else Haptics.selection(); setShare(v); };
  const settingsScreen = {
    key:'settings', title:'Settings', largeTitle:true, grouped:true, maxW:660,
    content:<SettingsView s={{comp, setComp, listStyle, setListStyle, hap, setHap, ind, setInd, dark, setDark, tint, setTint, openAbout:()=>setSub('about'), openPlay:()=>setSub('play')}}/>
  };
  const aboutScreen = sub === 'about' ? {key:'about', title:'About TouchKit', grouped:true, maxW:660, content:<AboutView/>} : null;
  const playScreen = sub === 'play' ? {key:'play', title:'Haptics Playground', grouped:true, maxW:660, content:<HapticsPlayground/>} : null;
  const contactsScreens = [listScreen, ...(collapsed && detailScreen ? [detailScreen] : []), ...(collapsed && activityScreen ? [activityScreen] : []), ...(collapsed && ringScreen ? [ringScreen] : [])];
  const settingsScreens = [settingsScreen, ...(playScreen ? [playScreen] : []), ...(aboutScreen ? [aboutScreen] : [])];
  const barItems = [{id:'contacts', title:'Contacts', icon:'person'}, {id:'settings', title:'Settings', icon:'sliders'}];
  const switchTab = id => { setTab(id); if (edit) exitEdit(); };
  const sidebarEl = <Sidebar wc={wc} tab={tab} onTab={switchTab} filter={filter} counts={counts} drawer={collapsed}
    onClose={()=>setDrawer(false)}
    onFilter={f=>{ setFilter(f); setTab('contacts'); setSel(null); if (collapsed) setDrawer(false); Haptics.selection(); }}/>;
  const editBarEl = <EditBar count={selN} allFav={selN > 0 && [...pick].every(id=>favs.has(id))}
    onFav={()=>{ const all = [...pick].every(id=>favs.has(id)); const n = new Set(favs);
      pick.forEach(id=>{ all ? n.delete(id) : n.add(id); }); setFavs(n); Haptics.impact('light'); }}
    onDelete={()=>{ setGone(g=>new Set([...g, ...pick])); if (pick.has(sel)) setSel(null); setPick(new Set()); Haptics.notification('warning'); }}/>;
  let body;
  if (!collapsed) {
    body = tab === 'contacts'
      ? <SplitView wc={wc} sidebar={sidebarEl}
          master={<React.Fragment>
            <NavigationStack screens={[listScreen]} onPop={()=>{}}/>
            {edit ? editBarEl : null}
          </React.Fragment>}
          detail={<div style={{display:'flex', height:'100%', minWidth:0}}>
            <div style={{flex:1, position:'relative', minWidth:0}}>
              {detailScreen
                ? <NavigationStack screens={[detailScreen, ...(ringScreen ? [ringScreen] : [])]} onPop={()=>setRing(false)}/>
                : <div style={{height:'100%', display:'grid', placeItems:'center'}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{display:'grid', placeItems:'center', color:'var(--tk-label3)', marginBottom:10}}><Icon name="person" size={52} sw={1.2}/></div>
                      <div style={{fontSize:16, color:'var(--tk-label2)'}}>No Contact Selected</div>
                      <div style={{fontSize:13, color:'var(--tk-label3)', marginTop:4}}>Choose a contact from the list</div>
                    </div>
                  </div>}
            </div>
            <SideDrawer mode="fixed" open={!!(xw && act && selC)} onClose={()=>setAct(false)} title="Activity" width={318}>
              {selC ? <ActivityView c={selC}/> : null}
            </SideDrawer>
          </div>}/>
      : <div style={{display:'flex', height:'100%'}}>
          <div style={{width:264, flexShrink:0, borderRight:'1px solid var(--tk-sep)', background:'var(--tk-side)', transition:'background .25s'}}>{sidebarEl}</div>
          <div style={{flex:1, position:'relative', background:'var(--tk-bg2)', minWidth:0}}>
            <NavigationStack screens={settingsScreens} onPop={popActive}/>
          </div>
        </div>;
  } else if (comp === 'nav-in-tabs') {
    const screens = (tab === 'contacts' ? contactsScreens : settingsScreens).map(s=>({...s, bottomInset:66}));
    body = <React.Fragment>
      <SplitView wc={wc} sidebar={sidebarEl} drawerOpen={drawer} onCloseDrawer={()=>setDrawer(false)}
        master={<NavigationStack screens={screens} onPop={popActive}/>}/>
      {edit && tab === 'contacts' ? editBarEl : <TabBar items={barItems} selected={tab} onSelect={switchTab}/>}
    </React.Fragment>;
  } else {
    const stack = tab === 'contacts' ? contactsScreens : settingsScreens;
    const root = {...stack[0], key:'tabroot', bottomInset:66,
      overlay:<React.Fragment>{stack[0].overlay || null}{edit && tab === 'contacts' ? editBarEl : <TabBar items={barItems} selected={tab} onSelect={switchTab}/>}</React.Fragment>};
    body = <SplitView wc={wc} sidebar={sidebarEl} drawerOpen={drawer} onCloseDrawer={()=>setDrawer(false)}
      master={<NavigationStack screens={[root, ...stack.slice(1)]} onPop={popActive}/>}/>;
  }
  const vars = dark ? {
    '--tk-bg':'#000', '--tk-bg2':'#0A0A0C', '--tk-card':'#1C1C1E', '--tk-label':'#F5F5F7',
    '--tk-label2':'rgba(235,235,245,.62)', '--tk-label3':'rgba(235,235,245,.3)', '--tk-sep':'rgba(84,84,88,.48)',
    '--tk-fill':'rgba(120,120,128,.22)', '--tk-fill2':'rgba(120,120,128,.34)', '--tk-bar':'rgba(16,16,18,.82)',
    '--tk-press':'rgba(120,120,128,.22)', '--tk-stick':'rgba(18,18,20,.9)', '--tk-side':'#111114',
    '--tk-red':'#FF453A', '--tk-green':'#30D158', '--tk-scrim':'rgba(0,0,0,.5)', '--tk-tint':tint
  } : {
    '--tk-bg':'#fff', '--tk-bg2':'#F2F2F7', '--tk-card':'#fff', '--tk-label':'#0B0B0F',
    '--tk-label2':'rgba(60,60,67,.6)', '--tk-label3':'rgba(60,60,67,.33)', '--tk-sep':'rgba(60,60,67,.22)',
    '--tk-fill':'rgba(120,120,128,.13)', '--tk-fill2':'rgba(120,120,128,.24)', '--tk-bar':'rgba(250,250,252,.85)',
    '--tk-press':'rgba(120,120,128,.16)', '--tk-stick':'rgba(244,244,248,.92)', '--tk-side':'#ECECF1',
    '--tk-red':'#FF3B30', '--tk-green':'#34C759', '--tk-scrim':'rgba(0,0,0,.38)', '--tk-tint':tint
  };
  const safe = safeIns;
  return <div ref={rootRef} style={{position:'relative', width:'100%', height:'100%', overflow:'hidden', fontFamily:FONT,
      background:'var(--tk-bg2)', color:'var(--tk-label)', colorScheme:dark?'dark':'light', userSelect:'none', WebkitUserSelect:'none',
      transition:'background .25s', ...vars, '--tk-safe-top':safe + 'px'}}>
    {<TKSafeCtx.Provider value={safe}>{body}</TKSafeCtx.Provider>}
    {safe ? <div style={{position:'absolute', top:Math.max(8, safe / 5), left:'50%', transform:'translateX(-50%)', width:118, height:35,
      borderRadius:18, background:'#000', zIndex:400, pointerEvents:'none'}} aria-hidden="true"/> : null}
    {!xw && tab === 'contacts' ? <SideDrawer mode="overlay" open={!!(act && selC && wc !== 'compact')} onClose={()=>setAct(false)} title="Activity" width={340}>
      {selC ? <ActivityView c={selC}/> : null}
    </SideDrawer> : null}
    <Credenza open={!!(share && selC)} compact={wc === 'compact'} view={share || 'menu'} title={SHARE_T[share] || 'Share Contact'}
      canBack={share === 'qr' || share === 'vcard'} onBack={()=>goShare('menu')} onClose={()=>setShare(null)}>
      {selC ? <ShareViews c={selC} view={share || 'menu'} go={goShare} onClose={()=>setShare(null)}/> : null}
    </Credenza>
    <HapticIndicator visible={ind} bottom={collapsed ? 74 : 14}/>
  </div>;
}

const TouchKit = {use, useChromeHidden, Haptics, Icon, Avatar, TKSwitch, Segmented, Spinner, TKList, TKSection, TKRow, IndexBar, TabBar, NavigationStack, SplitView, Sidebar, Credenza, SideDrawer, ActivityView, HapticsPlayground, App};
window.TouchKit = TouchKit;
if (typeof module !== 'undefined') module.exports = {App, Segmented, HapticsPlayground, Icon, TouchKit};
