import type { ComponentProps, ReactNode } from 'react';
import { Button, composeRenderProps } from 'react-aria-components';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';

/* ══ UserPanel — the signed-in user at the foot of the channel sidebar ══
   <UserPanel>
     <ChatAvatar user={me} size={26} />
     <UserPanelInfo>
       <UserPanelName>Ada</UserPanelName>
       <UserPanelStatus status="online" />
     </UserPanelInfo>
     <UserPanelAction aria-label="Notifications"><Icon name="bell-simple" size={14} sw={1.9} /></UserPanelAction>
   </UserPanel> */

export function UserPanel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="user-panel"
      className={cn('flex items-center gap-[8px] border-t border-border px-[12px] py-[9px]', className)}
      {...props}
    />
  );
}

export function UserPanelInfo({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="user-panel-info" className={cn('min-w-0 flex-1 leading-[1.1]', className)} {...props} />;
}

export function UserPanelName({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="user-panel-name" className={cn('truncate text-caption font-bold text-foreground', className)} {...props} />;
}

export type ChatPresence = 'online' | 'idle' | 'dnd' | 'offline';

export const presenceLabel: Record<ChatPresence, string> = {
  online: 'online',
  idle: 'idle',
  dnd: 'do not disturb',
  offline: 'offline',
};

/** The status line, colored by presence. */
export const userPanelStatusVariants = cva('text-[10px] font-semibold', {
  variants: {
    status: { online: 'text-success', idle: 'text-warning', dnd: 'text-destructive', offline: 'text-tertiary-foreground' },
  },
  defaultVariants: { status: 'online' },
});

export interface UserPanelStatusProps extends ComponentProps<'div'> {
  status?: ChatPresence;
  /** replaces the status label ("● online") */
  children?: ReactNode;
}

export function UserPanelStatus({ status = 'online', className, children, ...props }: UserPanelStatusProps) {
  return (
    <div data-slot="user-panel-status" data-status={status} className={cn(userPanelStatusVariants({ status }), className)} {...props}>
      {/* One text node for the default label, as the original rendered it. */}
      {children === undefined ? '● ' + presenceLabel[status] : <>● {children}</>}
    </div>
  );
}

/** An icon button in the panel (mute, deafen, settings…). */
export function UserPanelAction({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="user-panel-action"
      className={composeRenderProps(className, (c) =>
        cn('grid cursor-pointer border-0 bg-transparent p-0 text-tertiary-foreground data-hovered:text-muted-foreground', c),
      )}
      {...props}
    />
  );
}
