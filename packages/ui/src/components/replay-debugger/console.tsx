'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible';
import { ObjectTree } from '@/components/ui/object-tree';
import { ObjectValue } from '@/components/ui/object-value';
import { useMemo, useRef, useState } from 'react';
import type { DebuggerModel, Evaluation } from './model';
import { useModel } from './use-model';
import { loadChildren, nodeOf, previewOf, type ValueNode } from './values';
/* ══ Evaluating, and what's been evaluated ══
   Each expression stays with where it was asked, in the selected frame at this point. Evaluating diverges the process it's
   in from the recording, which the engine's session sorts out for the next pause. */
function EvaluationValue({
  model,
  evaluation,
}: {
  model: DebuggerModel;
  evaluation: Evaluation;
}) {
  const { result } = evaluation;
  // A step number can recur in a replacement process. Only this evaluation's
  // original live pause may fetch more of its objects.
  const here = useModel(model, (m) => m.evaluationPause(evaluation));
  const objects = useMemo(
    () => here?.objects ?? evaluation.objects ?? new Map(),
    [here, evaluation.objects],
  );
  const root = useMemo<ValueNode | null>(() => {
    if (!result?.returned?.object) return null;
    return nodeOf('result', '', result.returned, {
      objects,
      fetch: here
        ? (id) => model.fetchPreview(here, evaluation.step, id)
        : undefined,
    });
  }, [result, objects, here, model, evaluation.step]);
  if (evaluation.error)
    return (
      <span className="debugger-error text-destructive text-caption">
        {evaluation.error}
      </span>
    );
  if (!result)
    return (
      <span className="debugger-muted text-muted-foreground text-caption2">
        …
      </span>
    );
  if (result.exception)
    return (
      <span className="debugger-error text-destructive text-caption">
        Uncaught{' '}
        <ObjectValue
          value={previewOf(result.exception, objects)}
          quote={false}
        />
      </span>
    );
  if (result.failed)
    return (
      <span className="debugger-error text-destructive text-caption">
        Evaluation failed
      </span>
    );
  const value = previewOf(result.returned ?? {}, objects);
  if (!root) return <ObjectValue value={value} quote={false} />;
  return (
    <Collapsible render={<span />} className="debugger-eval-object">
      <CollapsibleTrigger
        className={cn(
          buttonVariants({ size: 'sm', variant: 'ghost' }),
          'debugger-eval-toggle pe-1 ps-0 py-0 cursor-pointer text-muted-foreground rounded-none border-0 h-auto min-h-0 font-normal leading-normal',
        )}
        data-slot="debugger-eval-toggle"
        aria-label="Show what came back"
      >
        {({ open }) => (open ? '▾' : '▸')}
      </CollapsibleTrigger>
      <ObjectValue value={value} />
      <CollapsiblePanel className="debugger-eval-tree h-[180px] mt-0.5">
        <ObjectTree<ValueNode['data'] & object>
          aria-label="What came back"
          root={[root] as never}
          loadChildren={loadChildren as never}
        />
      </CollapsiblePanel>
    </Collapsible>
  );
}
/** What's been evaluated so far. */
export function DebuggerEvaluations({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  const evaluations = useModel(model, (m) => m.evaluations);
  if (!evaluations.length) return null;
  return (
    <div
      className={cn('debugger-evaluations text-caption', className)}
      data-slot="debugger-evaluations"
      style={style}
    >
      {evaluations.map((e, i) => (
        <div
          key={i}
          className="debugger-evaluation px-2 py-[3px] border-t border-border"
          data-slot="debugger-evaluation"
        >
          <div className="debugger-eval-input font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
            <span className="debugger-prompt text-primary font-mono pe-1">
              ›
            </span>
            {e.expression}
            <span className="debugger-muted text-muted-foreground text-caption2">{`  at step ${e.step} in ${e.frame}`}</span>
          </div>
          <div
            className="debugger-eval-result min-w-0 [overflow-wrap:anywhere]"
            data-slot="debugger-eval-result"
          >
            <EvaluationValue model={model} evaluation={e} />
          </div>
        </div>
      ))}
    </div>
  );
}
/** Asks in the selected frame at this point. Up and down go through what's been asked. */
export function DebuggerPrompt({
  model,
  onEvaluate,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
  onEvaluate?: (expression: string) => void;
}) {
  const [text, setText] = useState('');
  // Where it's got to going back through what's been asked: the number of expressions from the end, 0 for what's being typed.
  const back = useRef(0);
  const draft = useRef('');
  return (
    <div
      className={cn(
        'debugger-console-prompt flex shrink-0 items-center gap-1 px-2 py-[3px] border-t border-border',
        className,
      )}
      data-slot="debugger-prompt"
      style={style}
    >
      <span className="debugger-prompt text-primary font-mono pe-1">›</span>
      <Input
        className="debugger-console-input min-w-0 border border-border rounded-sm bg-background text-foreground font-mono text-caption outline-offset-0 flex-1 h-6 px-1.5 py-0"
        data-slot="debugger-console-input"
        aria-label="Evaluate"
        placeholder="Evaluate in the selected frame at this point (Enter)"
        spellCheck={false}
        value={text}
        onValueChange={(next) => {
          setText(next);
          back.current = 0;
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && text.trim()) {
            const expression = text.trim();
            if (onEvaluate) onEvaluate(expression);
            else void model.evaluate(expression);
            setText('');
            back.current = 0;
            draft.current = '';
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const asked = model.evaluations;
            if (e.key === 'ArrowUp' && back.current === 0) draft.current = text;
            const next = Math.max(
              0,
              Math.min(
                asked.length,
                back.current + (e.key === 'ArrowUp' ? 1 : -1),
              ),
            );
            if (next === back.current) return;
            e.preventDefault();
            back.current = next;
            setText(
              next === 0
                ? draft.current
                : asked[asked.length - next].expression,
            );
          }
        }}
      />
    </div>
  );
}
