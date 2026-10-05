/* The inspector's controls, Framer's and Xcode's: sections with a hairline, label-and-control rows, number fields you
   scrub by dragging their label (⇧ ×10, ⌥ ×0.1), text that commits on Return or when you leave it, expressions
   checked as you type (with their value at design time), colors from the theme or anywhere, symbols, and a toggle
   that turns any prop into a binding. A scrub is one undo step: `onBegin` once, then live changes. */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { parseColor } from 'react-aria-components';
import { ColorArea, ColorSlider } from '@/components/ui/color-picker';
import { ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch } from '@/components/ui/color-field';
import { PlainButton } from '@/components/ui/plain-button';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ICON_NAMES, Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { evaluate, preview, type Scope } from './expr';
import { exprProblem } from './diagnostics';
import { cssColor, THEME_COLORS } from './model';
import { SYSTEM_COLORS } from './palette';

/* ── Layout ── */

export function Section({ title, children, action, className, help }: { title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string; help?: string }) {
  return (
    <section className={cn('flex flex-col gap-2 border-b border-border px-3.5 py-3 last:border-b-0', className)}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="m-0 truncate text-caption font-semibold text-foreground" title={help}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A label and its control, side by side. */
export function Field({ label, children, hint, htmlFor, wide }: { label: ReactNode; children: ReactNode; hint?: ReactNode; htmlFor?: string; wide?: boolean }) {
  return (
    <div className={cn('grid items-center gap-x-2 gap-y-0.5', wide ? 'grid-cols-1' : 'grid-cols-[84px_minmax(0,1fr)]')}>
      <label htmlFor={htmlFor} className="truncate text-caption text-muted-foreground">{label}</label>
      <div className="min-w-0">{children}</div>
      {hint ? <div className={cn('text-caption2 text-muted-foreground', !wide && 'col-start-2')}>{hint}</div> : null}
    </div>
  );
}

/** A round add button for a section header. */
export function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PlainButton aria-label={label} title={label} onPress={onPress} className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary hover:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring">
      <Icon name="plus" size={14} sw={2.3} />
    </PlainButton>
  );
}

export function IconAction({ icon, label, onPress, className, tone }: { icon: string; label: string; onPress: () => void; className?: string; tone?: 'danger' }) {
  return (
    <PlainButton aria-label={label} title={label} onPress={onPress} className={cn('grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring', tone === 'danger' ? 'hover:text-destructive' : 'hover:text-foreground', className)}>
      <Icon name={icon} size={13} sw={2.2} />
    </PlainButton>
  );
}

const inputBox = 'h-7 w-full min-w-0 rounded-md border-0 bg-secondary px-2 text-footnote text-foreground outline-none select-text placeholder:text-tertiary-foreground focus:bg-background focus:shadow-[inset_0_0_0_1.5px_var(--primary)]';

/* ── Numbers ── */

const roundTo = (v: number, step: number) => {
  const places = Math.max(0, Math.min(4, -Math.floor(Math.log10(step)) + 1));
  return Number(v.toFixed(places));
};

export interface NumberInputProps {
  label: string;
  value: number;
  onChange: (v: number, live: boolean) => void;
  /** Called once when a scrub starts (an undo checkpoint). */
  onBegin?: () => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Show the label as a scrub handle beside the field (default), or only the field. */
  scrub?: 'label' | 'none';
  className?: string;
}

/** A number: type it, ↑/↓ it (⇧ for ×10), or drag the label left and right to scrub it. */
export function NumberInput({ label, value, onChange, onBegin, min = -Infinity, max = Infinity, step = 1, unit, scrub = 'label', className }: NumberInputProps) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const s = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  const shown = text ?? String(roundTo(value, step));

  const commit = (t: string) => {
    setText(null);
    const n = Number(t.replace(/[^\d.eE+-]/g, ''));
    if (t.trim() !== '' && Number.isFinite(n) && n !== value) onChange(clamp(n), false);
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { commit(e.currentTarget.value); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { setText(null); e.currentTarget.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const k = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1);
      setText(null);
      onChange(clamp(roundTo(value + k, step)), false);
    }
  };
  const down = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    s.current = { x: e.clientX, v: value, moved: false };
  };
  const move = (e: PointerEvent<HTMLSpanElement>) => {
    const st = s.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    if (!st.moved) {
      if (Math.abs(dx) < 2) return;
      st.moved = true;
      onBegin?.();
    }
    const k = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    onChange(clamp(roundTo(st.v + Math.round(dx / 2) * step * k, step)), true);
  };
  const up = () => { s.current = null; };

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {scrub === 'label' ? (
        <span
          aria-hidden="true"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          title={`Drag to change ${label}`}
          className="w-[84px] shrink-0 cursor-ew-resize touch-none truncate text-caption text-muted-foreground select-none hover:text-foreground"
        >
          {label}
        </span>
      ) : null}
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          aria-label={label}
          inputMode="decimal"
          value={shown}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={key}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(inputBox, 'pr-7 tabular-nums', !unit && 'pr-2')}
        />
        {unit ? <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-caption2 text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

/* ── Text ── */

export function TextInput({ value, onCommit, placeholder, mono, multiline, label, className, invalid }: {
  value: string; onCommit: (v: string) => void; placeholder?: string; mono?: boolean; multiline?: boolean; label: string; className?: string; invalid?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => { if (v !== value) onCommit(v); };
  const cls = cn(inputBox, mono && 'font-mono text-caption', invalid && 'shadow-[inset_0_0_0_1.5px_var(--destructive)]', className);
  return multiline ? (
    <textarea
      aria-label={label}
      value={v}
      rows={3}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') { setV(value); e.currentTarget.blur(); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { commit(); e.currentTarget.blur(); } }}
      className={cn(cls, 'h-auto min-h-16 resize-y py-1.5 leading-[1.4]')}
    />
  ) : (
    <input
      aria-label={label}
      value={v}
      placeholder={placeholder}
      spellCheck={!mono}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } else if (e.key === 'Escape') { setV(value); e.currentTarget.blur(); } }}
      className={cls}
    />
  );
}

/** An identifier (a state name, an outlet): letters, digits, _ and $, not starting with a digit. */
export function NameInput({ value, onCommit, label, placeholder, taken }: { value: string; onCommit: (v: string) => void; label: string; placeholder?: string; taken?: string[] }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const ok = /^[A-Za-z_$][\w$]*$/.test(v) && !(taken ?? []).includes(v);
  return (
    <input
      aria-label={label}
      aria-invalid={!ok || undefined}
      value={v}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => setV(e.target.value.replace(/\s+/g, ''))}
      onBlur={() => { if (ok && v !== value) onCommit(v); else setV(value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { setV(value); e.currentTarget.blur(); } }}
      className={cn(inputBox, 'font-mono text-caption', !ok && v && 'shadow-[inset_0_0_0_1.5px_var(--destructive)]')}
    />
  );
}

/* ── Expressions ── */

export interface ExprInputProps {
  value: string;
  onCommit: (v: string) => void;
  /** The names it may read. */
  names: Set<string>;
  /** Design-time values, for the preview. */
  scope?: Scope;
  label: string;
  placeholder?: string;
  /** Show the evaluated value under it. */
  showValue?: boolean;
  multiline?: boolean;
}

/** A JavaScript expression: checked as you type (syntax, and names out of scope), with its design-time value. */
export function ExprInput({ value, onCommit, names, scope, label, placeholder, showValue = true, multiline }: ExprInputProps) {
  const [v, setV] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => setV(value), [value]);
  const problem = v.trim() ? exprProblem(v, names) : null;
  const result = useMemo(() => (showValue && scope && v.trim() && !problem ? evaluate(v, scope) : null), [showValue, scope, v, problem]);
  const commit = () => { if (v !== value) onCommit(v); };
  const sorted = useMemo(() => [...names].sort(), [names]);
  const insert = (name: string) => setV((x) => (x && !/[\s([{,!?:+\-*/%<>=&|]$/.test(x) ? `${x} ${name}` : `${x}${name}`));
  const cls = cn(inputBox, 'font-mono text-caption leading-[1.45] text-primary', problem && 'shadow-[inset_0_0_0_1.5px_var(--destructive)]');
  const keys = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { setV(value); e.currentTarget.blur(); }
    else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); e.currentTarget.blur(); }
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {multiline ? (
        <textarea aria-label={label} aria-invalid={!!problem || undefined} value={v} placeholder={placeholder} spellCheck={false} rows={2}
          onChange={(e) => setV(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); commit(); }} onKeyDown={keys}
          className={cn(cls, 'h-auto min-h-12 resize-y py-1.5')} />
      ) : (
        <input aria-label={label} aria-invalid={!!problem || undefined} value={v} placeholder={placeholder} spellCheck={false}
          onChange={(e) => setV(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); commit(); }} onKeyDown={keys}
          className={cls} />
      )}
      {problem ? <span role="alert" className="text-caption2 text-destructive">{problem}</span> : null}
      {!problem && result ? (
        <span className="truncate font-mono text-caption2 text-muted-foreground" title={result.ok ? preview(result.value, 400) : result.error}>
          {result.ok ? `= ${preview(result.value)}` : result.error}
        </span>
      ) : null}
      {focused && sorted.length ? (
        <div className="flex flex-wrap gap-1" onPointerDown={(e) => e.preventDefault()}>
          {sorted.map((n) => (
            <button key={n} type="button" tabIndex={-1} onClick={() => insert(n)} className="cursor-pointer rounded border-0 bg-primary/10 px-1.5 py-px font-mono text-caption2 text-primary hover:bg-primary/20">{n}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Choices ── */

export function SwitchInput({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Switch checked={value} onChange={onChange} aria-label={label} className="scale-[.8] origin-left" />;
}

/** Segmented for a few short options, a menu for more. */
export function ChoiceInput({ value, options, onChange, label }: { value: string; options: readonly { id: string; label: string }[]; onChange: (v: string) => void; label: string }) {
  const short = options.length <= 3 && options.every((o) => o.label.length <= 9);
  if (short) return <Segmented aria-label={label} value={value} onChange={onChange} options={[...options]} className="[&_[role=radio]]:py-[3px] [&_[role=radio]]:text-caption" />;
  return (
    <Select aria-label={label} selectedKey={value} onSelectionChange={(k) => k != null && onChange(String(k))}>
      <SelectTrigger size="sm" className="h-7 w-full rounded-md bg-secondary px-2 text-footnote" />
      <SelectContent>
        {options.map((o) => <SelectItem key={o.id} id={o.id}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ── Colors ── */

/** Where the custom picker starts when the color isn't a custom one; what an unreadable color becomes. */
const CUSTOM_START = '#0A84FF';
const FALLBACK_HEX = '#000000';

const toHex = (c: string) => {
  try { return parseColor(c).toString('hex'); } catch { return FALLBACK_HEX; }
};

/** A color: a theme color (follows light and dark), an iOS system color, or any color from the picker. */
export function ColorInput({ value, onChange, label, allowNone = true }: { value: string | null | undefined; onChange: (v: string | null) => void; label: string; allowNone?: boolean }) {
  const theme = THEME_COLORS.find((t) => t.id === value);
  const text = !value ? 'None' : theme ? theme.label : value.toUpperCase();
  const custom = value && !value.startsWith('$') ? value : null;
  return (
    <PopoverTrigger>
      <PlainButton aria-label={`${label}: ${text}`} className="flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-secondary px-1.5 text-left text-footnote text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
        <span className={cn('size-[18px] shrink-0 rounded-[5px] shadow-hairline', !value && 'bg-[linear-gradient(135deg,transparent_45%,var(--destructive)_45%,var(--destructive)_55%,transparent_55%)]')} style={value ? { background: cssColor(value) } : undefined} />
        <span className="truncate">{text}</span>
      </PlainButton>
      <PopoverContent placement="left top" aria-label={label} className="w-64 p-0">
        <div className="flex flex-col gap-3 p-3">
          <div>
            <div className="mb-1.5 text-caption2 font-semibold tracking-wide text-muted-foreground uppercase">Theme</div>
            <div className="grid grid-cols-6 gap-1.5">
              {allowNone ? (
                <PlainButton aria-label="None" title="None" onPress={() => onChange(null)} className={cn('relative size-7 cursor-pointer overflow-hidden rounded-md border-0 bg-background p-0 shadow-hairline outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring', !value && 'ring-2 ring-primary')}>
                  <span aria-hidden="true" className="absolute inset-x-[-4px] top-1/2 h-0.5 -rotate-45 bg-destructive" />
                </PlainButton>
              ) : null}
              {THEME_COLORS.map((t) => (
                <PlainButton key={t.id} aria-label={t.label} title={t.label} onPress={() => onChange(t.id)} className={cn('size-7 cursor-pointer rounded-md border-0 p-0 shadow-hairline outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring', value === t.id && 'ring-2 ring-primary ring-offset-1 ring-offset-popover')} style={{ background: cssColor(t.id) }} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-caption2 font-semibold tracking-wide text-muted-foreground uppercase">System</div>
            <div className="grid grid-cols-6 gap-1.5">
              {SYSTEM_COLORS.map((c) => (
                <PlainButton key={c} aria-label={c} title={c} onPress={() => onChange(c)} className={cn('size-7 cursor-pointer rounded-md border-0 p-0 outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring', value?.toUpperCase() === c && 'ring-2 ring-primary ring-offset-1 ring-offset-popover')} style={{ background: c }} />
              ))}
            </div>
          </div>
          <CustomColor value={custom ?? CUSTOM_START} onChange={onChange} />
        </div>
      </PopoverContent>
    </PopoverTrigger>
  );
}

function CustomColor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [c, setC] = useState(() => parseColor(toHex(value)).toFormat('hsb'));
  const set = (next: typeof c) => { setC(next); onChange(next.toString('hex')); };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-caption2 font-semibold tracking-wide text-muted-foreground uppercase">Custom</div>
      <ColorArea value={c} onChange={set} className="h-28 w-full" />
      <ColorSlider colorSpace="hsb" channel="hue" value={c} onChange={set} aria-label="Hue" />
      <ColorField aria-label="Hex color" value={c} onChange={(v) => v && set(v.toFormat('hsb'))}>
        <ColorFieldGroup size="sm">
          <ColorFieldSwatch className="size-5" />
          <ColorFieldInput />
        </ColorFieldGroup>
      </ColorField>
    </div>
  );
}

/* ── Symbols ── */

export function IconInput({ value, onChange, label, allowNone = true }: { value: string | null; onChange: (v: string | null) => void; label: string; allowNone?: boolean }) {
  const [q, setQ] = useState('');
  const names = useMemo(() => ICON_NAMES.filter((n) => n.includes(q.trim().toLowerCase())), [q]);
  return (
    <PopoverTrigger>
      <PlainButton aria-label={`${label}: ${value ?? 'none'}`} className="flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-secondary px-1.5 text-left text-footnote text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
        <span className="grid size-[18px] shrink-0 place-items-center text-primary">{value ? <Icon name={value} size={16} sw={1.9} /> : <Icon name="minus" size={12} sw={2} className="text-muted-foreground" />}</span>
        <span className="truncate">{value ?? 'None'}</span>
      </PlainButton>
      <PopoverContent placement="left top" aria-label={label} className="w-72 p-0">
        {({ close }) => (
          <div className="flex flex-col">
            <div className="p-2">
              <input autoFocus aria-label="Filter symbols" placeholder="Filter symbols" value={q} onChange={(e) => setQ(e.target.value)} className={inputBox} />
            </div>
            <div className="grid max-h-64 grid-cols-7 gap-0.5 overflow-y-auto p-2 pt-0">
              {allowNone ? (
                <PlainButton aria-label="No symbol" title="None" onPress={() => { onChange(null); close(); }} className="grid aspect-square cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring">
                  <Icon name="minus" size={14} sw={2} />
                </PlainButton>
              ) : null}
              {names.map((n) => (
                <PlainButton key={n} aria-label={n} title={n} onPress={() => { onChange(n); close(); }} className={cn('grid aspect-square cursor-pointer place-items-center rounded-md border-0 bg-transparent text-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring', n === value && 'bg-primary/14 text-primary')}>
                  <Icon name={n} size={18} sw={1.8} />
                </PlainButton>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </PopoverTrigger>
  );
}

/* ── Binding ── */

/** The ƒ toggle beside a prop: bound (an expression) or a literal. */
export function BindToggle({ bound, onToggle, label }: { bound: boolean; onToggle: () => void; label: string }) {
  return (
    <PlainButton
      aria-label={bound ? `Unbind ${label}` : `Bind ${label} to an expression`}
      title={bound ? 'Bound to an expression: press to use a value instead' : 'Bind to state, props or context (an expression)'}
      aria-pressed={bound}
      onPress={onToggle}
      className={cn(
        'grid size-6 shrink-0 cursor-pointer place-items-center rounded-md border-0 font-mono text-caption italic outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring',
        bound ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      ƒ
    </PlainButton>
  );
}

/** A small mono code line (what something is in React). */
export function CodeLine({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn('block truncate rounded-md bg-code px-2 py-1 font-mono text-caption2 text-code-foreground', className)}>{children}</code>;
}

/** A hint paragraph. */
export function Help({ children }: { children: ReactNode }) {
  return <p className="m-0 text-caption2 leading-[1.45] text-muted-foreground">{children}</p>;
}
