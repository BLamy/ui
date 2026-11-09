'use client';
import { useEffect, useMemo, useRef } from 'react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { PopoverContent } from '@/components/ui/popover';
import { Tree, TreeFileIcon } from '@/components/ui/tree';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import type { DebuggerModel } from './model';
import { sourceTree, type SourceTree } from './source-tree';
import { useModel } from './use-model';

function SourcePickerBody({ model, tree, onClosed }: { model: DebuggerModel; tree: SourceTree; onClosed: () => void }) {
  // Wait for the popover's exit and focus scope to retire before restoring a resized trigger.
  useEffect(() => () => { if (!model.sourcesOpen) onClosed(); }, [model]);
  return <DebuggerSources model={model} tree={tree} />;
}

/** A keyboard-driven source tree. Moving its highlight does not move the recording. */
export function DebuggerSources({
  model, tree: supplied, className, style,
}: DebuggerPartProps & { model: DebuggerModel; tree?: SourceTree }) {
  useModel(model, (m) => m.version);
  const rows = model.sourceRows();
  const computed = useMemo(() => sourceTree(rows.own, rows.rest), [model.summary, rows.active]);
  const tree = supplied ?? computed;
  const trail = rows.active ? tree.paths.get(rows.active) ?? [] : [];
  const selected = model.sourcePickerSelection ?? trail.at(-1)?.id;
  return (
    <Tree
      aria-label="Recorded sources"
      items={tree.items}
      sort
      search
      density="compact"
      className={cn('debugger-sources h-80 max-h-[60vh] min-h-0', className)}
      style={style}
      selectedIds={selected ? [selected] : []}
      defaultExpanded={trail.slice(0, -1).map((item) => item.id)}
      expandedIds={selected?.startsWith('directory:') ? [selected] : undefined}
      onSelectionChange={(ids) => {
        model.sourcePickerSelection = ids[0] ?? null;
        model.changed();
      }}
      activationMode="singleClick"
      onAction={(node) => {
        const source = tree.sources.get(node.id);
        if (!source) return;
        model.sourcesOpen = false;
        model.changed();
        void model.selectSource(source.id);
      }}
    />
  );
}

/** The current path, with the source browser a click away at every window width. */
export function DebuggerSourceBreadcrumbs({ model }: { model: DebuggerModel }) {
  useModel(model, (m) => m.version);
  const { own, rest, active } = model.sourceRows();
  const tree = useMemo(() => sourceTree(own, rest), [model.summary, active]);
  const trail = active ? tree.paths.get(active) ?? [] : [];
  const anchor = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!model.sourcesOpen) return;
    const rememberEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') restoreFocus.current = true; };
    window.addEventListener('keydown', rememberEscape, true);
    return () => window.removeEventListener('keydown', rememberEscape, true);
  }, [model, model.sourcesOpen]);
  const open = (id?: string) => {
    model.sourcePickerSelection = id ?? trail.at(-1)?.id ?? null;
    model.sourcesOpen = true;
    model.changed();
  };
  return (
    <div ref={anchor} className="flex min-w-0 flex-1" data-slot="debugger-source-path">
      <Breadcrumb
        size="sm"
        aria-label="Source path"
        items={[
          { id: 'sources', label: 'Sources', onPress: () => open(), 'aria-haspopup': 'dialog', 'aria-expanded': model.sourcesOpen },
          ...trail.filter((item) => item.id !== 'framework').map((item) => ({
            id: item.id,
            label: item.name,
            icon: item.id.startsWith('source:') ? <TreeFileIcon name={item.name} size={14} /> : undefined,
            onPress: () => open(item.id),
            'aria-haspopup': 'dialog' as const,
            'aria-expanded': model.sourcesOpen,
          })),
        ]}
      />
      <PopoverContent
        aria-label="Choose a recorded source"
        data-slot="debugger-source-picker"
        triggerRef={anchor}
        isOpen={model.sourcesOpen}
        onOpenChange={(isOpen) => {
          model.sourcesOpen = isOpen;
          model.changed();
        }}
        placement="bottom start"
        offset={4}
        className="w-[min(420px,calc(100vw-24px))] [&>[data-slot=popover-content]]:p-1.5"
      >
        <SourcePickerBody model={model} tree={tree} onClosed={() => {
          if (!restoreFocus.current) return;
          restoreFocus.current = false;
          requestAnimationFrame(() => {
            const root = anchor.current;
            (root?.querySelector<HTMLButtonElement>('button[aria-current=page]') ?? root?.querySelector<HTMLButtonElement>('button'))?.focus();
          });
        }} />
      </PopoverContent>
    </div>
  );
}
