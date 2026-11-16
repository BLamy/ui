/* Row renderers: one component per row kind, drawn as an iOS inset-grouped ListRow on phone and tablet and as a
   dense macOS System Settings row on desktop. PaneView lays a pane's sections out; SearchResults lists hits.
   A saved password's row previews the sign-in on hover (never the password itself). */
import { useState, type ReactNode } from 'react';
import { HoverCard, HoverCardContent, HoverCardHeader, HoverCardTrigger } from '@/components/ui/hover-card';
import { ListRow, ListSection, type ListRowProps } from '@/components/ui/list';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { RadioGroup } from '@/components/ui/radio-group';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { TextMorph } from '@/components/ui/text-morph';
import { Collapsible, CollapsiblePanel } from '@ui-sdk/react/collapsible';
import { Radio } from '@ui-sdk/react/radio';
import { Icon, isIconName, type IconProps } from '@/lib/icon';
import { type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { LOGINS, MARKS, SEARCH, getPane, iconFor, notifSummary, pathTo, type Glyph, type Pane, type Row, type Section, type Values } from './data';
import { useSettings } from './state';

/* ── Icons ── */
/** A library icon, or one of the block's Apple marks. */
function SettingsIcon({ glyph, ...p }: { glyph: Glyph } & Omit<IconProps, 'name' | 'shapes'>) {
  return <Icon name={glyph} shapes={glyph in MARKS ? MARKS[glyph as keyof typeof MARKS] : undefined} {...p} />;
}

/** The colored rounded square (squircle-ish radius) with a white glyph. `tint` may be a gradient. */
export function Tile({ glyph, tint: color, size = 29 }: { glyph: Glyph; tint: string; size?: number }) {
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center text-white"
      style={{ width: size, height: size, borderRadius: size * 0.235, background: color }}>
      <SettingsIcon glyph={glyph} size={size * 0.66} weight="semibold" />
    </span>
  );
}

/** Wi-Fi strength: three arcs, the missing bars dimmed. */
function WifiBars({ bars }: { bars: 1 | 2 | 3 }) {
  const on = (n: number) => (bars >= n ? 1 : 0.28);
  return (
    <svg aria-label={`${bars} of 3 bars`} role="img" width={17} height={17} viewBox="0 0 24 24" className="block shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M3.2 9.2a12.5 12.5 0 0 1 17.6 0" opacity={on(3)} />
      <path d="M6.3 12.4a8 8 0 0 1 11.4 0" opacity={on(2)} />
      <circle cx={12} cy={17.6} r={2} fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Row chrome ── */
type ShellProps = Pick<ListRowProps, 'title' | 'description' | 'icon' | 'trailing' | 'accessory' | 'checked' | 'onClick' | 'justify' | 'preview'> & { last?: boolean };

/** macOS group rows get a hairline above every row but the first, inset like the system's. */
const macSep = 'before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-border first:before:hidden';

/** iOS: a ListRow (a control accessory makes it a plain row whose label flips the switch). macOS: a dense row, in
 *  the hover card's wrapper when it has a `preview` (the wrapper then draws the hairline: `first:` sees the rows). */
function Shell({ last, preview, ...p }: ShellProps) {
  const { layout } = useSettings();
  if (layout !== 'desktop') return <ListRow {...p} preview={preview} divider={!last} />;
  const { accessory: a } = p;
  const body = (
    <>
      {p.icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{p.title}</span>
        {p.description ? <span className="block truncate text-[11.5px] text-muted-foreground">{p.description}</span> : null}
      </span>
      {p.trailing}
      {a === 'check' ? (p.checked ? <Icon name="check" size={15} weight="bold" className="text-primary" /> : null)
        : a === 'chevron' ? <Icon name="chevron-right" size={12} weight="bold" className="text-tertiary-foreground" />
        : a}
    </>
  );
  const cls = cn('relative flex min-h-[38px] w-full items-center gap-2.5 px-3 py-[7px] text-left text-footnote text-foreground', !preview && macSep);
  const row = p.onClick ? (
    <SdkButton onClick={p.onClick}
      className={cn(cls, 'bl-btn cursor-pointer border-0 bg-transparent [font-family:inherit] transition-colors duration-150 hover:bg-secondary/60 active:bg-accent')}>{body}</SdkButton>
  ) : <div className={cls}>{body}</div>;
  return preview ? (
    <HoverCard>
      <HoverCardTrigger render={<div className={cn('relative flex w-full', macSep)} />}>{row}</HoverCardTrigger>
      <HoverCardContent side="end" align="start">{preview}</HoverCardContent>
    </HoverCard>
  ) : row;
}

/** A row that holds a control or a chart instead of a title (slider, segmented, appearance, usage). */
function Plain({ children, last }: { children: ReactNode; last?: boolean }) {
  const { layout } = useSettings();
  return layout === 'desktop'
    ? <div className={cn('relative px-3 py-3 text-footnote', macSep)}>{children}</div>
    : <div className={cn('relative bg-card px-4 py-3', !last && 'after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-border')}>{children}</div>;
}

const Detail = ({ children }: { children?: ReactNode }) =>
  children ? <span className="min-w-0 shrink truncate text-muted-foreground">{children}</span> : null;


/** macOS pop-up button: a Select showing the current value and ⌃⌄, named by its row's title. */
function Popup({ id, title, options }: { id: string; title: string; options: string[] }) {
  const s = useSettings();
  return (
    <Select<string> value={String(s.values[id])} onValueChange={(o) => { if (o != null) s.set(id, o); }}>
      <SelectTrigger aria-label={title}
        className="-my-1 h-[26px] w-auto gap-1 rounded-md bg-transparent px-2 text-footnote font-normal text-foreground shadow-[0_1px_1px_black] ring-[.5px] shadow-black/6 ring-border [&>svg]:size-3 [&>svg]:text-muted-foreground [&>svg]:opacity-100" />
      <SelectContent align="end" size="sm">
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const NetIcons = ({ secure, bars }: { secure: boolean; bars: 1 | 2 | 3 }) => (
  <span className="flex items-center gap-2 text-foreground">
    {secure ? <Icon name="lock-fill" size={13} /> : null}
    <WifiBars bars={bars} />
    <Icon name="info" size={21} weight="light" className="text-primary" />
  </span>
);

/** Rows that depend on live values (the joined network moves out of the list into the connected slot). */
const visible = (r: Row, v: Values) =>
  r.t === 'network' ? r.name !== v['wifi.network'] : r.t === 'connected' ? !!v['wifi.on'] && !v.airplane : true;

export function RowView({ row, last }: { row: Row; last?: boolean }) {
  const s = useSettings();
  const v = s.values;
  const mac = s.layout === 'desktop';
  const tile = (glyph?: Glyph, color?: string) =>
    glyph && color ? <Tile glyph={glyph} tint={color} size={s.layout === 'desktop' ? 22 : 29} /> : undefined;
  switch (row.t) {
    case 'toggle':
      return <Shell last={last} icon={tile(row.glyph, row.color)} title={row.title} description={row.subtitle} 
        accessory={<Switch checked={!!v[row.id]} onCheckedChange={(x) => s.set(row.id, x)} aria-label={mac ? row.title : undefined} size={mac ? 'sm' : 'default'} />} />;
    case 'link': {
      const p = getPane(row.to);
      const value = typeof row.value === 'function' ? row.value(v) : row.value;
      const subtitle = row.subtitle ?? (row.to.startsWith('notif-') ? notifSummary(v, row.to) : undefined);
      return <Shell last={last} icon={row.icon ? tile(p?.glyph, p?.color) : undefined} title={row.title ?? p?.title} description={subtitle}
        trailing={<Detail>{value}</Detail>} accessory="chevron" onClick={() => s.open(row.to)} />;
    }
    case 'value':
      return <Shell last={last} title={row.title} trailing={<Detail>{row.value}</Detail>} />;
    case 'select':
      return s.layout === 'desktop'
        ? <Shell last={last} icon={tile(row.glyph, row.color)} title={row.title} trailing={<Popup id={row.id} title={row.title} options={row.options} />} />
        : <Shell last={last} icon={tile(row.glyph, row.color)} title={row.title} trailing={<Detail>{String(v[row.id])}</Detail>} accessory="chevron" onClick={() => s.open('choose:' + row.id)} />;
    case 'option': {
      const on = v[row.id] === row.option;
      return <Shell last={last} title={row.option} accessory="check" checked={on} onClick={() => { if (!on) s.set(row.id, row.option); }} />;
    }
    case 'slider':
      return <Plain last={last}><SliderRow row={row} /></Plain>;
    case 'segmented':
      return (
        <Plain last={last}>
          <Segmented aria-label="Display as" value={String(v[row.id])} onValueChange={(o) => { if (o) s.set(row.id, o); }}>
            {row.options.map((o) => <SegmentedItem key={o} value={o}>{o}</SegmentedItem>)}
          </Segmented>
        </Plain>
      );
    case 'network':
      return <Shell last={last} icon={<span className="w-[18px] shrink-0" />} title={row.name} trailing={<NetIcons secure={row.secure} bars={row.bars} />}
        onClick={() => s.set('wifi.network', row.name)} />;
    case 'connected':
      return <Shell last={last} icon={<Icon name="check" size={18} weight="bold" className="text-primary" />} title={String(v['wifi.network'])}
        trailing={<NetIcons secure bars={3} />} />;
    case 'device': {
      const on = !!v['bt.' + row.name];
      return <Shell last={last} icon={s.layout === 'desktop' ? <SettingsIcon glyph={row.glyph} size={18} className="text-muted-foreground" /> : undefined} title={row.name}
        trailing={<><Detail>{on ? 'Connected' : 'Not Connected'}</Detail><Icon name="info" size={21} weight="light" className="text-primary" /></>}
        onClick={() => s.set('bt.' + row.name, !on)} />;
    }
    case 'action':
      return <Shell last={last} justify={row.destructive && s.layout !== 'desktop' ? 'center' : undefined}
        title={<span className={row.destructive ? 'text-destructive' : 'text-primary'}>{row.title}</span>} />;
    case 'appearance':
      return <Plain last={last}><AppearancePicker /></Plain>;
    case 'usage':
      return <Plain last={last}><Usage row={row} /></Plain>;
    case 'meter':
      return <Plain last={last}><Meter row={row} /></Plain>;
    case 'login':
      return <Shell last={last} icon={<LetterTile site={row.site} color={row.color} size={s.layout === 'desktop' ? 22 : 32} />} title={row.site} description={row.user}
        accessory="chevron" onClick={() => s.open(row.to)} preview={<LoginPreview row={row} />} />;
    case 'secret':
      return <SecretRow title={row.title} value={row.value} last={last} />;
  }
}

/* ── Controls that fill a row ── */
function SliderRow({ row }: { row: Extract<Row, { t: 'slider' }> }) {
  const s = useSettings();
  const end = (e: string, big: boolean) => isIconName(e)
    ? <Icon name={e} size={big ? 24 : 18} className="text-muted-foreground" />
    : <span className={cn('w-5 text-center text-muted-foreground', big ? 'text-[22px]' : 'text-footnote')}>{e}</span>;
  return (
    <div className="flex items-center gap-2">
      {end(row.lo, false)}
      <Slider aria-label={row.id.includes('text') ? 'Text size' : row.id.includes('volume') ? 'Volume' : 'Brightness'} className="flex-1"
        min={row.min ?? 0} max={row.max ?? 100} step={row.step ?? 1} value={Number(s.values[row.id])} onValueChange={(x) => s.set(row.id, x)} />
      {end(row.hi, true)}
    </div>
  );
}

/** The Appearance picker's lock-screen thumbnails: wallpaper and clock ink (fixed artwork). */
const WALLPAPER = {
  light: { background: 'linear-gradient(180deg,#9ad0ff,#e9d9ff)', color: '#1c1c1e' },
  dark: { background: 'linear-gradient(180deg,#1b2a4a,#0b0f1c)', color: '#fff' },
} as const;

function PhoneThumb({ dark }: { dark: boolean }) {
  return (
    <span className="relative block h-[112px] w-[56px] overflow-hidden rounded-[11px] shadow-[0_2px_6px_black] ring-1 shadow-black/12 ring-border"
      style={WALLPAPER[dark ? 'dark' : 'light']}>
      <span className="absolute inset-x-0 top-2.5 text-center text-detail font-semibold tracking-[-.3px]">9:41</span>
      <span className={cn('absolute inset-x-2 top-9 h-5 rounded-md', dark ? 'bg-white/15' : 'bg-white/60')} />
      <span className={cn('absolute inset-x-2 top-[62px] h-5 rounded-md', dark ? 'bg-white/15' : 'bg-white/60')} />
    </span>
  );
}

function AppearancePicker() {
  const s = useSettings();
  const opts: [Appearance, string][] = [['light', 'Light'], ['dark', 'Dark']];
  return (
    <RadioGroup<Appearance> aria-label="Appearance" orientation="horizontal" className="flex-nowrap justify-center gap-14 py-1"
      value={s.dark ? 'dark' : 'light'} onValueChange={(k) => { if (k) s.setAppearance(k); }}>
      {opts.map(([k, label]) => {
        const on = (k === 'dark') === s.dark;
        return (
          <Radio key={k} value={k}
            className="bl-btn flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 [font-family:inherit] text-foreground">
            <PhoneThumb dark={k === 'dark'} />
            <span className={s.layout === 'desktop' ? 'text-footnote' : 'text-subhead'}>{label}</span>
            <span className={cn('grid size-[22px] place-items-center rounded-full text-white transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy',
              on ? 'bg-primary' : 'shadow-[inset_0_0_0_1.5px_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))]')}>
              {on ? <Icon name="check" size={14} sw={3} className="transition-[scale] duration-spring-snappy ease-spring-bouncy starting:scale-40" /> : null}
            </span>
          </Radio>
        );
      })}
    </RadioGroup>
  );
}

function Usage({ row }: { row: Extract<Row, { t: 'usage' }> }) {
  const max = Math.max(...row.days.map((d) => d.reduce((a, b) => a + b, 0)));
  const labels = row.days.length === 7 ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : null;
  return (
    <div>
      <div className="text-footnote text-muted-foreground">{row.title}</div>
      <div className="text-[28px] leading-[1.15] font-bold tracking-[-.5px]">{row.total}</div>
      <div className="mt-3 flex h-[92px] items-end gap-[6px]">
        {row.days.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col-reverse gap-px overflow-hidden rounded-sm" style={{ height: `${(d.reduce((a, b) => a + b, 0) / max) * 100}%` }}>
            {d.map((x, j) => <div key={j} style={{ flexGrow: x, background: row.legend[j][1] }} />)}
          </div>
        ))}
      </div>
      {labels ? <div className="mt-1 flex gap-[6px] text-caption2 text-muted-foreground">{labels.map((l, i) => <span key={i} className="flex-1 text-center">{l}</span>)}</div> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption">
        {row.legend.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c }} />{l}</span>)}
      </div>
      <div className="mt-2 text-caption text-muted-foreground">{row.caption}</div>
    </div>
  );
}

function Meter({ row }: { row: Extract<Row, { t: 'meter' }> }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{row.title}</span>
        <span className="truncate text-footnote text-muted-foreground">{row.used}</span>
      </div>
      <div className="mt-2.5 flex h-5 gap-px overflow-hidden rounded-[5px] bg-secondary">
        {row.parts.map(([l, c, n]) => <div key={l} style={{ width: `${(n / row.cap) * 100}%`, background: c }} />)}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {row.parts.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: c }} />{l}</span>)}
      </div>
    </div>
  );
}

const LetterTile = ({ site, color, size }: { site: string; color: string; size: number }) => (
  <span aria-hidden="true" className="grid shrink-0 place-items-center font-bold text-white"
    style={{ width: size, height: size, borderRadius: size * 0.235, background: color, fontSize: size * 0.48 }}>{site[0].toUpperCase()}</span>
);

/** A saved sign-in at a glance: site, account, when it last changed. The password stays in its pane. */
function LoginPreview({ row }: { row: Extract<Row, { t: 'login' }> }) {
  const login = LOGINS.find((l) => l.site === row.site);
  return (
    <>
      <HoverCardHeader icon={<LetterTile site={row.site} color={row.color} size={40} />} title={row.site} description={row.user} />
      <div className="mt-3 flex items-center gap-1.5 text-footnote text-muted-foreground">
        <Icon name="key" size={14} />Password{login ? ` · Updated ${login.updated}` : ''}
      </div>
    </>
  );
}

/** Password: dots until tapped, then the letters morph in. */
function SecretRow({ title, value, last }: { title: string; value: string; last?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <Shell last={last} title={title} onClick={() => setShown((x) => !x)}
      trailing={<span className="text-muted-foreground tabular-nums"><TextMorph>{shown ? value : '••••••••••••'}</TextMorph></span>} />
  );
}

/* ── Sections and panes ── */
/** Springs a section open or shut (Wi-Fi off hides the networks) instead of cutting: a Collapsible the section's
    switch drives. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <Collapsible open={open}>
      <CollapsiblePanel className="h-(--collapsible-panel-height) overflow-clip transition-[height,opacity] duration-spring-tray ease-spring-tray data-starting-style:h-0 data-starting-style:opacity-0 data-ending-style:h-0 data-ending-style:opacity-0 motion-reduce:transition-none">
        {children}
      </CollapsiblePanel>
    </Collapsible>
  );
}

export function Group({ title, footer, children }: { title?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  const { layout } = useSettings();
  if (layout !== 'desktop') return <ListSection title={title} footer={footer}>{children}</ListSection>;
  return (
    <div className="pb-5">
      {title ? <div className="px-1 pb-1.5 text-footnote font-semibold">{title}</div> : null}
      <div className="overflow-hidden rounded-ctl bg-secondary/40 shadow-[0_0_0_.5px_var(--border)]">{children}</div>
      {footer ? <div className="px-1 pt-1.5 text-[11.5px] leading-[1.4] text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

function SectionView({ section }: { section: Section }) {
  const s = useSettings();
  const rows = section.rows.filter((r) => visible(r, s.values));
  const body = (
    <Group title={section.title} footer={section.footer}>
      {rows.map((r, i) => <RowView key={i} row={r} last={i === rows.length - 1} />)}
    </Group>
  );
  return section.when ? <Collapse open={!!s.values[section.when]}>{body}</Collapse> : body;
}

function PaneHeader({ pane }: { pane: Pane }) {
  const { layout } = useSettings();
  if (!pane.glyph || !pane.color) return null;
  return layout === 'desktop' ? (
    <div className="mb-5 flex items-center gap-3.5 rounded-ctl bg-secondary/40 p-4 shadow-[0_0_0_.5px_var(--border)]">
      <Tile glyph={pane.glyph} tint={pane.color} size={44} />
      <div className="min-w-0">
        <div className="text-subhead font-semibold">{pane.title}</div>
        <div className="mt-0.5 text-caption leading-[1.4] text-muted-foreground">{pane.blurb} <span className="text-primary">Learn more…</span></div>
      </div>
    </div>
  ) : (
    <div className="mb-[22px] flex flex-col items-center rounded-panel bg-card px-5 pt-5 pb-4 text-center">
      <Tile glyph={pane.glyph} tint={pane.color} size={58} />
      <div className="mt-2.5 text-[22px] leading-tight font-bold tracking-[-.3px]">{pane.title}</div>
      <p className="mt-1.5 mb-0 max-w-[420px] text-detail leading-[1.35] text-muted-foreground">{pane.blurb} <span className="text-primary">Learn more…</span></p>
    </div>
  );
}

export function PaneView({ id }: { id: string }) {
  const s = useSettings();
  const pane = getPane(id);
  if (!pane) return null;
  return (
    <div className={s.layout === 'desktop' ? 'mx-auto max-w-[760px] px-6 pt-5 pb-10' : 'mx-auto max-w-[720px] px-4 pt-3 pb-4'}>
      {pane.blurb ? <PaneHeader pane={pane} /> : null}
      {pane.sections.map((sec, i) => <SectionView key={i} section={sec} />)}
    </div>
  );
}

/* ── Search ── */
export function SearchResults({ onOpen }: { onOpen?: () => void }) {
  const s = useSettings();
  const q = s.query.trim().toLowerCase();
  const hits = SEARCH.filter((h) => h.title.toLowerCase().includes(q)).slice(0, 40);
  if (!hits.length) {
    return <div className="px-6 py-16 text-center"><div className="text-title font-bold">No Results for “{s.query.trim()}”</div><div className="mt-1 text-subhead text-muted-foreground">Check the spelling or try a new search.</div></div>;
  }
  return (
    <Group>
      {hits.map((h, i) => {
        const icon = iconFor(h.pane);
        return (
          <Shell key={h.pane + h.title} last={i === hits.length - 1} title={h.title} description={h.trail || undefined}
            icon={icon?.glyph && icon.color ? <Tile glyph={icon.glyph} tint={icon.color} size={s.layout === 'desktop' ? 22 : 29} /> : undefined}
            accessory={s.layout !== 'desktop' ? 'chevron' : undefined} onClick={() => { s.openPath(pathTo(h.pane)); onOpen?.(); }} />
        );
      })}
    </Group>
  );
}
