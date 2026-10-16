/* The song's syntax tree as an outline: tracks, their calls (with source ranges), typed arguments, and each
   mini-notation string's own steps and operators. */
import type { ReactNode } from 'react';
import { Tree, TreeItem } from '@/components/ui/tree';
import type { MiniGroup, MiniStep, StrudelArg, StrudelSong } from '@/components/ui/strudel-syntax';

const dim = (s: ReactNode) => <span className="font-mono text-xs text-muted-foreground">{s}</span>;

function miniItems(g: MiniGroup, id: string): ReactNode {
  if (g.type !== 'sequence') {
    return (
      <TreeItem key={id} id={id} title={g.type} trailing={dim(`${g.layers.length} layers`)}>
        {g.layers.map((l, i) => miniItems(l, `${id}.${i}`))}
      </TreeItem>
    );
  }
  return (
    <TreeItem key={id} id={id} title="sequence" trailing={dim(`${g.steps.length} steps`)}>
      {g.steps.map((s, i) => stepItem(s, `${id}.${i}`))}
    </TreeItem>
  );
}

function stepItem(s: MiniStep, id: string): ReactNode {
  const slice = s.slice;
  const ops = s.ops.map((o) => o.op).join(' ');
  if (slice.type === 'atom') return <TreeItem key={id} id={id} title={slice.rest ? 'rest' : slice.value} trailing={dim(ops || `${slice.start}–${slice.end}`)} />;
  const layers = slice.type === 'subcycle' ? [slice.body] : slice.layers;
  return (
    <TreeItem key={id} id={id} title={slice.type} trailing={dim(ops)}>
      {layers.map((l, i) => miniItems(l, `${id}.${i}`))}
    </TreeItem>
  );
}

function argItem(a: StrudelArg, id: string): ReactNode {
  switch (a.kind) {
    case 'number': return <TreeItem key={id} id={id} title={String(a.value)} trailing={dim('number')} />;
    case 'string': return <TreeItem key={id} id={id} title={`'${a.value}'`} trailing={dim('string')} />;
    case 'mini':
      return (
        <TreeItem key={id} id={id} title={`"${a.source}"`} textValue={a.source} trailing={dim(a.error ? 'mini ✗' : 'mini')}>
          {a.mini ? miniItems(a.mini, `${id}.m`) : null}
        </TreeItem>
      );
    case 'pattern': {
      const calls = 'args' in a.chain.head ? [a.chain.head, ...a.chain.methods] : a.chain.methods;
      return (
        <TreeItem key={id} id={id} title={a.chain.head.name || 'pattern'} trailing={dim('pattern')}>
          {calls.map((c, i) => <TreeItem key={i} id={`${id}.${i}`} title={`.${c.name}()`} textValue={c.name}>{c.args.map((x, j) => argItem(x, `${id}.${i}.${j}`))}</TreeItem>)}
        </TreeItem>
      );
    }
    default: return <TreeItem key={id} id={id} title={a.kind} />;
  }
}

export function SyntaxTree({ song }: { song: StrudelSong }) {
  return (
    <Tree aria-label="Syntax tree" defaultExpandedKeys={['song', ...song.tracks.map((t) => `t${t.index}`)]}>
      <TreeItem id="song" title={`song · ${song.layout}`} textValue="song" trailing={dim(song.tempo ? `${Math.round(song.tempo.cps * 240)} bpm` : '')}>
        {song.tracks.map((t) => {
          const calls = 'args' in t.chain.head ? [t.chain.head, ...t.chain.methods] : t.chain.methods;
          return (
            <TreeItem key={t.index} id={`t${t.index}`} title={t.label ?? `track ${t.index + 1}`} textValue={`track ${t.index}`} trailing={dim(`${t.kind}${t.muted ? ' · muted' : ''}`)}>
              {calls.map((c, i) => (
                <TreeItem key={i} id={`t${t.index}.${i}`} title={`.${c.name}()`} textValue={c.name} trailing={dim(`${c.start}–${c.end}`)}>
                  {c.args.map((a, j) => argItem(a, `t${t.index}.${i}.${j}`))}
                </TreeItem>
              ))}
            </TreeItem>
          );
        })}
      </TreeItem>
    </Tree>
  );
}
