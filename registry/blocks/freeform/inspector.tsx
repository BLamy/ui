/* The Format panel: what you can change about the selection, by kind, and how it's arranged. With nothing selected
   it formats the board itself. Sliders checkpoint once when you grab them, then change live. */
import type { ReactNode } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Icon, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { boundsOf, unionRect } from './geometry';
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

/** Color choices. `none` adds a first swatch for "no color": no fill, or the theme's own ink. */
function Swatches({ value, colors, onChange, none, label }: { value: string | null; colors: string[]; onChange: (c: string | null) => void; none?: 'clear' | 'auto'; label: string }) {
  const ring = 'outline-2 outline-offset-2 outline-primary outline-solid';
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {none ? (
        <PlainButton
          aria-label={none === 'clear' ? 'No fill' : 'Automatic'} title={none === 'clear' ? 'None' : 'Automatic'} onPress={() => onChange(null)}
          className={cn('relative grid size-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-background p-0', value === null && ring)}
        >
          {none === 'clear'
            ? <span aria-hidden="true" className="absolute h-px w-8 rotate-45 bg-destructive" />
            : <span aria-hidden="true" className="absolute inset-y-0 right-0 w-1/2 bg-foreground" />}
        </PlainButton>
      ) : null}
      {colors.map((c) => (
        <PlainButton
          key={c} aria-label={c} title={c} onPress={() => onChange(c)}
          className={cn('size-6 cursor-pointer rounded-full border border-black/10 p-0', value === c && ring)}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

function Chip({ active, label, onPress, children }: { active?: boolean; label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PlainButton
      aria-label={label} title={label} onPress={onPress}
      className={cn('grid h-8 min-w-9 cursor-pointer place-items-center rounded-lg border-0 px-2 text-detail font-semibold', active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary-strong')}
    >
      {children}
    </PlainButton>
  );
}

const glyph = (shapes: readonly IconShape[]) => <Icon shapes={shapes} size={18} sw={1.7} />;

/* ── The panel ── */

export function FormatPanel() {
  const f = useFreeform();
  const { selected, selection, byId, board } = f;
  const ids = selected.filter((i) => !i.locked).map((i) => i.id);

  // Change a property on every selected item that `is` the kind; sliders go live.
  const set = (is: (i: Item) => boolean, patch: Record<string, unknown>) => f.update(ids.filter((id) => is(byId.get(id) as Item)), patch);
  const live = (is: (i: Item) => boolean, key: string) => ({
    onChangeStart: () => f.begin(),
    onChange: (v: number) => f.patch((all) => all.map((i) => (ids.includes(i.id) && is(i) ? ({ ...i, [key]: v } as Item) : i))),
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
          <Segmented
            aria-label="Background"
            value={board?.background ?? 'dots'}
            onChange={(b) => f.setBackground(b as Background)}
            options={[{ id: 'dots', label: 'Dots' }, { id: 'grid', label: 'Grid' }, { id: 'none', label: 'Plain' }]}
          />
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
          <Slider label="Text size" showValue minValue={10} maxValue={64} step={1} value={sticky.size} {...live(isSticky, 'size')} />
        </Section>
      ) : null}

      {shape ? (
        <>
          <Section title="Shape">
            <div className="grid grid-cols-6 gap-1">
              {SHAPE_KINDS.map((s) => (
                <PlainButton
                  key={s.kind} aria-label={s.label} title={s.label} onPress={() => set(isShape, { shape: s.kind })}
                  className={cn('grid size-9 cursor-pointer place-items-center rounded-lg border-0 p-0', shape.shape === s.kind ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground hover:bg-secondary')}
                >
                  <ShapeGlyph kind={s.kind} size={24} />
                </PlainButton>
              ))}
            </div>
            <Swatches label="Fill" none="clear" value={shape.fill} colors={[...SHAPE_FILLS, ...SWATCHES]} onChange={(c) => set(isShape, { fill: c })} />
          </Section>
          <Section title="Border">
            <Swatches label="Border color" none="auto" value={shape.stroke} colors={SWATCHES} onChange={(c) => set(isShape, { stroke: c })} />
            <Slider label="Width" showValue minValue={0} maxValue={12} step={1} value={shape.sw} {...live(isShape, 'sw')} />
            <div className="flex gap-2">
              <Chip label="Dashed border" active={shape.dashed} onPress={() => set(isShape, { dashed: !shape.dashed })}>Dashed</Chip>
            </div>
            <Slider label="Opacity" showValue minValue={0.1} maxValue={1} step={0.05} value={shape.opacity} {...live(isShape, 'opacity')} />
          </Section>
          <Section title="Text">
            <Slider label="Size" showValue minValue={10} maxValue={64} step={1} value={shape.size} {...live(isShape, 'size')} />
            <div className="flex items-center gap-1.5">
              <Chip label="Bold" active={shape.bold} onPress={() => set(isShape, { bold: !shape.bold })}><span className="font-bold">B</span></Chip>
              {(['left', 'center', 'right'] as Align[]).map((a) => (
                <Chip key={a} label={`Align ${a}`} active={shape.align === a} onPress={() => set(isShape, { align: a })}>{glyph(G_TEXT_ALIGN[a])}</Chip>
              ))}
            </div>
            <Swatches label="Text color" none="auto" value={shape.textColor} colors={SWATCHES} onChange={(c) => set(isShape, { textColor: c })} />
          </Section>
        </>
      ) : null}

      {text ? (
        <Section title="Text">
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_SIZES.map((t) => (
              <Chip key={t.label} label={t.label} active={text.size === t.size} onPress={() => set(isText, { size: t.size })}><span className="text-caption">{t.label}</span></Chip>
            ))}
          </div>
          <Slider label="Size" showValue minValue={10} maxValue={120} step={1} value={text.size} {...live(isText, 'size')} />
          <div className="flex items-center gap-1.5">
            <Chip label="Bold" active={text.bold} onPress={() => set(isText, { bold: !text.bold })}><span className="font-bold">B</span></Chip>
            <Chip label="Italic" active={text.italic} onPress={() => set(isText, { italic: !text.italic })}><span className="italic">I</span></Chip>
            {(['left', 'center', 'right'] as Align[]).map((a) => (
              <Chip key={a} label={`Align ${a}`} active={text.align === a} onPress={() => set(isText, { align: a })}>{glyph(G_TEXT_ALIGN[a])}</Chip>
            ))}
          </div>
          <Swatches label="Text color" none="auto" value={text.color} colors={SWATCHES} onChange={(c) => set(isText, { color: c })} />
        </Section>
      ) : null}

      {connector ? (
        <Section title="Connector">
          <Segmented aria-label="Route" value={connector.route} onChange={(r) => set(isConnector, { route: r as Route })} options={[{ id: 'straight', label: 'Straight' }, { id: 'elbow', label: 'Elbow' }, { id: 'curve', label: 'Curve' }]} />
          <Segmented aria-label="Arrowheads" value={connector.heads} onChange={(h) => set(isConnector, { heads: h as Heads })} options={[{ id: 'none', label: 'None' }, { id: 'end', label: 'End' }, { id: 'both', label: 'Both' }]} />
          <Swatches label="Line color" none="auto" value={connector.color} colors={SWATCHES} onChange={(c) => set(isConnector, { color: c })} />
          <Slider label="Width" showValue minValue={1} maxValue={12} step={1} value={connector.width} {...live(isConnector, 'width')} />
          <div className="flex gap-2"><Chip label="Dashed line" active={connector.dashed} onPress={() => set(isConnector, { dashed: !connector.dashed })}>Dashed</Chip></div>
        </Section>
      ) : null}

      {stroke ? (
        <Section title="Drawing">
          <Swatches label="Ink" none="auto" value={stroke.color === 'currentColor' ? null : stroke.color} colors={SWATCHES} onChange={(c) => set(isStroke, { color: c ?? 'currentColor' })} />
        </Section>
      ) : null}

      <Section title="Arrange">
        <div className="flex flex-wrap gap-1.5">
          <Chip label="Duplicate" onPress={() => f.duplicate(selection)}><Icon name="copy" size={18} sw={1.7} /></Chip>
          {selection.length > 1 ? <Chip label="Group" onPress={() => f.group(selection)}>{glyph(G_GROUP)}</Chip> : null}
          {selected.some((i) => i.group) ? <Chip label="Ungroup" onPress={() => f.ungroup(selection)}><span className="text-caption">Ungroup</span></Chip> : null}
          <Chip label={selected.every((i) => i.locked) ? 'Unlock' : 'Lock'} active={selected.every((i) => i.locked)} onPress={() => f.setLocked(selection, !selected.every((i) => i.locked))}>
            <Icon name={selected.every((i) => i.locked) ? 'lock-fill' : 'lock-open'} size={18} sw={1.7} />
          </Chip>
          <Chip label="Delete" onPress={() => f.remove(selection)}><Icon name="trash-slim" size={18} sw={1.7} /></Chip>
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
      {(Object.keys(G_ALIGN) as AlignKind[]).map((k) => <Chip key={k} label={labels[k]} onPress={() => align(k)}>{glyph(G_ALIGN[k])}</Chip>)}
    </div>
  );
}
