/* TouchKit PencilKit — a PencilKit-style drawing surface on perfect-freehand (steveruizok/perfect-freehand).
   Pointer samples [x, y, pressure] → getStroke outline polygon → one filled SVG path per stroke.
   Tools: pen / marker / pencil / stroke eraser · 6 inks · 4 widths · undo / redo / clear. */
const {useState, useEffect, useRef} = React;
const PFONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const PMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
let __pf = null, __pfP = null;
function pfLoad() {
  if (__pf) return Promise.resolve(__pf);
  if (!__pfP) __pfP = import('https://esm.sh/perfect-freehand@1.2.2')
    .catch(() => import('https://cdn.jsdelivr.net/npm/perfect-freehand@1.2.2/+esm'))
    .then(m => { __pf = m; window.dispatchEvent(new Event('tk-pf')); return m; })
    .catch(e => { window.__pfErr = String(e && e.message || e); window.dispatchEvent(new Event('tk-pf')); return null; });
  return __pfP;
}
const Hap = () => (window.TouchKit && window.TouchKit.Haptics) || {impact(){}, selection(){}, notification(){}};
const PK_TOOLS = {
  pen:    {opt: {size: 7,   thinning: .62, smoothing: .5,  streamline: .42}, alpha: 1},
  marker: {opt: {size: 20,  thinning: .06, smoothing: .55, streamline: .5},  alpha: .5},
  pencil: {opt: {size: 4.5, thinning: .72, smoothing: .42, streamline: .34, start: {taper: 22}, end: {taper: 22}}, alpha: .92}
};
const PK_INKS = ['#1C1C1E', '#F2F2F7', '#0A84FF', '#30D158', '#FFD60A', '#FF375F'];
const PK_W = [{m: .6, d: 3}, {m: 1, d: 5}, {m: 1.7, d: 8}, {m: 2.6, d: 11}];
const PKI = {
  pen: [{d:'M13.2 4.6l6.2 6.2L9 21.2H3.2V15z'}, {d:'M11 7l6 6'}],
  marker: [{d:'M14.6 3.6l5.8 5.8-8.6 8.6H6.4v-5.4z'}, {d:'M6.4 17.6L4 21.2'}, {d:'M3 21.2h17'}],
  pencil: [{d:'M4.5 19.5l1-4L16.8 4.2a2 2 0 0 1 2.8 2.8L8.5 18.3l-4 1.2z'}, {d:'M14.6 6.4l3 3'}],
  eraser: [{d:'M7.8 20.5h8.7'}, {d:'M4.6 15.1l8.3-8.3a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8l-7.4 7.4H8.4a2 2 0 0 1-1.4-.6z'}, {d:'M10.3 10.2l4.6 4.6'}],
  undo: [{d:'M7.5 9.2H14a5 5 0 0 1 0 10h-3.4'}, {d:'M10.8 5.8L7.4 9.2l3.4 3.4'}],
  redo: [{d:'M16.5 9.2H10a5 5 0 0 0 0 10h3.4'}, {d:'M13.2 5.8l3.4 3.4-3.4 3.4'}],
  trash: [{d:'M5 7h14M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M7 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7'}]
};
function PKIcon({name, size}) {
  return <svg width={size || 19} height={size || 19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}} aria-hidden="true">
    {(PKI[name] || []).map((e, i) => <path key={i} d={e.d}/>)}
  </svg>;
}
function outlinePath(pts) {
  if (!pts || pts.length < 3) return '';
  let d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2) + 'Q';
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    d += a[0].toFixed(2) + ' ' + a[1].toFixed(2) + ' ' + ((a[0] + b[0]) / 2).toFixed(2) + ' ' + ((a[1] + b[1]) / 2).toFixed(2) + ' ';
  }
  return d + 'Z';
}
function StrokePath({st, pf}) {
  const T = PK_TOOLS[st.tool];
  if (pf) {
    const pts = pf.getStroke(st.points, {...T.opt, size: T.opt.size * st.w, simulatePressure: !st.pen, last: !!st.done});
    return <path d={outlinePath(pts)} fill={st.color} fillOpacity={T.alpha}/>;
  }
  const d = st.points.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  return <path d={d} fill="none" stroke={st.color} strokeOpacity={T.alpha} strokeWidth={T.opt.size * st.w} strokeLinecap="round" strokeLinejoin="round"/>;
}
const MemoStroke = React.memo(StrokePath);
function PencilCanvas({dark}) {
  const [strokes, setStrokes] = useState([]);
  const [redo, setRedo] = useState([]);
  const [tool, setTool] = useState('pen');
  const [ink, setInk] = useState(dark ? 1 : 0);
  const [wi, setWi] = useState(1);
  const [, setV] = useState(0);
  const [pfReady, setPfReady] = useState(!!__pf);
  const live = useRef(null);
  const box = useRef(null);
  const erasing = useRef(false);
  useEffect(() => { pfLoad(); const h = () => setPfReady(true); window.addEventListener('tk-pf', h); return () => window.removeEventListener('tk-pf', h); }, []);
  useEffect(() => { if (erasing.current) Hap().selection(); }, [strokes.length]);
  const pos = e => { const r = box.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure > 0 ? e.pressure : 0.5]; };
  const eraseAt = e => {
    const p = pos(e), x = p[0], y = p[1];
    setStrokes(ss => ss.filter(st => {
      const rad = 12 + PK_TOOLS[st.tool].opt.size * st.w / 2;
      for (let i = 0; i < st.points.length; i += 2) {
        const dx = st.points[i][0] - x, dy = st.points[i][1] - y;
        if (dx * dx + dy * dy < rad * rad) return false;
      }
      return true;
    }));
  };
  const down = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'eraser') { erasing.current = true; eraseAt(e); return; }
    live.current = {tool, color: PK_INKS[ink], w: PK_W[wi].m, pen: e.pointerType === 'pen', points: [pos(e)], done: false};
    setV(v => v + 1);
  };
  const move = e => {
    if (tool === 'eraser') { if (erasing.current) eraseAt(e); return; }
    const s = live.current; if (!s) return;
    const evs = e.nativeEvent && e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e];
    for (const ev of evs) s.points.push(pos(ev));
    setV(v => v + 1);
  };
  const up = () => {
    if (tool === 'eraser') { erasing.current = false; return; }
    const s = live.current; live.current = null;
    if (s && s.points.length > 1) { s.done = true; setStrokes(ss => [...ss, s]); setRedo([]); }
    else setV(v => v + 1);
  };
  const undo = () => { if (!strokes.length) return; Hap().impact('light'); setRedo([...redo, strokes[strokes.length - 1]]); setStrokes(strokes.slice(0, -1)); };
  const redoFn = () => { if (!redo.length) return; Hap().impact('light'); setStrokes([...strokes, redo[redo.length - 1]]); setRedo(redo.slice(0, -1)); };
  const clear = () => { if (!strokes.length && !live.current) return; Hap().impact('medium'); setStrokes([]); setRedo([]); live.current = null; };
  const pf = pfReady ? __pf : null;
  const tbtn = (key, on, press, dis, label) =>
    <button key={key} onClick={press} disabled={dis} aria-label={label || key} title={label || key}
      style={{width:38, height:34, border:0, borderRadius:9, cursor:dis ? 'default' : 'pointer', display:'grid', placeItems:'center',
        background:on ? 'var(--tk-tint)' : 'transparent', color:on ? '#fff' : 'var(--tk-label2)', opacity:dis ? .32 : 1, padding:0}}>
      <PKIcon name={key}/></button>;
  return <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{position:'absolute', inset:0, touchAction:'none', cursor:'crosshair'}}>
    <svg width="100%" height="100%" style={{display:'block', position:'absolute', inset:0}}>
      {strokes.map((s, i) => <MemoStroke key={i} st={s} pf={pf}/>)}
      {live.current ? <StrokePath st={live.current} pf={pf}/> : null}
    </svg>
    {!strokes.length && !live.current ? <div style={{position:'absolute', inset:'0 0 90px', display:'grid', placeItems:'center', pointerEvents:'none'}}>
      <div style={{textAlign:'center', color:'var(--tk-label3)'}}>
        <div style={{fontSize:15.5, fontWeight:600}}>Draw anywhere</div>
        <div style={{fontSize:12.5, marginTop:3}}>Apple Pencil pressure is real — mouse and touch are simulated.</div>
      </div>
    </div> : null}
    <div style={{position:'absolute', top:10, right:12, fontFamily:PMONO, fontSize:10.5, color:'var(--tk-label3)', pointerEvents:'none'}}>
      {pf ? 'perfect-freehand@1.2.2' : window.__pfErr ? 'plain strokes — CDN failed' : 'loading perfect-freehand…'}</div>
    <div onPointerDown={e => e.stopPropagation()}
      style={{position:'absolute', left:'50%', bottom:14, transform:'translateX(-50%)', maxWidth:'calc(100% - 20px)', boxSizing:'border-box',
        display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', justifyContent:'center', background:'var(--tk-card)',
        border:'1px solid var(--tk-sep)', borderRadius:16, padding:'9px 12px', boxShadow:'0 10px 34px rgba(0,0,0,.24)', cursor:'default'}}>
      <div style={{display:'flex', gap:2}}>
        {['pen', 'marker', 'pencil', 'eraser'].map(t => tbtn(t, tool === t, () => { setTool(t); Hap().selection(); }, false, t))}
      </div>
      <span style={{width:1, alignSelf:'stretch', background:'var(--tk-sep)'}}/>
      <div style={{display:'flex', gap:7, alignItems:'center'}}>
        {PK_INKS.map((c, i) => <button key={c} onClick={() => { setInk(i); Hap().selection(); }} aria-label={'Ink ' + c} title={c}
          style={{width:21, height:21, borderRadius:'50%', cursor:'pointer', background:c, padding:0,
            border:'1px solid ' + (c === '#F2F2F7' ? 'rgba(0,0,0,.2)' : 'rgba(0,0,0,.08)'),
            outline:ink === i ? '2.5px solid var(--tk-tint)' : 'none', outlineOffset:2}}/>)}
      </div>
      <span style={{width:1, alignSelf:'stretch', background:'var(--tk-sep)'}}/>
      <div style={{display:'flex', gap:4, alignItems:'center'}}>
        {PK_W.map((w, i) => <button key={i} onClick={() => { setWi(i); Hap().selection(); }} aria-label={'Width ' + (i + 1)}
          style={{width:28, height:28, border:0, borderRadius:8, cursor:'pointer', display:'grid', placeItems:'center', padding:0,
            background:wi === i ? 'var(--tk-fill2)' : 'transparent'}}>
          <span style={{width:w.d, height:w.d, borderRadius:'50%', background:'var(--tk-label)', display:'block'}}/></button>)}
      </div>
      <span style={{width:1, alignSelf:'stretch', background:'var(--tk-sep)'}}/>
      <div style={{display:'flex', gap:2}}>
        {tbtn('undo', false, undo, !strokes.length, 'Undo')}
        {tbtn('redo', false, redoFn, !redo.length, 'Redo')}
        {tbtn('trash', false, clear, !strokes.length, 'Clear')}
      </div>
    </div>
  </div>;
}
const PK_LIGHT = {'--tk-bg':'#fff', '--tk-bg2':'#F4F4F7', '--tk-card':'#FFFFFF', '--tk-label':'#0B0B0F', '--tk-label2':'rgba(60,60,67,.6)', '--tk-label3':'rgba(60,60,67,.38)', '--tk-sep':'rgba(60,60,67,.2)', '--tk-fill':'rgba(120,120,128,.13)', '--tk-fill2':'rgba(120,120,128,.26)', '--tk-tint':'#0A84FF', '--tk-green':'#34C759', '--tk-red':'#FF3B30'};
const PK_DARK = {'--tk-bg':'#000', '--tk-bg2':'#101013', '--tk-card':'#1C1C1E', '--tk-label':'#F5F5F7', '--tk-label2':'rgba(235,235,245,.62)', '--tk-label3':'rgba(235,235,245,.34)', '--tk-sep':'rgba(84,84,88,.52)', '--tk-fill':'rgba(120,120,128,.22)', '--tk-fill2':'rgba(120,120,128,.36)', '--tk-tint':'#0A84FF', '--tk-green':'#30D158', '--tk-red':'#FF453A'};
function PencilKitDemo(props) {
  const dark = props.dark === true || props.dark === 'true';
  const vars = {...(dark ? PK_DARK : PK_LIGHT)};
  if (props.tint) vars['--tk-tint'] = props.tint;
  return <div style={{...vars, position:'relative', width:'100%', height:'100%', overflow:'hidden', background:'var(--tk-bg2)',
      color:'var(--tk-label)', fontFamily:PFONT, colorScheme:dark ? 'dark' : 'light', WebkitFontSmoothing:'antialiased',
      backgroundImage:'radial-gradient(' + (dark ? 'rgba(235,235,245,.13)' : 'rgba(60,60,67,.15)') + ' 1px, transparent 1.2px)', backgroundSize:'22px 22px'}}>
    <PencilCanvas dark={dark}/>
  </div>;
}
const TouchKitPencil = {PencilKitDemo, PencilCanvas, PKIcon};
window.TouchKitPencil = TouchKitPencil;
if (typeof module !== 'undefined') module.exports = {PencilKitDemo, PencilCanvas, TouchKitPencil};
