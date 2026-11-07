'use client';
import { cn } from '@/lib/utils';
import type { DebuggerPartProps } from './styles';
import { Button } from '@/components/ui/button';
import type { SourceEntry } from './host';
import { sourceName, type DebuggerModel } from './model';
import { useModel } from './use-model';
function SourceRow({
  model,
  source,
  active,
}: {
  model: DebuggerModel;
  source: SourceEntry;
  active: boolean;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      type="button"
      className="debugger-source box-border block w-full rounded-none border-0 px-2 py-0.5 h-auto min-h-0 overflow-hidden text-foreground text-caption font-normal leading-normal whitespace-nowrap text-ellipsis cursor-pointer justify-start data-hovered:bg-accent data-[active]:bg-secondary data-[active]:font-semibold"
      data-slot="debugger-source"
      data-active={active || undefined}
      title={source.url || source.id}
      onPress={() => {
        model.sourcesOpen = false;
        void model.selectSource(source.id);
      }}
    >
      {sourceName(source)}
    </Button>
  );
}
/** Every source, with the code the recording's own author wrote first and the rest folded away. */
export function DebuggerSources({
  model,
  className,
  style,
}: DebuggerPartProps & {
  model: DebuggerModel;
}) {
  useModel(model, (m) => m.sourceId);
  const showFramework = useModel(model, (m) => m.showFramework);
  useModel(model, (m) => m.summary);
  const { active, own, rest } = model.sourceRows();
  return (
    <div
      className={cn(
        'debugger-sources flex-1 min-h-0 overflow-auto py-0.5',
        className,
      )}
      data-slot="debugger-sources"
      data-scroll-memory="debugger-sources"
      style={style}
    >
      {own.map((s) => (
        <SourceRow
          key={s.id}
          model={model}
          source={s}
          active={s.id === active}
        />
      ))}
      {rest.length ? (
        <Button
          size="sm"
          variant="ghost"
          type="button"
          className="debugger-source-group box-border block w-full rounded-none border-0 px-2 py-0.5 h-auto min-h-0 overflow-hidden text-muted-foreground text-caption2 font-normal leading-normal whitespace-nowrap text-ellipsis cursor-pointer justify-start data-hovered:bg-accent"
          data-slot="debugger-source-group"
          aria-expanded={showFramework}
          onPress={() => {
            model.showFramework = !model.showFramework;
            model.changed();
          }}
        >
          {`${showFramework ? '▾' : '▸'} Framework and generated code (${rest.length})`}
        </Button>
      ) : null}
      {(showFramework ? rest : rest.filter((s) => s.id === active)).map((s) => (
        <SourceRow
          key={s.id}
          model={model}
          source={s}
          active={s.id === active}
        />
      ))}
    </div>
  );
}
