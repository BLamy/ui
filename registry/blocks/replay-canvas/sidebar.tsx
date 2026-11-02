'use client';
/* The leading pane: the recordings the map is built from (turn one off to see what it contributed, add more from
   files — each one added folds into the same map, or from a Replay QA test run above them), and the map's outline, pages with their states and the layers
   opened over them, to select and fly to. */
import type { ReactNode } from 'react';
import { FileTrigger } from 'react-aria-components';
import { Checkbox } from '@/components/ui/checkbox';
import { PlainButton } from '@/components/ui/plain-button';
import { formatReplayTime } from '@/components/ui/replay-preview';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { AppMap, Recording } from './analyze';
import { LAYER_ICON, type Selection } from './board';

export interface SourceRecording extends Recording {
  enabled: boolean;
}

export interface SidebarProps {
  recordings: SourceRecording[];
  map: AppMap;
  onToggle: (id: string, on: boolean) => void;
  onRemove: (id: string) => void;
  onAdd: (files: File[]) => void;
  selection: Selection;
  onSelect: (key: string) => void;
  /** The Replay QA pane, above the recordings, when signed in to Replay. */
  qa?: ReactNode;
}

export function Sidebar({ recordings, map, onToggle, onRemove, onAdd, selection, onSelect, qa }: SidebarProps) {
  const summary = new Map(map.recordings.map((r) => [r.id, r]));
  const selected = selection?.kind === 'frame' ? selection.key : null;
  const row = (key: string, icon: string, label: string, depth: number, extra?: string) => (
    <PlainButton
      key={key}
      onPress={() => onSelect(key)}
      className={cn(
        'flex w-full cursor-pointer items-center gap-1.5 truncate rounded-ctl border-0 bg-transparent py-1 pr-2 text-left text-footnote text-foreground outline-none',
        'hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring',
        selected === key && 'bg-primary/12 text-primary',
      )}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <Icon name={icon} size={13} sw={1.9} className="shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
      {extra && <span className="ml-auto shrink-0 font-mono text-caption2 text-muted-foreground">{extra}</span>}
    </PlainButton>
  );

  return (
    <div data-slot="replay-canvas-sidebar" className="flex h-full min-h-0 flex-col border-r border-border bg-sidebar">
      {qa && (
        <div className="flex max-h-[45%] min-h-48 shrink-0 flex-col border-b border-border">
          <div role="heading" aria-level={2} className="px-3 pt-3 pb-1 text-caption1 font-semibold uppercase tracking-wide text-muted-foreground">Replay QA</div>
          {qa}
        </div>
      )}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div role="heading" aria-level={2} className="text-caption1 font-semibold uppercase tracking-wide text-muted-foreground">Recordings</div>
        <FileTrigger acceptedFileTypes={['application/json', '.json']} allowsMultiple onSelect={(list) => list && onAdd([...list])}>
          <PlainButton aria-label="Add recordings" title="Add rrweb recordings (.json)" className="grid size-6 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-muted-foreground outline-none hover:bg-secondary hover:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring">
            <Icon name="plus" size={15} sw={2} />
          </PlainButton>
        </FileTrigger>
      </div>
      <ul className="m-0 flex max-h-64 shrink-0 list-none flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {recordings.map((r) => {
          const s = summary.get(r.id);
          return (
            <li key={r.id} className="group flex items-start gap-1 rounded-ctl px-1 py-1 hover:bg-secondary">
              <Checkbox isSelected={r.enabled} onChange={(on) => onToggle(r.id, on)} className="min-w-0 flex-1 items-start gap-2 text-footnote" aria-label={`Use ${r.name}`}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{r.name}</span>
                  <span className="text-caption2 text-muted-foreground">
                    {s ? `${formatReplayTime(s.duration)} · ${s.interactions} interactions` : `${r.events.length} events`}
                  </span>
                </span>
              </Checkbox>
              <PlainButton aria-label={`Remove ${r.name}`} onPress={() => onRemove(r.id)} className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:text-foreground data-focus-visible:opacity-100 data-focus-visible:ring-2 data-focus-visible:ring-ring">
                <Icon name="xmark" size={12} sw={2} />
              </PlainButton>
            </li>
          );
        })}
        {!recordings.length && <li className="px-2 py-3 text-footnote text-muted-foreground">Drop rrweb recordings (.json) here.</li>}
      </ul>
      <div role="heading" aria-level={2} className="border-t border-border px-3 pt-3 pb-1 text-caption1 font-semibold uppercase tracking-wide text-muted-foreground">Map</div>
      <nav aria-label="Map outline" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {map.pages.map((p) => (
          <div key={p.id}>
            {row(`${p.id}/base`, 'doc', p.label, 0, p.route)}
            {p.states.slice(1).map((s) => row(`${p.id}/${s.id}`, 'circle', s.label, 1))}
            {map.overlays.filter((o) => o.hosts[0] === p.id).map((o) => (
              <div key={o.id}>
                {row(`${o.id}/open`, LAYER_ICON[o.type], o.label, 1, o.type)}
                {o.states.slice(1).map((s) => row(`${o.id}/${s.id}`, 'circle', s.label, 2))}
              </div>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
