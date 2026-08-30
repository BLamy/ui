/* TouchKit Workbench — IDE-scaffold components in TouchKit's language (dark theme).
   Shell regions: ThreadSidebar · ChatView (MessageScroller + Composer) · TerminalDock · SurfacePanel.
   Adaptive: <760px the sidebar becomes a hamburger overlay, the terminal a vaul-style snap drawer,
   and the right panel a full-screen page. The right panel also has an explicit full-screen mode on desktop.
   Chat markdown renders through @brett_lamy/docstream (GitbookStreamdown / MarkdownContent) with a
   built-in fallback renderer; scroll behavior ports the shadcn MessageScroller semantics. */
const {useState, useEffect, useLayoutEffect, useRef} = React;
const WFONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const EASE = 'cubic-bezier(.32,.72,0,1)';

/* ══ haptics (standalone; cooperates with touchkit.jsx when both are loaded) ══ */
(function(){ if (typeof window === 'undefined' || window.__wbVib) return; window.__wbVib = 1;
  const ua = navigator.userAgent || '';
  const saf = /Safari\//.test(ua) && !/Chrom|CriOS|FxiOS|EdgiOS|Android/.test(ua);
  if (!saf) return;
  if (navigator.vibrate && Object.prototype.hasOwnProperty.call(navigator, 'vibrate')) { try { delete navigator.vibrate; } catch(e){} }
  if (navigator.vibrate) return;
  const s = document.createElement('script'); s.type = 'module';
  s.textContent = 'try{await import("https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm")}catch(e){try{await import("https://esm.sh/ios-vibrator-pro-max@3.0.3")}catch(f){}}';
  document.head.appendChild(s);
})();
const vib = p => { try { if (window.TouchKit && window.TouchKit.Haptics) return p.length > 1 ? window.TouchKit.Haptics.notification('success') : window.TouchKit.Haptics.impact('light'); if (navigator.vibrate) navigator.vibrate(p); } catch(e){} };
const tick = () => { try { if (window.TouchKit && window.TouchKit.Haptics) return window.TouchKit.Haptics.selection(); if (navigator.vibrate) navigator.vibrate([4]); } catch(e){} };

/* ══ injected css (framework-owned: scrollbars, caret pulse, spin) ══ */
(function(){ if (typeof document === 'undefined' || document.getElementById('wb-kf')) return;
  const s = document.createElement('style'); s.id = 'wb-kf'; s.textContent = `
@keyframes wbBlink{0%,55%{opacity:1}56%,100%{opacity:0}}
@keyframes wbPulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes wbSpin{to{transform:rotate(360deg)}}
.wb-scroll{scrollbar-width:thin;scrollbar-color:rgba(140,140,155,.3) transparent}
.wb-scroll::-webkit-scrollbar{width:8px;height:8px}
.wb-scroll::-webkit-scrollbar-thumb{background:rgba(140,140,155,.28);border-radius:4px;border:2px solid transparent;background-clip:padding-box}
.wb-scroll::-webkit-scrollbar-track{background:transparent}
.wb-btn{-webkit-tap-highlight-color:transparent;font-family:inherit}
.wb-btn:hover{filter:brightness(1.12)}
.wb-hl:hover{background:var(--wb-fill)!important}
.wb-md{line-height:1.6;font-size:14px}
.wb-md :where(h1){font-size:20px;font-weight:700;margin:18px 0 8px;letter-spacing:-.2px}
.wb-md :where(h2){font-size:16.5px;font-weight:650;margin:18px 0 6px}
.wb-md :where(h3){font-size:14.5px;font-weight:650;margin:14px 0 4px}
.wb-md :where(p){margin:8px 0}
.wb-md :where(ul,ol){margin:8px 0;padding-left:22px}
.wb-md :where(li){margin:3px 0}
.wb-md :where(code){font-family:${MONO};font-size:.86em;background:var(--mdc-code,rgba(120,120,140,.14));padding:2px 5px;border-radius:5px}
.wb-md :where(pre){background:var(--mdc-pre,#101014);color:#D8D8E2;border-radius:10px;padding:12px 14px;overflow:auto;font-size:12.5px;line-height:1.55;margin:10px 0}
.wb-md :where(pre code){background:none;padding:0;font-size:inherit;color:inherit}
.wb-md :where(table){border-collapse:collapse;margin:10px 0;width:100%;font-size:13.5px}
.wb-md :where(th){text-align:left;font-weight:600;color:var(--mdc-mut,#8E8E98);font-size:12px;text-transform:uppercase;letter-spacing:.4px}
.wb-md :where(th,td){padding:7px 12px 7px 0;border-bottom:1px solid var(--mdc-border,rgba(128,128,145,.22))}
.wb-md :where(blockquote){margin:10px 0;padding:2px 14px;border-left:3px solid var(--mdc-border,rgba(128,128,145,.3));color:var(--mdc-mut,#8E8E98)}
.wb-md :where(hr){border:0;border-top:1px solid var(--mdc-border,rgba(128,128,145,.22));margin:16px 0}
.wb-md :where(a){color:var(--wb-tint,#0A84FF);text-decoration:none}
.wb-md :where(a:hover){text-decoration:underline}
.wb-md :where(img){max-width:100%;border-radius:8px}
`; document.head.appendChild(s); })();

/* ══ icons ══ */
const WIC = {
  sidebar:[{d:'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z'},{d:'M9 5.5v13'}],
  panelR:[{d:'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z'},{d:'M15 5.5v13'}],
  panelB:[{d:'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z'},{d:'M2.5 13.5h19'}],
  compose:[{d:'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5'},{d:'M17.3 4.2a1.9 1.9 0 0 1 2.7 2.7l-7.6 7.6-3.4.7.7-3.4z'}],
  search:[{d:'M10.8 4a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6z'},{d:'M15.9 15.9L20.5 20.5'}],
  folder:[{d:'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z'}],
  folderP:[{d:'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z'},{d:'M12 11.2v4M10 13.2h4'}],
  plus:[{d:'M12 5v14M5 12h14'}],
  chevD:[{d:'M6 9.5l6 6 6-6'}],
  chevR:[{d:'M9.5 6l6 6-6 6'}],
  chevU:[{d:'M6 14.5l6-6 6 6'}],
  x:[{d:'M6 6l12 12M18 6L6 18'}],
  gear:[{d:'M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z'},{d:'M12 2.8l.9 2.4a7 7 0 0 1 2.1.9l2.4-1 1.5 1.5-1 2.4c.4.6.7 1.3.9 2.1l2.4.9v2l-2.4.9a7 7 0 0 1-.9 2.1l1 2.4-1.5 1.5-2.4-1a7 7 0 0 1-2.1.9l-.9 2.4h-2l-.9-2.4a7 7 0 0 1-2.1-.9l-2.4 1-1.5-1.5 1-2.4a7 7 0 0 1-.9-2.1l-2.4-.9v-2l2.4-.9c.2-.8.5-1.5.9-2.1l-1-2.4L6.1 5l2.4 1a7 7 0 0 1 2.1-.9l.9-2.4z'}],
  term:[{d:'M4 5h16a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 5z'},{d:'M6.5 9l3 3-3 3M12 15h5'}],
  globe:[{d:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z'},{d:'M3 12h18M12 3c2.6 2.3 4 5.5 4 9s-1.4 6.7-4 9c-2.6-2.3-4-5.5-4-9s1.4-6.7 4-9z'}],
  files:[{d:'M8 7.5V5.4A1.4 1.4 0 0 1 9.4 4h9.2A1.4 1.4 0 0 1 20 5.4v9.2a1.4 1.4 0 0 1-1.4 1.4h-2.1'},{d:'M4 9.4A1.4 1.4 0 0 1 5.4 8h9.2A1.4 1.4 0 0 1 16 9.4v9.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6z'}],
  diff:[{d:'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z'},{d:'M13.5 3.5V8.5h5M9.4 12h5.2M12 15.8h-2.6'}],
  bot:[{d:'M7 9.5h10A2.5 2.5 0 0 1 19.5 12v4A2.5 2.5 0 0 1 17 18.5H7A2.5 2.5 0 0 1 4.5 16v-4A2.5 2.5 0 0 1 7 9.5z'},{d:'M12 9.5V6.2M12 6a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM9 13.3v1.4M15 13.3v1.4'}],
  expand:[{d:'M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5L14 10M4.5 19.5L10 14'}],
  restore:[{d:'M9.5 4v5.5H4M14.5 20v-5.5H20M9.5 9.5L4 4M14.5 14.5L20 20'}],
  up:[{d:'M12 19V5M6 11l6-6 6 6'}],
  stop:[{d:'M8 8h8v8H8z'}],
  branch:[{d:'M7 4.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM7 15.9a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM17 6.1a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z'},{d:'M7 8.1v7.8M17 9.7c0 3.2-3.4 3.5-6 4.1a4.3 4.3 0 0 0-2.7 1.5'}],
  trash:[{d:'M5 7h14M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7'}],
  split:[{d:'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5z'},{d:'M12 4.5v15'}],
  check:[{d:'M4.5 12.5l5 5 10-11'}],
  checkC:[{d:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z'},{d:'M8.2 12.4l2.6 2.6 5-5.6'}],
  clock:[{d:'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z'},{d:'M12 7.5V12l3.2 2'}],
  lock:[{d:'M7 10.5V8a5 5 0 0 1 10 0v2.5'},{d:'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18v-6a1.5 1.5 0 0 1 1.5-1.5z'}],
  spark:[{d:'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9'}],
  doc:[{d:'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z'},{d:'M13.5 3.5V8.5h5'}],
  msg:[{d:'M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.5z'}],
  dl:[{d:'M12 4v11M7 10.5l5 5 5-5M5 19.5h14'}],
  at:[{d:'M12 8a4 4 0 1 0 4 4v-4'},{d:'M16 12a4 4 0 1 1-1.2-2.9'},{d:'M12 3a9 9 0 1 0 6.4 15.3'}],
  hamburger:[{d:'M4 6.5h16M4 12h16M4 17.5h16'}],
  play:[{d:'M8 5.5l11 6.5-11 6.5z'}]
};
function WIcon({name, size, sw, style}) {
  size = size || 20; sw = sw || 1.7;
  const els = WIC[name] || WIC.doc;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={{display:'block', flexShrink:0, ...style}} aria-hidden="true">
    {els.map((e,i)=><path key={i} d={e.d}/>)}
  </svg>;
}
function IconBtn({name, label, onPress, size, active, style}) {
  return <button className="wb-btn wb-hl" onClick={onPress} aria-label={label} title={label}
    style={{border:0, background:active?'var(--wb-fill)':'none', color:active?'var(--wb-label)':'var(--wb-label2)', cursor:'pointer',
      borderRadius:7, padding:5, display:'grid', placeItems:'center', ...style}}>
    <WIcon name={name} size={size||18}/></button>;
}

/* ══ docstream bridge — @brett_lamy/docstream via esm.sh, sharing the page's React ══ */
/* The package stylesheet is fetched (not <link>ed): esm.sh's exports-alias path 500s on cold loads, and
   the file starts with a bare `@import "streamdown/styles.css"` that 404s on every CDN — so pull both
   from jsdelivr, strip the @import, inject inline. Silent on failure; the page's .wb-md rules cover basics. */
(function(){ if (typeof window === 'undefined' || window.__wbDsCss) return; window.__wbDsCss = 1;
  Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/streamdown@2.5.0/styles.css').then(r => r.ok ? r.text() : ''),
    fetch('https://cdn.jsdelivr.net/npm/@brett_lamy/docstream@0.3.0/src/styles.css').then(r => r.ok ? r.text() : '')
  ]).then(([sd, ds]) => {
    const css = sd + '\n' + ds.replace(/^\s*@import[^;]+;/m, '');
    if (!css.trim() || document.getElementById('wb-ds-css')) return;
    const s = document.createElement('style'); s.id = 'wb-ds-css'; s.textContent = css;
    document.head.appendChild(s);
  }).catch(() => {});
})();
function ensureImportMap() {
  if (document.querySelector('script[data-wb-map]')) return;
  const enc = src => 'data:text/javascript,' + encodeURIComponent(src);
  const R = enc('const R=window.React;export default R;export const Children=R.Children,Component=R.Component,PureComponent=R.PureComponent,Fragment=R.Fragment,StrictMode=R.StrictMode,Suspense=R.Suspense,cloneElement=R.cloneElement,createContext=R.createContext,createElement=R.createElement,createRef=R.createRef,forwardRef=R.forwardRef,isValidElement=R.isValidElement,lazy=R.lazy,memo=R.memo,startTransition=R.startTransition,useCallback=R.useCallback,useContext=R.useContext,useDebugValue=R.useDebugValue,useDeferredValue=R.useDeferredValue,useEffect=R.useEffect,useId=R.useId,useImperativeHandle=R.useImperativeHandle,useInsertionEffect=R.useInsertionEffect,useLayoutEffect=R.useLayoutEffect,useMemo=R.useMemo,useReducer=R.useReducer,useRef=R.useRef,useState=R.useState,useSyncExternalStore=R.useSyncExternalStore,useTransition=R.useTransition,version=R.version;');
  const J = enc('const R=window.React;const N=(t,p,k)=>{p=p||{};const c=p.children;const q=Object.assign({},p);delete q.children;if(k!==undefined)q.key=k;return c===undefined?R.createElement(t,q):Array.isArray(c)?R.createElement.apply(null,[t,q].concat(c)):R.createElement(t,q,c)};export const jsx=N,jsxs=N,jsxDEV=N,Fragment=R.Fragment;');
  const D = enc('const D=window.ReactDOM;export default D;export const createPortal=D.createPortal,findDOMNode=D.findDOMNode,flushSync=D.flushSync,render=D.render,unmountComponentAtNode=D.unmountComponentAtNode,createRoot=D.createRoot,hydrateRoot=D.hydrateRoot;');
  const s = document.createElement('script'); s.type = 'importmap'; s.setAttribute('data-wb-map','');
  s.textContent = JSON.stringify({imports:{'react':R, 'react/jsx-runtime':J, 'react/jsx-dev-runtime':J, 'react-dom':D, 'react-dom/client':D}});
  document.head.appendChild(s);
}
let __dsP = null;
function dsLoad() {
  if (window.__wbDS) return Promise.resolve(window.__wbDS);
  if (!__dsP) {
    ensureImportMap();
    /* 0.3.0's root entry re-exports ./replay (rrweb alpha), which esm.sh fails to serve — tree-shake to
       just the renderers; fall back to known-good 0.1.0 rather than the hand-rolled renderer. */
    const ok = m => { window.__wbDS = m; window.dispatchEvent(new Event('wb-ds')); return m; };
    __dsP = import('https://esm.sh/@brett_lamy/docstream@0.3.0?external=react,react-dom&exports=GitbookStreamdown,MarkdownContent,DocsRenderer,parseMarkdown')
      .then(ok)
      .catch(() => import('https://esm.sh/@brett_lamy/docstream@0.1.0?external=react,react-dom').then(ok))
      .catch(e => { window.__wbDSerr = String(e && e.message || e); window.dispatchEvent(new Event('wb-ds')); return null; });
  }
  return __dsP;
}
/* fallback mini-markdown (only used until docstream arrives, or if the CDN fails) */
function fbInline(s) {
  const out = []; let k = 0;
  const rx = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m;
  while ((m = rx.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t[0] === '`') out.push(<code key={k++}>{t.slice(1,-1)}</code>);
    else if (t.startsWith('**')) out.push(<strong key={k++}>{fbInline(t.slice(2,-2))}</strong>);
    else if (t.startsWith('~~')) out.push(<s key={k++}>{t.slice(2,-2)}</s>);
    else if (t[0] === '*') out.push(<em key={k++}>{fbInline(t.slice(1,-1))}</em>);
    else { const mm = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/); out.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer">{fbInline(mm[1])}</a>); }
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
/* tiny JSX/TS highlighter for static code fences */
const HLC = {kw:'#C792EA', str:'#A5D6A7', num:'#F78C6C', com:'#6B6B78', fn:'#82AAFF', tag:'#F07178', attr:'#FFCB6B', punc:'#89DDFF', id:'#D8D8E2'};
const HL_KW = new Set('import export from const let var function return if else for while switch case default new class extends super this typeof instanceof in of try catch finally throw await async yield break continue null undefined true false void delete static get set'.split(' '));
function hlTokens(src) {
  const rx = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|(<\/?)([A-Za-z][\w.]*)|([A-Za-z_$][\w$]*)|([{}()\[\];,.<>=+\-*\/!&|?:]+)/g;
  const out = []; let last = 0, m, k = 0;
  const push = (txt, color) => out.push(color ? <span key={k++} style={{color}}>{txt}</span> : txt);
  while ((m = rx.exec(src))) {
    if (m.index > last) push(src.slice(last, m.index));
    if (m[1] || m[2]) push(m[0], HLC.com);
    else if (m[3]) push(m[0], HLC.str);
    else if (m[4]) push(m[0], HLC.num);
    else if (m[5]) { push(m[5], HLC.punc); push(m[6], m[6][0] === m[6][0].toUpperCase() ? HLC.attr : HLC.tag); }
    else if (m[7]) {
      const w = m[7];
      const next = src.slice(rx.lastIndex).match(/^\s*\(/);
      push(w, HL_KW.has(w) ? HLC.kw : next ? HLC.fn : /^[A-Z]/.test(w) ? HLC.attr : HLC.id);
    }
    else if (m[8]) push(m[0], HLC.punc);
    last = rx.lastIndex;
  }
  if (last < src.length) push(src.slice(last));
  return out;
}
function HlPre({code, lang}) {
  const plain = lang && !/^(jsx?|tsx?|js|ts|javascript|typescript|html|xml|svg)$/i.test(lang);
  return <pre data-lang={lang}><code>{plain ? code : hlTokens(code)}</code></pre>;
}
function FbMd({md}) {
  const lines = (md || '').split('\n');
  const blocks = []; let i = 0, k = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (/^```/.test(L)) {
      const lang = L.slice(3).trim(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(<HlPre key={k++} code={buf.join('\n')} lang={lang}/>);
    } else if (/^#{1,4} /.test(L)) {
      const n = L.match(/^#+/)[0].length; const T = ['h1','h2','h3','h4'][n-1];
      blocks.push(React.createElement(T, {key:k++}, fbInline(L.replace(/^#+ /,''))));
      i++;
    } else if (/^\s*([-*]|\d+\.) /.test(L)) {
      const ord = /^\s*\d+\./.test(L); const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.) /,''));
      blocks.push(React.createElement(ord?'ol':'ul', {key:k++}, items.map((t,j)=><li key={j}>{fbInline(t)}</li>)));
    } else if (/^\|/.test(L)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++].replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
      const body = rows.filter(r=>!r.every(c=>/^:?-{2,}:?$/.test(c)));
      blocks.push(<table key={k++}><thead><tr>{body[0].map((c,j)=><th key={j}>{fbInline(c)}</th>)}</tr></thead>
        <tbody>{body.slice(1).map((r,ri)=><tr key={ri}>{r.map((c,j)=><td key={j}>{fbInline(c)}</td>)}</tr>)}</tbody></table>);
    } else if (/^\s*>/.test(L)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*> ?/,''));
      blocks.push(<blockquote key={k++}>{buf.map((t,j)=><p key={j}>{fbInline(t)}</p>)}</blockquote>);
    } else if (/^\s*(---|\*\*\*)\s*$/.test(L)) { blocks.push(<hr key={k++}/>); i++; }
    else if (!L.trim()) i++;
    else {
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^(```|#{1,4} |\||\s*>|\s*([-*]|\d+\.) )/.test(lines[i]) && !/^\s*(---|\*\*\*)\s*$/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<p key={k++}>{fbInline(buf.join(' '))}</p>);
    }
  }
  return <React.Fragment>{blocks}</React.Fragment>;
}
function MdView({markdown, streaming, className}) {
  const [, bump] = useState(0);
  useEffect(()=>{
    if (window.__wbDS || window.__wbDSerr) return;
    dsLoad();
    const h = ()=>bump(x=>x+1);
    window.addEventListener('wb-ds', h);
    return ()=>window.removeEventListener('wb-ds', h);
  }, []);
  const m = window.__wbDS;
  let body;
  if (m && m.GitbookStreamdown && streaming) body = React.createElement(m.GitbookStreamdown, {markdown, isStreaming:true, isAnimating:true});
  else if (m && m.MarkdownContent && !streaming) {
    /* split out code fences so static code always gets JSX highlighting */
    const parts = String(markdown || '').split(/(```[\w-]*\n[\s\S]*?\n```)/g);
    body = parts.map((p, i) => {
      const f = p.match(/^```([\w-]*)\n([\s\S]*?)\n```$/);
      if (f) return <HlPre key={i} code={f[2]} lang={f[1]}/>;
      return p.trim() ? React.createElement(m.MarkdownContent, {key:i, markdown:p}) : null;
    });
  }
  else body = <FbMd md={markdown}/>;
  return <div className={'wb-md ' + (className || '')} data-renderer={m ? 'docstream' : 'fallback'}>{body}</div>;
}

/* ══ DocsLive — code + live preview blocks for the docs ══
   Preview mounts the real component in-page (instant). Code shows the same source through docstream's
   highlighter. almost-node feeds that source + the real module file into docstream v0.3.0's ReactDemo,
   which boots a WASM Vite server (@agent-wasm/core) in an iframe. */
let __dsPgP = null;
function dsPlayground() {
  if (window.__wbDSPG) return Promise.resolve(window.__wbDSPG);
  if (!__dsPgP) {
    ensureImportMap();
    __dsPgP = import('https://esm.sh/@brett_lamy/docstream@0.3.0/playground?external=react,react-dom')
      .then(m => { window.__wbDSPG = m; window.dispatchEvent(new Event('wb-dspg')); return m; })
      .catch(e => { window.__wbDSPGerr = String(e && e.message || e); window.dispatchEvent(new Event('wb-dspg')); return null; });
  }
  return __dsPgP;
}
const __srcCache = {};
function srcOf(file) {
  if (!__srcCache[file]) __srcCache[file] = fetch('./' + file).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(s => 'import React from "react";\n' + s).catch(() => null);
  return __srcCache[file];
}
class ErrB extends React.Component {
  constructor(p) { super(p); this.state = {err: null}; }
  static getDerivedStateFromError(e) { return {err: String(e && e.message || e)}; }
  render() { return this.state.err
    ? React.createElement('div', {style: {padding: 14, fontFamily: MONO, fontSize: 12, color: '#FF453A'}}, this.props.label + ' failed: ' + this.state.err)
    : this.props.children; }
}
const TKL = {'--tk-bg':'#fff', '--tk-bg2':'#F2F2F7', '--tk-card':'#fff', '--tk-label':'#0B0B0F', '--tk-label2':'rgba(60,60,67,.6)', '--tk-label3':'rgba(60,60,67,.36)', '--tk-sep':'rgba(60,60,67,.22)', '--tk-fill':'rgba(120,120,128,.13)', '--tk-fill2':'rgba(120,120,128,.24)', '--tk-press':'rgba(120,120,128,.16)', '--tk-tint':'#0A84FF', '--tk-green':'#34C759', '--tk-red':'#FF3B30', '--tk-bar':'rgba(250,250,252,.85)', '--tk-stick':'rgba(244,244,248,.92)', '--tk-side':'#ECECF1', '--tk-scrim':'rgba(0,0,0,.38)'};
const TKDK = {'--tk-bg':'#000', '--tk-bg2':'#0A0A0C', '--tk-card':'#1C1C1E', '--tk-label':'#F5F5F7', '--tk-label2':'rgba(235,235,245,.62)', '--tk-label3':'rgba(235,235,245,.3)', '--tk-sep':'rgba(84,84,88,.48)', '--tk-fill':'rgba(120,120,128,.22)', '--tk-fill2':'rgba(120,120,128,.34)', '--tk-press':'rgba(120,120,128,.22)', '--tk-tint':'#0A84FF', '--tk-green':'#30D158', '--tk-red':'#FF453A', '--tk-bar':'rgba(16,16,18,.82)', '--tk-stick':'rgba(18,18,20,.9)', '--tk-side':'#111114', '--tk-scrim':'rgba(0,0,0,.5)'};
const WBD = {'--wb-bg':'#141419', '--wb-side':'#101015', '--wb-card':'#1C1C23', '--wb-fill':'rgba(255,255,255,.06)', '--wb-fill2':'rgba(255,255,255,.11)', '--wb-sep':'rgba(255,255,255,.08)', '--wb-label':'#EDEDF2', '--wb-label2':'#9C9CA6', '--wb-label3':'#69696F', '--wb-tint':'#0A84FF', '--wb-green':'#30D158', '--wb-red':'#FF453A', '--tk-tint':'#0A84FF'};
function TKFrame({h, bg, children}) {
  return <div style={{position:'relative', height:h, borderRadius:12, overflow:'hidden', background:bg || 'var(--tk-bg2)', boxShadow:'inset 0 0 0 1px rgba(0,0,0,.05)'}}>{children}</div>;
}
const DemoBtn = ({label, onPress, style}) => <button onClick={onPress}
  style={{border:0, borderRadius:10, background:'var(--tk-tint, #0A84FF)', color:'#fff', fontFamily:'inherit', fontWeight:600, fontSize:13.5, padding:'9px 16px', cursor:'pointer', ...style}}>{label}</button>;
const LIVE = {
  row: {
    title: 'TKList · TKSection · TKRow', dep: 'touchkit.jsx', theme: 'tk', h: 340,
    code: 'import { TKList, TKSection, TKRow, Avatar, TKSwitch, Haptics } from "./touchkit.tsx"\n\nexport default function App() {\n  const [dnd, setDnd] = React.useState(true)\n  const people = [\n    { f: "Maya", l: "Lindqvist", role: "Industrial design" },\n    { f: "Jonas", l: "Ito", role: "Haptics engineering" },\n  ]\n  return (\n    <TKList inset>\n      <TKSection title="Team" footer="Rows are real buttons — arrow keys work too.">\n        {people.map(p => (\n          <TKRow key={p.l} leading={<Avatar c={p} size={36}/>}\n            title={p.f + " " + p.l} subtitle={p.role}\n            accessory="chevron" onPress={() => Haptics.impact("light")}/>\n        ))}\n        <TKRow title="Do Not Disturb" divider={false}\n          trailing={<TKSwitch checked={dnd} onChange={setDnd}/>}/>\n      </TKSection>\n    </TKList>\n  )\n}',
    Render: function RowLive() {
      const TK = window.TouchKit; const [dnd, setDnd] = useState(true);
      if (!TK) return null;
      const {TKList, TKSection, TKRow, Avatar, TKSwitch, Haptics} = TK;
      const people = [{f:'Maya', l:'Lindqvist', role:'Industrial design'}, {f:'Jonas', l:'Ito', role:'Haptics engineering'}];
      return <div style={{maxWidth:430, margin:'0 auto'}}><TKList inset>
        <TKSection title="Team" footer="Rows are real buttons — arrow keys work too.">
          {people.map(p=><TKRow key={p.l} leading={<Avatar c={p} size={36}/>} title={p.f + ' ' + p.l} subtitle={p.role} accessory="chevron" onPress={()=>Haptics.impact('light')}/>)}
          <TKRow title="Do Not Disturb" divider={false} trailing={<TKSwitch checked={dnd} onChange={setDnd}/>}/>
        </TKSection>
      </TKList></div>;
    }
  },
  credenza: {
    title: 'Credenza', dep: 'touchkit.jsx', theme: 'tk', h: 340,
    code: 'import { Credenza, TKRow, Icon, Haptics } from "./touchkit.tsx"\n\nexport default function App() {\n  const [view, setView] = React.useState(null)\n  const done = () => { Haptics.notification("success"); setView("done") }\n  return (\n    <div style={{ display: "grid", placeItems: "center", minHeight: 220 }}>\n      <button onClick={() => { Haptics.impact("light"); setView("menu") }}>\n        Share Contact…\n      </button>\n      <Credenza open={!!view} view={view || "menu"}\n        title={view === "done" ? "Shared" : "Share Contact"}\n        canBack={view === "done"} onBack={() => setView("menu")}\n        onClose={() => setView(null)}>\n        {view === "done"\n          ? <p style={{ textAlign: "center", padding: 24 }}>Contact shared ✓</p>\n          : <div>\n              <TKRow leading={<Icon name="qr" size={20}/>} title="Show QR code" onPress={done}/>\n              <TKRow leading={<Icon name="doc" size={20}/>} title="Copy vCard" divider={false} onPress={done}/>\n            </div>}\n      </Credenza>\n    </div>\n  )\n}',
    Render: function CredLive() {
      const TK = window.TouchKit; const [view, setView] = useState(null);
      if (!TK) return null;
      const {Credenza, TKRow, Icon, Haptics} = TK;
      const done = () => { Haptics.notification('success'); setView('done'); };
      return <div style={{display:'grid', placeItems:'center', minHeight:210}}>
        <button onClick={() => { Haptics.impact('light'); setView('menu'); }}
          style={{border:0, borderRadius:11, background:'var(--tk-tint)', color:'#fff', fontFamily:'inherit', fontSize:14.5, fontWeight:600, padding:'11px 20px', cursor:'pointer'}}>Share Contact…</button>
        <Credenza open={!!view} view={view || 'menu'} title={view === 'done' ? 'Shared' : 'Share Contact'}
          canBack={view === 'done'} onBack={() => setView('menu')} onClose={() => setView(null)}>
          {view === 'done'
            ? <div style={{textAlign:'center', padding:'26px 18px'}}>
                <span style={{width:46, height:46, borderRadius:'50%', background:'rgba(52,199,89,.15)', display:'inline-grid', placeItems:'center', color:'var(--tk-green)'}}><Icon name="check" size={24} sw={2.4}/></span>
                <div style={{fontWeight:650, fontSize:16, marginTop:10}}>Contact shared</div>
                <div style={{fontSize:13, color:'var(--tk-label2)', marginTop:3}}>The card spring-morphs its height to each state.</div>
              </div>
            : <div style={{padding:'4px 6px 8px'}}>
                <TKRow leading={<Icon name="qr" size={20}/>} title="Show QR code" onPress={done}/>
                <TKRow leading={<Icon name="doc" size={20}/>} title="Copy vCard" divider={false} onPress={done}/>
              </div>}
        </Credenza>
      </div>;
    }
  },
  composer: {
    title: 'Composer', dep: 'workbench.jsx', theme: 'wb', h: 320,
    code: 'import { Composer } from "./workbench.tsx"\n\nexport default function App() {\n  const [sent, setSent] = React.useState(null)\n  const [streaming, setStreaming] = React.useState(false)\n  const send = text => {\n    setSent(text); setStreaming(true)\n    setTimeout(() => setStreaming(false), 2600)\n  }\n  return (\n    <div style={{ maxWidth: 560, margin: "0 auto" }}>\n      <Composer wide onSend={send} streaming={streaming}\n        onStop={() => setStreaming(false)}/>\n      {sent && <p style={{ font: "12px ui-monospace" }}>sent: {sent}</p>}\n    </div>\n  )\n}',
    Render: function CompLive() {
      const [sent, setSent] = useState(null);
      const [streaming, setStreaming] = useState(false);
      const t = useRef(null);
      useEffect(() => () => clearTimeout(t.current), []);
      return <div style={{maxWidth:560, margin:'0 auto'}}>
        <Composer wide onSend={text => { setSent(text); setStreaming(true); clearTimeout(t.current); t.current = setTimeout(() => setStreaming(false), 2600); }}
          streaming={streaming} onStop={() => { clearTimeout(t.current); setStreaming(false); }}/>
        {sent ? <div style={{fontFamily:MONO, fontSize:12, color:'var(--wb-label2)', marginTop:10}}>sent: {sent}</div> : null}
      </div>;
    }
  },
  controls: {
    title: 'Segmented · TKSwitch · Spinner · Avatar', dep: 'touchkit.jsx', theme: 'tk', h: 300,
    code: 'import { Segmented, TKSwitch, Spinner, Avatar, Haptics } from "./touchkit.tsx"\n\nexport default function App() {\n  const [range, setRange] = React.useState("day")\n  const [on, setOn] = React.useState(true)\n  return (\n    <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>\n      <Segmented value={range} onChange={setRange} options={[\n        { id: "day", label: "Day" }, { id: "week", label: "Week" }, { id: "month", label: "Month" },\n      ]}/>\n      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>\n        <Avatar c={{ f: "Ada", l: "Lovelace" }} size={40}/>\n        <TKSwitch checked={on} onChange={setOn}/>\n        <Spinner/>\n      </div>\n    </div>\n  )\n}',
    Render: function CtlLive() {
      const TK = window.TouchKit; const [range, setRange] = useState('day'); const [on, setOn] = useState(true);
      if (!TK) return null;
      const {Segmented, TKSwitch, Spinner, Avatar, Haptics} = TK;
      return <div style={{display:'grid', gap:16, justifyItems:'center', maxWidth:420, margin:'0 auto'}}>
        <div style={{width:280}}><Segmented value={range} onChange={id=>{setRange(id); Haptics.selection();}} options={[{id:'day',label:'Day'},{id:'week',label:'Week'},{id:'month',label:'Month'}]}/></div>
        <div style={{display:'flex', gap:18, alignItems:'center'}}>
          <Avatar c={{f:'Ada', l:'Lovelace'}} size={40}/>
          <TKSwitch checked={on} onChange={setOn}/>
          <Spinner/>
        </div>
        <div style={{fontSize:12.5, color:'var(--tk-label2)'}}>window.TouchKit is live — every control ticks.</div>
      </div>;
    }
  },
  theming: {
    title: 'Theme tokens', dep: 'touchkit.jsx', theme: 'tk', h: 330,
    code: 'import { TKList, TKSection, TKRow, TKSwitch, Icon } from "./touchkit.tsx"\n\nexport default function App() {\n  const [dark, setDark] = React.useState(false)\n  const [tint, setTint] = React.useState("#0A84FF")\n  return (\n    <div style={{ ...(dark ? DARK_TOKENS : LIGHT_TOKENS), "--tk-tint": tint }}>\n      {/* every component reads the nearest --tk-* tokens */}\n      <TKList inset>\n        <TKSection title="Appearance">\n          <TKRow leading={<Icon name="bell" size={20}/>} title="Dark Mode" divider={false}\n            trailing={<TKSwitch checked={dark} onChange={setDark}/>}/>\n        </TKSection>\n      </TKList>\n    </div>\n  )\n}',
    Render: function ThemeLive() {
      const TK = window.TouchKit; const [dark, setDark] = useState(false); const [tint, setTint] = useState('#0A84FF');
      if (!TK) return null;
      const {TKList, TKSection, TKRow, TKSwitch, Icon, Haptics} = TK;
      return <div style={{...(dark ? TKDK : TKL), '--tk-tint':tint, background:'var(--tk-bg2)', borderRadius:14, padding:16, colorScheme:dark ? 'dark' : 'light', color:'var(--tk-label)', maxWidth:430, margin:'0 auto', transition:'background .25s'}}>
        <div style={{display:'flex', gap:9, marginBottom:12, justifyContent:'center'}}>
          {['#0A84FF', '#5E5CE6', '#34C759', '#FF9F0A', '#FF375F'].map(c=><button key={c} onClick={()=>{setTint(c); Haptics.selection();}} aria-label={'Tint ' + c}
            style={{width:23, height:23, borderRadius:'50%', background:c, cursor:'pointer', padding:0, border:'1px solid rgba(0,0,0,.1)', outline:tint === c ? '2.5px solid ' + c : 'none', outlineOffset:2}}/>)}
        </div>
        <TKList inset>
          <TKSection title="Appearance">
            <TKRow leading={<Icon name="bell" size={20}/>} title="Dark Mode" divider={false} trailing={<TKSwitch checked={dark} onChange={setDark}/>}/>
          </TKSection>
        </TKList>
        <DemoBtn label="Tinted action" onPress={()=>Haptics.impact('light')} style={{display:'block', margin:'12px auto 0'}}/>
      </div>;
    }
  },
  nav: {
    title: 'NavigationStack', dep: 'touchkit.jsx', theme: 'tk', h: 420,
    code: 'import { NavigationStack, TKList, TKSection, TKRow, Icon } from "./touchkit.tsx"\n\nexport default function App() {\n  const [sel, setSel] = React.useState(null)\n  const screens = [\n    { key: "root", title: "Teams", grouped: true, content:\n      <TKList inset><TKSection>\n        {["Design", "Engineering", "Research"].map((t, i) => (\n          <TKRow key={t} leading={<Icon name="person" size={20}/>} title={t}\n            accessory="chevron" divider={i < 2} onPress={() => setSel(t)}/>\n        ))}\n      </TKSection></TKList> },\n  ]\n  if (sel) screens.push({ key: "detail", title: sel, grouped: true,\n    content: <p style={{ padding: 24 }}>Pushed — back chevron or edge-swipe pops.</p> })\n  return <NavigationStack screens={screens} onPop={() => setSel(null)}/>\n}',
    Render: function NavLive() {
      const TK = window.TouchKit; const [sel, setSel] = useState(null);
      if (!TK) return null;
      const {NavigationStack, TKList, TKSection, TKRow, Icon, Haptics} = TK;
      const screens = [{key:'root', title:'Teams', grouped:true, content:
        <TKList inset><TKSection>
          {['Design', 'Engineering', 'Research'].map((t, i)=><TKRow key={t} leading={<Icon name="person" size={20}/>} title={t}
            accessory="chevron" divider={i < 2} onPress={()=>{ Haptics.impact('light'); setSel(t); }}/>)}
        </TKSection></TKList>}];
      if (sel) screens.push({key:'detail', title:sel, grouped:true, content:
        <div style={{padding:'28px 22px', textAlign:'center'}}>
          <div style={{fontSize:16, fontWeight:650}}>{sel}</div>
          <div style={{fontSize:13, color:'var(--tk-label2)', marginTop:5, lineHeight:1.5}}>Pushed screen — use the back chevron, or drag from the left edge to pop interactively.</div>
        </div>});
      return <TKFrame h={330}><NavigationStack screens={screens} onPop={()=>setSel(null)}/></TKFrame>;
    }
  },
  tabs: {
    title: 'TabBar', dep: 'touchkit.jsx', theme: 'tk', h: 420,
    code: 'import { TabBar, Icon } from "./touchkit.tsx"\n\nexport default function App() {\n  const [tab, setTab] = React.useState("contacts")\n  return (\n    <div style={{ position: "relative", height: 320 }}>\n      <main style={{ position: "absolute", inset: "0 0 62px" }}>{/* per-tab content */}</main>\n      <TabBar selected={tab} onSelect={setTab} items={[\n        { id: "contacts", icon: "person", label: "Contacts" },\n        { id: "recents",  icon: "clock",  label: "Recents" },\n        { id: "settings", icon: "gear",   label: "Settings" },\n      ]}/>\n    </div>\n  )\n}',
    Render: function TabsLive() {
      const TK = window.TouchKit; const [tab, setTab] = useState('contacts');
      if (!TK) return null;
      const {TabBar, Icon} = TK;
      const items = [{id:'contacts', icon:'person', label:'Contacts'}, {id:'recents', icon:'clock', label:'Recents'}, {id:'settings', icon:'gear', label:'Settings'}];
      const blurb = {contacts:'Each tab keeps its own stack — pushes slide under this bar.', recents:'Tab state survives switching away and back.', settings:'Every selection fires Haptics.selection().'};
      const cur = items.find(i=>i.id === tab);
      return <TKFrame h={330} bg="var(--tk-bg)">
        <div style={{position:'absolute', inset:'0 0 62px', display:'grid', placeItems:'center', padding:'0 28px', textAlign:'center'}}>
          <div>
            <span style={{display:'inline-grid', placeItems:'center', width:46, height:46, borderRadius:13, background:'var(--tk-fill)', color:'var(--tk-tint)'}}><Icon name={cur.icon} size={25}/></span>
            <div style={{fontSize:16.5, fontWeight:650, marginTop:10}}>{cur.label}</div>
            <div style={{fontSize:13, color:'var(--tk-label2)', marginTop:4, lineHeight:1.5}}>{blurb[tab]}</div>
          </div>
        </div>
        <TabBar items={items} selected={tab} onSelect={setTab}/>
      </TKFrame>;
    }
  },
  split: {
    title: 'SplitView', dep: 'touchkit.jsx', theme: 'tk', h: 470,
    code: 'import { SplitView } from "./touchkit.tsx"\n\nexport default function App() {\n  const [wc, setWc] = React.useState("regular")  // measure your container for real\n  return (\n    <SplitView wc={wc}\n      sidebar={<Folders/>}\n      master={<NoteList/>}\n      detail={<Note/>}\n      drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}/>\n  )\n}',
    Render: function SplitLive() {
      const TK = window.TouchKit; const [wc, setWc] = useState('regular'); const [drawer, setDrawer] = useState(false);
      if (!TK) return null;
      const {SplitView, Segmented, TKList, TKSection, TKRow, Haptics} = TK;
      const mini = (name, rows) => <div style={{height:'100%', overflowY:'auto'}}><TKList>
        <TKSection title={name}>{rows.map((t, i)=><TKRow key={t} title={t} divider={i < rows.length - 1}/>)}</TKSection>
      </TKList></div>;
      return <div>
        <div style={{display:'flex', gap:10, alignItems:'center', justifyContent:'center', marginBottom:10, flexWrap:'wrap'}}>
          <div style={{width:290}}><Segmented value={wc} onChange={id=>{ setWc(id); setDrawer(false); Haptics.selection(); }}
            options={[{id:'regular', label:'Regular'}, {id:'medium', label:'Medium'}, {id:'compact', label:'Compact'}]}/></div>
          {wc !== 'regular' ? <DemoBtn label="Sidebar" onPress={()=>setDrawer(true)} style={{padding:'6px 12px', fontSize:12.5}}/> : null}
        </div>
        <TKFrame h={330} bg="var(--tk-bg)">
          <SplitView wc={wc} drawerOpen={drawer} onCloseDrawer={()=>setDrawer(false)}
            sidebar={<div style={{height:'100%', background:'var(--tk-side)', overflowY:'auto'}}>{mini('Folders', ['All Notes', 'Shared', 'Archive'])}</div>}
            master={mini('Notes', ['Springs — stiffness 620', 'IndexBar scrub ticks', 'Credenza height morph'])}
            detail={<div style={{height:'100%', display:'grid', placeItems:'center', background:'var(--tk-bg2)', textAlign:'center', padding:22}}>
              <div><div style={{fontWeight:650}}>Detail</div>
              <div style={{fontSize:12.5, color:'var(--tk-label2)', marginTop:5, lineHeight:1.5}}>regular: 3 columns · medium: sidebar becomes a drawer · compact: collapses into the stack</div></div>
            </div>}/>
        </TKFrame>
      </div>;
    }
  },
  indexbar: {
    title: 'IndexBar', dep: 'touchkit.jsx', theme: 'tk', h: 470,
    code: "import { IndexBar, TKList, TKSection, TKRow } from \"./touchkit.tsx\"\n\nexport default function App() {\n  const sc = React.useRef(null), els = React.useRef({})\n\n  // Any jump points you like — key is yours, preview is what the bubble shows\n  const stops = turns\n    .filter(t => t.role === \"user\")\n    .map(t => ({ key: t.id, preview: t.text, caption: \"You\" }))   // no label → a dot on the rail\n\n  return (\n    <div style={{ position: \"relative\", height: 340 }}>\n      <div ref={sc} style={{ position: \"absolute\", inset: 0, overflowY: \"auto\" }}>\n        {turns.map(t => <Turn key={t.id} t={t} ref={el => els.current[t.id] = el}/>)}\n      </div>\n      <IndexBar items={stops} top={8} bottom={8}\n        onJump={(key, stop) => sc.current.scrollTop = els.current[key].offsetTop - 8}/>\n    </div>\n  )\n}\n\n// Pass no items and it falls back to the UIKit A–Z form:\n// <IndexBar avail={new Set([\"A\",\"B\",\"C\"])} onLetter={L => jumpTo(L)}/>",
    Render: function IdxLive() {
      const TK = window.TouchKit;
      const sc = useRef(null); const els = useRef({});
      const [mode, setMode] = useState('stops');
      if (!TK) return null;
      const {IndexBar, TKList, TKSection, TKRow, Segmented, Haptics} = TK;
      const TURNS = [
        {id:'q1', role:'user', text:'Why is the workbench build slow after the docs split?'},
        {id:'a1', role:'assistant', text:'Two things: the docs registry re-transpiles on every nav, and the playground boots almost-node eagerly.'},
        {id:'q2', role:'user', text:'Can we cache the transpile per page?'},
        {id:'a2', role:'assistant', text:'Yes — key the cache by page id and keep it on window so navigation is free.'},
        {id:'q3', role:'user', text:'What about the terminal dock — is it doing layout work while hidden?'},
        {id:'a3', role:'assistant', text:'It was. It now unmounts below the compact breakpoint and lives in the SnapSheet instead.'},
        {id:'q4', role:'user', text:'Ship it, then add the jump rail to the thread view.'},
        {id:'a4', role:'assistant', text:'Done. The rail takes arbitrary stops, so each user turn becomes one dot with its text as the preview.'}
      ];
      const data = {A:['Ada', 'Avi'], B:['Bea', 'Ben'], C:['Cal', 'Cy'], D:['Dot', 'Dev'], E:['Eli', 'Eva'], F:['Fay'], G:['Gus', 'Gia']};
      const letters = Object.keys(data);
      const stops = TURNS.filter(t=>t.role === 'user').map(t=>({key:t.id, preview:t.text, caption:'You'}));
      const jump = key => { const el = els.current[key]; if (el && sc.current) sc.current.scrollTop = Math.max(0, el.offsetTop - 8); };
      return <div>
        <div style={{display:'flex', justifyContent:'center', marginBottom:10}}>
          <div style={{width:250}}><Segmented value={mode} onChange={id=>{ setMode(id); Haptics.selection(); }}
            options={[{id:'stops', label:'Custom stops'}, {id:'az', label:'A–Z fallback'}]}/></div>
        </div>
        <TKFrame h={340} bg="var(--tk-bg)">
          <div ref={sc} style={{position:'absolute', inset:0, overflowY:'auto', paddingRight:26}}>
            {mode === 'az'
              ? <TKList>
                  {letters.map(L=><div key={L} ref={el=>{ if (el) els.current[L] = el; }}>
                    <TKSection title={L} sticky>{data[L].map((n, i)=><TKRow key={n} title={n} divider={i < data[L].length - 1}/>)}</TKSection>
                  </div>)}
                </TKList>
              : <div style={{padding:'10px 14px', display:'flex', flexDirection:'column', gap:10}}>
                  {TURNS.map(t=><div key={t.id} ref={el=>{ if (el) els.current[t.id] = el; }}
                    style={{display:'flex', justifyContent:t.role === 'user' ? 'flex-end' : 'flex-start'}}>
                    <div style={{maxWidth:'80%', padding:'9px 13px', borderRadius:16, fontSize:13.5, lineHeight:1.4, textWrap:'pretty',
                      background:t.role === 'user' ? 'var(--tk-tint)' : 'var(--tk-card)',
                      color:t.role === 'user' ? '#fff' : 'var(--tk-label)',
                      boxShadow:t.role === 'user' ? 'none' : '0 0 0 1px var(--tk-sep)'}}>{t.text}</div>
                  </div>)}
                  <div style={{height:120}}/>
                </div>}
          </div>
          {mode === 'az'
            ? <IndexBar avail={new Set(letters)} top={8} bottom={8} onLetter={jump}/>
            : <IndexBar items={stops} top={10} bottom={10} onJump={jump} label="Jump to a turn"/>}
        </TKFrame>
        <div style={{fontSize:12, color:'var(--tk-label2)', textAlign:'center', marginTop:8}}>
          {mode === 'stops' ? 'Hover a dot to peek the turn · drag to scrub with a tick per stop' : 'No items → the A–Z rail, unchanged'}
        </div>
      </div>;
    }
  },
  sidedrawer: {
    title: 'SideDrawer', dep: 'touchkit.jsx', theme: 'tk', h: 460,
    code: 'import { SideDrawer } from "./touchkit.tsx"\n\nexport default function App() {\n  const [mode, setMode] = React.useState("overlay")  // or "fixed"\n  const [open, setOpen] = React.useState(false)\n  return (\n    <div style={{ position: "relative", display: "flex", height: 330 }}>\n      <main style={{ flex: 1 }}>\n        <button onClick={() => setOpen(true)}>Show Activity</button>\n      </main>\n      <SideDrawer mode={mode} open={open} onClose={() => setOpen(false)}\n        title="Activity" width={230}>\n        {/* same children in every presentation */}\n      </SideDrawer>\n    </div>\n  )\n}',
    Render: function DrawerLive() {
      const TK = window.TouchKit; const [mode, setMode] = useState('overlay'); const [open, setOpen] = useState(false);
      if (!TK) return null;
      const {SideDrawer, Segmented, Haptics} = TK;
      const rows = ['Outgoing call · 2 min', 'iMessage · yesterday', 'FaceTime · Mon', 'Mail · Re: schedule'];
      return <div>
        <div style={{display:'flex', justifyContent:'center', marginBottom:10}}>
          <div style={{width:230}}><Segmented value={mode} onChange={id=>{ setMode(id); setOpen(id === 'fixed'); Haptics.selection(); }}
            options={[{id:'overlay', label:'Overlay'}, {id:'fixed', label:'Fixed'}]}/></div>
        </div>
        <TKFrame h={330} bg="var(--tk-bg)">
          <div style={{position:'absolute', inset:0, display:'flex'}}>
            <div style={{flex:1, minWidth:0, display:'grid', placeItems:'center', textAlign:'center', padding:20}}>
              <div>
                <div style={{fontWeight:650, fontSize:15.5}}>Detail view</div>
                {mode === 'overlay'
                  ? <DemoBtn label="Show Activity" onPress={()=>{ Haptics.impact('light'); setOpen(true); }} style={{marginTop:12, fontSize:13, padding:'8px 14px'}}/>
                  : <div style={{fontSize:12.5, color:'var(--tk-label2)', marginTop:6, lineHeight:1.5}}>Docked column — no scrim,<br/>part of the layout.</div>}
              </div>
            </div>
            <SideDrawer mode={mode} open={open} onClose={()=>setOpen(false)} title="Activity" width={230}>
              {rows.map(t=><div key={t} style={{padding:'11px 16px', fontSize:13, borderBottom:'1px solid var(--tk-sep)', color:'var(--tk-label2)'}}>{t}</div>)}
            </SideDrawer>
          </div>
        </TKFrame>
      </div>;
    }
  },
  scroller: {
    title: 'MessageScroller', dep: 'workbench.jsx', theme: 'wb', h: 440,
    code: 'import { MessageScroller } from "./workbench.tsx"\n\nexport default function App() {\n  const [msgs, setMsgs] = React.useState(seed)\n  const items = msgs.map(m => ({\n    id: m.id,\n    anchor: m.role === "user",   // rows that start a turn\n    node: <Message m={m}/>,\n  }))\n  return (\n    <div style={{ display: "flex", flexDirection: "column", height: 340 }}>\n      <MessageScroller items={items} streaming={false} threadKey="demo"/>\n      <button onClick={addTurn}>Send a turn</button>\n    </div>\n  )\n}',
    Render: function ScrollLive() {
      const [msgs, setMsgs] = useState([
        {id:'u1', role:'user', text:'How does anchoring work?'},
        {id:'a1', role:'assistant', text:'Each new turn scrolls near the top of the viewport with a peek of the previous one — the reply streams into the room below without moving your view.'}]);
      const n = useRef(1);
      const add = () => {
        n.current++;
        const uid = 'u' + n.current, aid = 'a' + n.current;
        setMsgs(m=>[...m, {id:uid, role:'user', text:'Turn ' + n.current + ' — watch me anchor to the top.'}]);
        setTimeout(()=>setMsgs(m=>[...m, {id:aid, role:'assistant', text:'Replies grow into the reserved room below the anchor. Scroll up mid-reply and following stops; the pill at the bottom jumps back to the live edge.'}]), 380);
      };
      const items = msgs.map(m=>({id:m.id, anchor:m.role === 'user', node:
        m.role === 'user'
          ? <div style={{display:'flex', justifyContent:'flex-end', margin:'8px 0'}}><div style={{maxWidth:'80%', background:'var(--wb-fill2)', borderRadius:'12px 12px 4px 12px', padding:'8px 12px', fontSize:13.5}}>{m.text}</div></div>
          : <div style={{margin:'4px 0 12px', fontSize:13.5, lineHeight:1.55}}>{m.text}</div>}));
      return <div style={{display:'flex', flexDirection:'column', height:340, borderRadius:12, overflow:'hidden', background:'var(--wb-bg)', border:'1px solid var(--wb-sep)'}}>
        <MessageScroller items={items} streaming={false} threadKey="live"/>
        <div style={{padding:10, borderTop:'1px solid var(--wb-sep)', flexShrink:0}}>
          <button className="wb-btn" onClick={add} style={{width:'100%', border:0, borderRadius:9, background:'var(--wb-tint)', color:'#fff', fontFamily:'inherit', fontWeight:600, fontSize:13, padding:'9px 0', cursor:'pointer'}}>Send a turn</button>
        </div>
      </div>;
    }
  },
  terminal: {
    title: 'TermHeader · TermBody', dep: 'workbench.jsx', theme: 'wb', h: 400,
    code: 'import { TermBody } from "./workbench.tsx"\n\nexport default function App() {\n  return (\n    <div style={{ display: "flex", flexDirection: "column", height: 300, background: "#0C0C10" }}>\n      <TermBody seed={[{ t: "npm run dev", p: true }]}/>\n    </div>\n  )\n}\n// desktop: <TerminalDock h={h} setH={setH}/> · mobile: wrap in <SnapSheet snaps={[0.52, 0.93]}>',
    Render: function TermLive() {
      return <div style={{display:'flex', flexDirection:'column', height:300, borderRadius:12, overflow:'hidden', background:'#0C0C10', border:'1px solid var(--wb-sep)'}}>
        <TermHeader onClose={()=>{}}/>
        <TermBody seed={[{t:'help', p:true}, {t:'available: ls, pwd, echo, whoami, npm run dev, clear'}]}/>
      </div>;
    }
  },
  surfaces: {
    title: 'SurfacePanel', dep: 'workbench.jsx', theme: 'wb', h: 480,
    code: 'import { SurfacePanel } from "./workbench.tsx"\n\nexport default function App() {\n  const [kind, setKind] = React.useState(null)  // null shows the surface picker\n  return (\n    <div style={{ height: 380 }}>\n      <SurfacePanel kind={kind} compact\n        onOpen={k => setKind(k)}\n        onClose={() => setKind(null)}\n        full={false} onFull={() => {}}/>\n    </div>\n  )\n}',
    Render: function SurfLive() {
      const [kind, setKind] = useState(null);
      return <div style={{height:380, borderRadius:12, overflow:'hidden', border:'1px solid var(--wb-sep)'}}>
        <SurfacePanel kind={kind} compact onOpen={k=>setKind(k)} onClose={()=>setKind(null)} full={false} onFull={()=>{}}/>
      </div>;
    }
  },
  stream: {
    title: 'MdView · GitbookStreamdown', dep: 'workbench.jsx', theme: 'tk', h: 480,
    code: 'import { MdView } from "./workbench.tsx"\n\nexport default function App() {\n  const [text, setText] = React.useState("")\n  const [live, setLive] = React.useState(false)\n  // feed chunks in as they arrive from your stream:\n  //   setText(partial); setLive(true)  …  setLive(false) when done\n  return <MdView markdown={text} streaming={live}/>\n}',
    Render: function StreamLive() {
      const [txt, setTxt] = useState(REPLY_SERVERS);
      const [live, setLive] = useState(false);
      const t = useRef(null);
      useEffect(()=>()=>clearInterval(t.current), []);
      const replay = () => {
        clearInterval(t.current);
        const words = REPLY_SERVERS.split(' '); let i = 0;
        setLive(true); setTxt('');
        t.current = setInterval(()=>{
          i += 4;
          if (i >= words.length) { clearInterval(t.current); setTxt(REPLY_SERVERS); setLive(false); }
          else setTxt(words.slice(0, i).join(' '));
        }, 95);
      };
      return <div style={{fontFamily:WFONT}}>
        <DemoBtn label={live ? 'Streaming…' : 'Replay stream'} onPress={replay} style={{marginBottom:10, background:'#0A84FF'}}/>
        <div style={{border:'1px solid rgba(20,20,40,.1)', borderRadius:12, padding:'6px 16px', minHeight:280, background:'#fff'}}>
          <MdView markdown={txt} streaming={live}/>
        </div>
      </div>;
    }
  }
};
/* The runtime modules register a global; the .tsx facade next to each one turns that global into real
   named ESM exports, so docs samples read `import { ChatShell } from "./chatkit.tsx"`. */
const DEP_GLOBAL = {'touchkit.jsx':'TouchKit', 'workbench.jsx':'TouchKitWB', 'chatkit.jsx':'TouchKitChat', 'pencilkit.jsx':'TouchKitPencil', 'beautiful.jsx':'BUI'};
function tsxFacade(dep) {
  const g = DEP_GLOBAL[dep] || 'TouchKit';
  const ns = window[g] || {};
  const names = Object.keys(ns).filter(k => /^[A-Za-z_$][\w$]*$/.test(k));
  return 'import "./' + dep + '"\n'
    + 'const NS = (window as any).' + g + '\n'
    + names.map(k => 'export const ' + k + ' = NS.' + k).join('\n')
    + '\nexport default NS\n';
}
function DocsLive({demo}) {
  const spec = LIVE[demo] || (window.__buiLIVE || {})[demo] || null;
  const [tab, setTab] = useState('preview');
  const [, bump] = useState(0);
  const [files, setFiles] = useState(null);
  useEffect(() => { setTab('preview'); setFiles(null); }, [demo]);
  useEffect(() => {   /* Beautiful UI demos register async from beautiful.jsx */
    if (window.__buiLIVE || !/^bui/.test(demo)) return;
    const h = () => bump(x => x + 1);
    window.addEventListener('bui-ready', h);
    return () => window.removeEventListener('bui-ready', h);
  }, [demo]);   /* React reuses this component across page navs — reset per demo */
  useEffect(() => {
    if (!spec || spec.theme !== 'tk' || window.TouchKit) return;
    const t = setInterval(() => { if (window.TouchKit) { clearInterval(t); bump(x => x + 1); } }, 150);
    const stop = setTimeout(() => clearInterval(t), 12000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, []);
  useEffect(() => {
    if (tab !== 'node' || !spec) return;
    dsPlayground();
    const h = () => bump(x => x + 1);
    window.addEventListener('wb-dspg', h);
    if (!files) srcOf(spec.dep).then(src => {
      if (!src) return;
      const cache = window.__wbLiveFiles = window.__wbLiveFiles || {};
      if (!cache[demo]) {
        cache[demo] = {
          '/src/main.jsx': 'import React from "react"\nimport { createRoot } from "react-dom/client"\nimport App from "./App.jsx"\ncreateRoot(document.getElementById("root")).render(<App/>)\n',
          '/src/App.jsx': 'import React from "react"\n' + spec.code + '\n'
        };
        cache[demo]['/src/' + spec.dep] = src;
        cache[demo]['/src/' + spec.dep.replace(/\.jsx$/, '.tsx')] = tsxFacade(spec.dep);
      }
      setFiles(cache[demo]);
    });
    return () => window.removeEventListener('wb-dspg', h);
  }, [tab, demo]);
  if (!spec) return null;
  const ready = spec.theme !== 'tk' || !!window.TouchKit;
  const Seg = window.TouchKit && window.TouchKit.Segmented;
  const pg = window.__wbDSPG;
  const Render = spec.Render;
  const tabs = [{id:'preview', label:'Preview'}, {id:'code', label:'Code'}, {id:'node', label:'almost-node'}];
  return <div style={{border:'1px solid rgba(20,20,40,.12)', borderRadius:14, overflow:'hidden', margin:'18px 0', background:'#fff'}}>
    <div style={{display:'flex', alignItems:'center', gap:10, padding:'8px 8px 8px 14px', borderBottom:'1px solid rgba(20,20,40,.08)', flexWrap:'wrap'}}>
      <span style={{fontSize:12, fontWeight:650, fontFamily:MONO, color:'#55555E'}}>{spec.title}</span>
      <span style={{flex:1}}/>
      <div style={{...TKL, width:268, fontFamily:WFONT}}>
        {Seg ? <Seg options={tabs} value={tab} onChange={id => { setTab(id); tick(); }}/>
          : <div style={{display:'flex', gap:4}}>{tabs.map(t => <button key={t.id} className="wb-btn" onClick={() => setTab(t.id)}
              style={{border:0, borderRadius:7, padding:'5px 10px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                background:tab === t.id ? 'rgba(10,132,255,.12)' : 'none', color:tab === t.id ? '#0A84FF' : '#71717C'}}>{t.label}</button>)}</div>}
      </div>
    </div>
    {tab === 'preview' ? <div style={{...(spec.theme === 'wb' ? WBD : TKL), background:spec.theme === 'wb' ? '#141419' : '#F2F2F7',
        colorScheme:spec.theme === 'wb' ? 'dark' : 'light', padding:18, minHeight:spec.h - 90,
        fontFamily:WFONT, color:spec.theme === 'wb' ? '#EDEDF2' : '#0B0B0F', boxSizing:'border-box'}}>
      {ready ? <ErrB label="preview"><Render/></ErrB>
        : <div style={{fontFamily:MONO, fontSize:12, color:'#8A8A94'}}>loading touchkit.jsx…</div>}
    </div> : null}
    {tab === 'code' ? <div style={{padding:'4px 16px 10px'}}><MdView markdown={'```jsx\n' + spec.code + '\n```'}/></div> : null}
    {tab === 'node' ? <div style={{padding:14}}>
      {pg && pg.ReactDemo && files
        ? <ErrB label="almost-node"><pg.ReactDemo files={files} entry="/src/main.jsx" height={spec.h} title={spec.title}/></ErrB>
        : <div style={{fontFamily:MONO, fontSize:12, color:'#8A8A94', padding:'10px 0'}}>
            {window.__wbDSPGerr ? 'docstream playground failed to load: ' + window.__wbDSPGerr : 'loading docstream playground + almost-node…'}</div>}
      <div style={{fontSize:11.5, color:'#9A9AA3', lineHeight:1.55, marginTop:10}}>
        docstream v0.3.0's ReactDemo writes these files — the code from the Code tab plus the real {spec.dep} — into almost-node (a WASM Node runtime) and boots a Vite dev server in a sandboxed iframe. It needs the almost-node service worker, so inside this embed it may stay on “starting”; in a host app with almostnodePlugin() it runs for real.</div>
    </div> : null}
  </div>;
}

/* ══ MessageScroller — shadcn message-scroller semantics ══
   Anchors new turns near the top (peek of the previous item), follows the live edge only while the
   reader is there, releases on scroll intent, jump-to-latest button, opens threads at last anchor. */
function MessageScroller({items, streaming, threadKey, peek}) {
  peek = peek == null ? 52 : peek;
  const vp = useRef(null), ct = useRef(null), sp = useRef(null);
  const st = useRef({follow:true, prog:0, ids:'', thread:undefined});
  const [canDown, setCanDown] = useState(false);
  const gap = el => el.scrollHeight - el.scrollTop - el.clientHeight;
  const markProg = ms => { st.current.prog = performance.now() + ms; };
  const layoutSpacer = () => {
    const el = vp.current, c = ct.current, s = sp.current; if (!el || !c || !s) return;
    let h = 0;
    const anchors = c.querySelectorAll('[data-anchor="1"]');
    const last = anchors[anchors.length - 1];
    if (last) {
      const turnH = (c.scrollHeight - s.offsetHeight) - last.offsetTop;
      h = Math.max(0, el.clientHeight - peek - turnH);
    }
    if (Math.abs((parseFloat(s.style.height) || 0) - h) > 1) s.style.height = h + 'px';
  };
  const toEnd = smooth => { const el = vp.current; if (!el) return; st.current.follow = true; markProg(smooth ? 800 : 90);
    el.scrollTo({top:el.scrollHeight, behavior:smooth ? 'smooth' : 'auto'}); };
  const anchorTop = (id, smooth) => { const el = vp.current; if (!el) return false;
    const row = el.querySelector('[data-mid="' + CSS.escape(id) + '"]'); if (!row) return false;
    markProg(smooth ? 800 : 90);
    el.scrollTo({top:Math.max(0, row.offsetTop - peek), behavior:smooth ? 'smooth' : 'auto'});
    return true; };
  useLayoutEffect(()=>{
    const s = st.current;
    const ids = items.map(i=>i.id).join(',');
    const prev = s.ids; s.ids = ids;
    layoutSpacer();
    if (s.thread !== threadKey) {
      s.thread = threadKey;
      requestAnimationFrame(()=>{
        layoutSpacer();
        const anchors = items.filter(i=>i.anchor);
        if (!(anchors.length && anchorTop(anchors[anchors.length-1].id, false))) toEnd(false);
        const el = vp.current; if (el) { s.follow = gap(el) < 40; setCanDown(gap(el) > 160); }
      });
      return;
    }
    if (prev && ids !== prev) {
      const prevArr = prev.split(',');
      const added = items.filter(i=>!prevArr.includes(i.id));
      const newAnchor = added.filter(i=>i.anchor).pop();
      if (newAnchor) requestAnimationFrame(()=>{ layoutSpacer(); anchorTop(newAnchor.id, true); st.current.follow = true; });
    }
  }, [items, threadKey]);
  useEffect(()=>{
    const el = vp.current, c = ct.current;
    if (!el || !c || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(()=>{
      layoutSpacer();
      const s = st.current;
      if (s.follow && performance.now() > s.prog && gap(el) > 2) el.scrollTop = el.scrollHeight;
      setCanDown(gap(el) > 160);
    });
    ro.observe(c); ro.observe(el);
    return ()=>ro.disconnect();
  }, []);
  const intent = () => { const el = vp.current; if (el && gap(el) > 40) st.current.follow = false; };
  const onScroll = () => { const el = vp.current; if (!el) return;
    if (gap(el) < 40 && performance.now() > st.current.prog) st.current.follow = true;
    setCanDown(gap(el) > 160); };
  const showBtn = canDown || (streaming && !st.current.follow);
  return <div style={{position:'relative', flex:1, minHeight:0}}>
    <div ref={vp} className="wb-scroll" role="region" aria-label="Messages" tabIndex={0}
      onScroll={onScroll}
      onWheel={e=>{ if (e.deltaY < 0) intent(); }}
      onTouchMove={intent}
      onKeyDown={e=>{ if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') intent(); }}
      style={{position:'absolute', inset:0, overflowY:'auto', overscrollBehavior:'contain', outline:'none'}}>
      <div ref={ct} role="log" aria-relevant="additions" aria-busy={!!streaming}
        style={{maxWidth:780, margin:'0 auto', padding:'16px 22px 4px', boxSizing:'border-box'}}>
        {items.map(it=><div key={it.id} data-mid={it.id} data-anchor={it.anchor ? '1' : undefined}
          style={{contentVisibility:'auto', containIntrinsicSize:'auto 48px'}}>{it.node}</div>)}
        <div ref={sp} aria-hidden="true"/>
      </div>
    </div>
    {showBtn ? <button className="wb-btn" onClick={()=>{ toEnd(true); tick(); }} aria-label="Jump to latest"
      style={{position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:12, display:'flex', alignItems:'center', gap:7,
        border:'1px solid var(--wb-sep)', background:'var(--wb-card)', color:'var(--wb-label)', cursor:'pointer',
        borderRadius:99, padding:streaming ? '6px 13px' : 7, boxShadow:'0 4px 16px rgba(0,0,0,.35)', fontSize:12.5, fontWeight:600}}>
      {streaming ? <span style={{width:7, height:7, borderRadius:'50%', background:'var(--wb-tint)', animation:'wbPulse 1.1s infinite'}}/> : null}
      {streaming ? 'Streaming' : null}<WIcon name="chevD" size={15} sw={2.2}/></button> : null}
  </div>;
}

/* ══ SnapSheet — vaul-style bottom drawer (drag handle, snap points, velocity release) ══ */
function SnapSheet({open, onClose, snaps, children, bg}) {
  snaps = snaps || [0.55, 0.94];
  const maxS = Math.max(...snaps);
  const [vis, setVis] = useState(false);
  const [snap, setSnap] = useState(0);
  const [ty, setTy] = useState(null);      // px translate while dragging; null = settled on snap
  const [anim, setAnim] = useState(true);
  const wrap = useRef(null);
  const st = useRef({drag:false, y0:0, ty0:0, y:0, t:0, v:0});
  const ch = () => wrap.current ? wrap.current.offsetHeight : 700;
  const restTy = idx => ch() * (maxS - snaps[idx]);
  useEffect(()=>{
    if (open) { setVis(true); setSnap(0); setAnim(false); setTy(ch() * maxS);
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ setAnim(true); setTy(null); }));
    } else if (vis) { setAnim(true); setTy(ch() * maxS); const t = setTimeout(()=>{ setVis(false); setTy(null); }, 430); return ()=>clearTimeout(t); }
  }, [open]);
  if (!open && !vis) return null;
  const curTy = ty != null ? ty : restTy(snap);
  const down = e => { st.current = {drag:true, y0:e.clientY, ty0:curTy, y:e.clientY, t:performance.now(), v:0};
    e.currentTarget.setPointerCapture(e.pointerId); setAnim(false); };
  const move = e => { const s = st.current; if (!s.drag) return;
    const now = performance.now();
    if (now - s.t > 4) { s.v = (e.clientY - s.y) / (now - s.t); s.y = e.clientY; s.t = now; }
    let t = s.ty0 + (e.clientY - s.y0);
    const top = restTy(snaps.indexOf(maxS));
    if (t < top) t = top - Math.pow(top - t, 0.72);
    setTy(Math.max(0, t)); };
  const up = () => { const s = st.current; if (!s.drag) return; s.drag = false;
    const proj = curTy + s.v * 200;
    const H = ch();
    let best = -1, bd = Infinity;
    snaps.forEach((f,i)=>{ const d = Math.abs(proj - H*(maxS - f)); if (d < bd) { bd = d; best = i; } });
    if (Math.abs(proj - H*maxS) < bd || proj > H*(maxS - Math.min(...snaps)) + H*0.12) { vib([6]); onClose(); return; }
    setAnim(true); setSnap(best); setTy(null); tick(); };
  const visFrac = maxS - curTy / ch() * 1;
  return <div ref={wrap} style={{position:'absolute', inset:0, zIndex:70, overflow:'hidden'}}>
    <div onClick={onClose} style={{position:'absolute', inset:0, background:'rgba(0,0,0,.45)',
      opacity:Math.min(1, Math.max(0, visFrac / maxS)), transition:anim ? 'opacity .42s ' + EASE : 'none'}}/>
    <div style={{position:'absolute', left:0, right:0, bottom:0, height:(maxS*100)+'%',
        transform:'translateY(' + curTy + 'px)', transition:anim ? 'transform .42s ' + EASE : 'none',
        background:bg || 'var(--wb-card)', borderRadius:'16px 16px 0 0', border:'1px solid var(--wb-sep)', borderBottom:0,
        boxShadow:'0 -12px 40px rgba(0,0,0,.5)', display:'flex', flexDirection:'column', touchAction:'none'}}>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{padding:'8px 0 4px', cursor:'grab', flexShrink:0, touchAction:'none'}}>
        <div style={{width:38, height:5, borderRadius:3, background:'rgba(255,255,255,.22)', margin:'0 auto'}}/>
      </div>
      <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>{children}</div>
    </div>
  </div>;
}

/* ══ Thread sidebar ══ */
function WBSidebar({threads, cur, onSelect, onNew, onClose, compact}) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [openSec, setOpenSec] = useState(true);
  const list = threads.filter(t=>!q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()));
  const active = list.filter(t=>!t.settled), settled = list.filter(t=>t.settled);
  const shownSettled = showAll ? settled : settled.slice(0, 7);
  const row = t => <button key={t.id} className="wb-btn wb-hl" onClick={()=>{ tick(); onSelect(t.id); }}
    style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'6px 8px', border:0, borderRadius:8,
      background:cur === t.id ? 'var(--wb-fill2)' : 'transparent', color:'var(--wb-label)', fontSize:13, cursor:'pointer', textAlign:'left', boxSizing:'border-box'}}>
    <WIcon name="msg" size={15} sw={1.8} style={{color:'var(--wb-label3)'}}/>
    <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{t.title}</span>
    <span style={{fontSize:11.5, color:'var(--wb-label3)', flexShrink:0}}>{t.age}</span>
  </button>;
  return <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column', boxSizing:'border-box', background:'var(--wb-side)'}}>
    <div style={{display:'flex', alignItems:'center', gap:8, padding:'12px 12px 8px'}}>
      <span style={{width:22, height:22, borderRadius:6, background:'linear-gradient(135deg, var(--wb-tint), #5E5CE6)', display:'grid', placeItems:'center', flexShrink:0}}>
        <WIcon name="spark" size={13} sw={2.2} style={{color:'#fff'}}/></span>
      <span style={{fontSize:13.5, fontWeight:700, letterSpacing:'-.1px'}}>Workbench</span>
      {compact ? <IconBtn name="x" label="Close sidebar" onPress={onClose} style={{marginLeft:'auto'}}/> : null}
    </div>
    <div style={{display:'flex', gap:6, padding:'0 12px 6px'}}>
      <div style={{flex:1, display:'flex', alignItems:'center', gap:6, background:'var(--wb-fill)', borderRadius:8, padding:'5px 8px'}}>
        <WIcon name="search" size={14} sw={2} style={{color:'var(--wb-label3)'}}/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search" aria-label="Search threads"
          style={{flex:1, minWidth:0, border:0, background:'none', outline:'none', color:'var(--wb-label)', fontSize:12.5, fontFamily:'inherit'}}/>
      </div>
      <IconBtn name="compose" label="New thread" onPress={()=>{ vib([8]); onNew(); }} size={17}/>
    </div>
    <button className="wb-btn wb-hl" style={{display:'flex', alignItems:'center', gap:8, margin:'0 8px', padding:'6px 8px', border:0, borderRadius:8,
        background:'transparent', color:'var(--wb-label2)', fontSize:12.5, fontWeight:600, cursor:'pointer', textAlign:'left'}}>
      <WIcon name="folder" size={15} sw={1.8}/><span style={{flex:1}}>All projects</span>
      <WIcon name="chevD" size={13} sw={2.2}/><WIcon name="folderP" size={15} sw={1.8} style={{color:'var(--wb-label3)'}}/>
    </button>
    <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'4px 8px 8px'}}>
      {active.length ? <React.Fragment>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 8px 4px'}}>
          <span style={{fontSize:11, fontWeight:600, letterSpacing:'.4px', color:'var(--wb-label3)'}}>Active</span>
          <span style={{flex:1, height:1, background:'var(--wb-sep)'}}/>
        </div>
        {active.map(row)}
      </React.Fragment> : null}
      <button className="wb-btn" onClick={()=>{ setOpenSec(o=>!o); tick(); }}
        style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'10px 8px 4px', border:0, background:'none', cursor:'pointer', boxSizing:'border-box'}}>
        <span style={{fontSize:11, fontWeight:600, letterSpacing:'.4px', color:'var(--wb-label3)'}}>Settled</span>
        <span style={{flex:1, height:1, background:'var(--wb-sep)'}}/>
        <WIcon name={openSec ? 'chevU' : 'chevD'} size={12} sw={2.2} style={{color:'var(--wb-label3)'}}/>
      </button>
      {openSec ? <React.Fragment>
        {shownSettled.map(row)}
        {settled.length > shownSettled.length ? <button className="wb-btn wb-hl" onClick={()=>{ setShowAll(true); tick(); }}
          style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'6px 8px', border:0, borderRadius:8, background:'none',
            color:'var(--wb-label3)', fontSize:12.5, cursor:'pointer', textAlign:'left'}}>
          <WIcon name="plus" size={13} sw={2}/><span>Show {settled.length - shownSettled.length} more</span></button> : null}
      </React.Fragment> : null}
    </div>
    <div style={{padding:'8px 10px 10px', borderTop:'1px solid var(--wb-sep)'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:9, background:'rgba(10,132,255,.12)', marginBottom:6}}>
        <WIcon name="dl" size={14} sw={2} style={{color:'var(--wb-tint)'}}/>
        <span style={{flex:1, fontSize:12.5, fontWeight:600, color:'var(--wb-tint)'}}>Update available</span>
        <WIcon name="x" size={13} sw={2} style={{color:'var(--wb-label3)'}}/>
      </div>
      <button className="wb-btn wb-hl" style={{display:'flex', alignItems:'center', gap:8, width:'100%', padding:'7px 8px', border:0, borderRadius:8,
          background:'none', color:'var(--wb-label2)', fontSize:13, cursor:'pointer', textAlign:'left'}}>
        <WIcon name="gear" size={16} sw={1.7}/><span>Settings</span></button>
    </div>
  </div>;
}

/* ══ Terminal ══ */
function fakeShell(cmd, files) {
  const c = cmd.trim();
  if (!c) return [];
  if (c === 'help') return ['available: ls, pwd, echo, whoami, npm run dev, clear'].map(t=>({t}));
  if (c === 'ls') return [{t:files.join('   ')}];
  if (c === 'pwd') return [{t:'/Users/dev/cookbook'}];
  if (c === 'whoami') return [{t:'dev'}];
  if (c.startsWith('echo ')) return [{t:c.slice(5)}];
  if (c === 'npm run dev') return [{t:'> cookbook@0.1.0 dev'}, {t:'> vite'}, {t:''}, {t:'  VITE v6.0.3  ready in 412 ms', c:'#7EE0B8'}, {t:''}, {t:'  ➜  Local:   http://localhost:3000/', c:'#8AB4FF'}];
  if (c === 'clear') return 'CLEAR';
  return [{t:'zsh: command not found: ' + c.split(' ')[0], c:'#FF8A80'}];
}
const TERM_FILES = ['package.json', 'src', 'touchkit.jsx', 'workbench.jsx', 'vite.config.js'];
function TermBody({seed, autoFocus}) {
  const [hist, setHist] = useState(seed || []);
  const [val, setVal] = useState('');
  const sc = useRef(null), inp = useRef(null);
  useEffect(()=>{ const el = sc.current; if (el) el.scrollTop = el.scrollHeight; }, [hist]);
  const prompt = <span><span style={{color:'#7EE0B8'}}>dev@workbench</span> <span style={{color:'#8AB4FF'}}>cookbook</span> <span style={{color:'var(--wb-label3)'}}>%</span></span>;
  const run = () => {
    const out = fakeShell(val, TERM_FILES);
    if (out === 'CLEAR') setHist([]);
    else setHist(h=>[...h, {t:val, p:true}, ...out]);
    setVal(''); tick();
  };
  return <div ref={sc} className="wb-scroll" onClick={()=>{ if (inp.current) inp.current.focus(); }}
    style={{flex:1, minHeight:0, overflowY:'auto', padding:'10px 14px', fontFamily:MONO, fontSize:12.5, lineHeight:1.62, color:'#D4D4DE', cursor:'text'}}>
    {hist.map((l,i)=><div key={i} style={{whiteSpace:'pre-wrap', color:l.c || (l.p ? '#D4D4DE' : 'var(--wb-label2)')}}>
      {l.p ? <span>{prompt} </span> : null}{l.t}</div>)}
    <div style={{display:'flex', gap:7, alignItems:'baseline'}}>
      {prompt}
      <input ref={inp} value={val} autoFocus={autoFocus} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{ if (e.key === 'Enter') run(); }}
        aria-label="Terminal input" spellCheck={false} autoCapitalize="none" autoComplete="off"
        style={{flex:1, minWidth:40, border:0, background:'none', outline:'none', color:'#EDEDF2', font:'inherit', padding:0}}/>
    </div>
  </div>;
}
function TermHeader({onClose, onClear, title}) {
  return <div style={{display:'flex', alignItems:'center', gap:4, padding:'5px 8px 5px 14px', flexShrink:0, borderBottom:'1px solid var(--wb-sep)'}}>
    <WIcon name="term" size={14} sw={1.8} style={{color:'var(--wb-label3)'}}/>
    <span style={{fontSize:12, fontWeight:600, color:'var(--wb-label2)', marginLeft:4}}>{title || 'zsh — cookbook'}</span>
    <span style={{flex:1}}/>
    <IconBtn name="split" label="Split terminal" size={15} onPress={tick}/>
    <IconBtn name="plus" label="New terminal" size={15} onPress={tick}/>
    <IconBtn name="trash" label="Close terminal" size={15} onPress={onClose}/>
  </div>;
}
function TerminalDock({h, setH, onClose, seed}) {
  const st = useRef(null);
  const down = e => { st.current = {y0:e.clientY, h0:h}; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => { if (!st.current) return; setH(Math.min(520, Math.max(110, st.current.h0 - (e.clientY - st.current.y0)))); };
  const up = () => { st.current = null; };
  return <div style={{height:h, flexShrink:0, position:'relative', background:'#0C0C10', borderTop:'1px solid var(--wb-sep)', display:'flex', flexDirection:'column'}}>
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{position:'absolute', top:-3, left:0, right:0, height:7, cursor:'ns-resize', zIndex:2, touchAction:'none'}}/>
    <TermHeader onClose={onClose}/>
    <TermBody seed={seed}/>
  </div>;
}

/* ══ Surfaces (right panel) ══ */
const SURFACES = [
  {k:'browser', icon:'globe', name:'Browser', blurb:'Open a local app or URL.'},
  {k:'terminal', icon:'term', name:'Terminal', blurb:'Start a shell in this workspace.'},
  {k:'files', icon:'files', name:'Files', blurb:'Browse and read workspace files.'},
  {k:'diff', icon:'diff', name:'Diff', blurb:'Review changes in this thread.'},
  {k:'agents', icon:'bot', name:'Agents', blurb:'Watch subagents and workflows run.'}
];
function SurfaceEmpty({onOpen}) {
  return <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', justifyContent:'center', padding:'26px 20px'}}>
    <div style={{textAlign:'center', marginBottom:20}}>
      <div style={{fontSize:16.5, fontWeight:650}}>Open a surface</div>
      <div style={{fontSize:12.5, color:'var(--wb-label2)', marginTop:3}}>Choose what to show in the right panel.</div>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, maxWidth:420, width:'100%', margin:'0 auto'}}>
      {SURFACES.map(s=><button key={s.k} className="wb-btn wb-hl" onClick={()=>{ vib([8]); onOpen(s.k); }}
        style={{border:'1px solid var(--wb-sep)', background:'var(--wb-card)', borderRadius:13, padding:'15px 14px', cursor:'pointer', textAlign:'left', color:'var(--wb-label)'}}>
        <WIcon name={s.icon} size={21} sw={1.6} style={{color:'var(--wb-label2)'}}/>
        <div style={{fontSize:13.5, fontWeight:650, marginTop:10}}>{s.name}</div>
        <div style={{fontSize:11.5, color:'var(--wb-label2)', marginTop:3, lineHeight:1.45}}>{s.blurb}</div>
      </button>)}
    </div>
  </div>;
}
function SurfaceBrowser() {
  return <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
    <div style={{display:'flex', alignItems:'center', gap:6, padding:'7px 10px', borderBottom:'1px solid var(--wb-sep)', flexShrink:0}}>
      <WIcon name="chevR" size={14} sw={2} style={{color:'var(--wb-label3)', transform:'scaleX(-1)'}}/>
      <WIcon name="chevR" size={14} sw={2} style={{color:'var(--wb-label3)', opacity:.4}}/>
      <div style={{flex:1, display:'flex', alignItems:'center', gap:6, background:'var(--wb-fill)', borderRadius:7, padding:'4px 9px', fontSize:12, fontFamily:MONO, color:'var(--wb-label2)'}}>
        <span style={{width:6, height:6, borderRadius:'50%', background:'var(--wb-green)'}}/>http://localhost:3000</div>
    </div>
    <div style={{flex:1, minHeight:0, background:'#101014', display:'grid', placeItems:'center', padding:20}}>
      <div style={{textAlign:'center'}}>
        <span style={{width:40, height:40, borderRadius:10, background:'linear-gradient(135deg, var(--wb-tint), #5E5CE6)', display:'inline-grid', placeItems:'center'}}>
          <WIcon name="spark" size={20} sw={2} style={{color:'#fff'}}/></span>
        <div style={{fontSize:13.5, fontWeight:650, marginTop:12}}>app-builder</div>
        <div style={{fontSize:12, color:'var(--wb-label3)', marginTop:3, fontFamily:MONO}}>serving on :3000 · pid 5229</div>
        <div style={{display:'flex', gap:6, marginTop:16, justifyContent:'center'}}>
          {[52, 76, 40].map((w,i)=><span key={i} style={{width:w, height:8, borderRadius:4, background:'var(--wb-fill2)'}}/>)}
        </div>
      </div>
    </div>
  </div>;
}
const FILE_TREE = [
  ['cookbook', 0, 'folder', 1],
  ['src', 1, 'folder', 1],
  ['components', 2, 'folder', 1],
  ['Credenza.tsx', 3, 'doc'], ['SideDrawer.tsx', 3, 'doc'], ['MessageScroller.tsx', 3, 'doc'],
  ['haptics.ts', 2, 'doc'], ['App.tsx', 2, 'doc'],
  ['touchkit.jsx', 1, 'doc'], ['workbench.jsx', 1, 'doc'], ['package.json', 1, 'doc'], ['vite.config.js', 1, 'doc']
];
function SurfaceFiles() {
  const [sel, setSel] = useState('App.tsx');
  return <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'8px 10px'}}>
    {FILE_TREE.map(([name, depth, kind, open])=><button key={name} className="wb-btn wb-hl" onClick={()=>{ setSel(name); tick(); }}
      style={{display:'flex', alignItems:'center', gap:7, width:'100%', padding:'4.5px 8px', paddingLeft:8 + depth*16, border:0, borderRadius:7,
        background:sel === name ? 'var(--wb-fill2)' : 'none', color:'var(--wb-label)', fontSize:12.5, fontFamily:kind === 'folder' ? 'inherit' : MONO, cursor:'pointer', textAlign:'left', boxSizing:'border-box'}}>
      {kind === 'folder' ? <WIcon name="chevD" size={11} sw={2.4} style={{color:'var(--wb-label3)'}}/> : <span style={{width:11}}/>}
      <WIcon name={kind === 'folder' ? 'folder' : 'doc'} size={14.5} sw={1.7} style={{color:kind === 'folder' ? '#8AB4FF' : 'var(--wb-label3)'}}/>
      <span>{name}</span>
    </button>)}
  </div>;
}
const DIFF_LINES = [
  [' ', 'function Haptics.boot() {'],
  ['-', '  if (navigator.vibrate) return;          // skipped the polyfill'],
  ['-', '  import("https://esm.run/ios-vibrator-pro-max");'],
  ['+', '  if (stub) delete navigator.vibrate;     // clear blockers first'],
  ['+', '  import("…/ios-vibrator-pro-max@3.0.3/+esm");  // pinned'],
  ['+', '  window.addEventListener("tk-vib", report);'],
  [' ', '}']
];
function SurfaceDiff() {
  return <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'10px 12px'}}>
    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
      <WIcon name="doc" size={15} sw={1.8} style={{color:'var(--wb-label3)'}}/>
      <span style={{fontSize:12.5, fontFamily:MONO}}>touchkit.jsx</span>
      <span style={{fontSize:11.5, fontFamily:MONO, color:'var(--wb-green)'}}>+3</span>
      <span style={{fontSize:11.5, fontFamily:MONO, color:'var(--wb-red)'}}>−2</span>
    </div>
    <div style={{border:'1px solid var(--wb-sep)', borderRadius:9, overflow:'hidden'}}>
      {DIFF_LINES.map((l,i)=><div key={i} style={{display:'flex', fontFamily:MONO, fontSize:11.5, lineHeight:1.75,
          background:l[0] === '+' ? 'rgba(48,209,88,.11)' : l[0] === '-' ? 'rgba(255,69,58,.10)' : 'transparent'}}>
        <span style={{width:22, textAlign:'center', flexShrink:0, color:l[0] === '+' ? 'var(--wb-green)' : l[0] === '-' ? 'var(--wb-red)' : 'var(--wb-label3)'}}>{l[0]}</span>
        <span style={{whiteSpace:'pre', color:'var(--wb-label2)'}}>{l[1]}</span>
      </div>)}
    </div>
  </div>;
}
const AGENTS = [
  {n:'docs-writer', s:'running', m:'writing message-scroller.md · 2m 14s'},
  {n:'test-runner', s:'passed', m:'42 passed · 0 failed · 18s'},
  {n:'lint', s:'passed', m:'no issues · 4s'},
  {n:'bundle-size', s:'queued', m:'waiting on test-runner'}
];
function SurfaceAgents() {
  return <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'10px 12px'}}>
    {AGENTS.map(a=><div key={a.n} style={{display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, marginBottom:4, background:'var(--wb-card)', border:'1px solid var(--wb-sep)'}}>
      <span style={{width:8, height:8, borderRadius:'50%', flexShrink:0,
        background:a.s === 'running' ? 'var(--wb-tint)' : a.s === 'passed' ? 'var(--wb-green)' : 'var(--wb-label3)',
        animation:a.s === 'running' ? 'wbPulse 1.2s infinite' : 'none'}}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:12.5, fontWeight:650, fontFamily:MONO}}>{a.n}</div>
        <div style={{fontSize:11.5, color:'var(--wb-label2)', marginTop:1}}>{a.m}</div>
      </div>
      <span style={{fontSize:10.5, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:a.s === 'running' ? 'var(--wb-tint)' : a.s === 'passed' ? 'var(--wb-green)' : 'var(--wb-label3)'}}>{a.s}</span>
    </div>)}
  </div>;
}
function SurfacePanel({kind, onOpen, onClose, full, onFull, compact}) {
  const meta = SURFACES.find(s=>s.k === kind);
  return <div style={{width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'var(--wb-side)', boxSizing:'border-box'}}>
    <div style={{display:'flex', alignItems:'center', gap:2, padding:'6px 8px 6px 14px', borderBottom:'1px solid var(--wb-sep)', flexShrink:0, minHeight:40, boxSizing:'border-box'}}>
      {meta ? <WIcon name={meta.icon} size={15} sw={1.8} style={{color:'var(--wb-label2)'}}/> : null}
      <span style={{fontSize:13, fontWeight:650, marginLeft:meta ? 6 : 0}}>{meta ? meta.name : 'Surfaces'}</span>
      <span style={{flex:1}}/>
      {meta ? <IconBtn name="chevD" label="Switch surface" size={15} onPress={()=>{ tick(); onOpen(null); }}/> : null}
      {!compact ? <IconBtn name={full ? 'restore' : 'expand'} label={full ? 'Exit full screen' : 'Full screen'} size={16}
        onPress={()=>{ vib([8]); onFull(!full); }} active={full}/> : null}
      <IconBtn name="x" label="Close panel" size={16} onPress={onClose}/>
    </div>
    {kind === 'browser' ? <SurfaceBrowser/> :
     kind === 'terminal' ? <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column', background:'#0C0C10'}}><TermBody/></div> :
     kind === 'files' ? <SurfaceFiles/> :
     kind === 'diff' ? <SurfaceDiff/> :
     kind === 'agents' ? <SurfaceAgents/> : <SurfaceEmpty onOpen={onOpen}/>}
  </div>;
}
function SurfaceTabBar({active, onPick}) {
  const tabs = [{k:'chat', icon:'msg', name:'Chat'}, ...SURFACES.map(s=>({k:s.k, icon:s.icon, name:s.name}))];
  return <div role="tablist" aria-label="Surfaces" style={{display:'flex', flexShrink:0, borderTop:'1px solid var(--wb-sep)', background:'var(--wb-side)'}}>
    {tabs.map(t=><button key={t.k} className="wb-btn" role="tab" aria-selected={active === t.k} onClick={()=>onPick(t.k)}
      style={{flex:1, minWidth:0, minHeight:50, border:0, background:'none', cursor:'pointer', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:3, padding:'7px 0 6px', color:active === t.k ? 'var(--wb-tint)' : 'var(--wb-label3)'}}>
      <WIcon name={t.icon} size={20} sw={1.8}/>
      <span style={{fontSize:9.5, fontWeight:600, letterSpacing:'.2px'}}>{t.name}</span>
    </button>)}
  </div>;
}

/* ══ Composer ══ */
const MODELS = ['Claude Opus 4.7', 'Claude Sonnet 4.9', 'Claude Haiku 4.5'];
const EFFORTS = ['Extra High', 'High', 'Medium'];
const ACCESS = ['Full access', 'Read only', 'Ask first'];
function Pill({icon, label, onPress, tint}) {
  return <button className="wb-btn wb-hl" onClick={onPress} title={label}
    style={{display:'flex', alignItems:'center', gap:5, border:0, background:'none', color:tint ? 'var(--wb-tint)' : 'var(--wb-label2)',
      fontSize:12.5, fontWeight:600, cursor:'pointer', borderRadius:7, padding:'5px 7px'}}>
    {icon ? <WIcon name={icon} size={13.5} sw={2}/> : null}
    <span style={{whiteSpace:'nowrap'}}>{label}</span>
    <WIcon name="chevD" size={11} sw={2.4} style={{opacity:.6}}/>
  </button>;
}
const WB_MODELS = [
  {id:'sonnet', name:'Claude Sonnet 4.5', provider:'anthropic', source:'Anthropic'},
  {id:'opus', name:'Claude Opus 4.1', provider:'anthropic', source:'Anthropic'},
  {id:'gpt5', name:'GPT-5', provider:'openai', source:'OpenAI'},
  {id:'gpt5mini', name:'GPT-5 mini', provider:'openai', source:'OpenAI'},
  {id:'gemini', name:'Gemini 2.5 Pro', provider:'google', source:'Google'}
];
/* AnnotateLightbox — click a pasted image: PencilKit canvas over it; Save rasterizes image + strokes into one flattened PNG */
function AnnotateLightbox({src, onClose, onSave}) {
  const boxRef = useRef(null);
  const imgRef = useRef(null);
  const [, bump] = useState(0);
  useEffect(() => {
    if (window.TouchKitPencil) return;
    const i = setInterval(() => { if (window.TouchKitPencil) { clearInterval(i); bump(x => x + 1); } }, 150);
    return () => clearInterval(i);
  }, []);
  const PK = window.TouchKitPencil;
  const save = () => {
    const img = imgRef.current, box = boxRef.current;
    if (!img || !box) return onClose();
    const w = img.clientWidth, h = img.clientHeight, sc = 2;
    const cv = document.createElement('canvas'); cv.width = w * sc; cv.height = h * sc;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const fin = () => { vib([12]); onSave(cv.toDataURL('image/png')); };
    const svg = box.querySelector('svg');
    if (!svg) return fin();
    const cl = svg.cloneNode(true);
    cl.setAttribute('width', w); cl.setAttribute('height', h);
    cl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const im = new Image();
    im.onload = () => { ctx.drawImage(im, 0, 0, cv.width, cv.height); fin(); };
    im.onerror = fin;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  };
  const btn = (label, primary, onPress) => <button onClick={onPress} style={{border:primary ? 0 : '1px solid rgba(255,255,255,.2)', borderRadius:9,
    background:primary ? 'var(--wb-tint, #0A84FF)' : 'none', color:'#fff', fontSize:12.5, fontWeight:650, padding:'7px 14px', cursor:'pointer', fontFamily:WFONT}}>{label}</button>;
  return <div onClick={onClose} style={{position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.74)', display:'grid', placeItems:'center'}}>
    <div onClick={e => e.stopPropagation()} style={{display:'flex', flexDirection:'column', gap:10, maxWidth:'90vw'}}>
      <div style={{display:'flex', alignItems:'center', gap:8}}>
        <span style={{fontSize:13, fontWeight:650, color:'#EDEDF2', flex:1, fontFamily:WFONT}}>Annotate — PencilKit strokes flatten into the image on save</span>
        {btn('Cancel', false, onClose)}
        {btn('Save annotation', true, save)}
      </div>
      <div ref={boxRef} style={{position:'relative', borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,.14)', background:'#0C0C10',
          '--tk-card':'#1C1C23', '--tk-sep':'rgba(255,255,255,.12)', '--tk-label':'#EDEDF2', '--tk-label2':'rgba(235,235,245,.6)',
          '--tk-label3':'rgba(235,235,245,.35)', '--tk-fill':'rgba(255,255,255,.07)', '--tk-fill2':'rgba(255,255,255,.14)', '--tk-tint':'var(--wb-tint, #0A84FF)'}}>
        <img ref={imgRef} src={src} alt="" style={{display:'block', maxWidth:'86vw', maxHeight:'68vh', minWidth:340, minHeight:240, objectFit:'contain'}}/>
        {PK && PK.PencilCanvas ? <PK.PencilCanvas dark/> : <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center', color:'#9C9CA6', fontSize:12.5, fontFamily:WFONT}}>loading PencilKit…</div>}
      </div>
    </div>
  </div>;
}
function Composer({onSend, streaming, onStop, autoFocus, wide}) {
  const [v, setV] = useState('');
  const [mi, setMi] = useState(0), [ei, setEi] = useState(0), [ai, setAi] = useState(0);
  const [model, setModel] = useState('sonnet');
  const [atts, setAtts] = useState([]);
  const [anno, setAnno] = useState(null);
  const [, bump] = useState(0);
  useEffect(() => {
    if (window.BUI) return;
    const h = () => bump(x => x + 1);
    window.addEventListener('bui-ready', h);
    return () => window.removeEventListener('bui-ready', h);
  }, []);
  const ta = useRef(null);
  const grow = el => { el.style.height = 'auto'; el.style.height = Math.min(190, el.scrollHeight) + 'px'; };
  const can = !!(v.trim() || atts.length);
  const send = () => {
    if (!can || streaming) return;
    vib([8]);
    const t = v.trim(), imgs = atts.map(a => a.src);
    setV(''); setAtts([]);
    if (ta.current) { ta.current.style.height = 'auto'; }
    onSend(t, imgs);
  };
  const paste = e => {
    const items = e.clipboardData && e.clipboardData.items; if (!items) return;
    let got = false;
    for (const it of items) if (it.type && it.type.indexOf('image/') === 0) {
      const f = it.getAsFile(); if (!f) continue;
      got = true;
      const rd = new FileReader();
      rd.onload = () => { vib([8]); setAtts(a => [...a, {id:'att' + Date.now() + Math.random(), src:rd.result}]); };
      rd.readAsDataURL(f);
    }
    if (got) e.preventDefault();
  };
  const MP = window.BUI && window.BUI.ModelPicker;
  const annoAtt = anno ? atts.find(a => a.id === anno) : null;
  return <div style={{width:'100%', boxSizing:'border-box'}}>
    <div style={{background:'var(--wb-card)', border:'1px solid var(--wb-sep)', borderRadius:15, boxShadow:'0 6px 24px rgba(0,0,0,.28)'}}>
      {atts.length ? <div style={{display:'flex', gap:8, flexWrap:'wrap', padding:'10px 12px 0'}}>
        {atts.map(a => <div key={a.id} style={{position:'relative'}}>
          <button onClick={()=>{ tick(); setAnno(a.id); }} title="Annotate with PencilKit"
            style={{display:'block', padding:0, border:'1px solid var(--wb-sep)', borderRadius:10, overflow:'hidden', cursor:'pointer', background:'#0C0C10'}}>
            <img src={a.src} alt="pasted attachment" style={{display:'block', height:58, maxWidth:130, objectFit:'cover'}}/>
          </button>
          <span style={{position:'absolute', left:4, bottom:4, display:'grid', placeItems:'center', width:18, height:18, borderRadius:6, background:'rgba(0,0,0,.55)', color:'#fff', pointerEvents:'none'}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4l6 6-10 10H4v-6z"/></svg>
          </span>
          <button onClick={()=>{ tick(); setAtts(x => x.filter(y => y.id !== a.id)); }} aria-label="Remove attachment"
            style={{position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', border:'1px solid var(--wb-sep)', background:'#26262E', color:'var(--wb-label2)', cursor:'pointer', display:'grid', placeItems:'center', padding:0, fontSize:10, lineHeight:1}}>✕</button>
        </div>)}
      </div> : null}
      <textarea ref={ta} value={v} rows={wide ? 3 : 1} autoFocus={autoFocus} aria-label="Message"
        placeholder="Ask anything — @ files, / commands, paste images"
        onChange={e=>{ setV(e.target.value); grow(e.target); }}
        onPaste={paste}
        onKeyDown={e=>{ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        style={{display:'block', width:'100%', boxSizing:'border-box', border:0, outline:'none', background:'none', resize:'none',
          color:'var(--wb-label)', fontFamily:'inherit', fontSize:14, lineHeight:1.5, padding:'12px 14px 4px', minHeight:wide ? 64 : 38}}/>
      <div style={{display:'flex', alignItems:'center', gap:5, padding:'4px 8px 8px 8px', flexWrap:'wrap'}}>
        {MP ? <MP models={WB_MODELS} value={model} onChange={setModel} favorites={['sonnet']} up={!wide}/>
          : <Pill icon="spark" label={MODELS[mi]} tint onPress={()=>{ setMi(i=>(i+1)%MODELS.length); tick(); }}/>}
        <Pill label={EFFORTS[ei]} onPress={()=>{ setEi(i=>(i+1)%EFFORTS.length); tick(); }}/>
        <Pill icon="lock" label={ACCESS[ai]} onPress={()=>{ setAi(i=>(i+1)%ACCESS.length); tick(); }}/>
        <span style={{flex:1}}/>
        {streaming
          ? <button className="wb-btn" onClick={onStop} aria-label="Stop" style={{position:'relative', width:30, height:30, border:0, background:'none', cursor:'pointer', display:'grid', placeItems:'center', color:'var(--wb-label)'}}>
              <svg width="30" height="30" viewBox="0 0 30 30" style={{position:'absolute', inset:0, animation:'wbSpin 1s linear infinite'}}>
                <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--wb-fill2)" strokeWidth="2.5"/>
                <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--wb-tint)" strokeWidth="2.5" strokeDasharray="24 55" strokeLinecap="round"/>
              </svg>
              <WIcon name="stop" size={12} sw={2.4}/>
            </button>
          : <button className="wb-btn" onClick={send} aria-label="Send" disabled={!can}
              style={{width:30, height:30, borderRadius:'50%', border:0, background:'var(--wb-tint)', color:'#fff', cursor:can ? 'pointer' : 'default',
                display:'grid', placeItems:'center', opacity:can ? 1 : .35, transition:'opacity .15s'}}>
              <WIcon name="up" size={16} sw={2.4}/>
            </button>}
      </div>
    </div>
    <div style={{display:'flex', alignItems:'center', gap:7, background:'var(--wb-fill)', borderRadius:9, padding:'6px 11px', margin:'6px 8px 0', fontSize:12, color:'var(--wb-label2)'}}>
      <WIcon name="folder" size={13.5} sw={1.9}/><span style={{flex:1}}>Local checkout</span>
      <WIcon name="branch" size={13.5} sw={1.9}/><span style={{fontFamily:MONO, fontSize:11.5}}>main</span>
      <WIcon name="chevD" size={11} sw={2.4} style={{opacity:.6}}/>
    </div>
    {annoAtt ? <AnnotateLightbox src={annoAtt.src} onClose={()=>setAnno(null)}
      onSave={d => { setAtts(x => x.map(y => y.id === anno ? {...y, src:d} : y)); setAnno(null); }}/> : null}
  </div>;
}

/* ══ Chat ══ */
function SettledBanner({onUnsettle}) {
  return <div style={{display:'flex', alignItems:'center', gap:11, border:'1px solid var(--wb-sep)', background:'var(--wb-card)', borderRadius:12, padding:'10px 12px', margin:'0 0 10px'}}>
    <WIcon name="checkC" size={20} sw={1.8} style={{color:'var(--wb-green)'}}/>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:13, fontWeight:650}}>This thread is settled</div>
      <div style={{fontSize:12, color:'var(--wb-label2)', marginTop:1}}>Sending a message moves it back to Active in the sidebar.</div>
    </div>
    <button className="wb-btn wb-hl" onClick={()=>{ tick(); onUnsettle(); }}
      style={{border:'1px solid var(--wb-sep)', background:'none', color:'var(--wb-label)', fontSize:12.5, fontWeight:600, borderRadius:8, padding:'6px 12px', cursor:'pointer', flexShrink:0}}>Un-settle</button>
  </div>;
}
function EmptyThread({onSend, streaming, onStop}) {
  const sug = ['Get the demo servers running', 'Explain the haptics engine', 'Diff my last change'];
  return <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', padding:'28px 20px'}}>
    <div style={{width:'100%', maxWidth:620}}>
      <div style={{textAlign:'center', marginBottom:18}}>
        <span style={{width:40, height:40, borderRadius:11, background:'linear-gradient(135deg, var(--wb-tint), #5E5CE6)', display:'inline-grid', placeItems:'center'}}>
          <WIcon name="spark" size={21} sw={2.1} style={{color:'#fff'}}/></span>
        <div style={{fontSize:21, fontWeight:700, letterSpacing:'-.3px', marginTop:12}}>What are we building?</div>
        <div style={{fontSize:13.5, color:'var(--wb-label2)', marginTop:4}}>Start a thread — ask anything about this workspace.</div>
      </div>
      <Composer onSend={onSend} streaming={streaming} onStop={onStop} autoFocus wide/>
      <div style={{display:'flex', gap:7, justifyContent:'center', flexWrap:'wrap', marginTop:14}}>
        {sug.map(s=><button key={s} className="wb-btn wb-hl" onClick={()=>{ vib([8]); onSend(s); }}
          style={{border:'1px solid var(--wb-sep)', background:'none', color:'var(--wb-label2)', fontSize:12.5, borderRadius:99, padding:'6px 13px', cursor:'pointer'}}>{s}</button>)}
      </div>
    </div>
  </div>;
}
/* WorkTrace — the "Worked for Ns" row, expandable into a Beautiful UI Thinking trace when beautiful.jsx is loaded */
function WorkTrace({meta, trace}) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (window.BUI) return;
    const h = () => bump(x => x + 1);
    window.addEventListener('bui-ready', h);
    return () => window.removeEventListener('bui-ready', h);
  }, []);
  const B = window.BUI;
  if (!B || !trace) return <div style={{display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--wb-label3)', margin:'2px 0 6px'}}>
    <WIcon name="clock" size={12.5} sw={2}/>{meta}<WIcon name="chevR" size={11} sw={2.4}/></div>;
  const T = B.Thinking;
  return <div style={{margin:'2px 0 10px'}}>
    <T defaultOpen={false} style={{maxWidth:480}}>
      <T.Trigger icon={<WIcon name="clock" size={13} sw={2} style={{color:'var(--wb-label3)'}}/>}>{meta}</T.Trigger>
      <T.Content>
        <T.Tabs>
          <T.Tab id="steps">Steps</T.Tab>
          {trace.search ? <T.Tab id="search">Search</T.Tab> : null}
          {trace.code ? <T.Tab id="coding">Coding</T.Tab> : null}
        </T.Tabs>
        <T.Panel id="steps">{trace.steps.map((s, i) => <T.Step key={i} done>{s}</T.Step>)}</T.Panel>
        {trace.search ? <T.Panel id="search">{trace.search.map(([site, q], i) => <T.Search key={i} site={site}>{q}</T.Search>)}</T.Panel> : null}
        {trace.code ? <T.Panel id="coding"><T.Code>{trace.code}</T.Code></T.Panel> : null}
      </T.Content>
    </T>
  </div>;
}
function ChatView({thread, streaming, onSend, onStop, onUnsettle, header}) {
  if (!thread) return <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
    {header}
    <EmptyThread onSend={onSend} streaming={false}/>
  </div>;
  const items = [];
  thread.msgs.forEach((m, i)=>{
    if (m.role === 'user') items.push({id:m.id, anchor:true, node:
      <div style={{display:'flex', justifyContent:'flex-end', margin:'10px 0'}}>
        <div style={{maxWidth:'78%', display:'grid', gap:6, justifyItems:'end'}}>
          {m.imgs && m.imgs.length ? <div style={{display:'flex', gap:6, justifyContent:'flex-end', flexWrap:'wrap'}}>
            {m.imgs.map((s, j) => <img key={j} src={s} alt="attachment" style={{height:110, maxWidth:210, objectFit:'cover', borderRadius:12, border:'1px solid var(--wb-sep)'}}/>)}</div> : null}
          {m.md ? <div style={{background:'var(--wb-fill2)', borderRadius:'14px 14px 4px 14px', padding:'9px 13px', fontSize:14, lineHeight:1.5, whiteSpace:'pre-wrap'}}>{m.md}</div> : null}
        </div>
      </div>});
    else items.push({id:m.id, node:
      <div style={{margin:'4px 0 14px'}}>
        {m.meta ? <WorkTrace meta={m.meta} trace={m.trace}/> : null}
        <MdView markdown={m.md} streaming={m.live}/>
        {m.live && !m.md ? <div style={{display:'flex', gap:5, padding:'6px 0'}}>
          {[0,1,2].map(j=><span key={j} style={{width:6, height:6, borderRadius:'50%', background:'var(--wb-label3)', animation:'wbPulse 1s ' + (j*0.18) + 's infinite'}}/>)}</div> : null}
      </div>});
  });
  return <div style={{flex:1, minHeight:0, display:'flex', flexDirection:'column'}}>
    {header}
    <MessageScroller items={items} streaming={streaming} threadKey={thread.id}/>
    <div style={{flexShrink:0, padding:'8px 22px 14px', maxWidth:780, margin:'0 auto', width:'100%', boxSizing:'border-box'}}>
      {thread.settled ? <SettledBanner onUnsettle={onUnsettle}/> : null}
      <Composer onSend={onSend} streaming={streaming} onStop={onStop}/>
    </div>
  </div>;
}

/* ══ demo replies (markdown exercising the docstream renderer) ══ */
const REPLY_SERVERS = `Both servers are now running detached and won't be killed by the tool's session limits.

| App | URL | PID | Log |
| --- | --- | --- | --- |
| app-builder | http://localhost:3000 | 5229 | app-builder.log |
| agent-kanban | http://localhost:3001 | 7099 | agent-kanban.log |

To stop them later:

\`\`\`bash
kill 5229 7099
# or
lsof -ti :3000 :3001 | xargs kill
\`\`\`

Both apps hot-reload — edit \`src/\` and the browser surface refreshes on save.`;
const REPLY_COMPONENT = `The scroller anchors each new turn near the top of the viewport, keeps a peek of the previous reply, and only follows the live edge while you're already there.

\`\`\`jsx
<MessageScroller
  items={msgs.map(m => ({ id: m.id, anchor: m.role === 'user', node: <Message m={m}/> }))}
  streaming={isStreaming}
  threadKey={thread.id}
/>
\`\`\`

1. **Anchoring** — a new user message scrolls to the top with ~52px of the previous turn peeking above.
2. **Follow output** — replies grow into the room below; the view never moves while you read.
3. **Release** — any upward scroll intent (wheel, touch, keys) stops the following instantly.
4. **Jump back** — the pill at the bottom returns you to the live edge and re-engages following.`;
const REPLY_REVIEW = `## Review notes

Checked the haptics path end to end:

- \`Haptics.boot()\` now runs at import, so the polyfill wraps the DOM **before** your first tap
- the CDN import is pinned to \`ios-vibrator-pro-max@3.0.3\` with a fallback host
- a pre-existing \`navigator.vibrate\` stub is deleted on Safari — it was silently blocking the install gate

> On iOS 18.4+ only a real click grants vibration (~1s). Drags vibrate through the overlay-switch trick instead, so mid-scrub ticks keep working.

---

Next: run **Settings → Haptics Playground** on the device and read the \`engine:\` line — it now reports exactly which path is live.`;
const REPLIES = [REPLY_SERVERS, REPLY_COMPONENT, REPLY_REVIEW];

const SEED_THREADS = [
  {id:'t1', title:'can you get this running', age:'2d', settled:true, msgs:[
    {id:'t1u1', role:'user', md:'can you get the demo servers running? app-builder and agent-kanban both need to be up.'},
    {id:'t1a1', role:'assistant', md:REPLY_SERVERS, meta:'Worked for 1m 4s', trace:{
      steps:['Read package.json scripts in both apps', 'Started app-builder on :3000 (pid 5229)', 'Started agent-kanban on :3001 (pid 7099)', 'Health-checked both URLs — 200 OK'],
      code:'nohup npm run dev --prefix app-builder > app-builder.log 2>&1 &\nnohup npm run dev --prefix agent-kanban > agent-kanban.log 2>&1 &\ncurl -sf localhost:3000 && curl -sf localhost:3001'}}
  ]},
  {id:'t2', title:'wire the A–Z index haptics', age:'5d', settled:true, msgs:[
    {id:'t2u1', role:'user', md:'wire the A–Z index scrub to selection ticks'},
    {id:'t2a1', role:'assistant', md:REPLY_REVIEW, meta:'Worked for 42s', trace:{
      steps:['Traced IndexBar pointer handlers', 'Wired Haptics.selection() to letter changes', 'Debounced repeat ticks within one letter'],
      code:'if (letter !== last.current) {\n  last.current = letter\n  Haptics.selection()\n}'}}
  ]},
  {id:'t3', title:'credenza height morph jitter', age:'6d', settled:true, msgs:[
    {id:'t3u1', role:'user', md:'the credenza jumps between share states — can you smooth the height morph?'},
    {id:'t3a1', role:'assistant', md:REPLY_COMPONENT, meta:'Worked for 58s', trace:{
      steps:['Reproduced the jump between share states', 'Measured target height before commit', 'Springed height via transform, not layout'],
      search:[['developer.apple.com', 'sheet detent height animation'], ['github.com/emilkowalski', 'vaul height morph']],
      code:'const h = ref.current.offsetHeight\nsetSpring({height: h, config: {tension: 300, friction: 30}})'}}
  ]},
  {id:'t4', title:'refactor SplitView breakpoints', age:'12d', settled:true, msgs:[]},
  {id:'t5', title:'export vCard from share tray', age:'14d', settled:true, msgs:[]},
  {id:'t6', title:'dark mode contrast pass', age:'21d', settled:true, msgs:[]},
  {id:'t7', title:'reuse OAuth client between apps', age:'24d', settled:true, msgs:[]},
  {id:'t8', title:'start MCP inspector on boot', age:'25d', settled:true, msgs:[]},
  {id:'t9', title:'plan dynamic OAuth flows', age:'28d', settled:true, msgs:[]},
  {id:'t10', title:'ship v0.1 checklist', age:'30d', settled:true, msgs:[]}
];
const TERM_SEED = [
  {t:'npm run dev', p:true},
  {t:'> cookbook@0.1.0 dev'},
  {t:'> vite'},
  {t:''},
  {t:'  VITE v6.0.3  ready in 412 ms', c:'#7EE0B8'},
  {t:''},
  {t:'  ➜  Local:   http://localhost:3000/', c:'#8AB4FF'},
  {t:'  ➜  Network: http://192.168.1.24:3000/', c:'#8AB4FF'}
];

/* ══ WorkbenchShell — compositional IDE-scaffold container ══
   Owns width class + region state. Slots (children are ordinary elements — they read the shell with
   use(WorkbenchShell.Context) / useWorkbenchShell(), never a ctx argument):
   Sidebar (column ⇄ overlay sheet) · Main · Dock (inline, ⇄ DockSheet in a SnapSheet when compact) ·
   Panel (column ⇄ drawer ⇄ fullscreen) · TabBar (compact only).
   ctx: {wc, compact, side, setSide, sideSheet, setSideSheet, term, setTerm, termH, setTermH, panel, setPanel, tab, setTab, full, setFull} */
const use = React.use || React.useContext;   /* React 19 use(); useContext on 18 — same call shape for context */
const WBShellCtx = React.createContext(null);
const useWorkbenchShell = () => use(WBShellCtx);
function wbSlot(name) { const S = () => null; S.__wbSlot = name; return S; }
function WorkbenchShell(props) {
  const rootRef = useRef(null);
  const [wc, setWc] = useState('regular');
  const [side, setSide] = useState(true);
  const [sideSheet, setSideSheet] = useState(false);
  const [termOpen, setTermOpen] = useState(null);
  const [termH, setTermH] = useState(190);
  const [panelOpen, setPanelOpen] = useState(null);
  const [tab, setTab] = useState('chat');
  const [full, setFull] = useState(false);
  useEffect(()=>{ if (props.terminal != null) setTermOpen(props.terminal === true || props.terminal === 'true'); }, [props.terminal]);
  const roRef = useRef(null);
  const attachRoot = el => {
    rootRef.current = el;
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!el) return;
    const apply = w => { if (w > 0) setWc(w < 760 ? 'compact' : w < 1120 ? 'medium' : 'regular'); };
    apply(el.getBoundingClientRect().width);
    if (typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver(en => apply(en[0].contentRect.width));
      roRef.current.observe(el);
    }
  };
  useEffect(() => () => { if (roRef.current) roRef.current.disconnect(); }, []);
  const compact = wc === 'compact';
  const term = termOpen == null ? (props.terminal !== false && wc === 'regular') : termOpen;
  const panel = panelOpen == null ? wc === 'regular' : panelOpen;
  const ctx = {wc, compact, side, setSide, sideSheet, setSideSheet, term, setTerm:setTermOpen, termH, setTermH, panel, setPanel:setPanelOpen, tab, setTab, full, setFull};
  const slots = {};
  React.Children.forEach(props.children, c => { if (c && c.type && c.type.__wbSlot) slots[c.type.__wbSlot] = c.props.children; });
  const get = k => { const sl = slots[k]; return sl == null ? null : (typeof sl === 'function' ? sl(ctx) : sl); };
  const panelEl = get('panel');
  const vars = {
    '--wb-bg':'#141419', '--wb-side':'#101015', '--wb-card':'#1C1C23', '--wb-fill':'rgba(255,255,255,.06)',
    '--wb-fill2':'rgba(255,255,255,.11)', '--wb-sep':'rgba(255,255,255,.08)', '--wb-label':'#EDEDF2',
    '--wb-label2':'#9C9CA6', '--wb-label3':'#69696F', '--wb-tint':props.tint || '#0A84FF',
    '--wb-green':'#30D158', '--wb-red':'#FF453A', '--tk-tint':props.tint || '#0A84FF',
    '--mdc-code':'rgba(255,255,255,.09)', '--mdc-pre':'#0C0C10', '--mdc-border':'rgba(255,255,255,.1)', '--mdc-mut':'#9C9CA6'
  };
  return <WBShellCtx.Provider value={ctx}>
  <div ref={attachRoot} className="wb-dark" style={{...vars, position:'relative', width:'100%', height:'100%', overflow:'hidden',
      background:'var(--wb-bg)', color:'var(--wb-label)', fontFamily:WFONT, colorScheme:'dark', display:'flex', flexDirection:'column',
      WebkitFontSmoothing:'antialiased'}}>
    <div style={{flex:1, minHeight:0, display:'flex', position:'relative'}}>
      {!compact && side && slots.sidebar ? <div style={{width:242, flexShrink:0, borderRight:'1px solid var(--wb-sep)'}}>{get('sidebar')}</div> : null}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', background:'var(--wb-bg)'}}>
        {get('main')}
        {!compact && term && slots.dock ? get('dock') : null}
      </div>
      {wc === 'regular' && panel && !full && panelEl ? <div style={{width:'clamp(300px, 32%, 420px)', flexShrink:0, borderLeft:'1px solid var(--wb-sep)'}}>{panelEl}</div> : null}
      {compact && tab === 'surface' && panelEl ? <div style={{position:'absolute', inset:0, zIndex:60}}>{panelEl}</div> : null}
    </div>
    {compact ? get('tabbar') : null}
    {wc === 'medium' && !full && panelEl ? <React.Fragment>
      <div onClick={()=>setPanelOpen(false)} style={{position:'absolute', inset:0, zIndex:58, background:'rgba(0,0,0,.45)',
        opacity:panel ? 1 : 0, pointerEvents:panel ? 'auto' : 'none', transition:'opacity .32s ' + EASE}}/>
      <div style={{position:'absolute', top:0, bottom:0, right:0, width:'min(420px, 94%)', zIndex:59,
          transform:panel ? 'none' : 'translateX(103%)', transition:'transform .38s ' + EASE,
          borderLeft:'1px solid var(--wb-sep)', boxShadow:panel ? '0 0 44px rgba(0,0,0,.55)' : 'none'}}>{panelEl}</div>
    </React.Fragment> : null}
    {!compact && panel && full && panelEl ? <div style={{position:'absolute', inset:0, zIndex:60}}>{panelEl}</div> : null}
    {compact && slots.docksheet ? <SnapSheet open={term} onClose={()=>setTermOpen(false)} snaps={[0.52, 0.93]} bg="#0C0C10">{get('docksheet')}</SnapSheet> : null}
    {compact && slots.sidebar ? <React.Fragment>
      <div onClick={()=>setSideSheet(false)} style={{position:'absolute', inset:0, zIndex:80, background:'rgba(0,0,0,.45)',
        opacity:sideSheet ? 1 : 0, pointerEvents:sideSheet ? 'auto' : 'none', transition:'opacity .32s ' + EASE}}/>
      <div style={{position:'absolute', top:0, bottom:0, left:0, width:280, maxWidth:'84%', zIndex:81,
          transform:sideSheet ? 'none' : 'translateX(-102%)', transition:'transform .38s ' + EASE,
          boxShadow:sideSheet ? '0 0 44px rgba(0,0,0,.5)' : 'none'}}>{get('sidebar')}</div>
    </React.Fragment> : null}
  </div>
  </WBShellCtx.Provider>;
}
WorkbenchShell.Context = WBShellCtx;
WorkbenchShell.useShell = useWorkbenchShell;
WorkbenchShell.Sidebar = wbSlot('sidebar');
WorkbenchShell.Main = wbSlot('main');
WorkbenchShell.Dock = wbSlot('dock');
WorkbenchShell.DockSheet = wbSlot('docksheet');
WorkbenchShell.Panel = wbSlot('panel');
WorkbenchShell.TabBar = wbSlot('tabbar');

/* ══ Workbench root — composed on WorkbenchShell ══ */
function Workbench(props) {
  const [threads, setThreads] = useState(SEED_THREADS);
  const [cur, setCur] = useState('t1');
  const [surfKind, setSurfKind] = useState(props.surface && props.surface !== 'none' ? props.surface : null);
  const [streamId, setStreamId] = useState(null);
  const sTimer = useRef(null);
  const rIdx = useRef(0);
  useEffect(()=>{ if (props.surface != null) setSurfKind(props.surface === 'none' ? null : props.surface); }, [props.surface]);
  useEffect(()=>()=>clearInterval(sTimer.current), []);
  const thread = threads.find(t=>t.id === cur) || null;
  const upd = (tid, fn) => setThreads(ts=>ts.map(t=>t.id === tid ? fn(t) : t));
  const stop = () => { clearInterval(sTimer.current); if (streamId) {
    const [tid, mid] = streamId;
    upd(tid, t=>({...t, msgs:t.msgs.map(m=>m.id === mid ? {...m, live:false, meta:'Stopped'} : m)}));
    setStreamId(null); } };
  const send = (text, imgs) => {
    clearInterval(sTimer.current);
    let tid = cur;
    const uid = 'u' + Date.now(), aid = 'a' + Date.now();
    if (!tid) {
      tid = 'n' + Date.now();
      const base = text || 'Image';
      const title = base.length > 44 ? base.slice(0, 42) + '…' : base;
      setThreads(ts=>[{id:tid, title, age:'now', settled:false, msgs:[]}, ...ts]);
      setCur(tid);
    }
    upd(tid, t=>({...t, settled:false, msgs:[...t.msgs, {id:uid, role:'user', md:text, imgs:imgs && imgs.length ? imgs : undefined}, {id:aid, role:'assistant', md:'', live:true}]}));
    const reply = REPLIES[rIdx.current++ % REPLIES.length];
    const words = reply.split(' ');
    const t0 = Date.now();
    let i = 0;
    setStreamId([tid, aid]);
    sTimer.current = setInterval(()=>{
      i += 3 + Math.floor(Math.random() * 5);
      if (i >= words.length) {
        clearInterval(sTimer.current);
        const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
        upd(tid, t=>({...t, msgs:t.msgs.map(m=>m.id === aid ? {...m, md:reply, live:false, meta:'Worked for ' + secs + 's', trace:{
          steps:['Parsed the request', 'Scanned workbench.jsx for the relevant region', 'Drafted and streamed the reply'],
          code:'grep -n "' + (t.title || 'workbench').slice(0, 24) + '" workbench.jsx'}} : m)}));
        setStreamId(null); vib([10, 60, 14]);
      } else {
        const part = words.slice(0, i).join(' ');
        upd(tid, t=>({...t, msgs:t.msgs.map(m=>m.id === aid ? {...m, md:part} : m)}));
      }
    }, 90);
  };
  const streaming = !!streamId && !!thread && streamId[0] === thread.id;
  return <WorkbenchShell tint={props.tint} terminal={props.terminal}>
    <WorkbenchShell.Sidebar><WBSidebarSlot threads={threads} cur={cur} setCur={setCur}/></WorkbenchShell.Sidebar>
    <WorkbenchShell.Main><WBMainSlot thread={thread} streaming={streaming} onSend={send} onStop={stop} setCur={setCur}
      onUnsettle={()=>thread && upd(thread.id, t=>({...t, settled:false}))}/></WorkbenchShell.Main>
    <WorkbenchShell.Dock><WBDockSlot/></WorkbenchShell.Dock>
    <WorkbenchShell.DockSheet><WBDockSheetSlot/></WorkbenchShell.DockSheet>
    <WorkbenchShell.Panel><WBPanelSlot kind={surfKind} onOpen={setSurfKind}/></WorkbenchShell.Panel>
    <WorkbenchShell.TabBar><WBTabsSlot kind={surfKind} onOpen={setSurfKind}/></WorkbenchShell.TabBar>
  </WorkbenchShell>;
}

/* ── Slot children: ordinary components that read the shell with use(WorkbenchShell.Context) ── */
function WBHeader({thread, setCur}) {
  const {compact, side, setSide, setSideSheet, term, setTerm, panel, setPanel} = useWorkbenchShell();
  return <div style={{display:'flex', alignItems:'center', gap:4, padding:'0 10px', height:44, borderBottom:'1px solid var(--wb-sep)', flexShrink:0, boxSizing:'border-box'}}>
    {compact
      ? <IconBtn name="hamburger" label="Menu" onPress={()=>{ tick(); setSideSheet(true); }}/>
      : <IconBtn name="sidebar" label="Toggle sidebar" active={!side} onPress={()=>{ tick(); setSide(v=>!v); }}/>}
    <div style={{display:'flex', alignItems:'center', gap:6, minWidth:0, flex:1, marginLeft:4}}>
      <WIcon name="folder" size={14} sw={1.9} style={{color:'var(--wb-label3)'}}/>
      <span style={{fontSize:12.5, color:'var(--wb-label3)', flexShrink:0}}>cookbook</span>
      <span style={{fontSize:12.5, color:'var(--wb-label3)'}}>/</span>
      <span style={{fontSize:13, fontWeight:650, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{thread ? thread.title : 'new thread'}</span>
    </div>
    <IconBtn name="plus" label="New thread" onPress={()=>{ vib([8]); setCur(null); setSideSheet(false); }}/>
    <IconBtn name="panelB" label="Toggle terminal" active={term} onPress={()=>{ tick(); setTerm(!term); }}/>
    {!compact ? <IconBtn name="panelR" label="Toggle right panel" active={panel} onPress={()=>{ tick(); setPanel(!panel); }}/> : null}
  </div>;
}
function WBSidebarSlot({threads, cur, setCur}) {
  const {compact, setSideSheet} = useWorkbenchShell();
  return <WBSidebar threads={threads} cur={cur} compact={compact}
    onSelect={id=>{ setCur(id); setSideSheet(false); }}
    onNew={()=>{ vib([8]); setCur(null); setSideSheet(false); }}
    onClose={()=>setSideSheet(false)}/>;
}
function WBMainSlot({thread, streaming, onSend, onStop, onUnsettle, setCur}) {
  return <ChatView thread={thread} streaming={streaming} onSend={onSend} onStop={onStop}
    onUnsettle={onUnsettle} header={<WBHeader thread={thread} setCur={setCur}/>}/>;
}
function WBDockSlot() {
  const {termH, setTermH, setTerm} = useWorkbenchShell();
  return <TerminalDock h={termH} setH={setTermH} seed={TERM_SEED} onClose={()=>{ tick(); setTerm(false); }}/>;
}
function WBDockSheetSlot() {
  const {setTerm} = useWorkbenchShell();
  return <React.Fragment><TermHeader onClose={()=>setTerm(false)}/><TermBody seed={TERM_SEED}/></React.Fragment>;
}
function WBPanelSlot({kind, onOpen}) {
  const {compact, setTab, setPanel, full, setFull} = useWorkbenchShell();
  return <SurfacePanel kind={kind} compact={compact} onOpen={onOpen} full={full} onFull={setFull}
    onClose={()=>{ tick(); if (compact) setTab('chat'); else { setPanel(false); setFull(false); } }}/>;
}
function WBTabsSlot({kind, onOpen}) {
  const {tab, setTab} = useWorkbenchShell();
  return <SurfaceTabBar active={tab === 'chat' ? 'chat' : (kind || '')}
    onPick={k=>{ tick(); if (k === 'chat') setTab('chat'); else { onOpen(k); setTab('surface'); } }}/>;
}

const TouchKitWB = {Workbench, WorkbenchShell, useWorkbenchShell, WBSidebar, MessageScroller, MdView, FbMd, DocsLive, Composer, EmptyThread, TerminalDock, TermBody, SnapSheet, SurfacePanel, SurfaceTabBar, WIcon, dsLoad, dsPlayground};
window.TouchKitWB = TouchKitWB;
if (typeof module !== 'undefined') module.exports = {Workbench, WorkbenchShell, MdView, MessageScroller, SnapSheet, DocsLive, TouchKitWB};
