import { describe, expect, it } from 'vitest';
import { makeNode } from './catalog';
import { generate } from './codegen';
import { SAMPLE_DOC, SPLIT_SAMPLE } from './data';
import type { Doc } from './model';
import { insertNode, mapDocNode, mapScene } from './tree';

const file = (doc: Doc, path: string) => generate(doc).find((f) => f.path === path)?.code ?? '';

describe('generate', () => {
  it('writes the app, a file per scene, the contexts and the runtime', () => {
    const paths = generate(SAMPLE_DOC).map((f) => f.path);
    expect(paths[0]).toBe('App.tsx');
    expect(paths).toContain('scenes/Garden.tsx');
    expect(paths).toContain('contexts.tsx');
    expect(paths).toContain('storyboard.tsx');
  });

  it('writes the kit’s containers: a TabsScreen of scenes, a NavigationStack around one, a Screen’s bar', () => {
    const tabs = file(SAMPLE_DOC, 'scenes/MainTabs.tsx');
    expect(tabs).toContain("from '@/components/ui/tabs'");
    expect(tabs).toContain('<TabsTab value="Garden"');
    expect(tabs).toContain('<TabsPanel value="Garden" keepMounted');
    expect(tabs).toContain('value={tab} onValueChange={');
    expect(tabs).toContain('<GardenNav />');
    expect(tabs).toContain('<Tabs presentation="auto"');
    expect(tabs).not.toContain('useSizeClass');
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

  it('writes a list prop as the kit’s items, and a date as an ISO string', () => {
    const schedule = file(SAMPLE_DOC, 'scenes/Schedule.tsx');
    expect(schedule).toContain("<SegmentedItem key='Week' value={'Week'}>");
    expect(schedule).toContain('onValueChange={(v) => setRange(v)}');
    expect(schedule).toContain('<Calendar aria-label={\'Watering day\'} value={day} onValueChange={(v) => setDay(v)} />');
    const add = file(SAMPLE_DOC, 'scenes/AddPlant.tsx');
    expect(add).toContain("items={[{ value: '3 days', label: '3 days' }");
    expect(add).toContain('<FieldLabel>Water every</FieldLabel>');
  });

  it('writes 6.0’s API: onClick, Field and its parts, and nothing from react-aria', () => {
    const signIn = file(SAMPLE_DOC, 'scenes/SignIn.tsx');
    expect(signIn).toContain('onClick={');
    expect(signIn).toContain("from '@/components/ui/field'");
    expect(signIn).toMatch(/<Field invalid=\{attempted && !email\.includes\('@'\) \|\| undefined\}>/);
    expect(signIn).toContain('<Input type="email" value={email} onValueChange={');
    for (const f of [...generate(SAMPLE_DOC), ...generate(SPLIT_SAMPLE)]) {
      expect(f.code).not.toMatch(/react-aria|@internationalized|onPress|isDisabled|selectedKey|onSelectionChange|TextField|screens=/);
    }
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

  /** The sample with `node` added at the end of Garden's root. */
  const withNode = (node: ReturnType<typeof makeNode>) => {
    const garden = SAMPLE_DOC.scenes.find((x) => x.name === 'Garden')!;
    return mapScene(SAMPLE_DOC, garden.id, (sc) => ({ ...sc, root: insertNode(sc.root, { parent: sc.root.id, slot: null, index: sc.root.children?.length ?? 0 }, node) }));
  };

  it('makes one Button a Popover’s or Tooltip’s trigger itself, so the focused control announces the popup', () => {
    const pop = file(withNode(makeNode('Popover')), 'scenes/Garden.tsx');
    expect(pop).toContain('<PopoverTrigger render={<Button variant="secondary" size="sm" />}>Details</PopoverTrigger>');
    expect(pop).not.toMatch(/render=\{<span/);
    expect(pop).not.toContain('aria-label={');
    const tip = file(withNode(makeNode('Tooltip')), 'scenes/Garden.tsx');
    expect(tip).toContain('<TooltipTrigger render={<Button variant="secondary" />}>Hover me</TooltipTrigger>');
    expect(tip).toContain("import { Button } from '@/components/ui/button';");
  });

  it('puts anything else in a trigger inside a plain button, and names a popover by its title', () => {
    const popover = makeNode('Popover');
    const text = makeNode('Text', { props: { ...makeNode('Text').props, children: 'More' } });
    const titled = { ...popover, props: { ...popover.props, title: 'Watering' }, slots: { trigger: [text] } };
    const code = file(withNode(titled), 'scenes/Garden.tsx');
    expect(code).toMatch(/<PopoverTrigger render=\{<button type="button" className="inline-flex" \/>\}>\n[^]*?>More<\/p>[^]*?<\/PopoverTrigger>/);
    expect(code).toContain('<PopoverTitle>Watering</PopoverTitle>');
    expect(code).toContain("import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';");
  });
});
