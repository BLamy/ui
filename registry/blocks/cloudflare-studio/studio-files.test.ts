import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSystem } from '@/lib/cloudflare-system';
import { readWrangler } from '@/lib/cloudflare-wrangler';
import { placeInLayers } from '@/lib/cloudflare-board';
import { STUDIO_EXAMPLE } from '../../../packages/ui/src/stories/cloudflare-systems';
import { EXAMPLE } from './example';
import { readSaved, sentBy, slugOf, studioFiles, writeSaved } from './studio-files';

const file = (path: string) => studioFiles(EXAMPLE.system).find((f) => f.path === path)!;

describe('what a system exports as', () => {
  it('is its JSON, a config for each Worker and a module for each machine', () => {
    expect(studioFiles(EXAMPLE.system).map((f) => f.path)).toEqual(['system.json', 'api/wrangler.jsonc', 'consumer/wrangler.jsonc', 'machines/room.js']);
    expect(studioFiles({ services: [], edges: [] }).map((f) => f.path)).toEqual(['system.json']);
  });

  it('has a system.json that reads back as the same system', () => {
    const read = parseSystem(file('system.json').text);
    expect(read.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(read.system).toEqual(EXAMPLE.system);
  });

  it('writes each Worker’s bindings, which read back as the same connections, and says what they still need', () => {
    const api = readWrangler(file('api/wrangler.jsonc').text);
    expect(api.ok).toBe(true);
    if (!api.ok) return;
    expect(api.system.edges.map((e) => `${e.via}:${e.binding}`).sort()).toEqual(['queues:JOBS', 'r2_buckets:FILES']);
    expect(file('api/wrangler.jsonc').text).toContain('"name": "api"');
    // A bucket's and a database's names are their services', so those are said. A class's migration isn't.
    expect(file('api/wrangler.jsonc').text).toContain('"bucket_name": "Files"');
    expect(file('consumer/wrangler.jsonc').text).toContain('"database_name": "Uploads"');
    expect(file('api/wrangler.jsonc').needs).toEqual([]);
    expect(file('consumer/wrangler.jsonc').needs).toEqual([expect.stringMatching(/ROOM.*migration/)]);
    const consumer = readWrangler(file('consumer/wrangler.jsonc').text);
    expect(consumer.ok).toBe(true);
    if (!consumer.ok) return;
    expect(consumer.system.edges.map((e) => `${e.via}:${e.binding ?? ''}`).sort()).toEqual(['d1_databases:DB', 'durable_objects:ROOM', 'queue-consumer:']);
  });

  it('makes a machine module that runs, with who sends what', async () => {
    expect(sentBy(EXAMPLE.system, EXAMPLE.system.services.find((s) => s.id === 'room')!)).toEqual({ FILE_READY: 'queue consumer' });
    const dir = mkdtempSync(join(tmpdir(), 'cloudflare-studio-'));
    try {
      const at = join(dir, 'room.mjs');
      // xstate is the library's optional peer, so it's where the library is.
      const xstate = pathToFileURL(createRequire(new URL('../../../packages/ui/package.json', import.meta.url)).resolve('xstate')).href;
      writeFileSync(at, file('machines/room.js').text.replace("from 'xstate'", `from ${JSON.stringify(xstate)}`));
      const module = await import(pathToFileURL(at).href);
      expect(module.config).toEqual(EXAMPLE.system.services.find((s) => s.id === 'room')!.machine);
      expect(module.machine.id).toBe('room');
      expect(module.sentBy).toEqual({ FILE_READY: 'queue consumer' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('gives two Workers with one name a folder each', () => {
    const twice = { services: [{ id: 'a', kind: 'workers', label: 'API' }, { id: 'b', kind: 'workers', label: 'api' }], edges: [] };
    expect(studioFiles(twice).map((f) => f.path)).toEqual(['system.json', 'api/wrangler.jsonc', 'api-2/wrangler.jsonc']);
    expect(slugOf('My API, v2!')).toBe('my-api-v2');
    expect(slugOf('!!!')).toBe('service');
  });
});

describe('what’s kept in the browser', () => {
  it('reads back what it wrote', () => {
    expect(readSaved(writeSaved(EXAMPLE))).toEqual(EXAMPLE);
  });

  it('is nothing when it isn’t a system, and a blank name is a name', () => {
    expect(readSaved(null)).toBeNull();
    expect(readSaved('not json')).toBeNull();
    expect(readSaved('[]')).toBeNull();
    expect(readSaved(JSON.stringify({ name: 'x', system: '{"services": 3}' }))).toBeNull();
    expect(readSaved(JSON.stringify({ name: '  ', system: '{"services":[],"edges":[]}' }))?.name).toBe('Untitled system');
  });
});

describe('the example', () => {
  // The diagram family's layout invariants check the studio's board from a copy of this example: they stay the same.
  it('is the one the diagram family’s layout invariants check', () => {
    expect(EXAMPLE.system).toEqual(placeInLayers(STUDIO_EXAMPLE, { editable: true }));
  });
});
