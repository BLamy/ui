/* Interface Builder's document: a storyboard of scenes, the segues between them, and the contexts every scene can read.
   It is plain data throughout, so undo is a snapshot and a storyboard saves as JSON.

   Xcode's vocabulary, in React terms:
   - a scene is a function component, and its view tree is `root`;
   - an outlet is a ref (`node.ref`), an action is an event handler (`node.on`), and a binding is a prop computed
     from props, state or context (`node.bind`, an expression);
   - a delegate is a callback prop: the destination scene declares it (`PropDef.callback`), and the segue that
     presents it wires it back to actions in the source scene (`segue.delegates`);
   - the first responder is the focused element. A command sent to it (`{ do: 'send' }`) travels up the tree to the
     first node, then the scene, then the app that `responds` to it, the way a context resolves to its nearest
     provider;
   - motion is framer-motion's: appear (initial → animate), hover, press, focus, drag, exit, named variants chosen by
     state, layout and layoutId (Magic Motion), and stagger for children.

   Expressions (bindings, conditions, action values) are source strings in a small, safe subset of JavaScript; see
   expr.ts. They are written exactly as the generated code uses them. */
import type { TransitionSpec } from './easing';

export type Literal = string | number | boolean | null;

/* ── Values ── */

export type ValueType = 'string' | 'number' | 'boolean' | 'list' | 'object' | 'any';

/** A scene input. With `callback`, a function prop: the delegate the presenting scene implements. */
export interface PropDef {
  name: string;
  type: ValueType;
  /** Used when the segue that presents the scene doesn't pass it, and on the canvas (an expression). */
  default: string;
  callback?: boolean;
  /** A callback's parameter names, in scope for the delegate's actions. */
  params?: string[];
}

/** `useState`: a name, its type and its initial value (an expression, evaluated once). */
export interface StateDef {
  name: string;
  type: ValueType;
  initial: string;
}

/** `useMemo`: a value computed from props, state, context and the memos above it. */
export interface MemoDef {
  name: string;
  expr: string;
}

/** `useEffect`: actions when the scene appears or disappears, or when some of its state changes. */
export interface EffectDef {
  id: string;
  on: 'appear' | 'disappear' | 'change';
  /** For `change`: the state (or memo) names it watches. */
  deps: string[];
  actions: Action[];
}

/* ── Actions: what an event, an effect, a delegate or a command does ── */

interface ActionBase {
  id: string;
  /** Run only when this expression is truthy (a guard). */
  if?: string;
}

export type Action = ActionBase & (
  /** Perform a segue: present its destination with its arguments. */
  | { do: 'segue'; segue: string }
  /** Pop or dismiss this scene (an unwind to the scene that presented it). */
  | { do: 'back' }
  /** Unwind to a scene further down the stack (Exit). */
  | { do: 'unwind'; scene: string }
  /** Set state, or a context field (`session.user`), to an expression. */
  | { do: 'set'; target: string; value: string }
  /** Animate an outlet to one of its variants (useAnimate). */
  | { do: 'animate'; ref: string; variant: string }
  /** Make an outlet the first responder (`ref.current.focus()`). */
  | { do: 'focus'; ref: string }
  /** Resign the first responder. */
  | { do: 'blur' }
  /** Send a command up the responder chain, from whatever is focused. */
  | { do: 'send'; command: string }
  /** Call one of this scene's callback props: its delegate. */
  | { do: 'call'; prop: string; args: string[] }
  /** Show a HUD. */
  | { do: 'toast'; message: string }
);

export type ActionKind = Action['do'];

/** An action before it has an id. */
export type ActionInit = Action extends infer A ? (A extends Action ? Omit<A, 'id'> : never) : never;

/* ── Layout and style (Framer's stacks: every container is a flex stack) ── */

export type Axis = 'vertical' | 'horizontal' | 'overlay';
/** `fit` hugs the contents, `fill` takes the free space, a number is fixed px. */
export type Sizing = 'fit' | 'fill' | number;
export type Align = 'start' | 'center' | 'end' | 'stretch';
export type Distribute = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

export interface Layout {
  /** As a container. `overlay` stacks the children on top of each other (a ZStack). */
  axis?: Axis;
  gap?: number;
  /** All sides, or [top, right, bottom, left]. */
  padding?: number | [number, number, number, number];
  align?: Align;
  distribute?: Distribute;
  wrap?: boolean;
  overflow?: 'visible' | 'hidden' | 'scroll';
  /** As a child. */
  width?: Sizing;
  height?: Sizing;
}

export type Shadow = 'none' | 'sm' | 'md' | 'lg';

export interface Style {
  /** A color: `$token` (a theme variable) or any CSS color. */
  fill?: string | null;
  radius?: number;
  borderWidth?: number;
  borderColor?: string | null;
  shadow?: Shadow;
  opacity?: number;
}

/* ── Motion ── */

export type MotionKey =
  | 'opacity' | 'x' | 'y' | 'scale' | 'rotate' | 'rotateX' | 'rotateY' | 'skewX' | 'skewY'
  | 'blur' | 'borderRadius' | 'backgroundColor';

/** One value, or keyframes. */
export type MotionValue = number | string | (number | string)[];
export type Target = Partial<Record<MotionKey, MotionValue>>;

/** A state a node animates to (or, for appear, from), with how it gets there. */
export interface Effect {
  target: Target;
  transition: TransitionSpec;
}

export interface DragSpec {
  axis: 'x' | 'y' | 'both';
  /** `parent`, `none`, or an outlet name to keep it inside. */
  constraints: string;
  elastic: number;
  snapBack: boolean;
  momentum: boolean;
  /** While dragging (whileDrag). */
  target: Target;
}

export interface Motion {
  /** From these values to the node's own: `initial` → `animate`, on mount or when it scrolls into view. */
  appear?: Effect & { trigger: 'mount' | 'inView'; once: boolean };
  hover?: Effect;
  press?: Effect;
  focus?: Effect;
  exit?: Effect;
  drag?: DragSpec;
  /** Named states, for `animate` (state-driven) and the `animate` action. */
  variants?: Record<string, Effect>;
  /** An expression naming the variant to show now: `liked ? 'on' : 'off'`. */
  animate?: string;
  /** Animate its own layout changes (`layout`). */
  layout?: boolean;
  /** Magic Motion: a shared element across scenes (`layoutId`, an expression). */
  layoutId?: string;
  /** For children that appear: `staggerChildren` and `delayChildren`, in seconds. */
  stagger?: { each: number; delay: number; from: 'first' | 'last' };
  /** For layout changes. */
  transition?: TransitionSpec;
}

/* ── The view tree ── */

/** A prototype cell: the node renders once per item of `each` (`.map`), with `as` and `index` in scope. */
export interface Repeat {
  each: string;
  as: string;
  key: string;
}

export interface Node {
  id: string;
  /** A catalog type (catalog.tsx). */
  type: string;
  /** The label in the outline; the type's title when unset. */
  name?: string;
  props: Record<string, Literal>;
  /** Props computed from expressions; they win over `props`. A two-way prop bound to a state name writes back. */
  bind?: Record<string, string>;
  layout?: Layout;
  style?: Style;
  children?: Node[];
  /** Named slots (a nav bar's leading and trailing items, a row's leading view). */
  slots?: Record<string, Node[]>;
  /** An outlet: `const <ref> = useRef()`. */
  ref?: string;
  /** Event handlers: event name → actions. */
  on?: Record<string, Action[]>;
  /** Commands this node handles when it, or something inside it, is the first responder. */
  responds?: Record<string, Action[]>;
  /** Becomes the first responder when the scene appears. */
  autoFocus?: boolean;
  motion?: Motion;
  repeat?: Repeat;
  /** Render only while this is truthy (`{cond && …}`); with an exit effect it animates out. */
  when?: string;
}

/* ── Scenes, segues and contexts ── */

export type DeviceId = 'iphone' | 'iphone-mini' | 'ipad' | 'desktop';

export interface Device {
  name: string;
  w: number;
  h: number;
  /** Safe-area insets: the status bar and the home indicator. */
  top: number;
  bottom: number;
  radius: number;
}

export const DEVICES: Record<DeviceId, Device> = {
  iphone: { name: 'iPhone 16', w: 393, h: 852, top: 54, bottom: 30, radius: 55 },
  'iphone-mini': { name: 'iPhone 13 mini', w: 375, h: 812, top: 50, bottom: 30, radius: 44 },
  ipad: { name: 'iPad mini', w: 744, h: 1133, top: 24, bottom: 20, radius: 22 },
  desktop: { name: 'Desktop', w: 1280, h: 800, top: 0, bottom: 0, radius: 12 },
};

export interface Scene {
  id: string;
  /** The component's name (PascalCase): `SignIn` → `export function SignIn()`. */
  name: string;
  /** Where it sits on the storyboard. */
  x: number;
  y: number;
  props: PropDef[];
  state: StateDef[];
  memos: MemoDef[];
  effects: EffectDef[];
  /** Commands the scene handles (its part of the responder chain). */
  responds?: Record<string, Action[]>;
  /** The scene's background (a color); the root fills the safe area inside it. */
  background?: string | null;
  root: Node;
}

/**
 * How a segue presents its destination: `push` onto the nearest NavigationStack (the kit's own push and back),
 * `detail` into the nearest SplitView's detail column (Show Detail), `modal` as a sheet over the app, `fade` and
 * `magic` over the app (Magic Motion flies shared layoutIds), `replace` swaps the app's root.
 */
export type SegueKind = 'push' | 'detail' | 'modal' | 'fade' | 'magic' | 'replace';

export interface Segue {
  id: string;
  /** A name for it (`showPlant`), used by the code. */
  identifier: string;
  from: string;
  to: string;
  kind: SegueKind;
  transition: TransitionSpec;
  /** The destination's props, as expressions in the source's scope (prepare(for:sender:)). */
  args: Record<string, string>;
  /** The destination's callback props, as actions in the source scene (its delegate). */
  delegates: Record<string, Action[]>;
}

export interface FieldDef {
  name: string;
  type: ValueType;
  initial: string;
}

/** A React context, provided at the root of the app. Expressions read it by `alias` (`session.user`). */
export interface ContextDef {
  id: string;
  /** `SessionContext`. */
  name: string;
  /** `session`: `const session = useContext(SessionContext)`. */
  alias: string;
  fields: FieldDef[];
}

export interface Doc {
  version: 1;
  name: string;
  device: DeviceId;
  /** The initial scene (the storyboard entry point). */
  entry: string;
  scenes: Scene[];
  segues: Segue[];
  contexts: ContextDef[];
  /** Commands the app handles: the end of every responder chain. */
  responds?: Record<string, Action[]>;
  /** The app's fonts: Google Fonts stacks for the kit's `--font-sans` (every component's text) and `--font-mono`
      (code); none, the system's. */
  fonts?: AppFonts;
}

export interface AppFonts {
  sans?: string[];
  mono?: string[];
}

/* ── Colors ── */

/** Theme colors a color field offers, as `$token` values (they follow light and dark). */
export const THEME_COLORS = [
  { id: '$primary', label: 'Accent' },
  { id: '$foreground', label: 'Label' },
  { id: '$muted-foreground', label: 'Secondary label' },
  { id: '$background', label: 'Background' },
  { id: '$card', label: 'Card' },
  { id: '$secondary', label: 'Fill' },
  { id: '$secondary-strong', label: 'Strong fill' },
  { id: '$border', label: 'Separator' },
  { id: '$destructive', label: 'Red' },
  { id: '$success', label: 'Green' },
  { id: '$warning', label: 'Orange' },
] as const;

/** A stored color as CSS: `$primary` → `var(--primary)`. */
export function cssColor(c: string | null | undefined): string | undefined {
  if (!c) return undefined;
  return c.startsWith('$') ? `var(--${c.slice(1)})` : c;
}

/* ── Ids ── */

let counter = 0;
/** A fresh id: unique in the document, short enough to read in the outline. */
export const newId = (prefix = 'n') => `${prefix}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** `Sign in screen` → `SignInScreen`. */
export function pascal(s: string): string {
  const out = s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[a-z]/, (c) => c.toUpperCase());
  return /^[A-Za-z]/.test(out) ? out : `Scene${out}`;
}

/** `Sign In Button` → `signInButton`. */
export function camel(s: string): string {
  const p = pascal(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

/** `base`, else `base2`, `base3` … whichever isn't taken. */
export function uniqueName(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}${i}`)) return `${base}${i}`;
}
