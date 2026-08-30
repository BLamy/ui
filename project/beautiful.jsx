/* Beautiful UI layer — AI-native interface primitives in TouchKit Workbench's dark language.
   Inspired by the beautifului.dev catalog (loading, thinking, approvals, agent tables…), reimplemented
   from scratch on TouchKit tokens. Registers window.BUI + docs demos in window.__buiLIVE. */
const {useState, useEffect, useRef, useMemo} = React;
const BFONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const BMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const BEASE = 'cubic-bezier(.32,.72,0,1)';
const C = {blue:'#0A84FF', green:'#32D74B', red:'#FF453A', orange:'#FF9F0A', purple:'#BF5AF2', teal:'#64D2FF'};
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch(e){} };
if (!document.getElementById('bui-css')) {
  const s = document.createElement('style'); s.id = 'bui-css';
  s.textContent = `@keyframes bui-spin{to{transform:rotate(360deg)}}
@keyframes bui-pulse{0%,100%{opacity:.25}50%{opacity:1}}
@keyframes bui-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@keyframes bui-sweep{from{background-position:-200% 0}to{background-position:200% 0}}
.bui-hl:hover{background:var(--wb-fill)!important}`;
  document.head.appendChild(s);
}
const card = extra => ({background:'var(--wb-card, #1C1C23)', border:'1px solid var(--wb-sep, rgba(255,255,255,.08))', borderRadius:14, fontFamily:BFONT, ...extra});
const mut = 'var(--wb-label2, rgba(235,235,245,.6))';
const mut3 = 'var(--wb-label3, rgba(235,235,245,.34))';
function BIcon({d, size, sw, style}) {
  return <svg width={size||16} height={size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw||1.9} strokeLinecap="round" strokeLinejoin="round" style={style}><path d={d}/></svg>;
}
const P = {
  check:'M5 12.5l4.5 4.5L19 7.5', x:'M6 6l12 12M18 6L6 18', spark:'M12 3l2.2 6.2L20 12l-5.8 2.8L12 21l-2.2-6.2L4 12l5.8-2.8z',
  search:'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.2-4.2', chev:'M9 6l6 6-6 6', chevD:'M6 9l6 6 6-6',
  doc:'M7 3h7l4 4v14H7zM14 3v4h4', code:'M8 7l-5 5 5 5M16 7l5 5-5 5', mic:'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4',
  at:'M12 16a4 4 0 110-8 4 4 0 014 4v1.2a2 2 0 004 0V12a8 8 0 10-3.2 6.4', send:'M12 19V5M6 11l6-6 6 6',
  plus:'M12 5v14M5 12h14', copy:'M9 9h10v12H9zM5 15V3h10', term:'M5 7l5 5-5 5M13 17h6', globe:'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.6-2.5 15.4 0 18c2.5-2.6 2.5-15.4 0-18',
  bolt:'M13 2L4 14h6l-1 8 9-12h-6z', home:'M4 11l8-7 8 7v9h-5v-6h-6v6H4z', inbox:'M4 13l3-8h10l3 8v6H4zM4 13h5l1.5 2h3L15 13h5',
  box:'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9', pen:'M14 4l6 6-10 10H4v-6zM12 6l6 6',
  bell:'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0', cal:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14', up:'M12 19V5M6 11l6-6 6 6', down:'M12 5v14M6 13l6 6 6-6',
  user:'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6', brain:'M12 4a4 4 0 00-4 4c-2 .5-3 2-3 4a4 4 0 004 4h6a4 4 0 004-4c0-2-1-3.5-3-4a4 4 0 00-4-4zM12 16v4'
};
function BChip({children, tone, onPress, active, style}) {
  return <button className="bui-hl" onClick={onPress} style={{display:'inline-flex', alignItems:'center', gap:6, border:'1px solid var(--wb-sep)',
    background:active ? 'var(--wb-fill2, rgba(255,255,255,.11))' : 'transparent', color:tone || 'var(--wb-label, #EDEDF2)', borderRadius:999,
    padding:'4px 11px', fontSize:12, fontWeight:600, cursor:onPress ? 'pointer' : 'default', fontFamily:BFONT}}>{children}</button>;
}
const DemoBtn = ({label, onPress, style}) => <button onClick={() => { vib([8]); onPress && onPress(); }}
  style={{border:0, borderRadius:10, background:C.blue, color:'#fff', fontFamily:BFONT, fontWeight:600, fontSize:13, padding:'8px 15px', cursor:'pointer', whiteSpace:'nowrap', ...style}}>{label}</button>;
function Meter({v, tone}) {
  return <div style={{width:64, height:4, borderRadius:2, background:'var(--wb-fill)', overflow:'hidden'}}>
    <div style={{width:(v*100)+'%', height:'100%', borderRadius:2, background:tone || C.blue, transition:'width .5s ' + BEASE}}/></div>;
}

/* 01 — LoadingState: pixel-grid loader + elapsed time; variants grid / dots / orbit */
function LoadingState({variant = 'grid', label = 'Churning'}) {
  const [t, setT] = useState(0);
  const [seed, setSeed] = useState(0);
  useEffect(() => { const i = setInterval(() => setT(x => x + 0.1), 100); return () => clearInterval(i); }, []);
  useEffect(() => { const i = setInterval(() => setSeed(x => x + 1), 320); return () => clearInterval(i); }, []);
  const cells = useMemo(() => {
    const r = []; let n = seed * 2654435761 % 4294967296;
    for (let i = 0; i < 25; i++) { n = (n * 1103515245 + 12345) % 2147483648; r.push(n / 2147483648); }
    return r;
  }, [seed]);
  let gfx;
  if (variant === 'dots') gfx = <div style={{display:'flex', gap:4}}>{[0,1,2].map(i =>
    <span key={i} style={{width:6, height:6, borderRadius:'50%', background:C.blue, animation:'bui-pulse 1.1s ' + (i*0.18) + 's infinite'}}/>)}</div>;
  else if (variant === 'orbit') gfx = <span style={{width:16, height:16, border:'2px solid var(--wb-fill2)', borderTopColor:C.blue, borderRadius:'50%', display:'inline-block', animation:'bui-spin .8s linear infinite'}}/>;
  else gfx = <div style={{display:'grid', gridTemplateColumns:'repeat(5, 3px)', gap:1.5}}>{cells.map((v, i) =>
    <span key={i} style={{width:3, height:3, background:C.blue, opacity:v > 0.55 ? 0.15 + v * 0.85 : 0.12, transition:'opacity .3s'}}/>)}</div>;
  return <div style={{display:'inline-flex', alignItems:'center', gap:10, ...card({padding:'9px 14px', borderRadius:999})}}>
    {gfx}
    <span style={{fontSize:13, fontWeight:600, background:'linear-gradient(90deg, var(--wb-label2) 30%, var(--wb-label) 50%, var(--wb-label2) 70%)',
      backgroundSize:'200% 100%', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent', animation:'bui-sweep 1.8s linear infinite'}}>{label}</span>
    <span style={{fontFamily:BMONO, fontSize:11.5, color:mut3}}>{t.toFixed(1)}s</span>
  </div>;
}

/* 02 — Thinking: compositional expandable trace — Thinking.Trigger / .Content / .Tabs / .Tab / .Panel / .Step / .Search / .Code */
const THINK = {
  steps: [['Parse the restock request', true], ['Pull supplier lead times', true], ['Score stockout risk per SKU', true], ['Draft the reorder plan', false]],
  reasoning: 'Waffle cones deplete fastest on weekends — 7-day lead time from cone_king means the order has to go out by Tuesday. Cross-checking against the Q4 velocity table before committing.',
  search: [['scoopdata.io', 'seasonal cone demand curves'], ['trends.google.com', 'waffle cone interest, 90d'], ['marketbasket.io', 'wholesale cone pricing']],
  coding: 'const risk = skus.map(s =>\n  s.velocity * lead(s.supplier) / s.stock)\nreturn risk.filter(r => r > 0.7)'
};
const ThinkCtx = React.createContext(null);
function Thinking({defaultOpen = true, defaultTab = null, children, style}) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState(defaultTab);
  const ensure = id => setTab(t => t == null ? id : t);
  return <ThinkCtx.Provider value={{open, setOpen, tab, setTab, ensure}}>
    <div style={card({overflow:'hidden', maxWidth:520, ...style})}>{children}</div>
  </ThinkCtx.Provider>;
}
Thinking.Trigger = function ThinkingTrigger({icon, children}) {
  const c = React.useContext(ThinkCtx);
  return <button className="bui-hl" onClick={() => { c.setOpen(o => !o); vib([6]); }} style={{display:'flex', alignItems:'center', gap:8, width:'100%', border:0,
    background:'none', color:'var(--wb-label)', padding:'10px 14px', cursor:'pointer', fontFamily:BFONT, textAlign:'left'}}>
    <span style={{color:C.purple, display:'grid'}}>{icon || <BIcon d={P.spark} size={15}/>}</span>
    <span style={{fontSize:13, fontWeight:650, flex:1}}>{children}</span>
    <span style={{color:mut3, display:'grid', transform:c.open ? 'rotate(180deg)' : 'none', transition:'transform .3s ' + BEASE}}><BIcon d={P.chevD} size={15}/></span>
  </button>;
};
Thinking.Content = function ThinkingContent({children}) {
  const c = React.useContext(ThinkCtx);
  return <div style={{display:'grid', gridTemplateRows:c.open ? '1fr' : '0fr', transition:'grid-template-rows .35s ' + BEASE}}>
    <div style={{overflow:'hidden'}}>{children}</div></div>;
};
Thinking.Tabs = function ThinkingTabs({children}) { return <div style={{display:'flex', gap:4, padding:'0 12px 8px', flexWrap:'wrap'}}>{children}</div>; };
Thinking.Tab = function ThinkingTab({id, children}) {
  const c = React.useContext(ThinkCtx);
  useEffect(() => { c.ensure(id); }, []);
  const on = c.tab === id;
  return <button className="bui-hl" onClick={() => { c.setTab(id); vib([4]); }} style={{border:0, borderRadius:7, padding:'4px 10px', fontSize:11.5, fontWeight:600, cursor:'pointer',
    fontFamily:BFONT, background:on ? 'var(--wb-fill2)' : 'none', color:on ? 'var(--wb-label)' : mut}}>{children}</button>;
};
Thinking.Panel = function ThinkingPanel({id, children}) {
  const c = React.useContext(ThinkCtx);
  if (c.tab !== id) return null;
  return <div style={{padding:'2px 14px 14px', fontSize:12.5, lineHeight:1.6, color:mut, animation:'bui-in .25s ' + BEASE}}>{children}</div>;
};
Thinking.Step = function ThinkingStep({done, children}) {
  return <div style={{display:'flex', gap:8, alignItems:'center', padding:'3px 0'}}>
    {done ? <span style={{color:C.green, display:'grid'}}><BIcon d={P.check} size={13} sw={2.4}/></span>
      : <span style={{width:13, height:13, border:'2px solid var(--wb-fill2)', borderTopColor:C.blue, borderRadius:'50%', animation:'bui-spin .8s linear infinite', flexShrink:0}}/>}
    <span style={{color:done ? mut : 'var(--wb-label)'}}>{children}</span></div>;
};
Thinking.Search = function ThinkingSearch({site, children}) {
  return <div style={{display:'flex', gap:8, alignItems:'center', padding:'3px 0'}}>
    <span style={{color:mut3, display:'grid'}}><BIcon d={P.globe} size={13}/></span>
    <span style={{fontFamily:BMONO, fontSize:11.5, color:C.teal}}>{site}</span><span>{children}</span></div>;
};
Thinking.Code = function ThinkingCode({children}) {
  return <pre style={{margin:0, fontFamily:BMONO, fontSize:11.5, background:'#101014', borderRadius:9, padding:'10px 12px', color:'#D8D8E2', overflow:'auto'}}>{children}</pre>;
};

/* 03 — StreamingText: streamed answer + inline sources + follow-ups */
const STREAM_TXT = 'Pistachio is your strongest seasonal climber — up 18% quarter over quarter, with the sharpest lift on weekend afternoons. Rocky Road keeps sliding and now sits below the 40-scoops-weekly retirement line.';
function StreamingText() {
  const [n, setN] = useState(0);
  const words = STREAM_TXT.split(' ');
  const [run, setRun] = useState(true);
  useEffect(() => {
    if (!run) return;
    if (n >= words.length) { setRun(false); return; }
    const t = setTimeout(() => setN(x => x + 1 + (Math.random() < 0.3 ? 1 : 0)), 70);
    return () => clearTimeout(t);
  }, [n, run]);
  const done = n >= words.length;
  return <div style={{maxWidth:520, fontFamily:BFONT}}>
    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
      <div style={{display:'flex'}}>{[C.blue, C.purple, C.teal].map((c, i) =>
        <span key={i} style={{width:18, height:18, borderRadius:'50%', background:c, border:'2px solid var(--wb-card)', marginLeft:i ? -6 : 0}}/>)}</div>
      <span style={{fontSize:12, color:mut, fontWeight:600}}>10 sources</span>
    </div>
    <p style={{fontSize:13.5, lineHeight:1.65, color:'var(--wb-label)', margin:'0 0 12px', minHeight:66}}>
      {words.slice(0, n).join(' ')}{!done && <span style={{display:'inline-block', width:7, height:14, background:C.blue, borderRadius:2, marginLeft:3, verticalAlign:'-2px', animation:'bui-pulse .9s infinite'}}/>}
    </p>
    {done && <div style={{animation:'bui-in .3s ' + BEASE}}>
      <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:12}}>
        {['scoopdata.io', 'trends.google.com', 'marketbasket.io'].map(s => <BChip key={s} tone={C.teal}><BIcon d={P.globe} size={12}/>{s}</BChip>)}
      </div>
      <div style={{fontSize:11, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:mut3, marginBottom:6}}>Follow-ups</div>
      <div style={{display:'grid', gap:6}}>
        {['Which flavors sell best in winter', 'Compare gelato and soft serve margins'].map(f =>
          <button key={f} className="bui-hl" onClick={() => vib([6])} style={{...card({padding:'8px 12px', borderRadius:10}), textAlign:'left', fontSize:12.5, color:'var(--wb-label)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
            {f}<span style={{color:mut3, display:'grid'}}><BIcon d={P.chev} size={13}/></span></button>)}
      </div>
      <button onClick={() => { setN(0); setRun(true); }} style={{border:0, background:'none', color:C.blue, fontSize:12, fontWeight:600, cursor:'pointer', padding:0, marginTop:12, fontFamily:BFONT}}>Replay stream</button>
    </div>}
  </div>;
}

/* 04 — ApprovalCard: human-in-the-loop question */
function ApprovalCard({question, options, onPick}) {
  const [picked, setPicked] = useState(null);
  return <div style={card({padding:16, maxWidth:420})}>
    <div style={{display:'flex', gap:8, alignItems:'flex-start', marginBottom:12}}>
      <span style={{color:C.orange, display:'grid', marginTop:1}}><BIcon d={P.spark} size={15}/></span>
      <div style={{fontSize:13.5, fontWeight:650, color:'var(--wb-label)', lineHeight:1.4}}>{question}</div>
    </div>
    {picked === null ? <div style={{display:'grid', gap:7}}>
      {options.map((o, i) => <button key={i} className="bui-hl" onClick={() => { setPicked(i); vib([10]); onPick && onPick(o); }}
        style={{...card({padding:'9px 13px', borderRadius:10}), textAlign:'left', fontSize:13, color:'var(--wb-label)', cursor:'pointer', display:'flex', alignItems:'center', gap:9}}>
        <span style={{width:15, height:15, borderRadius:'50%', border:'1.5px solid var(--wb-fill2)', flexShrink:0}}/>{o}</button>)}
    </div> : <div style={{display:'flex', alignItems:'center', gap:9, padding:'9px 13px', borderRadius:10, background:'rgba(50,215,75,.09)', border:'1px solid rgba(50,215,75,.25)', animation:'bui-in .25s ' + BEASE}}>
      <span style={{color:C.green, display:'grid'}}><BIcon d={P.check} size={15} sw={2.4}/></span>
      <span style={{fontSize:13, color:'var(--wb-label)', flex:1}}>{options[picked]}</span>
      <button onClick={() => setPicked(null)} style={{border:0, background:'none', color:mut3, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:BFONT}}>Change</button>
    </div>}
  </div>;
}

/* 05 — ToolChips: tool calls as compact expandable chips */
const TOOLS = [
  {icon:P.term, name:'read_pos_export', detail:'3 files · 2.1s', out:'Parsed 4,182 rows from summer POS exports.'},
  {icon:P.code, name:'edit churn.ts', detail:'+18 −4', out:'Added stockout-risk scoring to the churn model.'},
  {icon:P.globe, name:'fetch supplier_api', detail:'200 · 340ms', out:'cone_king lead time confirmed: 7 days.'},
  {icon:P.doc, name:'write reorder.md', detail:'draft', out:'Drafted the weekend reorder plan.'}
];
function ToolChips() {
  const [open, setOpen] = useState(null);
  return <div style={{maxWidth:520, fontFamily:BFONT}}>
    <div style={{fontSize:12, color:mut, marginBottom:8, fontWeight:600}}>4 tool calls, 2 messages</div>
    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
      {TOOLS.map((t, i) => <BChip key={i} active={open === i} onPress={() => { setOpen(open === i ? null : i); vib([5]); }}>
        <span style={{color:C.blue, display:'grid'}}><BIcon d={t.icon} size={12}/></span>
        <span style={{fontFamily:BMONO, fontSize:11.5}}>{t.name}</span>
        <span style={{color:mut3, fontSize:11}}>{t.detail}</span>
      </BChip>)}
    </div>
    {open !== null && <div key={open} style={{...card({padding:'10px 13px', borderRadius:10, marginTop:8}), fontSize:12.5, color:mut, animation:'bui-in .2s ' + BEASE}}>
      <span style={{color:C.green, marginRight:7, display:'inline-grid', verticalAlign:'-2px'}}><BIcon d={P.check} size={12} sw={2.4}/></span>{TOOLS[open].out}</div>}
  </div>;
}

/* 06 — TaskRows: live agent task status, capsule / list layouts */
const TASKS = [
  {n:1, title:'Verified vendor records', meta:'12 suppliers', state:'done', subs:[['Matched tax and contact IDs', '12/12', 'done'], ['Flagged stale records', '0', 'done']]},
  {n:2, title:'Build reorder task list', meta:'7 SKUs', state:'run', subs:[['Reading POS export', '3 files', 'done'], ['Scoring stockout risk', '68%', 'run']]},
  {n:3, title:'Draft supplier emails', meta:'2 messages', state:'wait', subs:[['Cone supplier follow-up', 'draft', 'wait'], ['Pistachio reorder note', 'draft', 'wait']]}
];
function StateDot({s}) {
  if (s === 'done') return <span style={{color:C.green, display:'grid'}}><BIcon d={P.check} size={13} sw={2.6}/></span>;
  if (s === 'run') return <span style={{width:11, height:11, border:'2px solid var(--wb-fill2)', borderTopColor:C.blue, borderRadius:'50%', animation:'bui-spin .8s linear infinite'}}/>;
  return <span style={{width:11, height:11, borderRadius:'50%', border:'1.5px solid var(--wb-fill2)'}}/>;
}
function TaskRows() {
  const [mode, setMode] = useState('capsules');
  return <div style={{maxWidth:520, fontFamily:BFONT}}>
    <div style={{display:'flex', gap:4, marginBottom:10}}>{[['capsules','Capsules'],['list','List']].map(([id, l]) =>
      <button key={id} className="bui-hl" onClick={() => { setMode(id); vib([4]); }} style={{border:0, borderRadius:7, padding:'4px 11px', fontSize:11.5, fontWeight:600, cursor:'pointer',
        fontFamily:BFONT, background:mode === id ? 'var(--wb-fill2)' : 'none', color:mode === id ? 'var(--wb-label)' : mut}}>{l}</button>)}</div>
    <div style={{display:'grid', gap:8}}>
      {TASKS.map(t => mode === 'capsules'
        ? <div key={t.n} style={card({padding:'11px 14px'})}>
            <div style={{display:'flex', alignItems:'center', gap:9}}>
              <StateDot s={t.state}/>
              <span style={{fontSize:13, fontWeight:650, color:'var(--wb-label)', flex:1}}>{t.title}</span>
              <span style={{fontSize:11.5, color:mut3}}>{t.meta}</span>
              {t.state === 'done' && <span style={{fontSize:11, fontWeight:700, color:C.green, background:'rgba(50,215,75,.12)', borderRadius:6, padding:'2px 7px'}}>Completed</span>}
            </div>
            <div style={{marginTop:8, display:'grid', gap:4, paddingLeft:22}}>
              {t.subs.map(([s, m, st], i) => <div key={i} style={{display:'flex', alignItems:'center', gap:8, fontSize:12, color:mut}}>
                <StateDot s={st}/><span style={{flex:1}}>{s}</span><span style={{fontFamily:BMONO, fontSize:11, color:mut3}}>{m}</span></div>)}
            </div>
          </div>
        : <div key={t.n} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 4px', borderBottom:'1px solid var(--wb-sep)'}}>
            <span style={{fontFamily:BMONO, fontSize:11, color:mut3, width:14}}>{t.n}</span>
            <StateDot s={t.state}/>
            <span style={{fontSize:13, color:'var(--wb-label)', flex:1}}>{t.title}</span>
            <span style={{fontSize:11.5, color:mut3}}>{t.meta}</span>
          </div>)}
    </div>
  </div>;
}

/* 09 — RecommendationCard: suggestion + confidence + accept */
function RecommendationCard() {
  const [alts, setAlts] = useState(false);
  const [state, setState] = useState('idle');
  return <div style={card({padding:16, maxWidth:440})}>
    <div style={{fontSize:13.5, fontWeight:650, color:'var(--wb-label)', marginBottom:6}}>Want me to place this restock order?</div>
    <div style={{fontSize:12.5, color:mut, lineHeight:1.6, marginBottom:12}}>Reorder waffle cones from <code style={{fontFamily:BMONO, fontSize:11.5, background:'var(--wb-fill)', borderRadius:5, padding:'1px 5px'}}>cone_king</code> with lead time <code style={{fontFamily:BMONO, fontSize:11.5, background:'var(--wb-fill)', borderRadius:5, padding:'1px 5px'}}>7_days</code>.</div>
    <button onClick={() => { setAlts(a => !a); vib([4]); }} style={{display:'flex', alignItems:'center', gap:6, border:0, background:'none', color:mut, fontSize:12, fontWeight:600, cursor:'pointer', padding:0, fontFamily:BFONT, marginBottom:alts ? 8 : 12}}>
      Other options<span style={{display:'grid', transform:alts ? 'rotate(180deg)' : 'none', transition:'transform .25s'}}><BIcon d={P.chevD} size={12}/></span></button>
    {alts && <div style={{display:'grid', gap:5, marginBottom:12, animation:'bui-in .2s ' + BEASE}}>
      {[['Switch to vanilla_madagascar', 'Needs review', C.orange], ['Full restock across every SKU', 'No signal', mut3]].map(([t, tag, tone], i) =>
        <div key={i} style={{display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:mut, padding:'6px 10px', borderRadius:9, background:'var(--wb-fill)'}}>
          <span style={{flex:1}}>{t}</span><span style={{fontSize:10.5, fontWeight:700, color:tone}}>{tag}</span></div>)}
    </div>}
    <div style={{display:'flex', alignItems:'center', gap:10}}>
      <Meter v={0.88} tone={C.green}/>
      <span style={{fontSize:11.5, fontWeight:600, color:C.green}}>High confidence</span>
      <button onClick={() => { setState(state === 'done' ? 'idle' : 'done'); vib([12]); }} style={{marginLeft:'auto', border:0, borderRadius:9, padding:'7px 16px', fontSize:12.5, fontWeight:650, cursor:'pointer', fontFamily:BFONT,
        background:state === 'done' ? 'rgba(50,215,75,.15)' : C.blue, color:state === 'done' ? C.green : '#fff', transition:'all .2s'}}>{state === 'done' ? '✓ Ordered' : 'Accept'}</button>
    </div>
  </div>;
}

/* 10 — ContextCards: retrieved knowledge chunks with sources */
function ContextCards() {
  const chunks = [
    {t:'Vendor onboarding rule', n:'290 characters', body:'Cold-chain certification must be verified before a new dairy can be added to the reorder workflow.', file:'Dairy Onboarding SOP.pdf', kind:'PDF', tone:C.red},
    {t:'Seasonal demand row', n:'1,250 characters', body:'Q4 velocity table: pistachio +18%, vanilla +6%, rocky road −11%; retire flavors below 40 scoops weekly.', file:'Sales Velocity Export.csv', kind:'CSV', tone:C.green}
  ];
  return <div style={{maxWidth:520, fontFamily:BFONT}}>
    <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:10}}>
      <span style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)'}}>All chunks</span>
      <span style={{fontFamily:BMONO, fontSize:11, color:mut3, background:'var(--wb-fill)', borderRadius:6, padding:'1px 6px'}}>32</span>
    </div>
    <div style={{display:'grid', gap:8}}>
      {chunks.map((c, i) => <div key={i} style={card({padding:'12px 14px'})}>
        <div style={{display:'flex', justifyContent:'space-between', gap:8, marginBottom:5}}>
          <span style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)'}}>{c.t}</span>
          <span style={{fontFamily:BMONO, fontSize:10.5, color:mut3}}>{c.n}</span>
        </div>
        <div style={{fontSize:12.5, color:mut, lineHeight:1.55, marginBottom:9}}>{c.body}</div>
        <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color:mut, border:'1px solid var(--wb-sep)', borderRadius:7, padding:'3px 8px'}}>
          <span style={{fontSize:9.5, fontWeight:800, color:c.tone}}>{c.kind}</span>{c.file}</span>
      </div>)}
    </div>
  </div>;
}

/* 11 — DiffTable: AI-proposed edits sweeping through rows */
const DIFF_ROWS = [
  ['Rocky Road', 'Classic', 'aurora-scoops', 'remove'],
  ['Bubblegum', 'Retro', 'kumo-creamery', 'remove'],
  ['Mint Chip', 'Classic', 'maple-orbit', 'keep'],
  ['Pistachio', 'Seasonal', 'maple-orbit', 'add']
];
function DiffTable() {
  const [sweep, setSweep] = useState(-1);
  const run = () => { vib([8]); let i = 0; setSweep(0);
    const t = setInterval(() => { i++; if (i > DIFF_ROWS.length) { clearInterval(t); } else setSweep(i); }, 380); };
  const cell = {padding:'8px 12px', fontSize:12.5, textAlign:'left'};
  return <div style={{maxWidth:520, fontFamily:BFONT}}>
    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
      <span style={{fontSize:13, fontWeight:650, color:'var(--wb-label)', flex:1}}>Proposed menu cleanup</span>
      <button onClick={run} style={{border:0, borderRadius:8, padding:'6px 13px', fontSize:12, fontWeight:650, background:C.blue, color:'#fff', cursor:'pointer', fontFamily:BFONT}}>Apply sweep</button>
    </div>
    <div style={card({overflow:'hidden'})}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr style={{borderBottom:'1px solid var(--wb-sep)'}}>{['Flavor', 'Category', 'Supplier', ''].map(h =>
          <th key={h} style={{...cell, fontSize:10.5, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:mut3}}>{h}</th>)}</tr></thead>
        <tbody>{DIFF_ROWS.map(([f, c, s, kind], i) => {
          const hit = sweep > i;
          const bg = !hit ? 'transparent' : kind === 'remove' ? 'rgba(255,69,58,.09)' : kind === 'add' ? 'rgba(50,215,75,.09)' : 'transparent';
          return <tr key={f} style={{borderBottom:i < 3 ? '1px solid var(--wb-sep)' : 'none', background:bg, transition:'background .3s'}}>
            <td style={{...cell, color:'var(--wb-label)', fontWeight:600, textDecoration:hit && kind === 'remove' ? 'line-through' : 'none', opacity:hit && kind === 'remove' ? 0.5 : 1}}>{f}</td>
            <td style={{...cell, color:mut}}>{c}</td>
            <td style={{...cell, color:mut, fontFamily:BMONO, fontSize:11.5}}>{s}</td>
            <td style={{...cell, width:60}}>{hit && kind !== 'keep' && <span style={{fontSize:10.5, fontWeight:800, color:kind === 'remove' ? C.red : C.green}}>{kind === 'remove' ? '− drop' : '+ add'}</span>}</td>
          </tr>; })}</tbody>
      </table>
    </div>
  </div>;
}

/* 12 — RecordsTable: CRM grid with tags + connection strength */
const RECORDS = [
  ['Aurora Scoops', 'Reykjavík', ['Gelato', 'Seasonal'], '9 days ago', 5],
  ['Kumo Creamery', 'Tokyo', ['B2C', 'Cafe', 'Vegan'], '3 weeks ago', 5],
  ['Coral Coast Sorbet', 'Honolulu', ['Sorbet', 'Local'], '9 days ago', 5],
  ['Ember Cone Company', 'Seoul', ['B2C', 'Vegan'], '15 days ago', 2],
  ['Maple Orbit', 'Montréal', ['B2B', 'Wholesale'], '15 days ago', 2],
  ['Blue Fig Gelato', 'Florence', ['Gelato', 'Cafe'], 'over 1 year ago', 1],
  ['Cacao Norte', 'Oaxaca', ['B2B', 'Local'], 'about 2 years ago', 0]
];
function Strength({v}) {
  return <span style={{display:'inline-flex', gap:2, alignItems:'flex-end'}}>{[0,1,2,3,4].map(i =>
    <span key={i} style={{width:3, height:4 + i * 2, borderRadius:1, background:i < v ? (v >= 4 ? C.green : v >= 2 ? C.orange : C.red) : 'var(--wb-fill2)'}}/>)}</span>;
}
function RecordsTable() {
  const cell = {padding:'8px 12px', fontSize:12.5, textAlign:'left', whiteSpace:'nowrap'};
  return <div style={{...card({overflow:'auto', maxWidth:560}), fontFamily:BFONT}} className="wb-scroll">
    <table style={{borderCollapse:'collapse', width:'100%', minWidth:480}}>
      <thead><tr style={{borderBottom:'1px solid var(--wb-sep)'}}>{['Company', 'Categories', 'Last interaction', 'Strength'].map(h =>
        <th key={h} style={{...cell, fontSize:10.5, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:mut3}}>{h}</th>)}</tr></thead>
      <tbody>{RECORDS.map(([name, city, tags, last, v], i) => <tr key={name} className="bui-hl" style={{borderBottom:i < RECORDS.length - 1 ? '1px solid var(--wb-sep)' : 'none', cursor:'default'}}>
        <td style={cell}><span style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{width:20, height:20, borderRadius:6, background:'var(--wb-fill2)', display:'grid', placeItems:'center', fontSize:10.5, fontWeight:700, color:mut}}>{name[0]}</span>
          <span><span style={{color:'var(--wb-label)', fontWeight:600}}>{name}</span><span style={{color:mut3}}> — {city}</span></span></span></td>
        <td style={cell}><span style={{display:'inline-flex', gap:4}}>{tags.map(t =>
          <span key={t} style={{fontSize:10.5, fontWeight:600, color:mut, background:'var(--wb-fill)', borderRadius:5, padding:'1.5px 6px'}}>{t}</span>)}</span></td>
        <td style={{...cell, color:mut}}>{last}</td>
        <td style={cell}><Strength v={v}/></td>
      </tr>)}</tbody>
    </table>
    <div style={{padding:'7px 12px', fontSize:11, color:mut3, borderTop:'1px solid var(--wb-sep)', fontFamily:BMONO}}>26 records · 44% avg strength · 19 links</div>
  </div>;
}

/* 13 — FilterTable: status chips reorganizing live data */
const FILTER_ROWS = [
  ['Restock mango sorbet', 'Dec 03', 'To do', 'Mango Moon Gelato'],
  ['Churn black sesame', 'Sep 22', 'In Progress', 'Kumo Creamery'],
  ['Print summer menu', 'Jan 02', 'To do', 'Coral Coast Sorbet'],
  ['Taste-test batch 42', 'Nov 08', 'In Progress', 'Maple Orbit'],
  ['Order waffle cones', 'Apr 14', 'Completed', 'Aurora Scoops']
];
const ST_TONE = {'To do':mut, 'In Progress':C.orange, 'Completed':C.green};
function FilterTable() {
  const [f, setF] = useState('All');
  const opts = ['All', 'To do', 'In Progress', 'Completed'];
  const rows = FILTER_ROWS.filter(r => f === 'All' || r[2] === f);
  const cell = {padding:'8px 12px', fontSize:12.5, textAlign:'left'};
  return <div style={{maxWidth:540, fontFamily:BFONT}}>
    <div style={{display:'flex', gap:6, marginBottom:10, flexWrap:'wrap'}}>{opts.map(o => {
      const n = o === 'All' ? FILTER_ROWS.length : FILTER_ROWS.filter(r => r[2] === o).length;
      return <BChip key={o} active={f === o} onPress={() => { setF(o); vib([5]); }}>{o}<span style={{fontFamily:BMONO, fontSize:10.5, color:mut3}}>{n}</span></BChip>; })}</div>
    <div style={card({overflow:'hidden'})}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr style={{borderBottom:'1px solid var(--wb-sep)'}}>{['Task name', 'Date', 'Status', 'Advisor'].map(h =>
          <th key={h} style={{...cell, fontSize:10.5, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:mut3}}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(([t, d, s, a], i) => <tr key={t} style={{borderBottom:i < rows.length - 1 ? '1px solid var(--wb-sep)' : 'none', animation:'bui-in .25s ' + BEASE}}>
          <td style={{...cell, color:'var(--wb-label)', fontWeight:600}}>{t}</td>
          <td style={{...cell, color:mut, fontFamily:BMONO, fontSize:11.5}}>{d}</td>
          <td style={cell}><span style={{fontSize:11, fontWeight:700, color:ST_TONE[s]}}>{s}</span></td>
          <td style={{...cell, color:mut}}>{a}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <div style={{padding:20, fontSize:12.5, color:mut3, textAlign:'center'}}>Nothing here.</div>}
    </div>
  </div>;
}

/* 14 — Sidebar system: one compositional API over every sidebar variant.
   <SidebarProvider> owns open state + container-width detection; <Sidebar variant="docked|rail|float|overlay">
   renders the same children in any behavior, and ANY variant becomes a hamburger overlay below the breakpoint. */
const SBCtx = React.createContext(null);
const SBCollapsedCtx = React.createContext(false);
function SidebarProvider({defaultOpen = true, breakpoint = 560, children, style}) {
  const ref = useRef(null);
  const [open, setOpen] = useState(defaultOpen);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => setNarrow(el.offsetWidth < breakpoint));
    ro.observe(el); return () => ro.disconnect();
  }, [breakpoint]);
  useEffect(() => { setOpen(narrow ? false : defaultOpen); }, [narrow]);
  const toggle = () => { setOpen(o => !o); vib([6]); };
  return <SBCtx.Provider value={{open, setOpen, toggle, narrow}}>
    <div ref={ref} style={{display:'flex', height:'100%', position:'relative', overflow:'hidden', fontFamily:BFONT, background:'var(--wb-bg, #141419)', ...style}}>{children}</div>
  </SBCtx.Provider>;
}
function Sidebar({variant = 'docked', width = 228, railWidth = 52, children}) {
  const c = React.useContext(SBCtx);
  const overlay = variant === 'overlay' || c.narrow;
  const collapsed = !overlay && variant === 'rail' && !c.open;
  const body = <SBCollapsedCtx.Provider value={collapsed}>
    <div style={{display:'flex', flexDirection:'column', height:'100%', overflow:'hidden'}}>{children}</div>
  </SBCollapsedCtx.Provider>;
  if (overlay) return <React.Fragment>
    <div onClick={() => c.setOpen(false)} style={{position:'absolute', inset:0, zIndex:20, background:'rgba(0,0,0,.45)', opacity:c.open ? 1 : 0, pointerEvents:c.open ? 'auto' : 'none', transition:'opacity .3s'}}/>
    <div style={{position:'absolute', top:0, bottom:0, left:0, width, zIndex:21, background:'var(--wb-side, #101015)', borderRight:'1px solid var(--wb-sep)',
      transform:c.open ? 'none' : 'translateX(-102%)', transition:'transform .38s ' + BEASE, boxShadow:c.open ? '0 0 44px rgba(0,0,0,.4)' : 'none'}}>{body}</div>
  </React.Fragment>;
  const w = collapsed ? railWidth : c.open ? width : 0;
  const float = variant === 'float';
  return <div style={{width:w, flexShrink:0, overflow:'hidden', transition:'width .32s ' + BEASE, boxSizing:'border-box',
    background:float ? 'transparent' : 'var(--wb-side, #101015)', borderRight:float ? 'none' : '1px solid var(--wb-sep)', padding:float ? 10 : 0}}>
    <div style={{width:(collapsed ? railWidth : width) - (float ? 20 : 0), height:'100%', boxSizing:'border-box',
      ...(float ? card({background:'var(--wb-side, #101015)', borderRadius:14, overflow:'hidden'}) : {})}}>{body}</div>
  </div>;
}
Sidebar.Header = function SBHeader({children}) { return <div style={{padding:'12px 10px 6px', flexShrink:0}}>{children}</div>; };
Sidebar.Content = function SBContent({children}) { return <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', overflowX:'hidden', padding:'0 8px'}}>{children}</div>; };
Sidebar.Footer = function SBFooter({children}) { return <div style={{padding:8, borderTop:'1px solid var(--wb-sep)', flexShrink:0}}>{children}</div>; };
Sidebar.Workspace = function SBWorkspace({name, detail, initial}) {
  const collapsed = React.useContext(SBCollapsedCtx);
  return <div style={{display:'flex', alignItems:'center', gap:8, padding:'0 2px 4px', justifyContent:collapsed ? 'center' : 'flex-start'}}>
    <span style={{width:26, height:26, borderRadius:8, background:'linear-gradient(135deg, #0A84FF, #5E5CE6)', display:'grid', placeItems:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0}}>{initial || (name || 'W')[0]}</span>
    {!collapsed && <div style={{lineHeight:1.15, minWidth:0}}><div style={{fontSize:12.5, fontWeight:700, color:'var(--wb-label)', whiteSpace:'nowrap'}}>{name}</div>
      {detail && <div style={{fontSize:10.5, color:mut3, whiteSpace:'nowrap'}}>{detail}</div>}</div>}
  </div>;
};
Sidebar.Search = function SBSearch({placeholder = 'Quick search', onPress}) {
  const collapsed = React.useContext(SBCollapsedCtx);
  if (collapsed) return <button className="bui-hl" title={placeholder} onClick={onPress} style={{display:'grid', placeItems:'center', width:'100%', border:0, borderRadius:8, padding:'8px 0', background:'none', color:mut3, cursor:'pointer'}}><BIcon d={P.search} size={14}/></button>;
  return <button className="bui-hl" onClick={onPress} style={{display:'flex', alignItems:'center', gap:7, width:'100%', border:0, background:'var(--wb-fill)', borderRadius:8, padding:'6px 9px', margin:'2px 0 4px', cursor:'pointer', fontFamily:BFONT}}>
    <span style={{color:mut3, display:'grid'}}><BIcon d={P.search} size={13}/></span>
    <span style={{fontSize:12, color:mut3, flex:1, textAlign:'left'}}>{placeholder}</span>
    <span style={{fontFamily:BMONO, fontSize:10, color:mut3, border:'1px solid var(--wb-sep)', borderRadius:4, padding:'0 4px'}}>/</span>
  </button>;
};
Sidebar.Section = function SBSection({title, children}) {
  const collapsed = React.useContext(SBCollapsedCtx);
  return <div>
    {title ? (collapsed ? <div style={{height:1, background:'var(--wb-sep)', margin:'8px 6px'}}/>
      : <div style={{fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:mut3, padding:'10px 9px 4px', whiteSpace:'nowrap'}}>{title}</div>) : null}
    {children}</div>;
};
Sidebar.Item = function SBItem({icon, label, badge, active, tone, onPress}) {
  const collapsed = React.useContext(SBCollapsedCtx);
  const ic = typeof icon === 'string' ? <BIcon d={P[icon] || P.box} size={15} sw={1.8}/> : icon;
  return <button className="bui-hl" title={label} onClick={() => { vib([5]); onPress && onPress(); }}
    style={{display:'flex', alignItems:'center', justifyContent:collapsed ? 'center' : 'flex-start', gap:9, width:'100%', border:0, borderRadius:8,
      padding:collapsed ? '8px 0' : '6px 9px', cursor:'pointer', fontFamily:BFONT, textAlign:'left', margin:'1px 0',
      background:active ? 'var(--wb-fill2)' : 'none', color:tone || (active ? 'var(--wb-label)' : mut), fontSize:13, fontWeight:tone ? 600 : 400}}>
    <span style={{display:'grid', flexShrink:0}}>{ic}</span>
    {!collapsed && <span style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{label}</span>}
    {!collapsed && badge != null && <span style={{fontFamily:BMONO, fontSize:10.5, color:C.blue, background:'rgba(10,132,255,.13)', borderRadius:6, padding:'1px 6px'}}>{badge}</span>}
  </button>;
};
function SidebarTrigger({style}) {
  const c = React.useContext(SBCtx);
  return <button className="bui-hl" onClick={c.toggle} aria-label="Toggle sidebar" style={{border:0, background:'none', color:mut, cursor:'pointer', padding:6, borderRadius:8, display:'grid', placeItems:'center', ...style}}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg></button>;
}
function SidebarInset({children, style}) {
  return <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', ...style}}>{children}</div>;
}
/* SidebarNav — the pre-composed example, now built from the primitives */
function SidebarNav({variant = 'docked'}) {
  const [cur, setCur] = useState('Home');
  const it = (icon, label, badge) => <Sidebar.Item key={label} icon={icon} label={label} badge={badge} active={cur === label} onPress={() => setCur(label)}/>;
  return <Sidebar variant={variant}>
    <Sidebar.Header><Sidebar.Workspace name="Creamery Ops" detail="Production Workspace"/></Sidebar.Header>
    <Sidebar.Content>
      <Sidebar.Search/>
      <Sidebar.Item icon="plus" label="New task" tone={C.blue}/>
      <Sidebar.Section title="Workspace">{[it('home', 'Home'), it('bolt', 'Agent tasks', 4), it('inbox', 'Inbox')]}</Sidebar.Section>
      <Sidebar.Section title="Objects">{[it('box', 'Suppliers'), it('box', 'Inventory')]}</Sidebar.Section>
    </Sidebar.Content>
  </Sidebar>;
}

/* 15 — SearchPalette: command search with live filtering + empty state */
function SearchPalette() {
  const [q, setQ] = useState('');
  const cmds = ['Forecast summer demand', 'Find waffle cone suppliers', 'Compare seasonal flavors', 'Draft flavor launch plan', 'Check cold-chain status'];
  const hits = cmds.filter(c => c.toLowerCase().includes(q.toLowerCase()));
  return <div style={{...card({maxWidth:420, overflow:'hidden'})}}>
    <div style={{display:'flex', alignItems:'center', gap:9, padding:'11px 14px', borderBottom:'1px solid var(--wb-sep)'}}>
      <span style={{color:mut3, display:'grid'}}><BIcon d={P.search} size={15}/></span>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search commands…" autoFocus={false}
        style={{border:0, background:'none', outline:'none', color:'var(--wb-label)', fontSize:13.5, fontFamily:BFONT, flex:1}}/>
      {q && <button onClick={() => setQ('')} aria-label="Clear" style={{border:0, background:'none', color:mut3, cursor:'pointer', padding:2, display:'grid'}}><BIcon d={P.x} size={13}/></button>}
    </div>
    <div style={{padding:6, minHeight:120}}>
      {hits.map(c => <button key={c} className="bui-hl" onClick={() => vib([6])} style={{display:'flex', alignItems:'center', gap:9, width:'100%', border:0, borderRadius:8, background:'none',
        color:'var(--wb-label)', fontSize:13, padding:'8px 10px', cursor:'pointer', fontFamily:BFONT, textAlign:'left', animation:'bui-in .18s ' + BEASE}}>
        <span style={{color:C.blue, display:'grid'}}><BIcon d={P.bolt} size={13}/></span>{c}</button>)}
      {!hits.length && <div style={{padding:'26px 0', textAlign:'center', fontSize:12.5, color:mut3}}>No commands match “{q}”.<br/>
        <button onClick={() => vib([6])} style={{border:0, background:'none', color:C.blue, fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:BFONT, marginTop:6}}>Ask the agent instead →</button></div>}
    </div>
  </div>;
}

/* 16 — InsightCards: paged agent insights with live charts */
const INSIGHTS = [
  {t:<span>The worst performer in your <b style={{color:C.blue}}>@Creamery</b> is Rocky Road — down <code style={{fontFamily:BMONO, fontSize:'.9em', color:'#FF6961'}}>−6%</code> or <code style={{fontFamily:BMONO, fontSize:'.9em', color:'#FF6961'}}>−$2,453</code>.</span>,
   pts:[42, 40, 44, 38, 35, 31, 30, 26, 24], tone:C.red},
  {t:<span>Mint Chip is soft too: <code style={{fontFamily:BMONO, fontSize:'.9em', color:'#FF6961'}}>−4.4%</code>, <code style={{fontFamily:BMONO, fontSize:'.9em', color:'#FF6961'}}>−$2,378</code> over the same window.</span>,
   pts:[30, 32, 29, 31, 28, 29, 27, 26, 27], tone:C.orange},
  {t:<span>Pistachio is the bright spot — <code style={{fontFamily:BMONO, fontSize:'.9em', color:'#6BE28B'}}>+1.15%</code>, <code style={{fontFamily:BMONO, fontSize:'.9em', color:'#6BE28B'}}>+$617</code> and climbing on weekends.</span>,
   pts:[18, 20, 19, 23, 22, 26, 25, 29, 31], tone:C.green}
];
function Spark({pts, tone}) {
  const max = Math.max(...pts), min = Math.min(...pts);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + (i * (200 / (pts.length - 1))).toFixed(1) + ' ' + (44 - (p - min) / (max - min) * 38).toFixed(1)).join(' ');
  return <svg width="100%" height="52" viewBox="0 0 200 52" preserveAspectRatio="none" style={{display:'block'}}>
    <path d={d + ' L200 52 L0 52 Z'} fill={tone} opacity="0.1"/>
    <path d={d} fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round"/></svg>;
}
function InsightCards() {
  const [i, setI] = useState(0);
  const ins = INSIGHTS[i];
  return <div style={{...card({maxWidth:420, padding:16}), fontFamily:BFONT}}>
    <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:10}}>
      <span style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)'}}>Insights</span>
      <span style={{fontFamily:BMONO, fontSize:11, color:mut3, background:'var(--wb-fill)', borderRadius:6, padding:'1px 6px'}}>3</span>
      <div style={{marginLeft:'auto', display:'flex', gap:5}}>{INSIGHTS.map((_, j) =>
        <button key={j} onClick={() => { setI(j); vib([4]); }} aria-label={'Insight ' + (j+1)} style={{width:7, height:7, borderRadius:'50%', border:0, padding:0, cursor:'pointer', background:j === i ? C.blue : 'var(--wb-fill2)'}}/>)}</div>
    </div>
    <div key={i} style={{animation:'bui-in .25s ' + BEASE}}>
      <div style={{fontSize:13, lineHeight:1.55, color:'var(--wb-label)', marginBottom:12, minHeight:40}}>{ins.t}</div>
      <Spark pts={ins.pts} tone={ins.tone}/>
    </div>
    <button className="bui-hl" onClick={() => vib([6])} style={{...card({padding:'8px 12px', borderRadius:10, marginTop:12}), width:'100%', textAlign:'left', fontSize:12.5, color:'var(--wb-label)', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
      Should I rebalance flavors?<span style={{color:mut3, display:'grid'}}><BIcon d={P.chev} size={13}/></span></button>
  </div>;
}

/* 17 — CodeBlockStream: agent-written code streaming line by line */
const CODE_SRC = `export function churnRisk(skus: Sku[]) {
  return skus
    .map(s => ({
      ...s,
      risk: s.velocity * leadDays(s.supplier) / s.stock,
    }))
    .filter(s => s.risk > 0.7)
    .sort((a, b) => b.risk - a.risk)
}`;
function CodeBlockStream() {
  const lines = CODE_SRC.split('\n');
  const [n, setN] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (n >= lines.length) return;
    const t = setTimeout(() => setN(x => x + 1), 260);
    return () => clearTimeout(t);
  }, [n]);
  const MdView = window.TouchKitWB && window.TouchKitWB.MdView;
  const shown = lines.slice(0, n).join('\n');
  return <div style={{...card({maxWidth:520, overflow:'hidden'}), '--mdc-pre':'#101014'}}>
    <div style={{display:'flex', alignItems:'center', gap:9, padding:'9px 13px', borderBottom:'1px solid var(--wb-sep)'}}>
      <span style={{color:C.blue, display:'grid'}}><BIcon d={P.code} size={14}/></span>
      <span style={{fontFamily:BMONO, fontSize:12, color:'var(--wb-label)'}}>churn.ts</span>
      <span style={{fontSize:10.5, fontWeight:700, color:mut3, letterSpacing:'.4px'}}>TYPESCRIPT</span>
      <div style={{marginLeft:'auto', display:'flex', gap:10, alignItems:'center'}}>
        {n < lines.length && <span style={{fontFamily:BMONO, fontSize:10.5, color:C.blue}}>streaming…</span>}
        <button onClick={() => { setCopied(true); vib([6]); setTimeout(() => setCopied(false), 1200); try { navigator.clipboard.writeText(CODE_SRC); } catch(e){} }}
          style={{display:'flex', alignItems:'center', gap:5, border:0, background:'none', color:copied ? C.green : mut, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:BFONT, padding:0}}>
          <BIcon d={copied ? P.check : P.copy} size={12}/>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
    <div style={{padding:'2px 13px'}}>
      {MdView ? <MdView markdown={'```ts\n' + shown + '\n```'}/> :
        <pre style={{fontFamily:BMONO, fontSize:12, color:'#D8D8E2', lineHeight:1.55}}>{shown}</pre>}
    </div>
    {n >= lines.length && <div style={{padding:'0 13px 10px'}}>
      <button onClick={() => setN(0)} style={{border:0, background:'none', color:C.blue, fontSize:11.5, fontWeight:600, cursor:'pointer', fontFamily:BFONT, padding:0}}>Replay</button></div>}
  </div>;
}

/* 18 — FineTuneCard: agent-adjustable design inspector */
function FineTuneCard() {
  const [v, setV] = useState({w:220, h:120, r:16, o:100});
  const slider = (key, label, min, max, unit) => <label style={{display:'grid', gridTemplateColumns:'52px 1fr 44px', gap:9, alignItems:'center', fontSize:11.5, color:mut}}>
    <span style={{fontWeight:650}}>{label}</span>
    <input type="range" min={min} max={max} value={v[key]} onChange={e => setV({...v, [key]:+e.target.value})} style={{accentColor:C.blue, height:16}}/>
    <span style={{fontFamily:BMONO, fontSize:10.5, textAlign:'right', color:mut3}}>{v[key]}{unit}</span></label>;
  return <div style={{display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-start', fontFamily:BFONT}}>
    <div style={{...card({width:250, padding:14})}}>
      <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:12}}>
        <span style={{color:C.purple, display:'grid'}}><BIcon d={P.pen} size={13}/></span>
        <span style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)', flex:1}}>Flavor card</span>
        <span style={{fontSize:10.5, fontWeight:700, color:C.blue, background:'rgba(10,132,255,.12)', borderRadius:6, padding:'2px 8px'}}>Adjust</span>
      </div>
      <div style={{fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:mut3, marginBottom:8}}>Layout</div>
      <div style={{display:'grid', gap:9}}>
        {slider('w', 'W', 140, 300, '')}
        {slider('h', 'H', 80, 180, '')}
        {slider('r', 'Radius', 0, 40, '')}
        {slider('o', 'Opacity', 20, 100, '%')}
      </div>
    </div>
    <div style={{width:300, height:190, display:'grid', placeItems:'center', background:'var(--wb-fill)', borderRadius:14}}>
      <div style={{width:v.w, height:v.h, borderRadius:v.r, opacity:v.o / 100, background:'linear-gradient(135deg, #0A84FF, #5E5CE6)',
        display:'grid', placeItems:'center', color:'#fff', fontSize:13, fontWeight:700, transition:'border-radius .2s', boxShadow:'0 14px 30px -12px rgba(10,132,255,.5)'}}>Pistachio</div>
    </div>
  </div>;
}

/* 19 — SelectionActions: highlight text, hand it to the agent */
function SelectionActions() {
  const boxRef = useRef(null);
  const [bar, setBar] = useState(null);
  const [note, setNote] = useState(null);
  const onUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !boxRef.current || !boxRef.current.contains(sel.anchorNode)) { setBar(null); return; }
    const r = sel.getRangeAt(0).getBoundingClientRect(), b = boxRef.current.getBoundingClientRect();
    setBar({x:Math.max(10, Math.min(r.left - b.left + r.width / 2, b.width - 150)), y:r.top - b.top, text:sel.toString()});
    vib([5]);
  };
  const act = a => { setNote(a + ' → “' + bar.text.slice(0, 42) + (bar.text.length > 42 ? '…' : '') + '”'); setBar(null); vib([8]); try { window.getSelection().removeAllRanges(); } catch(e){} };
  return <div style={{maxWidth:480, fontFamily:BFONT}}>
    <div ref={boxRef} onMouseUp={onUp} onTouchEnd={onUp} style={{...card({padding:'14px 16px'}), position:'relative', fontSize:13.5, lineHeight:1.7, color:'var(--wb-label)', userSelect:'text', cursor:'text'}}>
      Pistachio holds the top slot all weekend. Churn it first thing Saturday so the batch has time to firm up before the afternoon rush.
      {bar && <div style={{position:'absolute', left:bar.x, top:bar.y - 40, transform:'translateX(-50%)', display:'flex', gap:2, background:'#0C0C10', border:'1px solid var(--wb-sep)',
        borderRadius:10, padding:3, boxShadow:'0 10px 28px rgba(0,0,0,.5)', zIndex:6, animation:'bui-in .15s ' + BEASE}}>
        {['Explain', 'Improve', 'Shorten', 'Tone'].map(a => <button key={a} onClick={() => act(a)}
          style={{border:0, background:'none', color:'#EDEDF2', fontSize:11.5, fontWeight:600, padding:'5px 9px', borderRadius:7, cursor:'pointer', fontFamily:BFONT}}
          onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,.09)'} onMouseLeave={e => e.target.style.background = 'none'}>{a}</button>)}
      </div>}
    </div>
    <div style={{fontSize:12, color:note ? C.blue : mut3, marginTop:9, fontFamily:BMONO, minHeight:16}}>{note || 'Select any passage above ↑'}</div>
  </div>;
}

/* 20 — Kbd: keyboard hint */
function Kbd({children, style}) {
  return <kbd style={{fontFamily:BMONO, fontSize:10.5, color:mut, background:'var(--wb-fill)', border:'1px solid var(--wb-sep)', borderBottomWidth:2, borderRadius:5, padding:'1px 6px', ...style}}>{children}</kbd>;
}

/* 21 — Skeleton: auto mode — wrap any rendered subtree in <Skeleton loading> and it measures the layout (text lines, avatars, chips, images) and generates matching shimmer blocks */
const SKGRAD = 'linear-gradient(90deg, var(--wb-fill) 30%, var(--wb-fill2) 50%, var(--wb-fill) 70%)';
function Skeleton(props) {
  if (props.children !== undefined) return <AutoSkeleton {...props}/>;
  const w = props.w == null ? '100%' : props.w, h = props.h == null ? 14 : props.h, r = props.r == null ? 6 : props.r;
  return <span style={{display:'block', width:w, height:h, borderRadius:r, background:SKGRAD, backgroundSize:'200% 100%', animation:'bui-sweep 1.4s linear infinite', ...props.style}}/>;
}
function AutoSkeleton({loading = true, children, style}) {
  const ref = useRef(null);
  const [blocks, setBlocks] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!loading || !el) { setBlocks(null); return; }
    const measure = () => {
      const root = el.getBoundingClientRect();
      if (!root.width) return;
      const out = [];
      const pushRect = (x, y, w, h, r) => { if (w > 3 && h > 3 && out.length < 140) out.push({x:x - root.left, y:y - root.top, w, h, r}); };
      const walk = node => {
        for (const c of node.childNodes) {
          if (out.length >= 140) return;
          if (c.nodeType === 3) {
            if (!c.textContent.trim()) continue;
            const rg = document.createRange(); rg.selectNodeContents(c);
            for (const lr of rg.getClientRects()) pushRect(lr.left, lr.top + lr.height * 0.14, lr.width, lr.height * 0.72, 4);
            continue;
          }
          if (c.nodeType !== 1) continue;
          const cs = getComputedStyle(c);
          if (cs.display === 'none') continue;
          const hasEl = Array.from(c.childNodes).some(n => n.nodeType === 1);
          const bg = cs.backgroundImage !== 'none' || (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
          if (/^(IMG|svg|CANVAS|VIDEO|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(c.tagName) || (!hasEl && bg)) {
            const r = c.getBoundingClientRect();
            const br = parseFloat(cs.borderRadius) || 0;
            pushRect(r.left, r.top, r.width, r.height, br >= Math.min(r.width, r.height) / 2 ? 999 : Math.max(br, 4));
          } else walk(c);
        }
      };
      walk(el);
      setBlocks(out);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, [loading]);
  return <span style={{position:'relative', display:'block', ...style}}>
    <span ref={ref} aria-hidden={loading ? true : undefined} style={{display:'block', opacity:loading ? 0 : 1, pointerEvents:loading ? 'none' : 'auto', transition:'opacity .25s'}}>{children}</span>
    {loading && blocks && blocks.map((b, i) => <span key={i} style={{position:'absolute', left:b.x, top:b.y, width:b.w, height:b.h, borderRadius:b.r,
      background:SKGRAD, backgroundSize:'200% 100%', animation:'bui-sweep 1.4s linear infinite'}}/>)}
  </span>;
}
Skeleton.Text = function SkText({lines = 3}) {
  return <span style={{display:'grid', gap:7}}>{Array.from({length:lines}, (_, i) => <Skeleton key={i} h={11} w={i === lines - 1 ? '62%' : '100%'}/>)}</span>;
};
Skeleton.Avatar = function SkAvatar({size = 32}) { return <Skeleton w={size} h={size} r="50%"/>; };

/* 22 — Popover + Dropdown: floating primitives (Trigger clones its child, react-aria asChild style) */
const PopCtx = React.createContext(null);
function Popover({children, style}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  return <PopCtx.Provider value={{open, setOpen}}><span ref={ref} style={{position:'relative', display:'inline-block', ...style}}>{children}</span></PopCtx.Provider>;
}
Popover.Trigger = function PopTrigger({children}) {
  const c = React.useContext(PopCtx);
  return React.cloneElement(React.Children.only(children), {onClick:() => { c.setOpen(o => !o); vib([5]); }});
};
Popover.Content = function PopContent({align = 'start', width = 250, children}) {
  const c = React.useContext(PopCtx);
  if (!c.open) return null;
  return <div style={{position:'absolute', top:'100%', [align === 'end' ? 'right' : 'left']:0, marginTop:6, width, zIndex:30,
    ...card({padding:12, background:'#17171D', boxShadow:'0 14px 36px rgba(0,0,0,.5)'}), animation:'bui-in .16s ' + BEASE, fontSize:12.5, color:mut, lineHeight:1.55}}>{children}</div>;
};
const Dropdown = function Dropdown(props) { return Popover(props); };
Dropdown.Trigger = Popover.Trigger;
Dropdown.Menu = function DdMenu({align = 'start', width = 190, children}) {
  const c = React.useContext(PopCtx);
  if (!c.open) return null;
  return <div style={{position:'absolute', top:'100%', [align === 'end' ? 'right' : 'left']:0, marginTop:6, width, zIndex:30, display:'grid', gap:1,
    ...card({padding:5, background:'#17171D', boxShadow:'0 14px 36px rgba(0,0,0,.5)'}), animation:'bui-in .16s ' + BEASE}}>{children}</div>;
};
Dropdown.Item = function DdItem({icon, kbd, danger, onSelect, children}) {
  const c = React.useContext(PopCtx);
  return <button className="bui-hl" onClick={() => { c.setOpen(false); vib([5]); onSelect && onSelect(); }}
    style={{display:'flex', alignItems:'center', gap:9, width:'100%', border:0, borderRadius:7, background:'none', padding:'7px 9px', cursor:'pointer',
      fontFamily:BFONT, fontSize:12.5, color:danger ? C.red : 'var(--wb-label)', textAlign:'left'}}>
    {icon && <span style={{display:'grid', color:danger ? C.red : mut}}><BIcon d={typeof icon === 'string' ? P[icon] : icon} size={14}/></span>}
    <span style={{flex:1}}>{children}</span>{kbd && <Kbd>{kbd}</Kbd>}</button>;
};
Dropdown.Separator = function DdSep() { return <div style={{height:1, background:'var(--wb-sep)', margin:'4px 6px'}}/>; };

/* 24 — Toast: sonner-style stack — newest in front, older toasts peek behind, hover fans the stack out; timers pause on hover */
const ToastCtx = React.createContext(null);
function useToast() { return React.useContext(ToastCtx); }
function ToastProvider({children, max = 4, style}) {
  const [toasts, setToasts] = useState([]);
  const [hover, setHover] = useState(false);
  const timers = useRef({});
  const dismiss = id => { clearTimeout(timers.current[id]); delete timers.current[id]; setToasts(x => x.filter(y => y.id !== id)); };
  const arm = (id, ms) => { clearTimeout(timers.current[id]); timers.current[id] = setTimeout(() => dismiss(id), ms); };
  const push = t => { const id = Date.now() + Math.random(); vib([8]);
    setToasts(x => [...x.slice(-(max - 1)), {id, dur:t.duration || 4200, ...t}]);
    arm(id, t.duration || 4200); return id; };
  useEffect(() => { const T = timers.current; return () => Object.keys(T).forEach(k => clearTimeout(T[k])); }, []);
  useEffect(() => {
    if (hover) Object.keys(timers.current).forEach(k => clearTimeout(timers.current[k]));
    else toasts.forEach(t => arm(t.id, t.dur));
  }, [hover]);
  return <ToastCtx.Provider value={{push, dismiss}}>
    <div style={{position:'relative', height:'100%', ...style}}>{children}
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{position:'absolute', right:12, bottom:12, zIndex:50, width:272, height:0}}>
        {toasts.map((t, i) => {
          const off = toasts.length - 1 - i;
          const y = hover ? -(off * 74) : -(off * 14);
          return <div key={t.id} style={{position:'absolute', right:0, bottom:0, width:'100%',
            transform:'translateY(' + y + 'px) scale(' + (hover ? 1 : 1 - off * 0.06) + ')', transformOrigin:'bottom right',
            opacity:!hover && off > 2 ? 0 : 1, zIndex:20 - off, transition:'transform .4s ' + BEASE + ', opacity .3s'}}>
            <BUIToast {...t} onDismiss={() => dismiss(t.id)}/>
          </div>; })}
      </div></div>
  </ToastCtx.Provider>;
}
function BUIToast({tone = 'info', title, detail, onDismiss}) {
  const tc = tone === 'success' ? C.green : tone === 'error' ? C.red : C.blue;
  const ic = tone === 'success' ? P.check : tone === 'error' ? P.x : P.spark;
  return <div style={{...card({padding:'10px 12px', background:'#17171D', boxShadow:'0 12px 32px rgba(0,0,0,.5)'}), display:'flex', gap:9, alignItems:'flex-start', boxSizing:'border-box', animation:'bui-in .25s ' + BEASE}}>
    <span style={{color:tc, display:'grid', marginTop:1}}><BIcon d={ic} size={13} sw={2.4}/></span>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{title}</div>
      {detail && <div style={{fontSize:11.5, color:mut, marginTop:2, lineHeight:1.45, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>{detail}</div>}
    </div>
    <button onClick={onDismiss} aria-label="Dismiss" style={{border:0, background:'none', color:mut3, cursor:'pointer', padding:2, display:'grid'}}><BIcon d={P.x} size={11} sw={2.2}/></button>
  </div>;
}

/* 25 — Cite: inline citation popover — sugar over Popover */
function Cite({n, children}) {
  return <Popover><Popover.Trigger>
    <button style={{border:0, background:'rgba(10,132,255,.14)', color:C.blue, fontFamily:BMONO, fontSize:9.5, fontWeight:700, borderRadius:5,
      padding:'1px 5px', cursor:'pointer', verticalAlign:'super', lineHeight:1.4}}>{n}</button>
  </Popover.Trigger><Popover.Content width={260}>{children}</Popover.Content></Popover>;
}
Cite.Quote = function CiteQuote({children}) { return <div style={{fontSize:12, color:'var(--wb-label)', lineHeight:1.55, borderLeft:'2px solid ' + C.blue, paddingLeft:9, marginBottom:9}}>{children}</div>; };
Cite.Source = function CiteSource({kind = 'PDF', children}) {
  const tone = kind === 'CSV' ? C.green : kind === 'WEB' ? C.teal : C.red;
  return <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color:mut, border:'1px solid var(--wb-sep)', borderRadius:7, padding:'3px 8px'}}>
    <span style={{fontSize:9.5, fontWeight:800, color:tone}}>{kind}</span>{children}</span>;
};

/* 26 — PlanReview: editable step list the user approves before the agent runs */
function PlanReview({title = 'Proposed plan', onApprove, onReject, approved, children}) {
  return <div style={card({overflow:'hidden', maxWidth:480})}>
    <div style={{display:'flex', alignItems:'center', gap:8, padding:'11px 14px', borderBottom:'1px solid var(--wb-sep)'}}>
      <span style={{color:C.orange, display:'grid'}}><BIcon d={P.bolt} size={14}/></span>
      <span style={{fontSize:13, fontWeight:650, color:'var(--wb-label)', flex:1}}>{title}</span>
      <span style={{fontSize:10.5, fontWeight:700, color:approved ? C.green : C.orange}}>{approved ? 'APPROVED' : 'AWAITING REVIEW'}</span>
    </div>
    <div style={{padding:'8px 10px'}}>{children}</div>
    {!approved && <div style={{display:'flex', gap:8, justifyContent:'flex-end', padding:'4px 12px 12px'}}>
      <button onClick={() => { vib([6]); onReject && onReject(); }} style={{border:0, borderRadius:9, padding:'7px 13px', fontSize:12.5, fontWeight:650, cursor:'pointer', fontFamily:BFONT, background:'var(--wb-fill)', color:'var(--wb-label)'}}>Reject</button>
      <button onClick={() => { vib([12]); onApprove && onApprove(); }} style={{border:0, borderRadius:9, padding:'7px 15px', fontSize:12.5, fontWeight:650, cursor:'pointer', fontFamily:BFONT, background:C.blue, color:'#fff'}}>Approve & run</button>
    </div>}
  </div>;
}
PlanReview.Step = function PlanStep({n, detail, onUp, onDown, onRemove, children}) {
  return <div className="bui-hl" style={{display:'flex', alignItems:'center', gap:9, padding:'7px 8px', borderRadius:9}}>
    <span style={{width:19, height:19, borderRadius:6, background:'var(--wb-fill)', display:'grid', placeItems:'center', fontFamily:BMONO, fontSize:10, color:mut, flexShrink:0}}>{n}</span>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:12.5, color:'var(--wb-label)', fontWeight:600}}>{children}</div>
      {detail && <div style={{fontSize:11, color:mut3, marginTop:1}}>{detail}</div>}
    </div>
    <span style={{display:'flex', gap:1}}>
      {onUp && <button onClick={() => { vib([4]); onUp(); }} aria-label="Move up" style={{border:0, background:'none', color:mut3, cursor:'pointer', padding:3, display:'grid'}}><BIcon d={P.up} size={12}/></button>}
      {onDown && <button onClick={() => { vib([4]); onDown(); }} aria-label="Move down" style={{border:0, background:'none', color:mut3, cursor:'pointer', padding:3, display:'grid'}}><BIcon d={P.down} size={12}/></button>}
      {onRemove && <button onClick={() => { vib([6]); onRemove(); }} aria-label="Remove" style={{border:0, background:'none', color:mut3, cursor:'pointer', padding:3, display:'grid'}}><BIcon d={P.trash} size={12}/></button>}
    </span>
  </div>;
};

/* 27 — MemoryPills: what the agent currently knows, dismissible */
function MemoryPills({label = 'Agent context', children}) {
  return <div style={{fontFamily:BFONT}}>
    <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
      <span style={{color:C.purple, display:'grid'}}><BIcon d={P.brain} size={13}/></span>
      <span style={{fontSize:11, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', color:mut3}}>{label}</span>
    </div>
    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>{children}</div>
  </div>;
}
MemoryPills.Pill = function MemPill({icon, onDismiss, children}) {
  return <span style={{display:'inline-flex', alignItems:'center', gap:6, border:'1px solid var(--wb-sep)', background:'var(--wb-fill)', borderRadius:999,
    padding:'4px 6px 4px 11px', fontSize:12, color:'var(--wb-label)', fontFamily:BFONT, animation:'bui-in .2s ' + BEASE}}>
    {icon && <span style={{color:mut, display:'grid'}}><BIcon d={typeof icon === 'string' ? P[icon] : icon} size={12}/></span>}
    {children}
    {onDismiss && <button onClick={() => { vib([5]); onDismiss(); }} aria-label="Forget" style={{border:0, background:'none', color:mut3, cursor:'pointer', padding:2, display:'grid'}}><BIcon d={P.x} size={10} sw={2.4}/></button>}
  </span>;
};

/* 28 — AgentBoard: parallel agents with live state */
function AgentBoard({children}) {
  return <div style={{...card({overflow:'hidden', maxWidth:500}), display:'grid'}}>{children}</div>;
}
AgentBoard.Agent = function BoardAgent({name, task, state = 'idle', progress, tone}) {
  const tc = tone || (state === 'done' ? C.green : state === 'failed' ? C.red : state === 'running' ? C.blue : mut3);
  return <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px 13px', borderBottom:'1px solid var(--wb-sep)'}}>
    <span style={{width:26, height:26, borderRadius:8, background:'var(--wb-fill)', display:'grid', placeItems:'center', color:tc, flexShrink:0}}>
      <BIcon d={P.spark} size={13}/></span>
    <div style={{flex:1, minWidth:0}}>
      <div style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)'}}>{name}</div>
      <div style={{fontSize:11.5, color:mut, whiteSpace:'nowrap', overflow:'hidden', textOverflowEllipsis:'ellipsis', textOverflow:'ellipsis'}}>{task}</div>
    </div>
    {state === 'running' && progress != null ? <div style={{display:'flex', alignItems:'center', gap:7}}><Meter v={progress} tone={C.blue}/><span style={{fontFamily:BMONO, fontSize:10.5, color:mut3, width:30, textAlign:'right'}}>{Math.round(progress*100)}%</span></div>
      : state === 'running' ? <span style={{width:12, height:12, border:'2px solid var(--wb-fill2)', borderTopColor:C.blue, borderRadius:'50%', animation:'bui-spin .8s linear infinite'}}/>
      : <span style={{fontSize:10.5, fontWeight:700, color:tc, background:state === 'done' ? 'rgba(50,215,75,.12)' : state === 'failed' ? 'rgba(255,69,58,.12)' : 'var(--wb-fill)', borderRadius:6, padding:'2px 8px', textTransform:'capitalize'}}>{state}</span>}
  </div>;
};

/* 29 — CommandMenu: ⌘K palette — Input / List / Group / Item compose; items self-filter on the shared query */
const CmdCtx = React.createContext(null);
function CommandMenu({open, onClose, children}) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  return <CmdCtx.Provider value={{q, setQ, onClose}}>
    <div onClick={onClose} style={{position:'absolute', inset:0, zIndex:40, background:'rgba(0,0,0,.5)', display:'grid', justifyItems:'center', alignItems:'start',
      paddingTop:36, opacity:open ? 1 : 0, pointerEvents:open ? 'auto' : 'none', transition:'opacity .22s'}}>
      <div onClick={e => e.stopPropagation()} style={{...card({background:'#17171D', width:'min(400px, 90%)', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,.6)'}),
        transform:open ? 'none' : 'scale(.96) translateY(-6px)', transition:'transform .28s ' + BEASE}}>{children}</div>
    </div></CmdCtx.Provider>;
}
CommandMenu.Input = function CmdInput({placeholder = 'Type a command…'}) {
  const c = React.useContext(CmdCtx);
  return <div style={{display:'flex', alignItems:'center', gap:9, padding:'11px 14px', borderBottom:'1px solid var(--wb-sep)'}}>
    <span style={{color:mut3, display:'grid'}}><BIcon d={P.search} size={15}/></span>
    <input value={c.q} onChange={e => c.setQ(e.target.value)} placeholder={placeholder}
      style={{border:0, background:'none', outline:'none', color:'var(--wb-label)', fontSize:13.5, fontFamily:BFONT, flex:1}}/>
    <Kbd>esc</Kbd>
  </div>;
};
CommandMenu.List = function CmdList({children}) { return <div className="wb-scroll" style={{maxHeight:240, overflowY:'auto', padding:6}}>{children}</div>; };
CommandMenu.Group = function CmdGroup({title, children}) {
  const c = React.useContext(CmdCtx);
  const kids = React.Children.toArray(children).filter(k => {
    const hay = ((typeof k.props.children === 'string' ? k.props.children : '') + ' ' + (k.props.keywords || '')).toLowerCase();
    return !c.q || hay.includes(c.q.toLowerCase());
  });
  if (!kids.length) return null;
  return <div>{title && <div style={{fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase', color:mut3, padding:'8px 9px 3px'}}>{title}</div>}{kids}</div>;
};
CommandMenu.Item = function CmdItem({icon, kbd, keywords, onSelect, children}) {
  const c = React.useContext(CmdCtx);
  return <button className="bui-hl" onClick={() => { vib([6]); c.onClose && c.onClose(); onSelect && onSelect(); }}
    style={{display:'flex', alignItems:'center', gap:9, width:'100%', border:0, borderRadius:8, background:'none', padding:'8px 9px', cursor:'pointer',
      fontFamily:BFONT, fontSize:13, color:'var(--wb-label)', textAlign:'left'}}>
    {icon && <span style={{color:C.blue, display:'grid'}}><BIcon d={typeof icon === 'string' ? P[icon] : icon} size={14}/></span>}
    <span style={{flex:1}}>{children}</span>{kbd && <Kbd>{kbd}</Kbd>}</button>;
};

/* 30 — DatePicker: month grid */
function DatePicker({value, onChange}) {
  const today = new Date();
  const [view, setView] = useState(() => new Date((value || today).getFullYear(), (value || today).getMonth(), 1));
  const y = view.getFullYear(), m = view.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const same = d => value && d === value.getDate() && m === value.getMonth() && y === value.getFullYear();
  const isToday = d => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  return <div style={{...card({padding:12, width:250}), fontFamily:BFONT}}>
    <div style={{display:'flex', alignItems:'center', marginBottom:8}}>
      <button className="bui-hl" onClick={() => { setView(new Date(y, m - 1, 1)); vib([4]); }} aria-label="Previous month" style={{border:0, background:'none', color:mut, cursor:'pointer', padding:5, borderRadius:7, display:'grid', transform:'rotate(180deg)'}}><BIcon d={P.chev} size={13}/></button>
      <span style={{flex:1, textAlign:'center', fontSize:12.5, fontWeight:650, color:'var(--wb-label)'}}>{view.toLocaleString('en', {month:'long'})} {y}</span>
      <button className="bui-hl" onClick={() => { setView(new Date(y, m + 1, 1)); vib([4]); }} aria-label="Next month" style={{border:0, background:'none', color:mut, cursor:'pointer', padding:5, borderRadius:7, display:'grid'}}><BIcon d={P.chev} size={13}/></button>
    </div>
    <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, textAlign:'center'}}>
      {['M','T','W','T','F','S','S'].map((d, i) => <span key={i} style={{fontSize:9.5, fontWeight:700, color:mut3, padding:'2px 0'}}>{d}</span>)}
      {Array.from({length:first}, (_, i) => <span key={'e' + i}/>)}
      {Array.from({length:days}, (_, i) => { const d = i + 1;
        return <button key={d} onClick={() => { vib([5]); onChange && onChange(new Date(y, m, d)); }} className={same(d) ? '' : 'bui-hl'}
          style={{border:0, borderRadius:7, padding:'5px 0', fontSize:11.5, cursor:'pointer', fontFamily:BFONT,
            background:same(d) ? C.blue : 'none', color:same(d) ? '#fff' : isToday(d) ? C.blue : 'var(--wb-label)', fontWeight:same(d) || isToday(d) ? 700 : 400}}>{d}</button>; })}
    </div>
  </div>;
}

/* 31 — Combobox: filtering input + listbox with keyboard nav */
function Combobox({options = [], value, onChange, placeholder = 'Search…'}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const hits = options.filter(o => o.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  const commit = o => { onChange && onChange(o); setQ(''); setOpen(false); vib([6]); };
  const key = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, hits.length - 1)); setOpen(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open && hits[hi]) commit(hits[hi]);
    else if (e.key === 'Escape') setOpen(false);
  };
  return <div ref={ref} style={{position:'relative', width:250, fontFamily:BFONT}}>
    <div style={{...card({borderRadius:10, padding:'7px 11px'}), display:'flex', alignItems:'center', gap:8}}>
      <span style={{color:mut3, display:'grid'}}><BIcon d={P.search} size={13}/></span>
      <input value={q} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }} onKeyDown={key}
        placeholder={value || placeholder} style={{border:0, background:'none', outline:'none', color:'var(--wb-label)', fontSize:13, fontFamily:BFONT, flex:1, minWidth:0}}/>
      {value && !q && <span style={{fontSize:10.5, fontWeight:700, color:C.blue}}>✓</span>}
    </div>
    {open && <div style={{position:'absolute', top:'100%', left:0, right:0, marginTop:5, zIndex:30, ...card({padding:5, background:'#17171D', boxShadow:'0 14px 36px rgba(0,0,0,.5)'}), animation:'bui-in .15s ' + BEASE}}>
      {hits.map((o, i) => <button key={o} onClick={() => commit(o)} onMouseEnter={() => setHi(i)}
        style={{display:'flex', alignItems:'center', gap:8, width:'100%', border:0, borderRadius:7, padding:'7px 9px', cursor:'pointer', fontFamily:BFONT,
          fontSize:12.5, color:'var(--wb-label)', textAlign:'left', background:i === hi ? 'var(--wb-fill2)' : 'none'}}>
        <span style={{width:13, color:C.blue, display:'grid'}}>{value === o ? <BIcon d={P.check} size={12} sw={2.6}/> : null}</span>{o}</button>)}
      {!hits.length && <div style={{padding:'12px 0', textAlign:'center', fontSize:12, color:mut3}}>No matches</div>}
    </div>}
  </div>;
}

/* 32 — ModelPicker: provider rail + search + favorites, ⌘N quick-select */
const PROV_TONE = {anthropic:'#D97757', openai:'#EDEDF2', google:'#4285F4', opencode:'#B8B8C4', deepseek:'#5E7CE2'};
/* real vector marks: OpenAI from Bootstrap Icons (MIT); Gemini four-point spark; Anthropic slab-A */
const PROV_ICON = {
  openai:{vb:'0 0 16 16', d:'M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94a3.02 3.02 0 0 1 1.569-1.325v3.827a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.32a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a2.98 2.98 0 0 1-.46 5.383v-3.83a.51.51 0 0 0-.258-.457zm1.36-2.02-.095-.056-3.228-1.858a.53.53 0 0 0-.527 0L6.253 6.146V4.591a.05.05 0 0 1 .022-.041l3.27-1.861c1.456-.83 3.316-.335 4.15 1.106.36.607.487 1.322.353 2.019m-8.716 2.836-1.367-.777a.05.05 0 0 1-.025-.036V4.117a2.99 2.99 0 0 1 4.9-2.286l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.759-1 1.762 1v2l-1.755 1-1.762-1z'},
  google:{vb:'0 0 24 24', d:'M12 1c.6 6.1 4.8 10.3 11 11-6.2.7-10.4 4.9-11 11-.6-6.1-4.8-10.3-11-11 6.2-.7 10.4-4.9 11-11z'},
  anthropic:{vb:'0 0 24 24', d:'M13.79 4.6h-3.66L3.5 19.4h3.73l1.36-3.42h6.75l1.36 3.42h3.8L13.79 4.6zm-4 8.53l2.2-5.53 2.2 5.53h-4.4z'}
};
function ProvGlyph({p, size = 20, active}) {
  const ic = PROV_ICON[p];
  if (ic) return <span style={{width:size, height:size, borderRadius:6, background:active ? 'var(--wb-fill2)' : 'transparent', display:'grid', placeItems:'center'}}>
    <svg width={size * 0.78} height={size * 0.78} viewBox={ic.vb} fill={PROV_TONE[p] || 'currentColor'} xmlns="http://www.w3.org/2000/svg"><path d={ic.d}/></svg></span>;
  return <span style={{width:size, height:size, borderRadius:6, background:active ? 'var(--wb-fill2)' : 'var(--wb-fill)', display:'grid', placeItems:'center',
    fontSize:size * 0.5, fontWeight:800, color:PROV_TONE[p] || mut, fontFamily:BFONT, textTransform:'uppercase'}}>{(p || '?')[0]}</span>;
}
function ModelPicker({models = [], value, onChange, favorites = [], up}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [rail, setRail] = useState(null);          /* null = all, '★' = favorites, else provider id */
  const [favs, setFavs] = useState(favorites);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const down = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [open]);
  const hits = models.filter(m =>
    (!q || m.name.toLowerCase().includes(q.toLowerCase())) &&
    (rail === '★' ? favs.includes(m.id) : !rail || m.provider === rail));
  useEffect(() => {
    if (!open) return;
    const key = e => {
      if (e.key === 'Escape') setOpen(false);
      const n = parseInt(e.key, 10);
      if ((e.metaKey || e.ctrlKey) && n >= 1 && n <= Math.min(hits.length, 9)) {
        e.preventDefault(); onChange && onChange(hits[n - 1].id); setOpen(false); vib([8]);
      }};
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, hits, onChange]);
  const cur = models.find(m => m.id === value);
  const providers = [...new Set(models.map(m => m.provider))];
  const railBtn = (id, node, label) => <button key={id || 'all'} onClick={() => { setRail(rail === id ? null : id); vib([4]); }} aria-label={label}
    style={{position:'relative', border:0, background:'none', cursor:'pointer', padding:'7px 0', display:'grid', placeItems:'center', width:'100%'}}>
    {rail === id && <span style={{position:'absolute', left:0, top:'50%', transform:'translateY(-50%)', width:2.5, height:18, borderRadius:2, background:C.blue}}/>}
    {node}</button>;
  return <div ref={ref} style={{position:'relative', display:'inline-block', fontFamily:BFONT}}>
    <button className="bui-hl" onClick={() => { setOpen(o => !o); vib([5]); }}
      style={{display:'flex', alignItems:'center', gap:7, ...card({padding:'6px 11px', borderRadius:999}), color:'var(--wb-label)', fontSize:12.5, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'}}>
      {cur && <ProvGlyph p={cur.provider} size={16}/>}{cur ? cur.name : 'Pick a model'}
      <span style={{color:mut3, display:'grid'}}><BIcon d={P.chevD} size={12}/></span></button>
    {open && <div style={{position:'absolute', left:0, ...(up ? {bottom:'100%', marginBottom:8} : {top:'100%', marginTop:8}), zIndex:40, display:'flex', width:340, height:300,
      ...card({background:'#141419', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,.6)'}), animation:'bui-in .18s ' + BEASE}}>
      <div className="wb-scroll" style={{width:44, flexShrink:0, borderRight:'1px solid var(--wb-sep)', overflowY:'auto', padding:'6px 0'}}>
        {railBtn('★', <span style={{color:rail === '★' ? '#fff' : mut3, fontSize:15}}>★</span>, 'Favorites')}
        {providers.map(p => railBtn(p, <ProvGlyph p={p} active={rail === p}/>, p))}
      </div>
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 12px 8px', borderBottom:'2px solid ' + C.blue}}>
          <span style={{color:mut3, display:'grid'}}><BIcon d={P.search} size={14}/></span>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search models…"
            style={{border:0, background:'none', outline:'none', color:'var(--wb-label)', fontSize:13, fontFamily:BFONT, flex:1, minWidth:0}}/>
        </div>
        <div className="wb-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'4px 6px'}}>
          {hits.map((m, i) => <div key={m.id} className="bui-hl" style={{display:'flex', alignItems:'center', gap:8, borderRadius:9, padding:'7px 8px',
              background:m.id === value ? 'var(--wb-fill)' : 'transparent'}}>
            <button onClick={() => { onChange && onChange(m.id); setOpen(false); vib([8]); }}
              style={{flex:1, minWidth:0, border:0, background:'none', padding:0, cursor:'pointer', textAlign:'left', fontFamily:BFONT}}>
              <div style={{fontSize:12.5, fontWeight:600, color:'var(--wb-label)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{m.name}</div>
              <div style={{display:'flex', alignItems:'center', gap:5, fontSize:11, color:mut3, marginTop:1}}>
                <ProvGlyph p={m.provider} size={12}/>{m.source || m.provider}</div>
            </button>
            {i < 9 && <Kbd>⌘{i + 1}</Kbd>}
            <button onClick={() => { vib([5]); setFavs(f => f.includes(m.id) ? f.filter(x => x !== m.id) : [...f, m.id]); }} aria-label="Favorite"
              style={{border:0, background:'none', cursor:'pointer', padding:2, fontSize:13, color:favs.includes(m.id) ? C.orange : mut3, lineHeight:1}}>{favs.includes(m.id) ? '★' : '☆'}</button>
          </div>)}
          {!hits.length && <div style={{padding:'26px 0', textAlign:'center', fontSize:12, color:mut3}}>{rail === '★' ? 'No favorites yet — star a model.' : 'No models match.'}</div>}
        </div>
      </div>
    </div>}
  </div>;
}

const BUI = {LoadingState, Thinking, StreamingText, ApprovalCard, ToolChips, TaskRows, RecommendationCard,
  ContextCards, DiffTable, RecordsTable, FilterTable, SidebarProvider, Sidebar, SidebarTrigger, SidebarInset, SidebarNav,
  SearchPalette, InsightCards, CodeBlockStream, FineTuneCard, SelectionActions,
  Kbd, Skeleton, Popover, Dropdown, ToastProvider, useToast, Cite, PlanReview, MemoryPills, AgentBoard, CommandMenu, DatePicker, Combobox, ModelPicker};
window.BUI = BUI;

/* docs demo registry — merged into DocsLive via window.__buiLIVE */
const imp = name => 'import { ' + name + ' } from "./beautiful.tsx"\n\nexport default function App() {\n  return <' + name + '/>\n}';
window.__buiLIVE = {
  buiLoading: {title:'LoadingState', dep:'beautiful.jsx', theme:'wb', h:280,
    code:'import { LoadingState } from "./beautiful.tsx"\n\nexport default function App() {\n  return <LoadingState variant="grid" label="Churning"/>\n  // variants: "grid" | "dots" | "orbit"\n}',
    Render:function L(){ const [v, setV] = useState('grid');
      return <div style={{display:'grid', gap:14, justifyItems:'center'}}>
        <LoadingState variant={v}/>
        <div style={{display:'flex', gap:6}}>{['grid','dots','orbit'].map(o => <BChip key={o} active={v === o} onPress={() => setV(o)}>{o}</BChip>)}</div>
      </div>; }},
  buiThinking: {title:'Thinking', dep:'beautiful.jsx', theme:'wb', h:340,
    code:'import { Thinking } from "./beautiful.tsx"\n\nexport default function App() {\n  return (\n    <Thinking defaultOpen>\n      <Thinking.Trigger>Thinking</Thinking.Trigger>\n      <Thinking.Content>\n        <Thinking.Tabs>\n          <Thinking.Tab id="steps">Steps</Thinking.Tab>\n          <Thinking.Tab id="search">Search</Thinking.Tab>\n          <Thinking.Tab id="coding">Coding</Thinking.Tab>\n        </Thinking.Tabs>\n        <Thinking.Panel id="steps">\n          <Thinking.Step done>Pull supplier lead times</Thinking.Step>\n          <Thinking.Step>Draft the reorder plan</Thinking.Step>\n        </Thinking.Panel>\n        <Thinking.Panel id="search">\n          <Thinking.Search site="scoopdata.io">seasonal cone demand</Thinking.Search>\n        </Thinking.Panel>\n        <Thinking.Panel id="coding">\n          <Thinking.Code>{"const risk = score(skus)"}</Thinking.Code>\n        </Thinking.Panel>\n      </Thinking.Content>\n    </Thinking>\n  )\n}',
    Render:function T(){ return <div style={{maxWidth:520, margin:'0 auto'}}>
      <Thinking defaultOpen>
        <Thinking.Trigger>Thinking</Thinking.Trigger>
        <Thinking.Content>
          <Thinking.Tabs>
            <Thinking.Tab id="steps">Steps</Thinking.Tab>
            <Thinking.Tab id="reasoning">Reasoning</Thinking.Tab>
            <Thinking.Tab id="search">Search</Thinking.Tab>
            <Thinking.Tab id="coding">Coding</Thinking.Tab>
          </Thinking.Tabs>
          <Thinking.Panel id="steps">{THINK.steps.map(([s, done], i) => <Thinking.Step key={i} done={done}>{s}</Thinking.Step>)}</Thinking.Panel>
          <Thinking.Panel id="reasoning"><p style={{margin:0}}>{THINK.reasoning}</p></Thinking.Panel>
          <Thinking.Panel id="search">{THINK.search.map(([site, q], i) => <Thinking.Search key={i} site={site}>{q}</Thinking.Search>)}</Thinking.Panel>
          <Thinking.Panel id="coding"><Thinking.Code>{THINK.coding}</Thinking.Code></Thinking.Panel>
        </Thinking.Content>
      </Thinking></div>; }},
  buiStreaming: {title:'StreamingText', dep:'beautiful.jsx', theme:'wb', h:360, code:imp('StreamingText'),
    Render:function S(){ return <div style={{maxWidth:520, margin:'0 auto'}}><StreamingText/></div>; }},
  buiApproval: {title:'ApprovalCard', dep:'beautiful.jsx', theme:'wb', h:290,
    code:'import { ApprovalCard } from "./beautiful.tsx"\n\nexport default function App() {\n  return <ApprovalCard\n    question="How many flavors should we launch?"\n    options={["Three (core line)", "Five (full case)", "Just one hero"]}\n    onPick={console.log}/>\n}',
    Render:function A(){ return <div style={{maxWidth:420, margin:'0 auto'}}>
      <ApprovalCard question="How many flavors should we launch?" options={['Three (core line)', 'Five (full case)', 'Just one hero']}/></div>; }},
  buiChips: {title:'ToolChips', dep:'beautiful.jsx', theme:'wb', h:250, code:imp('ToolChips'),
    Render:function TC(){ return <div style={{maxWidth:520, margin:'0 auto'}}><ToolChips/></div>; }},
  buiTasks: {title:'TaskRows', dep:'beautiful.jsx', theme:'wb', h:430, code:imp('TaskRows'),
    Render:function TR(){ return <div style={{maxWidth:520, margin:'0 auto'}}><TaskRows/></div>; }},
  buiRecommend: {title:'RecommendationCard', dep:'beautiful.jsx', theme:'wb', h:300, code:imp('RecommendationCard'),
    Render:function RC(){ return <div style={{maxWidth:440, margin:'0 auto'}}><RecommendationCard/></div>; }},
  buiContext: {title:'ContextCards', dep:'beautiful.jsx', theme:'wb', h:360, code:imp('ContextCards'),
    Render:function CC(){ return <div style={{maxWidth:520, margin:'0 auto'}}><ContextCards/></div>; }},
  buiDiff: {title:'DiffTable', dep:'beautiful.jsx', theme:'wb', h:330, code:imp('DiffTable'),
    Render:function DT(){ return <div style={{maxWidth:520, margin:'0 auto'}}><DiffTable/></div>; }},
  buiRecords: {title:'RecordsTable', dep:'beautiful.jsx', theme:'wb', h:400, code:imp('RecordsTable'),
    Render:function RT(){ return <div style={{maxWidth:560, margin:'0 auto'}}><RecordsTable/></div>; }},
  buiFilter: {title:'FilterTable', dep:'beautiful.jsx', theme:'wb', h:380, code:imp('FilterTable'),
    Render:function FT(){ return <div style={{maxWidth:540, margin:'0 auto'}}><FilterTable/></div>; }},
  buiSidebar: {title:'Sidebar system', dep:'beautiful.jsx', theme:'wb', h:480,
    code:'import { SidebarProvider, Sidebar, SidebarTrigger, SidebarInset } from "./beautiful.tsx"\n\nexport default function App() {\n  return (\n    <SidebarProvider defaultOpen breakpoint={560}>\n      <Sidebar variant="rail">  {/* docked | rail | float | overlay */}\n        <Sidebar.Header>\n          <Sidebar.Workspace name="Creamery Ops" detail="Production"/>\n        </Sidebar.Header>\n        <Sidebar.Content>\n          <Sidebar.Search/>\n          <Sidebar.Section title="Workspace">\n            <Sidebar.Item icon="home" label="Home" active/>\n            <Sidebar.Item icon="bolt" label="Agent tasks" badge={4}/>\n            <Sidebar.Item icon="inbox" label="Inbox"/>\n          </Sidebar.Section>\n        </Sidebar.Content>\n      </Sidebar>\n      <SidebarInset>\n        <SidebarTrigger/>  {/* hamburger — toggles any variant */}\n        …main content…\n      </SidebarInset>\n    </SidebarProvider>\n  )\n}',
    Render:function SN(){ const [v, setV] = useState('docked'); const [narrow, setNarrow] = useState(false);
      return <div style={{display:'grid', gap:12, justifyItems:'center'}}>
        <div style={{display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center'}}>
          {['docked','rail','float','overlay'].map(o => <BChip key={o} active={v === o} onPress={() => setV(o)}>{o}</BChip>)}
          <BChip active={narrow} onPress={() => setNarrow(n => !n)}>narrow container</BChip>
        </div>
        <div style={{width:narrow ? 380 : '100%', maxWidth:640, height:330, border:'1px solid var(--wb-sep)', borderRadius:14, overflow:'hidden', transition:'width .35s ' + BEASE}}>
          <SidebarProvider key={v + narrow} defaultOpen={v !== 'overlay'} breakpoint={430}>
            <SidebarNav variant={v}/>
            <SidebarInset>
              <div style={{display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderBottom:'1px solid var(--wb-sep)'}}>
                <SidebarTrigger/>
                <span style={{fontSize:12.5, fontWeight:650, color:'var(--wb-label)'}}>Home</span>
              </div>
              <div style={{padding:16, fontSize:12.5, color:mut, lineHeight:1.6}}>
                One API, four behaviors — the trigger toggles whichever variant is mounted, and every variant becomes a hamburger overlay when the container is narrower than the breakpoint. Try “narrow container”.
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>; }},
  buiSearch: {title:'SearchPalette', dep:'beautiful.jsx', theme:'wb', h:320, code:imp('SearchPalette'),
    Render:function SP(){ return <div style={{maxWidth:420, margin:'0 auto'}}><SearchPalette/></div>; }},
  buiInsights: {title:'InsightCards', dep:'beautiful.jsx', theme:'wb', h:340, code:imp('InsightCards'),
    Render:function IC(){ return <div style={{maxWidth:420, margin:'0 auto'}}><InsightCards/></div>; }},
  buiCode: {title:'CodeBlockStream', dep:'beautiful.jsx', theme:'wb', h:360, code:imp('CodeBlockStream'),
    Render:function CB(){ return <div style={{maxWidth:520, margin:'0 auto'}}><CodeBlockStream/></div>; }},
  buiFinetune: {title:'FineTuneCard', dep:'beautiful.jsx', theme:'wb', h:290, code:imp('FineTuneCard'),
    Render:function FC(){ return <div style={{display:'grid', justifyContent:'center'}}><FineTuneCard/></div>; }},
  buiSelection: {title:'SelectionActions', dep:'beautiful.jsx', theme:'wb', h:250, code:imp('SelectionActions'),
    Render:function SA(){ return <div style={{maxWidth:480, margin:'0 auto'}}><SelectionActions/></div>; }},
  buiToast: {title:'Toast', dep:'beautiful.jsx', theme:'wb', h:380,
    code:"import { ToastProvider, useToast } from \"./beautiful.tsx\"\n\nfunction Panel() {\n  const toast = useToast()\n  return <button onClick={() => toast.push({\n    tone: \"success\", title: \"Order placed\",\n    detail: \"48 cases of waffle cones from cone_king.\",\n  })}>Place order</button>\n}\n\nexport default function App() {\n  return <ToastProvider><Panel/></ToastProvider>\n}",
    Render:function TQ(){
      function Panel() { const toast = useToast();
        return <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', paddingTop:26}}>
          <DemoBtn label="Info" onPress={() => toast.push({tone:'info', title:'Agent resumed', detail:'Picking up the reorder plan.'})}/>
          <DemoBtn label="Success" onPress={() => toast.push({tone:'success', title:'Order placed', detail:'48 cases from cone_king.'})} style={{background:C.green}}/>
          <DemoBtn label="Error" onPress={() => toast.push({tone:'error', title:'Supplier API failed', detail:'Retrying in 30s.'})} style={{background:C.red}}/>
        </div>; }
      return <div style={{display:'grid', gap:8}}>
        <div style={{height:260, border:'1px solid var(--wb-sep)', borderRadius:12, overflow:'hidden'}}><ToastProvider><Panel/></ToastProvider></div>
        <div style={{fontSize:11.5, color:mut3, textAlign:'center'}}>Fire a few — they stack sonner-style; hover the stack to fan it out.</div>
      </div>; }},
  buiCitation: {title:'Cite', dep:'beautiful.jsx', theme:'wb', h:280,
    code:'import { Cite } from "./beautiful.tsx"\n\nexport default function App() {\n  return (\n    <p>\n      Pistachio is up 18% quarter over quarter\n      <Cite n={1}>\n        <Cite.Quote>Q4 velocity: pistachio +18%, vanilla +6%\u2026</Cite.Quote>\n        <Cite.Source kind="CSV">Sales Velocity Export.csv</Cite.Source>\n      </Cite>\n      , with the sharpest lift on weekends.\n    </p>\n  )\n}',
    Render:function CI(){ return <div style={{maxWidth:460, margin:'0 auto', fontSize:13.5, lineHeight:1.7, color:'var(--wb-label)'}}>
      <p style={{margin:0}}>Pistachio is up 18% quarter over quarter<Cite n={1}>
          <Cite.Quote>Q4 velocity table: pistachio +18%, vanilla +6%, rocky road −11%.</Cite.Quote>
          <Cite.Source kind="CSV">Sales Velocity Export.csv</Cite.Source></Cite>, with the sharpest lift on weekend afternoons<Cite n={2}>
          <Cite.Quote>Weekend scoop counts run 2.3× weekday baseline in summer.</Cite.Quote>
          <Cite.Source kind="PDF">Seasonal Demand Report.pdf</Cite.Source></Cite>. Rocky Road sits below the retirement line.</p>
      <div style={{fontSize:11.5, color:mut3, marginTop:14}}>Press a citation number ↑</div></div>; }},
  buiPlan: {title:'PlanReview', dep:'beautiful.jsx', theme:'wb', h:400,
    code:'import { PlanReview } from "./beautiful.tsx"\n\nexport default function App() {\n  const [steps, setSteps] = React.useState(initialSteps)\n  const [ok, setOk] = React.useState(false)\n  return (\n    <PlanReview approved={ok} onApprove={() => setOk(true)}>\n      {steps.map((s, i) => (\n        <PlanReview.Step key={s.id} n={i + 1} detail={s.detail}\n          onUp={i > 0 ? () => move(i, -1) : null}\n          onDown={i < steps.length - 1 ? () => move(i, 1) : null}\n          onRemove={() => setSteps(x => x.filter(y => y !== s))}>\n          {s.title}\n        </PlanReview.Step>\n      ))}\n    </PlanReview>\n  )\n}',
    Render:function PR(){
      const [steps, setSteps] = useState([
        {id:1, title:'Pull POS exports', detail:'3 files · read-only'},
        {id:2, title:'Score stockout risk', detail:'7 SKUs'},
        {id:3, title:'Draft reorder emails', detail:'2 suppliers · held for review'},
        {id:4, title:'Place cone order', detail:'writes to supplier API'}]);
      const [ok, setOk] = useState(false);
      const move = (i, d) => setSteps(x => { const y = [...x]; const [s] = y.splice(i, 1); y.splice(i + d, 0, s); return y; });
      return <div style={{maxWidth:480, margin:'0 auto'}}>
        <PlanReview approved={ok} onApprove={() => setOk(true)} onReject={() => setOk(false)}>
          {steps.map((s, i) => <PlanReview.Step key={s.id} n={i + 1} detail={s.detail}
            onUp={i > 0 ? () => move(i, -1) : null} onDown={i < steps.length - 1 ? () => move(i, 1) : null}
            onRemove={steps.length > 1 ? () => setSteps(x => x.filter(y => y.id !== s.id)) : null}>{s.title}</PlanReview.Step>)}
        </PlanReview>
        {ok && <button onClick={() => setOk(false)} style={{border:0, background:'none', color:C.blue, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:BFONT, marginTop:10}}>Reset demo</button>}
      </div>; }},
  buiMemory: {title:'MemoryPills', dep:'beautiful.jsx', theme:'wb', h:250,
    code:'import { MemoryPills } from "./beautiful.tsx"\n\nexport default function App() {\n  const [pills, setPills] = React.useState(facts)\n  return (\n    <MemoryPills label="Agent context">\n      {pills.map(p => (\n        <MemoryPills.Pill key={p.id} icon={p.icon}\n          onDismiss={() => setPills(x => x.filter(y => y !== p))}>\n          {p.text}\n        </MemoryPills.Pill>\n      ))}\n    </MemoryPills>\n  )\n}',
    Render:function MP(){
      const ALL = [{id:1, icon:'user', text:'Prefers metric units'}, {id:2, icon:'cal', text:'Reorders run Tuesdays'},
        {id:3, icon:'box', text:'cone_king is primary supplier'}, {id:4, icon:'bolt', text:'Q4 goal: retire 2 flavors'}];
      const [pills, setPills] = useState(ALL);
      return <div style={{maxWidth:460, margin:'0 auto'}}>
        <MemoryPills>{pills.map(p => <MemoryPills.Pill key={p.id} icon={p.icon} onDismiss={() => setPills(x => x.filter(y => y.id !== p.id))}>{p.text}</MemoryPills.Pill>)}</MemoryPills>
        {pills.length < ALL.length && <button onClick={() => setPills(ALL)} style={{border:0, background:'none', color:C.blue, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:BFONT, marginTop:12, padding:0}}>Restore all</button>}
      </div>; }},
  buiAgents: {title:'AgentBoard', dep:'beautiful.jsx', theme:'wb', h:330,
    code:'import { AgentBoard } from "./beautiful.tsx"\n\nexport default function App() {\n  return (\n    <AgentBoard>\n      <AgentBoard.Agent name="Researcher" task="Scanning supplier catalogs" state="running" progress={0.4}/>\n      <AgentBoard.Agent name="Analyst" task="Scoring stockout risk" state="running"/>\n      <AgentBoard.Agent name="Writer" task="Drafted 2 supplier emails" state="done"/>\n      <AgentBoard.Agent name="Checker" task="Cold-chain cert lookup failed" state="failed"/>\n    </AgentBoard>\n  )\n}',
    Render:function AB(){
      const [p, setP] = useState(0.32);
      useEffect(() => { const i = setInterval(() => setP(x => x >= 1 ? 0.05 : x + 0.04), 500); return () => clearInterval(i); }, []);
      return <div style={{maxWidth:500, margin:'0 auto'}}><AgentBoard>
        <AgentBoard.Agent name="Researcher" task="Scanning supplier catalogs" state="running" progress={Math.min(p, 1)}/>
        <AgentBoard.Agent name="Analyst" task="Scoring stockout risk" state="running"/>
        <AgentBoard.Agent name="Writer" task="Drafted 2 supplier emails" state="done"/>
        <AgentBoard.Agent name="Checker" task="Cold-chain cert lookup failed" state="failed"/>
      </AgentBoard></div>; }},
  buiCommand: {title:'CommandMenu', dep:'beautiful.jsx', theme:'wb', h:400,
    code:'import { CommandMenu, Kbd } from "./beautiful.tsx"\n\nexport default function App() {\n  const [open, setOpen] = React.useState(false)\n  return (\n    <div style={{ position: "relative", height: 320 }}>\n      <button onClick={() => setOpen(true)}>Open <Kbd>\u2318K</Kbd></button>\n      <CommandMenu open={open} onClose={() => setOpen(false)}>\n        <CommandMenu.Input/>\n        <CommandMenu.List>\n          <CommandMenu.Group title="Agent">\n            <CommandMenu.Item icon="bolt" kbd="\u2318R" keywords="forecast">Run demand forecast</CommandMenu.Item>\n            <CommandMenu.Item icon="doc" keywords="email draft">Draft supplier email</CommandMenu.Item>\n          </CommandMenu.Group>\n          <CommandMenu.Group title="Navigate">\n            <CommandMenu.Item icon="home" kbd="G H">Go home</CommandMenu.Item>\n          </CommandMenu.Group>\n        </CommandMenu.List>\n      </CommandMenu>\n    </div>\n  )\n}',
    Render:function CM(){
      const [open, setOpen] = useState(false);
      return <div style={{position:'relative', height:300, border:'1px solid var(--wb-sep)', borderRadius:12, overflow:'hidden'}}>
        <div style={{display:'grid', placeItems:'center', height:'100%'}}>
          <button className="bui-hl" onClick={() => { setOpen(true); vib([6]); }} style={{display:'flex', alignItems:'center', gap:8, ...card({padding:'8px 14px', borderRadius:10}), color:mut, fontSize:13, cursor:'pointer', fontFamily:BFONT, whiteSpace:'nowrap'}}>
            <BIcon d={P.search} size={14}/>Search commands<Kbd>⌘K</Kbd></button>
        </div>
        <CommandMenu open={open} onClose={() => setOpen(false)}>
          <CommandMenu.Input/>
          <CommandMenu.List>
            <CommandMenu.Group title="Agent">
              <CommandMenu.Item icon="bolt" kbd="⌘R" keywords="forecast demand">Run demand forecast</CommandMenu.Item>
              <CommandMenu.Item icon="doc" keywords="email supplier draft">Draft supplier email</CommandMenu.Item>
              <CommandMenu.Item icon="spark" keywords="rebalance flavors">Rebalance flavors</CommandMenu.Item>
            </CommandMenu.Group>
            <CommandMenu.Group title="Navigate">
              <CommandMenu.Item icon="home" kbd="G H" keywords="go home">Go home</CommandMenu.Item>
              <CommandMenu.Item icon="inbox" kbd="G I" keywords="go inbox">Go to inbox</CommandMenu.Item>
            </CommandMenu.Group>
          </CommandMenu.List>
        </CommandMenu>
      </div>; }},
  buiPopover: {title:'Popover · Dropdown', dep:'beautiful.jsx', theme:'wb', h:320,
    code:'import { Popover, Dropdown } from "./beautiful.tsx"\n\nexport default function App() {\n  return (\n    <div style={{ display: "flex", gap: 16 }}>\n      <Popover>\n        <Popover.Trigger><button>Details</button></Popover.Trigger>\n        <Popover.Content>Any content \u2014 the trigger clones\n          its child (asChild style).</Popover.Content>\n      </Popover>\n      <Dropdown>\n        <Dropdown.Trigger><button>Actions</button></Dropdown.Trigger>\n        <Dropdown.Menu>\n          <Dropdown.Item icon="pen" kbd="\u2318E">Edit</Dropdown.Item>\n          <Dropdown.Item icon="copy">Duplicate</Dropdown.Item>\n          <Dropdown.Separator/>\n          <Dropdown.Item icon="trash" danger>Delete</Dropdown.Item>\n        </Dropdown.Menu>\n      </Dropdown>\n    </div>\n  )\n}',
    Render:function PD(){
      const btn = label => <button className="bui-hl" style={{...card({padding:'7px 14px', borderRadius:9}), color:'var(--wb-label)', fontSize:12.5, fontWeight:600, cursor:'pointer', fontFamily:BFONT, whiteSpace:'nowrap'}}>{label}</button>;
      return <div style={{display:'flex', gap:16, justifyContent:'center', paddingTop:16, minHeight:210}}>
        <Popover><Popover.Trigger>{btn('Supplier details')}</Popover.Trigger>
          <Popover.Content><b style={{color:'var(--wb-label)'}}>cone_king</b> — 7-day lead time, cold-chain certified. Last order 12 days ago, 48 cases.</Popover.Content></Popover>
        <Dropdown><Dropdown.Trigger>{btn('Actions ▾')}</Dropdown.Trigger>
          <Dropdown.Menu>
            <Dropdown.Item icon="pen" kbd="⌘E">Edit record</Dropdown.Item>
            <Dropdown.Item icon="copy" kbd="⌘D">Duplicate</Dropdown.Item>
            <Dropdown.Item icon="doc">Export CSV</Dropdown.Item>
            <Dropdown.Separator/>
            <Dropdown.Item icon="trash" danger>Delete</Dropdown.Item>
          </Dropdown.Menu></Dropdown>
      </div>; }},
  buiSkeleton: {title:'Skeleton', dep:'beautiful.jsx', theme:'wb', h:360,
    code:"import { Skeleton } from \"./beautiful.tsx\"\n\nexport default function App() {\n  const [loading, setLoading] = React.useState(true)\n  return (\n    <Skeleton loading={loading}>\n      {/* any subtree — the skeleton is generated from its rendered layout */}\n      <SupplierCard/>\n    </Skeleton>\n  )\n}",
    Render:function SK(){
      const [loading, setLoading] = useState(true);
      return <div style={{maxWidth:440, margin:'0 auto', display:'grid', gap:12, justifyItems:'center'}}>
        <div style={{...card({padding:16}), width:'100%', boxSizing:'border-box'}}>
          <Skeleton loading={loading}>
            <div style={{display:'flex', gap:12}}>
              <span style={{width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg, #0A84FF, #5E5CE6)', display:'grid', placeItems:'center', color:'#fff', fontSize:13, fontWeight:800, flexShrink:0}}>A</span>
              <div style={{flex:1, minWidth:0, fontSize:12.5, lineHeight:1.6, color:mut}}>
                <div style={{fontWeight:650, color:'var(--wb-label)', fontSize:13}}>Aurora Scoops</div>
                <div>Reykjavík gelato wholesaler — very strong connection, last interaction 9 days ago. Primary seasonal supplier.</div>
                <div style={{display:'flex', gap:6, marginTop:9}}>{['Gelato', 'Seasonal', 'B2B'].map(t => <span key={t} style={{fontSize:10.5, fontWeight:600, color:mut, background:'var(--wb-fill)', borderRadius:5, padding:'1.5px 8px'}}>{t}</span>)}</div>
              </div>
            </div>
          </Skeleton>
        </div>
        <BChip onPress={() => setLoading(l => !l)} active={loading}>{loading ? 'loading — skeleton auto-generated' : 'resolved — press to reload'}</BChip>
      </div>; }},
  buiDate: {title:'DatePicker', dep:'beautiful.jsx', theme:'wb', h:390,
    code:'import { DatePicker } from "./beautiful.tsx"\n\nexport default function App() {\n  const [date, setDate] = React.useState(null)\n  return <DatePicker value={date} onChange={setDate}/>\n}',
    Render:function DP(){
      const [date, setDate] = useState(null);
      return <div style={{display:'grid', gap:10, justifyItems:'center'}}>
        <DatePicker value={date} onChange={setDate}/>
        <div style={{fontFamily:BMONO, fontSize:11.5, color:date ? C.blue : mut3}}>{date ? date.toDateString() : 'pick a date'}</div>
      </div>; }},
  buiCombobox: {title:'Combobox', dep:'beautiful.jsx', theme:'wb', h:330,
    code:'import { Combobox } from "./beautiful.tsx"\n\nexport default function App() {\n  const [supplier, setSupplier] = React.useState(null)\n  return <Combobox value={supplier} onChange={setSupplier}\n    placeholder="Pick a supplier\u2026"\n    options={["Aurora Scoops", "Kumo Creamery", "Maple Orbit",\n      "Coral Coast Sorbet", "Ember Cone Company"]}/>\n}',
    Render:function CX(){
      const [v, setV] = useState(null);
      return <div style={{display:'grid', gap:10, justifyItems:'center', minHeight:220, alignContent:'start', paddingTop:8}}>
        <Combobox value={v} onChange={setV} placeholder="Pick a supplier…"
          options={['Aurora Scoops', 'Kumo Creamery', 'Maple Orbit', 'Coral Coast Sorbet', 'Ember Cone Company', 'Blue Fig Gelato']}/>
        <div style={{fontFamily:BMONO, fontSize:11.5, color:v ? C.blue : mut3}}>{v || 'nothing selected'}</div>
        <div style={{fontSize:11.5, color:mut3}}>Arrow keys + Enter work too.</div>
      </div>; }},
  buiModelPicker: {title:'ModelPicker', dep:'beautiful.jsx', theme:'wb', h:440,
    code:'import { ModelPicker } from "./beautiful.tsx"\n\nconst MODELS = [\n  { id: "pickle", name: "Big Pickle", provider: "opencode", source: "OpenCode · opencode" },\n  { id: "dr-max", name: "Deep Research Max Preview", provider: "google", source: "OpenCode · google" },\n  { id: "sonnet", name: "Claude Sonnet 4.5", provider: "anthropic", source: "OpenCode · anthropic" },\n  …\n]\n\nexport default function App() {\n  const [model, setModel] = React.useState("pickle")\n  return <ModelPicker models={MODELS} value={model}\n    onChange={setModel} favorites={["sonnet"]}/>\n}',
    Render:function MPK(){
      const MODELS = [
        {id:'pickle', name:'Big Pickle', provider:'opencode', source:'OpenCode · opencode'},
        {id:'dr-max', name:'Deep Research Max Preview', provider:'google', source:'OpenCode · google'},
        {id:'dr-prev', name:'Deep Research Preview', provider:'google', source:'OpenCode · google'},
        {id:'ds-flash', name:'DeepSeek V4 Flash Free', provider:'deepseek', source:'OpenCode · opencode'},
        {id:'gem-cu', name:'Gemini 2.5 Computer Use Preview', provider:'google', source:'OpenCode · google'},
        {id:'sonnet', name:'Claude Sonnet 4.5', provider:'anthropic', source:'OpenCode · anthropic'},
        {id:'opus', name:'Claude Opus 4.7', provider:'anthropic', source:'OpenCode · anthropic'},
        {id:'g5', name:'gpt-5.6-sol', provider:'openai', source:'OpenCode · openai'}];
      const [model, setModel] = useState('g5');
      return <div style={{minHeight:360, display:'grid', justifyContent:'center', alignContent:'start', gap:10, paddingTop:4, justifyItems:'center'}}>
        <ModelPicker models={MODELS} value={model} onChange={setModel} favorites={['sonnet', 'g5']}/>
        <div style={{fontSize:11.5, color:mut3}}>Filter by provider on the rail · ⌘ star favorites · ⌘1–⌘9 quick-select</div>
      </div>; }},
  buiKbd: {title:'Kbd', dep:'beautiful.jsx', theme:'wb', h:280,
    code:'import { Kbd } from "./beautiful.tsx"\n\nexport default function App() {\n  return <p>Press <Kbd>\u2318K</Kbd> to search, <Kbd>esc</Kbd> to close.</p>\n}',
    Render:function KB(){
      const rows = [['Open command menu', ['⌘', 'K']], ['New thread', ['⌘', 'N']], ['Approve plan', ['⌘', '⏎']], ['Toggle sidebar', ['⌘', 'B']], ['Dismiss', ['esc']]];
      return <div style={{maxWidth:340, margin:'0 auto', ...card({padding:'6px 14px'})}}>
        {rows.map(([label, keys], i) => <div key={label} style={{display:'flex', alignItems:'center', padding:'8px 0', borderBottom:i < rows.length - 1 ? '1px solid var(--wb-sep)' : 'none'}}>
          <span style={{fontSize:12.5, color:'var(--wb-label)', flex:1}}>{label}</span>
          <span style={{display:'flex', gap:4}}>{keys.map(k => <Kbd key={k}>{k}</Kbd>)}</span>
        </div>)}
      </div>; }}
};
window.dispatchEvent(new Event('bui-ready'));
function BUIReady() { return null; }
if (typeof module !== 'undefined') module.exports = {BUIReady, BUI};
