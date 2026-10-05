import { describe, expect, it } from 'vitest';
import { SAMPLE_DOC, SPLIT_SAMPLE } from './data';
import { shows } from './geometry';
import { DEVICES, type Doc } from './model';
import { connect, moveTo, setDevice } from './ops';
import { findNode, sceneOf } from './tree';

const overlaps = (doc: Doc) => {
  const d = DEVICES[doc.device];
  return doc.scenes.some((a, i) => doc.scenes.some((b, j) => i < j && a.x < b.x + d.w && b.x < a.x + d.w && a.y < b.y + d.h && b.y < a.y + d.h));
};

describe('setDevice', () => {
  it('lays the storyboard out for the new device, so a phone storyboard doesn’t overlap on a desktop', () => {
    expect(overlaps(SAMPLE_DOC)).toBe(false);
    const desktop = setDevice(SAMPLE_DOC, 'desktop');
    expect(desktop.device).toBe('desktop');
    expect(overlaps(desktop)).toBe(false);
    // And back again: the scenes keep their places on the grid.
    const back = setDevice(desktop, SAMPLE_DOC.device);
    back.scenes.forEach((s, i) => {
      expect(Math.abs(s.x - SAMPLE_DOC.scenes[i].x)).toBeLessThanOrEqual(2);
      expect(Math.abs(s.y - SAMPLE_DOC.scenes[i].y)).toBeLessThanOrEqual(2);
    });
  });

  it('is the same document for the same device', () => {
    expect(setDevice(SPLIT_SAMPLE, SPLIT_SAMPLE.device)).toBe(SPLIT_SAMPLE);
  });
});

describe('moveTo', () => {
  it('moves a node into a scene shown in place in another (in that scene’s tree)', () => {
    const settings = SAMPLE_DOC.scenes.find((s) => s.name === 'Settings')!;
    const next = moveTo(SAMPLE_DOC, 'water-all', { parent: settings.root.id, slot: null, index: 0 });
    expect(sceneOf(next, 'water-all')?.name).toBe('Settings');
    expect(findNode(next.scenes.find((s) => s.name === 'Garden')!.root, 'water-all')).toBeNull();
  });

  it('won’t move a node into itself', () => {
    expect(moveTo(SAMPLE_DOC, 'today-card', { parent: 'today-card', slot: null, index: 0 })).toBe(SAMPLE_DOC);
  });
});

describe('connect', () => {
  it('adds a segue and has the source node’s event perform it', () => {
    const [next, segue] = connect(SAMPLE_DOC, 'garden', 'schedule', 'water-all', 'onPress');
    expect(next.segues.at(-1)).toBe(segue);
    const node = findNode(next.scenes.find((s) => s.id === 'garden')!.root, 'water-all')!;
    expect(node.on?.onPress?.some((a) => a.do === 'segue' && a.segue === segue.id)).toBe(true);
  });
});

describe('shows', () => {
  it('follows embedded scenes through their containers', () => {
    expect(shows(SAMPLE_DOC, 'main', 'garden')).toBe(true);
    expect(shows(SAMPLE_DOC, 'garden', 'main')).toBe(false);
    expect(shows(SAMPLE_DOC, 'garden', 'garden')).toBe(true);
  });
});
