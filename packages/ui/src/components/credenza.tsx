'use client';
import { createContext, useCallback, useContext, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { createFocusRecovery } from '@ui-sdk/core';
import {
  DialogClose as SdkDialogClose,
  DialogContent as SdkDialogContent,
  DialogTitle as SdkDialogTitle,
} from '@ui-sdk/react/dialog';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { usePresenceList, useEnterExit, type PresenceEntry } from '@/lib/presence';
import { focusRing } from '@/lib/primitives';
import { scopeStyle, useThemeScopeProps } from '@/lib/theme';
import { cn, cx } from '@/lib/utils';
import { Dialog, DialogBackdrop, type DialogProps } from '@/components/ui/dialog';
import { AnimatedHeight, ContentSwap } from '@/components/ui/animated-height';

/* ══ Credenza — responsive dialog ⇄ tray with Family-style view morphing ══
   UI SDK's Dialog with `presentation="auto"`: a centered card while its container is medium or regular, a floating
   bottom tray you can drag down while it is compact (the nearest size-class scope around it, which the kit's Dialog
   reads from React context: BLProvider's root, a SplitView, a NavigationStack… so a phone frame counts as a phone
   and a controlled Credenza with no trigger follows the column it is rendered in). UI SDK owns the behavior: the focus trap, Escape (kept from the views behind), the inert host, focus
   return, the swipe and `dismissible`.
   The card springs its height to each view (tray spring); views travel in the direction of the flow — a new view
   arrives from the right, going back returns from the left — blurred through the middle; the title follows the same
   direction and the back chevron grows in and out of the header. Direction comes from the view history: a `view`
   seen before is "back".
   `dismissible={false}` makes it a step the user has to finish (a paywall, a sign-in gate): Escape, a press on the
   scrim and a drag down don't close it (the tray springs back and `onDismissAttempt` runs), and there is no × or
   grabber. A Close part with children, a controller or `open` still close it.
   <Credenza open={open} onOpenChange={setOpen} view={view}>
     <CredenzaBackdrop />
     <CredenzaContent>
       <CredenzaHeader>
         <CredenzaBack hidden={view === 'menu'} onClick={() => setView('menu')} />
         <CredenzaTitle>{TITLES[view]}</CredenzaTitle>
         <CredenzaClose />
       </CredenzaHeader>
       <CredenzaView>…the current view…</CredenzaView>
     </CredenzaContent>
   </Credenza> ══ */

export { DialogTrigger as CredenzaTrigger, createDialogController as createCredenzaController } from '@ui-sdk/react/dialog';
export type { DialogController as CredenzaController } from '@ui-sdk/react/dialog';

type CredenzaContextValue = { view: string; direction: -1 | 0 | 1; dismissible: boolean };
const CredenzaContext = createContext<CredenzaContextValue>({ view: '', direction: 0, dismissible: true });

export type CredenzaProps = DialogProps & {
  /** Key of the current view. A new key morphs the card to its height and slides in from the right; a key seen
      before comes back from the left. */
  view?: string;
};

/** The root: a Dialog that presents as a tray in a compact container (`presentation`, default `"auto"`; pass
    `"sheet"` or `"dialog"` to choose), plus the `view` the card morphs between. */
export function Credenza({ view: viewProp, presentation = 'auto', dismissible = true, ...props }: CredenzaProps) {
  const view = String(viewProp ?? '');
  // Direction of travel between views: revisiting a view in the trail is going back.
  const trail = useRef<string[]>([view]);
  const last = useRef<{ view: string; direction: -1 | 0 | 1 }>({ view, direction: 0 });
  if (last.current.view !== view) {
    const at = trail.current.indexOf(view);
    if (at >= 0) {
      trail.current = trail.current.slice(0, at + 1);
      last.current = { view, direction: -1 };
    } else {
      trail.current = [...trail.current, view];
      last.current = { view, direction: 1 };
    }
  }
  return (
    <CredenzaContext.Provider value={{ view, direction: last.current.direction, dismissible }}>
      <Dialog presentation={presentation} dismissible={dismissible} {...props} />
    </CredenzaContext.Provider>
  );
}

/** The scrim behind the card. Render it to dim the host (inside a layer host there is no `::backdrop`). */
export const CredenzaBackdrop = DialogBackdrop;

/** The card: a centered dialog, or (presented as a sheet) a tray floating inset from the bottom edge. UI SDK moves
    the tray, so it is placed with margins rather than a translate. */
export const credenzaVariants = cva(
  'box-border flex flex-col overflow-hidden bg-card text-foreground shadow-[0_24px_80px_--alpha(black/34%),0_0_0_1px_var(--border)] outline-none',
  {
    variants: {
      presentation: {
        /* Centered: rises out of the middle on the tray spring. */
        dialog:
          'fixed inset-0 m-auto h-fit max-h-[calc(100%-44px)] w-[400px] max-w-[calc(100%-44px)] rounded-[24px] transition-[opacity,scale,translate] duration-spring-tray ease-spring-tray data-starting-style:translate-y-[5%] data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:translate-y-[2%] data-ending-style:scale-97 data-ending-style:opacity-0 motion-reduce:transition-none',
        /* A floating tray, not an edge-to-edge sheet. */
        sheet: 'relative inset-auto mx-2.5 mb-2.5 w-auto touch-none rounded-[28px]',
      },
    },
    defaultVariants: { presentation: 'dialog' },
  },
);

export type CredenzaContentProps<Payload = unknown> = Parameters<typeof SdkDialogContent<Payload>>[0];

/** The card. Name it with a CredenzaTitle, or `aria-label`. Put `autoFocus` on the control that should take focus
    when it opens. */
export function CredenzaContent<Payload = unknown>({ className, style, children, ...props }: CredenzaContentProps<Payload>) {
  const scope = useThemeScopeProps();
  const { dismissible } = useContext(CredenzaContext);
  return (
    <SdkDialogContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      className={(state) =>
        cn(credenzaVariants({ presentation: state.presentation }), scope.className, typeof className === 'function' ? className(state) : className)
      }
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {(state) => (
        <>
          {/* A tray you can drag away shows a grabber; a required step doesn't. */}
          {state.presentation === 'sheet' && dismissible ? (
            <span data-slot="credenza-grabber" aria-hidden="true" className="absolute top-[7px] left-1/2 z-3 h-[5px] w-[38px] -translate-x-1/2 rounded-[3px] bg-secondary-strong" />
          ) : null}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </SdkDialogContent>
  );
}

/** The header row: back chevron, title, close button. */
export function CredenzaHeader({ className, ...props }: ComponentProps<'div'>) {
  const { dismissible } = useContext(CredenzaContext);
  return (
    <div
      data-slot="credenza-header"
      // Without its close button the header keeps the height the button gives it, so the back chevron can come and go.
      className={cn('relative z-2 flex shrink-0 items-center gap-2.5 px-[14px] pt-[14px] pb-1.5', !dismissible && 'min-h-[50px]', className)}
      {...props}
    />
  );
}

const circleClass = cn(
  'bl-btn grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground',
  focusRing,
);

export type CredenzaBackProps = Omit<ComponentProps<typeof SdkButton>, 'children'> & {
  /** Fold the chevron away (it shrinks out of the header and can't be reached). */
  hidden?: boolean;
  children?: ReactNode;
};

/** The back chevron. It stays mounted and grows in or out with `hidden`, so the title slides over as it goes. */
export function CredenzaBack({ hidden = false, className, 'aria-label': label = 'Back', children, ...props }: CredenzaBackProps) {
  return (
    <span
      data-slot="credenza-back"
      data-hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className="grid w-[30px] shrink-0 place-items-center overflow-hidden transition-[width,margin,opacity,scale] duration-spring-snappy ease-spring-snappy data-hidden:-mr-2.5 data-hidden:w-0 data-hidden:scale-40 data-hidden:opacity-0 motion-reduce:transition-none"
    >
      <SdkButton aria-label={label} className={cx(circleClass, className)} {...props}>
        {children ?? <Icon name="chevL" size={15} sw={2.6} />}
      </SdkButton>
    </span>
  );
}

/* A title arrives from the side its view comes from and leaves toward the other: opacity and blur on the entry
   fade (the exit fade on the way out), travel on the snappy spring. Reduced motion keeps only the fade. */
const titleTextClass = cn(
  'absolute top-0 left-0 block whitespace-nowrap',
  '[transition:opacity_220ms_cubic-bezier(.22,1,.36,1),filter_220ms_cubic-bezier(.22,1,.36,1),translate_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
  'data-starting-style:translate-x-(--title-enter) data-starting-style:opacity-0 data-starting-style:blur-[3px]',
  'data-ending-style:translate-x-(--title-exit) data-ending-style:opacity-0 data-ending-style:blur-[3px]',
  'data-ending-style:[transition:opacity_var(--duration-exit)_var(--ease-exit),filter_var(--duration-exit)_var(--ease-exit),translate_var(--duration-spring-snappy)_var(--ease-spring-snappy)]',
  'motion-reduce:data-starting-style:translate-x-0 motion-reduce:data-ending-style:translate-x-0',
);

function TitleText({ entry }: { entry: PresenceEntry<{ key: string; node: ReactNode }> }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEnterExit(ref, entry.present, { appear: entry.appear, exited: entry.exited });
  // The title that is leaving no longer names the card.
  return (
    <span ref={ref} data-slot="credenza-title-text" aria-hidden={!entry.present || undefined} className={titleTextClass}>
      {entry.item.node}
    </span>
  );
}

/* The titles on screen: the current one, and the one it replaced while that plays its exit. */
function TitleSwap({ id, direction, children }: { id: string; direction: -1 | 0 | 1; children: ReactNode }) {
  const titles = usePresenceList([{ key: id, node: children }], (t) => t.key);
  const vars = { '--title-enter': `${direction * 18}px`, '--title-exit': `${direction * -18}px` } as CSSProperties;
  return (
    <span className="contents" style={vars}>
      {titles.map((entry) => (
        <TitleText key={entry.key} entry={entry} />
      ))}
    </span>
  );
}

/** The title. It names the card and travels with the view: a new title slides in from the side the view comes from. */
export function CredenzaTitle({ className, children, ...props }: ComponentProps<typeof SdkDialogTitle>) {
  const { view, direction } = useContext(CredenzaContext);
  const key = typeof children === 'string' || typeof children === 'number' ? String(children) : view;
  return (
    <SdkDialogTitle className={cx('relative m-0 h-[26px] min-w-0 flex-1 text-[18px] leading-[26px] font-bold tracking-[-.2px]', className)} {...props}>
      {(state) => (
        <TitleSwap id={key} direction={direction}>
          {typeof children === 'function' ? children(state) : children}
        </TitleSwap>
      )}
    </SdkDialogTitle>
  );
}

/** Closes the Credenza. On its own it is the round × (left out of a Credenza that isn't `dismissible`); with
    children or `render` it is whatever you make it (`<CredenzaClose render={<Button />}>Done</CredenzaClose>`),
    which closes even a required step. */
export function CredenzaClose({ className, children, render, ...props }: ComponentProps<typeof SdkDialogClose>) {
  const { dismissible } = useContext(CredenzaContext);
  if (children !== undefined || render !== undefined) {
    return <SdkDialogClose className={className} render={render} {...props}>{children}</SdkDialogClose>;
  }
  if (!dismissible) return null;
  return (
    <SdkDialogClose aria-label="Close" className={cx(circleClass, className)} {...props}>
      <Icon name="x" size={15} sw={2.6} />
    </SdkDialogClose>
  );
}

export type CredenzaViewProps = { children?: ReactNode; className?: string };

/** The current view. Changing the root's `view` cross-fades to the new one in the direction of travel while the
    card springs to its height. When the view that held focus leaves, focus goes to the card (a control in the new
    view with `autoFocus` takes it as it mounts). */
export function CredenzaView({ children, className }: CredenzaViewProps) {
  const { view, direction } = useContext(CredenzaContext);
  const [recovery] = useState(() => createFocusRecovery<{ card: HTMLElement | null }>({ fallback: (lost) => lost.props.card }));
  const bind = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      return recovery.bind(el, { key: el.dataset.view ?? '', props: { card: el.closest<HTMLElement>('[data-slot=dialog-content]') } });
    },
    [recovery],
  );
  return (
    <AnimatedHeight spring="tray" className={cn('relative', className)}>
      <ContentSwap id={view} direction={direction} distance={40} blur={6}>
        <div ref={bind} data-slot="credenza-view" data-view={view} className="contents">{children}</div>
      </ContentSwap>
    </AnimatedHeight>
  );
}
