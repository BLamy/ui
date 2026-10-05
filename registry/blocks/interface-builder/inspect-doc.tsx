/* The inspectors for what isn't a node or a scene: a segue (how it presents, how it moves, the props it passes —
   prepare(for:sender:) — and the destination's delegate, implemented here), a context (its fields, and who reads
   them), the entry point, and the storyboard itself (its device, the commands the app handles, and its JSON). */
import { FontStackPicker } from '@/components/ui/font-picker';
import { PlainButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { ActionList } from './actions';
import { TransitionEditor } from './curves';
import { blankDoc, SAMPLE_DOC, SPLIT_SAMPLE } from './data';
import { AddButton, ChoiceInput, CodeLine, ExprInput, Field, Help, IconAction, NameInput, Section } from './fields';
import { CommandBlock } from './inspect-node';
import { namesReadIn } from './inspect-scene';
import { sceneNames } from './diagnostics';
import { DEVICES, pascal, type ContextDef, type DeviceId, type Doc, type Segue, type SegueKind, type ValueType } from './model';
import { removeScene, removeSegue, renameContextAlias, SEGUE_KINDS, segueTransition, setDevice } from './ops';
import { designScope } from './scope';
import { useBuilder } from './store';
import { allNodes, segueSource, walk } from './tree';

const TYPES: { id: ValueType; label: string }[] = [
  { id: 'string', label: 'String' }, { id: 'number', label: 'Number' }, { id: 'boolean', label: 'Boolean' },
  { id: 'list', label: 'Array' }, { id: 'object', label: 'Object' }, { id: 'any', label: 'Any' },
];

const danger = 'flex h-7 cursor-pointer items-center gap-1.5 self-start rounded-md border-0 bg-transparent px-2 text-caption font-medium text-destructive outline-none hover:bg-destructive/10 data-focus-visible:ring-2 data-focus-visible:ring-ring';

export function SeguePanel({ segue, doc }: { segue: Segue; doc: Doc }) {
  const b = useBuilder();
  const from = doc.scenes.find((s) => s.id === segue.from)!;
  const to = doc.scenes.find((s) => s.id === segue.to)!;
  if (!from || !to) return null;
  const upd = (patch: Partial<Segue>, live = false) => {
    const fn = (d: Doc) => ({ ...d, segues: d.segues.map((g) => (g.id === segue.id ? { ...g, ...patch } : g)) });
    if (live) b.patch(fn); else b.commit(fn);
  };
  // The source's scope, with the item of the row that performs it (a segue from a list row passes the row's item).
  const src = segueSource(from, segue.id);
  const names = sceneNames(doc, from);
  walk(from.root, (n) => { if (n.repeat && src && allNodes(n).some((x) => x.id === src.id)) { names.add(n.repeat.as || 'item'); names.add('index'); } });
  const scope = designScope(doc, from);
  const valueProps = to.props.filter((p) => !p.callback);
  const callbacks = to.props.filter((p) => p.callback);
  const shared = (s: typeof from) => allNodes(s.root).filter((n) => n.motion?.layoutId).map((n) => n.motion!.layoutId!);
  const kind = SEGUE_KINDS.find((k) => k.id === segue.kind)!;

  return (
    <>
      <Section title="Segue" help="How one scene presents another">
        <Field label="Identifier"><NameInput label="Identifier" value={segue.identifier} taken={doc.segues.filter((g) => g.id !== segue.id).map((g) => g.identifier)} onCommit={(v) => upd({ identifier: v })} /></Field>
        <Field label="From"><span className="text-footnote font-medium">{from.name}{src ? <span className="text-muted-foreground"> · {src.name ?? src.type}</span> : null}</span></Field>
        <Field label="To"><ChoiceInput label="Destination" value={segue.to} options={doc.scenes.filter((s) => s.id !== segue.from).map((s) => ({ id: s.id, label: s.name }))} onChange={(v) => upd({ to: v, args: {}, delegates: {} })} /></Field>
        <Field label="Kind" hint={kind.help}>
          <ChoiceInput label="Kind" value={segue.kind} options={SEGUE_KINDS.map((k) => ({ id: k.id, label: k.label }))} onChange={(v) => upd({ kind: v as SegueKind, transition: segueTransition(v as SegueKind) })} />
        </Field>
        <CodeLine>{`perform('${segue.identifier}'${Object.keys(segue.args).length ? `, { ${Object.entries(segue.args).map(([k, v]) => (k === v ? k : `${k}: ${v}`)).join(', ')} }` : ''})`}</CodeLine>
      </Section>

      {segue.kind === 'magic' ? (
        <Section title="Magic Motion" help="Shared elements: matching layoutIds">
          <Help>Elements with the same Magic Motion id (layoutId) in both scenes fly from one to the other; everything else cross-fades.</Help>
          <div className="grid grid-cols-2 gap-2 text-caption">
            <div><div className="mb-0.5 font-semibold">{from.name}</div>{shared(from).map((x) => <code key={x} className="block truncate font-mono text-caption2 text-primary">{x}</code>)}</div>
            <div><div className="mb-0.5 font-semibold">{to.name}</div>{shared(to).map((x) => <code key={x} className="block truncate font-mono text-caption2 text-primary">{x}</code>)}</div>
          </div>
        </Section>
      ) : null}

      <Section title="Transition" help="The spring or curve the scenes move on">
        <TransitionEditor spec={segue.transition} onBegin={b.begin} onChange={(s, live) => upd({ transition: s }, live)} />
      </Section>

      <Section title="Arguments" help="prepare(for:sender:): the destination's props">
        {valueProps.length ? valueProps.map((p) => (
          <Field key={p.name} label={p.name} wide hint={segue.args[p.name] ? undefined : `Not passed: ${p.default}`}>
            <ExprInput label={`${p.name} argument`} value={segue.args[p.name] ?? ''} placeholder="Use the default" names={names} scope={scope}
              onCommit={(v) => { const args = { ...segue.args }; if (v.trim()) args[p.name] = v; else delete args[p.name]; upd({ args }); }} />
          </Field>
        )) : <Help>{to.name} takes no props. Add some in its scene inspector.</Help>}
      </Section>

      <Section title="Delegate" help={`${from.name} implements ${to.name}'s callbacks`}>
        {callbacks.length ? callbacks.map((p) => (
          <div key={p.name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="text-footnote font-medium">{p.name}</span>
              <code className="font-mono text-caption2 text-muted-foreground">({(p.params ?? []).join(', ')}) =&gt; …</code>
            </div>
            <ActionList
              actions={segue.delegates[p.name] ?? []}
              onChange={(l) => upd({ delegates: { ...segue.delegates, [p.name]: l } })}
              c={{ doc, scene: from, names: new Set([...names, ...(p.params ?? [])]), scope }}
              empty="Not implemented: calling it does nothing"
            />
          </div>
        )) : <Help>{to.name} has no callback props. A callback prop is how a presented scene talks back: it calls it, and the scene that presented it decides what happens — a delegate.</Help>}
      </Section>

      <Section title="Danger">
        <PlainButton onPress={() => b.commit((d) => removeSegue(d, segue.id), { kind: 'scene', scene: from.id })} className={danger}>
          <Icon name="trash" size={13} sw={2.2} /> Delete Segue
        </PlainButton>
      </Section>
    </>
  );
}

export function ContextPanel({ ctx, doc }: { ctx: ContextDef; doc: Doc }) {
  const b = useBuilder();
  const upd = (patch: Partial<ContextDef>) => b.commit((d) => ({ ...d, contexts: d.contexts.map((c) => (c.id === ctx.id ? { ...c, ...patch } : c)) }));
  const readers = doc.scenes.filter((s) => namesReadIn(s).has(ctx.alias));
  const initial = `{ ${ctx.fields.map((f) => `${f.name}: ${f.initial}`).join(', ')} }`;
  return (
    <>
      <Section title="Context" help="React context, provided at the app's root">
        <Field label="Name"><NameInput label="Context name" value={ctx.name} taken={doc.contexts.filter((c) => c.id !== ctx.id).map((c) => c.name)} onCommit={(v) => upd({ name: pascal(v) })} /></Field>
        <Field label="Read as" hint={`Expressions read it as ${ctx.alias}.field`}>
          <NameInput label="Alias" value={ctx.alias} taken={[...doc.contexts.filter((c) => c.id !== ctx.id).map((c) => c.alias)]} onCommit={(v) => b.commit((d) => renameContextAlias(d, ctx.id, v))} />
        </Field>
        <CodeLine>{`export const ${ctx.name} = createContext(${initial})`}</CodeLine>
        <CodeLine>{`const ${ctx.alias} = useContext(${ctx.name})`}</CodeLine>
      </Section>
      <Section title="Fields" action={<AddButton label="Add field" onPress={() => upd({ fields: [...ctx.fields, { name: `field${ctx.fields.length + 1}`, type: 'string', initial: "''" }] })} />}>
        {ctx.fields.map((f, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-2">
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1"><NameInput label="Field name" value={f.name} taken={ctx.fields.filter((_, k) => k !== i).map((x) => x.name)} onCommit={(v) => upd({ fields: ctx.fields.map((x, k) => (k === i ? { ...x, name: v } : x)) })} /></div>
              <div className="w-24 shrink-0"><ChoiceInput label="Type" value={f.type} options={TYPES} onChange={(v) => upd({ fields: ctx.fields.map((x, k) => (k === i ? { ...x, type: v as ValueType } : x)) })} /></div>
              <IconAction icon="trash" label={`Remove ${f.name}`} tone="danger" onPress={() => upd({ fields: ctx.fields.filter((_, k) => k !== i) })} />
            </div>
            <ExprInput label={`${f.name} initial value`} value={f.initial} names={new Set()} onCommit={(v) => upd({ fields: ctx.fields.map((x, k) => (k === i ? { ...x, initial: v } : x)) })} />
          </div>
        ))}
        <Help>A Set action changes a field for the whole app (the root provider holds it in state); a Context Provider in a scene overrides fields for what’s inside it.</Help>
      </Section>
      <Section title="Read by">
        {readers.length ? readers.map((s) => (
          <PlainButton key={s.id} onPress={() => b.select({ kind: 'scene', scene: s.id })} className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-secondary px-2 text-left text-footnote outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
            <Icon name="circle-fill" size={11} sw={2} className="text-warning" /> {s.name}
          </PlainButton>
        )) : <Help>No scene reads it yet. Bind a prop to {ctx.alias}.field.</Help>}
      </Section>
      <Section title="Danger">
        <PlainButton onPress={() => b.commit((d) => ({ ...d, contexts: d.contexts.filter((c) => c.id !== ctx.id) }), { kind: 'none' })} className={danger}>
          <Icon name="trash" size={13} sw={2.2} /> Delete Context
        </PlainButton>
      </Section>
    </>
  );
}

export function EntryPanel({ doc }: { doc: Doc }) {
  const b = useBuilder();
  return (
    <Section title="Storyboard Entry Point" help="The initial scene">
      <Field label="Initial scene"><ChoiceInput label="Initial scene" value={doc.entry} options={doc.scenes.map((s) => ({ id: s.id, label: s.name }))} onChange={(v) => b.commit((d) => ({ ...d, entry: v }))} /></Field>
      <Help>The scene the app starts on: the root of the navigation stack when you Run. Drag the arrow on the canvas to another scene to change it.</Help>
      <CodeLine>{`<StoryboardProvider initial="${doc.scenes.find((s) => s.id === doc.entry)?.name}">`}</CodeLine>
    </Section>
  );
}

export function DocPanel({ doc }: { doc: Doc }) {
  const b = useBuilder();
  const responds = doc.responds ?? {};
  const names = new Set(doc.contexts.map((c) => c.alias));
  const setResponds = (r: Doc['responds']) => b.commit((d) => ({ ...d, responds: r && Object.keys(r).length ? r : undefined }));
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${doc.name}.storyboard.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const open = () => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const next = JSON.parse(await f.text()) as Doc;
        if (next?.version === 1 && Array.isArray(next.scenes) && next.scenes.length) b.load(next);
      } catch { /* not a storyboard */ }
    };
    input.click();
  };
  const scene = b.doc.scenes.find((s) => s.id === doc.entry);
  return (
    <>
      <Section title="Storyboard">
        <Field label="Name"><NameInput label="Storyboard name" value={doc.name} onCommit={(v) => b.commit((d) => ({ ...d, name: v }))} /></Field>
        <Field label="Device"><ChoiceInput label="Device" value={doc.device} options={(Object.keys(DEVICES) as DeviceId[]).map((id) => ({ id, label: DEVICES[id].name }))} onChange={(v) => b.commit((d) => setDevice(d, v as DeviceId))} /></Field>
        <Field label="Scenes"><span className="text-footnote">{doc.scenes.length} · {doc.segues.length} segues · {doc.contexts.length} contexts</span></Field>
        <Help>Select a scene, an element, a segue or a context to inspect it. Scenes are React components; drag components in from the library (⇧⌘L); drag a selection’s round handle to another scene to add a segue; press Run (⌘R) to play it.</Help>
      </Section>
      <Section title="Typography" help="The app's fonts: the kit's --font-sans and --font-mono, so every component's text takes them">
        {(['sans', 'mono'] as const).map((kind) => (
          <Field key={kind} label={kind === 'sans' ? 'Text' : 'Code'} wide>
            <FontStackPicker
              aria-label={kind === 'sans' ? 'Text fonts' : 'Code fonts'}
              size="sm"
              value={doc.fonts?.[kind] ?? []}
              placeholder={kind === 'sans' ? 'System font' : 'System monospace'}
              defaultCategory={kind === 'mono' ? 'monospace' : 'all'}
              placement="left top"
              onChange={(list) => b.commit((d) => ({ ...d, fonts: { ...d.fonts, [kind]: list.length ? list : undefined } }))}
              onPreview={(list) => b.setPreview(list === undefined ? null : { target: 'doc', props: { [kind]: list } })}
              className="bg-secondary"
            />
          </Field>
        ))}
        <Help>A stack: the first family that loads is used. Hover the list to see every scene in a family; a Text can have a family of its own.</Help>
      </Section>
      <Section title="App responds to" help="The end of every responder chain" action={<AddButton label="Handle a command" onPress={() => setResponds({ ...responds, [`command${Object.keys(responds).length + 1}`]: [] })} />}>
        {Object.entries(responds).map(([cmd, list]) => (
          <CommandBlock key={cmd} cmd={cmd} actions={list} c={{ doc, scene: scene ?? doc.scenes[0], names, scope: {} }}
            onRename={(to) => setResponds(Object.fromEntries(Object.entries(responds).map(([k, v]) => [k === cmd ? to : k, v])))}
            onChange={(l) => setResponds({ ...responds, [cmd]: l })}
            onRemove={() => { const r = { ...responds }; delete r[cmd]; setResponds(r); }} />
        ))}
        {!Object.keys(responds).length ? <Help>Commands no scene handles end here, like an app delegate’s.</Help> : null}
      </Section>
      <Section title="File">
        <div className="flex flex-wrap gap-1.5">
          <PlainButton onPress={download} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-secondary px-2 text-caption font-medium outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring"><Icon name="download" size={13} sw={2.1} /> Export JSON</PlainButton>
          <PlainButton onPress={open} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-secondary px-2 text-caption font-medium outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring"><Icon name="folder" size={13} sw={2.1} /> Open…</PlainButton>
          <PlainButton onPress={() => b.load(blankDoc())} className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-secondary px-2 text-caption font-medium outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring"><Icon name="doc" size={13} sw={2.1} /> New</PlainButton>
        </div>
        <Help>New and Open can be undone.</Help>
      </Section>
      <Section title="Samples">
        <PlainButton onPress={() => b.load(SAMPLE_DOC)} className="flex w-full cursor-pointer items-start gap-2 rounded-lg border-0 bg-secondary px-2.5 py-2 text-left outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name="flower" size={16} sw={2} className="mt-0.5 shrink-0 text-success" />
          <span className="flex flex-col"><span className="text-footnote font-medium">Plant Pal · iPhone</span><span className="text-caption2 text-muted-foreground">TabView of NavigationStacks, sheets, delegates, the responder chain</span></span>
        </PlainButton>
        <PlainButton onPress={() => b.load(SPLIT_SAMPLE)} className="flex w-full cursor-pointer items-start gap-2 rounded-lg border-0 bg-secondary px-2.5 py-2 text-left outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <Icon name="sidebar-left" size={16} sw={2} className="mt-0.5 shrink-0 text-primary" />
          <span className="flex flex-col"><span className="text-footnote font-medium">Mail · iPad</span><span className="text-caption2 text-muted-foreground">A three-column SplitView: mailboxes, messages, and a Show Detail segue</span></span>
        </PlainButton>
      </Section>
    </>
  );
}

/** A scene's delete button (the scene inspector's last section). */
export function DeleteScene({ sceneId, doc }: { sceneId: string; doc: Doc }) {
  const b = useBuilder();
  return (
    <Section title="Danger">
      <PlainButton isDisabled={doc.scenes.length <= 1} onPress={() => b.commit((d) => removeScene(d, sceneId), { kind: 'none' })} className={danger}>
        <Icon name="trash" size={13} sw={2.2} /> Delete Scene
      </PlainButton>
    </Section>
  );
}

