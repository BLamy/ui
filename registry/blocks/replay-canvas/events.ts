/* Recordings as rrweb's player can show them. An image the recorder inlined (`rr_dataURL`) becomes its `src`: seeking
   past a second full snapshot (a page that reloaded), rrweb 2.0.0-alpha builds into a virtual DOM whose images have no
   `currentSrc`, throws on that attribute and drops the whole batch of nodes it came in — usually the rest of the page,
   so the frame comes out blank. */
import type { ReplayEvent } from '@/components/ui/replay-preview';

const FULL_SNAPSHOT = 2, INCREMENTAL = 3;

/** An inlined image's data URL as its src, in a serialized node tree (a snapshot or a mutation's added nodes). */
function inlineImages(value: unknown): unknown {
  if (Array.isArray(value)) {
    const out = value.map(inlineImages);
    return out.some((v, i) => v !== value[i]) ? out : value;
  }
  if (!value || typeof value !== 'object') return value;
  const o = value as Record<string, unknown>;
  const attrs = o.attributes as Record<string, unknown> | undefined;
  if (o.tagName === 'img' && typeof attrs?.rr_dataURL === 'string') {
    const { rr_dataURL, ...rest } = attrs;
    return { ...o, attributes: { ...rest, src: rr_dataURL } };
  }
  let out: Record<string, unknown> | null = null;
  for (const k of ['node', 'childNodes', 'adds']) {
    if (!(k in o)) continue;
    const next = inlineImages(o[k]);
    if (next !== o[k]) (out ??= { ...o })[k] = next;
  }
  return out ?? o;
}

/** The events as rrweb's player can show them; the same array when nothing needed changing. */
export function playableEvents(events: ReplayEvent[]): ReplayEvent[] {
  let changed = false;
  const out = events.map((e) => {
    const ev = e as ReplayEvent & { data?: unknown };
    if (ev.type !== FULL_SNAPSHOT && ev.type !== INCREMENTAL) return ev;
    const data = inlineImages(ev.data);
    if (data === ev.data) return ev;
    changed = true;
    return { ...ev, data } as ReplayEvent;
  });
  return changed ? out : events;
}
