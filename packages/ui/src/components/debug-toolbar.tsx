'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Toolbar, ToolbarButton, useToolbar, type ToolbarButtonProps, type ToolbarProps, type ToolbarSize, type ToolbarTone,
} from '@/components/ui/toolbar';
import type { ButtonSize } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ══ DebugToolbar — a debugger's stepping controls, as a Toolbar preset ══
   The vocabulary (eight actions, their Codicon glyphs, their names and colors) on the kit's Toolbar, which owns the
   look and the keyboard: one tab stop, arrow keys between the actions, an unavailable action reachable with
   `aria-disabled`. `actions` picks and orders the controls; children compose your own row instead
   (`DebugToolbarButton`s and any other Toolbar part), for a ninth control or a different label. The glyphs are
   Microsoft's Codicons (the kit's stylesheet imports the font). ══ */

export type DebugToolbarAction =
  | 'continue'
  | 'step-over'
  | 'step-into'
  | 'step-out'
  | 'step-back'
  | 'reverse-continue'
  | 'restart'
  | 'stop';

/** Each action's default name, Codicon glyph and tone: the forward and backward runs and Restart are `success`,
    Stop is `destructive`, the steps are the toolbar's neutral color. */
export const debugToolbarActions: Readonly<Record<DebugToolbarAction, { label: string; icon: string; tone: ToolbarTone }>> = {
  'continue': { label: 'Continue', icon: 'debug-continue', tone: 'success' },
  'step-over': { label: 'Step over', icon: 'debug-step-over', tone: 'default' },
  'step-into': { label: 'Step into', icon: 'debug-step-into', tone: 'default' },
  'step-out': { label: 'Step out', icon: 'debug-step-out', tone: 'default' },
  'step-back': { label: 'Step back', icon: 'debug-step-back', tone: 'default' },
  'reverse-continue': { label: 'Reverse continue', icon: 'debug-reverse-continue', tone: 'success' },
  'restart': { label: 'Restart', icon: 'debug-restart', tone: 'success' },
  'stop': { label: 'Stop', icon: 'debug-stop', tone: 'destructive' },
};

const DEFAULT_ACTIONS: readonly DebugToolbarAction[] = [
  'continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'restart', 'stop',
];

interface DebugToolbarContextValue {
  onAction?: (action: DebugToolbarAction) => void;
  disabledActions: readonly DebugToolbarAction[];
}
const DebugToolbarContext = createContext<DebugToolbarContextValue>({ disabledActions: [] });

export type DebugToolbarProps = Omit<ToolbarProps, 'children'> & {
  /** Called with the action of the pressed control. */
  onAction?: (action: DebugToolbarAction) => void;
  /** The controls to show, in order. Default: all eight. Ignored when you pass children. */
  actions?: readonly DebugToolbarAction[];
  /** Actions the debugger can't run right now: they stay focusable with `aria-disabled`. */
  disabledActions?: readonly DebugToolbarAction[];
  /** Your own row instead of `actions`: `DebugToolbarButton`s, ToolbarSeparators, any other control. */
  children?: ReactNode;
};

/** The strip. `variant` is Toolbar's (default `floating`, the card VS Code floats over the editor; `plain` sits in a
    pane's header) and so is `size` (`sm` for a narrow pane: 28px tools). Named "Debugger controls" unless you name it. */
export function DebugToolbar({
  onAction,
  actions = DEFAULT_ACTIONS,
  disabledActions = [],
  variant = 'floating',
  children,
  ...props
}: DebugToolbarProps) {
  const value = useMemo(() => ({ onAction, disabledActions }), [onAction, disabledActions]);
  return (
    <DebugToolbarContext.Provider value={value}>
      <Toolbar aria-label="Debugger controls" variant={variant} {...props}>
        {children ?? actions.map((action) => <DebugToolbarButton key={action} action={action} />)}
      </Toolbar>
    </DebugToolbarContext.Provider>
  );
}

/** A tool follows the toolbar's size: 28, 36 or 44px. */
const iconSizes: Record<ToolbarSize, ButtonSize> = { sm: 'icon-sm', default: 'icon', lg: 'icon-lg' };

export type DebugToolbarButtonProps = Omit<ToolbarButtonProps, 'children'> & {
  action: DebugToolbarAction;
  /** The name in the tooltip and the accessibility tree. Default: the action's (`debugToolbarActions`). */
  label?: string;
};

/** One action: its Codicon in an icon tool, its name in a tooltip (the button's name too). Disabled when the
    DebugToolbar lists it in `disabledActions` or when you pass `disabled`; a press calls the toolbar's `onAction`
    after your own `onClick`. */
export function DebugToolbarButton({ action, label, size, tone, disabled, onClick, className, ...props }: DebugToolbarButtonProps) {
  const toolbar = useContext(DebugToolbarContext);
  const bar = useToolbar();
  const meta = debugToolbarActions[action];
  const iconSize = size ?? iconSizes[bar.size];
  return (
    // The tooltip shows the name and is the name (`type="label"`), so it isn't read twice; `aria-label` keeps the
    // button named wherever the tooltip can't be.
    <Tooltip type="label">
      <TooltipTrigger
        render={
          <ToolbarButton
            data-action={action}
            aria-label={label ?? meta.label}
            size={iconSize}
            tone={tone ?? meta.tone}
            disabled={disabled ?? toolbar.disabledActions.includes(action)}
            onClick={(event) => {
              onClick?.(event);
              toolbar.onAction?.(action);
            }}
            className={className}
            {...props}
          />
        }
      >
        <span aria-hidden="true" className={cn('codicon', `codicon-${meta.icon}`, iconSize === 'icon-sm' ? 'text-callout' : 'text-title')} />
      </TooltipTrigger>
      <TooltipContent>{label ?? meta.label}</TooltipContent>
    </Tooltip>
  );
}
