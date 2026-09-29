import type { CSSProperties, ReactNode } from 'react';
import type { Key } from 'react-aria-components';
import { TabView, TabViewAction, TabViewBar, TabViewIndicator, TabViewList, TabViewSeparator, TabViewTab } from '../tab-view';
import { Icon } from '../../lib/icon';
import { Haptics } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import { titleRef } from '../../lib/chat/title-ref';

/* ══ WorkspaceRail — the Discord-style server rail, from parts ══
   <WorkspaceRail defaultSelectedKey="blui">
     <WorkspaceRailList>
       <WorkspaceRailHome mentions={2} />
       <WorkspaceRailSeparator />
       <WorkspaceRailItem id="blui" label="B" color="#0A84FF" title="BL UI HQ" />
       <WorkspaceRailItem id="labs" label="L" color="#32D74B" title="Labs" unread mentions={4} />
     </WorkspaceRailList>
     <WorkspaceRailAction aria-label="Add workspace" onPress={add} />
   </WorkspaceRail>
   A vertical TabView: each workspace is a tab (Up/Down move between them, one selection tick per change), the
   pill on the leading edge shows unread / hover / selected, and the action is a button in the bar, not a tab. */

export interface WorkspaceRailProps {
  /** Controlled selection (a workspace id, or `"home"`). */
  selectedKey?: string;
  /** Uncontrolled initial selection. */
  defaultSelectedKey?: string;
  onSelectionChange?: (id: string) => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WorkspaceRail({ selectedKey, defaultSelectedKey, onSelectionChange, children, className, style }: WorkspaceRailProps) {
  return (
    <TabView
      orientation="vertical"
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectionChange={(k: Key) => onSelectionChange?.(String(k))}
      className="contents"
    >
      <TabViewBar
        data-slot="workspace-rail"
        variant="plain"
        className={cn(
          'box-border flex w-[52px] shrink-0 flex-col items-center gap-[8px] border-r border-border bg-muted px-0 py-[10px]',
          className,
        )}
        style={style}
      >
        {children}
      </TabViewBar>
    </TabView>
  );
}

export interface WorkspaceRailListProps {
  'aria-label'?: string;
  children?: ReactNode;
  className?: string;
}

/** The tablist of workspaces. */
export function WorkspaceRailList({ 'aria-label': ariaLabel = 'Workspaces', children, className }: WorkspaceRailListProps) {
  return (
    <TabViewList aria-label={ariaLabel} className={cn('flex w-full flex-col items-center gap-[8px]', className)}>
      {children}
    </TabViewList>
  );
}

/* Discord's rail: a tile is a circle at rest and morphs to a rounded square when hovered or selected, while the
   pill on the leading edge grows (nub → half → full). Corners, colours and the pill ride springs; a press dips. */
const tileClass =
  'relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-ios text-[14px] leading-[normal] font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-data-hovered:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:border-(--ck-ws-color) group-data-selected:bg-(--ck-ws-color) group-data-selected:text-white group-data-pressed:scale-[.94] motion-reduce:transition-none group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-link';

function MentionBadge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] font-ios text-[10px] leading-none font-bold text-white">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export interface WorkspaceRailItemProps {
  id: string;
  /** one-letter (or short) label shown in the tile, when there are no children */
  label?: string;
  /** tile color when selected */
  color?: string;
  /** tooltip and accessible name; defaults to label */
  title?: string;
  /** unread activity: the pill shows a nub on the leading edge */
  unread?: boolean;
  /** mention count: a red badge on the tile */
  mentions?: number;
  /** custom tile content (an icon, an image) */
  children?: ReactNode;
  className?: string;
}

/** One workspace tile. */
export function WorkspaceRailItem({ id, label, color = 'var(--primary)', title, unread, mentions, children, className }: WorkspaceRailItemProps) {
  const name = title ?? label ?? id;
  return (
    <TabViewTab id={id} textValue={name} ref={titleRef(name)} className="group flex w-full justify-center">
      <TabViewIndicator variant="pill" attention={unread} className="bg-foreground duration-(--duration-spring-bouncy) ease-(--ease-spring-bouncy)" />
      <span data-slot="workspace-rail-item" className={cn(tileClass, className)} style={{ '--ck-ws-color': color } as CSSProperties}>
        {children ?? label}
        <MentionBadge n={mentions} />
      </span>
    </TabViewTab>
  );
}

export type WorkspaceRailHomeProps = Omit<WorkspaceRailItemProps, 'id' | 'label'> & { id?: string };

/** The Home / direct-messages tile (id `"home"`), tinted with the shell's accent. */
export function WorkspaceRailHome({ id = 'home', title = 'Direct Messages', children, ...props }: WorkspaceRailHomeProps) {
  return (
    <WorkspaceRailItem id={id} title={title} {...props}>
      {children ?? <Icon name="bubble-oval" size={17} sw={2} />}
    </WorkspaceRailItem>
  );
}

/** A short rule between tiles (under Home). Arrow keys skip it. */
export function WorkspaceRailSeparator({ className }: { className?: string }) {
  return <TabViewSeparator className={cn('my-[-1px] h-[2px] w-[20px] rounded-full bg-border', className)} />;
}

export interface WorkspaceRailActionProps {
  'aria-label'?: string;
  onPress?: () => void;
  /** defaults to a plus */
  children?: ReactNode;
  className?: string;
}

/** A dashed tile that is a button, not a tab ("Add workspace", "Explore"). */
export function WorkspaceRailAction({ 'aria-label': ariaLabel = 'Add workspace', onPress, children, className }: WorkspaceRailActionProps) {
  return (
    <TabViewAction
      aria-label={ariaLabel}
      onPress={() => {
        Haptics.impact('light');
        onPress?.();
      }}
      className={cn(
        'grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-tertiary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] data-hovered:rounded-[11px] data-hovered:text-muted-foreground data-pressed:scale-[.94] motion-reduce:transition-none',
        className,
      )}
    >
      {children ?? <Icon name="plus" size={14} sw={1.9} />}
    </TabViewAction>
  );
}
