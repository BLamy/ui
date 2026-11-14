'use client';
import type { ComponentProps } from 'react';
import {
  Tooltip as SdkTooltip,
  TooltipArrow as SdkTooltipArrow,
  TooltipContent as SdkTooltipContent,
  TooltipShortcut as SdkTooltipShortcut,
} from '@ui-sdk/react/tooltip';
import { popoverArrow, popoverArrowGlyph, popoverMotion } from '@/lib/primitives';
import { shortcutText } from '@/lib/shortcut-text';
import { cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';

/* ══ Tooltip — UI SDK's Tooltip as the kit's small inverted label ══
   UI SDK owns the behavior: it opens when the pointer rests on the trigger (after `delay`, at once while another
   tooltip is warm) and at once on keyboard focus, Esc closes it, and touch never opens it (as on iOS). The tooltip
   names a trigger that has no name of its own (an icon button) and describes any other. It renders into
   BLProvider's root (see `useLayerHost`).
   <Tooltip>
     <TooltipTrigger render={<Button variant="secondary" size="icon" />}><Icon name="link" /></TooltipTrigger>
     <TooltipContent>Copy link</TooltipContent>
   </Tooltip>
   One tooltip can serve a whole toolbar through a controller (`createTooltipController`). ══ */

export { TooltipTrigger, createTooltipController } from '@ui-sdk/react/tooltip';
export type { TooltipController } from '@ui-sdk/react/tooltip';

export type TooltipProps = ComponentProps<typeof SdkTooltip>;

/** Hover opens it after half a second and it lingers 200ms, so the pointer can cross a gap between two triggers. */
export function Tooltip({ container, delay = 500, closeDelay = 200, ...props }: TooltipProps) {
  const host = useLayerHost();
  return <SdkTooltip container={container === undefined ? host : container} delay={delay} closeDelay={closeDelay} {...props} />;
}

export type TooltipContentProps<Payload = unknown> = Parameters<typeof SdkTooltipContent<Payload>>[0] & {
  /** Draw the pointer toward the trigger (default true). */
  arrow?: boolean;
};

export function TooltipContent<Payload = unknown>({ className, style, sideOffset = 8, arrow = true, children, ...props }: TooltipContentProps<Payload>) {
  const scope = useThemeScopeProps();
  return (
    <SdkTooltipContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx(
        [
          'box-border max-w-60 rounded-ctl bg-foreground px-2.5 py-1.5 text-footnote leading-[17px] font-medium text-background shadow-tooltip',
          popoverMotion,
          scope.className,
        ],
        className,
      )}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {(state) => (
        <>
          {arrow ? <TooltipArrow /> : null}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </SdkTooltipContent>
  );
}

/** The pointer on the tooltip's edge. TooltipContent draws one unless `arrow={false}`. */
export function TooltipArrow({ className, ...props }: ComponentProps<typeof SdkTooltipArrow>) {
  return (
    <SdkTooltipArrow className={cx([popoverArrow, '[--bl-arrow-h:5px] [--bl-arrow-w:10px]'], className)} {...props}>
      <svg width={10} height={5} viewBox="0 0 10 5" aria-hidden="true" className={`${popoverArrowGlyph} fill-foreground`}>
        <path d="M0 0 L5 5 L10 0" />
      </svg>
    </SdkTooltipArrow>
  );
}

/** The keys of the tooltip's `shortcut` (`⇧⌘S`, or `Ctrl+Shift+S` off Apple platforms), after its text: the same
    rendering as a menu's and the command menu's shortcuts (see `lib/shortcut-text`). */
export function TooltipShortcut({ className, children, ...props }: ComponentProps<typeof SdkTooltipShortcut>) {
  return (
    <SdkTooltipShortcut className={cx('ms-2 font-normal opacity-60', className)} {...props}>
      {children ?? ((state) => shortcutText(state.text))}
    </SdkTooltipShortcut>
  );
}
