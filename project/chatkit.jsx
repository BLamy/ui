/* ChatKit — an original team-chat demo in TouchKit's dark language (NOT a Discord skin):
   workspace rail · channel column · message view with reactions + inline thread previews ·
   full threads opened in a real TouchKit <SideDrawer> (docked ≥1180px, overlay below, per its own modes).
   Exposes window.TouchKitChat = { ChatDemo, ChatShell, useChatShell }; consumers written as ESM use
   import { ChatShell } from "./chatkit.tsx" (the .tsx facade re-exports these names). */
const {useState, useEffect, useRef} = React;
const KFONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const KMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const KEASE = 'cubic-bezier(.32,.72,0,1)';
const K = {bg:'#131318', rail:'#0D0D11', side:'#101015', card:'#1B1B22', fill:'rgba(255,255,255,.055)', fill2:'rgba(255,255,255,.1)',
  sep:'rgba(255,255,255,.07)', label:'#EDEDF2', mut:'rgba(235,235,245,.6)', mut3:'rgba(235,235,245,.35)',
  green:'#32D74B', orange:'#FF9F0A', red:'#FF453A'};
const kvib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch(e){} };
if (!document.getElementById('ck-css')) {
  const s = document.createElement('style'); s.id = 'ck-css';
  s.textContent = `.ck-row:hover{background:rgba(255,255,255,.035)}
.ck-row:hover .ck-acts{opacity:1}
.ck-hl:hover{background:rgba(255,255,255,.06)}
.ck-scroll{scrollbar-width:thin;scrollbar-color:rgba(140,140,155,.28) transparent}
.ck-scroll::-webkit-scrollbar{width:8px}
.ck-scroll::-webkit-scrollbar-thumb{background:rgba(140,140,155,.25);border-radius:4px;border:2px solid transparent;background-clip:padding-box}
@keyframes ck-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`;
  document.head.appendChild(s);
}
function KIcon({d, size, sw, style}) {
  return <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={sw || 1.9} strokeLinecap="round" strokeLinejoin="round" style={style}><path d={d}/></svg>;
}
const KP = {
  hash:'M9 4L7 20M17 4l-2 16M4 9h17M3 15h17', chev:'M9 6l6 6-6 6', x:'M6 6l12 12M18 6L6 18',
  send:'M12 19V5M6 11l6-6 6 6', thread:'M7 8h10M7 12h6M5 4h14v12H9l-4 4z', menu:'M4 6.5h16M4 12h16M4 17.5h16',
  bell:'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0', plus:'M12 5v14M5 12h14',
  bolt:'M13 2L4 14h6l-1 8 9-12h-6z', spark:'M12 3l2.2 6.2L20 12l-5.8 2.8L12 21l-2.2-6.2L4 12l5.8-2.8z',
  people:'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M16 4.6a3.5 3.5 0 010 6.8M18 15c2.1.7 3.5 2.2 3.5 5'
};
const USERS = {
  ada:{name:'Ada', c:'#0A84FF', role:'#7EB6FF'}, miles:{name:'Miles', c:'#BF5AF2', role:'#D8A9F0'},
  noor:{name:'Noor', c:'#FF9F0A', role:'#FFC46B'}, theo:{name:'Theo', c:'#32D74B', role:'#8CE8A5'},
  stitch:{name:'Stitch', c:'#5E5CE6', role:'#A6A5F2', bot:true}
};
function Ava({u, size = 36, square}) {
  const usr = USERS[u];
  return <span style={{width:size, height:size, borderRadius:square ? size * 0.3 : '50%', flexShrink:0, display:'grid', placeItems:'center',
    background:'linear-gradient(135deg, ' + usr.c + ', ' + usr.c + '88)', color:'#fff', fontWeight:800, fontSize:size * 0.42, fontFamily:KFONT}}>
    {usr.bot ? <KIcon d={KP.spark} size={size * 0.5} sw={2.2}/> : usr.name[0]}</span>;
}
function seed() {
  return {
    general: {section:'Team', label:'general', msgs:[
      {id:'g1', u:'noor', t:'9:12 AM', txt:'Morning! Docs site now has every Beautiful UI primitive on its own page.', reacts:[['🎉', 2, false]]},
      {id:'g2', u:'theo', t:'9:15 AM', txt:'Saw that — the Sidebar variants demo is really nice.', reacts:[]}
    ]},
    dev: {section:'Team', label:'dev', unread:true, msgs:[
      {id:'d1', u:'ada', t:'10:08 AM', txt:'that\'s the evals one', reacts:[['👍', 1, false]]},
      {id:'d2', u:'stitch', t:'10:08 AM', txt:'@miles the QA evals bot responds to comments on eval-failure PRs. It updates the PR and reruns the eval.', reacts:[],
        thread:{title:'eval PR prompts / comments', msgs:[
          {id:'d2t1', u:'miles', t:'10:10 AM', txt:'I didn\'t tag it 🤷 but ok — I won\'t comment on eval PRs then.'},
          {id:'d2t2', u:'ada', t:'11:01 AM', txt:'commenting is fine, it doesn\'t need to be tagged though'}]}},
      {id:'d3', u:'ada', t:'11:45 AM', txt:'@theo anecdotally I\'ve been seeing much better bugs — things like "I clicked this button and no sidebar opened", or "your bundle is 1.6MB, implement code splitting".',
        reacts:[['🎉', 1, false], ['👍', 1, true]],
        thread:{title:'More relevant bugs', msgs:[
          {id:'d3t1', u:'theo', t:'12:02 PM', txt:'Yeah, it recommended I tree-shake the icon set — 40% smaller.'},
          {id:'d3t2', u:'ada', t:'12:04 PM', txt:'Testing and Network categories are getting more results too, not just Accessibility.'}]}},
      {id:'d4', u:'theo', t:'11:49 AM', txt:'Added an issue for the thing from GTM planning (if a repo is connected to an existing project, don\'t spawn a new instance) — hub/RQI-108. fyi @ada, assigned to you.', reacts:[],
        thread:{title:'Repo connect spawning new project', msgs:[
          {id:'d4t1', u:'theo', t:'11:49 AM', txt:'Has the link to the customer\'s post in #general and their admin history.'},
          {id:'d4t2', u:'ada', t:'12:33 PM', txt:'I do remember when we discussed this a few weeks back — I think I didn\'t fully get the point you were raising. I do now 🙂'}]}}
    ]},
    design: {section:'Team', label:'design', msgs:[
      {id:'s1', u:'miles', t:'8:40 AM', txt:'Credenza height morph is buttery now — spring on transform, not layout.', reacts:[['🙏', 1, false]]}
    ]},
    'ws-haptics': {section:'Workstreams', label:'ws-haptics', msgs:[
      {id:'h1', u:'noor', t:'Mon', txt:'A–Z index scrub now ticks per letter with Haptics.selection(). Repeats debounced.', reacts:[]}
    ]},
    'ws-docs': {section:'Workstreams', label:'ws-docs', unread:true, msgs:[
      {id:'w1', u:'stitch', t:'Tue', txt:'Nightly link check: 0 broken anchors across 26 pages.', reacts:[]}
    ]},
    'bot-alerts': {section:'Bots', label:'bot-alerts', msgs:[
      {id:'b1', u:'stitch', t:'7:02 AM', txt:'Deploy touchkit-docs@4f21c9 → prod. 34s, all checks green.', reacts:[]}
    ]}
  };
}
function ThreadPreview({th, onOpen, tint}) {
  const last = th.msgs[th.msgs.length - 1];
  return <button onClick={() => { kvib([6]); onOpen(); }} style={{display:'block', width:'100%', maxWidth:520, textAlign:'left', marginTop:7, cursor:'pointer',
    background:K.card, border:'1px solid ' + K.sep, borderRadius:10, padding:'8px 11px', fontFamily:KFONT}}>
    <span style={{display:'flex', alignItems:'center', gap:7, fontSize:12.5}}>
      <span style={{fontWeight:650, color:K.label}}>{th.title}</span>
      <span style={{color:tint, fontWeight:600, whiteSpace:'nowrap'}}>{th.msgs.length} {th.msgs.length === 1 ? 'message' : 'messages'} ›</span>
    </span>
    {last && <span style={{display:'flex', alignItems:'center', gap:6, marginTop:4, fontSize:12, color:K.mut, minWidth:0}}>
      <Ava u={last.u} size={15}/><span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{USERS[last.u].name}: {last.txt}</span></span>}
  </button>;
}
function Rich({txt}) {
  const parts = txt.split(/(@\w+)/g);
  return <React.Fragment>{parts.map((p, i) => {
    const m = p.match(/^@(\w+)$/);
    if (m && USERS[m[1]]) return <span key={i} style={{background:'rgba(10,132,255,.16)', color:'#7EB6FF', borderRadius:4, padding:'0 3px', fontWeight:600}}>@{USERS[m[1]].name}</span>;
    return p;
  })}</React.Fragment>;
}
function Msg({m, tint, onReact, onOpenThread, onStartThread}) {
  const usr = USERS[m.u];
  return <div className="ck-row" style={{position:'relative', display:'flex', gap:11, padding:'7px 18px', fontFamily:KFONT}}>
    <Ava u={m.u} size={36} square={usr.bot}/>
    <div style={{flex:1, minWidth:0}}>
      <div style={{display:'flex', alignItems:'baseline', gap:7}}>
        <span style={{fontSize:13.5, fontWeight:700, color:usr.role}}>{usr.name}</span>
        {usr.bot && <span style={{fontSize:9, fontWeight:800, letterSpacing:'.4px', background:tint, color:'#fff', borderRadius:4, padding:'1px 5px'}}>APP</span>}
        <span style={{fontSize:10.5, color:K.mut3}}>{m.t}</span>
      </div>
      <div style={{fontSize:13.5, lineHeight:1.55, color:K.label, marginTop:1, overflowWrap:'break-word'}}><Rich txt={m.txt}/></div>
      {m.reacts.length > 0 && <div style={{display:'flex', gap:5, marginTop:6}}>
        {m.reacts.map(([e, n, mine], i) => <button key={i} onClick={() => { kvib([5]); onReact(m.id, i); }}
          style={{display:'inline-flex', alignItems:'center', gap:5, border:'1px solid ' + (mine ? tint : K.sep), background:mine ? 'rgba(10,132,255,.14)' : K.fill,
            borderRadius:999, padding:'2px 8px', fontSize:12, color:K.label, cursor:'pointer', fontFamily:KFONT}}>{e}<span style={{fontSize:11, color:mine ? '#7EB6FF' : K.mut}}>{n}</span></button>)}
      </div>}
      {m.thread && <ThreadPreview th={m.thread} tint={tint} onOpen={() => onOpenThread(m.id)}/>}
    </div>
    <div className="ck-acts" style={{position:'absolute', top:-10, right:16, display:'flex', gap:2, opacity:0, transition:'opacity .15s',
      background:K.card, border:'1px solid ' + K.sep, borderRadius:9, padding:2}}>
      <button onClick={() => { kvib([5]); onReact(m.id, -1); }} title="Add 👍" style={{border:0, background:'none', cursor:'pointer', fontSize:13, padding:'3px 6px', borderRadius:7}} className="ck-hl">👍</button>
      <button onClick={() => { kvib([6]); m.thread ? onOpenThread(m.id) : onStartThread(m.id); }} title={m.thread ? 'Open thread' : 'Start thread'}
        style={{border:0, background:'none', color:K.mut, cursor:'pointer', padding:'3px 6px', borderRadius:7, display:'grid'}} className="ck-hl"><KIcon d={KP.thread} size={14}/></button>
    </div>
  </div>;
}
function Composer({placeholder, onSend, tint, autoFocus}) {
  const [v, setV] = useState('');
  const send = () => { if (!v.trim()) return; kvib([8]); onSend(v.trim()); setV(''); };
  return <div style={{display:'flex', alignItems:'center', gap:8, background:K.card, border:'1px solid ' + K.sep, borderRadius:12, padding:'4px 4px 4px 13px'}}>
    <input value={v} autoFocus={autoFocus} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={placeholder}
      style={{flex:1, minWidth:0, border:0, background:'none', outline:'none', color:K.label, fontSize:13.5, fontFamily:KFONT, padding:'7px 0'}}/>
    <button onClick={send} aria-label="Send" style={{border:0, borderRadius:9, width:32, height:32, background:v.trim() ? tint : K.fill2, color:'#fff',
      cursor:'pointer', display:'grid', placeItems:'center', transition:'background .2s', flexShrink:0}}><KIcon d={KP.send} size={15} sw={2.2}/></button>
  </div>;
}
function ChannelCol({chans, cur, onPick, tint, onClose}) {
  const secs = [];
  Object.entries(chans).forEach(([id, ch]) => {
    let s = secs.find(x => x.name === ch.section);
    if (!s) { s = {name:ch.section, items:[]}; secs.push(s); }
    s.items.push([id, ch]);
  });
  return <div style={{width:222, flexShrink:0, background:K.side, borderRight:'1px solid ' + K.sep, display:'flex', flexDirection:'column', fontFamily:KFONT, height:'100%', boxSizing:'border-box'}}>
    <div style={{display:'flex', alignItems:'center', gap:8, padding:'13px 14px 9px', borderBottom:'1px solid ' + K.sep}}>
      <span style={{fontSize:13.5, fontWeight:800, color:K.label, letterSpacing:'-.1px', flex:1}}>TouchKit HQ</span>
      {onClose ? <button onClick={onClose} aria-label="Close channels" style={{border:0, background:'none', color:K.mut3, cursor:'pointer', padding:4, display:'grid'}}><KIcon d={KP.x} size={14}/></button>
        : <span style={{color:K.mut3, display:'grid'}}><KIcon d={KP.chev} size={13} style={{transform:'rotate(90deg)'}}/></span>}
    </div>
    <div className="ck-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'6px 8px'}}>
      {secs.map(s => <div key={s.name}>
        <div style={{fontSize:10, fontWeight:700, letterSpacing:'.7px', textTransform:'uppercase', color:K.mut3, padding:'11px 8px 4px'}}>{s.name}</div>
        {s.items.map(([id, ch]) => {
          const on = id === cur;
          const threads = ch.msgs.filter(m => m.thread);
          return <div key={id}>
            <button className="ck-hl" onClick={() => { kvib([5]); onPick(id); }}
              style={{display:'flex', alignItems:'center', gap:7, width:'100%', border:0, borderRadius:8, padding:'5px 8px', cursor:'pointer', fontFamily:KFONT,
                background:on ? K.fill2 : 'none', color:on ? K.label : ch.unread ? K.label : K.mut, fontSize:13.5, fontWeight:on || ch.unread ? 650 : 400, textAlign:'left'}}>
              <span style={{color:K.mut3, display:'grid'}}><KIcon d={KP.hash} size={13} sw={2}/></span>
              <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ch.label}</span>
              {ch.unread && !on && <span style={{width:7, height:7, borderRadius:'50%', background:tint}}/>}
            </button>
            {on && threads.map(m => <button key={m.id} className="ck-hl" onClick={() => { kvib([4]); onPick(id, m.id); }}
              style={{display:'flex', alignItems:'center', gap:6, width:'100%', border:0, borderRadius:7, padding:'3px 8px 3px 24px', cursor:'pointer', fontFamily:KFONT,
                background:'none', color:K.mut3, fontSize:12, textAlign:'left'}}>
              <span style={{width:8, height:8, borderLeft:'1.5px solid ' + K.sep, borderBottom:'1.5px solid ' + K.sep, borderRadius:'0 0 0 4px', marginTop:-6, flexShrink:0}}/>
              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.thread.title}</span></button>)}
          </div>; })}
      </div>)}
    </div>
    <div style={{display:'flex', alignItems:'center', gap:8, padding:'9px 12px', borderTop:'1px solid ' + K.sep}}>
      <Ava u="ada" size={26}/>
      <div style={{lineHeight:1.1, flex:1}}><div style={{fontSize:12, fontWeight:700, color:K.label}}>Ada</div>
        <div style={{fontSize:10, color:K.green, fontWeight:600}}>● online</div></div>
      <span style={{color:K.mut3, display:'grid'}}><KIcon d={KP.bell} size={14}/></span>
    </div>
  </div>;
}
/* ── ChatShell — compositional chat scaffold: Rail + Nav collapse into a hamburger drawer below the breakpoint ──
   Slots: Rail · Nav · Main. Slot children are ordinary elements; they read the shell with
   use(ChatShell.Context) (or the useChatShell() hook) instead of taking a ctx argument.
   ctx: {w, compact, navOpen, setNavOpen} — w is the container width, not the viewport. */
const use = React.use || React.useContext;   /* React 19 use(); useContext on 18 */
const ChatShellCtx = React.createContext(null);
const useChatShell = () => use(ChatShellCtx);
function ckSlot(name) { const S = () => null; S.__ckSlot = name; return S; }
function ChatShell({breakpoint = 880, children, style}) {
  const ref = useRef(null);
  const [w, setW] = useState(1200);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => setW(el.offsetWidth));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const compact = w < breakpoint;
  const ctx = {w, compact, navOpen, setNavOpen};
  const slots = {};
  React.Children.forEach(children, c => { if (c && c.type && c.type.__ckSlot) slots[c.type.__ckSlot] = c.props.children; });
  const get = k => { const sl = slots[k]; return sl == null ? null : (typeof sl === 'function' ? sl(ctx) : sl); };
  const railNav = <React.Fragment>{get('rail')}{get('nav')}</React.Fragment>;
  return <ChatShellCtx.Provider value={ctx}>
    <div ref={ref} style={{position:'relative', width:'100%', height:'100%', display:'flex', background:K.bg, color:K.label, overflow:'hidden', fontFamily:KFONT, colorScheme:'dark', ...style}}>
      {!compact && railNav}
      <div style={{flex:1, minWidth:0, minHeight:0, display:'flex'}}>{get('main')}</div>
      {compact && <React.Fragment>
        <div onClick={() => setNavOpen(false)} style={{position:'absolute', inset:0, zIndex:30, background:'rgba(0,0,0,.5)', opacity:navOpen ? 1 : 0, pointerEvents:navOpen ? 'auto' : 'none', transition:'opacity .3s'}}/>
        <div style={{position:'absolute', top:0, bottom:0, left:0, zIndex:31, display:'flex', transform:navOpen ? 'none' : 'translateX(-102%)', transition:'transform .38s ' + KEASE, boxShadow:navOpen ? '0 0 44px rgba(0,0,0,.5)' : 'none'}}>{railNav}</div>
      </React.Fragment>}
    </div>
  </ChatShellCtx.Provider>;
}
ChatShell.Rail = ckSlot('rail');
ChatShell.Nav = ckSlot('nav');
ChatShell.Main = ckSlot('main');
ChatShell.Context = ChatShellCtx;
ChatShell.useShell = useChatShell;

function ChatDemo({tint = '#0A84FF', members: showMembers = true}) {
  const [, bumpTk] = useState(0);
  useEffect(() => {
    if (window.TouchKit) return;
    const i = setInterval(() => { if (window.TouchKit) { clearInterval(i); bumpTk(x => x + 1); } }, 150);
    return () => clearInterval(i);
  }, []);
  const [chans, setChans] = useState(seed);
  const [cur, setCur] = useState('dev');
  const [thread, setThread] = useState({id:'d4', mode:'drawer'});
  const scrollRef = useRef(null);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [cur, chans]);
  const ch = chans[cur];
  const upd = fn => setChans(c => ({...c, [cur]:fn(c[cur])}));
  const updMsg = (id, fn) => upd(c => ({...c, msgs:c.msgs.map(m => m.id === id ? fn(m) : m)}));
  const react = (id, i) => updMsg(id, m => {
    const r = m.reacts.map(x => [...x]);
    if (i === -1) { const j = r.findIndex(x => x[0] === '👍'); if (j >= 0) i = j; else { r.push(['👍', 0, false]); i = r.length - 1; } }
    r[i][2] = !r[i][2]; r[i][1] += r[i][2] ? 1 : -1;
    return {...m, reacts:r.filter(x => x[1] > 0)};
  });
  const startThread = id => { updMsg(id, m => ({...m, thread:{title:m.txt.slice(0, 36) + (m.txt.length > 36 ? '…' : ''), msgs:[]}})); setThread({id, mode:'drawer'}); };
  const sendMain = txt => upd(c => ({...c, msgs:[...c.msgs, {id:'m' + Date.now(), u:'ada', t:'now', txt, reacts:[]}]}));
  const sendThread = txt => updMsg(thread.id, m => ({...m, thread:{...m.thread, msgs:[...m.thread.msgs, {id:'t' + Date.now(), u:'ada', t:'now', txt}]}}));
  const thMsg = thread ? ch.msgs.find(m => m.id === thread.id) : null;
  const threadBody = mode => !thMsg ? null : <div style={{display:'flex', flexDirection:'column', height:'100%', fontFamily:KFONT, maxWidth:mode === 'full' ? 760 : 'none', width:'100%', margin:'0 auto', boxSizing:'border-box'}}>
    <div className="ck-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'4px 0 10px'}}>
      {mode === 'drawer' ? <div style={{padding:'6px 16px 12px', borderBottom:'1px solid ' + K.sep}}>
        <div style={{fontSize:16, fontWeight:750, color:K.label, lineHeight:1.3}}>{thMsg.thread.title}</div>
        <div style={{fontSize:11.5, color:K.mut3, marginTop:3}}>Started by <span style={{color:USERS[thMsg.u].role, fontWeight:600}}>{USERS[thMsg.u].name}</span> in #{ch.label}</div>
      </div> : null}
      <div style={{padding:'10px 4px 0'}}>
        <Msg m={{...thMsg, thread:null}} tint={tint} onReact={react} onOpenThread={() => {}} onStartThread={() => {}}/>
        {thMsg.thread.msgs.length > 0 && <div style={{display:'flex', alignItems:'center', gap:8, padding:'6px 18px', fontSize:10.5, color:K.mut3}}>
          <span style={{flex:1, height:1, background:K.sep}}/>{thMsg.thread.msgs.length} {thMsg.thread.msgs.length === 1 ? 'reply' : 'replies'}<span style={{flex:1, height:1, background:K.sep}}/></div>}
        {thMsg.thread.msgs.map(m => <div key={m.id} style={{animation:'ck-in .2s ' + KEASE}}>
          <Msg m={{...m, reacts:[]}} tint={tint} onReact={() => {}} onOpenThread={() => {}} onStartThread={() => {}}/></div>)}
        {!thMsg.thread.msgs.length && <div style={{padding:'14px 18px', fontSize:12.5, color:K.mut3}}>No replies yet — say something.</div>}
      </div>
    </div>
    <div style={{flexShrink:0, padding:'0 12px 12px'}}>
      <Composer placeholder={'Reply in "' + thMsg.thread.title + '"'} onSend={sendThread} tint={tint} autoFocus={mode === 'drawer'}/>
    </div>
  </div>;
  return <ChatShell breakpoint={880}>
    <ChatShell.Rail><WorkspaceRail tint={tint}/></ChatShell.Rail>
    <ChatShell.Nav><ChannelNav chans={chans} cur={cur} tint={tint}
      onPick={(id, tid) => { setCur(id); setThread(tid ? {id:tid, mode:'full'} : null); }}/></ChatShell.Nav>
    <ChatShell.Main><ChannelMain ch={ch} tint={tint} members={showMembers} thread={thread} setThread={setThread}
      thMsg={thMsg} react={react} startThread={startThread} sendMain={sendMain} scrollRef={scrollRef} threadBody={threadBody}/></ChatShell.Main>
  </ChatShell>;
}

/* ── Slot children read the shell with use(ChatShell.Context) — no render props, no prop drilling ── */
function WorkspaceRail({tint}) {
  return <div style={{width:52, flexShrink:0, background:K.rail, display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'10px 0', borderRight:'1px solid ' + K.sep, boxSizing:'border-box'}}>
    {[['T', tint, true], ['C', '#BF5AF2', false]].map(([l, c, on]) => <button key={l} title={l === 'T' ? 'TouchKit HQ' : 'Creamery'} onClick={() => kvib([5])}
      style={{width:34, height:34, borderRadius:11, border:on ? '2px solid ' + c : '2px solid transparent', background:on ? c : K.fill2, color:'#fff',
        fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:KFONT, flexShrink:0}}>{l}</button>)}
    <button aria-label="Add workspace" onClick={() => kvib([5])} style={{width:34, height:34, borderRadius:11, border:'1px dashed ' + K.sep, background:'none', color:K.mut3, cursor:'pointer', display:'grid', placeItems:'center', flexShrink:0}}><KIcon d={KP.plus} size={14}/></button>
  </div>;
}

function ChannelNav({chans, cur, tint, onPick}) {
  const {compact, setNavOpen} = useChatShell();
  return <ChannelCol chans={chans} cur={cur} tint={tint} onClose={compact ? () => setNavOpen(false) : null}
    onPick={(id, tid) => { onPick(id, tid); setNavOpen(false); }}/>;
}

function ChannelMain({ch, tint, members: showMembers, thread, setThread, thMsg, react, startThread, sendMain, scrollRef, threadBody}) {
  const {w, compact, setNavOpen} = useChatShell();
  const TK = window.TouchKit;
  const fullThread = !!thMsg && thread.mode === 'full';
  const drawerOpen = !!thMsg && thread.mode === 'drawer';
  const drawerMode = w >= 1180 ? 'fixed' : 'overlay';
  const memberCol = showMembers && w >= 1320 && !drawerOpen && !fullThread;
  return <React.Fragment>
    <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:9, padding:'0 16px', height:46, borderBottom:'1px solid ' + K.sep, flexShrink:0}}>
        {compact && <button onClick={() => { kvib([6]); setNavOpen(true); }} aria-label="Channels" style={{border:0, background:'none', color:K.mut, cursor:'pointer', padding:4, display:'grid'}}><KIcon d={KP.menu} size={17} sw={2}/></button>}
        {fullThread
          ? <React.Fragment>
              <button onClick={() => { kvib([5]); setThread(null); }} style={{display:'flex', alignItems:'center', gap:4, border:0, background:'none', color:tint, fontSize:13, fontWeight:650, cursor:'pointer', fontFamily:KFONT, padding:'4px 6px 4px 0', flexShrink:0}}>
                <KIcon d={KP.chev} size={13} style={{transform:'rotate(180deg)'}}/>#{ch.label}</button>
              <span style={{color:K.mut3, display:'grid'}}><KIcon d={KP.thread} size={14}/></span>
              <span style={{fontSize:14, fontWeight:750, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>{thMsg.thread.title}</span>
              <button onClick={() => setThread({id:thread.id, mode:'drawer'})} style={{border:'1px solid ' + K.sep, background:'none', color:K.mut, fontSize:11.5, fontWeight:600, borderRadius:8, padding:'4px 10px', cursor:'pointer', fontFamily:KFONT, flexShrink:0}}>Open as drawer</button>
            </React.Fragment>
          : <React.Fragment>
              <span style={{color:K.mut3, display:'grid'}}><KIcon d={KP.hash} size={15} sw={2.2}/></span>
              <span style={{fontSize:14, fontWeight:750}}>{ch.label}</span>
              <span style={{fontSize:11.5, color:K.mut3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>Sidebar thread → full view · preview card → SideDrawer</span>
              <button onClick={() => kvib([5])} aria-label="Members" style={{border:0, background:'none', color:memberCol ? tint : K.mut3, cursor:'pointer', padding:4, display:'grid'}}><KIcon d={KP.people} size={16}/></button>
            </React.Fragment>}
      </div>
      {fullThread ? <div style={{flex:1, minHeight:0}}>{threadBody('full')}</div>
        : <React.Fragment>
            <div ref={scrollRef} className="ck-scroll" style={{flex:1, minHeight:0, overflowY:'auto', padding:'12px 0', position:'relative'}}>
              <div style={{padding:'0 18px 10px'}}>
                <div style={{width:40, height:40, borderRadius:12, background:K.fill2, display:'grid', placeItems:'center', color:K.mut, marginBottom:8}}><KIcon d={KP.hash} size={20} sw={2.2}/></div>
                <div style={{fontSize:15.5, fontWeight:750}}>Welcome to #{ch.label}</div>
                <div style={{fontSize:12, color:K.mut3, marginTop:2}}>Hover a message to react or start a thread.</div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8, padding:'4px 18px 8px', fontSize:10.5, color:K.mut3, fontWeight:600}}>
                <span style={{flex:1, height:1, background:K.sep}}/>August 12, 2026<span style={{flex:1, height:1, background:K.sep}}/></div>
              {ch.msgs.map(m => <Msg key={m.id} m={m} tint={tint} onReact={react} onOpenThread={id => { kvib([6]); setThread({id, mode:'drawer'}); }} onStartThread={startThread}/>)}
            </div>
            <div style={{flexShrink:0, padding:'0 14px 12px'}}>
              <Composer placeholder={'Message #' + ch.label} onSend={sendMain} tint={tint}/>
            </div>
          </React.Fragment>}
    </div>
    {memberCol ? <div style={{width:168, flexShrink:0, borderLeft:'1px solid ' + K.sep, background:K.side, padding:'12px 12px', boxSizing:'border-box'}}>
      <div style={{fontSize:10, fontWeight:700, letterSpacing:'.7px', textTransform:'uppercase', color:K.mut3, marginBottom:8}}>Team — {Object.keys(USERS).length}</div>
      {Object.entries(USERS).map(([id, u]) => <div key={id} style={{display:'flex', alignItems:'center', gap:8, padding:'4px 0'}}>
        <Ava u={id} size={24} square={u.bot}/>
        <span style={{fontSize:12.5, color:u.role, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{u.name}</span>
        {u.bot && <span style={{fontSize:8.5, fontWeight:800, background:'#5E5CE6', color:'#fff', borderRadius:4, padding:'1px 4px'}}>APP</span>}
      </div>)}
    </div> : null}
    {TK && TK.SideDrawer
      ? <TK.SideDrawer mode={drawerMode} open={drawerOpen} onClose={() => setThread(null)} title="Thread" width={Math.min(360, w - 60)}>
          <div style={{'--tk-label':K.label, '--tk-label2':K.mut, '--tk-sep':K.sep, height:'100%', boxSizing:'border-box'}}>{threadBody('drawer')}</div>
        </TK.SideDrawer>
      : (drawerOpen ? <div style={{width:340, flexShrink:0, borderLeft:'1px solid ' + K.sep, background:K.side}}>{threadBody('drawer')}</div> : null)}
  </React.Fragment>;
}

const TouchKitChat = {ChatDemo, ChatShell, useChatShell, use};
window.TouchKitChat = TouchKitChat;
if (typeof module !== 'undefined') module.exports = {ChatDemo, ChatShell, useChatShell, TouchKitChat};
