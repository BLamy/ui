/* The Motion inspector: framer-motion's props as Framer's effects. Appear animates from the values you list to the
   node's own (initial → animate) when the scene appears or when it scrolls into view; Hover, Press and Focus are
   whileHover, whileTap and whileFocus; Drag is drag with its constraints, elasticity and snap-back; Exit plays when it
   leaves (AnimatePresence); Variants are named states that state picks (`animate={liked ? 'liked' : 'idle'}`) or an
   action plays on an outlet; Layout animates its own layout changes, and a Magic Motion id (layoutId) makes it a shared
   element that flies between scenes; Children staggers what appears inside it. Each has its own transition. */
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { TransitionButton } from './curves';
import { physicsSpec, springSpec, tweenSpec, type TransitionSpec } from './easing';
import { AddButton, ChoiceInput, CodeLine, ColorInput, ExprInput, Field, Help, IconAction, NameInput, NumberInput, Section, SwitchInput, TextInput } from './fields';
import type { NodeCtx } from './inspect-node';
import { specOf } from './catalog';
import type { DragSpec, Effect, Motion, MotionKey, MotionValue, Node, Target } from './model';
import { outletsOf } from './ops';

/* ── Properties ── */

interface KeyInfo { key: MotionKey; label: string; unit?: string; step: number; min?: number; max?: number; base: number | string }

const KEYS: KeyInfo[] = [
  { key: 'opacity', label: 'Opacity', step: 0.01, min: 0, max: 1, base: 0 },
  { key: 'x', label: 'X', unit: 'px', step: 1, base: 0 },
  { key: 'y', label: 'Y', unit: 'px', step: 1, base: 20 },
  { key: 'scale', label: 'Scale', unit: '×', step: 0.01, min: 0, base: 0.9 },
  { key: 'rotate', label: 'Rotate', unit: '°', step: 1, base: -8 },
  { key: 'rotateX', label: 'Rotate X', unit: '°', step: 1, base: 30 },
  { key: 'rotateY', label: 'Rotate Y', unit: '°', step: 1, base: 30 },
  { key: 'skewX', label: 'Skew X', unit: '°', step: 1, base: 8 },
  { key: 'skewY', label: 'Skew Y', unit: '°', step: 1, base: 8 },
  { key: 'blur', label: 'Blur', unit: 'px', step: 0.5, min: 0, base: 8 },
  { key: 'borderRadius', label: 'Radius', unit: 'px', step: 1, min: 0, base: 40 },
  { key: 'backgroundColor', label: 'Fill', step: 1, base: '$primary' },
];
const keyInfo = (k: MotionKey) => KEYS.find((x) => x.key === k)!;

const parseFrames = (s: string): (number | string)[] => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (Number.isFinite(Number(x)) ? Number(x) : x));

/** A target: rows of property and value (a number, a color, or keyframes), and a menu to add more. */
export function TargetEditor({ target, onChange, onBegin, help }: { target: Target; onChange: (t: Target, live: boolean) => void; onBegin: () => void; help?: string }) {
  const keys = Object.keys(target) as MotionKey[];
  const set = (k: MotionKey, v: MotionValue, live = false) => onChange({ ...target, [k]: v }, live);
  const remove = (k: MotionKey) => { const t = { ...target }; delete t[k]; onChange(t, false); };
  const left = KEYS.filter((k) => !keys.includes(k.key));
  return (
    <div className="flex flex-col gap-1.5">
      {keys.map((k) => {
        const ki = keyInfo(k);
        const v = target[k]!;
        return (
          <div key={k} className="flex items-center gap-1">
            {Array.isArray(v) ? (
              <div className="grid min-w-0 flex-1 grid-cols-[84px_minmax(0,1fr)] items-center gap-1.5">
                <span className="truncate text-caption text-muted-foreground" title="Keyframes, comma-separated">{ki.label} ⋯</span>
                <TextInput label={`${ki.label} keyframes`} mono value={v.join(', ')} onCommit={(s) => { const f = parseFrames(s); set(k, f.length > 1 ? f : f[0] ?? ki.base); }} />
              </div>
            ) : k === 'backgroundColor' ? (
              <div className="grid min-w-0 flex-1 grid-cols-[84px_minmax(0,1fr)] items-center gap-1.5">
                <span className="text-caption text-muted-foreground">{ki.label}</span>
                <ColorInput label={ki.label} allowNone={false} value={String(v)} onChange={(c) => set(k, c ?? '$primary')} />
              </div>
            ) : (
              <NumberInput className="min-w-0 flex-1" label={ki.label} value={Number(v)} unit={ki.unit} step={ki.step} min={ki.min} max={ki.max} onBegin={onBegin} onChange={(n, live) => set(k, n, live)} />
            )}
            {k !== 'backgroundColor' ? (
              <IconAction icon={Array.isArray(v) ? 'minus' : 'ellipsis'} label={Array.isArray(v) ? 'One value' : 'Keyframes'} onPress={() => set(k, Array.isArray(v) ? v[0] : [v, typeof v === 'number' ? v : v, ki.key === 'scale' ? 1.1 : typeof v === 'number' ? v / 2 : v])} />
            ) : null}
            <IconAction icon="xmark" label={`Remove ${ki.label}`} tone="danger" onPress={() => remove(k)} />
          </div>
        );
      })}
      {left.length ? (
        <DropdownMenu>
          <PlainButton aria-label="Add property" className="flex h-6 cursor-pointer items-center gap-1 self-start rounded-md border-0 bg-transparent px-1.5 text-caption font-medium text-primary outline-none hover:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring">
            <Icon name="plus" size={11} sw={2.6} /> Property
          </PlainButton>
          <DropdownMenuContent aria-label="Properties" placement="bottom start" onAction={(k) => set(k as MotionKey, keyInfo(k as MotionKey).base)}>
            {left.map((k) => <DropdownMenuItem key={k.key} id={k.key}>{k.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {help ? <Help>{help}</Help> : null}
    </div>
  );
}

/* ── Code previews ── */

const lit = (v: MotionValue) => (Array.isArray(v) ? `[${v.map((x) => (typeof x === 'string' ? `'${x}'` : x)).join(', ')}]` : typeof v === 'string' ? `'${v}'` : String(v));
export const targetCode = (t: Target) => `{ ${Object.entries(t).map(([k, v]) => (k === 'blur' ? `filter: 'blur(${Array.isArray(v) ? v[0] : v}px)'` : `${k}: ${lit(v as MotionValue)}`)).join(', ')} }`;

/* ── The panel ── */

const DEFAULTS = {
  appear: (): Motion['appear'] => ({ target: { opacity: 0, y: 16 }, transition: springSpec(0.6, 0.2), trigger: 'mount', once: true }),
  hover: (): Effect => ({ target: { scale: 1.04 }, transition: springSpec(0.3, 0.3) }),
  press: (): Effect => ({ target: { scale: 0.96 }, transition: physicsSpec(620, 48) }),
  focus: (): Effect => ({ target: { scale: 1.02 }, transition: springSpec(0.3, 0.25) }),
  exit: (): Effect => ({ target: { opacity: 0, y: -8 }, transition: tweenSpec(0.18, 'easeIn') }),
  drag: (): DragSpec => ({ axis: 'both', constraints: 'parent', elastic: 0.35, snapBack: true, momentum: false, target: { scale: 1.06 } }),
};

type EffectKey = 'hover' | 'press' | 'focus' | 'exit';

export function MotionPanel({ ctx, onPlay }: { ctx: NodeCtx; onPlay: () => void }) {
  const { node, scene } = ctx;
  const m: Motion = node.motion ?? {};
  const setM = (patch: Partial<Motion>, live = false) => ctx.update((n: Node) => {
    const next = { ...n.motion, ...patch };
    for (const k of Object.keys(next) as (keyof Motion)[]) if (next[k] === undefined) delete next[k];
    return { ...n, motion: Object.keys(next).length ? next : undefined };
  }, live);
  const spec = specOf(node.type);
  const outlets = outletsOf(scene).filter((o) => o !== node.ref);

  const effect = (key: EffectKey, title: string, prop: string, help: string, targetHelp?: string) => {
    const e = m[key];
    return (
      <Section title={title} help={help} action={<SwitchInput label={title} value={!!e} onChange={(on) => setM({ [key]: on ? DEFAULTS[key]() : undefined })} />}>
        {e ? (
          <>
            <TargetEditor target={e.target} onBegin={ctx.begin} onChange={(t, live) => setM({ [key]: { ...e, target: t } }, live)} help={targetHelp} />
            <TransitionButton spec={e.transition} onBegin={ctx.begin} onChange={(s: TransitionSpec, live) => setM({ [key]: { ...e, transition: s } }, live)} />
            <CodeLine>{`${prop}={${targetCode(e.target)}}`}</CodeLine>
          </>
        ) : <Help>{help}</Help>}
      </Section>
    );
  };

  return (
    <>
      <Section
        title="Appear"
        help="initial → animate: from these values to its own"
        action={<SwitchInput label="Appear" value={!!m.appear} onChange={(on) => setM({ appear: on ? DEFAULTS.appear() : undefined })} />}
      >
        {m.appear ? (
          <>
            <Segmented
              aria-label="Trigger"
              value={m.appear.trigger}
              onChange={(t) => setM({ appear: { ...m.appear!, trigger: t as 'mount' | 'inView' } })}
              options={[{ id: 'mount', label: 'On appear' }, { id: 'inView', label: 'Scrolled into view' }]}
              className="[&_[role=radio]]:py-[3px] [&_[role=radio]]:text-caption"
            />
            {m.appear.trigger === 'inView' ? <Field label="Once"><SwitchInput label="Only the first time" value={m.appear.once} onChange={(v) => setM({ appear: { ...m.appear!, once: v } })} /></Field> : null}
            <TargetEditor target={m.appear.target} onBegin={ctx.begin} onChange={(t, live) => setM({ appear: { ...m.appear!, target: t } }, live)} help="From these values to the node’s own. A list is keyframes on the way." />
            <TransitionButton spec={m.appear.transition} onBegin={ctx.begin} onChange={(s, live) => setM({ appear: { ...m.appear!, transition: s } }, live)} />
            <div className="flex items-center gap-2">
              <PlainButton onPress={onPlay} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-primary px-2.5 text-caption font-semibold text-primary-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring">
                <Icon name="play" size={11} sw={2.4} /> Preview on canvas
              </PlainButton>
            </div>
            <CodeLine>{`initial={${targetCode(m.appear.target)}}`}</CodeLine>
          </>
        ) : <Help>Fade, slide, scale or turn in when the scene appears, or when it scrolls into view. Framer’s Appear effect.</Help>}
      </Section>

      {effect('hover', 'Hover', 'whileHover', 'While the pointer is over it.')}
      {effect('press', 'Press', 'whileTap', 'While it’s pressed. It springs back with the same transition.')}
      {spec.focusable ? effect('focus', 'Focus', 'whileFocus', 'While it (or something inside it) is the first responder.') : null}

      <Section title="Drag" help="drag, dragConstraints, dragElastic, dragSnapToOrigin" action={<SwitchInput label="Draggable" value={!!m.drag} onChange={(on) => setM({ drag: on ? DEFAULTS.drag() : undefined })} />}>
        {m.drag ? (
          <>
            <Field label="Axis">
              <Segmented aria-label="Axis" value={m.drag.axis} onChange={(v) => setM({ drag: { ...m.drag!, axis: v as DragSpec['axis'] } })} options={[{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }, { id: 'both', label: 'Both' }]} className="[&_[role=radio]]:py-[3px] [&_[role=radio]]:text-caption" />
            </Field>
            <Field label="Keep inside">
              <ChoiceInput label="Constraints" value={m.drag.constraints} onChange={(v) => setM({ drag: { ...m.drag!, constraints: v } })} options={[{ id: 'none', label: 'Anywhere' }, { id: 'parent', label: 'Its parent' }, ...outlets.map((o) => ({ id: o, label: `@${o}` }))]} />
            </Field>
            <NumberInput label="Elastic" value={m.drag.elastic} min={0} max={1} step={0.01} onBegin={ctx.begin} onChange={(v, live) => setM({ drag: { ...m.drag!, elastic: v } }, live)} />
            <Field label="Snap back"><SwitchInput label="Snap back to where it started" value={m.drag.snapBack} onChange={(v) => setM({ drag: { ...m.drag!, snapBack: v } })} /></Field>
            <Field label="Momentum"><SwitchInput label="Keep moving after release" value={m.drag.momentum} onChange={(v) => setM({ drag: { ...m.drag!, momentum: v } })} /></Field>
            <div className="text-caption text-muted-foreground">While dragging</div>
            <TargetEditor target={m.drag.target} onBegin={ctx.begin} onChange={(t, live) => setM({ drag: { ...m.drag!, target: t } }, live)} />
            <CodeLine>{`drag${m.drag.axis === 'both' ? '' : `="${m.drag.axis}"`} dragElastic={${m.drag.elastic}}${m.drag.snapBack ? ' dragSnapToOrigin' : ''}`}</CodeLine>
          </>
        ) : <Help>Pick it up and throw it, on one axis or both, kept inside its parent or an outlet.</Help>}
      </Section>

      {effect('exit', 'Exit', 'exit', 'When it leaves: its condition turns false, its row goes, or its scene is dismissed (AnimatePresence).')}

      <Section title="Variants" help="Named states: state picks one, or an action plays one on an outlet" action={<AddButton label="Add variant" onPress={() => {
        const names = Object.keys(m.variants ?? {});
        let name = 'pop';
        for (let i = 2; names.includes(name); i++) name = `pop${i}`;
        setM({ variants: { ...m.variants, [name]: { target: { scale: 1.1 }, transition: springSpec(0.35, 0.4) } } });
      }} />}>
        {Object.entries(m.variants ?? {}).map(([name, v]) => (
          <div key={name} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              <Icon name="sparkle" size={13} sw={2} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <NameInput label="Variant name" value={name} taken={Object.keys(m.variants ?? {}).filter((x) => x !== name)}
                  onCommit={(to) => setM({ variants: Object.fromEntries(Object.entries(m.variants!).map(([k, x]) => [k === name ? to : k, x])) })} />
              </div>
              <IconAction icon="trash" label={`Remove ${name}`} tone="danger" onPress={() => { const vs = { ...m.variants }; delete vs[name]; setM({ variants: Object.keys(vs).length ? vs : undefined }); }} />
            </div>
            <TargetEditor target={v.target} onBegin={ctx.begin} onChange={(t, live) => setM({ variants: { ...m.variants, [name]: { ...v, target: t } } }, live)} />
            <TransitionButton spec={v.transition} onBegin={ctx.begin} onChange={(s, live) => setM({ variants: { ...m.variants, [name]: { ...v, transition: s } } }, live)} />
          </div>
        ))}
        {Object.keys(m.variants ?? {}).length ? (
          <Field label="Show variant" wide hint="An expression naming the variant to be in now: it animates whenever the name changes.">
            <ExprInput label="Animate to" value={m.animate ?? ''} placeholder="e.g. liked ? 'liked' : 'idle'" names={ctx.names} scope={ctx.scope} onCommit={(v) => setM({ animate: v.trim() || undefined })} />
          </Field>
        ) : <Help>Add a state like “shake” or “pop”: an Animate Outlet action plays it, or an expression picks it from state.</Help>}
        {m.animate ? <CodeLine>{`animate={${m.animate}}`}</CodeLine> : null}
      </Section>

      <Section title="Layout" help="layout, layoutId">
        <Field label="Animate layout"><SwitchInput label="Animate layout changes" value={!!m.layout} onChange={(v) => setM({ layout: v || undefined })} /></Field>
        <Field label="Magic Motion" wide hint="A layoutId: an element with the same id in the next scene flies from here to there (a Magic Motion segue).">
          <ExprInput label="Magic Motion id" value={m.layoutId ?? ''} placeholder="e.g. 'hero' or `plant-${plant.id}`" names={ctx.names} scope={ctx.scope} onCommit={(v) => setM({ layoutId: v.trim() || undefined })} />
        </Field>
        {m.layout || m.layoutId ? (
          <TransitionButton label="Layout transition" spec={m.transition ?? springSpec(0.45, 0.15)} onBegin={ctx.begin} onChange={(s, live) => setM({ transition: s }, live)} />
        ) : null}
      </Section>

      {spec.container ? (
        <Section title="Children" help="staggerChildren and delayChildren" action={<SwitchInput label="Stagger children" value={!!m.stagger} onChange={(on) => setM({ stagger: on ? { each: 0.06, delay: 0, from: 'first' } : undefined })} />}>
          {m.stagger ? (
            <>
              <NumberInput label="Each" value={m.stagger.each} min={0} max={2} step={0.01} unit="s" onBegin={ctx.begin} onChange={(v, live) => setM({ stagger: { ...m.stagger!, each: v } }, live)} />
              <NumberInput label="Delay" value={m.stagger.delay} min={0} max={5} step={0.01} unit="s" onBegin={ctx.begin} onChange={(v, live) => setM({ stagger: { ...m.stagger!, delay: v } }, live)} />
              <Field label="From">
                <Segmented aria-label="Stagger from" value={m.stagger.from} onChange={(v) => setM({ stagger: { ...m.stagger!, from: v as 'first' | 'last' } })} options={[{ id: 'first', label: 'First' }, { id: 'last', label: 'Last' }]} className="[&_[role=radio]]:py-[3px] [&_[role=radio]]:text-caption" />
              </Field>
              <Help>Children with an Appear effect start one after another.</Help>
            </>
          ) : <Help>Start the children’s appear effects one after another.</Help>}
        </Section>
      ) : null}
    </>
  );
}
