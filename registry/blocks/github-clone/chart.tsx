/* A small bar chart for Insights: thin bars with rounded data ends on a shared baseline, a tooltip on hover or focus, one
   recessive axis and a "View as table" for screen readers and anyone who wants the numbers. One series needs no legend
   (the title names it); two get one. Bars are the block's primary color and text stays in text colors. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ChartPoint {
  label: string;
  /** Long form for the tooltip. */
  title?: string;
  value: number;
  /** A second series, mirrored below the baseline (additions over deletions). */
  below?: number;
}

export function BarChart({ title, points, unit, height = 120, belowUnit, tickEvery = 13, color = 'bg-primary', belowColor = 'bg-(--gh-closed)' }: {
  title: string; points: ChartPoint[]; unit: string; height?: number; belowUnit?: string; tickEvery?: number; color?: string; belowColor?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const mirrored = points.some((p) => p.below);
  const max = Math.max(1, ...points.map((p) => p.value));
  const maxBelow = Math.max(1, ...points.map((p) => p.below ?? 0));
  const scale = mirrored ? Math.max(max, maxBelow) : max;
  const area = mirrored ? height / 2 : height;
  const shown = hover != null ? points[hover] : null;
  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-semibold">{title}</span>
        {mirrored ? (
          <span className="flex items-center gap-3 text-caption text-muted-foreground">
            <span className="flex items-center gap-1"><span className={cn('size-2 rounded-[1px]', color)} />{unit}</span>
            <span className="flex items-center gap-1"><span className={cn('size-2 rounded-[1px]', belowColor)} />{belowUnit}</span>
          </span>
        ) : null}
        <Button aria-pressed={table} className="cursor-pointer border-0 bg-transparent p-0 text-caption text-primary outline-none data-hovered:underline data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:min-h-11" onPress={() => setTable(!table)}>{table ? 'View as chart' : 'View as table'}</Button>
      </figcaption>
      {table ? (
        <div className="max-h-64 overflow-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={`${title}: table`}>
          <table className="w-full border-collapse text-caption">
            <thead><tr className="bg-muted text-left"><th className="px-2 py-1 font-semibold">Period</th><th className="px-2 py-1 text-right font-semibold">{unit}</th>{mirrored ? <th className="px-2 py-1 text-right font-semibold">{belowUnit}</th> : null}</tr></thead>
            <tbody>{points.map((p) => <tr key={p.label} className="border-t border-border"><td className="px-2 py-1">{p.title ?? p.label}</td><td className="px-2 py-1 text-right tabular-nums">{p.value.toLocaleString('en-US')}</td>{mirrored ? <td className="px-2 py-1 text-right tabular-nums">{(p.below ?? 0).toLocaleString('en-US')}</td> : null}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="relative" role="img" aria-label={`${title}. Highest ${max.toLocaleString('en-US')} ${unit}.`} onMouseLeave={() => setHover(null)}>
            <div className="flex items-stretch gap-0.5" style={{ height }}>
              {points.map((p, i) => (
                <div key={p.label} className="group/bar relative flex min-w-0 flex-1 cursor-default flex-col" onMouseEnter={() => setHover(i)}>
                  <div className="flex flex-col justify-end" style={{ height: area }}>
                    <span className={cn('block rounded-t-[2px]', color, hover != null && hover !== i && 'opacity-50')} style={{ height: p.value ? Math.max(2, (p.value / scale) * area) : 0 }} />
                  </div>
                  {mirrored ? <div style={{ height: area }}><span className={cn('block rounded-b-[2px]', belowColor, hover != null && hover !== i && 'opacity-50')} style={{ height: p.below ? Math.max(2, (p.below / scale) * area) : 0 }} /></div> : null}
                </div>
              ))}
            </div>
            {shown ? (
              <div className="pointer-events-none absolute -top-1 z-2 -translate-y-full rounded-md border border-border bg-popover px-2 py-1 text-caption whitespace-nowrap shadow-hairline" style={{ left: `${Math.min(80, (hover! / points.length) * 100)}%` }}>
                <b className="font-semibold">{shown.title ?? shown.label}</b>: {shown.value.toLocaleString('en-US')} {unit}{shown.below != null ? `, ${shown.below.toLocaleString('en-US')} ${belowUnit}` : ''}
              </div>
            ) : null}
          </div>
          <div className="mt-1 flex justify-between border-t border-border pt-1 text-caption2 text-muted-foreground">
            {points.filter((_, i) => i % tickEvery === 0).map((p) => <span key={p.label}>{p.label}</span>)}
          </div>
        </>
      )}
    </figure>
  );
}
