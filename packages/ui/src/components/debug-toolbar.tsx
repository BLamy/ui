'use client';

import { Toolbar, ToolbarButton } from '@ui-sdk/react/toolbar';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';

const DEBUG_STEP_COLOR = 'text-[#75beff]';
const DEBUG_RESTART_COLOR = 'text-[#89d185]';
const DEBUG_STOP_COLOR = 'text-[#f48771]';
const DEBUG_GRIP_COLOR = 'text-[#5c5c5c]';
const DEBUG_SURFACE = 'border-[#303030] bg-[#181818]';

export type DebugToolbarAction =
  | 'continue'
  | 'step-over'
  | 'step-into'
  | 'step-out'
  | 'step-back'
  | 'reverse-continue'
  | 'restart'
  | 'stop';

export interface DebugToolbarProps {
  /** Called with the action represented by the pressed control. */
  onAction: (action: DebugToolbarAction) => void;
  /** The controls to show, in order. Defaults to the standard eight controls. */
  actions?: readonly DebugToolbarAction[];
  /** Actions unavailable in the current debugger state. */
  disabledActions?: readonly DebugToolbarAction[];
  /** `compact` fits narrow panes while keeping every control visible. */
  size?: 'default' | 'compact';
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_ACTIONS: readonly DebugToolbarAction[] = [
  'continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'restart', 'stop',
];

const ACTIONS: Record<DebugToolbarAction, { label: string; icon: string; color: string }> = {
  'continue': { label: 'Continue', icon: 'debug-continue', color: DEBUG_STEP_COLOR },
  'step-over': { label: 'Step over', icon: 'debug-step-over', color: DEBUG_STEP_COLOR },
  'step-into': { label: 'Step in', icon: 'debug-step-into', color: DEBUG_STEP_COLOR },
  'step-out': { label: 'Step out', icon: 'debug-step-out', color: DEBUG_STEP_COLOR },
  'step-back': { label: 'Step back', icon: 'debug-step-back', color: DEBUG_STEP_COLOR },
  'reverse-continue': { label: 'Reverse', icon: 'debug-reverse-continue', color: DEBUG_STEP_COLOR },
  'restart': { label: 'Restart', icon: 'debug-restart', color: DEBUG_RESTART_COLOR },
  'stop': { label: 'Stop', icon: 'debug-stop', color: DEBUG_STOP_COLOR },
};

/** A compact debugger control strip using the VS Code Codicon action glyphs. It is a UI SDK Toolbar: one tab stop,
    arrow keys between the actions, and an unavailable action stays reachable with `aria-disabled`. */
export function DebugToolbar({ onAction, actions = DEFAULT_ACTIONS, disabledActions = [], size = 'default', className, style }: DebugToolbarProps) {
  return (
    <Toolbar
      data-size={size}
      aria-label="Debugger controls"
      style={style}
      className={cn(
        'inline-flex h-[52px] shrink-0 items-center rounded-card border px-3 shadow-md',
        DEBUG_SURFACE,
        size === 'compact' && 'h-11 px-2',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('codicon codicon-gripper mr-4 w-5 shrink-0 text-center text-detail', DEBUG_GRIP_COLOR, size === 'compact' && 'mr-2 w-4 text-footnote')} />
      <div className={cn('flex items-center gap-4', size === 'compact' && 'gap-1.5')}>
        {actions.map((action) => {
          const { label, icon, color } = ACTIONS[action];
          return (
            <ToolbarButton
              key={action}
              data-action={action}
              aria-label={label}
              title={label}
              disabled={disabledActions.includes(action)}
              onClick={() => onAction(action)}
              className={cn(
                buttonVariants({ variant: 'quiet', size: 'icon' }),
                'size-9 rounded-md hover:not-data-disabled:bg-white/10 active:not-data-disabled:bg-white/15',
                size === 'compact' && 'size-[30px]',
              )}
            >
              <span aria-hidden="true" className={cn('codicon', `codicon-${icon}`, color, size === 'compact' ? 'text-title' : 'text-[24px]')} />
            </ToolbarButton>
          );
        })}
      </div>
    </Toolbar>
  );
}
