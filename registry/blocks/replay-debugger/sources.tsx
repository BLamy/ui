'use client';
import { useId, useMemo, useState } from 'react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Popover, PopoverContent, PopoverTitle } from '@/components/ui/popover';
import { Tree } from '@/components/ui/tree';
import { FileBadgeIcon } from '@/lib/file-icons';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import type { DebuggerModel } from './model';
import { sourceTree, type SourceTree } from './source-tree';
import { useModel } from './use-model';

/** A keyboard-driven source tree. Moving its highlight does not move the recording. */
export function DebuggerSources({
  model, tree: supplied, className, style,
}: DebuggerPartProps & { model: DebuggerModel; tree?: SourceTree }) {
  useModel(model, (m) => m.version);
  const rows = model.sourceRows();
  const computed = useMemo(() => sourceTree(rows.own, rows.rest), [model.summary, rows.active]);
  const tree = supplied ?? computed;
  const trail = rows.active ? tree.paths.get(rows.active) ?? [] : [];
  const selected = model.sourcePickerSelection ?? trail.at(-1)?.id ?? null;
  return (
    <Tree
      aria-label="Recorded sources"
      items={tree.items}
      sort
      search
      density="compact"
      className={cn('debugger-sources h-80 max-h-[60vh] min-h-0', className)}
      style={style}
      value={selected}
      defaultExpanded={trail.slice(0, -1).map((item) => item.id)}
      autoExpand={selected?.startsWith('directory:') ? [selected] : undefined}
      onValueChange={(value) => {
        model.sourcePickerSelection = value;
        model.changed();
      }}
      onAction={(value) => {
        const source = tree.sources.get(value);
        if (!source) return;
        model.sourcesOpen = false;
        model.changed();
        void model.selectSource(source.id);
      }}
    />
  );
}

/** The current path, with the source browser a click away at every window width. Each crumb opens the browser on itself;
 *  the browser is a Popover lined up with the whole path. */
export function DebuggerSourceBreadcrumbs({ model }: { model: DebuggerModel }) {
  useModel(model, (m) => m.version);
  const { own, rest, active } = model.sourceRows();
  const tree = useMemo(() => sourceTree(own, rest), [model.summary, active]);
  const trail = active ? tree.paths.get(active) ?? [] : [];
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const pickerId = useId();
  const open = (id?: string) => {
    model.sourcePickerSelection = id ?? trail.at(-1)?.id ?? null;
    model.sourcesOpen = true;
    model.changed();
  };
  const popup = {
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': model.sourcesOpen,
    'aria-controls': model.sourcesOpen ? pickerId : undefined,
  };
  return (
    <div ref={setAnchor} className="flex min-w-0 flex-1" data-slot="debugger-source-path">
      <Breadcrumb
        size="sm"
        aria-label="Source path"
        items={[
          { id: 'sources', label: 'Sources', onClick: () => open(), ...popup },
          ...trail.filter((item) => item.id !== 'framework').map((item) => ({
            id: item.id,
            label: item.name,
            icon: item.id.startsWith('source:') ? <FileBadgeIcon name={item.name} size={14} /> : undefined,
            onClick: () => open(item.id),
            ...popup,
          })),
        ]}
      />
      <Popover
        open={model.sourcesOpen}
        onOpenChange={(isOpen) => {
          model.sourcesOpen = isOpen;
          model.changed();
        }}
      >
        <PopoverContent
          id={pickerId}
          data-slot="debugger-source-picker"
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={4}
          // Back to the crumb for the source on screen, since the crumbs open the browser rather than own it.
          finalFocus={() => anchor?.querySelector<HTMLElement>('[aria-current=page]') ?? anchor?.querySelector<HTMLElement>('button') ?? null}
          className="w-[min(420px,calc(100vw-24px))] p-1.5"
        >
          <PopoverTitle className="sr-only">Choose a recorded source</PopoverTitle>
          <DebuggerSources model={model} tree={tree} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
