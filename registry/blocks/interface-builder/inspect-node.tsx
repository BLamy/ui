/* The node inspectors. Attributes: the component's props (each a literal or, with ƒ, an expression of props, state
   and context), when it shows and what it repeats over. Layout: Framer's sizing (fit, fill, fixed) and stack, and the
   box's fill, corners, border, shadow and opacity. Connections: Interface Builder's, in React terms — the outlet
   (a ref), the first responder (autoFocus, and the commands it handles), and the events it sends (its actions). */
import type { ReactNode } from 'react';
import { FontPicker } from '@/components/ui/font-picker';
import { PlainButton } from '@/components/ui/plain-button';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { ActionList, type ActionContext } from './actions';
import { itemsOf, specOf, type PropSpec } from './catalog';
import {
  AddButton, BindToggle, ChoiceInput, CodeLine, ColorInput, ExprInput, Field, Help, IconAction, IconInput, NameInput, NumberInput, Section, SwitchInput, TextInput,
} from './fields';
import { literalSource, refPath, type Scope } from './expr';
import type { Action, Align, Axis, Distribute, Doc, Layout, Literal, Node, Scene, Shadow, Sizing, Style } from './model';
import { outletsOf, renameOutlet, SEGUE_KINDS } from './ops';
import { useBuilder } from './store';
import { segueSource } from './tree';

export interface NodeCtx {
  doc: Doc;
  scene: Scene;
  node: Node;
  names: Set<string>;
  scope: Scope;
  /** Change the node: `live` during a scrub (no undo step; `begin` was called), else one undo step. */
  update: (fn: (n: Node) => Node, live?: boolean) => void;
  begin: () => void;
  /** Show props on the canvas for now, outside the document (null: stop). */
  preview: (props: Record<string, unknown> | null) => void;
}

/* ── Attributes ── */

function LiteralControl({ ps, value, onChange, ctx }: { ps: PropSpec; value: Literal; onChange: (v: Literal, live?: boolean) => void; ctx: NodeCtx }) {
  const c = ps.control;
  const label = ps.label ?? ps.name;
  switch (c.kind) {
    case 'text':
      return <TextInput label={label} value={value == null ? '' : String(value)} multiline={c.multiline} mono={c.mono} placeholder={c.placeholder} onCommit={(v) => onChange(v)} />;
    case 'number':
      return <NumberInput label={label} scrub="none" value={typeof value === 'number' ? value : Number(value) || 0} min={c.min} max={c.max} step={c.step ?? 1} unit={c.unit} onBegin={ctx.begin} onChange={(v, live) => onChange(v, live)} />;
    case 'boolean':
      return <SwitchInput label={label} value={!!value} onChange={(v) => onChange(v)} />;
    case 'enum':
      return <ChoiceInput label={label} value={String(value ?? ps.default ?? '')} options={c.options} onChange={(v) => onChange(v)} />;
    case 'color':
      return <ColorInput label={label} value={value == null ? null : String(value)} onChange={(v) => onChange(v)} />;
    case 'icon':
      return <IconInput label={label} value={value == null ? null : String(value)} onChange={(v) => onChange(v)} />;
    case 'items':
      return (
        <div className="flex flex-col gap-1">
          <TextInput label={label} value={String(value ?? '')} onCommit={(v) => onChange(v)} />
          <span className="text-caption2 text-muted-foreground">{itemsOf(value).length} items, comma-separated{c.icons ? ' · Label:icon' : ''}</span>
        </div>
      );
    case 'date':
      return <TextInput label={label} mono value={String(value ?? '')} placeholder="2026-10-04" onCommit={(v) => onChange(v)} />;
    case 'context':
      return <ChoiceInput label={label} value={String(value ?? '')} options={ctx.doc.contexts.length ? ctx.doc.contexts.map((x) => ({ id: x.id, label: x.name })) : [{ id: '', label: 'No contexts yet' }]} onChange={(v) => onChange(v)} />;
    case 'scene':
      return <ChoiceInput label={label} value={String(value ?? '')} options={[{ id: '', label: 'Choose a scene…' }, ...ctx.doc.scenes.filter((x) => x.id !== ctx.scene.id).map((x) => ({ id: x.id, label: x.name }))]} onChange={(v) => onChange(v || null)} />;
    case 'font':
      return (
        <FontInput
          label={label}
          value={typeof value === 'string' && value ? value : null}
          systemLabel="App font"
          onChange={(v) => onChange(v)}
          onPreview={(f) => ctx.preview(f === undefined ? null : { [ps.name]: f })}
        />
      );
  }
}

/** A font family, from the FontPicker in the inspector's size; hovering the list previews it on the canvas. */
function FontInput({ label, value, systemLabel, onChange, onPreview }: {
  label: string; value: string | null; systemLabel: string; onChange: (v: string | null) => void; onPreview: (f: string | null | undefined) => void;
}) {
  return (
    <FontPicker
      aria-label={label}
      value={value}
      systemLabel={systemLabel}
      onChange={onChange}
      onPreview={onPreview}
      size="sm"
      placement="left top"
      className="h-7 rounded-md bg-secondary px-2 text-footnote hover:bg-secondary-strong"
    />
  );
}

/** A prop: its literal control, or (bound) its expression; ƒ switches between them. */
function PropRow({ ps, ctx }: { ps: PropSpec; ctx: NodeCtx }) {
  const { node } = ctx;
  const bound = node.bind?.[ps.name];
  const value = node.props[ps.name] ?? ps.default;
  const setLiteral = (v: Literal, live?: boolean) => ctx.update((n) => ({ ...n, props: { ...n.props, [ps.name]: v } }), live);
  const setBinding = (src: string | null) => ctx.update((n) => {
    const bind = { ...n.bind };
    if (src == null) delete bind[ps.name];
    else bind[ps.name] = src;
    return { ...n, bind: Object.keys(bind).length ? bind : undefined };
  });
  const two = ps.twoWay && bound && refPath(bound);
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)_24px] items-start gap-x-2">
      <span className="truncate pt-1.5 font-mono text-caption2 text-muted-foreground" title={[ps.label && ps.label !== ps.name ? ps.label : null, ps.part, ps.help].filter(Boolean).join(' · ') || ps.name}>{ps.name === 'children' ? 'children' : ps.name}</span>
      <div className="min-w-0">
        {bound != null ? (
          <ExprInput label={`${ps.name} binding`} value={bound} names={ctx.names} scope={ctx.scope} onCommit={(v) => setBinding(v.trim() ? v : null)} />
        ) : (
          <LiteralControl ps={ps} value={value} onChange={setLiteral} ctx={ctx} />
        )}
        {two ? <span className="mt-0.5 block text-caption2 text-success">↔ two-way: {ps.twoWay} writes {bound}</span> : null}
        {ps.part ? <span className="mt-0.5 block font-mono text-caption2 text-tertiary-foreground">{ps.part}</span> : null}
      </div>
      <BindToggle label={ps.name} bound={bound != null} onToggle={() => setBinding(bound != null ? null : guess(ps, ctx) ?? literalSource(value))} />
    </div>
  );
}

/** What a new binding starts as: a two-way prop picks state of its type; anything else its literal. */
function guess(ps: PropSpec, ctx: NodeCtx): string | null {
  if (!ps.twoWay) return null;
  const want = ps.control.kind === 'boolean' ? 'boolean' : ps.control.kind === 'number' ? 'number' : 'string';
  return ctx.scene.state.find((s) => s.type === want)?.name ?? null;
}

export function AttributesPanel({ ctx }: { ctx: NodeCtx }) {
  const { node, doc } = ctx;
  const spec = specOf(node.type);
  const provider = node.type === 'Provider' ? doc.contexts.find((c) => c.id === node.props.context) : null;
  // Props in a group (Typography) get a section of their own, after the component's.
  const own = spec.props.filter((ps) => !ps.group);
  const groups = [...new Set(spec.props.map((ps) => ps.group).filter((g): g is string => !!g))];
  return (
    <>
      {own.length ? (
        <Section title={spec.title} help={spec.description}>
          {own.map((ps) => <PropRow key={ps.name} ps={ps} ctx={ctx} />)}
        </Section>
      ) : null}
      {groups.map((g) => (
        <Section key={g} title={g}>
          {spec.props.filter((ps) => ps.group === g).map((ps) => <PropRow key={ps.name} ps={ps} ctx={ctx} />)}
        </Section>
      ))}

      {node.type === 'SceneRef' ? <EmbeddedProps ctx={ctx} /> : null}

      {provider ? (
        <Section title={`Provides ${provider.name}`} help="Overrides fields of the context for everything inside">
          {provider.fields.map((f) => (
            <Field key={f.name} label={f.name} wide>
              <ExprInput label={f.name} value={node.bind?.[f.name] ?? ''} placeholder={`${provider.alias}.${f.name} (unchanged)`} names={ctx.names} scope={ctx.scope}
                onCommit={(v) => ctx.update((n) => {
                  const bind = { ...n.bind };
                  if (v.trim()) bind[f.name] = v; else delete bind[f.name];
                  return { ...n, bind };
                })} />
            </Field>
          ))}
          <CodeLine>{`<${provider.name}.Provider value={{ ...${provider.alias}, … }}>`}</CodeLine>
        </Section>
      ) : null}

      <Section
        title="Visibility"
        help="Render only while an expression is true: {cond && …}"
        action={<SwitchInput label="Shown conditionally" value={node.when != null} onChange={(on) => ctx.update((n) => ({ ...n, when: on ? (ctx.scene.state.find((s) => s.type === 'boolean')?.name ?? 'true') : undefined }))} />}
      >
        {node.when != null ? (
          <>
            <ExprInput label="Shown when" value={node.when} names={ctx.names} scope={ctx.scope} onCommit={(v) => ctx.update((n) => ({ ...n, when: v.trim() || undefined }))} />
            <Help>Give it an Exit effect in Motion and it animates out (AnimatePresence).</Help>
          </>
        ) : <Help>Always rendered.</Help>}
      </Section>

      {ctx.scene.root.id !== node.id ? (
        <Section
          title="Repeat"
          help="A prototype cell: render once per item of a list (.map)"
          action={<SwitchInput label="Repeat over a list" value={!!node.repeat} onChange={(on) => ctx.update((n) => ({ ...n, repeat: on ? { each: ctx.scene.state.find((s) => s.type === 'list')?.name ?? '[]', as: 'item', key: 'item.id' } : undefined }))} />}
        >
          {node.repeat ? (
            <>
              <Field label="Each" wide><ExprInput label="List" value={node.repeat.each} names={ctx.names} scope={ctx.scope} onCommit={(v) => ctx.update((n) => ({ ...n, repeat: { ...n.repeat!, each: v } }))} /></Field>
              <Field label="As"><NameInput label="Item name" value={node.repeat.as} onCommit={(v) => ctx.update((n) => ({ ...n, repeat: { ...n.repeat!, as: v } }))} /></Field>
              <Field label="Key" wide><ExprInput label="Key" value={node.repeat.key} names={ctx.names} scope={ctx.scope} onCommit={(v) => ctx.update((n) => ({ ...n, repeat: { ...n.repeat!, key: v } }))} /></Field>
              <CodeLine>{`{${node.repeat.each}.map((${node.repeat.as}, index) => <… key={${node.repeat.key || 'index'}} />)}`}</CodeLine>
            </>
          ) : <Help>Renders once. Turn on to repeat it over an array in state, props or context, like a table view’s prototype cell.</Help>}
        </Section>
      ) : null}

      <Section title="About" help={spec.module}>
        <Help>{spec.description}</Help>
        {spec.module ? <CodeLine>{`import { ${spec.tag} } from '${spec.module}'`}</CodeLine> : null}
      </Section>
    </>
  );
}

/** An embedded scene's props, as bindings in this scene: `<PlantDetail plant={…} />`. */
function EmbeddedProps({ ctx }: { ctx: NodeCtx }) {
  const { node, doc } = ctx;
  const target = doc.scenes.find((s) => s.id === node.props.scene);
  if (!target) return <Section title="Embedded scene"><Help>Pick the scene it shows. Or drag a TabView’s, a NavigationStack’s or a SplitView’s round handle to a scene.</Help></Section>;
  const values = target.props.filter((p) => !p.callback);
  const callbacks = target.props.filter((p) => p.callback);
  return (
    <Section title={`<${target.name} />`} help="Its props, as expressions here; its callbacks are under Connections">
      {values.length ? values.map((p) => (
        <Field key={p.name} label={p.name} wide hint={node.bind?.[p.name] ? undefined : `Not passed: ${p.default}`}>
          <ExprInput label={`${p.name} prop`} value={node.bind?.[p.name] ?? ''} placeholder="Use the default" names={ctx.names} scope={ctx.scope}
            onCommit={(v) => ctx.update((n) => {
              const bind = { ...n.bind };
              if (v.trim()) bind[p.name] = v; else delete bind[p.name];
              return { ...n, bind: Object.keys(bind).length ? bind : undefined };
            })} />
        </Field>
      )) : <Help>{target.name} takes no props.</Help>}
      {callbacks.length ? <Help>Callbacks ({callbacks.map((c) => c.name).join(', ')}) are wired under Connections.</Help> : null}
      <CodeLine>{`<${target.name}${values.filter((p) => node.bind?.[p.name]).map((p) => ` ${p.name}={${node.bind![p.name]}}`).join('')}${callbacks.filter((c) => node.on?.[c.name]?.length).map((c) => ` ${c.name}={…}`).join('')} />`}</CodeLine>
    </Section>
  );
}

/* ── Layout ── */

function SizeRow({ label, value, onChange, ctx }: { label: string; value: Sizing; onChange: (v: Sizing, live?: boolean) => void; ctx: NodeCtx }) {
  const mode = typeof value === 'number' ? 'fixed' : value;
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <span className="text-caption text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <Segmented
          aria-label={`${label} sizing`}
          value={mode}
          onChange={(m) => onChange(m === 'fixed' ? 120 : (m as Sizing))}
          options={[{ id: 'fit', label: 'Fit' }, { id: 'fill', label: 'Fill' }, { id: 'fixed', label: 'Fixed' }]}
          className="flex-1 [&_[role=radio]]:px-1 [&_[role=radio]]:py-[3px] [&_[role=radio]]:text-caption"
        />
        {typeof value === 'number' ? (
          <NumberInput label={label} scrub="none" value={value} min={0} max={4000} step={1} unit="px" onBegin={ctx.begin} onChange={(v, live) => onChange(v, live)} className="w-20 shrink-0" />
        ) : null}
      </div>
    </div>
  );
}

function IconChoice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; icon: string; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <Segmented
      aria-label={label}
      value={value}
      onChange={(v) => onChange(v as T)}
      options={options.map((o) => ({ id: o.id, label: <Icon name={o.icon} size={14} sw={2} aria-label={o.label} className="mx-auto" /> }))}
      className="[&_[role=radio]]:py-[4px]"
    />
  );
}

export function LayoutPanel({ ctx }: { ctx: NodeCtx }) {
  const { node } = ctx;
  const spec = specOf(node.type);
  const L = node.layout ?? {}, S = node.style ?? {};
  const setL = (patch: Partial<Layout>, live?: boolean) => ctx.update((n) => ({ ...n, layout: { ...n.layout, ...patch } }), live);
  const setS = (patch: Partial<Style>, live?: boolean) => ctx.update((n) => ({ ...n, style: { ...n.style, ...patch } }), live);
  const axis = L.axis ?? 'vertical';
  const pad = L.padding ?? 0;
  const sides = Array.isArray(pad);
  const isRoot = ctx.scene.root.id === node.id;
  return (
    <>
      <Section title="Size" help="Framer’s sizing: Fit hugs the contents, Fill takes the free space, Fixed is exact">
        <SizeRow label="Width" value={L.width ?? 'fit'} onChange={(v, live) => setL({ width: v }, live)} ctx={ctx} />
        <SizeRow label="Height" value={L.height ?? 'fit'} onChange={(v, live) => setL({ height: v }, live)} ctx={ctx} />
        {isRoot ? <Help>The root fills the scene’s safe area.</Help> : null}
      </Section>

      {spec.container ? (
        <Section title="Stack" help="How it lays out its children">
          <Field label="Direction">
            <IconChoice<Axis> label="Direction" value={axis} onChange={(v) => setL({ axis: v })} options={[
              { id: 'vertical', icon: 'arrow-down', label: 'Vertical' },
              { id: 'horizontal', icon: 'arrow-right', label: 'Horizontal' },
              { id: 'overlay', icon: 'square-on-square', label: 'Overlay' },
            ]} />
          </Field>
          <Field label={axis === 'overlay' ? 'Horizontal' : 'Align'}>
            <IconChoice<Align> label="Alignment" value={L.align ?? 'start'} onChange={(v) => setL({ align: v })} options={[
              { id: 'start', icon: axis === 'horizontal' ? 'arrow-up' : 'arrow-left', label: 'Start' },
              { id: 'center', icon: 'minus', label: 'Center' },
              { id: 'end', icon: axis === 'horizontal' ? 'arrow-down' : 'arrow-right', label: 'End' },
              { id: 'stretch', icon: 'arrows-expand', label: 'Stretch' },
            ]} />
          </Field>
          <Field label={axis === 'overlay' ? 'Vertical' : 'Distribute'}>
            <ChoiceInput label="Distribution" value={L.distribute ?? 'start'} onChange={(v) => setL({ distribute: v as Distribute })} options={axis === 'overlay'
              ? [{ id: 'start', label: 'Top' }, { id: 'center', label: 'Center' }, { id: 'end', label: 'Bottom' }]
              : [{ id: 'start', label: 'Start' }, { id: 'center', label: 'Center' }, { id: 'end', label: 'End' }, { id: 'between', label: 'Space Between' }, { id: 'around', label: 'Space Around' }, { id: 'evenly', label: 'Space Evenly' }]} />
          </Field>
          {axis !== 'overlay' ? <NumberInput label="Gap" value={L.gap ?? 0} min={0} max={400} step={1} unit="px" onBegin={ctx.begin} onChange={(v, live) => setL({ gap: v }, live)} /> : null}
          {sides ? (
            <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-2">
              <span className="pt-1.5 text-caption text-muted-foreground">Padding</span>
              <div className="grid grid-cols-2 gap-1">
                {(['Top', 'Right', 'Bottom', 'Left'] as const).map((side, i) => (
                  <NumberInput key={side} label={side} scrub="none" value={(pad as number[])[i]} min={0} max={400} step={1} onBegin={ctx.begin}
                    onChange={(v, live) => setL({ padding: Object.assign([...(pad as number[])], { [i]: v }) as [number, number, number, number] }, live)} />
                ))}
              </div>
            </div>
          ) : (
            <NumberInput label="Padding" value={pad as number} min={0} max={400} step={1} unit="px" onBegin={ctx.begin} onChange={(v, live) => setL({ padding: v }, live)} />
          )}
          <Field label="">
            <PlainButton onPress={() => setL({ padding: sides ? (pad as number[])[0] : [pad as number, pad as number, pad as number, pad as number] })}
              className="h-6 cursor-pointer rounded-md border-0 bg-transparent px-1 text-caption text-primary outline-none hover:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring">
              {sides ? 'Same on every side' : 'Each side separately'}
            </PlainButton>
          </Field>
          {axis === 'horizontal' ? <Field label="Wrap"><SwitchInput label="Wrap" value={!!L.wrap} onChange={(v) => setL({ wrap: v })} /></Field> : null}
          <Field label="Overflow">
            <ChoiceInput label="Overflow" value={L.overflow ?? 'visible'} onChange={(v) => setL({ overflow: v as Layout['overflow'] })} options={[{ id: 'visible', label: 'Show' }, { id: 'hidden', label: 'Clip' }, { id: 'scroll', label: 'Scroll' }]} />
          </Field>
        </Section>
      ) : null}

      <Section title="Style">
        <Field label="Fill"><ColorInput label="Fill" value={S.fill ?? null} onChange={(v) => setS({ fill: v })} /></Field>
        <NumberInput label="Radius" value={S.radius ?? 0} min={0} max={400} step={1} unit="px" onBegin={ctx.begin} onChange={(v, live) => setS({ radius: v }, live)} />
        <NumberInput label="Border" value={S.borderWidth ?? 0} min={0} max={40} step={0.5} unit="px" onBegin={ctx.begin} onChange={(v, live) => setS({ borderWidth: v }, live)} />
        {S.borderWidth ? <Field label="Border color"><ColorInput label="Border color" value={S.borderColor ?? null} onChange={(v) => setS({ borderColor: v })} /></Field> : null}
        <Field label="Shadow">
          <ChoiceInput label="Shadow" value={S.shadow ?? 'none'} onChange={(v) => setS({ shadow: v as Shadow })} options={[{ id: 'none', label: 'None' }, { id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }]} />
        </Field>
        <NumberInput label="Opacity" value={S.opacity ?? 1} min={0} max={1} step={0.01} onBegin={ctx.begin} onChange={(v, live) => setS({ opacity: v }, live)} />
      </Section>
    </>
  );
}

/* ── Connections ── */

/** Where the actions of an event on this node can look: its scene's names, the row's item, and `event`. */
const eventContext = (ctx: NodeCtx): ActionContext => ({ doc: ctx.doc, scene: ctx.scene, names: new Set([...ctx.names, 'event']), scope: ctx.scope });

export function ConnectionsPanel({ ctx, onSelectSegue }: { ctx: NodeCtx; onSelectSegue: (id: string) => void }) {
  const b = useBuilder();
  const { node, scene, doc } = ctx;
  const spec = specOf(node.type);
  const outlets = outletsOf(scene).filter((o) => o !== node.ref);
  const target = node.type === 'SceneRef' ? doc.scenes.find((s) => s.id === node.props.scene) : null;
  // An embedded scene sends its callback props, with their parameters; anything else, its component's events and Tap.
  const events = target
    ? target.props.filter((p) => p.callback).map((p) => ({ name: p.name, label: `${p.name}(${(p.params ?? []).join(', ')})`, value: undefined, params: p.params ?? [] }))
    : [...spec.events.map((e) => ({ ...e, params: [] as string[] })), { name: 'onTap', label: 'Tap (any element)', value: undefined, params: [] as string[] }];
  const setActions = (event: string, list: Action[]) => ctx.update((n) => {
    const on = { ...n.on, [event]: list };
    if (!list.length) delete on[event];
    return { ...n, on: Object.keys(on).length ? on : undefined };
  });
  const responds = node.responds ?? {};
  const setResponds = (cmd: string, list: Action[] | null) => ctx.update((n) => {
    const r = { ...n.responds };
    if (list) r[cmd] = list; else delete r[cmd];
    return { ...n, responds: Object.keys(r).length ? r : undefined };
  });
  const segues = doc.segues.filter((g) => g.from === scene.id && segueSource(scene, g.id)?.id === node.id);
  const suggested = (node.name ?? spec.title).replace(/[^A-Za-z0-9 ]/g, '').trim();

  return (
    <>
      <Section title="Outlet" help="IBOutlet → useRef: a handle on the rendered element">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <NameInput label="Outlet name" placeholder="none" value={node.ref ?? ''} taken={outlets}
              onCommit={(v) => b.commit((d) => renameOutlet(d, scene.id, node.id, v || undefined))} />
          </div>
          {node.ref ? <IconAction icon="xmark" label="Remove outlet" onPress={() => b.commit((d) => renameOutlet(d, scene.id, node.id, undefined))} />
            : <PlainButton onPress={() => b.commit((d) => renameOutlet(d, scene.id, node.id, camelName(suggested, outlets)))} className="h-7 shrink-0 cursor-pointer rounded-md border-0 bg-primary/10 px-2 text-caption font-medium text-primary outline-none hover:bg-primary/20 data-focus-visible:ring-2 data-focus-visible:ring-ring">Connect</PlainButton>}
        </div>
        {node.ref ? <CodeLine>{`const ${node.ref} = useRef<HTMLDivElement>(null)`}</CodeLine> : null}
        <Help>Actions focus an outlet (make it first responder), animate it to a variant, or keep a drag inside it.</Help>
      </Section>

      <Section title="First Responder" help="Focus, and the responder chain">
        <Field label="On appear"><span className="flex items-center gap-2"><SwitchInput label="Becomes first responder" value={!!node.autoFocus} onChange={(v) => ctx.update((n) => ({ ...n, autoFocus: v || undefined }))} /><span className="text-caption text-muted-foreground">autoFocus</span></span></Field>
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground">Responds to</span>
          <AddButton label="Handle a command" onPress={() => setResponds(freeName('command', Object.keys(responds)), [])} />
        </div>
        {Object.entries(responds).map(([cmd, list]) => (
          <CommandBlock key={cmd} cmd={cmd} actions={list} c={{ doc, scene, names: ctx.names, scope: ctx.scope }}
            onRename={(to) => { const r = { ...responds }; delete r[cmd]; r[to] = list; ctx.update((n) => ({ ...n, responds: r })); }}
            onChange={(l) => setResponds(cmd, l)} onRemove={() => setResponds(cmd, null)} />
        ))}
        <Help>A command sent to the first responder starts at the focused element and goes up the tree — this node, its parents, the scene, the app — to the first that handles it, the way a context resolves to its nearest provider.</Help>
      </Section>

      <Section title="Sent Events" help="IBAction → event handlers">
        {events.map((ev) => (
          <div key={ev.name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-footnote font-medium text-foreground">{ev.label}</span>
              <code className="font-mono text-caption2 text-muted-foreground">{ev.name}{ev.value ? `(${ev.value.split(' ')[1] ?? 'value'})` : ''}</code>
            </div>
            <ActionList actions={node.on?.[ev.name] ?? []} onChange={(list) => setActions(ev.name, list)} c={{ ...eventContext(ctx), names: new Set([...eventContext(ctx).names, ...ev.params]) }} empty="—" />
          </div>
        ))}
      </Section>

      {segues.length ? (
        <Section title="Triggered Segues">
          {segues.map((g) => (
            <PlainButton key={g.id} onPress={() => onSelectSegue(g.id)} className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-secondary px-2 text-left text-footnote text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
              <Icon name="arrow-right" size={13} sw={2.2} className="text-primary" />
              <span className="truncate">{g.identifier}</span>
              <span className="ml-auto truncate text-caption text-muted-foreground">{SEGUE_KINDS.find((k) => k.id === g.kind)?.label} → {doc.scenes.find((s) => s.id === g.to)?.name}</span>
            </PlainButton>
          ))}
        </Section>
      ) : null}
    </>
  );
}

/** A command a node or scene handles, with its actions. */
export function CommandBlock({ cmd, actions, c, onChange, onRename, onRemove }: {
  cmd: string; actions: Action[]; c: ActionContext; onChange: (l: Action[]) => void; onRename: (to: string) => void; onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
      <div className="flex items-center gap-1.5">
        <Icon name="bolt-fill" size={13} sw={2} className="shrink-0 text-warning" />
        <div className="min-w-0 flex-1"><NameInput label="Command" value={cmd} onCommit={onRename} /></div>
        <IconAction icon="trash" label={`Stop handling ${cmd}`} tone="danger" onPress={onRemove} />
      </div>
      <ActionList actions={actions} onChange={onChange} c={c} />
      <CodeLine>{`useResponder('${cmd}', () => { … })`}</CodeLine>
    </div>
  );
}

const freeName = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}${i}`)) return `${base}${i}`;
};

function camelName(s: string, taken: string[]): string {
  const words = s.split(/\s+/).filter(Boolean);
  const base = words.length ? words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('') : 'outlet';
  return freeName(/^[A-Za-z_$]/.test(base) ? base : `outlet${base}`, taken);
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-8 text-center text-footnote text-muted-foreground">{children}</div>;
}
