/* Editing a list of actions: what an event, an effect, a command or a delegate does, in order. Each row says it the
   Interface Builder way and shows the line of React it becomes; press it to edit it. Add one from the menu. */
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSection } from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ChoiceInput, ExprInput, Field, IconAction, TextInput } from './fields';
import type { Scope } from './expr';
import type { Action, ActionInit, ActionKind, Doc, Scene } from './model';
import { commandsIn, newAction, outletsOf, SEGUE_KINDS } from './ops';
import { allNodes } from './tree';

interface KindInfo { kind: ActionKind; label: string; icon: string; help: string; group: 'Navigation' | 'State' | 'Outlets & responders' | 'Delegates & feedback' }

export const ACTION_KINDS: KindInfo[] = [
  { kind: 'segue', label: 'Perform Segue', icon: 'arrow-right', help: 'Present another scene', group: 'Navigation' },
  { kind: 'back', label: 'Dismiss / Back', icon: 'chevron-left', help: 'Pop or dismiss this scene', group: 'Navigation' },
  { kind: 'unwind', label: 'Unwind to Scene', icon: 'arrow-uturn-backward', help: 'Back down the stack to a scene (Exit)', group: 'Navigation' },
  { kind: 'set', label: 'Set State', icon: 'square-pencil', help: 'Set state or a context field: setX(…)', group: 'State' },
  { kind: 'animate', label: 'Animate Outlet', icon: 'sparkle', help: 'Play a variant on a ref (useAnimate)', group: 'Outlets & responders' },
  { kind: 'focus', label: 'Make First Responder', icon: 'keyboard', help: 'ref.current.focus()', group: 'Outlets & responders' },
  { kind: 'blur', label: 'Resign First Responder', icon: 'xmark-circle', help: 'Blur whatever has focus', group: 'Outlets & responders' },
  { kind: 'send', label: 'Send to First Responder', icon: 'bolt', help: 'A command up the responder chain', group: 'Outlets & responders' },
  { kind: 'call', label: 'Call Delegate', icon: 'phone-fill', help: 'Call a callback prop', group: 'Delegates & feedback' },
  { kind: 'toast', label: 'Show Toast', icon: 'bubble', help: 'A HUD message', group: 'Delegates & feedback' },
];

const info = (k: ActionKind) => ACTION_KINDS.find((x) => x.kind === k)!;

export interface ActionContext {
  doc: Doc;
  scene: Scene;
  /** Names the expressions may read (the scene's, plus `event`, a callback's parameters, a row's item…). */
  names: Set<string>;
  scope?: Scope;
}

/** An action in words. */
export function summary(a: Action, c: ActionContext): string {
  switch (a.do) {
    case 'segue': {
      const g = c.doc.segues.find((x) => x.id === a.segue);
      const to = g && c.doc.scenes.find((s) => s.id === g.to);
      return g ? `${SEGUE_KINDS.find((k) => k.id === g.kind)?.label} → ${to?.name ?? '?'}` : 'Perform segue (none)';
    }
    case 'back': return 'Dismiss / Back';
    case 'unwind': return `Unwind to ${c.doc.scenes.find((s) => s.id === a.scene)?.name ?? '?'}`;
    case 'set': return `${a.target || '?'} = ${a.value || '…'}`;
    case 'animate': return `Animate @${a.ref || '?'} → ${a.variant || '?'}`;
    case 'focus': return `Focus @${a.ref || '?'}`;
    case 'blur': return 'Resign first responder';
    case 'send': return `Send “${a.command || '?'}” ↑ responder chain`;
    case 'call': return `Call ${a.prop || '?'}(${a.args.join(', ')})`;
    case 'toast': return `Toast ${a.message}`;
  }
}

/** The line of React an action becomes. */
export function actionCode(a: Action, c: ActionContext): string {
  const body = (() => {
    switch (a.do) {
      case 'segue': {
        const g = c.doc.segues.find((x) => x.id === a.segue);
        const args = g ? Object.entries(g.args).map(([k, v]) => (k === v ? k : `${k}: ${v}`)) : [];
        return `perform('${g?.identifier ?? '?'}'${args.length ? `, { ${args.join(', ')} }` : ''})`;
      }
      case 'back': return 'dismiss()';
      case 'unwind': return `unwind('${c.doc.scenes.find((s) => s.id === a.scene)?.name ?? '?'}')`;
      case 'set': {
        const [root, field] = a.target.split('.');
        if (field) return `${root}.set({ ${field}: ${a.value} })`;
        return `set${root.charAt(0).toUpperCase()}${root.slice(1)}(${a.value})`;
      }
      case 'animate': return `animate(${a.ref}.current, variants.${a.variant})`;
      case 'focus': return `${a.ref}.current?.focus()`;
      case 'blur': return '(document.activeElement as HTMLElement)?.blur()';
      case 'send': return `sendAction('${a.command}')`;
      case 'call': return `${a.prop}?.(${a.args.join(', ')})`;
      case 'toast': return `toast(${a.message})`;
    }
  })();
  return a.if ? `if (${a.if}) ${body}` : body;
}

function blank(kind: ActionKind, c: ActionContext): ActionInit {
  switch (kind) {
    case 'segue': return { do: 'segue', segue: c.doc.segues.find((g) => g.from === c.scene.id)?.id ?? '' };
    case 'back': return { do: 'back' };
    case 'unwind': return { do: 'unwind', scene: c.doc.entry };
    case 'set': return { do: 'set', target: c.scene.state[0]?.name ?? '', value: c.scene.state[0]?.type === 'boolean' ? `!${c.scene.state[0].name}` : "''" };
    case 'animate': return { do: 'animate', ref: outletsOf(c.scene)[0] ?? '', variant: '' };
    case 'focus': return { do: 'focus', ref: outletsOf(c.scene)[0] ?? '' };
    case 'blur': return { do: 'blur' };
    case 'send': return { do: 'send', command: commandsIn(c.doc)[0] ?? 'submit' };
    case 'call': {
      const p = c.scene.props.find((x) => x.callback);
      return { do: 'call', prop: p?.name ?? '', args: (p?.params ?? []).map(() => 'undefined') };
    }
    case 'toast': return { do: 'toast', message: "'Done'" };
  }
}

export function AddActionMenu({ c, onAdd, label = 'Add action' }: { c: ActionContext; onAdd: (a: Action) => void; label?: string }) {
  const groups = [...new Set(ACTION_KINDS.map((k) => k.group))];
  return (
    <DropdownMenu>
      <PlainButton aria-label={label} className="flex h-7 cursor-pointer items-center gap-1 self-start rounded-md border-0 bg-transparent px-1.5 text-caption font-medium text-primary outline-none hover:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring">
        <Icon name="plus" size={12} sw={2.6} /> {label}
      </PlainButton>
      <DropdownMenuContent aria-label="Actions" placement="bottom start" onAction={(k) => onAdd(newAction(blank(k as ActionKind, c)))}>
        {groups.map((g) => (
          <DropdownMenuSection key={g} title={g}>
            {ACTION_KINDS.filter((k) => k.group === g).map((k) => (
              <DropdownMenuItem key={k.kind} id={k.kind} description={k.help} icon={<Icon name={k.icon} size={16} sw={2} />}>{k.label}</DropdownMenuItem>
            ))}
          </DropdownMenuSection>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A list of actions you can add to, edit, reorder and remove. */
export function ActionList({ actions, onChange, c, empty = 'No actions' }: { actions: Action[]; onChange: (list: Action[]) => void; c: ActionContext; empty?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const set = (id: string, a: Action) => onChange(actions.map((x) => (x.id === id ? a : x)));
  const move = (i: number, d: number) => {
    const next = [...actions];
    const [x] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, x);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1">
      {actions.length ? (
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {actions.map((a, i) => (
            <li key={a.id} className={cn('rounded-lg bg-secondary/70', open === a.id && 'bg-secondary')}>
              <div className="flex items-center gap-1 pr-1">
                <PlainButton
                  aria-expanded={open === a.id}
                  aria-label={`${summary(a, c)}. Edit`}
                  onPress={() => setOpen(open === a.id ? null : a.id)}
                  className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring"
                >
                  <Icon name={info(a.do).icon} size={14} sw={2.1} className="mt-px shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-footnote text-foreground">{summary(a, c)}</span>
                    {a.if ? <span className="truncate font-mono text-caption2 text-warning">if {a.if}</span> : null}
                    <span className="truncate font-mono text-caption2 text-muted-foreground">{actionCode(a, c)}</span>
                  </span>
                </PlainButton>
                {actions.length > 1 ? (
                  <>
                    <IconAction icon="chevron-up" label="Move up" onPress={() => move(i, -1)} />
                    <IconAction icon="chevron-down" label="Move down" onPress={() => move(i, 1)} />
                  </>
                ) : null}
                <IconAction icon="trash" label="Remove action" tone="danger" onPress={() => onChange(actions.filter((x) => x.id !== a.id))} />
              </div>
              {open === a.id ? <div className="flex flex-col gap-2 px-2 pt-0.5 pb-2.5"><ActionFields a={a} c={c} onChange={(next) => set(a.id, next)} /></div> : null}
            </li>
          ))}
        </ol>
      ) : <p className="m-0 px-1 text-caption text-muted-foreground">{empty}</p>}
      <AddActionMenu c={c} onAdd={(a) => { onChange([...actions, a]); setOpen(a.id); }} />
    </div>
  );
}

function ActionFields({ a, c, onChange }: { a: Action; c: ActionContext; onChange: (a: Action) => void }) {
  const outlets = outletsOf(c.scene);
  const pick = (opts: string[], none = '—') => (opts.length ? opts.map((o) => ({ id: o, label: o })) : [{ id: '', label: none }]);
  let fields = null;
  switch (a.do) {
    case 'segue': {
      const mine = c.doc.segues.filter((g) => g.from === c.scene.id);
      fields = (
        <Field label="Segue">
          <ChoiceInput label="Segue" value={a.segue} onChange={(v) => onChange({ ...a, segue: v })}
            options={mine.length ? mine.map((g) => ({ id: g.id, label: `${g.identifier} → ${c.doc.scenes.find((s) => s.id === g.to)?.name ?? '?'}` })) : [{ id: '', label: 'Drag a segue on the canvas first' }]} />
        </Field>
      );
      break;
    }
    case 'unwind':
      fields = <Field label="To"><ChoiceInput label="Unwind to" value={a.scene} onChange={(v) => onChange({ ...a, scene: v })} options={c.doc.scenes.map((s) => ({ id: s.id, label: s.name }))} /></Field>;
      break;
    case 'set': {
      const targets = [...c.scene.state.map((s) => s.name), ...c.doc.contexts.flatMap((x) => x.fields.map((f) => `${x.alias}.${f.name}`))];
      fields = (
        <>
          <Field label="Set"><ChoiceInput label="Target" value={a.target} onChange={(v) => onChange({ ...a, target: v })} options={pick(targets, 'Add state first')} /></Field>
          <Field label="To" wide><ExprInput label="Value" value={a.value} names={c.names} scope={c.scope} onCommit={(v) => onChange({ ...a, value: v })} /></Field>
        </>
      );
      break;
    }
    case 'animate': {
      const target = allNodes(c.scene.root).find((n) => n.ref === a.ref);
      const variants = Object.keys(target?.motion?.variants ?? {});
      fields = (
        <>
          <Field label="Outlet"><ChoiceInput label="Outlet" value={a.ref} onChange={(v) => onChange({ ...a, ref: v })} options={pick(outlets, 'Name an outlet first')} /></Field>
          <Field label="Variant"><ChoiceInput label="Variant" value={a.variant} onChange={(v) => onChange({ ...a, variant: v })} options={pick(variants, 'Add a variant in Motion')} /></Field>
        </>
      );
      break;
    }
    case 'focus':
      fields = <Field label="Outlet"><ChoiceInput label="Outlet" value={a.ref} onChange={(v) => onChange({ ...a, ref: v })} options={pick(outlets, 'Name an outlet first')} /></Field>;
      break;
    case 'send':
      fields = (
        <Field label="Command" hint={commandsIn(c.doc).length ? `Handled: ${commandsIn(c.doc).join(', ')}` : 'Add one under First Responder'}>
          <TextInput label="Command" mono value={a.command} onCommit={(v) => onChange({ ...a, command: v.trim() })} />
        </Field>
      );
      break;
    case 'call': {
      const callbacks = c.scene.props.filter((p) => p.callback);
      const prop = callbacks.find((p) => p.name === a.prop);
      fields = (
        <>
          <Field label="Delegate">
            <ChoiceInput label="Callback" value={a.prop} options={pick(callbacks.map((p) => p.name), 'Add a callback prop to the scene')}
              onChange={(v) => onChange({ ...a, prop: v, args: (callbacks.find((p) => p.name === v)?.params ?? []).map((_, i) => a.args[i] ?? 'undefined') })} />
          </Field>
          {(prop?.params ?? []).map((param, i) => (
            <Field key={param} label={param} wide>
              <ExprInput label={param} value={a.args[i] ?? ''} names={c.names} scope={c.scope} onCommit={(v) => onChange({ ...a, args: Object.assign([...a.args], { [i]: v }) })} />
            </Field>
          ))}
        </>
      );
      break;
    }
    case 'toast':
      fields = <Field label="Message" wide><ExprInput label="Message" value={a.message} names={c.names} scope={c.scope} onCommit={(v) => onChange({ ...a, message: v })} /></Field>;
      break;
    default: fields = null;
  }
  return (
    <>
      {fields}
      <Field label="Only if" wide>
        <ExprInput label="Condition" value={a.if ?? ''} names={c.names} scope={c.scope} placeholder="Always" onCommit={(v) => onChange({ ...a, if: v.trim() || undefined } as Action)} />
      </Field>
    </>
  );
}
