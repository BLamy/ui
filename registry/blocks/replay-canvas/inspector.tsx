'use client';
/* The trailing pane: what's selected and the evidence for it. A frame lists the moments it was seen at (pick one to
   draw the frame from it) and the segues in and out; a segue says what was clicked, where it led and in which
   recordings. Either way the recording itself plays below, in ReplayPreview, from that moment. */
import type { ReactNode } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { ReplayPreview, formatReplayTime } from '@/components/ui/replay-preview';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { AppMap, Evidence, OverlayNode, PageNode, Recording, Segue, SegueKind } from './analyze';
import { actionVerb, LAYER_ICON, type Selection } from './board';
import { frameKey } from './layout';

const KIND_TEXT: Record<SegueKind, string> = {
  navigate: 'Goes to another page',
  present: 'Opens a layer over the page',
  update: 'Changes what’s on screen',
  dismiss: 'Closes a layer',
};
const KIND_DOT: Record<SegueKind, string> = {
  navigate: 'bg-primary', present: 'bg-chart-2', update: 'bg-warning', dismiss: 'bg-muted-foreground',
};

export interface InspectorProps {
  map: AppMap;
  recordings: Map<string, Recording>;
  selection: Selection;
  onSelect: (s: Selection) => void;
  shown: Record<string, number>;
  onShow: (key: string, index: number) => void;
}

function nodeOf(map: AppMap, id: string): PageNode | OverlayNode | undefined {
  return map.pages.find((p) => p.id === id) ?? map.overlays.find((o) => o.id === id);
}

function refLabel(map: AppMap, node: string, state: string): string {
  const n = nodeOf(map, node);
  const s = n?.states.find((x) => x.id === state);
  return n ? (s && s.id !== 'base' && s.id !== 'open' ? `${n.label} · ${s.label}` : n.label) : node;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3">
      <div role="heading" aria-level={3} className="mb-2 text-caption1 font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}

function EvidenceList({ evidence, recordings, active, onPick }: { evidence: Evidence[]; recordings: Map<string, Recording>; active: number; onPick: (i: number) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {evidence.map((e, i) => (
        <li key={`${e.recording}@${e.time}`}>
          <PlainButton
            onPress={() => onPick(i)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2 py-1 text-left text-footnote text-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring',
              i === active && 'bg-primary/12 text-primary',
            )}
          >
            <Icon name="play-circle" size={14} sw={1.9} className="shrink-0" />
            <span className="truncate">{recordings.get(e.recording)?.name ?? e.recording}</span>
            <span className="ml-auto shrink-0 font-mono text-caption2 text-muted-foreground">{formatReplayTime(e.time)}</span>
          </PlainButton>
        </li>
      ))}
    </ul>
  );
}

function SegueRow({ map, segue, onSelect, dir }: { map: AppMap; segue: Segue; onSelect: InspectorProps['onSelect']; dir: 'in' | 'out' }) {
  const other = dir === 'out' ? segue.to : segue.from;
  return (
    <PlainButton
      onPress={() => onSelect({ kind: 'segue', id: segue.id })}
      className="flex w-full cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-2 py-1 text-left text-footnote text-foreground outline-none hover:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring"
    >
      <span className={cn('size-2 shrink-0 rounded-full', KIND_DOT[segue.kind])} />
      <span className="truncate">
        {dir === 'out' ? `${actionVerb(segue.action)} “${segue.label}” → ${refLabel(map, other.node, other.state)}` : `${refLabel(map, other.node, other.state)} → ${actionVerb(segue.action)} “${segue.label}”`}
      </span>
    </PlainButton>
  );
}

function Player({ recording, time, label }: { recording: Recording | undefined; time: number; label: string }) {
  if (!recording) return null;
  return (
    <Section title="Recording">
      <ReplayPreview
        key={`${recording.id}@${time}`}
        events={recording.events}
        initialTime={time}
        chrome="minimal"
        title={label}
        disableDevtools
      />
    </Section>
  );
}

export function Inspector({ map, recordings, selection, onSelect, shown, onShow }: InspectorProps) {
  if (selection?.kind === 'segue') {
    const s = map.segues.find((x) => x.id === selection.id);
    if (s) {
      const active = Math.min(shown[s.id] ?? 0, s.evidence.length - 1);
      const ev = s.evidence[active];
      const recs = new Set(s.evidence.map((e) => e.recording)).size;
      return (
        <Pane>
          <Section title="Segue">
            <p className="m-0 text-body font-semibold">{actionVerb(s.action)} “{s.label}”</p>
            <p className="m-0 mt-1 flex items-center gap-1.5 text-footnote text-muted-foreground">
              <span className={cn('size-2 rounded-full', KIND_DOT[s.kind])} /> {KIND_TEXT[s.kind]} · seen {s.evidence.length}× in {recs} recording{recs === 1 ? '' : 's'}
            </p>
            <div className="mt-3 flex flex-col gap-1 text-footnote">
              <PlainButton onPress={() => onSelect({ kind: 'frame', key: frameKey(s.from) })} className="cursor-pointer truncate rounded-ctl border-0 bg-secondary px-2 py-1.5 text-left text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
                From · {refLabel(map, s.from.node, s.from.state)}
              </PlainButton>
              <PlainButton onPress={() => onSelect({ kind: 'frame', key: frameKey(s.to) })} className="cursor-pointer truncate rounded-ctl border-0 bg-secondary px-2 py-1.5 text-left text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
                To · {refLabel(map, s.to.node, s.to.state)}
              </PlainButton>
            </div>
          </Section>
          <Section title="Seen at">
            <EvidenceList evidence={s.evidence} recordings={recordings} active={active} onPick={(i) => onShow(s.id, i)} />
          </Section>
          <Player recording={ev && recordings.get(ev.recording)} time={Math.max(0, (ev?.time ?? 0) - 900)} label={`${actionVerb(s.action)} ${s.label}`} />
        </Pane>
      );
    }
  }
  if (selection?.kind === 'frame') {
    const [nodeId, stateId] = selection.key.split('/');
    const n = nodeOf(map, nodeId);
    const state = n?.states.find((s) => s.id === stateId);
    if (n && state) {
      const active = Math.min(shown[selection.key] ?? 0, state.evidence.length - 1);
      const ev = state.evidence[active];
      const out = map.segues.filter((s) => frameKey(s.from) === selection.key);
      const into = map.segues.filter((s) => frameKey(s.to) === selection.key);
      return (
        <Pane>
          <Section title={n.kind === 'page' ? 'Page' : n.type}>
            <p className="m-0 flex items-center gap-1.5 text-body font-semibold">
              <Icon name={n.kind === 'page' ? 'doc' : LAYER_ICON[n.type]} size={15} sw={1.9} /> {n.label}
            </p>
            <p className="m-0 mt-1 text-footnote text-muted-foreground">
              {state.id === 'base' || state.id === 'open' ? (n.kind === 'page' ? 'As it first appears' : 'As it opens') : state.label}
              {' · '}seen in {n.recordings.length} recording{n.recordings.length === 1 ? '' : 's'}
            </p>
            {n.kind === 'page' && (n.route || n.titles.length > 1) && (
              <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-footnote">
                {n.route && <><dt className="text-muted-foreground">Route</dt><dd className="m-0 font-mono">{n.route}</dd></>}
                {n.titles.length > 1 && <><dt className="text-muted-foreground">Seen as</dt><dd className="m-0">{n.titles.join(', ')}</dd></>}
              </dl>
            )}
            {n.kind === 'overlay' && n.hosts.length > 1 && (
              <p className="m-0 mt-2 text-footnote text-muted-foreground">Opened over {n.hosts.map((h) => nodeOf(map, h)?.label).join(', ')}</p>
            )}
          </Section>
          {(out.length > 0 || into.length > 0) && (
            <Section title="Segues">
              {into.map((s) => <SegueRow key={s.id} map={map} segue={s} onSelect={onSelect} dir="in" />)}
              {out.map((s) => <SegueRow key={s.id} map={map} segue={s} onSelect={onSelect} dir="out" />)}
            </Section>
          )}
          <Section title="Seen at">
            <EvidenceList evidence={state.evidence} recordings={recordings} active={active} onPick={(i) => onShow(selection.key, i)} />
          </Section>
          <Player recording={ev && recordings.get(ev.recording)} time={ev?.time ?? 0} label={n.label} />
        </Pane>
      );
    }
  }
  const states = map.pages.reduce((k, p) => k + p.states.length, 0) + map.overlays.reduce((k, o) => k + o.states.length, 0);
  return (
    <Pane>
      <Section title="App map">
        <p className="m-0 text-footnote text-muted-foreground">
          Built from {map.recordings.length} recording{map.recordings.length === 1 ? '' : 's'}: {map.pages.length} pages, {map.overlays.length} layers, {states} states and {map.segues.length} segues. Each recording you add is folded into the same map — what it confirms is counted, what’s new is added.
        </p>
      </Section>
      <Section title="Segues">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-footnote">
          {(Object.keys(KIND_TEXT) as SegueKind[]).map((k) => (
            <li key={k} className="flex items-center gap-2"><span className={cn('size-2 rounded-full', KIND_DOT[k])} />{KIND_TEXT[k]}</li>
          ))}
        </ul>
      </Section>
      <Section title="Tips">
        <p className="m-0 text-footnote text-muted-foreground">Click a frame or a segue to see where it came from. Double-click a frame to zoom to it. Scroll to pan, pinch or ⌘-scroll to zoom, ⌘0 to fit.</p>
      </Section>
    </Pane>
  );
}

function Pane({ children }: { children: ReactNode }) {
  return <div data-slot="replay-canvas-inspector" className="h-full min-h-0 overflow-y-auto border-l border-border bg-sidebar">{children}</div>;
}
