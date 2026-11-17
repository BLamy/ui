import { useEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cloudflareBoardProps } from '@/components/ui/cloudflare-diagram';
import { Diagram, DiagramToolbar } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFramePanel, DiagramFrameSection } from '@/components/ui/diagram-frame';
import type { CloudflareDrawn } from '@/lib/cloudflare-board';
import type { CloudflareSystem } from '@/lib/cloudflare-system';
import { createDiagramLayoutEngine, finishLayout, runLayout, toElkGraph, type DiagramBoardSize, type DiagramDraft } from '@/lib/diagram-layout';
import { onLayout } from '@/lib/diagram-layout/react';
import { estimateText, type TextMeasurer } from '@/lib/diagram-text';
import { BLProvider } from '@/lib/theme';
import { cloudflareWalkDraft } from '../stories/cloudflare-walk';
import { checkWalk, CLOUDFLARE_WALKS, type WalkedStep } from '../stories/cloudflare-walk-check';

/* ══ Replay: a seeded walk of edits, step by step ══
   What the editing fuzz (`lib/diagram-editing.fuzz.test.ts`) does to a Cloudflare board, shown: pick a walk and a seed, and
   each step is drawn as CloudflareDiagram draws it (the same calls, the same layout), with what the drawing rules say of it. A
   failing seed from the fuzz's report replays here to be looked at; one that passes and looks wrong is a rule to add. */

interface ReplayArgs {
  /** Which system, and how it starts (laid out, or placed from the start as the studio places one). */
  walk: string;
  seed: number;
  /** How many steps to walk. */
  steps: number;
  /** Which step to show (-1: the last). */
  step: number;
}

/** A walk's name as a slug, for the story's URL (`&args=walk:file-upload-laid-out;seed:2`). */
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const meta: Meta<ReplayArgs> = {
  title: 'Organisms/CloudflareDiagram/Replay',
  parameters: { layout: 'fullscreen' },
  args: { walk: slug(CLOUDFLARE_WALKS[1]!.name), seed: 1, steps: 30, step: -1 },
  argTypes: {
    walk: { control: 'select', options: CLOUDFLARE_WALKS.map((w) => slug(w.name)) },
    seed: { control: { type: 'number', min: 1, step: 1 } },
    steps: { control: { type: 'number', min: 1, max: 80, step: 1 } },
    step: { control: { type: 'number', min: -1, step: 1 } },
  },
};
export default meta;

/** The read-only pipeline for a board, as the fuzz runs it: ELK once per graph, then wrapped and routed for the board. */
function layoutWith(engine: ReturnType<typeof createDiagramLayoutEngine>, text: TextMeasurer) {
  const runs = new Map<string, Promise<CloudflareDrawn>>();
  return (board: DiagramBoardSize) => (system: CloudflareSystem): Promise<CloudflareDrawn> => {
    const draft = cloudflareWalkDraft(system) as DiagramDraft;
    const key = JSON.stringify([board, draft.nodes, draft.edges]);
    let run = runs.get(key);
    if (!run) {
      run = runLayout(draft, { text }, engine, toElkGraph(draft, { text }), false)
        .then((raw) => ({ ...(onLayout(draft, finishLayout(raw, { board, text })) as Pick<CloudflareDrawn, 'nodes' | 'edges'>), sized: true }));
      runs.set(key, run);
    }
    return run;
  };
}

function WalkReplay({ walk, seed, steps, step }: ReplayArgs) {
  const chosen = CLOUDFLARE_WALKS.find((w) => slug(w.name) === walk) ?? CLOUDFLARE_WALKS[0]!;
  const [walked, setWalked] = useState<WalkedStep[] | null>(null);
  const [at, setAt] = useState(step);
  useEffect(() => setAt(step), [step, walk, seed, steps]);
  useEffect(() => {
    let live = true;
    setWalked(null);
    const engine = createDiagramLayoutEngine();
    // Words by estimate, as the fuzz measures them, so a step here is the step it checked.
    const text: TextMeasurer = estimateText;
    const out: WalkedStep[] = [];
    checkWalk(chosen.system, chosen.frame, { seed, count: steps }, { layoutFor: layoutWith(engine, text), text, keepGoing: true, onStep: (s) => out.push(s) })
      .then(() => { if (live) setWalked(out); }, () => { if (live) setWalked(out); })
      .finally(() => engine.dispose());
    return () => { live = false; };
  }, [chosen, seed, steps]);
  const shown = walked ? walked[at < 0 || at >= walked.length ? walked.length - 1 : at] : null;
  const index = walked && shown ? walked.indexOf(shown) : 0;
  const board = useMemo(() => cloudflareBoardProps({ services: [], edges: [] }), []);
  const broken = walked?.filter((s) => s.found.length).length ?? 0;
  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <BLProvider>
        <DiagramFrame data-replay="" defaultOpen>
          <DiagramFrameBoard>
            {shown ? (
              <Diagram
                key={index}
                {...board}
                autoSize={!shown.drawn.sized}
                nodes={shown.drawn.nodes}
                edges={shown.drawn.edges}
                selection={shown.select}
                aria-label={`${chosen.name}, seed ${seed}, step ${index}`}
                overlay={<DiagramToolbar />}
              />
            ) : null}
            <DiagramFrameBar>
              <span data-slot="replay-status">{walked ? `Step ${index} of ${walked.length - 1}: ${shown?.said ?? ''}` : 'Walking…'}</span>
            </DiagramFrameBar>
          </DiagramFrameBoard>
          <DiagramFramePanel title={`${chosen.name}, seed ${seed}`}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={!walked || index <= 0} onClick={() => setAt(index - 1)}>Back</Button>
                <Button variant="secondary" size="sm" disabled={!walked || index >= (walked?.length ?? 1) - 1} onClick={() => setAt(index + 1)}>On</Button>
              </div>
              <p className="m-0 text-footnote text-foreground/70">{walked ? (broken ? `${broken} of ${walked.length} steps break a rule.` : `All ${walked.length} steps keep every rule.`) : 'Walking…'}</p>
              <DiagramFrameSection title="Steps">
                <ol className="m-0 flex list-none flex-col gap-1 p-0">
                  {(walked ?? []).map((s, i) => (
                    <li key={i} data-step={i} data-broken={s.found.length ? '' : undefined}>
                      <Button variant={i === index ? 'secondary' : 'quiet'} size="sm" className="h-auto w-full justify-start py-1 text-start font-normal whitespace-normal [overflow-wrap:anywhere]" onClick={() => setAt(i)}>
                        <span className="tabular-nums text-muted-foreground">{i}</span>
                        <span className="min-w-0 flex-1">{s.said}</span>
                        {s.pushed ? <Badge variant="outline" size="sm">room</Badge> : null}
                        {s.knot ? <Badge variant="outline" size="sm">knot</Badge> : null}
                        {s.found.length ? <Badge variant="destructive" size="sm">{s.found.length}</Badge> : null}
                      </Button>
                    </li>
                  ))}
                </ol>
              </DiagramFrameSection>
              {shown?.found.length ? (
                <DiagramFrameSection title="What it breaks">
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-footnote text-destructive [overflow-wrap:anywhere]">
                    {shown.found.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </DiagramFrameSection>
              ) : null}
            </div>
          </DiagramFramePanel>
        </DiagramFrame>
      </BLProvider>
    </div>
  );
}

/** A seeded walk of every kind of edit on a Cloudflare board, step by step: Back and On go through it, the list jumps to a
 *  step, and what a step breaks of the drawing rules is listed under it. */
export const Replay: StoryObj<ReplayArgs> = {
  render: (args) => <WalkReplay {...args} />,
};
