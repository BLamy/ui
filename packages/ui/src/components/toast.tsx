'use client';
import { createContext, use, type CSSProperties, type ComponentProps, type ReactNode } from 'react';
import {
  Toast as SdkToast, ToastAction as SdkToastAction, ToastClose as SdkToastClose, ToastDescription as SdkToastDescription,
  ToastRegion as SdkToastRegion, ToastTitle as SdkToastTitle, createToaster, toast,
  type ToastRegionProps as SdkToastRegionProps, type ToastType,
} from '@ui-sdk/react/toast';
import { createOverlays } from '@ui-sdk/core/overlays';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon, type IconName } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { closeButtonVariants } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { TextMorph } from '@/components/ui/text-morph';

/* ══ Toast — banners and HUDs ══
   UI SDK's Toast with the kit's two looks. UI SDK owns the queue (`toast()`, `createToaster()`), the timers (they
   pause while the pointer or focus is in the region, and while the page is hidden), the region (a landmark, F6
   moves focus in and back), swiping a toast away, the stack's measurements, presence and the announcements.
   - `banner`: a card with a title, an optional description, action and close button. Banners pile up at the
     region's edge: the newest in front, the ones before it peeking out behind, a little smaller. Hover or focus
     the pile and it spreads into a list.
   - `hud`: the dark "Copied" pill, an icon and a short label, gone in a moment. One pill at a time: showing
     another while it is up updates it in place, and its label morphs.

     <ToastRegion />                               // once, near the root: the banners of `toast()`
     <ToastRegion variant="hud" />                 // and the pill of `hud()`
     toast('Saved', { description: 'Your changes are live.' })
     toast.promise(save(), { loading: 'Saving…', success: 'Saved', error: 'Couldn’t save' })
     hud('Password Copied', { type: 'success' })

   A region shows one queue. `createToaster()` (banners) and `createHud()` make a queue for a region of your own:
   pass it as `toaster`. A region renders into BLProvider's root (see `useLayerHost`), so a block's toasts stay
   inside the block's frame and keep its theme. An icon goes in a toast's `data`:
   `toast('Sent', { data: { icon: 'paperplane' } })`. */

export { toast, createToaster };
export type {
  ToastActionData, ToastCancel, ToastData, ToastDismissDetails, ToastDismissReason, ToastItem, ToastOptions, ToastRegionState,
  ToastState, ToastType, Toaster,
} from '@ui-sdk/react/toast';

export type ToastVariant = 'banner' | 'hud';

/** A queue whose toasts hold any React node: the page's `toast`, or one from `createToaster()`. */
type Queue = typeof toast;
type QueueOptions = NonNullable<Parameters<Queue>[1]>;
type RenderToast = NonNullable<SdkToastRegionProps['children']>;

/** What the kit's toasts read from a toast's `data`. */
export interface ToastExtras {
  /** An `Icon` name or any node, in place of the icon the toast's type gives it. */
  icon?: IconName | ReactNode;
}

/* ── The HUD ── */

const HUD_ID = 'hud';

type ShowHud = (title: QueueOptions['title'], options?: Omit<QueueOptions, 'id' | 'title'>) => string;

/** Shows the pill, or updates the one that is up, and returns the toast's id. `toaster` is the queue behind it:
    `<ToastRegion variant="hud" toaster={hud.toaster} />`. */
export type Hud = ShowHud & { toaster: Queue };

/** A HUD of your own, for a region inside a block or a panel. Its toasts last `duration` ms (default 1600) and
    can't be swiped or closed; every call replaces what the pill says, so nothing of the last one carries over. */
export function createHud({ duration = 1600 }: { duration?: number } = {}): Hud {
  // A registry of its own, so an overlay host never draws the pill as a banner: a HUD region shows it.
  const toaster = createToaster({ duration, overlays: createOverlays() });
  const show: ShowHud = (title, options) =>
    toaster({
      type: 'default', duration, dismissible: false, description: undefined, action: undefined, cancel: undefined, data: undefined,
      onDismiss: undefined, ...options, title, id: HUD_ID,
    });
  return Object.assign(show, { toaster });
}

/** The page's HUD: `hud('Password Copied', { type: 'success' })`, shown by `<ToastRegion variant="hud" />`. */
export const hud: Hud = createHud();

/* ── The nearest queue ── */

const ToasterContext = createContext<Queue | null>(null);

/** Gives the parts below a queue of their own to send to (see `useToast`). */
export function ToastProvider({ toaster, children }: { toaster: Queue; children?: ReactNode }) {
  return <ToasterContext value={toaster}>{children}</ToasterContext>;
}

/** The queue of the nearest `ToastProvider`, or the page's `toast` outside one. */
export function useToast(): Queue {
  return use(ToasterContext) ?? toast;
}

/* ── Region ── */

/** Where the region sits and how its toasts are laid out. The offset is `--bl-toast-offset`; `--bl-toast-dir` is the
    way "further in" points for the toasts (down from the top edge, up from the bottom one). */
export const toastRegionVariants = cva(
  'group/toasts outline-none data-[side=top]:top-[calc(env(safe-area-inset-top,0px)_+_var(--bl-toast-offset))] data-[side=top]:[--bl-toast-dir:1] data-[side=bottom]:bottom-[calc(var(--keyboard-inset,0px)_+_env(safe-area-inset-bottom,0px)_+_var(--bl-toast-offset))] data-[side=bottom]:[--bl-toast-dir:-1] data-[align=start]:start-[calc(env(safe-area-inset-left,0px)_+_var(--bl-toast-offset))] data-[align=end]:end-[calc(env(safe-area-inset-right,0px)_+_var(--bl-toast-offset))]',
  {
    variants: {
      variant: {
        /* As tall as the pile (the front card and up to two peeks) or, spread, as the whole list with its gaps, so
           the pointer stays "in the region" between two cards. */
        banner:
          'h-[calc(var(--toast-front-height)_+_clamp(0,var(--toast-count)_-_1,2)_*_14px)] w-[min(360px,calc(100%-32px))] transition-[height] duration-spring-smooth ease-spring-smooth data-expanded:h-[calc(var(--toast-stack-height)_+_max(0,var(--toast-count)_-_1)_*_10px)] motion-reduce:transition-none',
        hud: 'w-max max-w-[calc(100%-32px)] *:flex *:flex-col *:items-center *:gap-2',
      },
    },
    defaultVariants: { variant: 'banner' },
  },
);

interface ToastScope {
  toast: Parameters<RenderToast>[0];
  variant: ToastVariant;
}
const ToastScopeContext = createContext<ToastScope | null>(null);

function useToastScope(part: string): ToastScope {
  const scope = use(ToastScopeContext);
  if (!scope) throw new Error(`${part} must be used inside a <ToastRegion>'s toast.`);
  return scope;
}

export interface ToastRegionProps extends Omit<SdkToastRegionProps, 'children'>, VariantProps<typeof toastRegionVariants> {
  /** Renders each toast, from `Toast` and its parts. Without it, the kit's toast for the region's `variant`. */
  children?: (...args: Parameters<RenderToast>) => ReactNode;
  /** Distance from the region's edges in px (default 24). */
  offset?: number;
}

/** The toast region. Place one per queue: without a `toaster`, a banner region shows the queue of the nearest
    `ToastProvider` (what `useToast()` sends to), else the page's `toast()`, and a HUD region the page's `hud()`.
    Without children it renders the kit's toast for its `variant`; a children function
    renders each toast from `Toast` and its parts. */
export function ToastRegion({
  variant, toaster, side = 'bottom', align = 'center', maxVisible, offset = 24, container, className, style, render, children, ...props
}: ToastRegionProps) {
  const look = variant ?? 'banner';
  const host = useLayerHost();
  const scope = useThemeScopeProps();
  const provided = use(ToasterContext);
  return (
    <SdkToastRegion
      toaster={toaster ?? (look === 'hud' ? hud.toaster : (provided ?? undefined))}
      side={side}
      align={align}
      maxVisible={maxVisible ?? (look === 'hud' ? 1 : 5)}
      container={container === undefined ? host : container}
      data-variant={look}
      data-theme-scope={scope['data-theme-scope']}
      className={cx([toastRegionVariants({ variant: look }), scope.className], className)}
      style={scopeStyle({ ...scope.style, '--bl-toast-offset': `${offset}px` } as CSSProperties, style)}
      /* An empty region has no name, so agents don't see it until it holds a toast. */
      render={render ?? ((regionProps, state) => <div {...regionProps} data-agent-hidden={state.toasts.length ? undefined : ''} />)}
      {...props}
    >
      {(item, entry) => (
        <ToastScopeContext value={{ toast: item, variant: look }}>
          {children ? children(item, entry) : look === 'hud' ? <HudToast /> : <BannerToast />}
        </ToastScopeContext>
      )}
    </SdkToastRegion>
  );
}

/* ── Toast ── */

/** A toast's surface: the banner card, placed in the pile from the variables UI SDK writes (`--toast-index`,
    `--toast-offset`, `--toast-height`, the swipe offsets), or the dark HUD pill (the `hud` material, the same in light
    and dark, as on iOS; `--hud` / `--hud-foreground` retheme it). Moves ride the snappy spring, a card's height the smooth one; fades are short tweens,
    quicker on the way out. Under reduced motion only the fades are left. */
export const toastVariants = cva('flex outline-none focus-visible:ring-2 focus-visible:ring-primary', {
  variants: {
    variant: {
      banner: [
        'absolute inset-x-0 z-[calc(100_-_var(--toast-index))] box-border h-(--toast-height) items-start gap-3 overflow-hidden rounded-card bg-card px-3.5 py-3 text-foreground opacity-(--bl-toast-opacity) shadow-popover select-none',
        'group-data-[side=bottom]/toasts:bottom-0 group-data-[side=bottom]/toasts:origin-top group-data-[side=top]/toasts:top-0 group-data-[side=top]/toasts:origin-bottom',
        /* Piled: each card behind sits 14px further in and 5% smaller, three deep (deeper ones hide behind the last). */
        '[--bl-toast-layer:min(var(--toast-index),2)] [--bl-toast-opacity:clamp(0,3_-_var(--toast-index),1)] [--bl-toast-scale:calc(1_-_var(--bl-toast-layer)_*_.05)] [--bl-toast-y:calc(var(--bl-toast-dir)_*_var(--bl-toast-layer)_*_14px)] motion-reduce:[--bl-toast-scale:1]',
        '[scale:var(--bl-toast-scale)] [translate:calc(var(--toast-swipe-x,0px)_+_var(--bl-toast-exit-x,0px))_calc(var(--bl-toast-y)_+_var(--toast-swipe-y,0px)_+_var(--bl-toast-shift,0px))]',
        '[transition:translate_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy),height_var(--duration-spring-smooth)_var(--ease-spring-smooth),opacity_.22s_cubic-bezier(.22,1,.36,1),filter_.22s_cubic-bezier(.22,1,.36,1)] motion-reduce:[transition:opacity_.15s_linear]',
        /* Spread: each card at its own size, below the ones in front of it with a 10px gap. */
        'data-expanded:[--bl-toast-opacity:1] data-expanded:[--bl-toast-scale:1] data-expanded:[--bl-toast-y:calc(var(--bl-toast-dir)_*_(var(--toast-offset)_+_var(--toast-index)_*_10px))]',
        /* Behind the front card: clipped to its height (a tall card never pokes out), its content hidden. */
        '*:transition-opacity *:duration-150 not-data-front:not-data-expanded:pointer-events-none not-data-front:not-data-expanded:h-(--toast-front-height) not-data-front:not-data-expanded:shadow-[inset_0_0_0_.5px_var(--border)] not-data-front:not-data-expanded:*:opacity-0',
        /* In: the newest rises from the edge with a blur; one that takes a freed place behind it fades in there. */
        'data-starting-style:opacity-0 data-starting-style:transition-none motion-safe:data-starting-style:data-front:blur-xs motion-safe:data-starting-style:data-front:[--bl-toast-scale:.96] motion-safe:data-starting-style:data-front:[--bl-toast-shift:calc(var(--bl-toast-dir)_*_-28px)]',
        /* Out: back toward the edge, or on the way it was swiped; a card behind shrinks where it is. */
        'data-ending-style:opacity-0 data-ending-style:[transition:translate_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy),opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit)] motion-safe:data-ending-style:data-front:blur-xs motion-safe:data-ending-style:data-front:[--bl-toast-scale:.96] motion-safe:data-ending-style:data-front:not-data-swipe-direction:[--bl-toast-shift:calc(var(--bl-toast-dir)_*_-20px)] motion-safe:data-ending-style:not-data-front:[--bl-toast-scale:.92]',
        'data-swiping:transition-none data-[swipe-direction=down]:[--bl-toast-shift:100%] data-[swipe-direction=left]:[--bl-toast-exit-x:-100%] data-[swipe-direction=right]:[--bl-toast-exit-x:100%] data-[swipe-direction=up]:[--bl-toast-shift:-100%]',
      ],
      hud: [
        'w-fit items-center gap-2 rounded-full bg-hud px-4 py-2.5 text-detail font-semibold text-hud-foreground shadow-hud backdrop-blur-xl backdrop-saturate-150',
        '[transition:translate_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),opacity_.22s_cubic-bezier(.22,1,.36,1),filter_.22s_cubic-bezier(.22,1,.36,1)] motion-reduce:[transition:opacity_.15s_linear]',
        'data-starting-style:opacity-0 data-starting-style:transition-none motion-safe:data-starting-style:scale-[.85] motion-safe:data-starting-style:blur-xs motion-safe:data-starting-style:[translate:0_calc(var(--bl-toast-dir)_*_-16px)]',
        'data-ending-style:opacity-0 data-ending-style:[transition:translate_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy),opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit)] motion-safe:data-ending-style:scale-[.85] motion-safe:data-ending-style:blur-xs motion-safe:data-ending-style:[translate:0_calc(var(--bl-toast-dir)_*_-16px)]',
      ],
    },
  },
  defaultVariants: { variant: 'banner' },
});

export type ToastProps = ComponentProps<typeof SdkToast> & VariantProps<typeof toastVariants>;

/** One toast. In a region it takes the region's `variant`. */
export function Toast({ className, variant, ...props }: ToastProps) {
  const scope = use(ToastScopeContext);
  const look = variant ?? scope?.variant ?? 'banner';
  return <SdkToast data-variant={look} className={cx(toastVariants({ variant: look }), className)} {...props} />;
}

/** The icon's color per type. */
export const toastIconVariants = cva('grid shrink-0 place-items-center', {
  variants: {
    type: {
      default: 'text-primary',
      info: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      error: 'text-destructive',
      loading: '',
    },
  },
  defaultVariants: { type: 'default' },
});

/* HUDs use the bare glyph (on the dark pill); banners the filled circle SF uses in notifications. */
const TYPE_ICON: Record<ToastVariant, Partial<Record<ToastType, IconName>>> = {
  hud: { success: 'check', info: 'info', warning: 'warning', error: 'xmark' },
  banner: { success: 'check-circle-fill', info: 'info-fill', warning: 'warning-fill', error: 'xmark-circle-fill' },
};

export type ToastIconProps = ComponentProps<'span'>;

/** The toast's icon: a spinner while it is `loading`, else `data.icon`, else the glyph for its type (none for `default`).
    Children replace it. Other props go on its `span`. */
export function ToastIcon({ children, className, ...props }: ToastIconProps) {
  const { toast: item, variant } = useToastScope('ToastIcon');
  const pill = variant === 'hud';
  if (item.type === 'loading' && children == null) {
    return (
      <span data-slot="toast-icon" aria-hidden="true" className={cn('grid shrink-0 place-items-center self-center opacity-80', className)} {...props}>
        <Spinner size={pill ? 14 : 18} />
      </span>
    );
  }
  const icon = (item.data as ToastExtras | undefined)?.icon ?? TYPE_ICON[variant][item.type];
  if (children == null && icon == null) return null;
  return (
    <span data-slot="toast-icon" aria-hidden="true" className={cn(toastIconVariants({ type: item.type }), className)} {...props}>
      {children ?? (typeof icon === 'string' ? <Icon name={icon} size={pill ? 16 : 20} sw={pill ? 2.6 : 2.2} /> : icon)}
    </span>
  );
}

/** The toast's title (its `title` without children). A HUD's plain-text title morphs into the next one. */
export function ToastTitle({ className, children, ...props }: ComponentProps<typeof SdkToastTitle>) {
  const { toast: item, variant } = useToastScope('ToastTitle');
  const pill = variant === 'hud';
  const text = children ?? item.title;
  return (
    <SdkToastTitle className={cx(pill ? 'whitespace-nowrap' : 'text-subhead leading-snug font-semibold', className)} {...props}>
      {pill && typeof text === 'string' ? <TextMorph>{text}</TextMorph> : children}
    </SdkToastTitle>
  );
}

/** The toast's second line (its `description` without children). */
export function ToastDescription({ className, ...props }: ComponentProps<typeof SdkToastDescription>) {
  return <SdkToastDescription className={cx('mt-0.5 text-footnote leading-snug text-muted-foreground', className)} {...props} />;
}

const toastButton =
  'bl-btn shrink-0 cursor-pointer self-center rounded-full border-0 bg-secondary px-3 py-1.5 text-footnote font-semibold outline-none transition-[background-color,scale,opacity] duration-spring-snappy ease-spring-snappy hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-primary active:scale-95 data-pending:cursor-progress data-pending:opacity-60';

/** The toast's action, like Undo (its `action` without children; a link when the action has an `href`). */
export function ToastAction({ className, ...props }: ComponentProps<typeof SdkToastAction>) {
  return <SdkToastAction className={cx([toastButton, 'text-primary no-underline'], className)} {...props} />;
}

/** Closes the toast: the round ✕ without children, a labelled button (the toast's `cancel`) with them. */
export function ToastClose({ className, children, 'aria-label': label, ...props }: ComponentProps<typeof SdkToastClose>) {
  const plain = children == null;
  return (
    <SdkToastClose
      aria-label={label ?? (plain ? 'Close' : undefined)}
      className={cx(
        plain
          // Every surface's round × (closeButtonVariants), with a 44px hit area: banners are swiped and closed on phones.
          ? [closeButtonVariants(), 'relative -mt-1 -me-1.5 after:absolute after:-inset-2 data-pending:cursor-progress']
          : [toastButton, 'text-foreground'],
        className,
      )}
      {...props}
    >
      {plain ? <Icon name="x" size={15} sw={2.6} /> : children}
    </SdkToastClose>
  );
}

/** The kit's banner: icon, title, description, action, the toast's `cancel` button and the ✕ (unless it isn't `dismissible`). */
function BannerToast() {
  const { toast: item } = useToastScope('Toast');
  return (
    <Toast>
      <ToastIcon />
      <div className="min-w-0 flex-1 pt-px">
        <ToastTitle />
        <ToastDescription />
      </div>
      <ToastAction />
      {item.cancel ? <ToastClose action={item.cancel.onCancel}>{item.cancel.label}</ToastClose> : null}
      {item.dismissible !== false ? <ToastClose /> : null}
    </Toast>
  );
}

/** The kit's HUD pill: icon and title. */
function HudToast() {
  return (
    <Toast>
      <ToastIcon />
      <ToastTitle />
    </Toast>
  );
}
