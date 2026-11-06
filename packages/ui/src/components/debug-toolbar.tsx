'use client';

import { Button } from './button';
import { cn } from '@/lib/utils';

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
  /** Actions unavailable in the current debugger state. */
  disabledActions?: readonly DebugToolbarAction[];
  /** `compact` fits narrow panes while keeping every control visible. */
  size?: 'default' | 'compact';
  className?: string;
}

const ACTIONS: readonly { action: DebugToolbarAction; label: string; icon: string; color: string }[] = [
  { action: 'continue', label: 'Continue', icon: 'debug-continue', color: DEBUG_STEP_COLOR },
  { action: 'step-over', label: 'Step over', icon: 'debug-step-over', color: DEBUG_STEP_COLOR },
  { action: 'step-into', label: 'Step into', icon: 'debug-step-into', color: DEBUG_STEP_COLOR },
  { action: 'step-out', label: 'Step out', icon: 'debug-step-out', color: DEBUG_STEP_COLOR },
  { action: 'step-back', label: 'Step back', icon: 'debug-step-back', color: DEBUG_STEP_COLOR },
  { action: 'reverse-continue', label: 'Reverse continue', icon: 'debug-reverse-continue', color: DEBUG_STEP_COLOR },
  { action: 'restart', label: 'Restart', icon: 'debug-restart', color: DEBUG_RESTART_COLOR },
  { action: 'stop', label: 'Stop', icon: 'debug-stop', color: DEBUG_STOP_COLOR },
];

/** A compact debugger control strip using the VS Code Codicon action glyphs. */
export function DebugToolbar({ onAction, disabledActions = [], size = 'default', className }: DebugToolbarProps) {
  return (
    <div
      data-slot="debug-toolbar"
      data-size={size}
      role="group"
      aria-label="Debugger controls"
      className={cn(
        'inline-flex h-[52px] shrink-0 items-center rounded-card border px-3 shadow-md',
        DEBUG_SURFACE,
        size === 'compact' && 'h-11 px-2',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('codicon codicon-gripper mr-4 w-5 shrink-0 text-center text-detail', DEBUG_GRIP_COLOR, size === 'compact' && 'mr-2 w-4 text-footnote')} />
      <div className={cn('flex items-center gap-4', size === 'compact' && 'gap-1.5')}>
        {ACTIONS.map(({ action, label, icon, color }) => (
          <Button
            key={action}
            variant="quiet"
            size="icon"
            aria-label={label}
            title={label}
            isDisabled={disabledActions.includes(action)}
            onPress={() => onAction(action)}
            className={cn(
              'size-9 rounded-md data-hovered:bg-white/10 data-pressed:bg-white/15',
              size === 'compact' && 'size-[30px]',
            )}
          >
            <span aria-hidden="true" className={cn('codicon', `codicon-${icon}`, color, size === 'compact' ? 'text-title' : 'text-[24px]')} />
          </Button>
        ))}
      </div>
    </div>
  );
}
