/* Pieces the detail views share: the grouped card and its rows, copy buttons with their confirmation, the
   password that reveals by morphing, the verification code with its countdown ring, and the "Copied" HUD. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Haptics, IconSwap, NumberMorph, TextMorph, cn } from '@brett_lamy/ui';
import { codeFor } from './data';
import { Glyph } from './glyphs';

/* ── Clock ──
   Seconds on a fixed sample epoch, so codes are the same on every load; `live` advances it once a second. */
const EPOCH = 1_790_000_018;
export function useClock(live: boolean) {
  const [t, setT] = useState(EPOCH);
  useEffect(() => {
    if (!live) return;
    const start = performance.now();
    const id = setInterval(() => setT(EPOCH + Math.floor((performance.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [live]);
  return t;
}

/* ── Copy confirmation ──
   One HUD for the whole app: copying again while it's up morphs its label instead of stacking a second one. */
export interface Toast { label: string; n: number }
export function useCopy() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = (label: string, value: string) => {
    try { void navigator.clipboard?.writeText(value).catch(() => {}); } catch { /* no clipboard */ }
    Haptics.notification('success');
    setToast((t) => ({ label: `${label} Copied`, n: (t?.n ?? 0) + 1 }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1600);
  };
  return { toast, copy };
}
export type CopyFn = (label: string, value: string) => void;

export function CopyHud({ toast }: { toast: Toast | null }) {
  const [last, setLast] = useState(toast);
  if (toast && toast !== last) setLast(toast);
  return (
    <div role="status" aria-live="polite"
      className={cn(
        'pointer-events-none absolute bottom-6 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5',
        'bg-[rgba(30,30,32,.86)] text-[14px] font-semibold text-white shadow-[0_8px_30px_rgba(0,0,0,.25)] backdrop-blur-xl',
        'transition-[opacity,scale,translate] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
        toast ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-90 opacity-0',
      )}>
      <Glyph name="check" size={16} sw={2.6} className="text-[#30D158]" />
      <TextMorph>{last?.label ?? ''}</TextMorph>
    </div>
  );
}

export function CopyButton({ label, value, onCopy }: { label: string; value: string; onCopy: CopyFn }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button type="button" aria-label={`Copy ${label}`}
      onClick={() => {
        onCopy(label, value);
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1400);
      }}
      className={cn(
        'bl-btn grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-primary',
        'transition-[background-color,opacity,scale] duration-spring-snappy ease-spring-snappy hover:bg-bl-fill active:scale-90',
      )}>
      <IconSwap id={done ? 'done' : 'copy'}>
        {done ? <Glyph name="check" size={17} sw={2.4} className="text-bl-green" /> : <Glyph name="copy" size={17} />}
      </IconSwap>
    </button>
  );
}

/* ── Grouped card + rows ── */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[12px] bg-bl-card shadow-[0_0_0_.5px_var(--bl-sep)]', className)}>{children}</div>;
}

/** Label beside the value on a wide detail, above it on a narrow one (a container query on the detail). */
export function Field({ label, children, trailing, last }: { label: string; children: ReactNode; trailing?: ReactNode; last?: boolean }) {
  return (
    <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1 @md:flex @md:items-center @md:gap-4">
        <div className="text-[13px] text-muted-foreground @md:w-[128px] @md:shrink-0 @md:text-right @md:text-[14px]">{label}</div>
        <div className="min-w-0 truncate text-[16px] @md:flex-1 @md:text-[15px]">{children}</div>
      </div>
      {trailing}
      {!last ? <span aria-hidden="true" className="absolute right-0 bottom-0 left-4 h-px bg-bl-sep @md:left-[160px]" /> : null}
    </div>
  );
}

/* ── Password: masked dots morph into the characters (hover on a mouse, or the eye button) ── */
export function PasswordValue({ password, revealed }: { password: string; revealed: boolean }) {
  return (
    <span className={cn('font-mono tracking-[.02em]', !revealed && 'tracking-[.12em]')} aria-label={revealed ? password : 'Hidden password'}>
      <TextMorph>{revealed ? password : '•'.repeat(Math.min(14, Math.max(10, password.length)))}</TextMorph>
    </span>
  );
}

export function RevealButton({ revealed, onToggle }: { revealed: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-label={revealed ? 'Hide password' : 'Show password'} aria-pressed={revealed}
      onClick={() => { Haptics.selection(); onToggle(); }}
      className="bl-btn grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-bl-fill active:scale-90">
      <IconSwap id={revealed ? 'off' : 'on'}><Glyph name={revealed ? 'eyeOff' : 'eye'} size={18} /></IconSwap>
    </button>
  );
}

/* ── Verification code ──
   Two three-digit halves whose digits roll when the window turns over; the ring drains with the seconds
   (a clock, so it runs linearly) and turns red for the last five. */
export function useCode(seed: string, now: number) {
  const step = Math.floor(now / 30);
  return { code: codeFor(seed, step), left: 30 - (now % 30) };
}

export function CodeValue({ seed, now, size = 'md' }: { seed: string; now: number; size?: 'md' | 'lg' }) {
  const { code, left } = useCode(seed, now);
  const fmt = { minimumIntegerDigits: 3, useGrouping: false };
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-medium tabular-nums', size === 'lg' ? 'text-[22px]' : 'text-[17px]')}>
      <span className="inline-flex gap-[.3em]">
        <NumberMorph value={Math.floor(code / 1000)} format={fmt} />
        <NumberMorph value={code % 1000} format={fmt} />
      </span>
      <CodeRing left={left} />
    </span>
  );
}

export function CodeRing({ left, size = 26 }: { left: number; size?: number }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const urgent = left <= 5;
  // A full ring at the turnover would spin backwards through the transition; jump instead.
  const full = left === 30;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}
      role="timer" aria-label={`${left} seconds left`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bl-fill2)" strokeWidth="2.4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2.4" strokeLinecap="round"
          stroke={urgent ? 'var(--bl-red)' : 'var(--bl-tint)'} strokeDasharray={c} strokeDashoffset={c * (1 - left / 30)}
          style={{ transition: full ? 'none' : 'stroke-dashoffset 1s linear, stroke .3s' }} />
      </svg>
      <span className={cn('absolute text-[10px] font-semibold tabular-nums', urgent ? 'text-bl-red' : 'text-muted-foreground')} aria-hidden="true">
        {left}
      </span>
    </span>
  );
}

/* ── Header of every detail: the big tile, the title, when it last changed ── */
export function DetailHeader({ icon, title, subtitle }: { icon: ReactNode; title: ReactNode; subtitle: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 pt-7 pb-3 text-center">
      {icon}
      <div className="w-full max-w-[420px] min-w-0">
        <div className="truncate text-[24px] font-bold tracking-[-.3px] @md:text-[26px]">{title}</div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}
