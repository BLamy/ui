import type { CSSProperties, ReactNode } from 'react';
import { TabView, TabViewAction, TabViewBar, TabViewIndicator, TabViewList, TabViewSeparator, TabViewTab } from '../tab-view';
import { ChatIcon, chatIconPaths } from '../../lib/chat/chat-icon';
import { cn } from '../../lib/utils';
import { kvib } from '../../lib/chat/kvib';
import { titleRef } from '../../lib/chat/title-ref';

export interface Workspace {
  id: string;
  /** one-letter (or short) label shown in the tile */
  label: string;
  color: string;
  /** initially selected (uncontrolled); pass `selectedKey` on the rail to control it */
  active?: boolean;
  /** tooltip title; defaults to label */
  title?: string;
  /** unread activity: the pill shows a nub on the leading edge */
  unread?: boolean;
  /** mention count: a red badge on the tile */
  mentions?: number;
}

export interface WorkspaceRailHome {
  title?: string;
  unread?: boolean;
  mentions?: number;
}

export interface WorkspaceRailProps {
  /** defaults to the prototype's BL UI HQ / Creamery pair */
  workspaces?: Workspace[];
  /** Controlled selection (a workspace id, or `"home"`). */
  selectedKey?: string;
  /** Uncontrolled initial selection; defaults to the workspace marked `active`. */
  defaultSelectedKey?: string;
  onSelect?: (id: string) => void;
  /** Renders the "Add workspace" action after the tiles. */
  onAdd?: () => void;
  /** A Home / direct-messages tab above a separator (id `"home"`). */
  home?: boolean | WorkspaceRailHome;
  /** More non-tab actions, after "Add workspace". */
  actions?: ReactNode;
  /** tint used by the default workspaces' active tile and the home tile */
  tint?: string;
  className?: string;
  style?: CSSProperties;
}

/* The Discord-style server rail, composed from a vertical TabView: each workspace is a tab (arrow keys move
   between them, one selection tick per change), the pill on the leading edge shows unread / hover /
   selected, and "Add workspace" is a TabViewAction — a button in the bar that isn't a tab. */

/* Discord's rail: a tile is a circle at rest and morphs to a rounded square when hovered or selected, while the
   pill on the leading edge grows (nub → half → full). Corners, colours and the pill ride springs; a press dips. */
const tileClass =
  'relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 font-ios text-[14px] leading-[normal] font-extrabold [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-data-hovered:rounded-[11px] group-data-selected:rounded-[11px] group-data-pressed:scale-[.94] motion-reduce:transition-none group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-ck-link';

function MentionBadge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-ck-rail bg-ck-red px-[3px] font-ios text-[10px] leading-none font-bold text-white">
      {n > 99 ? '99+' : n}
    </span>
  );
}

function RailTab({ id, title, attention, children }: { id: string; title: string; attention?: boolean; children: ReactNode }) {
  return (
    <TabViewTab id={id} textValue={title} ref={titleRef(title)} className="group flex w-full justify-center">
      <TabViewIndicator variant="pill" attention={attention} className="bg-ck-label duration-(--duration-spring-bouncy) ease-(--ease-spring-bouncy)" />
      {children}
    </TabViewTab>
  );
}

export function WorkspaceRail({
  workspaces,
  selectedKey,
  defaultSelectedKey,
  onSelect,
  onAdd,
  home,
  actions,
  tint = '#0A84FF',
  className,
  style,
}: WorkspaceRailProps) {
  const ws: Workspace[] =
    workspaces ?? [
      { id: 'blui', label: 'T', color: tint, active: true, title: 'BL UI HQ' },
      { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery' },
    ];
  const h: WorkspaceRailHome | null = home ? (home === true ? {} : home) : null;
  return (
    <TabView
      orientation="vertical"
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey ?? ws.find((w) => w.active)?.id}
      onSelectionChange={(k) => onSelect?.(String(k))}
      className="contents"
    >
      <TabViewBar
        data-slot="workspace-rail"
        variant="plain"
        className={cn(
          'box-border flex w-[52px] shrink-0 flex-col items-center gap-[8px] border-r border-ck-sep bg-ck-rail px-0 py-[10px]',
          className,
        )}
        style={style}
      >
        <TabViewList aria-label="Workspaces" className="flex w-full flex-col items-center gap-[8px]">
          {h && (
            <RailTab id="home" title={h.title ?? 'Direct Messages'} attention={h.unread}>
              <span
                className={cn(
                  tileClass,
                  'border-transparent bg-ck-fill2 text-ck-on-fill group-data-selected:border-(--ck-ws-color) group-data-selected:bg-(--ck-ws-color) group-data-selected:text-white',
                )}
                style={{ '--ck-ws-color': tint } as CSSProperties}
              >
                <ChatIcon d={chatIconPaths.dm} size={17} sw={2} />
                <MentionBadge n={h.mentions} />
              </span>
            </RailTab>
          )}
          {h && <TabViewSeparator className="my-[-1px] h-[2px] w-[20px] rounded-full bg-ck-sep" />}
          {ws.map((w) => (
            <RailTab key={w.id} id={w.id} title={w.title ?? w.label} attention={w.unread}>
              <span
                className={cn(
                  tileClass,
                  'border-transparent bg-ck-fill2 text-ck-on-fill group-data-selected:border-(--ck-ws-color) group-data-selected:bg-(--ck-ws-color) group-data-selected:text-white',
                )}
                style={{ '--ck-ws-color': w.color } as CSSProperties}
              >
                {w.label}
                <MentionBadge n={w.mentions} />
              </span>
            </RailTab>
          ))}
        </TabViewList>
        <TabViewAction
          aria-label="Add workspace"
          onPress={() => {
            kvib([5]);
            onAdd?.();
          }}
          className="grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[17px] border border-dashed border-ck-sep bg-transparent text-ck-mut3 [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-hovered:rounded-[11px] data-hovered:text-ck-mut data-pressed:scale-[.94] motion-reduce:transition-none"
        >
          <ChatIcon d={chatIconPaths.plus} size={14} />
        </TabViewAction>
        {actions}
      </TabViewBar>
    </TabView>
  );
}
