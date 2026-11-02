import { describe, expect, it } from 'vitest';
import { analyzeRecordings, routeOf, type AppMap } from './analyze';
import { SAMPLE_RECORDINGS } from './recordings';

const [browse, create, settings, share] = SAMPLE_RECORDINGS;
const page = (map: AppMap, label: string) => map.pages.find((p) => p.label === label || p.titles.includes(label));
const layer = (map: AppMap, label: string) => map.overlays.find((o) => o.label === label);
const segue = (map: AppMap, label: string) => map.segues.filter((s) => s.label === label || s.label.split(', ').includes(label));

describe('routeOf', () => {
  it('turns ids into :id and reads hash routes', () => {
    expect(routeOf('https://app.test/projects/42')).toBe('/projects/:id');
    expect(routeOf('https://app.test/u/3f9a2c1be0/files/')).toBe('/u/:id/files');
    expect(routeOf('https://app.test/#/inbox/7?x=1')).toBe('/inbox/:id');
    expect(routeOf('/settings', 'https://app.test/projects')).toBe('/settings');
  });
});

describe('analyzeRecordings', () => {
  const map = analyzeRecordings(SAMPLE_RECORDINGS);

  it('finds the pages, merging every project’s page into one route', () => {
    expect(map.pages.map((p) => p.label)).toEqual(['Projects · Tandem', '/projects/:id', 'Settings · Tandem']);
    const project = page(map, '/projects/:id')!;
    // Orbit was reached by a button with no href: its page matched the others by structure.
    expect(project.titles.sort()).toEqual(['Atlas · Tandem', 'Compass · Tandem', 'Orbit · Tandem']);
    expect(map.entry).toEqual({ node: page(map, 'Projects · Tandem')!.id, state: 'base' });
  });

  it('finds layers of every kind, over the page that opened them', () => {
    const kinds = Object.fromEntries(map.overlays.map((o) => [o.label, o.type]));
    expect(kinds).toMatchObject({
      'Open, Rename, Duplicate…': 'menu',
      'New task': 'sheet',
      'New project': 'dialog',
      'Brett Lamy, Settings, Sign out': 'menu',
      'Delete workspace?': 'dialog',
      'Share Compass': 'popover',
      'Created Orbit': 'toast',
    });
    expect(layer(map, 'New project')!.hosts).toEqual([page(map, 'Projects · Tandem')!.id]);
    // The sheet is in the page all along and opens by a class: it's still a layer.
    expect(layer(map, 'New task')!.states[0].evidence[0].path).toBeDefined();
  });

  it('keeps a layer’s states, named by what they show', () => {
    expect(layer(map, 'New project')!.states.map((s) => s.label)).toEqual(['Open', 'Give the project a name.']);
    expect(layer(map, 'Share Compass')!.states.map((s) => s.label)).toEqual(['Open', 'Invited jun@studio.test.', 'Link copied']);
  });

  it('draws segues from what was clicked to what it did', () => {
    const [menu] = segue(map, 'Atlas');
    expect(menu).toMatchObject({ kind: 'present', action: 'contextmenu', to: { node: layer(map, 'Open, Rename, Duplicate…')!.id } });
    const create = segue(map, 'Create project');
    expect(create.map((s) => s.kind).sort()).toEqual(['navigate', 'present', 'update']);
    expect(segue(map, 'Save task')[0]).toMatchObject({ kind: 'update', to: { node: page(map, '/projects/:id')!.id } });
    expect(segue(map, 'Cancel').every((s) => s.kind === 'dismiss')).toBe(true);
  });

  it('merges what recordings agree on and counts it', () => {
    // Two recordings right-click different rows: one segue, both rows, both recordings.
    const rows = segue(map, 'Atlas');
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Atlas, Beacon');
    expect(new Set(rows[0].evidence.map((e) => e.recording))).toEqual(new Set([browse.id, share.id]));
    expect(segue(map, 'Add task')[0].evidence.map((e) => e.recording)).toEqual([browse.id, create.id]);
  });

  it('grows as recordings are added', () => {
    const one = analyzeRecordings([browse]);
    const two = analyzeRecordings([browse, create]);
    expect(one.pages.length).toBe(2);
    expect(two.pages.length).toBe(2);
    expect(two.overlays.length).toBeGreaterThan(one.overlays.length);
    expect(map.overlays.length).toBeGreaterThan(two.overlays.length);
    expect(analyzeRecordings([settings]).pages.map((p) => p.label)).toEqual(['Projects · Tandem', 'Settings · Tandem']);
  });

  it('keeps the moments each frame can be drawn from', () => {
    for (const n of [...map.pages, ...map.overlays]) {
      for (const s of n.states) {
        expect(s.evidence.length).toBeGreaterThan(0);
        for (const e of s.evidence) expect(e.time).toBeGreaterThan(0);
      }
    }
  });

  it('draws the header every page shares once, and clicks in it leave from it', () => {
    const map = analyzeRecordings(SAMPLE_RECORDINGS);
    expect(map.chrome.map((c) => [c.type, c.pages.length])).toEqual([['header', 3]]);
    const header = map.chrome[0];
    // The page frames show their content without it.
    for (const p of map.pages) expect(p.states[0].evidence[0].scope).toBe('content');
    const toProjects = map.segues.find((s) => s.label === 'Projects' && s.to.node === page(map, 'Projects · Tandem')!.id && s.from.node === header.id);
    expect(toProjects?.kind).toBe('navigate');
  });

  it('draws an update that changes one part of the page as that part', () => {
    const map = analyzeRecordings(SAMPLE_RECORDINGS);
    const settings = page(map, 'Settings · Tandem')!;
    const toggled = settings.states.find((s) => s.label === 'After “Email digests”')!;
    expect(toggled.evidence[0].scope).toBe('part');
    // A press outside that part afterwards leaves from the page, not the part.
    const del = map.segues.find((s) => s.label === 'Delete workspace')!;
    expect(del.from).toEqual({ node: settings.id, state: 'base' });
  });
});