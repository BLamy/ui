/* What a system exports as: its own JSON, a wrangler.jsonc for each Worker, and a module for each machine. It's text, and
   nothing here deploys anything or needs an account. */
import type { CloudflareService } from '@/lib/cloudflare-services';
import { parseSystem, serviceName, systemToJson, type CloudflareSystem } from '@/lib/cloudflare-system';
import { writeWrangler } from '@/lib/cloudflare-wrangler';

export interface StudioFile {
  /** Where it goes, with `/` between folders. */
  path: string;
  text: string;
  /** What it still needs that a system doesn't say, like a bucket's name, in words. */
  needs: string[];
}

/** The compatibility date a new Worker's config starts with. */
export const COMPATIBILITY_DATE = '2026-11-01';

/** A name as a file or folder name: lowercase words with dashes. */
export const slugOf = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'service';

/** Who sends each event a service's machine receives, by the system's connections. A Worker that's a queue's consumer is
 *  `queue consumer`, which is what scripts/statechart-check.js in replay-recording-inspector looks for. */
export function sentBy(system: CloudflareSystem, service: CloudflareService): Record<string, string> {
  const byId = new Map(system.services.map((s) => [s.id, s]));
  const consumes = (id: string) => system.edges.some((e) => e.to === id && e.via === 'queue-consumer');
  const out: Record<string, string> = {};
  for (const e of system.edges) {
    if (e.to !== service.id || !e.events?.length) continue;
    const from = byId.get(e.from);
    if (!from) continue;
    for (const event of e.events) out[event] = consumes(from.id) ? 'queue consumer' : serviceName(from);
  }
  return out;
}

/** A service's machine as a module: its config, the machine made from it, and who sends what. */
export function machineModule(system: CloudflareSystem, service: CloudflareService): string {
  return [
    `// ${serviceName(service)}'s machine, from Cloudflare Studio. What it does is named, not written: give each guard, action,`,
    '// actor and delay it names with .provide().',
    "import { createMachine } from 'xstate';",
    '',
    `export const config = ${JSON.stringify(service.machine, null, 2)};`,
    '',
    'export const machine = createMachine(config);',
    '',
    '// Who sends each event, by the connections in system.json.',
    `export const sentBy = ${JSON.stringify(sentBy(system, service), null, 2)};`,
    '',
  ].join('\n');
}

/** A Worker's config before its bindings go in. */
const workerConfig = (service: CloudflareService, name: string): string =>
  `// ${serviceName(service)}, from Cloudflare Studio.\n{\n  "name": ${JSON.stringify(name)},\n  "main": "src/index.ts",\n  "compatibility_date": "${COMPATIBILITY_DATE}"\n}\n`;

/** Every file a system exports as, in order: system.json, each Worker's folder, then machines/. */
export function studioFiles(system: CloudflareSystem): StudioFile[] {
  const files: StudioFile[] = [{ path: 'system.json', text: systemToJson(system), needs: [] }];
  const taken = new Set<string>(['machines']);
  const unique = (name: string) => {
    let out = name;
    for (let n = 2; taken.has(out); n++) out = `${name}-${n}`;
    taken.add(out);
    return out;
  };
  for (const service of system.services) {
    if (service.kind !== 'workers') continue;
    const folder = unique(slugOf(serviceName(service)));
    const base = workerConfig(service, folder);
    const written = writeWrangler(base, system, { worker: service.id });
    files.push(written.ok
      ? { path: `${folder}/wrangler.jsonc`, text: written.text, needs: [...written.needs.map((n) => n.message), ...written.skipped.map((s) => s.reason)] }
      : { path: `${folder}/wrangler.jsonc`, text: base, needs: [written.reason] });
  }
  const modules = new Set<string>();
  for (const service of system.services) {
    if (!service.machine) continue;
    let name = slugOf(service.id);
    for (let n = 2; modules.has(name); n++) name = `${slugOf(service.id)}-${n}`;
    modules.add(name);
    files.push({ path: `machines/${name}.js`, text: machineModule(system, service), needs: [] });
  }
  return files;
}

/* ── Kept in the browser ── */

export interface SavedStudio {
  name: string;
  system: CloudflareSystem;
}

/** What's saved, read back. Something that isn't a system, or isn't there, is nothing. */
export function readSaved(text: string | null): SavedStudio | null {
  if (!text) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return null;
  }
  if (!saved || typeof saved !== 'object') return null;
  const { name, system } = saved as { name?: unknown; system?: unknown };
  if (typeof system !== 'string') return null;
  const read = parseSystem(system);
  if (read.issues.some((i) => i.code === 'json' || i.code === 'shape')) return null;
  return { name: typeof name === 'string' && name.trim() ? name : 'Untitled system', system: read.system };
}

export const writeSaved = (saved: SavedStudio): string => JSON.stringify({ name: saved.name, system: systemToJson(saved.system) });
