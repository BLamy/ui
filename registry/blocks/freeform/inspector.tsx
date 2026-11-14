/* The Format panel: what you can change about the selection, by kind, and how it's arranged. With nothing selected
   it formats the board itself. Sliders checkpoint once when a change starts, change live, and end it on commit. */
import { useRef, type ReactNode } from 'react';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup } from '@/components/ui/toggle';
import { Icon, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { boundsOf } from './geometry';
import { unionRect } from '@/lib/canvas-math';
import { G_ALIGN, G_GROUP, G_TEXT_ALIGN, type AlignKind } from './glyphs';
import { ShapeGlyph } from './glyph-views';
import { moveItem } from './handles';
import type { Align, Background, ConnectorItem, Heads, Item, Route, ShapeItem, StickyItem, StrokeItem, TextItem } from './model';
import { SHAPE_FILLS, STICKY_COLORS, SWATCHES, TEXT_SIZES } from './palette';
import { SHAPE_KINDS } from './shapes';
import { useFreeform } from './store';

/* ── Pieces ── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="m-0 text-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** The "no color" swatch's value in the group: no fill, or the theme's own ink. */
const NONE = 'none';
const ring = 'data-pressed:outline-2 data-pressed:outline-offset-2 data-pressed:outline-primary data-pressed:outline-solid';

/** Color choices: one-of-many (the kit's ToggleGroup: one tab stop, arrow keys, the current color pressed). `none`
    adds a first swatch for "no color". */
function Swatches({ value, colors, onChange, none, label }: { value: string | null; colors: string[]; onChange: (c: string | null) => void; none?: 'clear' | 'auto'; label: string }) {
  return (
    <ToggleGroup
      aria-label={label} value={[value ?? NONE]} deselectable={false}
      onValueChange={([next]) => next && onChange(next === NONE ? null : next)}
      className="flex flex-wrap items-center gap-2"
    >
      {none ? (
        <SdkToggle
          value={NONE} aria-label={none === 'clear' ? 'No fill' : 'Automatic'} title={none === 'clear' ? 'None' : 'Automatic'}
          className={cn('relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-background p-0', ring)}
        >
          {none === 'clear'
            ? <span aria-hidden="true" className="absolute h-px w-8 rotate-45 bg-destructive" />
            : <span aria-hidden="true" className="absolute inset-y-0 right-0 w-1/2 bg-foreground" />}
        </SdkToggle>
      ) : null}
      {colors.map((c) => (
        <SdkToggle
          key={c} value={c} aria-label={c} title={c}
          className={cn('size-6 cursor-pointer rounded-full border border-black/10 p-0', ring)}
          style={{ background: c }}
        />
      ))}
    </ToggleGroup>
  );
}

const chip = 'grid h-8 min-w-9 cursor-pointer place-items-center rounded-lg border-0 bg-secondary px-2 text-detail font-semibold text-foreground hover:bg-secondary-strong data-pressed:bg-primary data-pressed:text-primary-foreground';

/** An action chip. */
function Chip({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <SdkButton aria-label={label} title={label} onClick={onClick} className={chip}>
      {children}
    </SdkButton>
  );
}

/** An on/off chip (a UI SDK Toggle), or one choice of a ChipGroup when given a `value`. */
function ChipToggle({ label, value, pressed, onPressedChange, children }: { label: string; value?: string; pressed?: boolean; onPressedChange?: (pressed: boolean) => void; children: ReactNode }) {
  return (
    <SdkToggle aria-label={label} title={label} value={value} pressed={pressed} onPressedChange={onPressedChange} className={chip}>
      {children}
    </SdkToggle>
  );
}

/** One-of-many chips (the kit's ToggleGroup: one tab stop, arrow keys, always one pressed). */
function ChipGroup<T extends string>({ label, value, onChange, className, children }: { label: string; value: T; onChange: (value: T) => void; className?: string; children: ReactNode }) {
  return (
    <ToggleGroup<T> aria-label={label} value={[value]} deselectable={false} onValueChange={([next]) => next && onChange(next)} className={cn('flex items-center gap-1.5', className)}>
      {children}
    </ToggleGroup>
  );
}

const alignChips = (current: Align, onChange: (a: Align) => void) => (
  <ChipGroup<Align> label="Text alignment" value={current} onChange={onChange}>
    {(['left', 'center', 'right'] as Align[]).map((a) => (
      <ChipToggle key={a} value={a} label={`Align ${a}`}>{glyph(G_TEXT_ALIGN[a])}</ChipToggle>
    ))}
  </ChipGroup>
);

const glyph = (shapes: readonly IconShape[]) => <Icon shapes={shapes} size={18} sw={1.7} />;

/* ── The panel ── */

export function FormatPanel() {
  const f = useFreeform();
  const { selected, selection, byId, board } = f;
  const ids = selected.filter((i) => !i.locked).map((i) => i.id);

  // Change a property on every selected item that `is` the kind; sliders go live.
  const set = (is: (i: Item) => boolean, patch: Record<string, unknown>) => f.update(ids.filter((id) => is(byId.get(id) as Item)), patch);
  // The first step of a drag or a key press checkpoints; the commit ends it, so the next change checkpoints again.
  const changing = useRef(false);
  const live = (is: (i: Item) => boolean, key: string) => ({
    onValueChange: (v: number) => {
      if (!changing.current) { changing.current = true; f.begin(); }
      f.patch((all) => all.map((i) => (ids.includes(i.id) && is(i) ? ({ ...i, [key]: v } as Item) : i)));
    },
    onValueCommit: () => { changing.current = false; },
  });

  const first = <T extends Item>(kind: T['kind']) => selected.find((i) => i.kind === kind) as T | undefined;
  const sticky = first<StickyItem>('sticky');
  const shape = first<ShapeItem>('shape');
  const text = first<TextItem>('text');
  const connector = first<ConnectorItem>('connector');
  const stroke = first<StrokeItem>('stroke');
  const isSticky = (i: Item) => i.kind === 'sticky';
  const isShape = (i: Item) => i.kind === 'shape';
  const isText = (i: Item) => i.kind === 'text';
  const isConnector = (i: Item) => i.kind === 'connector';
  const isStroke = (i: Item) => i.kind === 'stroke';

  if (!selected.length) {
    return (
      <div className="flex flex-col gap-3">
        <Section title="Board">
          <Segmented<Background> aria-label="Background" value={board?.background ?? 'dots'} onValueChange={(b) => b && f.setBackground(b)}>
            <SegmentedItem value="dots">Dots</SegmentedItem>
            <SegmentedItem value="grid">Grid</SegmentedItem>
            <SegmentedItem value="none">Plain</SegmentedItem>
          </Segmented>
        </Section>
        <p className="m-0 text-footnote text-muted-foreground">Select something on the board to format it.</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-[min(70vh,560px)] flex-col overflow-y-auto pr-1">
      {sticky ? (
        <Section title="Sticky note">
          <Swatches label="Sticky color" value={sticky.color} colors={STICKY_COLORS} onChange={(c) => c && set(isSticky, { color: c })} />
          <Slider label="Text size" showValue min={10} max={64} step={1} value={sticky.size} {...live(isSticky, 'size')} />
        </Section>
      ) : null}

      {shape ? (
        <>
          <Section title="Shape">
            <div className="grid grid-cols-6 gap-1">
              {SHAPE_KINDS.map((s) => (
                <SdkButton
                  key={s.kind} aria-label={s.label} title={s.label} onClick={() => set(isShape, { shape: s.kind })}
                  className={cn('grid size-9 cursor-pointer place-items-center rounded-lg border-0 p-0', shape.shape === s.kind ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground hover:bg-secondary')}
                >
                  <ShapeGlyph kind={s.kind} size={24} />
                </SdkButton>
              ))}
            </div>
            <Swatches label="Fill" none="clear" value={shape.fill} colors={[...SHAPE_FILLS, ...SWATCHES]} onChange={(c) => set(isShape, { fill: c })} />
          </Section>
          <Section title="Border">
            <Swatches label="Border color" none="auto" value={shape.stroke} colors={SWATCHES} onChange={(c) => set(isShape, { stroke: c })} />
            <Slider label="Width" showValue min={0} max={12} step={1} value={shape.sw} {...live(isShape, 'sw')} />
            <div className="flex gap-2">
              <ChipToggle label="Dashed border" pressed={shape.dashed} onPressedChange={(dashed) => set(isShape, { dashed })}>Dashed</ChipToggle>
            </div>
            <Slider label="Opacity" showValue min={0.1} max={1} step={0.05} value={shape.opacity} {...live(isShape, 'opacity')} />
          </Section>
          <Section title="Text">
            <Slider label="Size" showValue min={10} max={64} step={1} value={shape.size} {...live(isShape, 'size')} />
            <div className="flex items-center gap-1.5">
              <ChipToggle label="Bold" pressed={shape.bold} onPressedChange={(bold) => set(isShape, { bold })}><span className="font-bold">B</span></ChipToggle>
              {alignChips(shape.align, (align) => set(isShape, { align }))}
            </div>
            <Swatches label="Text color" none="auto" value={shape.textColor} colors={SWATCHES} onChange={(c) => set(isShape, { textColor: c })} />
          </Section>
        </>
      ) : null}

      {text ? (
        <Section title="Text">
          <ChipGroup label="Text size" value={TEXT_SIZES.find((t) => t.size === text.size)?.label ?? ''} onChange={(label) => { const t = TEXT_SIZES.find((x) => x.label === label); if (t) set(isText, { size: t.size }); }} className="grid w-full grid-cols-4">
            {TEXT_SIZES.map((t) => (
              <ChipToggle key={t.label} value={t.label} label={t.label}><span className="text-caption">{t.label}</span></ChipToggle>
            ))}
          </ChipGroup>
          <Slider label="Size" showValue min={10} max={120} step={1} value={text.size} {...live(isText, 'size')} />
          <div className="flex items-center gap-1.5">
            <ChipToggle label="Bold" pressed={text.bold} onPressedChange={(bold) => set(isText, { bold })}><span className="font-bold">B</span></ChipToggle>
            <ChipToggle label="Italic" pressed={text.italic} onPressedChange={(italic) => set(isText, { italic })}><span className="italic">I</span></ChipToggle>
            {alignChips(text.align, (align) => set(isText, { align }))}
          </div>
          <Swatches label="Text color" none="auto" value={text.color} colors={SWATCHES} onChange={(c) => set(isText, { color: c })} />
        </Section>
      ) : null}

      {connector ? (
        <Section title="Connector">
          <Segmented<Route> aria-label="Route" value={connector.route} onValueChange={(r) => r && set(isConnector, { route: r })}>
            <SegmentedItem value="straight">Straight</SegmentedItem>
            <SegmentedItem value="elbow">Elbow</SegmentedItem>
            <SegmentedItem value="curve">Curve</SegmentedItem>
          </Segmented>
          <Segmented<Heads> aria-label="Arrowheads" value={connector.heads} onValueChange={(h) => h && set(isConnector, { heads: h })}>
            <SegmentedItem value="none">None</SegmentedItem>
            <SegmentedItem value="end">End</SegmentedItem>
            <SegmentedItem value="both">Both</SegmentedItem>
          </Segmented>
          <Swatches label="Line color" none="auto" value={connector.color} colors={SWATCHES} onChange={(c) => set(isConnector, { color: c })} />
          <Slider label="Width" showValue min={1} max={12} step={1} value={connector.width} {...live(isConnector, 'width')} />
          <div className="flex gap-2"><ChipToggle label="Dashed line" pressed={connector.dashed} onPressedChange={(dashed) => set(isConnector, { dashed })}>Dashed</ChipToggle></div>
        </Section>
      ) : null}

      {stroke ? (
        <Section title="Drawing">
          <Swatches label="Ink" none="auto" value={stroke.color === 'currentColor' ? null : stroke.color} colors={SWATCHES} onChange={(c) => set(isStroke, { color: c ?? 'currentColor' })} />
        </Section>
      ) : null}

      <Section title="Arrange">
        <div className="flex flex-wrap gap-1.5">
          <Chip label="Duplicate" onClick={() => f.duplicate(selection)}><Icon name="copy" size={18} sw={1.7} /></Chip>
          {selection.length > 1 ? <Chip label="Group" onClick={() => f.group(selection)}>{glyph(G_GROUP)}</Chip> : null}
          {selected.some((i) => i.group) ? <Chip label="Ungroup" onClick={() => f.ungroup(selection)}><span className="text-caption">Ungroup</span></Chip> : null}
          <ChipToggle label="Lock" pressed={selected.every((i) => i.locked)} onPressedChange={(locked) => f.setLocked(selection, locked)}>
            <Icon name={selected.every((i) => i.locked) ? 'lock-fill' : 'lock-open'} size={18} sw={1.7} />
          </ChipToggle>
          <Chip label="Delete" onClick={() => f.remove(selection)}><Icon name="trash-slim" size={18} sw={1.7} /></Chip>
        </div>
        {ids.length > 1 ? <AlignRow /> : null}
      </Section>
    </div>
  );
}

/** Line selected items up by an edge or center. */
function AlignRow() {
  const f = useFreeform();
  const movable = f.selected.filter((i) => !i.locked && i.kind !== 'connector');
  if (movable.length < 2) return null;
  const align = (how: AlignKind) => {
    const rects = movable.map((i) => ({ id: i.id, r: boundsOf(i, f.byId) }));
    const box = unionRect(rects.map((x) => x.r));
    if (!box) return;
    const delta = (r: (typeof rects)[number]['r']) => {
      switch (how) {
        case 'left': return { dx: box.x - r.x, dy: 0 };
        case 'right': return { dx: box.x + box.w - (r.x + r.w), dy: 0 };
        case 'hcenter': return { dx: box.x + box.w / 2 - (r.x + r.w / 2), dy: 0 };
        case 'top': return { dx: 0, dy: box.y - r.y };
        case 'bottom': return { dx: 0, dy: box.y + box.h - (r.y + r.h) };
        case 'vcenter': return { dx: 0, dy: box.y + box.h / 2 - (r.y + r.h / 2) };
      }
    };
    const moves = new Map(rects.map((x) => [x.id, delta(x.r)]));
    f.commit((all) => all.map((i) => { const d = moves.get(i.id); return d ? moveItem(i, d.dx, d.dy) : i; }));
  };
  const labels: Record<AlignKind, string> = { left: 'Align left', hcenter: 'Align centers', right: 'Align right', top: 'Align top', vcenter: 'Align middles', bottom: 'Align bottom' };
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(G_ALIGN) as AlignKind[]).map((k) => <Chip key={k} label={labels[k]} onClick={() => align(k)}>{glyph(G_ALIGN[k])}</Chip>)}
    </div>
  );
}
