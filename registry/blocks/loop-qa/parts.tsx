/* Loop QA's visual vocabulary: the palette, the mark, status badges (severity, bug status, run status,
   environment), the site thumbnails on project cards, sparklines and severity bars, stat tiles and panels. */
import type { CSSProperties, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button, type ButtonProps } from '@/components/ui/button';
import { NumberMorph } from '@/components/ui/number-morph';
import { Spinner } from '@/components/ui/spinner';
import { TooltipTrigger, Tooltip } from '@/components/ui/tooltip';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  SEVERITY_LABEL, STATUS_LABEL, type BugKind, type BugStatus, type Environment, type RunStatus, type Severity, type SiteKind,
} from './data';

/* ── Palette ──
   Cool, recessive neutrals so status colors and data carry the page, and Replay's crimson for what's interactive.
   Like github-clone's Primer palette, it overrides the theme's shadcn variables on the block's root; --lq-info is
   the one extra (indigo: open bugs, informational states). */
const PALETTE = {
  light: {
    bg: '#FFFFFF', card: '#FFFFFF', muted: '#F6F7F9', side: '#F7F8FA', popover: '#FFFFFF',
    fg: '#15151C', fg2: '#646876', fg3: '#A2A6B2', border: 'rgba(20,24,40,.09)',
    fill: 'rgba(20,24,40,.05)', fill2: 'rgba(20,24,40,.09)', press: 'rgba(20,24,40,.06)',
    tint: '#F02D5E', success: '#0FA971', warning: '#E88A06', red: '#E5484D', info: '#5B5BD6',
    bar: 'rgba(255,255,255,.82)', code: '#15151C', codeFg: '#E4E4EC',
  },
  dark: {
    bg: '#0E0E12', card: '#15151B', muted: '#121217', side: '#0B0B0F', popover: '#1B1B22',
    fg: '#EDEDF3', fg2: '#9A9AAB', fg3: '#62626F', border: 'rgba(255,255,255,.075)',
    fill: 'rgba(255,255,255,.055)', fill2: 'rgba(255,255,255,.1)', press: 'rgba(255,255,255,.07)',
    tint: '#FF3D6E', success: '#3DD68C', warning: '#FFB224', red: '#FF6369', info: '#8B8DF8',
    bar: 'rgba(14,14,18,.8)', code: '#0A0A0D', codeFg: '#E4E4EC',
  },
} as const;

function vars(dark: boolean): CSSProperties {
  const c = PALETTE[dark ? 'dark' : 'light'];
  return {
    '--background': c.bg, '--foreground': c.fg, '--card': c.card, '--card-foreground': c.fg,
    '--popover': c.popover, '--popover-foreground': c.fg, '--primary': c.tint, '--primary-foreground': '#FFFFFF', '--ring': c.tint,
    '--secondary': c.fill, '--secondary-foreground': c.fg, '--input': c.fill, '--muted': c.muted, '--muted-foreground': c.fg2,
    '--accent': c.press, '--accent-foreground': c.fg, '--destructive': c.red, '--border': c.border,
    '--sidebar': c.side, '--sidebar-foreground': c.fg, '--sidebar-accent': c.fill, '--sidebar-accent-foreground': c.fg,
    '--sidebar-border': c.border, '--sidebar-primary': c.tint, '--sidebar-ring': c.tint,
    '--success': c.success, '--warning': c.warning, '--tertiary-foreground': c.fg3, '--secondary-strong': c.fill2,
    '--bar': c.bar, '--sticky': c.bar, '--link': c.tint, '--code': c.code, '--code-foreground': c.codeFg,
    '--lq-info': c.info,
  } as CSSProperties;
}

/** The block root's theme override, per appearance. */
export const LOOP_THEME = { light: vars(false), dark: vars(true) } as const;
export const LOOP_TINT = { light: PALETTE.light.tint, dark: PALETTE.dark.tint } as const;

/* ── The mark: a crimson tile with a looping play glyph ── */
export function LoopMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="28" height="28" rx="8" className="fill-primary" />
      <path d="M10.2 8.6c0-.9 1-1.5 1.8-1l8 4.9c.8.5.8 1.6 0 2.1l-8 4.9c-.8.5-1.8-.1-1.8-1z" fill="white" />
      <path d="M7 19.5a8.6 8.6 0 0 0 13.6 1.7" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Badges ── */
export const pillVariants = cva(
  'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        critical: 'bg-destructive text-white',
        danger: 'bg-destructive/12 text-destructive',
        warning: 'bg-warning/14 text-warning',
        info: 'bg-(--lq-info)/13 text-(--lq-info)',
        success: 'bg-success/13 text-success',
        primary: 'bg-primary/12 text-primary',
        neutral: 'bg-secondary text-muted-foreground',
        outline: 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);
export type PillTone = NonNullable<VariantProps<typeof pillVariants>['tone']>;

export function Pill({ tone, dot, className, children }: { tone?: PillTone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn(pillVariants({ tone }), className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export const SEVERITY_TONE: Record<Severity, PillTone> = { critical: 'critical', high: 'danger', medium: 'warning', low: 'info' };
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return <Pill tone={SEVERITY_TONE[severity]} className={className}>{SEVERITY_LABEL[severity]}</Pill>;
}

export const STATUS_TONE: Record<BugStatus, PillTone> = { open: 'info', confirmed: 'primary', unconfirmed: 'outline', fixed: 'success', dismissed: 'neutral' };
export const STATUS_DOT: Record<BugStatus, string> = {
  open: 'bg-(--lq-info)', confirmed: 'bg-primary', unconfirmed: 'bg-tertiary-foreground', fixed: 'bg-success', dismissed: 'bg-muted-foreground',
};
export function StatusBadge({ status, className }: { status: BugStatus; className?: string }) {
  return <Pill tone={STATUS_TONE[status]} dot className={className}>{STATUS_LABEL[status]}</Pill>;
}

const RUN_META: Record<RunStatus, { tone: PillTone; label: string; icon?: string }> = {
  running: { tone: 'primary', label: 'Running' },
  completed: { tone: 'success', label: 'Completed', icon: 'check' },
  failed: { tone: 'danger', label: 'Failed', icon: 'xmark' },
  blocked: { tone: 'warning', label: 'Blocked', icon: 'exclamation-circle' },
};
export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const m = RUN_META[status];
  return (
    <Pill tone={m.tone} className={className}>
      {status === 'running' ? <Spinner size={11} /> : <Icon name={m.icon!} size={11} sw={2.6} />}
      {m.label}
    </Pill>
  );
}

const ENV_TONE: Record<Environment, PillTone> = { Production: 'success', Preview: 'warning', Staging: 'info' };
export function EnvBadge({ env, className }: { env: Environment; className?: string }) {
  return <Pill tone={ENV_TONE[env]} dot className={cn('bg-transparent shadow-[inset_0_0_0_1px_color-mix(in_oklab,currentColor_32%,transparent)]', className)}>{env}</Pill>;
}

export const KIND_ICON: Record<BugKind, string> = {
  Functional: 'bolt', Network: 'network', Visual: 'eye', Performance: 'clock-dial', Accessibility: 'accessibility', Console: 'terminal',
};
export function KindLabel({ kind, className }: { kind: BugKind; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground', className)}>
      <Icon name={KIND_ICON[kind]} size={13} sw={2} />
      {kind}
    </span>
  );
}

/** A severity's color as a CSS color, for dots, bars and sparklines. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'var(--destructive)', high: 'color-mix(in oklab, var(--destructive) 70%, var(--warning))', medium: 'var(--warning)', low: 'var(--lq-info)',
};

/** A stacked bar of counts by severity. */
export function SeverityBar({ counts, className }: { counts: Record<Severity, number>; className?: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className={cn('flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-secondary', className)} aria-hidden="true">
      {total ? (Object.keys(counts) as Severity[]).map((s) => counts[s] ? (
        <span key={s} className="h-full rounded-[1px] bg-(--c) transition-[flex-grow] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none"
          style={{ flexGrow: counts[s], '--c': SEVERITY_COLOR[s] } as CSSProperties} />
      ) : null) : null}
    </div>
  );
}

/** Open bugs per run as a tiny area chart. */
export function Sparkline({ values, className, width = 72, height = 22 }: { values: number[]; className?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * width, height - 2 - (v / max) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible text-primary', className)} aria-hidden="true">
      <path d={`${line} L${width} ${height} L0 ${height}Z`} className="fill-current opacity-10" />
      <path d={line} fill="none" className="stroke-current" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" className="fill-current" />
    </svg>
  );
}

/* ── Site thumbnails: a tiny drawing of each project's site, in its brand color ── */
/** The drawn page's paper and code-block ink (content constants: a thumbnail is a picture of a light site). */
const THUMB = { paper: '#FBFBFC', ink: '#16161D' } as const;

export function SiteThumb({ kind, brand, className }: { kind: SiteKind; brand: string; className?: string }) {
  const b = { '--brand': brand, '--paper': THUMB.paper, '--ink': THUMB.ink } as CSSProperties;
  const line = (w: string, extra = '') => <span className={cn('block h-[5px] rounded-full bg-black/8', w, extra)} />;
  return (
    <div className={cn('relative isolate overflow-hidden bg-(--paper) text-[0]', className)} style={b} aria-hidden="true">
      <div className="flex h-[14%] items-center gap-[4%] border-b border-black/6 bg-white px-[6%]">
        <span className="h-[34%] w-[16%] rounded-full bg-(--brand)" />
        {line('w-[9%]')}{line('w-[9%]')}{line('w-[9%]')}
        <span className="ml-auto h-[40%] w-[12%] rounded-full bg-black/8" />
      </div>
      {kind === 'shop' ? (
        <div className="p-[6%]">
          <span className="block h-[9px] w-[46%] rounded-full bg-black/80" />
          {line('mt-[3%] w-[30%]')}
          <div className="mt-[6%] grid grid-cols-4 gap-[4%]">
            {['0.95', '0.7', '0.5', '0.3'].map((o) => (
              <div key={o} className="overflow-hidden rounded-[6px] bg-white shadow-[0_0_0_1px_--alpha(black/6%)]">
                <div className="aspect-[4/3] bg-(--brand)" style={{ opacity: o }} />
                <div className="p-[10%]">{line('w-[70%]')}<span className="mt-[14%] block h-[7px] rounded-[3px] bg-black/85" /></div>
              </div>
            ))}
          </div>
        </div>
      ) : kind === 'dashboard' ? (
        <div className="grid h-[86%] grid-cols-[22%_1fr]">
          <div className="space-y-[10%] border-r border-black/6 bg-white p-[12%]">{line('w-full')}{line('w-3/4')}{line('w-4/5')}{line('w-2/3')}</div>
          <div className="p-[6%]">
            <div className="grid grid-cols-3 gap-[4%]">
              {[0, 1, 2].map((i) => <div key={i} className="rounded-[6px] bg-white p-[8%] shadow-[0_0_0_1px_--alpha(black/6%)]">{line('w-1/2')}<span className="mt-[12%] block h-[9px] w-3/4 rounded-full bg-black/75" /></div>)}
            </div>
            <div className="mt-[5%] flex h-[46%] items-end gap-[3%] rounded-[6px] bg-white p-[5%] shadow-[0_0_0_1px_--alpha(black/6%)]">
              {[40, 62, 48, 80, 66, 92, 74, 58].map((h, i) => <span key={i} className="flex-1 rounded-t-[2px] bg-(--brand)" style={{ height: `${h}%`, opacity: 0.35 + i * 0.08 }} />)}
            </div>
          </div>
        </div>
      ) : kind === 'editor' ? (
        <div className="grid h-[86%] grid-cols-[24%_1fr_26%]">
          <div className="space-y-[12%] border-r border-black/6 bg-white p-[10%]">{line('w-full', 'bg-(--brand)/40')}{line('w-3/4')}{line('w-4/5')}{line('w-2/3')}</div>
          <div className="space-y-[5%] p-[8%]">
            <span className="block h-[10px] w-[60%] rounded-full bg-black/80" />
            {line('w-full')}{line('w-[92%]')}{line('w-[85%]')}
            <span className="block h-[22%] rounded-[4px] bg-(--brand)/12 shadow-[inset_2px_0_0_var(--brand)]" />
            {line('w-[70%]')}
          </div>
          <div className="space-y-[10%] border-l border-black/6 bg-white p-[10%]">
            <span className="block h-[16%] rounded-[6px] bg-black/6" /><span className="ml-auto block h-[12%] w-3/4 rounded-[6px] bg-(--brand)/80" />
          </div>
        </div>
      ) : kind === 'docs' ? (
        <div className="grid h-[86%] grid-cols-[24%_1fr]">
          <div className="space-y-[12%] border-r border-black/6 p-[10%]">{line('w-3/4', 'bg-(--brand)/60')}{line('w-full')}{line('w-4/5')}{line('w-2/3')}{line('w-3/4')}</div>
          <div className="space-y-[5%] p-[8%]">
            <span className="block h-[11px] w-1/2 rounded-full bg-black/80" />
            {line('w-full')}{line('w-[90%]')}
            <span className="block h-[30%] rounded-[5px] bg-(--ink)" />
            {line('w-[80%]')}
          </div>
        </div>
      ) : kind === 'todo' ? (
        <div className="mx-auto mt-[8%] w-[56%] space-y-[6%]">
          <span className="mx-auto block h-[10px] w-[30%] rounded-full bg-black/80" />
          <div className="flex gap-[4%]"><span className="h-[16px] flex-1 rounded-[4px] bg-white shadow-[0_0_0_1px_--alpha(black/10%)]" /><span className="h-[16px] w-[18%] rounded-[4px] bg-(--brand)" /></div>
          {[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-[4%]"><span className="size-[8px] rounded-full shadow-[0_0_0_1.5px_var(--brand)]" />{line(i === 1 ? 'w-1/2' : 'w-3/4')}</div>)}
        </div>
      ) : (
        <div className="relative h-[86%] bg-(--brand) p-[8%]">
          <span className="block h-[12px] w-[55%] rounded-full bg-white" />
          <span className="mt-[3%] block h-[12px] w-[40%] rounded-full bg-white/85" />
          <span className="mt-[4%] block h-[6px] w-[48%] rounded-full bg-white/50" />
          <span className="mt-[7%] block h-[16px] w-[22%] rounded-full bg-white" />
          <span className="absolute right-[6%] bottom-[10%] h-[50%] w-[34%] rounded-[8px] bg-white/20" />
        </div>
      )}
    </div>
  );
}

/* ── Surfaces ── */
export function Panel({ title, icon, trailing, children, className, bodyClassName }: {
  title?: ReactNode; icon?: string; trailing?: ReactNode; children?: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-[14px] border border-border bg-card', className)}>
      {title ? (
        <header className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
          {icon ? <Icon name={icon} size={15} sw={2} className="text-muted-foreground" /> : null}
          <h3 className="m-0 min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-[-.01em]">{title}</h3>
          {trailing}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function SectionLabel({ children, count, className }: { children: ReactNode; count?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-[11.5px] font-semibold tracking-[.06em] text-muted-foreground uppercase', className)}>
      {children}
      {count != null ? <span className="rounded-full bg-secondary px-1.5 py-px text-[11px] tracking-normal tabular-nums">{count}</span> : null}
    </div>
  );
}

export function StatTile({ label, value, icon, foot, children, onPress, className }: {
  label: string; value?: number; icon: string; foot?: ReactNode; children?: ReactNode; onPress?: () => void; className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between text-[12.5px] font-medium text-muted-foreground">
        {label}
        <Icon name={icon} size={15} sw={2} className="text-tertiary-foreground" />
      </div>
      {value != null ? <div className="mt-1.5 text-[30px] leading-9 font-semibold tracking-[-.03em] tabular-nums"><NumberMorph value={value} /></div> : null}
      {children}
      {foot ? <div className="mt-auto pt-2 text-[12px] text-muted-foreground">{foot}</div> : null}
    </>
  );
  const cls = cn('flex min-h-[124px] flex-col rounded-[14px] border border-border bg-card p-4 text-left', className);
  return onPress ? (
    <Pressable onPress={onPress} className={cn(cls, 'items-stretch justify-start gap-0 whitespace-normal cursor-pointer outline-none transition-[scale,background-color] duration-spring-snappy ease-spring-snappy data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-[.985] data-focus-visible:ring-2 data-focus-visible:ring-ring motion-reduce:transition-none')}>
      {body}
    </Pressable>
  ) : <div className={cls}>{body}</div>;
}

/** A bare pressable surface (a row, a card, a chip): the library Button without its look — no fill, border or
 *  padding (there is no preflight, so a plain <button> would bring the browser's), inheriting the text style. */
export function Pressable({ className, ...props }: Omit<ButtonProps, 'variant' | 'size'>) {
  return <Button variant={null} size={null} className={cn('m-0 border-0 bg-transparent p-0 text-left text-inherit [font:inherit]', className)} {...props} />;
}

/** Icon button for bars and headers, with a tooltip. */
export function BarButton({ label, icon, children, className, ...props }: Omit<ButtonProps, 'children' | 'className' | 'variant' | 'size'> & { label: string; icon?: string; children?: ReactNode; className?: string }) {
  return (
    <TooltipTrigger delay={600}>
      <Pressable aria-label={label} {...props}
        className={cn('inline-grid size-8 shrink-0 cursor-pointer place-items-center rounded-[9px] border-0 bg-transparent p-0 text-muted-foreground outline-none transition-[background-color,color,scale] duration-spring-snappy ease-spring-snappy  data-hovered:text-foreground data-pressed:not-aria-expanded:scale-95 data-focus-visible:ring-2 data-focus-visible:ring-ring data-disabled:opacity-40 motion-reduce:transition-none', className)}>
        {children ?? <Icon name={icon!} size={17} sw={1.9} />}
      </Pressable>
      <Tooltip placement="bottom">{label}</Tooltip>
    </TooltipTrigger>
  );
}

export function Avatar({ initials, className, tone = 0 }: { initials: string; className?: string; tone?: number }) {
  const tones = ['bg-primary text-primary-foreground', 'bg-(--lq-info) text-white', 'bg-success text-white', 'bg-warning text-white'];
  return (
    <span className={cn('inline-grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-2 ring-background', tones[tone % tones.length], className)}>
      {initials}
    </span>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12px]', className)}>{children}</span>;
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground"><Icon name={icon} size={20} sw={2} /></span>
      <div className="mt-3 text-[15px] font-semibold">{title}</div>
      <p className="m-0 mt-1 max-w-[340px] text-[13px] text-muted-foreground">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
