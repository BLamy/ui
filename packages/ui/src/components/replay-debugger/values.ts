import type { ObjectTreeNode } from '@/lib/object-tree-model';
import type { ValuePreview } from '@/lib/object-tree-value';
import type {
  ObjectData,
  ObjectPreview,
  PropertyData,
  ProtocolValue,
  ScopeData,
  FrameData,
} from './host';

/* ══ Protocol values, as the library's tree shows them ══ */

export type Objects = ReadonlyMap<string, ObjectData>;

/** What a row can open with: an object, and whoever can get more of it, at the moment it's from. */
export interface ValueHandle {
  object: string;
  objects: Objects;
  fetch?: (object: string) => Promise<ObjectData | undefined>;
}

export type ValueNode = ObjectTreeNode<ValueHandle>;

const isIndex = (name: string) => /^\d+$/.test(name);
/** A property's flags say otherwise only when they aren't the usual ones. Bit 4 is enumerable. */
const hidden = (flags: number | undefined) =>
  flags !== undefined && !(flags & 4);

function primitive(value: unknown): ValuePreview {
  if (value === null) return { type: 'null' };
  switch (typeof value) {
    case 'string':
      return { type: 'string', value };
    case 'number':
      return { type: 'number', value };
    case 'boolean':
      return { type: 'boolean', value };
    default:
      return { type: 'string', value: JSON.stringify(value) ?? '' };
  }
}

function objectPreview(
  obj: ObjectData | undefined,
  objects: Objects,
  depth: number,
): ValuePreview {
  if (!obj) return { type: 'object', className: 'Object' };
  const { preview } = obj;
  const className = obj.className || 'Object';
  if (className === 'Function' || preview?.functionName !== undefined) {
    return {
      type: 'function',
      name: preview?.functionName || '',
      params: preview?.functionParameterNames?.join(', '),
    };
  }
  // Inside another's preview, an object is just its name.
  const shallow = !preview || depth > 0;
  const properties = preview?.properties ?? [];
  const length = properties.find((p) => p.name === 'length')?.value;
  if (className === 'Array' || /Array$/.test(className)) {
    const items = properties.filter((p) => isIndex(p.name));
    return {
      type: 'array',
      className: className === 'Array' ? undefined : className,
      length:
        typeof length === 'number'
          ? length
          : shallow
            ? undefined
            : items.length,
      items: shallow
        ? undefined
        : items.slice(0, 10).map((p) => previewOf(p, objects, depth + 1)),
      overflow: !shallow && (Boolean(preview?.overflow) || items.length > 10),
    };
  }
  if (/Error$/.test(className)) {
    const say = (name: string) => {
      const value = properties.find((p) => p.name === name)?.value;
      return typeof value === 'string' ? value : undefined;
    };
    return {
      type: 'error',
      name: className,
      message: say('message'),
      stack: say('stack'),
    };
  }
  if (preview?.regexpString)
    return { type: 'regexp', value: preview.regexpString };
  if (preview?.dateTime !== undefined)
    return { type: 'date', value: new Date(preview.dateTime).toISOString() };
  const entries = preview?.containerEntries;
  if (/Map$/.test(className)) {
    return {
      type: 'map',
      className: className === 'Map' ? undefined : className,
      size: preview?.containerEntryCount,
      entries: shallow
        ? undefined
        : (entries ?? [])
            .slice(0, 5)
            .map((e) => ({
              key: previewOf(e.key ?? {}, objects, depth + 1),
              value: previewOf(e.value, objects, depth + 1),
            })),
      overflow:
        !shallow && (Boolean(preview?.overflow) || (entries?.length ?? 0) > 5),
    };
  }
  if (/Set$/.test(className)) {
    return {
      type: 'set',
      className: className === 'Set' ? undefined : className,
      size: preview?.containerEntryCount,
      items: shallow
        ? undefined
        : (entries ?? [])
            .slice(0, 5)
            .map((e) => previewOf(e.value, objects, depth + 1)),
      overflow:
        !shallow && (Boolean(preview?.overflow) || (entries?.length ?? 0) > 5),
    };
  }
  const shown = properties.filter((p) => !hidden(p.flags));
  return {
    type: 'object',
    className: className === 'Object' ? undefined : className,
    properties: shallow
      ? undefined
      : shown
          .slice(0, 5)
          .map((p) => ({
            name: p.name,
            value: previewOf(p, objects, depth + 1),
          })),
    overflow: !shallow && (Boolean(preview?.overflow) || shown.length > 5),
  };
}

export function previewOf(
  v: ProtocolValue | null | undefined,
  objects: Objects,
  depth = 0,
): ValuePreview {
  if (!v || typeof v !== 'object') return { type: 'undefined' };
  if ('value' in v) return primitive(v.value);
  if (v.unserializableNumber)
    return { type: 'number', value: v.unserializableNumber };
  if (v.bigint) return { type: 'bigint', value: v.bigint };
  if (v.symbol) return { type: 'symbol', value: v.symbol };
  if (v.uninitialized) return { type: 'unavailable', label: '<uninitialized>' };
  if (v.unavailable) return { type: 'unavailable', label: '<unavailable>' };
  if (v.object) return objectPreview(objects.get(v.object), objects, depth);
  if (v.get || v.set)
    return {
      type: 'unavailable',
      label: `(${[v.get && 'get', v.set && 'set'].filter(Boolean).join('/')})`,
    };
  return { type: 'undefined' };
}

/** A value as a row of the tree. It opens if it's an object there's more of. */
export function nodeOf(
  id: string,
  name: string,
  v: ProtocolValue,
  context: Pick<ValueHandle, 'objects' | 'fetch'>,
  dim?: boolean,
): ValueNode {
  const object = v?.object;
  const known = object ? context.objects.get(object) : undefined;
  return {
    id,
    name,
    value: previewOf(v, context.objects),
    dim,
    hasChildren: Boolean(object && (context.fetch || known?.preview)),
    data: object ? { object, ...context } : undefined,
  };
}

/** What's inside an object, from its whole preview. */
export function childrenOf(
  preview: ObjectPreview | undefined,
  handle: ValueHandle,
): ValueNode[] {
  const context = { objects: handle.objects, fetch: handle.fetch };
  const rows: ValueNode[] = [];
  for (const p of (preview?.properties ?? []) as PropertyData[])
    rows.push(nodeOf(`p:${p.name}`, p.name, p, context, hidden(p.flags)));
  for (const g of preview?.getterValues ?? [])
    rows.push(nodeOf(`g:${g.name}`, `${g.name} (get)`, g, context));
  (preview?.containerEntries ?? []).forEach((c, i) => {
    if (!c.key) {
      rows.push(nodeOf(`e:${i}`, String(i), c.value, context));
      return;
    }
    const inner = nodeOf(`e:${i}`, String(i), c.value, context);
    rows.push({
      ...inner,
      value: {
        type: 'entry',
        key: previewOf(c.key, handle.objects),
        value: inner.value!,
      },
    });
  });
  const place = preview?.functionLocation?.[0];
  if (place)
    rows.push({
      id: 'defined-at',
      name: 'defined at',
      value: {
        type: 'string',
        value: `${place.sourceId}:${place.line}:${place.column ?? 0}`,
      },
    });
  return rows;
}

/** A row opening: what's known if that's all of it, and otherwise what the paused process can say. */
export async function loadChildren(node: ValueNode): Promise<ValueNode[]> {
  const handle = node.data;
  if (!handle) return [];
  let full = handle.objects.get(handle.object);
  if (
    handle.fetch &&
    (!full?.preview || full.preview.overflow || !full.preview.properties)
  )
    full = await handle.fetch(handle.object);
  return childrenOf(full?.preview, handle);
}

/** What a frame shows: `this`, then a section for each of its scopes. */
export function scopeRoot(
  frame: FrameData,
  scopes: ReadonlyMap<string, ScopeData>,
  context: Pick<ValueHandle, 'objects' | 'fetch'>,
): ValueNode[] {
  const out: ValueNode[] = [];
  if (frame.this) out.push(nodeOf('this', 'this', frame.this, context));
  const seen = new Map<string, number>();
  for (const id of frame.scopeChain ?? []) {
    const scope = scopes.get(id);
    if (!scope) continue;
    const title =
      scope.type === 'function'
        ? `${scope.functionName || 'function'} (local)`
        : scope.type;
    const times = seen.get(title) ?? 0;
    seen.set(title, times + 1);
    const children = scope.bindings
      ? scope.bindings.map((b) => nodeOf(`b:${b.name}`, b.name, b, context))
      : scope.object
        ? [nodeOf('object', scope.type, { object: scope.object }, context)]
        : [];
    // The same id from one step to the next keeps what's open in it open.
    out.push({
      id: `s:${title}:${times}`,
      name: title,
      section: true,
      children,
      hasChildren: children.length > 0,
    });
  }
  return out;
}
