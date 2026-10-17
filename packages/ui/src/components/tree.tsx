'use client';
import { type CSSProperties, type ReactNode } from 'react';
import {
  Button as AriaButton,
  Tree as AriaTree, type TreeProps as AriaTreeProps,
  TreeItem as AriaTreeItem, type TreeItemProps as AriaTreeItemProps,
  TreeItemContent, type TreeItemContentRenderProps,
  composeRenderProps,
} from 'react-aria-components';
import { ContextMenu } from '@/components/ui/context-menu';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ Tree — react-aria's Tree (a treegrid): arrow keys expand, collapse and move, typing jumps to an item, and
   selection is single or multiple. Rows are Finder/VS Code style: indent guides down each open folder, a chevron
   that turns as it opens, an icon, a label that truncates and a trailing slot for counts and badges. A
   `contextMenu` on an item opens on right-click (or long-press, or the menu key).
   <Tree aria-label="Files" selectionMode="single" defaultExpandedKeys={['src']}>
     <TreeItem id="src" title="src" icon={({ isExpanded }) => <TreeFolderIcon open={isExpanded} />}>
       <TreeItem id="src/app.tsx" title="app.tsx" icon={<TreeFileIcon name="app.tsx" />} />
     </TreeItem>
   </Tree> ══ */

/** One level of indentation. */
const INDENT = 16;
/** The row's own inset, before the first chevron. */
const INSET = 6;
/** The chevron's box; guides run down its center. */
const CHEVRON = 20;

export interface TreeProps<T> extends AriaTreeProps<T> {}

export function Tree<T extends object>({ className, ...props }: TreeProps<T>) {
  return (
    <AriaTree
      data-slot="tree"
      className={composeRenderProps(className, (cls) => cn('flex flex-col gap-px outline-none select-none', cls))}
      {...props}
    />
  );
}

export interface TreeItemProps<T = object> extends Omit<AriaTreeItemProps<T>, 'children' | 'textValue'> {
  /** The label. A string doubles as the typeahead text. */
  title: ReactNode;
  /** Typeahead and accessible text when `title` isn't a string. */
  textValue?: string;
  /** Leading icon, or a function of the row's state (a folder that opens). */
  icon?: ReactNode | ((state: TreeItemContentRenderProps) => ReactNode);
  /** After the label: a count, a dot, a badge. */
  trailing?: ReactNode | ((state: TreeItemContentRenderProps) => ReactNode);
  /** A `ContextMenuContent` that opens on right-click. */
  contextMenu?: ReactNode;
  /** Nested TreeItems (a static tree) or a `<Collection>` (a dynamic one). */
  children?: ReactNode;
}

export function TreeItem<T extends object>({ title, textValue, icon, trailing, contextMenu, children, className, ...props }: TreeItemProps<T>) {
  const text = textValue ?? (typeof title === 'string' ? title : '');
  return (
    <AriaTreeItem
      data-slot="tree-item"
      textValue={text}
      className={composeRenderProps(className, (cls) => cn('group/tree-item rounded-md text-foreground outline-none', cls))}
      {...props}
    >
      <TreeItemContent>
        {(state) => {
          const { hasChildItems, isExpanded, isSelected, isFocusVisible, isDisabled, level } = state;
          const row = (
            <div
              data-slot="tree-item-row"
              className={cn(
                'relative flex min-h-8 min-w-0 cursor-default items-center gap-1.5 rounded-md pr-2 text-subhead leading-5',
                'transition-[background-color] duration-100',
                isSelected ? 'bg-primary text-primary-foreground' : 'group-data-hovered/tree-item:bg-secondary',
                isFocusVisible && 'ring-[3px] ring-ring/45',
                // A drop onto the item (with `dragAndDropHooks`).
                'group-data-[drop-target]/tree-item:bg-secondary group-data-[drop-target]/tree-item:ring-2 group-data-[drop-target]/tree-item:ring-primary',
                'group-data-[dragging]/tree-item:opacity-50',
                isDisabled && 'opacity-40',
              )}
              style={{ paddingInlineStart: INSET + (level - 1) * INDENT } as CSSProperties}
            >
              {/* A guide down the middle of each ancestor's chevron, so open folders read as columns. */}
              {Array.from({ length: level - 1 }, (_, i) => (
                <span key={i} aria-hidden="true" data-slot="tree-guide"
                  className={cn('pointer-events-none absolute inset-y-0 w-px', isSelected ? 'bg-primary-foreground/25' : 'bg-border')}
                  style={{ left: INSET + i * INDENT + CHEVRON / 2 - 0.5 }} />
              ))}
              {hasChildItems ? (
                <AriaButton slot="chevron" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${text}`}
                  className={cn('grid shrink-0 cursor-default place-items-center rounded-[5px] border-0 bg-transparent p-0 text-inherit outline-none',
                    'data-focus-visible:ring-2 data-focus-visible:ring-ring', isSelected ? 'opacity-90' : 'text-muted-foreground')}
                  style={{ width: CHEVRON, height: CHEVRON }}>
                  <Icon name="chevron-right" size={12} sw={2.4}
                    className={cn('transition-transform duration-200 ease-out motion-reduce:transition-none', isExpanded && 'rotate-90')} />
                </AriaButton>
              ) : <span aria-hidden="true" className="shrink-0" style={{ width: CHEVRON }} />}
              {icon ? <span data-slot="tree-item-icon" className="grid shrink-0 place-items-center">{typeof icon === 'function' ? icon(state) : icon}</span> : null}
              <span data-slot="tree-item-title" className="min-w-0 flex-1 truncate">{title}</span>
              {trailing ? <span data-slot="tree-item-trailing" className={cn('flex shrink-0 items-center gap-1.5 text-footnote tabular-nums',
                isSelected ? 'text-primary-foreground/85' : 'text-muted-foreground')}>{typeof trailing === 'function' ? trailing(state) : trailing}</span> : null}
            </div>
          );
          return contextMenu ? <ContextMenu>{row}{contextMenu}</ContextMenu> : row;
        }}
      </TreeItemContent>
      {children}
    </AriaTreeItem>
  );
}

/* ── File-tree icons ── */

/** A two-tone folder that opens with its row. */
export function TreeFolderIcon({ open, size = 18, className }: { open?: boolean; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" data-slot="tree-folder-icon" className={cn('text-link', className)}>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3.9l1.6 1.6H16.5A1.5 1.5 0 0 1 18 7.1V14.5A1.5 1.5 0 0 1 16.5 16h-13A1.5 1.5 0 0 1 2 14.5Z" fill="currentColor" opacity=".55" />
      {open
        ? <path d="M3.9 8.2A1.4 1.4 0 0 1 5.2 7.3h12.1a.9.9 0 0 1 .85 1.2l-2.2 6.6a1.4 1.4 0 0 1-1.3.9H3.3a.9.9 0 0 1-.85-1.2Z" fill="currentColor" />
        : <path d="M2 8.1A1.1 1.1 0 0 1 3.1 7h13.8A1.1 1.1 0 0 1 18 8.1v6.4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5Z" fill="currentColor" />}
    </svg>
  );
}

/* File-type badge inks: content colors that match each language's own brand, the same in light and dark. */
const BLUE = '#3178C6', YELLOW = '#D4A500', AMBER = '#C58B00', PURPLE = '#8E5CD9', GRAY = '#6E7781', ORANGE = '#E3912C';
const RED = '#E4572E', GOLD = '#E8A33D', GREEN = '#2EA36B', PINK = '#CB4B6F', SLATE = '#4B5563';

/** Extension → label and color, for `TreeFileIcon`. */
const FILE_KINDS: Record<string, { label: string; color: string }> = {
  ts: { label: 'TS', color: BLUE }, tsx: { label: 'TSX', color: BLUE },
  js: { label: 'JS', color: YELLOW }, jsx: { label: 'JSX', color: YELLOW }, mjs: { label: 'JS', color: YELLOW },
  json: { label: '{ }', color: AMBER }, css: { label: 'CSS', color: PURPLE },
  md: { label: 'MD', color: GRAY }, mdx: { label: 'MDX', color: ORANGE },
  stl: { label: 'STL', color: PURPLE },
  html: { label: 'HTML', color: RED }, svg: { label: 'SVG', color: GOLD },
  png: { label: 'PNG', color: GREEN }, jpg: { label: 'JPG', color: GREEN },
  yml: { label: 'YML', color: PINK }, yaml: { label: 'YML', color: PINK },
  sh: { label: 'SH', color: SLATE }, txt: { label: 'TXT', color: GRAY },
};

/** A page with a dog-ear and a colored badge for the file's type, read from `name`'s extension. */
export function TreeFileIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  const kind = FILE_KINDS[ext];
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" data-slot="tree-file-icon" data-ext={ext || undefined} className={className}>
      <path d="M5 2h6.6L16 6.4V16.5A1.5 1.5 0 0 1 14.5 18h-9A1.5 1.5 0 0 1 4 16.5v-13A1.5 1.5 0 0 1 5.5 2Z" fill="var(--card, white)" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      <path d="M11.5 2.2V5.4a1 1 0 0 0 1 1h3.3" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      {kind ? <>
        <rect x="1" y="9" width={kind.label.length > 2 ? 16 : 13} height="8" rx="2" fill={kind.color} />
        <text x={kind.label.length > 2 ? 9 : 7.5} y="15.1" textAnchor="middle" fontSize={kind.label.length > 3 ? 4.3 : 5.4} fontWeight="800" letterSpacing="-.2"
          fontFamily="ui-sans-serif, system-ui, sans-serif" fill="white">{kind.label}</text>
      </> : <path d="M7 10h6M7 12.5h6M7 15h4" stroke="currentColor" strokeOpacity=".4" strokeWidth="1" strokeLinecap="round" />}
    </svg>
  );
}
