/* Pieces the columns share: site and Wi-Fi tiles, the grouped card and its rows, copy buttons (confirmed by the
   block's "Copied" HUD), the password that reveals by morphing, and the verification code with its countdown ring. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CountdownRing, Icon, IconSwap, NumberMorph, TextMorph, cn, useCountdown, useToast } from '@brett_lamy/ui';
import { codeFor } from './data';

/* ── Clock ──
   30-second code windows counted from a fixed sample epoch, so codes are the same on every load; `live` runs the
   library's useCountdown (wall clock, so a frozen clock — a screenshot run — freezes the codes too). */
const EPOCH = 1_790_000_018;
export interface CodeClock { /** The current 30s window. */ step: number; /** Seconds left in it. */ left: number }
export function useClock(live: boolean): CodeClock {
  const { remaining, period } = useCountdown(30, { running: live, offset: EPOCH % 30 });
  return { step: Math.floor(EPOCH / 30) + period, left: remaining };
}

/* ── Tiles ── */
/** A site's tile: its initial on its color, with the soft top light Apple's generated icons have. */
export function SiteTile({ title, color, size = 32, className }: { title: string; color: string; size?: number; className?: string }) {
  return (
    <span aria-hidden="true"
      className={cn('grid shrink-0 place-items-center font-semibold text-white shadow-[inset_0_0_0_.5px_black] shadow-black/12', className)}
      style={{
        width: size, height: size, borderRadius: size * 0.24, fontSize: size * 0.46,
        background: `linear-gradient(180deg, color-mix(in oklab, ${color} 78%, white), ${color})`,
      }}>
      {title[0]}
    </span>
  );
}

/** The Wi-Fi tile's color (iOS system cyan, fixed). */
const WIFI_BLUE = '#32ADE6';

export function WifiTile({ size = 32 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center text-white" style={{ width: size, height: size, borderRadius: size * 0.24, background: WIFI_BLUE }}>
      <Icon name="wifi" size={Math.round(size * 0.6)} weight="medium" />
    </span>
  );
}

/* ── Copy ── copies, flips to a check for a moment, and shows "<label> Copied" in the block's HUD. */
export function CopyButton({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button type="button" aria-label={`Copy ${label}`}
      onClick={() => {
        try { void navigator.clipboard?.writeText(value).catch(() => {}); } catch { /* no clipboard */ }
        toast.hud(`${label} Copied`, { tone: 'success' });
        setDone(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setDone(false), 1400);
      }}
      className={cn(
        'bl-btn grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-primary',
        'transition-[background-color,opacity,scale] duration-spring-snappy ease-spring-snappy hover:bg-secondary active:scale-90',
      )}>
      <IconSwap id={done ? 'done' : 'copy'}>
        <Icon name={done ? 'check' : 'copy'} size={17} weight={done ? 'bold' : 'regular'} className={cn(done && 'text-success')} />
      </IconSwap>
    </button>
  );
}

/* ── Grouped card + rows ── */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-[12px] bg-card shadow-[0_0_0_.5px_var(--border)]', className)}>{children}</div>;
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
      {!last ? <span aria-hidden="true" className="absolute right-0 bottom-0 left-4 h-px bg-border @md:left-[160px]" /> : null}
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
      onClick={() => onToggle()}
      className="bl-btn grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-secondary active:scale-90">
      <IconSwap id={revealed ? 'off' : 'on'}><Icon name={revealed ? 'eye-slash' : 'eye'} size={18} /></IconSwap>
    </button>
  );
}

/* ── Verification code: two three-digit halves whose digits roll when the window turns over ── */
export function useCode(seed: string, now: CodeClock) {
  return { code: codeFor(seed, now.step), left: now.left };
}

export function CodeValue({ seed, now, size = 'md' }: { seed: string; now: CodeClock; size?: 'md' | 'lg' }) {
  const { code, left } = useCode(seed, now);
  const fmt = { minimumIntegerDigits: 3, useGrouping: false };
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-medium tabular-nums', size === 'lg' ? 'text-[22px]' : 'text-[17px]')}>
      <span className="inline-flex gap-[.3em]">
        <NumberMorph value={Math.floor(code / 1000)} format={fmt} />
        <NumberMorph value={code % 1000} format={fmt} />
      </span>
      <CountdownRing remaining={left} size={26} thickness={2.4} labelSize="sm" />
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
