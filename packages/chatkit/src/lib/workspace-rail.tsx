import type { CSSProperties } from 'react';
import { Button } from 'react-aria-components';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { cn } from './cn';
import { kvib } from './kvib';
import { titleRef } from './title-ref';

export interface Workspace {
  id: string;
  /** one-letter (or short) label shown in the tile */
  label: string;
  color: string;
  active?: boolean;
  /** tooltip title; defaults to label */
  title?: string;
}

export interface WorkspaceRailProps {
  /** defaults to the prototype's BL UI HQ / Creamery pair */
  workspaces?: Workspace[];
  onSelect?: (id: string) => void;
  onAdd?: () => void;
  /** tint used by the default workspaces' active tile */
  tint?: string;
  className?: string;
  style?: CSSProperties;
}

export function WorkspaceRail({
  workspaces,
  onSelect,
  onAdd,
  tint = '#0A84FF',
  className,
  style,
}: WorkspaceRailProps) {
  const ws: Workspace[] =
    workspaces ?? [
      { id: 'blui', label: 'T', color: tint, active: true, title: 'BL UI HQ' },
      { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery' },
    ];
  return (
    <div
      data-slot="workspace-rail"
      className={cn(
        'box-border flex w-[52px] shrink-0 flex-col items-center gap-[8px] border-r border-ck-sep bg-ck-rail px-0 py-[10px]',
        className,
      )}
      style={style}
    >
      {ws.map((w) => (
        <Button
          key={w.id}
          ref={titleRef(w.title ?? w.label)}
          onPress={() => {
            kvib([5]);
            onSelect?.(w.id);
          }}
          className={cn(
            'size-[34px] shrink-0 cursor-pointer rounded-[11px] border-2 font-ios text-[14px] font-extrabold',
            w.active ? 'border-(--ck-ws-color) bg-(--ck-ws-color) text-white' : 'border-transparent bg-ck-fill2 text-ck-on-fill',
          )}
          style={{ '--ck-ws-color': w.color } as CSSProperties}
        >
          {w.label}
        </Button>
      ))}
      <Button
        aria-label="Add workspace"
        onPress={() => {
          kvib([5]);
          onAdd?.();
        }}
        className="grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[11px] border border-dashed border-ck-sep bg-transparent text-ck-mut3"
      >
        <ChatIcon d={chatIconPaths.plus} size={14} />
      </Button>
    </div>
  );
}
