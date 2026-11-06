'use client';

import { Button } from './button';
import { cn } from '@/lib/utils';

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
  { action: 'continue', label: 'Continue', icon: 'debug-continue', color: 'text-[#75beff]' },
  { action: 'step-over', label: 'Step over', icon: 'debug-step-over', color: 'text-[#75beff]' },
  { action: 'step-into', label: 'Step into', icon: 'debug-step-into', color: 'text-[#75beff]' },
  { action: 'step-out', label: 'Step out', icon: 'debug-step-out', color: 'text-[#75beff]' },
  { action: 'step-back', label: 'Step back', icon: 'debug-step-back', color: 'text-[#75beff]' },
  { action: 'reverse-continue', label: 'Reverse continue', icon: 'debug-reverse-continue', color: 'text-[#75beff]' },
  { action: 'restart', label: 'Restart', icon: 'debug-restart', color: 'text-[#89d185]' },
  { action: 'stop', label: 'Stop', icon: 'debug-stop', color: 'text-[#f48771]' },
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
        'inline-flex h-[52px] shrink-0 items-center rounded-[16px] border border-[#303030] bg-[#181818] px-3 shadow-[0_2px_8px_rgba(0,0,0,0.28)]',
        size === 'compact' && 'h-11 px-2',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('codicon codicon-gripper mr-4 w-5 shrink-0 text-center text-[14px] text-[#5c5c5c]', size === 'compact' && 'mr-2 w-4 text-[13px]')} />
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
              'size-9 rounded-[7px] text-[#75beff] data-hovered:bg-white/10 data-pressed:bg-white/15',
              size === 'compact' && 'size-[30px] rounded-[6px]',
            )}
          >
            <span aria-hidden="true" className={cn('codicon', `codicon-${icon}`, color, size === 'compact' ? 'text-[20px]' : 'text-[24px]')} />
          </Button>
        ))}
      </div>
    </div>
  );
}
