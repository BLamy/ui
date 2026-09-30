import type { ReactNode } from 'react';
import {
  OverlayArrow,
  Tooltip as AriaTooltip, type TooltipProps as AriaTooltipProps,
  TooltipTrigger as AriaTooltipTrigger, type TooltipTriggerComponentProps,
  composeRenderProps,
} from 'react-aria-components';
import { overlayZ, popoverMotion } from '../lib/primitives';
import { cn } from '../lib/utils';
import { useThemeScopeProps } from '../lib/theme';

/* ══ Tooltip — react-aria's TooltipTrigger / Tooltip: hover (with warm-up delay) and keyboard focus open it,
   Esc closes it, touch never does (as on iOS). Portals into BLProvider's root.
   <TooltipTrigger><Button>…</Button><Tooltip>Copy link</Tooltip></TooltipTrigger> ══ */

export function TooltipTrigger({ delay = 500, closeDelay = 200, ...props }: TooltipTriggerComponentProps) {
  return <AriaTooltipTrigger delay={delay} closeDelay={closeDelay} {...props} />;
}

export interface TooltipProps extends Omit<AriaTooltipProps, 'children'> {
  children?: ReactNode;
  /** Draw the pointer toward the trigger (default true). */
  arrow?: boolean;
}

export function Tooltip({ className, style, offset = 8, arrow = true, children, ...props }: TooltipProps) {
  const scope = useThemeScopeProps();
  return (
    <AriaTooltip
      data-slot="tooltip"
      data-theme-scope={scope['data-theme-scope']}
      offset={offset}
      style={composeRenderProps(style, (s) => ({ ...scope.style, ...s }))}
      className={composeRenderProps(className, (cls) => cn(
        'box-border max-w-60 rounded-[9px] bg-foreground px-2.5 py-1.5 text-[13px] leading-[17px] font-medium text-background shadow-[0_4px_14px_black] shadow-black/18',
        popoverMotion,
        overlayZ, scope.className, cls,
      ))}
      {...props}
    >
      {arrow ? (
        <OverlayArrow data-slot="tooltip-arrow" className="group">
          <svg width={10} height={5} viewBox="0 0 10 5" aria-hidden="true"
            className="block fill-foreground group-data-[placement=bottom]:rotate-180 group-data-[placement=left]:-rotate-90 group-data-[placement=right]:rotate-90">
            <path d="M0 0 L5 5 L10 0" />
          </svg>
        </OverlayArrow>
      ) : null}
      {children}
    </AriaTooltip>
  );
}
