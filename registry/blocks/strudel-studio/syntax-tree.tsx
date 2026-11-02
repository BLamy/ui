/* The song's syntax tree as an outline: tracks, their calls (with source ranges), typed arguments, and each
   mini-notation string's own steps and operators. Resting on a row previews what it stands for in a hover card: a
   track's source as written and what it plays; a mini-notation string as one cycle laid out in time (each step as
   wide as its share of the cycle, `[…]` subdivided in place, `,` layers stacked), the picture the tree spells out. */
import { useMemo, type ReactNode } from 'react';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { Tree, type TreeNode } from '@/components/ui/tree';
import type { MiniGroup, MiniSequence, MiniStep, StrudelArg, StrudelSong, StrudelTrack } from '@/components/ui/strudel-syntax';
import { cn } from '@/lib/utils';

type Mini = Extract<StrudelArg, { kind: 'mini' }>;
/** What a row's hover card shows, by row id. */
type Previews = Map<string, { kind: 'track'; track: StrudelTrack } | { kind: 'mini'; arg: Mini }>;

/** A row, and a folder when it has anything under it. */
const node = (id: string, name: string, detail: string, children: TreeNode[] = []): TreeNode =>
  ({ id, name, ...(detail ? { detail } : {}), ...(children.length ? { children } : {}) });

function miniNode(g: MiniGroup, id: string): TreeNode {
  if (g.type !== 'sequence') return node(id, g.type, `${g.layers.length} layers`, g.layers.map((l, i) => miniNode(l, `${id}.${i}`)));
  return node(id, 'sequence', `${g.steps.length} steps`, g.steps.map((s, i) => stepNode(s, `${id}.${i}`)));
}

function stepNode(s: MiniStep, id: string): TreeNode {
  const slice = s.slice;
  const ops = s.ops.map((o) => o.op).join(' ');
  if (slice.type === 'atom') return node(id, slice.rest ? 'rest' : slice.value, ops || `${slice.start}–${slice.end}`);
  const layers = slice.type === 'subcycle' ? [slice.body] : slice.layers;
  return node(id, slice.type, ops, layers.map((l, i) => miniNode(l, `${id}.${i}`)));
}

function argNode(a: StrudelArg, id: string, previews: Previews): TreeNode {
  switch (a.kind) {
    case 'number': return node(id, String(a.value), 'number');
    case 'string': return node(id, `'${a.value}'`, 'string');
    case 'mini':
      if (a.mini) previews.set(id, { kind: 'mini', arg: a });
      return node(id, `"${a.source}"`, a.error ? 'mini ✗' : 'mini', a.mini ? [miniNode(a.mini, `${id}.m`)] : []);
    case 'pattern': {
      const calls = 'args' in a.chain.head ? [a.chain.head, ...a.chain.methods] : a.chain.methods;
      return node(id, a.chain.head.name || 'pattern', 'pattern',
        calls.map((c, i) => node(`${id}.${i}`, `.${c.name}()`, '', c.args.map((x, j) => argNode(x, `${id}.${i}.${j}`, previews)))));
    }
    default: return node(id, a.kind, '');
  }
}

/* ── One cycle, laid out in time ── */

/** A step's share of its sequence: `@n` weights it, `!n` repeats it. */
const weightOf = (s: MiniStep) => s.ops.reduce((w, o) => (o.op === 'weight' ? w * (o.amount ?? 2) : o.op === 'replicate' ? w * (o.count ?? 2) : w), 1);

function Steps({ seq, code }: { seq: MiniSequence; code: string }) {
  return (
    <div className="flex min-w-0 flex-1 gap-px">
      {seq.steps.map((s, i) => <Step key={i} step={s} code={code} />)}
    </div>
  );
}

function Step({ step, code }: { step: MiniStep; code: string }) {
  const sl = step.slice;
  const grow = { flexGrow: weightOf(step), flexBasis: 0 };
  if (sl.type === 'subcycle') return <div className="flex min-w-0 flex-col gap-px" style={grow}><Group g={sl.body} code={code} /></div>;
  const ops = step.ops.filter((o) => o.op !== 'weight' && o.op !== 'replicate').map((o) => code.slice(o.start, o.end)).join('');
  const label = sl.type === 'atom' ? (sl.rest ? '' : sl.value) : code.slice(sl.start, sl.end);
  const rest = sl.type === 'atom' && sl.rest;
  return (
    <div title={code.slice(step.start, step.end)} style={grow}
      className={cn('flex h-6 min-w-0 items-center justify-center overflow-hidden rounded-[3px] px-0.5 font-mono text-caption2',
        rest ? 'shadow-hairline' : 'bg-success/20 text-success')}>
      <span className="truncate">{label}{ops}</span>
    </div>
  );
}

/** A group's sequences, one row each (a `,` stack's layers, a `|` choice's options). */
function Group({ g, code }: { g: MiniGroup; code: string }): ReactNode {
  const rows = g.type === 'sequence' ? [g] : g.layers;
  return rows.map((r, i) => <Steps key={i} seq={r} code={code} />);
}

function MiniCard({ arg }: { arg: Mini }) {
  const g = arg.mini;
  if (!g) return null;
  const layers = g.type === 'sequence' ? 1 : g.layers.length;
  const steps = g.type === 'sequence' ? g.steps.length : Math.max(...g.layers.map((l) => l.steps.length));
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader title={<span className="font-mono">“{arg.source}”</span>}
        subtitle={`${steps} step${steps === 1 ? '' : 's'} per cycle${layers > 1 ? ` · ${layers} layers (${g.type})` : ''}`} />
      <div className="flex flex-col gap-1">
        {/* Mini-notation ranges count from the string's own first character. */}
        <div className="flex flex-col gap-px"><Group g={g} code={arg.source} /></div>
        <div className="flex justify-between font-mono text-caption2 text-muted-foreground"><span>0</span><span>1 cycle</span></div>
      </div>
    </div>
  );
}

function TrackCard({ track, song }: { track: StrudelTrack; song: StrudelSong }) {
  const calls = ('args' in track.chain.head ? 1 : 0) + track.chain.methods.length;
  return (
    <div className="flex flex-col gap-3">
      <HoverCardHeader title={track.label ?? `Track ${track.index + 1}`}
        subtitle={[track.kind, track.sound, `${calls} call${calls === 1 ? '' : 's'}`, track.muted ? 'muted' : null].filter(Boolean).join(' · ')} />
      <pre className="m-0 max-h-40 overflow-auto rounded-md bg-black/60 p-2 font-mono text-caption2 leading-relaxed whitespace-pre-wrap text-success">
        {song.code.slice(track.start, track.end)}
      </pre>
    </div>
  );
}

export function SyntaxTree({ song }: { song: StrudelSong }) {
  const [items, previews] = useMemo(() => {
    const previews: Previews = new Map();
    const items = [node('song', `song · ${song.layout}`, song.tempo ? `${Math.round(song.tempo.cps * 240)} bpm` : '', song.tracks.map((t) => {
      previews.set(`t${t.index}`, { kind: 'track', track: t });
      const calls = 'args' in t.chain.head ? [t.chain.head, ...t.chain.methods] : t.chain.methods;
      return node(`t${t.index}`, t.label ?? `track ${t.index + 1}`, `${t.kind}${t.muted ? ' · muted' : ''}`,
        calls.map((c, i) => node(`t${t.index}.${i}`, `.${c.name}()`, `${c.start}–${c.end}`, c.args.map((a, j) => argNode(a, `t${t.index}.${i}.${j}`, previews)))));
    }))];
    return [items, previews] as const;
  }, [song]);
  const preview = (row: TreeNode) => {
    const p = previews.get(row.id);
    if (!p) return null;
    return p.kind === 'track' ? <TrackCard track={p.track} song={song} /> : <MiniCard arg={p.arg} />;
  };
  return <Tree aria-label="Syntax tree" items={items} icons="none" search preview={preview}
    defaultExpanded={['song', ...song.tracks.map((t) => `t${t.index}`)]} className="h-96" />;
}
