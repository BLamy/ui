/* The catalog: everything you can put in a scene, described once. The library is @brett_lamy/ui itself — every
   app-facing component under its own export name, in the docs' sections (kit.tsx), with its real props and their
   real values, its events, its compound parts and slots, and a render that draws the component itself — plus the
   few HTML layout pieces an app glues them together with (a flex stack, a paragraph, an image, a spacer) and a
   React context provider. The library, the inspector, the renderer and the code generator all read this table. */
import type { CSSProperties } from 'react';
import { fontStack, useGoogleFont } from '@/lib/google-fonts';
import { Icon, type IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { KIT } from './kit';
import { cssColor, newId, type Doc, type Node } from './model';
import { ART_GRADIENTS } from './palette';
import { num, opts, str, textClass, textStyleOptions, values, type ComponentSpec, type Section } from './spec';

export * from './spec';

/* ── The layout primitives: HTML with Tailwind, the glue between the kit's components ── */

const weightOptions = opts(
  ['default', 'Default'], ['thin', 'Thin'], ['light', 'Light'], ['regular', 'Regular'], ['medium', 'Medium'], ['semibold', 'Semibold'], ['bold', 'Bold'],
  ['heavy', 'Heavy'], ['black', 'Black'],
);
const TYPO = 'Typography';

const PRIMITIVES: Record<string, ComponentSpec> = {
  Stack: {
    type: 'Stack',
    title: 'Stack',
    section: 'Layout',
    source: 'html',
    icon: 'layers',
    description: 'A flex <div> (Tailwind’s flex, gap, padding and alignment): the column, row or overlay that kit components sit in. Framer’s Stack.',
    module: '',
    tag: 'div',
    container: 'frame',
    props: [],
    events: [],
    layout: { axis: 'vertical', gap: 12, align: 'start', distribute: 'start', width: 'fill' },
    render: ({ children }) => children,
  },
  Text: {
    type: 'Text',
    title: 'Text',
    section: 'Layout',
    source: 'html',
    icon: 'textformat',
    description: 'A <p> in one of the kit’s text styles (text-body, text-footnote…), in any Google Fonts family. Bind it to an expression and it updates with state.',
    module: '',
    tag: 'p',
    props: [
      { name: 'children', label: 'text', control: { kind: 'text', multiline: true }, default: 'Text' },
      { name: 'textStyle', label: 'style', control: { kind: 'enum', options: textStyleOptions }, default: 'body', part: 'className', group: TYPO },
      { name: 'font', control: { kind: 'font' }, default: null, part: 'style.fontFamily', group: TYPO, help: 'A Google Fonts family, loaded from its CDN (hover the list to see it on the canvas); none: the app’s font' },
      { name: 'weight', control: { kind: 'enum', options: weightOptions }, default: 'default', part: 'className', group: TYPO },
      { name: 'size', control: { kind: 'number', min: 0, max: 240, step: 1, unit: 'px' }, default: 0, part: 'style.fontSize', group: TYPO, help: '0: the text style’s size' },
      { name: 'italic', control: { kind: 'boolean' }, default: false, part: 'className', group: TYPO },
      { name: 'tracking', label: 'letter spacing', control: { kind: 'number', min: -20, max: 60, step: 0.5, unit: '%' }, default: 0, part: 'style.letterSpacing', group: TYPO, help: 'Of the size (Figma’s %); 0: the text style’s' },
      { name: 'leading', label: 'line height', control: { kind: 'number', min: 0, max: 4, step: 0.05 }, default: 0, part: 'style.lineHeight', group: TYPO, help: 'A multiple of the size; 0: the text style’s' },
      { name: 'transform', label: 'case', control: { kind: 'enum', options: opts(['none', 'As typed'], ['uppercase', 'UPPERCASE'], ['lowercase', 'lowercase'], ['capitalize', 'Title Case']) }, default: 'none', part: 'className', group: TYPO },
      { name: 'decoration', control: { kind: 'enum', options: opts(['none', 'None'], ['underline', 'Underline'], ['line-through', 'Strikethrough']) }, default: 'none', part: 'className', group: TYPO },
      { name: 'color', control: { kind: 'color' }, default: null, part: 'className', group: TYPO },
      { name: 'align', control: { kind: 'enum', options: values('left', 'center', 'right') }, default: 'left', part: 'className', group: TYPO },
      { name: 'lines', control: { kind: 'number', min: 0, max: 20, step: 1 }, default: 0, part: 'className', group: TYPO, help: 'line-clamp; 0 for no limit' },
    ],
    events: [],
    layout: { width: 'fill' },
    render: ({ p }) => <TextView p={p} />,
  },
  Image: {
    type: 'Image',
    title: 'Image',
    section: 'Layout',
    source: 'html',
    icon: 'photo',
    description: 'An <img>, or, without a URL, a gradient with an emoji or a symbol as a stand-in. Give it a Magic Motion id and it flies between scenes.',
    module: '',
    tag: 'img',
    props: [
      { name: 'src', control: { kind: 'text', placeholder: 'https://…' }, default: '' },
      { name: 'alt', control: { kind: 'text' }, default: '' },
      { name: 'emoji', control: { kind: 'text' }, default: '🌿', help: 'The stand-in, without a src' },
      { name: 'symbol', control: { kind: 'icon' }, default: null },
      { name: 'from', control: { kind: 'color' }, default: ART_GRADIENTS[0][0] },
      { name: 'to', control: { kind: 'color' }, default: ART_GRADIENTS[0][1] },
    ],
    events: [],
    layout: { width: 96, height: 96 },
    style: { radius: 22 },
    render: ({ p }) => {
      const src = str(p.src);
      if (src) return <img src={src} alt={str(p.alt)} draggable={false} className="block size-full rounded-[inherit] object-cover" />;
      return (
        <div
          role={p.alt ? 'img' : undefined}
          aria-label={p.alt ? str(p.alt) : undefined}
          className="grid size-full place-items-center overflow-hidden rounded-[inherit] text-white [container-type:size]"
          style={{ background: `linear-gradient(135deg, ${cssColor(str(p.from)) ?? 'var(--secondary)'}, ${cssColor(str(p.to)) ?? 'var(--secondary-strong)'})` }}
        >
          {p.symbol ? <PrimitiveSymbol name={str(p.symbol)} /> : <span aria-hidden="true" className="text-[48cqmin] leading-none">{str(p.emoji)}</span>}
        </div>
      );
    },
  },
  Spacer: {
    type: 'Spacer',
    title: 'Spacer',
    section: 'Layout',
    source: 'html',
    icon: 'arrows-expand',
    description: 'A flex-1 <div>: it takes whatever room the stack has left, pushing its neighbours apart.',
    module: '',
    tag: 'div',
    props: [],
    events: [],
    layout: { width: 'fill', height: 'fill' },
    render: () => null,
  },
  Provider: {
    type: 'Provider',
    title: 'Context.Provider',
    section: 'React',
    source: 'react',
    icon: 'square-on-square',
    description: 'Provides a context to everything inside it, overriding some of its fields: React’s <Context.Provider>, scoped to a subtree.',
    module: '',
    tag: 'Provider',
    container: 'frame',
    props: [{ name: 'context', control: { kind: 'context' }, default: null }],
    events: [],
    layout: { axis: 'vertical', gap: 12, align: 'start', width: 'fill' },
    render: ({ children }) => children,
  },
};

function PrimitiveSymbol({ name }: { name: string }) {
  return <Icon name={name} size={40} sw={1.8} className="size-[44cqmin]" />;
}

export const CATALOG: Record<string, ComponentSpec> = { ...PRIMITIVES, ...KIT };

export const specOf = (type: string): ComponentSpec => CATALOG[type] ?? CATALOG.Stack;

/** A node's label in the outline: its name, else its text (when it isn't the default), else its type; a scene
    used as a component reads as one, `<Garden />`. */
export function nodeLabel(n: Node, doc?: Doc): string {
  if (n.name) return n.name;
  const spec = specOf(n.type);
  if (n.type === 'SceneRef') {
    const scene = doc?.scenes.find((s) => s.id === n.props.scene);
    return scene ? `<${scene.name} />` : spec.title;
  }
  const key = (['children', 'label', 'title'] as const).find((k) => n.props[k] != null);
  const text = key ? n.props[key] : null;
  if (typeof text === 'string' && text.trim() && text !== spec.props.find((p) => p.name === key)?.default) return `${spec.title} “${text.length > 22 ? `${text.slice(0, 22)}…` : text}”`;
  if (n.type === 'Stack') return n.layout?.axis === 'horizontal' ? 'HStack' : n.layout?.axis === 'overlay' ? 'ZStack' : 'VStack';
  return spec.title;
}

/** A Text: the text style's classes, and what overrides them (a family, a size, spacing, case) inline. */
function TextView({ p }: { p: Record<string, unknown> }) {
  const font = typeof p.font === 'string' && p.font.trim() ? p.font : null;
  useGoogleFont(font, { italic: !!p.italic });
  const lines = num(p.lines), size = num(p.size), tracking = num(p.tracking), leading = num(p.leading);
  const transform = ['uppercase', 'lowercase', 'capitalize'].find((t) => t === p.transform);
  const decoration = ['underline', 'line-through'].find((d) => d === p.decoration);
  return (
    <p
      className={cn('m-0 min-w-0 whitespace-pre-wrap', textClass(p.textStyle, p.weight, p.align), !!p.italic && 'italic', lines > 0 && 'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]')}
      style={{
        color: cssColor(p.color as string | null) ?? undefined,
        WebkitLineClamp: lines > 0 ? lines : undefined,
        fontFamily: fontStack(font),
        fontSize: size > 0 ? size : undefined,
        // A size of its own wants a line height of its own (the style's is in px).
        lineHeight: leading > 0 ? leading : size > 0 ? 1.2 : undefined,
        letterSpacing: tracking ? `${tracking / 100}em` : undefined,
        textTransform: transform as CSSProperties['textTransform'],
        textDecorationLine: decoration,
      }}
    >
      {str(p.children)}
    </p>
  );
}

/* ── Making nodes ── */

const defaults = (type: string) => Object.fromEntries(specOf(type).props.map((p) => [p.name, p.default]));

/** A new node of `type`, with its defaults (and what it starts out holding) and `patch` on top. */
export function makeNode(type: string, patch: Partial<Node> = {}): Node {
  const spec = specOf(type);
  const made = spec.make?.() ?? {};
  return {
    id: newId(),
    type,
    ...(spec.layout ? { layout: { ...spec.layout } } : null),
    ...(spec.style ? { style: { ...spec.style } } : null),
    ...(spec.container ? { children: [] } : null),
    ...(spec.slots ? { slots: Object.fromEntries(spec.slots.map((s) => [s.name, []])) } : null),
    ...made,
    ...patch,
    props: { ...defaults(type), ...made.props, ...patch.props },
  };
}

/* ── The library ── */

export interface LibraryItem {
  id: string;
  title: string;
  /** The JSX it inserts, for the row's second line. */
  code: string;
  description: string;
  section: Section;
  source: ComponentSpec['source'];
  icon: string | readonly IconShape[];
  keywords: string;
  make: () => Node;
}

const entry = (type: string, extra: Partial<LibraryItem> & { patch?: () => Partial<Node> } = {}): LibraryItem => {
  const spec = specOf(type);
  const { patch, ...rest } = extra;
  return {
    id: type,
    title: spec.title,
    code: `<${spec.tag}>`,
    description: spec.description,
    section: spec.section,
    source: spec.source,
    icon: spec.icon,
    keywords: `${type} ${spec.title} ${spec.section}`,
    make: () => makeNode(type, patch?.()),
    ...rest,
  };
};

/** Every kit component (in catalog order), and a few useful starting points for the layout primitives. */
export const LIBRARY: LibraryItem[] = [
  entry('Stack', { id: 'vstack', title: 'VStack', code: '<div className="flex flex-col">', keywords: 'stack column vertical flex div', patch: () => ({ layout: { axis: 'vertical', gap: 12, align: 'start', distribute: 'start', width: 'fill' } }) }),
  entry('Stack', { id: 'hstack', title: 'HStack', code: '<div className="flex flex-row">', keywords: 'stack row horizontal flex div', description: 'A flex row: children side by side, centered across.', patch: () => ({ layout: { axis: 'horizontal', gap: 12, align: 'center', distribute: 'start', width: 'fill' } }) }),
  entry('Stack', { id: 'zstack', title: 'ZStack', code: '<div className="grid">', keywords: 'stack overlay layers grid', description: 'Children on top of each other (a one-cell grid): a badge over an avatar, a caption over a picture.', patch: () => ({ layout: { axis: 'overlay', align: 'center', distribute: 'center', width: 'fit' } }) }),
  entry('Stack', { id: 'frame', title: 'Frame', code: '<div className="size-30 rounded-[28px] bg-primary">', keywords: 'box rectangle shape frame div', description: 'A fixed-size, filled, rounded <div>: something to animate, drag or put things in.', patch: () => ({ name: 'Frame', layout: { axis: 'vertical', align: 'center', distribute: 'center', width: 120, height: 120 }, style: { fill: '$primary', radius: 28 } }) }),
  entry('Text'),
  entry('Image'),
  entry('Spacer'),
  ...Object.values(KIT).map((spec) => entry(spec.type)),
  entry('Provider'),
];
