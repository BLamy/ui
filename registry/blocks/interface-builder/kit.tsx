/* @brett_lamy/ui, as the library: every app-facing component under its export name and in its docs section, with
   its registry description, its real props and their real values (`variant="secondary"`), its events, and its
   compound parts as children or slots. Each renders the kit's own component, so the canvas and the preview are the
   kit itself, and the code generator writes the same JSX: 6.0's, on UI SDK (`onClick`, `value` / `onValueChange`,
   a root with named parts, dates and colors as strings). */
import { cloneElement, createContext, use, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { mergeProps } from '@ui-sdk/react/primitive';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Avatar, type AvatarStatus } from '@/components/ui/avatar';
import { AvatarGroup } from '@/components/ui/avatar-group';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker, ColorPickerContent, ColorPickerTrigger } from '@/components/ui/color-picker';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInputGroup, ComboboxInput, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { DateInput } from '@/components/ui/date-input';
import { DatePicker, DatePickerContent, DatePickerInputGroup } from '@/components/ui/date-picker';
import { Disclosure, DisclosurePanel, DisclosureTrigger } from '@/components/ui/disclosure';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { NowPlayingBars } from '@/components/ui/now-playing-bars';
import { NumberMorph } from '@/components/ui/number-morph';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ProgressStepper } from '@/components/ui/progress-stepper';
import { QRCode } from '@/components/ui/qr-code';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { SearchInput } from '@/components/ui/search-input';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner, spinnerAnimations, type SpinnerAnimation } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { CodeEditor } from '@/components/ui/code-editor';
import { Tabs, TabsBar, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TextMorph } from '@/components/ui/text-morph';
import { Toggle, ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/lib/icon';
import { springs, type SpringName } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { cssColor, newId, type Node } from './model';
import { NavStackHost, SceneRefHost, SplitViewHost, TabsScreenHost } from './hosts';
import { itemsOf, num, q, str, textClass, textStyleOptions, values, type CodeArgs, type ComponentSpec, type ItemEntry } from './spec';

const pick = <T extends string>(v: unknown, options: readonly T[], d: T): T => (options.includes(v as T) ? (v as T) : d);

/* ── Triggers in a slot ──
   A Popover's or Tooltip's trigger part has to be the control people focus. When its slot holds one Button, the
   part renders through that Button (`render` with a function hands the part's props to it, and the Button takes
   them from context); anything else sits inside a plain <button> the part renders. The code generator writes the
   same shapes (`codegen.ts`, `CodeArgs.trigger`). */
const TriggerPropsContext = createContext<Record<string, unknown> | null>(null);

type TriggerPart = ComponentType<{ render?: unknown; children?: ReactNode }>;

function SlotTrigger({ part: Part, nodes, children }: { part: TriggerPart; nodes: readonly Node[] | undefined; children: ReactNode }) {
  if (nodes?.length === 1 && nodes[0].type === 'Button') {
    return (
      <Part render={({ children: inner, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
        <TriggerPropsContext value={props}>{inner}</TriggerPropsContext>
      )}>
        {children}
      </Part>
    );
  }
  return <Part render={<button type="button" className="inline-flex max-w-full cursor-default border-0 bg-transparent p-0 text-left text-inherit outline-none focus-visible:ring-2 focus-visible:ring-ring" />}>{children}</Part>;
}

/** A Button that is a trigger part's element when one hands it its props. */
function TriggerButton({ children }: { children: ReactElement<Record<string, unknown>> }) {
  const trigger = use(TriggerPropsContext);
  const el = trigger ? cloneElement(children, mergeProps(trigger, children.props)) : children;
  // What the Button holds is not the trigger.
  return trigger ? <TriggerPropsContext value={null}>{el}</TriggerPropsContext> : el;
}
/** An ISO date (`2026-10-04`), or null. */
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null);
/** What a color picker starts on: the system blue. */
const START_COLOR = '#0A84FF';
const leaf = (type: string, props: Record<string, unknown> = {}, patch: Partial<Node> = {}): Node => ({ id: newId(), type, props: props as Node['props'], ...patch });
/** A comma list's entries as UI SDK's data items (`{ value, label }`). */
const dataItems = (v: unknown) => itemsOf(v).map((it) => ({ value: it.id, label: it.label }));

const BUTTON_VARIANTS = ['default', 'secondary', 'outline', 'contrast', 'ghost', 'quiet', 'destructive', 'plain', 'link'] as const;
const BUTTON_SIZES = ['default', 'sm', 'lg', 'pill', 'icon', 'icon-sm'] as const;
const SPINNERS = spinnerAnimations.map((a) => a.id);
const SIDES = ['top', 'bottom', 'left', 'right'] as const;
const ALIGNS = ['start', 'center', 'end'] as const;

/** A labelled control in the canvas and preview: in a Field with its FieldLabel when it has a label. */
function Labelled({ label, children }: { label: unknown; children: ReactNode }) {
  if (!label) return <>{children}</>;
  return (
    <Field className="min-w-0">
      <FieldLabel>{str(label)}</FieldLabel>
      {children}
    </Field>
  );
}

/* ── Code: the JSX a component's `code` writes ── */

const nest = (s: string) => s.split('\n').join('\n  ');
/** Indents a block by two spaces, every line. */
const indent2 = (s: string) => s.split('\n').map((l) => `  ${l}`).join('\n');
/** A list prop as items: its literal items, each written by `each`, or its bound list mapped by `each` at run time. */
const listCode = (g: CodeArgs, name: string, each: (it: ItemEntry | null, v: string) => string, join = ', ') => {
  const items = g.list(name);
  return items ? items.map((it) => each(it, '')).join(join) : `{${g.expr(name)}.map((it) => ${each(null, 'it')})}`;
};
/** An item's field, literal or read at run time from a bound list's entry `v` (a string, or an object). */
const field = (it: ItemEntry | null, v: string, f: 'id' | 'label' | 'icon') => (it ? (it[f] == null ? 'undefined' : q(String(it[f]))) : f === 'icon' ? `${v}.icon` : `(${v}.${f} ?? ${v})`);
/** A list prop as UI SDK's data items: `[{ value: 'day', label: 'Day' }]`, or the bound list mapped to them. */
const itemsCode = (g: CodeArgs, name: string) => {
  const items = g.list(name);
  return items
    ? `[${items.map((it) => `{ value: ${q(it.id)}, label: ${q(it.label)} }`).join(', ')}]`
    : `${g.expr(name)}.map((it) => ({ value: it.id ?? it, label: it.label ?? it }))`;
};
/** The part of the kit a component's parts come from: imports them. */
const parts = (g: CodeArgs, module: string, ...names: string[]) => names.forEach((n) => g.use(module, n));
/** A control in a Field with its FieldLabel, when it has a label (`extra`: more of the Field's parts after it). */
const fieldCode = (g: CodeArgs, control: string, attrs = '', extra: string[] = []) => {
  const t = g.text('label');
  if (!t && !attrs && !extra.length) return control;
  parts(g, '@/components/ui/field', 'Field', ...(t ? ['FieldLabel'] : []));
  return `<Field${attrs}>${t ? `\n  <FieldLabel>${t}</FieldLabel>` : ''}\n  ${nest(control)}${extra.map((x) => `\n  ${x}`).join('')}\n</Field>`;
};

const text = (name = 'children', d = '', label?: string) => ({ name, label, control: { kind: 'text' as const }, default: d });

export const KIT: Record<string, ComponentSpec> = {
  /* ── Buttons and toggles ── */
  Button: {
    type: 'Button', title: 'Button', section: 'Buttons and toggles', source: 'kit', icon: 'circle-fill',
    description: "The labelled action button: UI SDK's Button with default, secondary, outline, contrast, ghost, quiet, destructive, plain (the bar text button) and link (inline) variants, five sizes including the full-width iOS pill, a press that sinks on a spring, and a text label that morphs into the next one.",
    module: '@/components/ui/button', tag: 'Button', focusable: true,
    props: [
      text('children', 'Button'),
      { name: 'variant', control: { kind: 'enum', options: values(...BUTTON_VARIANTS) }, default: 'default' },
      { name: 'size', control: { kind: 'enum', options: values(...BUTTON_SIZES) }, default: 'default' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
      { name: 'icon', control: { kind: 'icon' }, default: null, part: '<Icon> child', help: 'An Icon before the label' },
    ],
    events: [{ name: 'onClick', label: 'onClick' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => {
      const size = pick(p.size, BUTTON_SIZES, 'default');
      const label = str(p.children);
      return (
        <TriggerButton>
          <Button variant={pick(p.variant, BUTTON_VARIANTS, 'default')} size={size} disabled={!!p.disabled} onClick={() => on.onClick?.()} aria-label={size.startsWith('icon') ? label : undefined} className="max-w-full">
            {p.icon ? <Icon name={str(p.icon)} size={size === 'sm' || size === 'icon-sm' ? 15 : 18} sw={2.1} /> : null}
            {size.startsWith('icon') ? null : label}
          </Button>
        </TriggerButton>
      );
    },
  },
  Toggle: {
    type: 'Toggle', title: 'Toggle', section: 'Buttons and toggles', source: 'kit', icon: 'switch-2',
    description: "Two-state button on UI SDK's Toggle: tinted when on, in default, secondary, outline and quiet variants.",
    module: '@/components/ui/toggle', tag: 'Toggle', focusable: true,
    props: [
      text('children', 'Mute'),
      { name: 'pressed', control: { kind: 'boolean' }, default: false, twoWay: 'onPressedChange' },
      { name: 'variant', control: { kind: 'enum', options: values('default', 'secondary', 'outline', 'quiet') }, default: 'secondary' },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default' },
      { name: 'icon', control: { kind: 'icon' }, default: 'bell', part: '<Icon> child' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onPressedChange', label: 'onPressedChange', value: 'pressed' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => (
      <Toggle pressed={!!p.pressed} onPressedChange={(v) => on.onPressedChange?.(v)} variant={pick(p.variant, ['default', 'secondary', 'outline', 'quiet'] as const, 'secondary')} size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} disabled={!!p.disabled} aria-label={str(p.children) || 'Toggle'}>
        {p.icon ? <Icon name={str(p.icon)} size={16} sw={2} /> : null}
        {str(p.children)}
      </Toggle>
    ),
    code: (g) => {
      g.use('@/components/ui/toggle', 'Toggle');
      const icon = g.attr('icon', 'name');
      if (icon) g.use('@/lib/icon', 'Icon');
      const label = g.text('children');
      return `<Toggle pressed={${g.expr('pressed')}}${g.on('onPressedChange')}${g.attr('variant')}${g.attr('size')}${g.attr('disabled')}${label ? '' : ' aria-label="Toggle"'}>${icon ? `<Icon${icon} size={16} sw={2} />` : ''}${label}</Toggle>`;
    },
  },
  ToggleGroup: {
    type: 'ToggleGroup', title: 'ToggleGroup', section: 'Buttons and toggles', source: 'kit', icon: 'rectangle-split',
    description: "UI SDK's ToggleGroup with single or multiple selection, roving arrow-key focus, and segmented (Segmented's track), outline (joined), default, secondary and quiet looks.",
    module: '@/components/ui/toggle', tag: 'ToggleGroup', uses: ['@/components/ui/toggle|ToggleGroupItem'], focusable: true,
    props: [
      { name: 'items', control: { kind: 'items' }, default: 'List, Grid, Board', part: '<ToggleGroupItem>s' },
      { name: 'value', label: 'pressed', control: { kind: 'text' }, default: 'Grid', twoWay: 'onValueChange', help: 'An item, or several separated by commas' },
      { name: 'multiple', control: { kind: 'boolean' }, default: false },
      { name: 'variant', control: { kind: 'enum', options: values('segmented', 'outline', 'default', 'secondary', 'quiet') }, default: 'segmented' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'View' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the pressed items, comma-separated' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => {
      const multiple = !!p.multiple;
      const sel = Array.isArray(p.value) ? p.value.map(String) : str(p.value).split(',').map((s) => s.trim()).filter(Boolean);
      return (
        <ToggleGroup
          aria-label={str(p['aria-label'], 'Options')}
          multiple={multiple}
          deselectable={multiple}
          variant={pick(p.variant, ['segmented', 'outline', 'default', 'secondary', 'quiet'] as const, 'segmented')}
          value={sel}
          onValueChange={(v) => on.onValueChange?.(v.join(', '))}
        >
          {itemsOf(p.items).map((it) => (
            <ToggleGroupItem key={it.id} value={it.id} aria-label={it.icon ? it.label : undefined}>{it.icon ? <Icon name={it.icon} size={16} sw={2} /> : it.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/toggle', 'ToggleGroup', 'ToggleGroupItem');
      const multiple = g.expr('multiple') === 'true';
      const items = listCode(g, 'items', (it, v) => `<ToggleGroupItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} value={${field(it, v, 'id')}}>{${field(it, v, 'label')}}</ToggleGroupItem>`, '\n  ');
      return `<ToggleGroup aria-label={${g.expr('aria-label')}}${multiple ? ' multiple' : ' deselectable={false}'}${g.attr('variant')} value={String(${g.expr('value')}).split(', ')}${g.on('onValueChange', (v) => `${v}.join(', ')`)}>\n  ${items}\n</ToggleGroup>`;
    },
  },

  /* ── Forms and inputs ── */
  Field: {
    type: 'Field', title: 'Field', section: 'Forms and inputs', source: 'kit', icon: 'square-pencil',
    description: "UI SDK's Field restyled: it links a FieldLabel, an Input or Textarea, a FieldDescription and a FieldError, and shows the control's validity. The value is on the control.",
    module: '@/components/ui/field', tag: 'Field', focusable: true,
    uses: ['@/components/ui/field|FieldLabel', '@/components/ui/input|Input', '@/components/ui/field|FieldDescription'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Label', part: '<FieldLabel>' },
      { name: 'placeholder', control: { kind: 'text' }, default: '', part: '<Input placeholder>' },
      { name: 'value', control: { kind: 'text' }, default: '', twoWay: 'onValueChange', part: '<Input value>' },
      { name: 'type', control: { kind: 'enum', options: values('text', 'email', 'password', 'tel', 'url', 'search') }, default: 'text', part: '<Input type>' },
      { name: 'description', control: { kind: 'text' }, default: '', part: '<FieldDescription>' },
      { name: 'errorMessage', control: { kind: 'text' }, default: '', part: '<FieldError>', help: 'Shown while invalid' },
      { name: 'multiline', control: { kind: 'boolean' }, default: false, part: '<Textarea> for <Input>' },
      { name: 'required', control: { kind: 'boolean' }, default: false, part: '<Input required>' },
      { name: 'invalid', control: { kind: 'boolean' }, default: false },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the text' }, { name: 'onSubmit', label: 'onSubmit (Return)', value: 'the text' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => {
      const name = p.label ? undefined : str(p.placeholder, 'Text field');
      return (
        <Field invalid={p.invalid ? true : undefined} disabled={!!p.disabled} className="min-w-0">
          {p.label ? <FieldLabel>{str(p.label)}</FieldLabel> : null}
          {p.multiline
            ? <Textarea value={str(p.value)} onValueChange={(v) => on.onValueChange?.(v)} required={!!p.required} placeholder={str(p.placeholder)} aria-label={name} submitShortcut="mod+enter" onSubmit={(v) => on.onSubmit?.(v)} />
            : <Input type={str(p.type, 'text')} value={str(p.value)} onValueChange={(v) => on.onValueChange?.(v)} required={!!p.required} placeholder={str(p.placeholder)} aria-label={name} onKeyDown={(e) => { if (e.key === 'Enter') on.onSubmit?.(str(p.value)); }} />}
          {p.description ? <FieldDescription>{str(p.description)}</FieldDescription> : null}
          {p.errorMessage ? <FieldError>{str(p.errorMessage)}</FieldError> : null}
        </Field>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/field', 'Field');
      const multiline = g.expr('multiline') === 'true';
      const input = multiline ? 'Textarea' : 'Input';
      g.use(`@/components/ui/${multiline ? 'textarea' : 'input'}`, input);
      const submit = g.handler('onSubmit');
      const keys = !submit ? '' : multiline ? ` submitShortcut="mod+enter" onSubmit={${submit}}` : ` onKeyDown={(e) => { if (e.key === 'Enter') (${submit})(${g.expr('value')}); }}`;
      const extra: string[] = [];
      if (g.text('description')) { g.use('@/components/ui/field', 'FieldDescription'); extra.push(`<FieldDescription>${g.text('description')}</FieldDescription>`); }
      if (g.text('errorMessage')) { g.use('@/components/ui/field', 'FieldError'); extra.push(`<FieldError>${g.text('errorMessage')}</FieldError>`); }
      const label = g.text('label');
      if (label) g.use('@/components/ui/field', 'FieldLabel');
      const invalid = g.attr('invalid');
      const control = `<${input}${multiline ? '' : g.attr('type')} value={${g.expr('value')}}${g.on('onValueChange')}${g.attr('required')}${g.attr('placeholder')}${keys} />`;
      return `<Field${invalid ? ` invalid={${g.expr('invalid')} || undefined}` : ''}${g.attr('disabled')}>${label ? `\n  <FieldLabel>${label}</FieldLabel>` : ''}\n  ${control}${extra.map((x) => `\n  ${x}`).join('')}\n</Field>`;
    },
  },
  SearchInput: {
    type: 'SearchInput', title: 'SearchInput', section: 'Forms and inputs', source: 'kit', icon: 'magnifyingglass',
    description: "iOS search field on UI SDK's Input: magnifier, clear button, Esc to clear, controlled or uncontrolled.",
    module: '@/components/ui/search-input', tag: 'SearchInput', focusable: true,
    props: [
      { name: 'value', control: { kind: 'text' }, default: '', twoWay: 'onValueChange' },
      { name: 'placeholder', control: { kind: 'text' }, default: 'Search' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the query' }, { name: 'onSubmit', label: 'onSubmit', value: 'the query' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => <SearchInput value={str(p.value)} onValueChange={(v) => on.onValueChange?.(v)} onSubmit={(v) => on.onSubmit?.(v)} placeholder={str(p.placeholder, 'Search')} aria-label={str(p.placeholder, 'Search')} />,
  },
  Checkbox: {
    type: 'Checkbox', title: 'Checkbox', section: 'Forms and inputs', source: 'kit', icon: 'checkmark-circle',
    description: "UI SDK's Checkbox and CheckboxGroup with a round iOS selection mark (or a square one), a drawn-on tick and an indeterminate state. A Label around it and its text presses it.",
    module: '@/components/ui/checkbox', tag: 'Checkbox', focusable: true, uses: ['@/components/ui/label|Label'],
    props: [
      { name: 'children', control: { kind: 'text' }, default: 'Remember me', part: '<Label variant="control"> text' },
      { name: 'checked', control: { kind: 'boolean' }, default: false, twoWay: 'onCheckedChange' },
      { name: 'shape', control: { kind: 'enum', options: values('circle', 'square') }, default: 'circle' },
      { name: 'indeterminate', control: { kind: 'boolean' }, default: false, part: 'checked="indeterminate"' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onCheckedChange', label: 'onCheckedChange', value: 'checked' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => (
      <Label variant="control">
        <Checkbox checked={p.indeterminate ? 'indeterminate' : !!p.checked} onCheckedChange={(v) => on.onCheckedChange?.(v === true)} shape={pick(p.shape, ['circle', 'square'] as const, 'circle')} disabled={!!p.disabled} />
        {str(p.children)}
      </Label>
    ),
    code: (g) => {
      g.use('@/components/ui/checkbox', 'Checkbox');
      g.use('@/components/ui/label', 'Label');
      const checked = g.expr('indeterminate') === 'true' ? '"indeterminate"' : `{${g.expr('checked')}}`;
      return `<Label variant="control">\n  <Checkbox checked=${checked}${g.on('onCheckedChange')}${g.attr('shape')}${g.attr('disabled')} />\n  ${g.text('children')}\n</Label>`;
    },
  },
  RadioGroup: {
    type: 'RadioGroup', title: 'RadioGroup', section: 'Forms and inputs', source: 'kit', icon: 'circle',
    description: "UI SDK's RadioGroup and Radio: round radios with arrow-key selection, vertical or horizontal, each in a Label with its text.",
    module: '@/components/ui/radio-group', tag: 'RadioGroup', focusable: true, uses: ['@/components/ui/radio-group|Radio', '@/components/ui/label|Label', '@/components/ui/field|FieldLabel'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Plan', part: '<FieldLabel>' },
      { name: 'items', control: { kind: 'items' }, default: 'Free, Pro, Team', part: '<Radio>s' },
      { name: 'value', control: { kind: 'text' }, default: 'Pro', twoWay: 'onValueChange' },
      { name: 'orientation', control: { kind: 'enum', options: values('vertical', 'horizontal') }, default: 'vertical' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the chosen value' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Labelled label={p.label}>
        <RadioGroup value={str(p.value)} onValueChange={(v) => on.onValueChange?.(v)} orientation={p.orientation === 'horizontal' ? 'horizontal' : 'vertical'} disabled={!!p.disabled} aria-label={p.label ? undefined : 'Options'}>
          {itemsOf(p.items).map((it) => <Label key={it.id} variant="control"><Radio value={it.id} />{it.label}</Label>)}
        </RadioGroup>
      </Labelled>
    ),
    code: (g) => {
      parts(g, '@/components/ui/radio-group', 'RadioGroup', 'Radio');
      g.use('@/components/ui/label', 'Label');
      const radios = listCode(g, 'items', (it, v) => `<Label key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} variant="control"><Radio value={${field(it, v, 'id')}} />{${field(it, v, 'label')}}</Label>`, '\n  ');
      const named = g.text('label') ? '' : ' aria-label="Options"';
      return fieldCode(g, `<RadioGroup${named} value={${g.expr('value')}}${g.on('onValueChange')}${g.attr('orientation')}${g.attr('disabled')}>\n  ${radios}\n</RadioGroup>`);
    },
  },
  Switch: {
    type: 'Switch', title: 'Switch', section: 'Forms and inputs', source: 'kit', icon: 'switch-2',
    description: "iOS switch on UI SDK's Switch: a 51 by 31 track, a thumb that springs across and stretches while pressed. Name it, or put it in a ListRow, which names it.",
    module: '@/components/ui/switch', tag: 'Switch', focusable: true,
    props: [
      { name: 'checked', control: { kind: 'boolean' }, default: true, twoWay: 'onCheckedChange' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Toggle' },
    ],
    events: [{ name: 'onCheckedChange', label: 'onCheckedChange', value: 'checked' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => <Switch checked={!!p.checked} onCheckedChange={(v) => on.onCheckedChange?.(v)} aria-label={str(p['aria-label'], 'Toggle')} />,
  },
  Slider: {
    type: 'Slider', title: 'Slider', section: 'Forms and inputs', source: 'kit', icon: 'sliders',
    description: "UI SDK's Slider with the iOS look: a 4px track, tint fill and 26px thumb, one or two thumbs, plus a translucent overlay look for media (following the scheme, or a fixed appearance) and a small scrubber size.",
    module: '@/components/ui/slider', tag: 'Slider', focusable: true,
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Volume' },
      { name: 'value', control: { kind: 'number' }, default: 50, twoWay: 'onValueChange' },
      { name: 'min', control: { kind: 'number' }, default: 0 },
      { name: 'max', control: { kind: 'number' }, default: 100 },
      { name: 'step', control: { kind: 'number', min: 0.01 }, default: 1 },
      { name: 'showValue', control: { kind: 'boolean' }, default: true },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm') }, default: 'default' },
      { name: 'variant', control: { kind: 'enum', options: values('default', 'overlay') }, default: 'default' },
      { name: 'appearance', control: { kind: 'enum', options: values('auto', 'light', 'dark') }, default: 'auto' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the value' }, { name: 'onValueCommit', label: 'onValueCommit', value: 'the value' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Slider<number>
        label={p.label ? str(p.label) : undefined}
        aria-label={p.label ? undefined : 'Slider'}
        showValue={!!p.showValue}
        value={num(p.value)}
        min={num(p.min)}
        max={num(p.max, 100)}
        step={num(p.step, 1) || 1}
        size={pick(p.size, ['default', 'sm'] as const, 'default')}
        variant={pick(p.variant, ['default', 'overlay'] as const, 'default')}
        appearance={pick(p.appearance, ['auto', 'light', 'dark'] as const, 'auto')}
        onValueChange={(v) => on.onValueChange?.(v)}
        onValueCommit={(v) => on.onValueCommit?.(v)}
      />
    ),
  },
  Segmented: {
    type: 'Segmented', title: 'Segmented', section: 'Forms and inputs', source: 'kit', icon: 'rectangle-split',
    description: "The iOS segmented control on UI SDK's SegmentedControl: a radio group whose selected card slides between segments.",
    module: '@/components/ui/segmented', tag: 'Segmented', focusable: true, uses: ['@/components/ui/segmented|SegmentedItem'],
    props: [
      { name: 'items', control: { kind: 'items' }, default: 'Day, Week, Month', part: '<SegmentedItem>s' },
      { name: 'value', control: { kind: 'text' }, default: 'Day', twoWay: 'onValueChange' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Range' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the segment' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => {
      const items = itemsOf(p.items);
      return (
        <Segmented aria-label={str(p['aria-label'], 'Options')} value={str(p.value, items[0]?.id ?? '')} onValueChange={(v) => v != null && on.onValueChange?.(v)}>
          {items.map((it) => <SegmentedItem key={it.id} value={it.id}>{it.label}</SegmentedItem>)}
        </Segmented>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/segmented', 'Segmented', 'SegmentedItem');
      const items = listCode(g, 'items', (it, v) => `<SegmentedItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} value={${field(it, v, 'id')}}>{${field(it, v, 'label')}}</SegmentedItem>`, '\n  ');
      return `<Segmented aria-label={${g.expr('aria-label')}} value={${g.expr('value')}}${g.on('onValueChange')}>\n  ${items}\n</Segmented>`;
    },
  },
  Select: {
    type: 'Select', title: 'Select', section: 'Forms and inputs', source: 'kit', icon: 'chevron-up-down',
    description: "A pop-up button that opens a list of options: UI SDK's Select with a filled or plain trigger, grouped items and typeahead on the closed button, in a Field with its label.",
    module: '@/components/ui/select', tag: 'Select', focusable: true,
    uses: ['@/components/ui/field|FieldLabel', '@/components/ui/select|SelectTrigger', '@/components/ui/select|SelectContent'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Repeat', part: '<FieldLabel>' },
      { name: 'items', control: { kind: 'items' }, default: 'Never, Every day, Every week, Every month', part: 'items' },
      { name: 'value', control: { kind: 'text' }, default: 'Every week', twoWay: 'onValueChange' },
      { name: 'placeholder', control: { kind: 'text' }, default: 'Choose…' },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm') }, default: 'default', part: '<SelectTrigger size>' },
      { name: 'variant', control: { kind: 'enum', options: values('default', 'plain') }, default: 'default', part: '<SelectTrigger variant>' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the chosen item' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Labelled label={p.label}>
        <Select items={dataItems(p.items)} value={str(p.value) || null} onValueChange={(v) => on.onValueChange?.(v)} placeholder={str(p.placeholder)} disabled={!!p.disabled}>
          <SelectTrigger aria-label={p.label ? undefined : 'Select'} size={pick(p.size, ['default', 'sm'] as const, 'default')} variant={pick(p.variant, ['default', 'plain'] as const, 'default')} />
          <SelectContent />
        </Select>
      </Labelled>
    ),
    code: (g) => {
      parts(g, '@/components/ui/select', 'Select', 'SelectTrigger', 'SelectContent');
      return fieldCode(g, `<Select items={${itemsCode(g, 'items')}} value={${g.expr('value')} || null}${g.on('onValueChange')}${g.attr('placeholder')}${g.attr('disabled')}>\n  <SelectTrigger${g.attr('size')}${g.attr('variant')} />\n  <SelectContent />\n</Select>`);
    },
  },
  Combobox: {
    type: 'Combobox', title: 'Combobox', section: 'Forms and inputs', source: 'kit', icon: 'magnifier',
    description: "UI SDK's Combobox: a text field with a suggestion list. Type to narrow the options, arrow keys to move, Enter to commit, in a Field with its label.",
    module: '@/components/ui/combobox', tag: 'Combobox', focusable: true,
    uses: ['@/components/ui/field|FieldLabel', '@/components/ui/combobox|ComboboxInputGroup', '@/components/ui/combobox|ComboboxInput', '@/components/ui/combobox|ComboboxTrigger', '@/components/ui/combobox|ComboboxContent', '@/components/ui/combobox|ComboboxList'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Assignee', part: '<FieldLabel>' },
      { name: 'items', control: { kind: 'items' }, default: 'Ana Torres, Kim Park, Lee Chen, Maya Okafor', part: 'items' },
      { name: 'value', control: { kind: 'text' }, default: '', twoWay: 'onValueChange' },
      { name: 'placeholder', control: { kind: 'text' }, default: 'Search the team', part: '<ComboboxInput placeholder>' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the chosen item' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Labelled label={p.label}>
        <Combobox items={dataItems(p.items)} value={str(p.value) || null} onValueChange={(v) => on.onValueChange?.(v)}>
          <ComboboxInputGroup>
            <ComboboxInput placeholder={str(p.placeholder)} aria-label={p.label ? undefined : 'Choose'} />
            <ComboboxTrigger />
          </ComboboxInputGroup>
          <ComboboxContent>
            <ComboboxEmpty>No matches.</ComboboxEmpty>
            <ComboboxList />
          </ComboboxContent>
        </Combobox>
      </Labelled>
    ),
    code: (g) => {
      parts(g, '@/components/ui/combobox', 'Combobox', 'ComboboxInputGroup', 'ComboboxInput', 'ComboboxTrigger', 'ComboboxContent', 'ComboboxEmpty', 'ComboboxList');
      return fieldCode(g, `<Combobox items={${itemsCode(g, 'items')}} value={${g.expr('value')} || null}${g.on('onValueChange')}>\n  <ComboboxInputGroup>\n    <ComboboxInput${g.attr('placeholder')} />\n    <ComboboxTrigger />\n  </ComboboxInputGroup>\n  <ComboboxContent>\n    <ComboboxEmpty>No matches.</ComboboxEmpty>\n    <ComboboxList />\n  </ComboboxContent>\n</Combobox>`);
    },
  },
  DateInput: {
    type: 'DateInput', title: 'DateInput', section: 'Forms and inputs', source: 'kit', icon: 'calendar',
    description: "Segmented date and time fields: UI SDK's Date Input and Time Input, each part of the value its own spin button, in the filled iOS field. Values are ISO strings; a Field gives it a label, description and error.",
    module: '@/components/ui/date-input', tag: 'DateInput', focusable: true, uses: ['@/components/ui/field|FieldLabel'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Birthday', part: '<FieldLabel>' },
      { name: 'value', control: { kind: 'date' }, default: '2026-10-04', twoWay: 'onValueChange', help: 'An ISO date' },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm', 'lg') }, default: 'default' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the date (YYYY-MM-DD)' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Labelled label={p.label}>
        <DateInput value={date(p.value)} onValueChange={(v) => on.onValueChange?.(v)} size={pick(p.size, ['default', 'sm', 'lg'] as const, 'default')} disabled={!!p.disabled} aria-label={p.label ? undefined : 'Date'} />
      </Labelled>
    ),
    code: (g) => {
      g.use('@/components/ui/date-input', 'DateInput');
      return fieldCode(g, `<DateInput value={${g.expr('value')}}${g.on('onValueChange')}${g.attr('size')}${g.attr('disabled')} />`);
    },
  },
  DatePicker: {
    type: 'DatePicker', title: 'DatePicker', section: 'Forms and inputs', source: 'kit', icon: 'calendar-fill',
    description: "A date field with a calendar button that opens a Calendar in a popover, for one date or a range (`mode=\"range\"`): UI SDK's Date Picker, composed from a field and a content part.",
    module: '@/components/ui/date-picker', tag: 'DatePicker', focusable: true,
    uses: ['@/components/ui/field|FieldLabel', '@/components/ui/date-picker|DatePickerInputGroup', '@/components/ui/date-picker|DatePickerContent'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Date', part: '<FieldLabel>' },
      { name: 'value', control: { kind: 'date' }, default: '2026-10-04', twoWay: 'onValueChange' },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm', 'lg') }, default: 'default', part: '<DatePickerInputGroup size>' },
      { name: 'disabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the date (YYYY-MM-DD)' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Labelled label={p.label}>
        <DatePicker value={date(p.value)} onValueChange={(v) => on.onValueChange?.(v)} disabled={!!p.disabled} aria-label={p.label ? undefined : 'Date'}>
          <DatePickerInputGroup size={pick(p.size, ['default', 'sm', 'lg'] as const, 'default')} />
          <DatePickerContent />
        </DatePicker>
      </Labelled>
    ),
    code: (g) => {
      parts(g, '@/components/ui/date-picker', 'DatePicker', 'DatePickerInputGroup', 'DatePickerContent');
      return fieldCode(g, `<DatePicker value={${g.expr('value')}}${g.on('onValueChange')}${g.attr('disabled')}>\n  <DatePickerInputGroup${g.attr('size')} />\n  <DatePickerContent />\n</DatePicker>`);
    },
  },
  Calendar: {
    type: 'Calendar', title: 'Calendar', section: 'Forms and inputs', source: 'kit', icon: 'calendar',
    description: "A month calendar, for a date, a range or several dates: UI SDK's Calendar with keyboard navigation, locale week starts, min/max and unavailable dates, drawn as iOS round day cells with a soft band joining a range.",
    module: '@/components/ui/calendar', tag: 'Calendar', focusable: true,
    props: [
      { name: 'value', control: { kind: 'date' }, default: '2026-10-04', twoWay: 'onValueChange' },
      { name: 'variant', control: { kind: 'enum', options: values('plain', 'card') }, default: 'card' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Date' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the date (YYYY-MM-DD)' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => (
      <Calendar aria-label={str(p['aria-label'], 'Date')} variant={pick(p.variant, ['plain', 'card'] as const, 'card')} value={date(p.value)} onValueChange={(v) => on.onValueChange?.(v)} />
    ),
    code: (g) => {
      g.use('@/components/ui/calendar', 'Calendar');
      return `<Calendar aria-label={${g.expr('aria-label')}}${g.attr('variant')} value={${g.expr('value')}}${g.on('onValueChange')} />`;
    },
  },
  ColorPicker: {
    type: 'ColorPicker', title: 'ColorPicker', section: 'Forms and inputs', source: 'kit', icon: 'drop',
    description: "UI SDK's Color Picker: an area, sliders, preset swatches and a hex field in a popup behind a trigger that shows the current color (the root holds the popover). Colors are CSS strings.",
    module: '@/components/ui/color-picker', tag: 'ColorPicker', focusable: true,
    uses: ['@/components/ui/color-picker|ColorPickerTrigger', '@/components/ui/color-picker|ColorPickerContent'],
    props: [
      { name: 'value', control: { kind: 'text' }, default: START_COLOR, twoWay: 'onValueChange', help: 'A hex color' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Color' },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default', part: '<ColorPickerTrigger size>' },
      { name: 'showValue', control: { kind: 'boolean' }, default: true, part: '<ColorPickerTrigger showValue>' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the color (hex)' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <ColorPicker aria-label={str(p['aria-label'], 'Color')} value={str(p.value) || START_COLOR} onValueChange={(c) => on.onValueChange?.(c)}>
        <ColorPickerTrigger size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} showValue={!!p.showValue} />
        <ColorPickerContent />
      </ColorPicker>
    ),
    code: (g) => {
      parts(g, '@/components/ui/color-picker', 'ColorPicker', 'ColorPickerTrigger', 'ColorPickerContent');
      const hide = g.expr('showValue') === 'false' ? ' showValue={false}' : '';
      return `<ColorPicker aria-label={${g.expr('aria-label')}} value={${g.expr('value')}}${g.on('onValueChange')}>\n  <ColorPickerTrigger${g.attr('size')}${hide} />\n  <ColorPickerContent />\n</ColorPicker>`;
    },
  },

  /* ── Menus and overlays ── */
  DropdownMenu: {
    type: 'DropdownMenu', title: 'DropdownMenu', section: 'Menus and overlays', source: 'kit', icon: 'ellipsis-circle',
    description: "An iOS pull-down menu on UI SDK's Menu: rows with trailing icons, descriptions and shortcuts, group bands, checkbox and radio items and submenus. Its trigger renders as a Button.",
    module: '@/components/ui/dropdown-menu', tag: 'DropdownMenu', focusable: true,
    uses: ['@/components/ui/button|Button', '@/components/ui/dropdown-menu|DropdownMenuTrigger', '@/components/ui/dropdown-menu|DropdownMenuContent', '@/components/ui/dropdown-menu|DropdownMenuItem'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Sort', part: '<DropdownMenuTrigger render={<Button />}>' },
      { name: 'variant', control: { kind: 'enum', options: values(...BUTTON_VARIANTS) }, default: 'secondary', part: '<Button variant>' },
      { name: 'size', control: { kind: 'enum', options: values(...BUTTON_SIZES) }, default: 'sm', part: '<Button size>' },
      { name: 'icon', control: { kind: 'icon' }, default: 'chevron-down', part: '<Icon> in the trigger' },
      { name: 'items', control: { kind: 'items', icons: true }, default: 'Name:textformat, Date added:calendar, Water needs:drop', part: '<DropdownMenuItem>s' },
    ],
    events: [{ name: 'onAction', label: 'onAction', value: 'the chosen item' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => {
      const size = pick(p.size, BUTTON_SIZES, 'sm');
      return (
        <DropdownMenu onAction={(v) => on.onAction?.(v)}>
          <DropdownMenuTrigger render={<Button variant={pick(p.variant, BUTTON_VARIANTS, 'secondary')} size={size} aria-label={size.startsWith('icon') ? str(p.label) : undefined} />}>
            {size.startsWith('icon') ? null : str(p.label)}
            {p.icon ? <Icon name={str(p.icon)} size={14} sw={2.2} /> : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {itemsOf(p.items).map((it) => <DropdownMenuItem key={it.id} value={it.id} icon={it.icon ? <Icon name={it.icon} size={16} sw={2} /> : undefined}>{it.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/dropdown-menu', 'DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem');
      g.use('@/components/ui/button', 'Button');
      g.use('@/lib/icon', 'Icon');
      const items = listCode(g, 'items', (it, v) => {
        const icon = field(it, v, 'icon');
        return `<DropdownMenuItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} value={${field(it, v, 'id')}}${icon === 'undefined' ? '' : ` icon={<Icon name={${icon}} size={16} sw={2} />}`}>{${field(it, v, 'label')}}</DropdownMenuItem>`;
      }, '\n    ');
      const icon = g.attr('icon', 'name');
      return `<DropdownMenu${g.on('onAction')}>\n  <DropdownMenuTrigger render={<Button${g.attr('variant')}${g.attr('size')} />}>{${g.expr('label')}}${icon ? `<Icon${icon} size={14} sw={2.2} />` : ''}</DropdownMenuTrigger>\n  <DropdownMenuContent>\n    ${items}\n  </DropdownMenuContent>\n</DropdownMenu>`;
    },
  },
  Tooltip: {
    type: 'Tooltip', title: 'Tooltip', section: 'Menus and overlays', source: 'kit', icon: 'text-bubble',
    description: "A small inverted label that names a control on hover or keyboard focus, with a warm-up delay and an arrow toward the trigger; touch never opens it. UI SDK's Tooltip: a root, a trigger part around the control and the content.",
    module: '@/components/ui/tooltip', tag: 'Tooltip', uses: ['@/components/ui/tooltip|TooltipTrigger', '@/components/ui/tooltip|TooltipContent'], container: 'component',
    props: [
      { name: 'text', control: { kind: 'text' }, default: 'Add a plant', part: '<TooltipContent> children' },
      { name: 'side', control: { kind: 'enum', options: values(...SIDES) }, default: 'top', part: '<TooltipContent side>' },
    ],
    events: [],
    layout: { axis: 'vertical', width: 'fit' },
    make: () => ({ children: [leaf('Button', { children: 'Hover me', variant: 'secondary', size: 'default', disabled: false, icon: null }, { layout: { width: 'fit' } })] }),
    render: ({ node, p, children }) => (
      <Tooltip>
        <SlotTrigger part={TooltipTrigger as TriggerPart} nodes={node.children}>{children}</SlotTrigger>
        <TooltipContent side={pick(p.side, SIDES, 'top')}>{str(p.text)}</TooltipContent>
      </Tooltip>
    ),
    code: (g) => {
      parts(g, '@/components/ui/tooltip', 'Tooltip', 'TooltipTrigger', 'TooltipContent');
      return `<Tooltip>\n${indent2(g.trigger('TooltipTrigger'))}\n  <TooltipContent${g.attr('side')}>${g.text('text')}</TooltipContent>\n</Tooltip>`;
    },
  },
  Popover: {
    type: 'Popover', title: 'Popover', section: 'Menus and overlays', source: 'kit', icon: 'bubble',
    description: "A floating panel anchored to a trigger, on UI SDK's Popover: a root, a PopoverTrigger that is (or holds) what opens it, and PopoverContent, a padded panel for arbitrary content, named by its trigger or by a PopoverTitle.",
    module: '@/components/ui/popover', tag: 'Popover', uses: ['@/components/ui/popover|PopoverTrigger', '@/components/ui/popover|PopoverContent'], container: 'component',
    slots: [{ name: 'trigger', label: 'Trigger' }],
    props: [
      { name: 'side', control: { kind: 'enum', options: values(...SIDES) }, default: 'bottom', part: '<PopoverContent side>' },
      { name: 'align', control: { kind: 'enum', options: values(...ALIGNS) }, default: 'center', part: '<PopoverContent align>' },
      { name: 'title', control: { kind: 'text' }, default: '', part: '<PopoverTitle> children', help: 'A heading that names the popover (else its trigger names it)' },
    ],
    events: [],
    layout: { axis: 'vertical', gap: 8, width: 'fit' },
    make: () => ({
      slots: { trigger: [leaf('Button', { children: 'Details', variant: 'secondary', size: 'sm', disabled: false, icon: null }, { layout: { width: 'fit' } })] },
      children: [leaf('Text', { children: 'Popover content: anything you put here.', textStyle: 'subhead', weight: 'default', color: null, align: 'left', lines: 0 }, { layout: { width: 'fill' } })],
    }),
    render: ({ node, p, children, slots, box }) => (
      <Popover>
        <SlotTrigger part={PopoverTrigger as TriggerPart} nodes={node.slots?.trigger}>{slots.trigger}</SlotTrigger>
        <PopoverContent side={pick(p.side, SIDES, 'bottom')} align={pick(p.align, ALIGNS, 'center')}>
          {p.title ? <PopoverTitle>{str(p.title)}</PopoverTitle> : null}
          <div style={box}>{children}</div>
        </PopoverContent>
      </Popover>
    ),
    code: (g) => {
      parts(g, '@/components/ui/popover', 'Popover', 'PopoverTrigger', 'PopoverContent');
      const title = g.text('title');
      if (title) g.use('@/components/ui/popover', 'PopoverTitle');
      const content = [...(title ? [`<PopoverTitle>${title}</PopoverTitle>`] : []), ...g.children].map((k) => nest(nest(k))).join('\n    ');
      return `<Popover>\n${indent2(g.trigger('PopoverTrigger', 'trigger'))}\n  <PopoverContent${g.attr('side')}${g.attr('align')}>\n    ${content}\n  </PopoverContent>\n</Popover>`;
    },
  },

  /* ── Feedback and status ── */
  Progress: {
    type: 'Progress', title: 'Progress', section: 'Feedback and status', source: 'kit', icon: 'line-3-horizontal',
    description: "iOS progress bar on UI SDK's Progress: a label, a springing fill with a rolling percentage, three sizes, tones and an indeterminate sliding bar (no value).",
    module: '@/components/ui/progress', tag: 'Progress',
    props: [
      { name: 'value', control: { kind: 'number', min: 0, max: 100, step: 1 }, default: 60 },
      { name: 'label', control: { kind: 'text' }, default: 'Uploading' },
      { name: 'showValue', control: { kind: 'boolean' }, default: true },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default' },
      { name: 'tone', control: { kind: 'enum', options: values('default', 'success', 'destructive') }, default: 'default' },
      { name: 'indeterminate', control: { kind: 'boolean' }, default: false, part: 'value={null}' },
    ],
    events: [],
    layout: { width: 'fill' },
    render: ({ p }) => (
      <Progress value={p.indeterminate ? null : num(p.value)} label={p.label ? str(p.label) : undefined} aria-label={p.label ? undefined : 'Progress'} showValue={!!p.showValue}
        size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} tone={pick(p.tone, ['default', 'success', 'destructive'] as const, 'default')} />
    ),
    code: (g) => {
      g.use('@/components/ui/progress', 'Progress');
      const value = g.expr('indeterminate') === 'true' ? 'null' : g.expr('value');
      return `<Progress value={${value}}${g.attr('label')}${g.expr('showValue') === 'true' ? ' showValue' : ''}${g.attr('size')}${g.attr('tone')} />`;
    },
  },
  ProgressRing: {
    type: 'ProgressRing', title: 'ProgressRing', section: 'Feedback and status', source: 'kit', icon: 'circle',
    description: 'Circular progress: a determinate ring that springs to each value with a rolling percentage, and a CountdownRing that drains second by second and turns red near the end.',
    module: '@/components/ui/progress-ring', tag: 'ProgressRing',
    props: [
      { name: 'value', control: { kind: 'number', min: 0, max: 100, step: 1 }, default: 72 },
      { name: 'size', control: { kind: 'number', min: 16, max: 200, step: 1, unit: 'px' }, default: 56 },
      { name: 'showValue', control: { kind: 'boolean' }, default: true },
      { name: 'tone', control: { kind: 'enum', options: values('default', 'success', 'warning', 'destructive') }, default: 'default' },
      { name: 'indeterminate', control: { kind: 'boolean' }, default: false, part: 'value={null}' },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => (
      <ProgressRing value={p.indeterminate ? null : num(p.value)} size={num(p.size, 56)} showValue={!!p.showValue} tone={pick(p.tone, ['default', 'success', 'warning', 'destructive'] as const, 'default')} aria-label="Progress" />
    ),
    code: (g) => {
      g.use('@/components/ui/progress-ring', 'ProgressRing');
      const value = g.expr('indeterminate') === 'true' ? 'null' : g.expr('value');
      return `<ProgressRing value={${value}} size={${g.expr('size')}}${g.expr('showValue') === 'true' ? ' showValue' : ''}${g.attr('tone')} aria-label="Progress" />`;
    },
  },
  ProgressStepper: {
    type: 'ProgressStepper', title: 'ProgressStepper', section: 'Feedback and status', source: 'kit', icon: 'checklist',
    description: 'A row of milestones for a multi-step process, as filling bars or a joined line, with complete, current and upcoming states.',
    module: '@/components/ui/progress-stepper', tag: 'ProgressStepper',
    props: [
      { name: 'steps', control: { kind: 'items', icons: true }, default: 'Cart:cart, Address:house, Payment:wallet, Done:checkmark' },
      { name: 'current', control: { kind: 'number', min: 0, max: 20, step: 1 }, default: 1 },
      { name: 'variant', control: { kind: 'enum', options: values('bars', 'line') }, default: 'bars' },
      { name: 'labels', control: { kind: 'boolean' }, default: true },
      { name: 'animated', control: { kind: 'boolean' }, default: true },
    ],
    events: [],
    layout: { width: 'fill' },
    render: ({ p }) => (
      <ProgressStepper
        steps={itemsOf(p.steps).map((s) => ({ id: s.id, label: s.label, icon: s.icon ? <Icon name={s.icon} size={16} sw={2} /> : undefined }))}
        current={num(p.current)}
        variant={pick(p.variant, ['bars', 'line'] as const, 'bars')}
        labels={!!p.labels}
        animated={!!p.animated}
      />
    ),
    code: (g) => {
      g.use('@/components/ui/progress-stepper', 'ProgressStepper');
      const items = g.list('steps');
      if (items?.some((s) => s.icon)) g.use('@/lib/icon', 'Icon');
      const steps = items
        ? `[${items.map((s) => `{ id: ${q(s.id)}, label: ${q(s.label)}${s.icon ? `, icon: <Icon name=${JSON.stringify(s.icon)} size={16} sw={2} />` : ''} }`).join(', ')}]`
        : `${g.expr('steps')}.map((s) => ({ id: s.id ?? s, label: s.label ?? s }))`;
      return `<ProgressStepper steps={${steps}} current={${g.expr('current')}}${g.attr('variant')} labels={${g.expr('labels')}} animated={${g.expr('animated')}} />`;
    },
  },
  Spinner: {
    type: 'Spinner', title: 'Spinner', section: 'Feedback and status', source: 'kit', icon: 'arrow-clockwise',
    description: 'Loading indicators: the iOS activity indicator (eight fading spokes in discrete steps, the default) and twenty-two CSS loaders with three patterns each. They draw in currentColor, scale to any size, take a speed, animate unless paused, pause themselves off screen, and hold still under reduced motion.',
    module: '@/components/ui/spinner', tag: 'Spinner',
    props: [
      { name: 'animation', control: { kind: 'enum', options: values(...SPINNERS) }, default: 'ios' },
      { name: 'size', control: { kind: 'number', min: 12, max: 160, step: 1, unit: 'px' }, default: 28 },
      { name: 'speed', control: { kind: 'number', min: 0.25, max: 3, step: 0.05 }, default: 1 },
      { name: 'paused', control: { kind: 'boolean' }, default: false },
      { name: 'label', control: { kind: 'text' }, default: 'Loading' },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => <Spinner animation={pick(p.animation, SPINNERS, 'ios') as SpinnerAnimation} size={num(p.size, 28)} speed={num(p.speed, 1)} paused={!!p.paused} label={p.label ? str(p.label) : undefined} />,
  },
  Skeleton: {
    type: 'Skeleton', title: 'Skeleton', section: 'Feedback and status', source: 'kit', icon: 'rectangle-split',
    description: 'Loading placeholders with a soft left-to-right sweep instead of a pulse: text lines, circles, rects and rounded blocks, and a SkeletonText paragraph with a shorter last line.',
    module: '@/components/ui/skeleton', tag: 'Skeleton',
    props: [{ name: 'shape', control: { kind: 'enum', options: values('default', 'rect', 'text', 'circle') }, default: 'default' }],
    events: [],
    layout: { width: 'fill', height: 64 },
    render: ({ p }) => <Skeleton shape={pick(p.shape, ['default', 'rect', 'text', 'circle'] as const, 'default')} className="size-full" />,
  },
  Badge: {
    type: 'Badge', title: 'Badge', section: 'Feedback and status', source: 'kit', icon: 'tag',
    description: 'A small iOS capsule for a status, count or tag, in default, secondary, tinted, outline, destructive and success variants.',
    module: '@/components/ui/badge', tag: 'Badge',
    props: [
      text('children', 'New'),
      { name: 'variant', control: { kind: 'enum', options: values('default', 'secondary', 'tinted', 'outline', 'destructive', 'success') }, default: 'default' },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => <Badge variant={pick(p.variant, ['default', 'secondary', 'tinted', 'outline', 'destructive', 'success'] as const, 'default')}>{str(p.children)}</Badge>,
  },
  NowPlayingBars: {
    type: 'NowPlayingBars', title: 'NowPlayingBars', section: 'Feedback and status', source: 'kit', icon: 'waveform',
    description: "The animated equaliser beside the track that's playing — still when paused and under reduced motion.",
    module: '@/components/ui/now-playing-bars', tag: 'NowPlayingBars',
    props: [
      { name: 'playing', control: { kind: 'boolean' }, default: true },
      { name: 'bars', control: { kind: 'number', min: 2, max: 8, step: 1 }, default: 4 },
      { name: 'size', control: { kind: 'number', min: 8, max: 64, step: 1, unit: 'px' }, default: 16 },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => <span className="text-primary"><NowPlayingBars playing={!!p.playing} bars={num(p.bars, 4)} size={num(p.size, 16)} aria-label="Now playing" /></span>,
  },

  /* ── Lists and content ── */
  List: {
    type: 'List', title: 'List', section: 'Lists and content', source: 'kit', icon: 'list',
    description: 'Inset-grouped and plain lists with rows, sections, swipe actions and an A-Z IndexBar.',
    module: '@/components/ui/list', tag: 'List', container: 'component',
    props: [{ name: 'variant', control: { kind: 'enum', options: values('plain', 'inset') }, default: 'plain' }],
    events: [],
    layout: { axis: 'vertical', width: 'fill' },
    make: () => ({ children: [listSection('Section', ['First', 'Second', 'Third'])] }),
    render: ({ p, children }) => <List variant={pick(p.variant, ['plain', 'inset'] as const, 'plain')}>{children}</List>,
  },
  ListSection: {
    type: 'ListSection', title: 'ListSection', section: 'Lists and content', source: 'kit', icon: 'list',
    description: 'A section of an inset-grouped list: an optional header and footer around rounded rows. Repeat a row over an array for a prototype cell.',
    module: '@/components/ui/list', tag: 'ListSection', container: 'component',
    props: [
      { name: 'title', control: { kind: 'text' }, default: '' },
      { name: 'footer', control: { kind: 'text' }, default: '' },
    ],
    events: [],
    layout: { axis: 'vertical', width: 'fill' },
    make: () => ({ children: listSection('', ['First', 'Second']).children }),
    render: ({ p, children }) => <ListSection title={p.title ? str(p.title) : undefined} footer={p.footer ? str(p.footer) : undefined} className="[&>div:last-child]:h-0">{children}</ListSection>,
  },
  ListRow: {
    type: 'ListRow', title: 'ListRow', section: 'Lists and content', source: 'kit', icon: 'line-3-horizontal', focusable: true,
    description: 'A row: an icon, a title, a description, a trailing value and an accessory (chevron or check); swipe actions; pressable when it has an onClick.',
    module: '@/components/ui/list', tag: 'ListRow',
    slots: [{ name: 'icon', label: 'icon' }, { name: 'accessory', label: 'accessory (a control)' }],
    props: [
      { name: 'title', control: { kind: 'text' }, default: 'Title' },
      { name: 'description', control: { kind: 'text' }, default: '' },
      { name: 'trailing', control: { kind: 'text' }, default: '' },
      { name: 'accessory', control: { kind: 'enum', options: values('none', 'chevron', 'check') }, default: 'chevron' },
      { name: 'checked', control: { kind: 'boolean' }, default: false },
      { name: 'tone', control: { kind: 'enum', options: values('default', 'destructive') }, default: 'default' },
    ],
    events: [{ name: 'onClick', label: 'onClick' }],
    layout: { width: 'fill' },
    wrapperClass: '[&:last-child_[data-slot=list-row-content]]:[box-shadow:none]',
    render: ({ p, on, wired, slots }) => (
      <ListRow
        title={str(p.title)}
        description={p.description ? str(p.description) : undefined}
        trailing={p.trailing ? str(p.trailing) : undefined}
        accessory={slots.accessory ?? (p.accessory === 'chevron' || p.accessory === 'check' ? p.accessory : undefined)}
        checked={!!p.checked}
        tone={p.tone === 'destructive' ? 'destructive' : undefined}
        icon={slots.icon}
        onClick={wired('onClick') ? () => on.onClick?.() : undefined}
      />
    ),
  },
  Card: {
    type: 'Card', title: 'Card', section: 'Lists and content', source: 'kit', icon: 'square-on-square',
    description: 'An inset-grouped panel with header, title, description, content and footer parts, in default, elevated and outline variants.',
    module: '@/components/ui/card', tag: 'Card', container: 'component',
    props: [{ name: 'variant', control: { kind: 'enum', options: values('default', 'elevated', 'outline') }, default: 'elevated' }],
    events: [],
    layout: { axis: 'vertical', gap: 0, width: 'fill' },
    make: () => ({
      children: [
        leaf('CardHeader', {}, { layout: { axis: 'vertical', width: 'fill' }, children: [leaf('CardTitle', { children: 'Card title' }), leaf('CardDescription', { children: 'A short description.' })] }),
        leaf('CardContent', {}, { layout: { axis: 'vertical', gap: 8, width: 'fill' }, children: [] }),
      ],
    }),
    render: ({ p, children, box }) => <Card variant={pick(p.variant, ['default', 'elevated', 'outline'] as const, 'elevated')} style={box}>{children}</Card>,
  },
  CardHeader: {
    type: 'CardHeader', title: 'CardHeader', section: 'Lists and content', source: 'kit', icon: 'square-on-square',
    description: "A card's header: its title and description.", module: '@/components/ui/card', tag: 'CardHeader', container: 'component',
    props: [], events: [], layout: { axis: 'vertical', width: 'fill' },
    render: ({ children, box }) => <CardHeader style={box}>{children}</CardHeader>,
  },
  CardTitle: {
    type: 'CardTitle', title: 'CardTitle', section: 'Lists and content', source: 'kit', icon: 'textformat',
    description: "A card's title.", module: '@/components/ui/card', tag: 'CardTitle',
    props: [text('children', 'Card title')], events: [], layout: { width: 'fill' },
    render: ({ p }) => <CardTitle>{str(p.children)}</CardTitle>,
  },
  CardDescription: {
    type: 'CardDescription', title: 'CardDescription', section: 'Lists and content', source: 'kit', icon: 'textformat',
    description: "A card's description, under its title.", module: '@/components/ui/card', tag: 'CardDescription',
    props: [text('children', 'A short description.')], events: [], layout: { width: 'fill' },
    render: ({ p }) => <CardDescription>{str(p.children)}</CardDescription>,
  },
  CardContent: {
    type: 'CardContent', title: 'CardContent', section: 'Lists and content', source: 'kit', icon: 'square-on-square',
    description: "A card's body: it takes its own layout.", module: '@/components/ui/card', tag: 'CardContent', container: 'component',
    props: [], events: [], layout: { axis: 'vertical', gap: 8, width: 'fill' },
    render: ({ children, box }) => <CardContent style={box}>{children}</CardContent>,
  },
  CardFooter: {
    type: 'CardFooter', title: 'CardFooter', section: 'Lists and content', source: 'kit', icon: 'square-on-square',
    description: "A card's footer: a row of actions.", module: '@/components/ui/card', tag: 'CardFooter', container: 'component',
    props: [], events: [], layout: { axis: 'horizontal', gap: 8, width: 'fill' },
    render: ({ children, box }) => <CardFooter style={box}>{children}</CardFooter>,
  },
  Avatar: {
    type: 'Avatar', title: 'Avatar', section: 'Lists and content', source: 'kit', icon: 'person-bust',
    description: 'An avatar of initials on a name-derived gradient, an image, or a glyph, with a presence dot.',
    module: '@/components/ui/avatar', tag: 'Avatar',
    props: [
      { name: 'name', control: { kind: 'text' }, default: 'Ada Lovelace' },
      { name: 'size', control: { kind: 'number', min: 16, max: 160, step: 1, unit: 'px' }, default: 40 },
      { name: 'status', control: { kind: 'enum', options: values('none', 'online', 'idle', 'dnd', 'offline') }, default: 'none' },
      { name: 'tint', control: { kind: 'color' }, default: null },
      { name: 'src', control: { kind: 'text', placeholder: 'https://…' }, default: '' },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => (
      <Avatar name={str(p.name)} size={num(p.size, 40)} status={p.status && p.status !== 'none' ? (p.status as AvatarStatus) : undefined} tint={cssColor(p.tint as string | null)} src={p.src ? str(p.src) : undefined} />
    ),
  },
  AvatarGroup: {
    type: 'AvatarGroup', title: 'AvatarGroup', section: 'Lists and content', source: 'kit', icon: 'people',
    description: 'Overlapping avatars; past max the rest fold into a +N bubble, and with menu on, pressing the group opens a menu of everyone.',
    module: '@/components/ui/avatar-group', tag: 'AvatarGroup', container: 'component',
    props: [
      { name: 'size', control: { kind: 'number', min: 16, max: 96, step: 1, unit: 'px' }, default: 32 },
      { name: 'max', control: { kind: 'number', min: 1, max: 12, step: 1 }, default: 4 },
      { name: 'menu', control: { kind: 'boolean' }, default: false },
      { name: 'aria-label', control: { kind: 'text' }, default: 'People' },
    ],
    events: [{ name: 'onAction', label: 'onAction', value: 'the chosen avatar' }],
    layout: { axis: 'horizontal', width: 'fit' },
    make: () => ({ children: ['Ada', 'Miles', 'Noor', 'Theo', 'Hana', 'June'].map((name) => leaf('Avatar', { name, size: 32, status: 'none', tint: null, src: '' }, { layout: { width: 'fit' } })) }),
    render: ({ p, on, childList }) => (
      <AvatarGroup size={num(p.size, 32)} max={num(p.max, 4)} menu={!!p.menu} aria-label={str(p['aria-label'])} onAction={(value) => on.onAction?.(value)}>
        {childList}
      </AvatarGroup>
    ),
  },
  Disclosure: {
    type: 'Disclosure', title: 'Disclosure', section: 'Lists and content', source: 'kit', icon: 'chevron-down',
    description: "Expandable sections on UI SDK's Collapsible and Accordion: a Disclosure with a trigger and an animated panel, grouped into an accordion.",
    module: '@/components/ui/disclosure', tag: 'Disclosure', container: 'component', focusable: true,
    uses: ['@/components/ui/disclosure|DisclosureTrigger', '@/components/ui/disclosure|DisclosurePanel'],
    props: [
      { name: 'title', control: { kind: 'text' }, default: 'When am I billed?', part: '<DisclosureTrigger>' },
      { name: 'open', control: { kind: 'boolean' }, default: true, twoWay: 'onOpenChange' },
    ],
    events: [{ name: 'onOpenChange', label: 'onOpenChange', value: 'open' }],
    layout: { axis: 'vertical', gap: 8, width: 'fill' },
    make: () => ({ children: [leaf('Text', { children: 'On the same day each month you subscribed.', textStyle: 'subhead', weight: 'default', color: '$muted-foreground', align: 'left', lines: 0 }, { layout: { width: 'fill' } })] }),
    render: ({ p, on, children, box }) => (
      <Disclosure open={!!p.open} onOpenChange={(v) => on.onOpenChange?.(v)}>
        <DisclosureTrigger>{str(p.title)}</DisclosureTrigger>
        <DisclosurePanel><div style={box}>{children}</div></DisclosurePanel>
      </Disclosure>
    ),
  },
  Separator: {
    type: 'Separator', title: 'Separator', section: 'Lists and content', source: 'kit', icon: 'minus',
    description: 'A hairline rule, horizontal or vertical, with an inset option that indents like an iOS list separator.',
    module: '@/components/ui/separator', tag: 'Separator',
    props: [
      { name: 'orientation', control: { kind: 'enum', options: values('horizontal', 'vertical') }, default: 'horizontal' },
      { name: 'inset', control: { kind: 'boolean' }, default: false },
    ],
    events: [],
    layout: { width: 'fill' },
    render: ({ p }) => <Separator orientation={p.orientation === 'vertical' ? 'vertical' : 'horizontal'} inset={!!p.inset} />,
  },
  Kbd: {
    type: 'Kbd', title: 'Kbd', section: 'Lists and content', source: 'kit', icon: 'keyboard',
    description: "A keycap for keyboard shortcuts, with a group wrapper for chords; `keys=\"mod+k\"` draws a shortcut for the platform (in a menu, use the item's `shortcut`).",
    module: '@/components/ui/kbd', tag: 'Kbd',
    props: [text('children', '⌘K')], events: [], layout: { width: 'fit' },
    render: ({ p }) => <Kbd>{str(p.children)}</Kbd>,
  },
  QRCode: {
    type: 'QRCode', title: 'QRCode', section: 'Lists and content', source: 'kit', icon: 'qrcode',
    description: 'A real, scannable QR code rendered as SVG paths, with rounded or square modules, four error-correction levels and any colors.',
    module: '@/components/ui/qr-code', tag: 'QRCode',
    props: [
      { name: 'value', control: { kind: 'text' }, default: 'https://blamy.github.io/ui/' },
      { name: 'size', control: { kind: 'number', min: 48, max: 400, step: 1, unit: 'px' }, default: 140 },
      { name: 'level', control: { kind: 'enum', options: values('L', 'M', 'Q', 'H') }, default: 'M' },
      { name: 'margin', control: { kind: 'number', min: 0, max: 8, step: 1 }, default: 1 },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => <QRCode value={str(p.value)} size={num(p.size, 140)} level={pick(p.level, ['L', 'M', 'Q', 'H'] as const, 'M')} margin={num(p.margin, 1)} />,
  },

  /* ── Navigation and layout ── */
  Screen: {
    type: 'Screen', title: 'Screen', section: 'Navigation and layout', source: 'kit', icon: 'iphone',
    description: "A NavigationStack screen (the kit's Screen): its title, large title, grouped background and bar items, over its content. A scene's root: inside a NavigationStack the stack draws its bar; on its own it's just the content.",
    module: '@/components/ui/navigation-stack', tag: 'Screen', container: 'frame',
    slots: [{ name: 'leading', label: 'leading' }, { name: 'trailing', label: 'trailing' }],
    props: [
      { name: 'title', control: { kind: 'text' }, default: 'Title' },
      { name: 'largeTitle', control: { kind: 'boolean' }, default: true },
      { name: 'grouped', control: { kind: 'boolean' }, default: false, help: 'The grouped (muted) background, for inset lists' },
      { name: 'maxWidth', label: 'readable width', control: { kind: 'number', min: 0, max: 2400, step: 10, unit: 'px' }, default: 720, part: 'maxW', help: 'On a wide screen the content centers at this width (0: the full width)' },
    ],
    events: [],
    layout: { axis: 'vertical', gap: 16, padding: [8, 16, 24, 16], align: 'start', distribute: 'start', width: 'fill', height: 'fill', overflow: 'scroll' },
    render: ({ children }) => children,
  },
  NavigationStack: {
    type: 'NavigationStack', title: 'NavigationStack', section: 'Navigation and layout', source: 'kit', icon: 'chevron-left',
    description: 'A controlled push/pop stack with large titles and edge-swipe back. Its child is the root screen (embed a scene with a Screen root); a push segue from any scene inside it pushes onto it, with the kit’s spring, bar and back button.',
    module: '@/components/ui/navigation-stack', tag: 'NavigationStack', container: 'component', screen: true,
    props: [
      { name: 'title', control: { kind: 'text' }, default: 'Title', part: 'screens[0].title', help: 'When its child isn’t a scene' },
      { name: 'largeTitle', control: { kind: 'boolean' }, default: true, part: 'screens[0].largeTitle' },
      { name: 'grouped', control: { kind: 'boolean' }, default: false, part: 'screens[0].grouped' },
      { name: 'maxWidth', label: 'readable width', control: { kind: 'number', min: 0, max: 2400, step: 10, unit: 'px' }, default: 720, part: 'screens[0].maxW', help: 'When its child isn’t a scene: on a wide screen the content centers at this width (0: the full width)' },
    ],
    events: [],
    layout: { axis: 'vertical', gap: 16, padding: [8, 16, 24, 16], align: 'start', width: 'fill', height: 'fill' },
    render: (r) => <NavStackHost r={r} />,
  },
  TabsScreen: {
    type: 'TabsScreen', title: 'TabsScreen', section: 'Navigation and layout', source: 'kit', icon: 'square-on-square',
    description: 'A screen of tabs, on the kit’s Tabs: the iOS tab bar at the bottom on a compact screen and a side rail on a wider one, one panel per child (an embedded scene, usually a NavigationStack). Each tab keeps its state while another shows.',
    module: '@/components/ui/tabs', tag: 'Tabs', container: 'component', screen: true,
    uses: ['@/components/ui/tabs|TabsBar', '@/components/ui/tabs|TabsList', '@/components/ui/tabs|TabsTab', '@/components/ui/tabs|TabsPanels', '@/components/ui/tabs|TabsPanel'],
    props: [
      { name: 'tabs', control: { kind: 'items', icons: true }, default: 'First:star, Second:circle', part: '<TabsTab>s', help: 'One per child, in order: Title:icon' },
      { name: 'value', label: 'selected', control: { kind: 'text' }, default: 'First', twoWay: 'onValueChange' },
      { name: 'side', control: { kind: 'enum', options: values('auto', 'bottom', 'start', 'top') }, default: 'auto', help: 'auto: a tab bar along the bottom when compact, a side rail from 700px, from its own size class' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the tab' }],
    layout: { axis: 'vertical', width: 'fill', height: 'fill' },
    render: (r) => <TabsScreenHost r={r} />,
  },
  SplitView: {
    type: 'SplitView', title: 'SplitView', section: 'Navigation and layout', source: 'kit', icon: 'sidebar-left',
    description: 'UISplitViewController, as composable parts: sidebar, supplementary and detail columns that tile when there’s room and collapse into a stack (with back buttons) on a narrow device. A Show Detail segue puts its scene in the detail column.',
    module: '@/components/ui/split-view', tag: 'SplitView', screen: true,
    uses: ['@/components/ui/split-view|SplitViewSidebar', '@/components/ui/split-view|SplitViewSupplementary', '@/components/ui/split-view|SplitViewDetail'],
    slots: [{ name: 'sidebar', label: 'sidebar' }, { name: 'supplementary', label: 'supplementary' }, { name: 'detail', label: 'detail' }],
    props: [
      { name: 'sizeClass', control: { kind: 'enum', options: values('auto', 'compact', 'medium', 'regular') }, default: 'auto', help: 'auto: from its own width' },
      { name: 'sidebarBehavior', control: { kind: 'enum', options: values('auto', 'tile', 'overlay', 'displace') }, default: 'auto' },
    ],
    events: [],
    layout: { width: 'fill', height: 'fill' },
    render: (r) => <SplitViewHost r={r} />,
  },
  Breadcrumb: {
    type: 'Breadcrumb', title: 'Breadcrumb', section: 'Navigation and layout', source: 'kit', icon: 'chevron-right',
    description: "The path to the current page: every item pressable, siblings in a menu like VS Code's, and the middle collapsing into a … menu when the trail does not fit.",
    module: '@/components/ui/breadcrumb', tag: 'Breadcrumb',
    props: [
      { name: 'items', control: { kind: 'items', icons: true }, default: 'Home:house, Garden, Monstera' },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default' },
    ],
    events: [{ name: 'onClick', label: 'onClick (an item)', value: 'the item' }],
    layout: { width: 'fill' },
    render: ({ p, on, wired }) => (
      <Breadcrumb size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} items={itemsOf(p.items).map((it, i, all) => ({
        value: it.id, label: it.label, icon: it.icon, ...(i < all.length - 1 && wired('onClick') ? { onClick: () => on.onClick?.(it.id) } : null),
      }))} />
    ),
    code: (g) => {
      g.use('@/components/ui/breadcrumb', 'Breadcrumb');
      const press = g.handler('onClick');
      const items = g.list('items');
      const list = items
        ? `[${items.map((it, i) => `{ value: ${q(it.id)}, label: ${q(it.label)}${it.icon ? `, icon: ${q(it.icon)}` : ''}${press && i < items.length - 1 ? `, onClick: () => (${press})(${q(it.id)})` : ''} }`).join(', ')}]`
        : g.expr('items');
      return `<Breadcrumb${g.attr('size')} items={${list}} />`;
    },
  },
  Tabs: {
    type: 'Tabs', title: 'Tabs', section: 'Navigation and layout', source: 'kit', icon: 'rectangle-split',
    description: "UI SDK's Tabs with a sliding selection indicator and directional panels, in an iOS segmented look or a tinted underline. Each child is the panel of the tab at its place.",
    module: '@/components/ui/tabs', tag: 'Tabs', container: 'component', focusable: true,
    uses: ['@/components/ui/tabs|TabsList', '@/components/ui/tabs|TabsTab', '@/components/ui/tabs|TabsPanel'],
    props: [
      { name: 'tabs', control: { kind: 'items' }, default: 'Plan, Build, Review', part: '<TabsTab>s' },
      { name: 'value', label: 'selected', control: { kind: 'text' }, default: 'Plan', twoWay: 'onValueChange' },
      { name: 'variant', control: { kind: 'enum', options: values('segmented', 'underline') }, default: 'segmented' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the tab' }],
    layout: { axis: 'vertical', width: 'fill' },
    make: () => ({ children: ['Plan', 'Build', 'Review'].map((t) => leaf('Stack', {}, { layout: { axis: 'vertical', gap: 8, padding: 4, width: 'fill' }, children: [leaf('Text', { children: `${t} panel`, textStyle: 'subhead', weight: 'default', color: '$muted-foreground', align: 'left', lines: 0 }, { layout: { width: 'fill' } })] })) }),
    render: ({ p, on, childList }) => {
      const tabs = itemsOf(p.tabs);
      return (
        <Tabs variant={pick(p.variant, ['segmented', 'underline'] as const, 'segmented')} value={str(p.value, tabs[0]?.id)} onValueChange={(k) => k != null && on.onValueChange?.(k)}>
          <TabsList aria-label="Tabs">{tabs.map((t) => <TabsTab key={t.id} value={t.id}>{t.label}</TabsTab>)}</TabsList>
          {tabs.map((t, i) => <TabsPanel key={t.id} value={t.id}>{childList[i] ?? null}</TabsPanel>)}
        </Tabs>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/tabs', 'Tabs', 'TabsList', 'TabsTab', 'TabsPanel');
      const tabs = g.list('tabs') ?? [];
      return `<Tabs${g.attr('variant')} value={${g.expr('value')}}${g.on('onValueChange')}>\n  <TabsList aria-label="Tabs">\n${tabs.map((t) => `    <TabsTab value=${JSON.stringify(t.id)}>${t.label}</TabsTab>`).join('\n')}\n  </TabsList>\n${tabs.map((t, i) => `  <TabsPanel value=${JSON.stringify(t.id)}>\n${(g.children[i] ?? '').split('\n').map((l) => `    ${l}`).join('\n')}\n  </TabsPanel>`).join('\n')}\n</Tabs>`;
    },
  },
  TabsBar: {
    type: 'TabsBar', title: 'Tabs bar', section: 'Navigation and layout', source: 'kit', icon: 'square-on-square', float: true,
    description: 'The iOS bottom tab bar: Tabs with variant="bar" and no panels, icons over labels, hiding on scroll. It sits at the bottom of the scene.',
    module: '@/components/ui/tabs', tag: 'Tabs', uses: ['@/components/ui/tabs|TabsBar', '@/components/ui/tabs|TabsList', '@/components/ui/tabs|TabsTab'],
    props: [
      { name: 'items', control: { kind: 'items', icons: true }, default: 'Garden:flower, Calendar:calendar, Settings:gear', part: '<TabsTab>s' },
      { name: 'value', label: 'selected', control: { kind: 'text' }, default: 'Garden', twoWay: 'onValueChange' },
    ],
    events: [{ name: 'onValueChange', label: 'onValueChange', value: 'the tab' }],
    render: ({ p, on }) => (
      <Tabs variant="bar" value={str(p.value)} onValueChange={(v) => v != null && on.onValueChange?.(v)} className="contents">
        <TabsBar hideOnScroll={false}>
          <TabsList aria-label="Tabs">
            {itemsOf(p.items).map((it) => <TabsTab key={it.id} value={it.id} icon={it.icon ?? 'circle'}>{it.label}</TabsTab>)}
          </TabsList>
        </TabsBar>
      </Tabs>
    ),
    code: (g) => {
      parts(g, '@/components/ui/tabs', 'Tabs', 'TabsBar', 'TabsList', 'TabsTab');
      const items = g.list('items') ?? [];
      return `<Tabs variant="bar" value={${g.expr('value')}}${g.on('onValueChange')}>\n  <TabsBar>\n    <TabsList aria-label="Tabs">\n${items.map((it) => `      <TabsTab value=${JSON.stringify(it.id)} icon=${JSON.stringify(it.icon ?? 'circle')}>${it.label}</TabsTab>`).join('\n')}\n    </TabsList>\n  </TabsBar>\n</Tabs>`;
    },
  },

  /* ── Motion components ── */
  TextMorph: {
    type: 'TextMorph', title: 'TextMorph', section: 'Motion components', source: 'kit', icon: 'textformat',
    description: 'A text label that morphs into the next one: shared letters slide to their new places, the rest blur out and in, and the box springs to the new width.',
    module: '@/components/ui/text-morph', tag: 'TextMorph',
    props: [text('children', 'Continue'), { name: 'textStyle', label: 'style', control: { kind: 'enum', options: textStyleOptions }, default: 'title2', part: 'className' }],
    events: [], layout: { width: 'fit' },
    render: ({ p }) => <span className={textClass(p.textStyle)}><TextMorph>{str(p.children)}</TextMorph></span>,
  },
  NumberMorph: {
    type: 'NumberMorph', title: 'NumberMorph', section: 'Motion components', source: 'kit', icon: 'number',
    description: 'A formatted number whose digits roll and whose separators slide as the value changes, using Intl.NumberFormat for currency, percent and compact notation.',
    module: '@/components/ui/number-morph', tag: 'NumberMorph',
    props: [
      { name: 'value', control: { kind: 'number' }, default: 1280 },
      { name: 'format', control: { kind: 'enum', options: values('number', 'currency', 'percent', 'compact') }, default: 'number', help: 'Intl.NumberFormat options' },
      { name: 'textStyle', label: 'style', control: { kind: 'enum', options: textStyleOptions }, default: 'title1', part: 'className' },
    ],
    events: [], layout: { width: 'fit' },
    render: ({ p }) => {
      const f = p.format;
      const format: Intl.NumberFormatOptions = f === 'currency' ? { style: 'currency', currency: 'USD' } : f === 'percent' ? { style: 'percent' } : f === 'compact' ? { notation: 'compact' } : {};
      return <span className={cn('tabular-nums', textClass(p.textStyle))}><NumberMorph value={num(p.value)} format={format} /></span>;
    },
  },
  AnimatedHeight: {
    type: 'AnimatedHeight', title: 'AnimatedHeight', section: 'Motion components', source: 'kit', icon: 'arrows-expand',
    description: 'A tray that changes size instead of cutting: it springs its height to its content.',
    module: '@/components/ui/animated-height', tag: 'AnimatedHeight', container: 'component',
    props: [{ name: 'spring', control: { kind: 'enum', options: values(...(Object.keys(springs) as SpringName[])) }, default: 'tray' }],
    events: [], layout: { axis: 'vertical', gap: 8, width: 'fill' },
    render: ({ p, children, box }) => <AnimatedHeight spring={pick(p.spring, Object.keys(springs) as SpringName[], 'tray')}><div style={box}>{children}</div></AnimatedHeight>,
  },

  /* ── Editors and workbench ── */
  CodeEditor: {
    type: 'CodeEditor', title: 'CodeEditor', section: 'Editors and workbench', source: 'kit', icon: 'terminal',
    description: 'Code you can edit, or read-only code highlighted on the GPU by gpu-lexer: file header, copy button, line numbers, highlighted and diff lines, inline code.',
    module: '@/components/ui/code-editor', tag: 'CodeEditor',
    props: [
      { name: 'value', control: { kind: 'text', multiline: true, mono: true }, default: "const greeting = 'Hello';\nconsole.log(greeting);" },
      { name: 'language', control: { kind: 'enum', options: values('tsx', 'ts', 'js', 'json', 'css', 'bash', 'text') }, default: 'tsx' },
      { name: 'title', control: { kind: 'text' }, default: 'hello.ts' },
      { name: 'showCopy', control: { kind: 'boolean' }, default: true },
      { name: 'lineNumbers', control: { kind: 'boolean' }, default: false },
    ],
    events: [], layout: { width: 'fill' },
    render: ({ p }) => <CodeEditor readOnly value={str(p.value)} language={str(p.language, 'tsx')} title={p.title ? str(p.title) : undefined} showCopy={!!p.showCopy} lineNumbers={!!p.lineNumbers} />,
    code: (g) => `<CodeEditor readOnly value={${g.expr('value')}} language={${g.expr('language')}} title={${g.expr('title')}}${g.expr('showCopy') === 'true' ? ' showCopy' : ''}${g.expr('lineNumbers') === 'true' ? ' lineNumbers' : ''} />`,
  },

  /* ── React ── */
  SceneRef: {
    type: 'SceneRef', title: 'Scene Component', section: 'React', source: 'react', icon: 'iphone',
    description: 'Another scene, rendered as a component (<Garden />): its props from bindings, its callback props from actions here, and everything in it selectable and editable in place. Xcode’s container view, and how a TabsScreen or a NavigationStack holds a scene.',
    module: '', tag: 'Scene',
    props: [{ name: 'scene', control: { kind: 'scene' }, default: null }],
    events: [],
    layout: { width: 'fill', height: 'fill' },
    render: ({ node }) => <SceneRefHost node={node} />,
  },

  /* ── Foundations ── */
  Icon: {
    type: 'Icon', title: 'Icon', section: 'Foundations', source: 'kit', icon: 'star',
    description: 'An SF Symbols-style icon set on a 24px grid: round-capped strokes in six weights, filled variants, and custom shapes.',
    module: '@/lib/icon', tag: 'Icon',
    props: [
      { name: 'name', control: { kind: 'icon' }, default: 'star-fill' },
      { name: 'size', control: { kind: 'number', min: 8, max: 160, step: 1, unit: 'px' }, default: 24 },
      { name: 'sw', control: { kind: 'number', min: 0.5, max: 4, step: 0.1 }, default: 1.8, help: 'Stroke width' },
      { name: 'color', control: { kind: 'color' }, default: '$primary', part: 'className' },
    ],
    events: [], layout: { width: 'fit' },
    render: ({ p }) => (
      <span className="grid place-items-center" style={{ color: cssColor(p.color as string | null) }}>
        <Icon name={str(p.name, 'star')} size={num(p.size, 24)} sw={num(p.sw, 1.8)} />
      </span>
    ),
  },
};

/** A ListSection with rows. */
function listSection(title: string, rows: string[]): Node {
  return leaf('ListSection', { title, footer: '' }, {
    layout: { axis: 'vertical', width: 'fill' },
    children: rows.map((t) => leaf('ListRow', { title: t, description: '', trailing: '', accessory: 'chevron', checked: false, tone: 'default' }, { layout: { width: 'fill' }, slots: { icon: [], accessory: [] } })),
  });
}
