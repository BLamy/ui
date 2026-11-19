/* The library pages' showcase, held to the code: a block a library page runs really imports the library, and the
   libraries whose parts every block uses still lead with the blocks their `showcase` pins. */
import { describe, expect, it } from 'vitest';
import { LIBRARIES } from './libraries';
import { libraryShowcase } from './showcase-graph';

const show = libraryShowcase();

describe('the library showcase', () => {
  it('has an entry for every library', () => {
    expect(Object.keys(show).sort()).toEqual(LIBRARIES.map((l) => l.id).sort());
  });

  it('finds the blocks by what they import', () => {
    expect(show.video!.blocks.map((b) => b.slug)).toContain('video-editor');
    expect(show.diagram!.blocks[0]!.slug).toBe('cloudflare-studio');
    expect(show.tailscale!.blocks.map((b) => b.slug)).toEqual(expect.arrayContaining(['safari', 'apple-passwords']));
    expect(show.vault!.blocks.map((b) => b.slug)).toContain('apple-passwords');
  });

  it('marks the blocks that start a runtime as heavy', () => {
    expect(show.opencode!.blocks.every((b) => b.heavy)).toBe(true);
    expect(show.diagram!.blocks.find((b) => b.slug === 'cloudflare-studio')?.heavy).toBe(false);
  });

  it('gives each docs page of a part to one library, with its first demo', () => {
    const pages = Object.values(show).flatMap((s) => s.pages.map((p) => p.id));
    expect(new Set(pages).size).toBe(pages.length);
    expect(show.audio!.pages.map((p) => p.id)).toEqual(expect.arrayContaining(['waveform', 'strudel-player']));
    expect(show.time!.pages.find((p) => p.id === 'calendar')?.demo).toMatch(/^calendar\//);
    expect(show.ui!.pages.map((p) => p.id)).not.toContain('theming');
  });

  it('puts pinned blocks and pages first', () => {
    for (const lib of LIBRARIES) {
      const blocks = lib.showcase?.blocks ?? [];
      expect(show[lib.id]!.blocks.slice(0, blocks.length).map((b) => b.slug), lib.id).toEqual(blocks);
      const pages = lib.showcase?.pages ?? [];
      expect(show[lib.id]!.pages.slice(0, pages.length).map((p) => p.id), lib.id).toEqual(pages);
    }
  });
});
