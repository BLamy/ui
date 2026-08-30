/* Contacts — the TouchKit demo app, recomposed from the distributable @touchkit/ui package.
   Same tree as the prototype: SplitView / NavigationStack / TabBar nest to produce behavior. */
import React from 'react';
import {
  TouchKitProvider, Haptics, Icon, Avatar, SearchField, ListSection, ListRow,
  IndexBar, TabBar, EditBar, NavigationStack, SplitView, Credenza, SideDrawer,
  HapticIndicator, HapticsPlayground, BARH,
} from '@touchkit/ui';
import {
  AL, CONTACTS, GROUPS, RECENTS, Contact,
} from './data';
import {
  AppSidebar, DetailView, RingtonePick, AboutView, SettingsView, ActivityView, ShareViews, SHARE_T,
} from './views';

const { useState, useEffect, useLayoutEffect, useRef } = React;

export interface ContactsAppProps {
  composition?: 'nav-in-tabs' | 'tabs-in-nav';
  listStyle?: 'plain' | 'grouped';
  dark?: boolean;
  tint?: string;
  indicator?: boolean;
  safeTop?: number | boolean;
}

export function ContactsApp(props: ContactsAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const secEls = useRef<Record<string, HTMLElement>>({});
  const safeIns = props.safeTop === true ? 59 : Number(props.safeTop) || 0;
  const [wc, setWc] = useState('regular');
  const [tab, setTab] = useState('contacts');
  const [sel, setSel] = useState<string | null>(null);
  const [ring, setRing] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const [filter, setFilter] = useState<any>({ type: 'all' });
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);
  const [pick, setPick] = useState(() => new Set<string>());
  const [act, setAct] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const [xw, setXw] = useState(false);
  const [listStyle, setListStyle] = useState(props.listStyle === 'grouped' ? 'grouped' : 'plain');
  const [comp, setComp] = useState(props.composition === 'tabs-in-nav' ? 'tabs-in-nav' : 'nav-in-tabs');
  const [dark, setDark] = useState(!!props.dark);
  const [tint, setTint] = useState(props.tint || '#0A84FF');
  const [hap, setHap] = useState(true);
  const [ind, setInd] = useState(!!props.indicator);
  const [favs, setFavs] = useState(() => new Set(CONTACTS.filter(c => c.fav).map(c => c.id)));
  const [gone, setGone] = useState(() => new Set<string>());
  const [tones, setTones] = useState<Record<string, string>>({});
  useEffect(() => { setComp(props.composition === 'tabs-in-nav' ? 'tabs-in-nav' : 'nav-in-tabs'); }, [props.composition]);
  useEffect(() => { setDark(!!props.dark); }, [props.dark]);
  useEffect(() => { if (props.tint) setTint(props.tint); }, [props.tint]);
  useEffect(() => { setInd(!!props.indicator); }, [props.indicator]);
  useEffect(() => { setListStyle(props.listStyle === 'grouped' ? 'grouped' : 'plain'); }, [props.listStyle]);
  useEffect(() => { Haptics.boot(); }, []);
  useEffect(() => { Haptics.enabled = hap; }, [hap]);
  useLayoutEffect(() => {
    const el = rootRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(en => { const w = en[0].contentRect.width; setWc(w < 640 ? 'compact' : w < 1024 ? 'medium' : 'regular'); setXw(w >= 1280); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const collapsed = wc !== 'regular';
  const alive = CONTACTS.filter(c => !gone.has(c.id));
  const counts = {
    all: alive.length, fav: alive.filter(c => favs.has(c.id)).length, rec: alive.filter(c => RECENTS.has(c.id)).length,
    groups: GROUPS.reduce((a: Record<string, number>, g) => { a[g.name] = alive.filter(c => c.g === g.name).length; return a; }, {}),
  };
  const matchF = (c: Contact) => filter.type === 'all' ? true : filter.type === 'fav' ? favs.has(c.id) : filter.type === 'rec' ? RECENTS.has(c.id) : c.g === filter.g;
  const ql = q.trim().toLowerCase();
  const matchQ = (c: Contact) => !ql || (c.f + ' ' + c.l + ' ' + c.com + ' ' + c.role).toLowerCase().includes(ql);
  const visible = alive.filter(c => matchF(c) && matchQ(c));
  const sections = AL.map(L => ({ L, items: visible.filter(c => c.l[0].toUpperCase() === L) })).filter(s => s.items.length);
  const avail = new Set(sections.map(s => s.L));
  const selC = sel ? visible.concat(alive).find(c => c.id === sel) || null : null;
  const listTitle = filter.type === 'all' ? 'Contacts' : filter.type === 'fav' ? 'Favorites' : filter.type === 'rec' ? 'Recents' : filter.g;
  const selN = pick.size;
  const jump = (L: string) => {
    const i = AL.indexOf(L); let t: string | null = null;
    for (let j = i; j >= 0; j--) if (avail.has(AL[j])) { t = AL[j]; break; }
    if (!t) for (let j = i + 1; j < AL.length; j++) if (avail.has(AL[j])) { t = AL[j]; break; }
    const el = t && secEls.current[t]; if (!el) return;
    const s = el.closest('.tk-scroll'); if (!s) return;
    s.scrollTop = s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top - BARH - safeIns + 1;
  };
  const togglePick = (id: string) => { const n = new Set(pick); n.has(id) ? n.delete(id) : n.add(id); setPick(n); Haptics.selection(); };
  const delOne = (id: string) => { setGone(g => new Set([...g, id])); if (sel === id) setSel(null); };
  const exitEdit = () => { setEdit(false); setPick(new Set()); };
  const popContacts = () => { if (ring) setRing(false); else if (act && wc === 'compact') setAct(false); else setSel(null); };
  const popActive = () => { if (tab === 'contacts') popContacts(); else setSub(null); };
  const grouped = listStyle === 'grouped';
  const listContent = <div style={{ padding: grouped ? '0 16px' : 0 }}>
    {sections.length === 0 ? <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--tk-label2)', fontSize: 15 }}>No results{ql ? ' for “' + q + '”' : ''}</div> : null}
    {sections.map(s => <ListSection key={s.L} sticky={!grouped} title={s.L} innerRef={(el: HTMLElement | null) => { if (el) secEls.current[s.L] = el; }}>
      {s.items.map((c, i) => <ListRow key={c.id} rowRole="option"
        title={<span>{c.f} <span style={{ fontWeight: 600 }}>{c.l}</span></span>}
        subtitle={c.role + (c.com ? ' · ' + c.com : '')}
        leading={<Avatar c={c} />}
        trailing={favs.has(c.id) ? <Icon name="starF" size={13} style={{ color: '#FF9F0A' }} /> : null}
        accessory={edit ? undefined : 'chevron'}
        edit={edit} checked={pick.has(c.id)} selected={!collapsed && sel === c.id && !edit}
        onPress={() => { if (edit) togglePick(c.id); else { Haptics.selection(); setSel(c.id); setRing(false); } }}
        onDelete={edit ? undefined : () => delOne(c.id)}
        divider={i < s.items.length - 1} />)}
    </ListSection>)}
    {sections.length ? <div style={{ padding: '16px 0 4px', textAlign: 'center', fontSize: 14.5, color: 'var(--tk-label2)' }}>
      {visible.length} Contact{visible.length === 1 ? '' : 's'}{gone.size ? ' · pull down to restore ' + gone.size + ' deleted' : ''}</div> : null}
  </div>;
  const listScreen: any = {
    key: 'list', title: edit ? (selN ? selN + ' Selected' : 'Select Contacts') : listTitle, largeTitle: true, grouped,
    subheader: <SearchField q={q} setQ={setQ} />,
    leading: collapsed ? <button className="tk-btn" onClick={() => { setDrawer(true); Haptics.impact('light'); }} aria-label="Show sidebar"
      style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--tk-tint)', display: 'grid', padding: '8px 10px' }}>
      <Icon name="sidebar" size={22} sw={1.9} /></button> : null,
    trailing: <button className="tk-btn" onClick={() => { edit ? exitEdit() : setEdit(true); Haptics.impact('light'); }}
      style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--tk-tint)', fontFamily: 'inherit', fontSize: 17, fontWeight: edit ? 700 : 400, padding: '8px 10px' }}>{edit ? 'Done' : 'Select'}</button>,
    content: listContent,
    overlay: <IndexBar avail={avail} onLetter={jump} top={BARH + 4 + safeIns} bottom={collapsed ? 74 : 10} />,
    onRefresh: () => { if (gone.size) { setGone(new Set()); Haptics.notification('success'); } },
  };
  const detailScreen: any = selC ? {
    key: 'detail', title: selC.f + ' ' + selC.l, titleOnScroll: true, grouped: true, maxW: 640,
    trailing: <button className="tk-btn" aria-label="Contact activity" onClick={() => { Haptics.impact('light'); setAct(a => !a); }}
      style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--tk-tint)', display: 'grid', padding: '8px 10px' }}>
      <Icon name="clock" size={22} sw={2} /></button>,
    content: <DetailView c={selC} fav={favs.has(selC.id)} ringtone={tones[selC.id] || 'Reflection'}
      onFav={v => { const n = new Set(favs); v ? n.add(selC.id) : n.delete(selC.id); setFavs(n); }}
      onRing={() => setRing(true)}
      onShare={() => { Haptics.impact('light'); setShare('menu'); }}
      onDelete={() => delOne(selC.id)} />,
  } : null;
  const ringScreen: any = selC && ring ? {
    key: 'ring', title: 'Ringtone', grouped: true, maxW: 640,
    content: <RingtonePick value={tones[selC.id] || 'Reflection'} onPick={r => setTones({ ...tones, [selC.id]: r })} />,
  } : null;
  const activityScreen: any = selC && act && wc === 'compact' ? {
    key: 'activity', title: 'Activity', grouped: true, maxW: 640, content: <ActivityView c={selC} />,
  } : null;
  const goShare = (v: string) => { if (v === 'done') Haptics.notification('success'); else Haptics.selection(); setShare(v); };
  const settingsScreen: any = {
    key: 'settings', title: 'Settings', largeTitle: true, grouped: true, maxW: 660,
    content: <SettingsView s={{ comp, setComp, listStyle, setListStyle, hap, setHap, ind, setInd, dark, setDark, tint, setTint, openAbout: () => setSub('about'), openPlay: () => setSub('play') }} />,
  };
  const aboutScreen: any = sub === 'about' ? { key: 'about', title: 'About TouchKit', grouped: true, maxW: 660, content: <AboutView /> } : null;
  const playScreen: any = sub === 'play' ? { key: 'play', title: 'Haptics Playground', grouped: true, maxW: 660, content: <HapticsPlayground /> } : null;
  const contactsScreens = [listScreen, ...(collapsed && detailScreen ? [detailScreen] : []), ...(collapsed && activityScreen ? [activityScreen] : []), ...(collapsed && ringScreen ? [ringScreen] : [])];
  const settingsScreens = [settingsScreen, ...(playScreen ? [playScreen] : []), ...(aboutScreen ? [aboutScreen] : [])];
  const barItems = [{ id: 'contacts', title: 'Contacts', icon: 'person' }, { id: 'settings', title: 'Settings', icon: 'sliders' }];
  const switchTab = (id: string) => { setTab(id); if (edit) exitEdit(); };
  const sidebarEl = <AppSidebar wc={wc} tab={tab} onTab={switchTab} filter={filter} counts={counts} drawer={collapsed}
    groups={GROUPS} onClose={() => setDrawer(false)}
    onFilter={f => { setFilter(f); setTab('contacts'); setSel(null); if (collapsed) setDrawer(false); Haptics.selection(); }} />;
  const editBarEl = <EditBar count={selN} allFav={selN > 0 && [...pick].every(id => favs.has(id))}
    onFav={() => {
      const all = [...pick].every(id => favs.has(id)); const n = new Set(favs);
      pick.forEach(id => { all ? n.delete(id) : n.add(id); }); setFavs(n); Haptics.impact('light');
    }}
    onDelete={() => { setGone(g => new Set([...g, ...pick])); if (sel && pick.has(sel)) setSel(null); setPick(new Set()); Haptics.notification('warning'); }} />;
  let body: React.ReactNode;
  if (!collapsed) {
    body = tab === 'contacts'
      ? <SplitView wc={wc} sidebar={sidebarEl}
        master={<React.Fragment>
          <NavigationStack screens={[listScreen]} onPop={() => { }} />
          {edit ? editBarEl : null}
        </React.Fragment>}
        detail={<div style={{ display: 'flex', height: '100%', minWidth: 0 }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            {detailScreen
              ? <NavigationStack screens={[detailScreen, ...(ringScreen ? [ringScreen] : [])]} onPop={() => setRing(false)} />
              : <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'grid', placeItems: 'center', color: 'var(--tk-label3)', marginBottom: 10 }}><Icon name="person" size={52} sw={1.2} /></div>
                  <div style={{ fontSize: 16, color: 'var(--tk-label2)' }}>No Contact Selected</div>
                  <div style={{ fontSize: 13, color: 'var(--tk-label3)', marginTop: 4 }}>Choose a contact from the list</div>
                </div>
              </div>}
          </div>
          <SideDrawer mode="fixed" open={!!(xw && act && selC)} onClose={() => setAct(false)} title="Activity" width={318}>
            {selC ? <ActivityView c={selC} /> : null}
          </SideDrawer>
        </div>} />
      : <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: 264, flexShrink: 0, borderRight: '1px solid var(--tk-sep)', background: 'var(--tk-side)', transition: 'background .25s' }}>{sidebarEl}</div>
        <div style={{ flex: 1, position: 'relative', background: 'var(--tk-bg2)', minWidth: 0 }}>
          <NavigationStack screens={settingsScreens} onPop={popActive} />
        </div>
      </div>;
  } else if (comp === 'nav-in-tabs') {
    const screens = (tab === 'contacts' ? contactsScreens : settingsScreens).map(s => ({ ...s, bottomInset: 66 }));
    body = <React.Fragment>
      <SplitView wc={wc} sidebar={sidebarEl} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}
        master={<NavigationStack screens={screens} onPop={popActive} />} />
      {edit && tab === 'contacts' ? editBarEl : <TabBar items={barItems} selected={tab} onSelect={switchTab} />}
    </React.Fragment>;
  } else {
    const stack = tab === 'contacts' ? contactsScreens : settingsScreens;
    const root = {
      ...stack[0], key: 'tabroot', bottomInset: 66,
      overlay: <React.Fragment>{stack[0].overlay || null}{edit && tab === 'contacts' ? editBarEl : <TabBar items={barItems} selected={tab} onSelect={switchTab} />}</React.Fragment>,
    };
    body = <SplitView wc={wc} sidebar={sidebarEl} drawerOpen={drawer} onCloseDrawer={() => setDrawer(false)}
      master={<NavigationStack screens={[root, ...stack.slice(1)]} onPop={popActive} />} />;
  }
  return <div ref={rootRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
    <TouchKitProvider dark={dark} tint={tint} safeTop={safeIns}>
      {body}
      {!xw && tab === 'contacts' ? <SideDrawer mode="overlay" open={!!(act && selC && wc !== 'compact')} onClose={() => setAct(false)} title="Activity" width={340}>
        {selC ? <ActivityView c={selC} /> : null}
      </SideDrawer> : null}
      <Credenza open={!!(share && selC)} compact={wc === 'compact'} view={share || 'menu'} title={SHARE_T[share || 'menu'] || 'Share Contact'}
        canBack={share === 'qr' || share === 'vcard'} onBack={() => goShare('menu')} onClose={() => setShare(null)}>
        {selC ? <ShareViews c={selC} view={share || 'menu'} go={goShare} onClose={() => setShare(null)} /> : null}
      </Credenza>
      <HapticIndicator visible={ind} bottom={collapsed ? 74 : 14} />
    </TouchKitProvider>
  </div>;
}

export default ContactsApp;
