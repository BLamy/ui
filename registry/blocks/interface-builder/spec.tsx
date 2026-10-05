/* The catalog's vocabulary: how a component is described (its props and the control that edits each, its events,
   slots and parts, where it sits in the library) and the helpers kit.tsx and catalog.tsx share. */
import { createContext, type CSSProperties, type ReactNode } from 'react';
import type { IconShape } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { Layout, Literal, Node, Style } from './model';

/* ── Descriptions ── */

export type PropControl =
  | { kind: 'text'; multiline?: boolean; placeholder?: string; mono?: boolean }
  | { kind: 'number'; min?: number; max?: number; step?: number; unit?: string }
  | { kind: 'boolean' }
  | { kind: 'enum'; options: readonly { id: string; label: string }[] }
  | { kind: 'color' }
  | { kind: 'icon' }
  /** A list, written `First, Second:icon, Third` (an entry's optional `:icon` is a symbol name). */
  | { kind: 'items'; icons?: boolean }
  /** A date, `2026-10-04`. */
  | { kind: 'date' }
  /** One of the document's contexts, by id. */
  | { kind: 'context' }
  /** One of the document's scenes, by id. */
  | { kind: 'scene' }
  /** A Google Fonts family (null: the system font), previewed on the canvas as the list is hovered. */
  | { kind: 'font' };

export interface PropSpec {
  /** The prop's name in code (`variant`, `isDisabled`); `children` for the element's content. */
  name: string;
  /** What the inspector says beside it, when that isn't the name. */
  label?: string;
  control: PropControl;
  default: Literal;
  /** A controlled value: bound to a state name (or `context.field`), this event writes it back. */
  twoWay?: string;
  /** Not a prop of the component itself: a child, or a part around it (shown in the inspector, emitted by codegen). */
  part?: string;
  help?: string;
  /** The inspector section it's in, when not the component's own (`Typography`). */
  group?: string;
}

export interface EventSpec {
  name: string;
  label: string;
  /** What `event` is in its actions. */
  value?: string;
}

export interface SlotSpec {
  name: string;
  label: string;
}

/** The library's sections: the docs' own, in their order, with the layout primitives first. */
export const SECTIONS = [
  'Layout',
  'Buttons and toggles',
  'Forms and inputs',
  'Menus and overlays',
  'Feedback and status',
  'Lists and content',
  'Navigation and layout',
  'Motion components',
  'Editors and workbench',
  'Foundations',
  'React',
] as const;
export type Section = (typeof SECTIONS)[number];

export interface RenderArgs {
  node: Node;
  /** Props, with bindings evaluated. */
  p: Record<string, unknown>;
  /** Event senders by event name (no-ops on the canvas); a two-way prop's write-back is already in its event. */
  on: Record<string, (value?: unknown) => void>;
  /** Whether the node has actions for an event (a row only becomes a button when it does). */
  wired: (event: string) => boolean;
  children: ReactNode;
  /** The children one by one (Tabs gives each its panel). */
  childList: ReactNode[];
  slots: Record<string, ReactNode>;
  /** For a component that holds children: the node's stack layout, for its own root. */
  box: CSSProperties;
  live: boolean;
}

export interface ComponentSpec {
  type: string;
  /** Its name in the library: the export name, for a kit component. */
  title: string;
  section: Section;
  /** A @brett_lamy/ui component, HTML with Tailwind classes, or React itself. */
  source: 'kit' | 'html' | 'react';
  icon: string | readonly IconShape[];
  description: string;
  /** The registry path it's installed at (`@/components/ui/button`); empty for HTML. */
  module: string;
  /** The JSX tag. */
  tag: string;
  /** Other exports its JSX uses (TextField's Label, Input and FieldDescription), as `module|Name`. */
  uses?: string[];
  /**
   * `frame`: the node's box is the container (a stack); `component`: children render inside the component, which
   * gets the stack layout on its root; absent: a leaf.
   */
  container?: 'frame' | 'component';
  slots?: SlotSpec[];
  props: PropSpec[];
  events: EventSpec[];
  /** It can become the first responder (focus). */
  focusable?: boolean;
  /** Positions itself against the scene (a TabBar sits at the bottom): its box takes no space. */
  float?: boolean;
  /** Fills the whole screen, under the status bar (a NavigationStack). */
  screen?: boolean;
  /** Sizing and layout a new one starts with. */
  layout?: Layout;
  style?: Style;
  /** Classes for the node's box (a list row hides its last divider). */
  wrapperClass?: string;
  /** What a new one holds. */
  make?: () => Partial<Node>;
  render: (r: RenderArgs) => ReactNode;
  /** What the code generator writes for it, when that isn't `<Tag prop=…>` with its props as they are: parts that
      carry props, lists that become items, dates that are DateValues. Kept beside `render`, which it mirrors. */
  code?: (g: CodeArgs) => string;
}

/** What a component's `code` writes with. */
export interface CodeArgs {
  /** A prop as a JS expression: its binding, else its literal (`'Day'`, `42`, `true`). */
  expr: (name: string) => string;
  /** A prop as a JSX attribute (` variant="filled"`, ` value={x}`), or '' when it's empty, false or its default. */
  attr: (name: string, as?: string) => string;
  /** A list prop's literal items, or null when it's bound (`expr` is the list then). */
  list: (name: string) => ItemEntry[] | null;
  /** An event as a JSX attribute (` onChange={…}`): its actions and its two-way write-back, the value passed
      through `map` first (a Key to a string, a date to ISO); '' when nothing listens. */
  on: (event: string, map?: (v: string) => string) => string;
  /** An event's handler as a function expression (`(v) => {…}`), for a part that calls it; null when nothing listens. */
  handler: (event: string, map?: (v: string) => string) => string | null;
  /** Import `name` from `module` in the scene's file. */
  use: (module: string, name: string) => void;
  /** Its children, as JSX. */
  children: string[];
  /** A text prop as JSX children: the text, or `{expr}` when bound. */
  text: (name: string) => string;
}

/** A JS string literal. */
export const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/* ── Shared ── */

export const opts = (...pairs: [string, string][]) => pairs.map(([id, label]) => ({ id, label }));
/** An enum whose labels are its values (the kit's own variant names). */
export const values = (...ids: string[]) => ids.map((id) => ({ id, label: id }));

/** The kit's text styles, on its type scale (iOS's). */
export const TEXT_STYLES = {
  largeTitle: { label: 'Large Title', cls: 'text-[34px] leading-[41px] font-bold tracking-[.37px]' },
  title1: { label: 'Title 1', cls: 'text-[28px] leading-[34px] font-bold tracking-[.36px]' },
  title2: { label: 'Title 2', cls: 'text-[22px] leading-[28px] font-bold tracking-[.35px]' },
  title3: { label: 'Title 3', cls: 'text-title leading-[25px] font-semibold tracking-[.38px]' },
  headline: { label: 'Headline', cls: 'text-body leading-[22px] font-semibold tracking-[-.41px]' },
  body: { label: 'Body', cls: 'text-body leading-[22px] tracking-[-.41px]' },
  callout: { label: 'Callout', cls: 'text-callout leading-[21px] tracking-[-.32px]' },
  subhead: { label: 'Subheadline', cls: 'text-subhead leading-[20px] tracking-[-.24px]' },
  footnote: { label: 'Footnote', cls: 'text-footnote leading-[18px] tracking-[-.08px]' },
  caption: { label: 'Caption', cls: 'text-caption leading-[16px]' },
  caption2: { label: 'Caption 2', cls: 'text-caption2 leading-[13px] tracking-[.07px]' },
} as const;
export type TextStyleId = keyof typeof TEXT_STYLES;

const WEIGHTS = {
  default: '', thin: 'font-thin', light: 'font-light', regular: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold',
  heavy: 'font-extrabold', black: 'font-black',
} as const;
const ALIGNS = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
export const textStyleOptions = Object.entries(TEXT_STYLES).map(([id, s]) => ({ id, label: s.label }));

/** The classes of a text style, weight and alignment. */
export function textClass(style: unknown, weight?: unknown, align?: unknown): string {
  return cn(
    TEXT_STYLES[(style as TextStyleId) in TEXT_STYLES ? (style as TextStyleId) : 'body'].cls,
    WEIGHTS[(weight as keyof typeof WEIGHTS) in WEIGHTS ? (weight as keyof typeof WEIGHTS) : 'default'],
    ALIGNS[(align as keyof typeof ALIGNS) in ALIGNS ? (align as keyof typeof ALIGNS) : 'left'],
  );
}

export const str = (v: unknown, d = '') => (v == null ? d : String(v));
export const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : d);

export interface ItemEntry { id: string; label: string; icon?: string }

/**
 * A list prop's entries: from `First, Second:icon` text, or (bound) from an array of strings or of objects with
 * `id`, `label` / `title` / `name` and `icon`.
 */
export function itemsOf(v: unknown): ItemEntry[] {
  if (Array.isArray(v)) {
    return v.map((x, i) => {
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        const label = str(o.label ?? o.title ?? o.name ?? o.id ?? i);
        return { id: str(o.id ?? label), label, icon: o.icon ? str(o.icon) : undefined };
      }
      return { id: str(x), label: str(x) };
    });
  }
  return str(v).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [label, icon] = s.split(':').map((x) => x.trim());
    return { id: label, label, icon: icon || undefined };
  });
}

/** The comma list's labels (for Segmented's options). */
export const splitOptions = (v: unknown) => itemsOf(v).map((i) => i.label);

/* ── Where a scene is in the stack (for NavigationStack's back button) ── */

export interface SceneNav {
  /** Pushed onto another scene: show the back button. */
  canGoBack: boolean;
  backTitle: string;
  goBack: () => void;
  /** The device's top inset, for a NavigationStack that fills the screen. */
  safeTop: number;
}
export const SceneNavContext = createContext<SceneNav>({ canGoBack: false, backTitle: 'Back', goBack: () => {}, safeTop: 0 });

