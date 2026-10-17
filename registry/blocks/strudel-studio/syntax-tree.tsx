/* The song's syntax tree as an outline: tracks, their calls (with source ranges), typed arguments, and each
   mini-notation string's own steps and operators. */
import { useMemo } from 'react';
import { Tree, type TreeNode } from '@/components/ui/tree';
import type { MiniGroup, MiniStep, StrudelArg, StrudelSong } from '@/components/ui/strudel-syntax';

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

function argNode(a: StrudelArg, id: string): TreeNode {
  switch (a.kind) {
    case 'number': return node(id, String(a.value), 'number');
    case 'string': return node(id, `'${a.value}'`, 'string');
    case 'mini': return node(id, `"${a.source}"`, a.error ? 'mini ✗' : 'mini', a.mini ? [miniNode(a.mini, `${id}.m`)] : []);
    case 'pattern': {
      const calls = 'args' in a.chain.head ? [a.chain.head, ...a.chain.methods] : a.chain.methods;
      return node(id, a.chain.head.name || 'pattern', 'pattern',
        calls.map((c, i) => node(`${id}.${i}`, `.${c.name}()`, '', c.args.map((x, j) => argNode(x, `${id}.${i}.${j}`)))));
    }
    default: return node(id, a.kind, '');
  }
}

export function SyntaxTree({ song }: { song: StrudelSong }) {
  const items = useMemo(() => [node('song', `song · ${song.layout}`, song.tempo ? `${Math.round(song.tempo.cps * 240)} bpm` : '', song.tracks.map((t) => {
    const calls = 'args' in t.chain.head ? [t.chain.head, ...t.chain.methods] : t.chain.methods;
    return node(`t${t.index}`, t.label ?? `track ${t.index + 1}`, `${t.kind}${t.muted ? ' · muted' : ''}`,
      calls.map((c, i) => node(`t${t.index}.${i}`, `.${c.name}()`, `${c.start}–${c.end}`, c.args.map((a, j) => argNode(a, `t${t.index}.${i}.${j}`)))));
  }))], [song]);
  return <Tree aria-label="Syntax tree" items={items} icons="none" search
    defaultExpanded={['song', ...song.tracks.map((t) => `t${t.index}`)]} className="h-96" />;
}
