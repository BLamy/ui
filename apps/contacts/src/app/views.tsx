/* Contacts demo views — composed entirely from the @touchkit/ui public API. */
import React from 'react';
import {
  Haptics, Icon, Avatar, Switch, List, ListSection, ListRow, PillButton, QRSvg,
} from '@touchkit/ui';
import { Contact, NOTES, RINGTONES, TINTS } from './data';


const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

export function sq(color: string, icon: string) {
  return <span style={{ width: 29, height: 29, borderRadius: 7, background: color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
    <Icon name={icon} size={17} sw={2} style={{ color: '#fff' }} /></span>;
}
export function Card({ children, mb }: { children?: React.ReactNode; mb?: number }) {
  return <div style={{ background: 'var(--tk-card)', borderRadius: 12, overflow: 'hidden', marginBottom: mb == null ? 18 : mb }}>{children}</div>;
}
export function Field({ k, v, tint, last }: { k: string; v: React.ReactNode; tint?: boolean; last?: boolean }) {
  return <div style={{ padding: '9px 16px', boxShadow: last ? 'none' : 'inset 0 -1px 0 var(--tk-sep)' }}>
    <div style={{ fontSize: 12.5, color: 'var(--tk-label2)' }}>{k}</div>
    <div style={{ fontSize: 16.5, color: tint ? 'var(--tk-tint)' : 'var(--tk-label)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
  </div>;
}

export function DetailView({ c, fav, onFav, ringtone, onRing, onDelete, onShare }: {
  c: Contact | null; fav: boolean; onFav: (v: boolean) => void; ringtone: string;
  onRing: () => void; onDelete: () => void; onShare: () => void;
}) {
  if (!c) return null;
  return <div style={{ padding: '0 16px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 0 18px' }}>
      <Avatar c={c} size={92} />
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 12, letterSpacing: '-.3px' }}>{c.f} {c.l}</div>
      <div style={{ fontSize: 14.5, color: 'var(--tk-label2)', marginTop: 3 }}>{c.role}{c.com ? ' · ' + c.com : ''}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, width: '100%', maxWidth: 430 }}>
        {([['message', 'Message'], ['phone', 'Call'], ['video', 'Video'], ['mail', 'Mail']] as const).map(a =>
          <button key={a[0]} className="tk-btn tk-hl" onClick={() => Haptics.impact('light')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '11px 0 9px', border: 0, borderRadius: 12, background: 'var(--tk-card)', color: 'var(--tk-tint)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Icon name={a[0]} size={20} /><span style={{ fontSize: 11.5 }}>{a[1]}</span>
          </button>)}
      </div>
    </div>
    <Card>
      <Field k="mobile" v={c.ph} tint />
      <Field k="email" v={c.em} tint last={!c.g} />
      {c.g ? <Field k="group" v={c.g} last /> : null}
    </Card>
    <Card><ListRow title="Ringtone" accessory="chevron" onPress={onRing}
      trailing={<span style={{ fontSize: 16, color: 'var(--tk-label2)' }}>{ringtone}</span>} />
      <ListRow title="Share Contact" accessory="chevron" onPress={onShare} divider={false}
        trailing={<span style={{ fontSize: 13, color: 'var(--tk-label3)' }}>Credenza</span>} /></Card>
    {NOTES[c.id] ? <Card><div style={{ padding: '10px 16px 12px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--tk-label2)', marginBottom: 3 }}>Notes</div>
      <div style={{ fontSize: 15.5, lineHeight: 1.45 }}>{NOTES[c.id]}</div></div></Card> : null}
    <Card><ListRow title="Favorite" divider={false}
      leading={<Icon name={fav ? 'starF' : 'star'} size={21} style={{ color: fav ? '#FF9F0A' : 'var(--tk-label3)' }} />}
      trailing={<Switch checked={fav} onChange={onFav} />} /></Card>
    <Card><ListRow title="Delete Contact" center destructive onPress={onDelete} divider={false} /></Card>
  </div>;
}

export function RingtonePick({ value, onPick }: { value: string; onPick: (r: string) => void }) {
  return <List inset><ListSection footer="Selection ticks fire through Haptics.selection() — the same call the A–Z index uses.">
    {RINGTONES.map((r, i) => <ListRow key={r} title={r} accessory="check" checked={value === r} rowRole="option"
      onPress={() => { onPick(r); Haptics.selection(); }} divider={i < RINGTONES.length - 1} />)}
  </ListSection></List>;
}

export function AboutView() {
  const map = [
    ['UINavigationController', '<NavigationStack> — push, pop, edge-swipe back'],
    ['UISplitViewController', '<SplitView> — collapses columns into the stack'],
    ['UITabBarController', '<TabBar> — nest it anywhere in the tree'],
    ['UITableView', '<List> · <Section sticky> · <Row swipeable>'],
    ['Section index titles', '<IndexBar> — haptic tick per letter'],
    ['Sheets / trays', '<Credenza> — dialog ⇄ tray, morphing states'],
    ['Inspector column', '<SideDrawer> — fixed · overlay · pushed page'],
    ['UIFeedbackGenerator', 'Haptics.impact / .selection / .notification'],
  ];
  return <List inset>
    <div style={{ padding: '2px 4px 18px', fontSize: 15.5, lineHeight: 1.5, color: 'var(--tk-label2)' }}>
      TouchKit ports Cocoa Touch's container controllers to JSX. Like Android XML views, the tree is the behavior —
      nest containers differently and navigation changes, no mode flags. One haptics engine drives every interaction.</div>
    <ListSection title="Dictionary">
      {map.map((m, i) => <div key={m[0]} style={{ padding: '9px 16px', background: 'var(--tk-card)', boxShadow: i < map.length - 1 ? 'inset 0 -1px 0 var(--tk-sep)' : 'none' }}>
        <div style={{ fontSize: 12.5, color: 'var(--tk-label2)' }}>{m[0]}</div>
        <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13.5, color: 'var(--tk-tint)', marginTop: 2 }}>{m[1]}</div>
      </div>)}
    </ListSection>
    <ListSection title="Semantics" footer="Rows are real buttons with listbox roles, arrow-key navigation, Esc pops the stack, visible focus rings — the react-aria interaction model.">
      <ListRow title="Version" trailing={<span style={{ color: 'var(--tk-label2)', fontSize: 16 }}>0.1.0</span>} divider={false} />
    </ListSection>
  </List>;
}

export interface SettingsState {
  comp: string; setComp: (v: string) => void; listStyle: string; setListStyle: (v: string) => void;
  hap: boolean; setHap: (v: boolean) => void; ind: boolean; setInd: (v: boolean) => void;
  dark: boolean; setDark: (v: boolean) => void; tint: string; setTint: (v: string) => void;
  openAbout: () => void; openPlay: () => void;
}
export function SettingsView({ s }: { s: SettingsState }) {
  const tests: [string, () => void][] = [
    ['Impact · Light', () => Haptics.impact('light')],
    ['Impact · Medium', () => Haptics.impact('medium')],
    ['Impact · Heavy', () => Haptics.impact('heavy')],
    ['Selection tick', () => Haptics.selection()],
    ['Notification · Success', () => Haptics.notification('success')],
    ['Notification · Warning', () => Haptics.notification('warning')],
    ['Notification · Error', () => Haptics.notification('error')],
  ];
  return <List inset>
    <ListSection title="Composition" footer="TouchKit has no tab-bar mode flag — behavior falls out of how containers nest in JSX. This switch remounts the demo with the other tree; state survives.">
      <ListRow leading={sq('#5E5CE6', 'layers')} title="NavigationStack inside TabView" subtitle="Bar persists — each tab keeps its stack"
        accessory="check" checked={s.comp === 'nav-in-tabs'} onPress={() => { s.setComp('nav-in-tabs'); Haptics.impact('light'); }} />
      <ListRow leading={sq('#0A84FF', 'layers')} title="TabView inside NavigationStack" subtitle="Bar rides the root view — pushes cover it"
        accessory="check" checked={s.comp === 'tabs-in-nav'} onPress={() => { s.setComp('tabs-in-nav'); Haptics.impact('light'); }} divider={false} />
    </ListSection>
    <ListSection title="Contacts table view" footer="UITableView styles: .plain keeps sticky letter headers; .insetGrouped floats each letter section as a card.">
      <ListRow leading={sq('#30B0C7', 'layers')} title="Plain" subtitle="Edge-to-edge rows, sticky headers"
        accessory="check" checked={s.listStyle === 'plain'} onPress={() => { s.setListStyle('plain'); Haptics.selection(); }} />
      <ListRow leading={sq('#34C759', 'layers')} title="Grouped" subtitle="Inset card sections"
        accessory="check" checked={s.listStyle === 'grouped'} onPress={() => { s.setListStyle('grouped'); Haptics.selection(); }} divider={false} />
    </ListSection>
    <ListSection title="Haptics">
      <ListRow leading={sq('#FF9F0A', 'wave')} title="Haptics" trailing={<Switch checked={s.hap} onChange={s.setHap} />} />
      <ListRow leading={sq('#8E8E93', 'pulse')} title="Pulse indicator" subtitle="Visualize haptic events on-screen"
        trailing={<Switch checked={s.ind} onChange={s.setInd} />} />
      <ListRow leading={sq('#BF5AF2', 'wave')} title="Haptics Playground" subtitle="Sliders · slide to unlock · timer wheels"
        accessory="chevron" onPress={() => { s.openPlay(); Haptics.impact('light'); }} divider={false} />
    </ListSection>
    <ListSection title="Test patterns" footer={'Engine here: ' + Haptics.engine + '. Pulses appear on-screen while the indicator is on.'}>
      {tests.map((t, i) => <ListRow key={t[0]} title={t[0]} onPress={t[1]} divider={i < tests.length - 1}
        trailing={<Icon name="wave" size={19} sw={2} style={{ color: 'var(--tk-tint)' }} />} />)}
    </ListSection>
    <ListSection title="Appearance">
      <ListRow leading={sq('#3A3A3C', 'moon')} title="Dark Mode" trailing={<Switch checked={s.dark} onChange={s.setDark} />} />
      <ListRow leading={sq(s.tint, 'drop')} title="Tint" divider={false} trailing={
        <span style={{ display: 'flex', gap: 8 }}>{TINTS.map(c =>
          <button key={c} className="tk-btn" onClick={() => { s.setTint(c); Haptics.selection(); }} aria-label={'Tint ' + c}
            style={{ width: 24, height: 24, borderRadius: '50%', border: 0, cursor: 'pointer', background: c, padding: 0, boxShadow: s.tint === c ? ('0 0 0 2px var(--tk-card), 0 0 0 4px ' + c) : 'none', transition: 'box-shadow .15s' }} />)}</span>} />
    </ListSection>
    <ListSection title="About">
      <ListRow leading={sq('#0A84FF', 'info')} title="About TouchKit" accessory="chevron" onPress={s.openAbout} divider={false} />
    </ListSection>
  </List>;
}

export function ActivityView({ c }: { c: Contact }) {
  const base: [string, string, string][] = [
    ['phone', 'Outgoing call', '2 min · yesterday'], ['message', 'iMessage', '“see you at 6” · yesterday'],
    ['video', 'FaceTime', '12 min · Mon'], ['mail', 'Mail', 'Re: schedule · Mon'],
    ['phone', 'Missed call', 'Sun'], ['message', 'iMessage', 'photo · Sat'],
    ['phone', 'Incoming call', '6 min · Fri'], ['mail', 'Mail', 'Invite · last week'],
  ];
  const h = hue(c.f + c.l); const n = 4 + (h % 4);
  const rows = Array.from({ length: n }, (_, i) => base[(h + i * 3 + i * i) % base.length]);
  return <div style={{ padding: '4px 14px 18px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px 14px' }}>
      <Avatar c={c} size={34} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{c.f} {c.l}</div>
        <div style={{ fontSize: 12, color: 'var(--tk-label2)' }}>Last 30 days</div>
      </div>
    </div>
    <div style={{ background: 'var(--tk-card)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 0 1px var(--tk-sep)' }}>
      {rows.map((r, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', boxShadow: i < rows.length - 1 ? 'inset 0 -1px 0 var(--tk-sep)' : 'none' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--tk-fill)', display: 'grid', placeItems: 'center', color: 'var(--tk-tint)', flexShrink: 0 }}><Icon name={r[0]} size={16} sw={2} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{r[1]}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--tk-label2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[2]}</span>
        </span>
      </div>)}
    </div>
    {NOTES[c.id] ? <div style={{ marginTop: 14, background: 'var(--tk-card)', borderRadius: 12, padding: '10px 13px', boxShadow: '0 0 0 1px var(--tk-sep)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--tk-label2)', marginBottom: 4 }}>Notes</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{NOTES[c.id]}</div>
    </div> : null}
    <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--tk-label3)', lineHeight: 1.5, padding: '0 2px' }}>Same panel, three hosts — fixed column at 1280px+, overlay sheet on desktop &amp; tablet, pushed page on phone.</div>
  </div>;
}

export const SHARE_T: Record<string, string> = { menu: 'Share Contact', qr: 'QR Code', vcard: 'Export vCard', done: 'Shared' };
export function ShareViews({ c, view, go, onClose }: { c: Contact; view: string; go: (v: string) => void; onClose: () => void }) {
  const opt = (icon: string, t: string, d: string, fn: () => void) => <button key={t} className="tk-btn tk-hl" onClick={fn}
    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 0, textAlign: 'left', background: 'var(--tk-fill)', borderRadius: 14, padding: '11px 12px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--tk-label)', boxSizing: 'border-box' }}>
    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--tk-card)', display: 'grid', placeItems: 'center', color: 'var(--tk-tint)', boxShadow: '0 0 0 1px var(--tk-sep)', flexShrink: 0 }}><Icon name={icon} size={18} sw={2} /></span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600 }}>{t}</span>
      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--tk-label2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span></span>
    <Icon name="chev" size={14} sw={2.6} style={{ color: 'var(--tk-label3)' }} />
  </button>;
  if (view === 'qr') return <div style={{ padding: '12px 20px 20px', textAlign: 'center' }}>
    <div style={{ display: 'inline-grid', placeItems: 'center', padding: 16, borderRadius: 20, background: '#fff', color: '#111', boxShadow: '0 0 0 1px var(--tk-sep)' }}>
      <QRSvg seed={c.id} /></div>
    <div style={{ fontSize: 13, color: 'var(--tk-label2)', margin: '12px 0 14px', lineHeight: 1.45 }}>Scanning adds {c.f} {c.l} — name, {c.ph}, and email.</div>
    <PillButton label="Save to Photos" onPress={() => go('done')} />
  </div>;
  if (view === 'vcard') return <div style={{ padding: '12px 16px 16px' }}>
    <div style={{ borderRadius: 14, background: 'var(--tk-fill)', padding: '2px 0', marginBottom: 12 }}>
      {[['Name', c.f + ' ' + c.l], ['Mobile', c.ph], ['Email', c.em], ['Group', c.g || '—']].map((f, i) =>
        <div key={f[0]} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 14px', boxShadow: i < 3 ? 'inset 0 -1px 0 var(--tk-sep)' : 'none' }}>
          <span style={{ fontSize: 13.5, color: 'var(--tk-label2)', flexShrink: 0 }}>{f[0]}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f[1]}</span></div>)}
    </div>
    <div style={{ fontSize: 12.5, color: 'var(--tk-label2)', margin: '0 2px 12px' }}>Everything on the card ships in one .vcf file.</div>
    <PillButton label={'Export ' + c.f + '.vcf'} onPress={() => go('done')} />
  </div>;
  if (view === 'done') return <div style={{ padding: '18px 20px 22px', textAlign: 'center' }}>
    <span style={{ display: 'inline-grid', placeItems: 'center', width: 54, height: 54, borderRadius: '50%', background: 'var(--tk-green)', color: '#fff', marginBottom: 10 }}><Icon name="check" size={26} sw={3} /></span>
    <div style={{ fontSize: 17, fontWeight: 700 }}>Card shared</div>
    <div style={{ fontSize: 13, color: 'var(--tk-label2)', margin: '4px 0 16px' }}>{c.f} {c.l} is on the way.</div>
    <PillButton label="Done" onPress={onClose} />
  </div>;
  return <div style={{ padding: '10px 16px 14px' }}>
    <div style={{ fontSize: 13, color: 'var(--tk-label2)', margin: '0 2px 10px' }}>Pick how to share {c.f}’s card.</div>
    {opt('pulse', 'QR Code', 'Scan in person', () => go('qr'))}
    {opt('mail', 'Export vCard', 'Send the .vcf anywhere', () => go('vcard'))}
    {opt('message', 'Copy Link', 'touchkit.app/c/' + c.id, () => go('done'))}
  </div>;
}

export function AppSidebar({ wc, tab, onTab, filter, onFilter, counts, drawer, onClose, groups }: {
  wc: string; tab: string; onTab: (t: string) => void; filter: any; onFilter: (f: any) => void;
  counts: { all: number; fav: number; rec: number; groups: Record<string, number> };
  drawer: boolean; onClose: () => void; groups: { name: string; color: string }[];
}) {
  const row = (id: string, icon: string | null, label: string, count: number | null, selected: boolean, onClick: () => void, dot?: string) =>
    <button key={id} className="tk-btn" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 0, borderRadius: 9, background: selected ? 'var(--tk-press)' : 'transparent', color: 'var(--tk-label)', fontFamily: 'inherit', fontSize: 15.5, cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}>
      {dot ? <span style={{ width: 11, height: 11, borderRadius: '50%', background: dot, flexShrink: 0, margin: '0 4px' }} />
        : <Icon name={icon!} size={19} sw={2} style={{ color: 'var(--tk-tint)' }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null ? <span style={{ fontSize: 13.5, color: 'var(--tk-label3)' }}>{count}</span> : null}
    </button>;
  const sec = (t: string) => <div style={{ padding: '16px 10px 5px', fontSize: 11.5, fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--tk-label2)' }}>{t}</div>;
  return <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
    <div style={{ padding: '14px 14px 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, var(--tk-tint), #5E5CE6)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name="wave" size={14} sw={2.2} style={{ color: '#fff' }} /></span>
      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>TouchKit</span>
      {drawer ? <button className="tk-btn" onClick={onClose} aria-label="Close sidebar"
        style={{ marginLeft: 'auto', border: 0, background: 'none', cursor: 'pointer', color: 'var(--tk-label3)', display: 'grid', padding: 4 }}>
        <Icon name="xcirc" size={22} /></button> : null}
    </div>
    <div className="tk-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px' }}>
      {wc === 'regular' ? <React.Fragment>
        {sec('App')}
        {row('t1', 'person', 'Contacts', null, tab === 'contacts', () => { Haptics.selection(); onTab('contacts'); })}
        {row('t2', 'sliders', 'Settings', null, tab === 'settings', () => { Haptics.selection(); onTab('settings'); })}
      </React.Fragment> : null}
      {sec('Library')}
      {row('all', 'person2', 'All Contacts', counts.all, tab === 'contacts' && filter.type === 'all', () => onFilter({ type: 'all' }))}
      {row('fav', 'star', 'Favorites', counts.fav, tab === 'contacts' && filter.type === 'fav', () => onFilter({ type: 'fav' }))}
      {row('rec', 'clock', 'Recents', counts.rec, tab === 'contacts' && filter.type === 'rec', () => onFilter({ type: 'rec' }))}
      {sec('Groups')}
      {groups.map(g => row('g' + g.name, null, g.name, counts.groups[g.name] || 0, tab === 'contacts' && filter.type === 'group' && filter.g === g.name, () => onFilter({ type: 'group', g: g.name }), g.color))}
    </div>
    <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--tk-label3)', borderTop: '1px solid var(--tk-sep)' }}>TouchKit 0.1 · demo data</div>
  </div>;
}
