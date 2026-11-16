import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ══ WorkspaceTile — a server tile for a `Tabs variant="switcher"` rail ══
   <Tabs variant="switcher" defaultValue="blui">
     <TabsBar>
       <TabsList aria-label="Workspaces">
         <TabsTab value="blui" aria-label="BL UI HQ">
           <TabsPill attention={unread} />
           <WorkspaceTile tint="#0A84FF" mentions={4}>B</WorkspaceTile>
         </TabsTab>
       </TabsList>
       <TabsFooter><TabsAction aria-label="Add workspace" icon="plus" /></TabsFooter>
     </TabsBar>
   </Tabs>
   Discord's tile: a circle at rest that morphs to a rounded square when its tab is hovered or selected (filling
   with the workspace color), with a mention badge. It reads the tab's state through `group-data-*`. */

export interface WorkspaceTileProps {
  /** fill when selected; the accent by default */
  tint?: string;
  /** mention count: a red badge on the tile */
  mentions?: number;
  /** a native tooltip (the workspace's full name) */
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function WorkspaceTile({ tint = 'var(--primary)', mentions, title, children, className }: WorkspaceTileProps) {
  return (
    <span
      data-slot="workspace-tile"
      title={title}
      style={{ '--tile': tint } as CSSProperties}
      className={cn(
        'relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-sans text-detail leading-[normal] font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-hover:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:border-(--tile) group-data-selected:bg-(--tile) group-data-selected:text-white group-active:scale-[.94] motion-reduce:transition-none group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-link',
        className,
      )}
    >
      {children}
      {mentions ? (
        <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] font-sans text-[10px] leading-none font-bold text-white">
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </span>
  );
}
