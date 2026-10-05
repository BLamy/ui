/* The scene inspectors. A scene is a function component, so its inspector is its hooks: props (and the callback props
   that make up its delegate protocol), useState, useMemo and useEffect, the contexts it reads (found from its
   expressions) and the outlets it holds. Its First Responder proxy edits the commands the scene handles; its Exit
   proxy lists the unwinds. */
import { PlainButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ActionList } from './actions';
import { AddButton, ChoiceInput, CodeLine, ColorInput, ExprInput, Field, Help, IconAction, NameInput, Section, TextInput } from './fields';
import { CommandBlock } from './inspect-node';
import { freeNames } from './expr';
import { sceneNames } from './diagnostics';
import { pascal, type Doc, type EffectDef, type PropDef, type Scene, type StateDef, type ValueType } from './model';
import { embedScene, newAction, outletsOf, renameInScene, SEGUE_KINDS } from './ops';
import { designScope } from './scope';
import { useBuilder } from './store';
import { allNodes, sceneActions } from './tree';

const TYPES: { id: ValueType; label: string }[] = [
  { id: 'string', label: 'String' }, { id: 'number', label: 'Number' }, { id: 'boolean', label: 'Boolean' },
  { id: 'list', label: 'Array' }, { id: 'object', label: 'Object' }, { id: 'any', label: 'Any' },
];
const TS: Record<ValueType, string> = { string: 'string', number: 'number', boolean: 'boolean', list: 'any[]', object: 'Record<string, any>', any: 'any' };
const BLANK: Record<ValueType, string> = { string: "''", number: '0', boolean: 'false', list: '[]', object: '{}', any: 'null' };

const taken = (s: Scene, except?: string) => [...s.props.map((p) => p.name), ...s.state.map((v) => v.name), ...s.memos.map((m) => m.name)].filter((n) => n !== except);
const fresh = (s: Scene, base: string) => {
  const t = taken(s);
  if (!t.includes(base)) return base;
  for (let i = 2; ; i++) if (!t.includes(`${base}${i}`)) return `${base}${i}`;
};

/** Every name a scene's expressions read, from anywhere in it. */
export function namesReadIn(scene: Scene): Set<string> {
  const out = new Set<string>();
  const add = (src?: string) => { if (src) for (const n of freeNames(src).keys()) out.add(n); };
  for (const n of allNodes(scene.root)) {
    Object.values(n.bind ?? {}).forEach(add);
    add(n.when);
    add(n.repeat?.each);
    add(n.motion?.animate);
    add(n.motion?.layoutId);
  }
  for (const a of sceneActions(scene)) {
    add(a.if);
    if (a.do === 'set') { add(a.value); add(a.target); }
    if (a.do === 'call') a.args.forEach(add);
    if (a.do === 'toast') add(a.message);
  }
  scene.memos.forEach((m) => add(m.expr));
  scene.state.forEach((s) => add(s.initial));
  return out;
}

export function ScenePanel({ scene, doc }: { scene: Scene; doc: Doc }) {
  const b = useBuilder();
  const names = sceneNames(doc, scene);
  const scope = designScope(doc, scene);
  const upd = (fn: (s: Scene) => Scene) => b.updateScene(scene.id, fn);
  const rename = (from: string, to: string) => b.commit((d) => renameInScene(d, scene.id, from, to));
  const read = namesReadIn(scene);
  const contexts = doc.contexts.filter((c) => read.has(c.alias));
  const outlets = outletsOf(scene);
  const out = doc.segues.filter((g) => g.from === scene.id);
  const into = doc.segues.filter((g) => g.to === scene.id);

  const setProp = (i: number, p: Partial<PropDef>) => upd((s) => ({ ...s, props: s.props.map((x, k) => (k === i ? { ...x, ...p } : x)) }));
  const setState = (i: number, p: Partial<StateDef>) => upd((s) => ({ ...s, state: s.state.map((x, k) => (k === i ? { ...x, ...p } : x)) }));
  const setEffect = (id: string, p: Partial<EffectDef>) => upd((s) => ({ ...s, effects: s.effects.map((x) => (x.id === id ? { ...x, ...p } : x)) }));

  return (
    <>
      <Section title="Scene" help="A function component">
        <Field label="Component"><NameInput label="Component name" value={scene.name} taken={doc.scenes.filter((s) => s.id !== scene.id).map((s) => s.name)} onCommit={(v) => upd((s) => ({ ...s, name: pascal(v) }))} /></Field>
        <Field label="Initial scene">
          {doc.entry === scene.id ? <span className="flex items-center gap-1.5 text-footnote text-success"><Icon name="checkmark" size={13} sw={2.6} /> Is the entry point</span>
            : <PlainButton onPress={() => b.commit((d) => ({ ...d, entry: scene.id }))} className="h-7 cursor-pointer rounded-md border-0 bg-secondary px-2 text-caption font-medium text-foreground outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">Make initial scene</PlainButton>}
        </Field>
        <Field label="Background"><ColorInput label="Background" value={scene.background ?? null} onChange={(v) => upd((s) => ({ ...s, background: v }))} /></Field>
        <Field label="Embed in">
          <div className="flex flex-wrap gap-1">
            {(['NavigationStack', 'TabView', 'SplitView'] as const).map((k) => (
              <PlainButton key={k} onPress={() => { const [next, id] = embedScene(doc, scene.id, k); b.commit(() => next, { kind: 'scene', scene: id }); }}
                className="h-6 cursor-pointer rounded-md border-0 bg-secondary px-1.5 font-mono text-caption2 outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
                {k}
              </PlainButton>
            ))}
          </div>
        </Field>
        <CodeLine>{`export function ${scene.name}(${scene.props.length ? `{ ${scene.props.map((p) => p.name).join(', ')} }: ${scene.name}Props` : ''})`}</CodeLine>
      </Section>

      <Section title="Props" help="What a segue passes in (prepare(for:sender:)); callbacks are its delegate" action={<span className="flex">
        <AddButton label="Add prop" onPress={() => upd((s) => ({ ...s, props: [...s.props, { name: fresh(s, 'title'), type: 'string', default: "''" }] }))} />
      </span>}>
        {scene.props.map((p, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              <Icon name={p.callback ? 'phone-fill' : 'arrow-down-to-line'} size={13} sw={2} className={cn('shrink-0', p.callback ? 'text-warning' : 'text-primary')} />
              <div className="min-w-0 flex-1"><NameInput label="Prop name" value={p.name} taken={taken(scene, p.name)} onCommit={(v) => rename(p.name, v)} /></div>
              <IconAction icon="trash" label={`Remove ${p.name}`} tone="danger" onPress={() => upd((s) => ({ ...s, props: s.props.filter((_, k) => k !== i) }))} />
            </div>
            {p.callback ? (
              <Field label="Parameters">
                <TextInput label="Parameters" mono value={(p.params ?? []).join(', ')} placeholder="value" onCommit={(v) => setProp(i, { params: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            ) : (
              <>
                <Field label="Type"><ChoiceInput label="Type" value={p.type} options={TYPES} onChange={(v) => setProp(i, { type: v as ValueType })} /></Field>
                <Field label="Default" wide><ExprInput label="Default" value={p.default} names={new Set(doc.contexts.map((c) => c.alias))} scope={scope} onCommit={(v) => setProp(i, { default: v })} /></Field>
              </>
            )}
          </div>
        ))}
        <div className="flex gap-1">
          <PlainButton onPress={() => upd((s) => ({ ...s, props: [...s.props, { name: fresh(s, 'onDone'), type: 'any', default: 'undefined', callback: true, params: ['value'] }] }))}
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 text-caption font-medium text-primary outline-none hover:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring">
            <Icon name="plus" size={11} sw={2.6} /> Callback (delegate)
          </PlainButton>
        </div>
        {!scene.props.length ? <Help>Props come from the segue that presents the scene (its arguments). A callback prop is a delegate: the scene calls it, and the presenting scene implements it on the segue.</Help> : null}
      </Section>

      <Section title="State" help="useState" action={<AddButton label="Add state" onPress={() => upd((s) => ({ ...s, state: [...s.state, { name: fresh(s, 'value'), type: 'string', initial: "''" }] }))} />}>
        {scene.state.map((v, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1"><NameInput label="State name" value={v.name} taken={taken(scene, v.name)} onCommit={(to) => rename(v.name, to)} /></div>
              <div className="w-24 shrink-0"><ChoiceInput label="Type" value={v.type} options={TYPES} onChange={(t) => setState(i, { type: t as ValueType, initial: v.initial === BLANK[v.type] ? BLANK[t as ValueType] : v.initial })} /></div>
              <IconAction icon="trash" label={`Remove ${v.name}`} tone="danger" onPress={() => upd((s) => ({ ...s, state: s.state.filter((_, k) => k !== i) }))} />
            </div>
            <ExprInput label={`${v.name} initial value`} value={v.initial} multiline={v.type === 'list' || v.type === 'object'} names={new Set([...doc.contexts.map((c) => c.alias), ...scene.props.map((p) => p.name)])} scope={scope} onCommit={(x) => setState(i, { initial: x })} />
            <CodeLine>{`const [${v.name}, set${v.name.charAt(0).toUpperCase()}${v.name.slice(1)}] = useState<${TS[v.type]}>(…)`}</CodeLine>
          </div>
        ))}
        {!scene.state.length ? <Help>State the scene owns. Bind a field’s value to it and typing writes it back; a Set action changes it.</Help> : null}
      </Section>

      <Section title="Derived" help="useMemo" action={<AddButton label="Add memo" onPress={() => upd((s) => ({ ...s, memos: [...s.memos, { name: fresh(s, 'derived'), expr: s.state[0] ? `${s.state[0].name}` : "''" }] }))} />}>
        {scene.memos.map((m, i) => {
          const before = new Set([...names].filter((n) => !scene.memos.slice(i).some((x) => x.name === n)));
          return (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
              <div className="flex items-center gap-1.5">
                <div className="min-w-0 flex-1"><NameInput label="Memo name" value={m.name} taken={taken(scene, m.name)} onCommit={(to) => rename(m.name, to)} /></div>
                <IconAction icon="trash" label={`Remove ${m.name}`} tone="danger" onPress={() => upd((s) => ({ ...s, memos: s.memos.filter((_, k) => k !== i) }))} />
              </div>
              <ExprInput label={`${m.name} expression`} value={m.expr} names={before} scope={scope} onCommit={(x) => upd((s) => ({ ...s, memos: s.memos.map((y, k) => (k === i ? { ...y, expr: x } : y)) }))} />
              <CodeLine>{`const ${m.name} = useMemo(() => …, [${[...freeNames(m.expr).keys()].join(', ')}])`}</CodeLine>
            </div>
          );
        })}
        {!scene.memos.length ? <Help>Values computed from props, state and context, like a form’s “can submit”.</Help> : null}
      </Section>

      <Section title="Effects" help="useEffect" action={<AddButton label="Add effect" onPress={() => upd((s) => ({ ...s, effects: [...s.effects, { id: `e${Date.now().toString(36)}`, on: 'appear', deps: [], actions: [newAction({ do: 'toast', message: "'Hello'" })] }] }))} />}>
        {scene.effects.map((e) => (
          <div key={e.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <ChoiceInput label="When" value={e.on} onChange={(v) => setEffect(e.id, { on: v as EffectDef['on'] })} options={[{ id: 'appear', label: 'Appear' }, { id: 'change', label: 'Change' }, { id: 'disappear', label: 'Disappear' }]} />
              </div>
              <IconAction icon="trash" label="Remove effect" tone="danger" onPress={() => upd((s) => ({ ...s, effects: s.effects.filter((x) => x.id !== e.id) }))} />
            </div>
            {e.on === 'change' ? (
              <Field label="Watches">
                <TextInput label="Dependencies" mono value={e.deps.join(', ')} placeholder={scene.state[0]?.name ?? 'count'} onCommit={(v) => setEffect(e.id, { deps: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
              </Field>
            ) : null}
            <ActionList actions={e.actions} onChange={(l) => setEffect(e.id, { actions: l })} c={{ doc, scene, names, scope }} />
            <CodeLine>{e.on === 'appear' ? 'useEffect(() => { … }, [])' : e.on === 'disappear' ? 'useEffect(() => () => { … }, [])' : `useEffect(() => { … }, [${e.deps.join(', ')}])`}</CodeLine>
          </div>
        ))}
        {!scene.effects.length ? <Help>Run actions when the scene appears (viewDidAppear), disappears, or when some of its state changes.</Help> : null}
      </Section>

      <Section title="Hooks" help="What this component calls, in order">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 font-mono text-caption2 text-muted-foreground">
          {contexts.map((c) => <li key={c.id}><span className="text-primary">useContext</span>({c.name}) → {c.alias}</li>)}
          {scene.state.map((s) => <li key={s.name}><span className="text-primary">useState</span>() → {s.name}</li>)}
          {outlets.map((o) => <li key={o}><span className="text-primary">useRef</span>() → {o}</li>)}
          {scene.memos.map((m) => <li key={m.name}><span className="text-primary">useMemo</span>() → {m.name}</li>)}
          {scene.effects.map((e) => <li key={e.id}><span className="text-primary">useEffect</span>(… on {e.on})</li>)}
          {Object.keys(scene.responds ?? {}).map((c) => <li key={c}><span className="text-primary">useResponder</span>('{c}')</li>)}
          {out.length || into.length ? <li><span className="text-primary">useStoryboard</span>() → perform, dismiss</li> : null}
          {!contexts.length && !scene.state.length && !outlets.length && !scene.memos.length && !scene.effects.length ? <li>None yet</li> : null}
        </ul>
      </Section>

      <Section title="Segues">
        {out.length || into.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {[...out.map((g) => ({ g, dir: 'out' as const })), ...into.map((g) => ({ g, dir: 'in' as const }))].map(({ g, dir }) => (
              <li key={`${dir}${g.id}`}>
                <PlainButton onPress={() => b.select({ kind: 'segue', segue: g.id })} className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-secondary px-2 text-left text-footnote outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
                  <Icon name={dir === 'out' ? 'arrow-right' : 'arrow-left'} size={12} sw={2.4} className="text-primary" />
                  <span className="truncate">{dir === 'out' ? `to ${doc.scenes.find((s) => s.id === g.to)?.name}` : `from ${doc.scenes.find((s) => s.id === g.from)?.name}`}</span>
                  <span className="ml-auto text-caption text-muted-foreground">{SEGUE_KINDS.find((k) => k.id === g.kind)?.label}</span>
                </PlainButton>
              </li>
            ))}
          </ul>
        ) : <Help>Drag from a selected element’s round handle (or Ctrl-drag it) to another scene.</Help>}
      </Section>
    </>
  );
}

/** The scene's First Responder proxy: the commands it handles (its part of the responder chain). */
export function ResponderPanel({ scene, doc }: { scene: Scene; doc: Doc }) {
  const b = useBuilder();
  const responds = scene.responds ?? {};
  const names = sceneNames(doc, scene);
  const scope = designScope(doc, scene);
  const set = (r: Scene['responds']) => b.updateScene(scene.id, (s) => ({ ...s, responds: r && Object.keys(r).length ? r : undefined }));
  return (
    <>
      <Section title="First Responder" help="The responder chain">
        <Help>The first responder is the focused element (a field, a button). “Send to First Responder” starts there and goes up: the element, its parents, the scene, the app. The first that handles the command runs it — like a context resolving to its nearest provider, but starting from focus.</Help>
        <CodeLine>{'sendAction(\'submit\') → useResponder(\'submit\', …)'}</CodeLine>
      </Section>
      <Section title={`${scene.name} responds to`} action={<AddButton label="Handle a command" onPress={() => set({ ...responds, [nextName('command', Object.keys(responds))]: [] })} />}>
        {Object.entries(responds).map(([cmd, list]) => (
          <CommandBlock key={cmd} cmd={cmd} actions={list} c={{ doc, scene, names, scope }}
            onRename={(to) => set(Object.fromEntries(Object.entries(responds).map(([k, v]) => [k === cmd ? to : k, v])))}
            onChange={(l) => set({ ...responds, [cmd]: l })}
            onRemove={() => { const r = { ...responds }; delete r[cmd]; set(r); }} />
        ))}
        {!Object.keys(responds).length ? <Help>Nothing yet. Add a command (submit, save, next) and what it does.</Help> : null}
      </Section>
    </>
  );
}

/** The scene's Exit proxy: how it leaves. */
export function ExitPanel({ scene, doc }: { scene: Scene; doc: Doc }) {
  const unwinds = sceneActions(scene).filter((a) => a.do === 'back' || a.do === 'unwind');
  return (
    <Section title="Exit" help="Unwind segues">
      <Help>An unwind leaves this scene: Dismiss / Back pops it (or closes its sheet) and returns to whatever presented it; Unwind to Scene goes back down the stack to a scene further in. Add them as actions on a button.</Help>
      {unwinds.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {unwinds.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1.5 text-footnote">
              <Icon name="arrow-uturn-backward" size={13} sw={2.2} className="text-destructive" />
              {a.do === 'unwind' ? `Unwind to ${doc.scenes.find((s) => s.id === a.scene)?.name}` : 'Dismiss / Back'}
            </li>
          ))}
        </ul>
      ) : <Help>No unwinds in this scene yet.</Help>}
      <CodeLine>{'const { dismiss, unwind } = useStoryboard()'}</CodeLine>
    </Section>
  );
}

const nextName = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base;
  for (let i = 2; ; i++) if (!taken.includes(`${base}${i}`)) return `${base}${i}`;
};
