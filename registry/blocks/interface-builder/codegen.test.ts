import { describe, expect, it } from 'vitest';
import { generate } from './codegen';
import { SAMPLE_DOC, SPLIT_SAMPLE } from './data';
import type { Doc } from './model';
import { mapDocNode } from './tree';

const file = (doc: Doc, path: string) => generate(doc).find((f) => f.path === path)?.code ?? '';

describe('generate', () => {
  it('writes the app, a file per scene, the contexts and the runtime', () => {
    const paths = generate(SAMPLE_DOC).map((f) => f.path);
    expect(paths[0]).toBe('App.tsx');
    expect(paths).toContain('scenes/Garden.tsx');
    expect(paths).toContain('contexts.tsx');
    expect(paths).toContain('storyboard.tsx');
  });

  it('writes the kit’s containers: a TabView of scenes, a NavigationStack around one, a Screen’s bar', () => {
    const tabs = file(SAMPLE_DOC, 'scenes/MainTabs.tsx');
    expect(tabs).toContain("from '@/components/ui/tab-view'");
    expect(tabs).toContain('<TabViewTab id="Garden"');
    expect(tabs).toContain('<GardenNav />');
    expect(tabs).toContain("tabWidth1 >= 700 ? 'start' : 'bottom'");
    expect(file(SAMPLE_DOC, 'scenes/GardenNav.tsx')).toContain('<NavStack root={<Garden />} />');
    const garden = file(SAMPLE_DOC, 'scenes/Garden.tsx');
    expect(garden).toContain('useScreen({');
    expect(garden).toContain('title: "My Garden"');
  });

  it('writes a SplitView’s columns', () => {
    const mail = file(SPLIT_SAMPLE, 'scenes/Mail.tsx');
    expect(mail).toContain('<SplitHost');
    expect(mail).toMatch(/sidebar=\{\s*<MailboxesNav \/>/);
  });

  it('writes a list prop as the kit’s items, and a date as a DateValue', () => {
    const schedule = file(SAMPLE_DOC, 'scenes/Schedule.tsx');
    expect(schedule).toMatch(/options=\{\[\{ id: '/);
    expect(schedule).toContain('parseDate(');
  });

  it('loads a Text’s Google Font, and sets the app’s fonts', () => {
    let doc = mapDocNode(SAMPLE_DOC, 'today-title', (n) => ({ ...n, props: { ...n.props, font: 'Fraunces', size: 24 } }));
    doc = { ...doc, fonts: { sans: ['Inter'], mono: ['JetBrains Mono'] } };
    const garden = file(doc, 'scenes/Garden.tsx');
    expect(garden).toContain('useGoogleFont("Fraunces")');
    expect(garden).toContain('fontFamily: fontStack("Fraunces")');
    expect(garden).toContain('fontSize: 24');
    const app = file(doc, 'App.tsx');
    expect(app).toContain('useGoogleFont(["Inter","JetBrains Mono"])');
    expect(app).toContain('font-family: \\"Inter\\"');
  });
});
