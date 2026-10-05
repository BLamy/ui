/* @brett_lamy/ui, as the library: every app-facing component under its export name and in its docs section, with
   its registry description, its real props and their real values (`variant="secondary"`), its events, and its
   compound parts as children or slots. Each renders the kit's own component, so the canvas and the preview are the
   kit itself, and the code generator writes the same JSX. */
import { parseDate } from '@internationalized/date';
import { parseColor, type Key } from 'react-aria-components';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Avatar, AvatarGroup, type AvatarStatus } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker, ColorPickerContent, ColorPickerTrigger } from '@/components/ui/color-picker';
import { ComboBox, ComboBoxContent, ComboBoxInput, ComboBoxItem } from '@/components/ui/combobox';
import { DateField, DateInput } from '@/components/ui/date-field';
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker';
import { Disclosure, DisclosurePanel, DisclosureTrigger } from '@/components/ui/disclosure';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { List, ListRow, ListSection } from '@/components/ui/list';
import { NowPlayingBars } from '@/components/ui/now-playing-bars';
import { NumberMorph } from '@/components/ui/number-morph';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ProgressStepper } from '@/components/ui/progress-stepper';
import { QRSvg } from '@/components/ui/qr-svg';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { SearchField } from '@/components/ui/search-field';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Spinner, spinnerAnimations, type SpinnerAnimation } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { SyntaxHighlighting } from '@/components/ui/syntax-highlighting';
import { TabBar } from '@/components/ui/tab-bar';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { FieldDescription, FieldError, TextField } from '@/components/ui/text-field';
import { Textarea } from '@/components/ui/textarea';
import { TextMorph } from '@/components/ui/text-morph';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/lib/icon';
import { springs, type SpringName } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { cssColor, newId, type Node } from './model';
import { NavStackHost, SceneRefHost, SplitViewHost, TabViewHost } from './hosts';
import { itemsOf, num, q, str, textClass, textStyleOptions, values, type CodeArgs, type ComponentSpec, type ItemEntry } from './spec';

const pick = <T extends string>(v: unknown, options: readonly T[], d: T): T => (options.includes(v as T) ? (v as T) : d);
const date = (v: unknown) => {
  try { return v ? parseDate(String(v)) : null; } catch { return null; }
};
/** What a color picker starts on: the system blue. */
const START_COLOR = '#0A84FF';
const color = (v: unknown) => {
  try { return parseColor(String(v || START_COLOR)); } catch { return parseColor(START_COLOR); }
};
const leaf = (type: string, props: Record<string, unknown> = {}, patch: Partial<Node> = {}): Node => ({ id: newId(), type, props: props as Node['props'], ...patch });

const BUTTON_VARIANTS = ['default', 'secondary', 'ghost', 'destructive', 'link', 'quiet'] as const;
const BUTTON_SIZES = ['default', 'sm', 'lg', 'pill', 'icon', 'icon-sm'] as const;
const SPINNERS = spinnerAnimations.map((a) => a.id);

/* ── Code: the JSX a component's `code` writes ── */

/** A list prop as items: its literal items, each written by `each`, or its bound list mapped by `each` at run time. */
const listCode = (g: CodeArgs, name: string, each: (it: ItemEntry | null, v: string) => string, join = ', ') => {
  const items = g.list(name);
  return items ? items.map((it) => each(it, '')).join(join) : `{${g.expr(name)}.map((it) => ${each(null, 'it')})}`;
};
/** An item's field, literal or read at run time from a bound list's entry `v` (a string, or an object). */
const field = (it: ItemEntry | null, v: string, f: 'id' | 'label' | 'icon') => (it ? (it[f] == null ? 'undefined' : q(String(it[f]))) : f === 'icon' ? `${v}.icon` : `(${v}.${f} ?? ${v})`);
/** The part of the kit a component's parts come from: imports them. */
const parts = (g: CodeArgs, module: string, ...names: string[]) => names.forEach((n) => g.use(module, n));
/** A Label from a text prop, when it has one. */
const labelCode = (g: CodeArgs) => {
  const t = g.text('label');
  if (!t) return '';
  g.use('@/components/ui/label', 'Label');
  return `\n  <Label variant="field">${t}</Label>`;
};
const toKey = (v: string) => `String(${v})`;
const toIso = (v: string) => `${v}.toString()`;
/** A date prop as a DateValue. */
const dateCode = (g: CodeArgs, name: string) => {
  g.use('@internationalized/date', 'parseDate');
  return `parseDate(${g.expr(name)})`;
};

const text = (name = 'children', d = '', label?: string) => ({ name, label, control: { kind: 'text' as const }, default: d });

export const KIT: Record<string, ComponentSpec> = {
  /* ── Buttons and toggles ── */
  Button: {
    type: 'Button', title: 'Button', section: 'Buttons and toggles', source: 'kit', icon: 'circle-fill',
    description: 'The labelled action button: a react-aria Button with default, secondary, ghost, destructive and link variants, five sizes including the full-width iOS pill, a press that sinks on a spring, and a text label that morphs into the next one.',
    module: '@/components/ui/button', tag: 'Button', focusable: true,
    props: [
      text('children', 'Button'),
      { name: 'variant', control: { kind: 'enum', options: values(...BUTTON_VARIANTS) }, default: 'default' },
      { name: 'size', control: { kind: 'enum', options: values(...BUTTON_SIZES) }, default: 'default' },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
      { name: 'icon', control: { kind: 'icon' }, default: null, part: '<Icon> child', help: 'An Icon before the label' },
    ],
    events: [{ name: 'onPress', label: 'onPress' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => {
      const size = pick(p.size, BUTTON_SIZES, 'default');
      const label = str(p.children);
      return (
        <Button variant={pick(p.variant, BUTTON_VARIANTS, 'default')} size={size} isDisabled={!!p.isDisabled} onPress={() => on.onPress?.()} aria-label={size.startsWith('icon') ? label : undefined} className="max-w-full">
          {p.icon ? <Icon name={str(p.icon)} size={size === 'sm' || size === 'icon-sm' ? 15 : 18} sw={2.1} /> : null}
          {size.startsWith('icon') ? null : label}
        </Button>
      );
    },
  },
  Toggle: {
    type: 'Toggle', title: 'Toggle', section: 'Buttons and toggles', source: 'kit', icon: 'switch-2',
    description: "Two-state button on react-aria's ToggleButton: tinted when on, in default, filled and outline variants.",
    module: '@/components/ui/toggle', tag: 'Toggle', focusable: true,
    props: [
      text('children', 'Mute'),
      { name: 'isSelected', control: { kind: 'boolean' }, default: false, twoWay: 'onChange' },
      { name: 'variant', control: { kind: 'enum', options: values('default', 'filled', 'outline') }, default: 'filled' },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default' },
      { name: 'icon', control: { kind: 'icon' }, default: 'bell', part: '<Icon> child' },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'isSelected' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => (
      <Toggle isSelected={!!p.isSelected} onChange={(v) => on.onChange?.(v)} variant={pick(p.variant, ['default', 'filled', 'outline'] as const, 'filled')} size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} isDisabled={!!p.isDisabled} aria-label={str(p.children) || 'Toggle'}>
        {p.icon ? <Icon name={str(p.icon)} size={16} sw={2} /> : null}
        {str(p.children)}
      </Toggle>
    ),
  },
  ToggleGroup: {
    type: 'ToggleGroup', title: 'ToggleGroup', section: 'Buttons and toggles', source: 'kit', icon: 'rectangle-split',
    description: 'react-aria ToggleButtonGroup with single or multiple selection, roving arrow-key focus, and filled, outline and default looks.',
    module: '@/components/ui/toggle-group', tag: 'ToggleGroup', uses: ['@/components/ui/toggle-group|ToggleGroupItem'], focusable: true,
    props: [
      { name: 'items', control: { kind: 'items' }, default: 'List, Grid, Board', part: '<ToggleGroupItem>s' },
      { name: 'selectedKeys', label: 'selected', control: { kind: 'text' }, default: 'Grid', twoWay: 'onSelectionChange', help: 'An item, or several separated by commas' },
      { name: 'selectionMode', control: { kind: 'enum', options: values('single', 'multiple') }, default: 'single' },
      { name: 'variant', control: { kind: 'enum', options: values('default', 'filled', 'outline') }, default: 'filled' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'View' },
    ],
    events: [{ name: 'onSelectionChange', label: 'onSelectionChange', value: 'the selected items, comma-separated' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => {
      const single = p.selectionMode !== 'multiple';
      const sel = Array.isArray(p.selectedKeys) ? (p.selectedKeys as Key[]).map(String) : str(p.selectedKeys).split(',').map((s) => s.trim()).filter(Boolean);
      return (
        <ToggleGroup
          aria-label={str(p['aria-label'], 'Options')}
          selectionMode={single ? 'single' : 'multiple'}
          disallowEmptySelection={single}
          variant={pick(p.variant, ['default', 'filled', 'outline'] as const, 'filled')}
          selectedKeys={new Set(sel)}
          onSelectionChange={(keys) => on.onSelectionChange?.([...(keys as Set<Key>)].map(String).join(', '))}
        >
          {itemsOf(p.items).map((it) => (
            <ToggleGroupItem key={it.id} id={it.id} aria-label={it.icon ? it.label : undefined}>{it.icon ? <Icon name={it.icon} size={16} sw={2} /> : it.label}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/toggle-group', 'ToggleGroup', 'ToggleGroupItem');
      const single = g.expr('selectionMode') !== "'multiple'";
      const items = listCode(g, 'items', (it, v) => `<ToggleGroupItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} id={${field(it, v, 'id')}}>{${field(it, v, 'label')}}</ToggleGroupItem>`, '\n  ');
      return `<ToggleGroup aria-label={${g.expr('aria-label')}}${single ? '' : ' selectionMode="multiple"'}${g.attr('variant')} selectedKeys={new Set(String(${g.expr('selectedKeys')}).split(', '))}${g.on('onSelectionChange', (v) => `[...${v}].map(String).join(', ')`)}>\n  ${items}\n</ToggleGroup>`;
    },
  },

  /* ── Forms and inputs ── */
  TextField: {
    type: 'TextField', title: 'TextField', section: 'Forms and inputs', source: 'kit', icon: 'square-pencil',
    description: "react-aria's TextField restyled: the wrapper that links a Label, an Input or Textarea, a FieldDescription and a FieldError, and runs validation.",
    module: '@/components/ui/text-field', tag: 'TextField', focusable: true,
    uses: ['@/components/ui/label|Label', '@/components/ui/input|Input', '@/components/ui/text-field|FieldDescription'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Label', part: '<Label variant="field">' },
      { name: 'placeholder', control: { kind: 'text' }, default: '', part: '<Input placeholder>' },
      { name: 'value', control: { kind: 'text' }, default: '', twoWay: 'onChange' },
      { name: 'type', control: { kind: 'enum', options: values('text', 'email', 'password', 'tel', 'url', 'search') }, default: 'text' },
      { name: 'description', control: { kind: 'text' }, default: '', part: '<FieldDescription>' },
      { name: 'errorMessage', control: { kind: 'text' }, default: '', part: '<FieldError>', help: 'Shown while isInvalid' },
      { name: 'multiline', control: { kind: 'boolean' }, default: false, part: '<Textarea> for <Input>' },
      { name: 'isRequired', control: { kind: 'boolean' }, default: false },
      { name: 'isInvalid', control: { kind: 'boolean' }, default: false },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the text' }, { name: 'onSubmit', label: 'onSubmit (Return)', value: 'the text' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <TextField
        value={str(p.value)}
        onChange={(v) => on.onChange?.(v)}
        type={str(p.type, 'text')}
        isRequired={!!p.isRequired}
        isInvalid={!!p.isInvalid}
        isDisabled={!!p.isDisabled}
        aria-label={p.label ? undefined : str(p.placeholder, 'Text field')}
        className="min-w-0"
      >
        {p.label ? <Label variant="field">{str(p.label)}</Label> : null}
        {p.multiline
          ? <Textarea placeholder={str(p.placeholder)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) on.onSubmit?.(str(p.value)); }} />
          : <Input placeholder={str(p.placeholder)} onKeyDown={(e) => { if (e.key === 'Enter') on.onSubmit?.(str(p.value)); }} />}
        {p.description ? <FieldDescription>{str(p.description)}</FieldDescription> : null}
        {p.errorMessage ? <FieldError>{str(p.errorMessage)}</FieldError> : null}
      </TextField>
    ),
    code: (g) => {
      g.use('@/components/ui/text-field', 'TextField');
      const multiline = g.expr('multiline') === 'true';
      const input = multiline ? 'Textarea' : 'Input';
      g.use(`@/components/ui/${multiline ? 'textarea' : 'input'}`, input);
      const submit = g.handler('onSubmit');
      const keys = submit ? ` onKeyDown={(e) => { if (e.key === 'Enter'${multiline ? ' && (e.metaKey || e.ctrlKey)' : ''}) (${submit})(${g.expr('value')}); }}` : '';
      const extra: string[] = [];
      if (g.text('description')) { g.use('@/components/ui/text-field', 'FieldDescription'); extra.push(`<FieldDescription>${g.text('description')}</FieldDescription>`); }
      if (g.text('errorMessage')) { g.use('@/components/ui/text-field', 'FieldError'); extra.push(`<FieldError>${g.text('errorMessage')}</FieldError>`); }
      return `<TextField value={${g.expr('value')}}${g.on('onChange')}${g.attr('type')}${g.attr('isRequired')}${g.attr('isInvalid')}${g.attr('isDisabled')}>${labelCode(g)}\n  <${input}${g.attr('placeholder')}${keys} />${extra.map((x) => `\n  ${x}`).join('')}\n</TextField>`;
    },
  },
  SearchField: {
    type: 'SearchField', title: 'SearchField', section: 'Forms and inputs', source: 'kit', icon: 'magnifyingglass',
    description: "iOS search field on react-aria's SearchField: magnifier, clear button, Esc to clear, controlled or uncontrolled.",
    module: '@/components/ui/search-field', tag: 'SearchField', focusable: true,
    props: [
      { name: 'value', control: { kind: 'text' }, default: '', twoWay: 'onChange' },
      { name: 'placeholder', control: { kind: 'text' }, default: 'Search' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the query' }, { name: 'onSubmit', label: 'onSubmit', value: 'the query' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => <SearchField value={str(p.value)} onChange={(v) => on.onChange?.(v)} onSubmit={(v) => on.onSubmit?.(v)} placeholder={str(p.placeholder, 'Search')} />,
  },
  Checkbox: {
    type: 'Checkbox', title: 'Checkbox', section: 'Forms and inputs', source: 'kit', icon: 'checkmark-circle',
    description: 'react-aria Checkbox and CheckboxGroup with a round iOS selection mark (or a square one), a drawn-on tick and an indeterminate state.',
    module: '@/components/ui/checkbox', tag: 'Checkbox', focusable: true,
    props: [
      text('children', 'Remember me'),
      { name: 'isSelected', control: { kind: 'boolean' }, default: false, twoWay: 'onChange' },
      { name: 'shape', control: { kind: 'enum', options: values('circle', 'square') }, default: 'circle' },
      { name: 'isIndeterminate', control: { kind: 'boolean' }, default: false },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'isSelected' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => (
      <Checkbox isSelected={!!p.isSelected} onChange={(v) => on.onChange?.(v)} shape={pick(p.shape, ['circle', 'square'] as const, 'circle')} isIndeterminate={!!p.isIndeterminate} isDisabled={!!p.isDisabled}>{str(p.children)}</Checkbox>
    ),
  },
  RadioGroup: {
    type: 'RadioGroup', title: 'RadioGroup', section: 'Forms and inputs', source: 'kit', icon: 'circle',
    description: 'react-aria RadioGroup and Radio: round radios with arrow-key selection, vertical or horizontal.',
    module: '@/components/ui/radio-group', tag: 'RadioGroup', focusable: true, uses: ['@/components/ui/radio-group|Radio', '@/components/ui/label|Label'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Plan', part: '<Label variant="field">' },
      { name: 'items', control: { kind: 'items' }, default: 'Free, Pro, Team', part: '<Radio>s' },
      { name: 'value', control: { kind: 'text' }, default: 'Pro', twoWay: 'onChange' },
      { name: 'orientation', control: { kind: 'enum', options: values('vertical', 'horizontal') }, default: 'vertical' },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the chosen value' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => {
      const radios = itemsOf(p.items).map((it) => <Radio key={it.id} value={it.id}>{it.label}</Radio>);
      return (
        <RadioGroup value={str(p.value)} onChange={(v) => on.onChange?.(v)} orientation={p.orientation === 'horizontal' ? 'horizontal' : 'vertical'} isDisabled={!!p.isDisabled} aria-label={p.label ? undefined : 'Options'}>
          {p.label ? <Label variant="field">{str(p.label)}</Label> : null}
          {p.orientation === 'horizontal' ? <div className="flex flex-wrap gap-5">{radios}</div> : radios}
        </RadioGroup>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/radio-group', 'RadioGroup', 'Radio');
      const radios = listCode(g, 'items', (it, v) => `<Radio key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} value={${field(it, v, 'id')}}>{${field(it, v, 'label')}}</Radio>`, '\n  ');
      return `<RadioGroup value={${g.expr('value')}}${g.on('onChange')}${g.attr('orientation')}${g.attr('isDisabled')}>${labelCode(g)}\n  ${radios}\n</RadioGroup>`;
    },
  },
  Switch: {
    type: 'Switch', title: 'Switch', section: 'Forms and inputs', source: 'kit', icon: 'switch-2',
    description: "iOS switch on react-aria's Switch: a 51 by 31 track, a thumb that springs across and stretches while pressed.",
    module: '@/components/ui/switch', tag: 'Switch', focusable: true,
    props: [
      { name: 'checked', control: { kind: 'boolean' }, default: true, twoWay: 'onChange' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Toggle' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'checked' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => <Switch checked={!!p.checked} onChange={(v) => on.onChange?.(v)} aria-label={str(p['aria-label'], 'Toggle')} />,
  },
  Slider: {
    type: 'Slider', title: 'Slider', section: 'Forms and inputs', source: 'kit', icon: 'sliders',
    description: 'react-aria Slider with the iOS look: a 4px track, tint fill and 26px thumb, one or two thumbs, plus on-dark and on-light tones and a small scrubber size.',
    module: '@/components/ui/slider', tag: 'Slider', focusable: true,
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Volume' },
      { name: 'value', control: { kind: 'number' }, default: 50, twoWay: 'onChange' },
      { name: 'minValue', control: { kind: 'number' }, default: 0 },
      { name: 'maxValue', control: { kind: 'number' }, default: 100 },
      { name: 'step', control: { kind: 'number', min: 0.01 }, default: 1 },
      { name: 'showValue', control: { kind: 'boolean' }, default: true },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm') }, default: 'default' },
      { name: 'tone', control: { kind: 'enum', options: values('default', 'onDark', 'onLight') }, default: 'default' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the value' }, { name: 'onChangeEnd', label: 'onChangeEnd', value: 'the value' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Slider
        label={p.label ? str(p.label) : undefined}
        aria-label={p.label ? undefined : 'Slider'}
        showValue={!!p.showValue}
        value={num(p.value)}
        minValue={num(p.minValue)}
        maxValue={num(p.maxValue, 100)}
        step={num(p.step, 1) || 1}
        size={pick(p.size, ['default', 'sm'] as const, 'default')}
        tone={pick(p.tone, ['default', 'onDark', 'onLight'] as const, 'default')}
        onChange={(v) => on.onChange?.(v)}
        onChangeEnd={(v) => on.onChangeEnd?.(v)}
      />
    ),
  },
  Segmented: {
    type: 'Segmented', title: 'Segmented', section: 'Forms and inputs', source: 'kit', icon: 'rectangle-split',
    description: 'The iOS segmented control: a radio group whose selected card slides between segments.',
    module: '@/components/ui/segmented', tag: 'Segmented', focusable: true,
    props: [
      { name: 'options', control: { kind: 'items' }, default: 'Day, Week, Month' },
      { name: 'value', control: { kind: 'text' }, default: 'Day', twoWay: 'onChange' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Range' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the option' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => {
      const options = itemsOf(p.options);
      return <Segmented aria-label={str(p['aria-label'], 'Options')} options={options.map((o) => ({ id: o.id, label: o.label }))} value={str(p.value, options[0]?.id ?? '')} onChange={(v) => on.onChange?.(v)} />;
    },
    code: (g) => {
      g.use('@/components/ui/segmented', 'Segmented');
      const items = g.list('options');
      const options = items ? `[${items.map((o) => `{ id: ${q(o.id)}, label: ${q(o.label)} }`).join(', ')}]` : `${g.expr('options')}.map((o) => ({ id: o.id ?? o, label: o.label ?? o }))`;
      return `<Segmented aria-label={${g.expr('aria-label')}} options={${options}} value={${g.expr('value')}}${g.on('onChange')} />`;
    },
  },
  Select: {
    type: 'Select', title: 'Select', section: 'Forms and inputs', source: 'kit', icon: 'chevron-up-down',
    description: "A pop-up button that opens a list of options: react-aria's Select with a filled or plain trigger, sectioned items and typeahead on the closed button.",
    module: '@/components/ui/select', tag: 'Select', focusable: true,
    uses: ['@/components/ui/label|Label', '@/components/ui/select|SelectTrigger', '@/components/ui/select|SelectContent', '@/components/ui/select|SelectItem'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Repeat', part: '<Label variant="field">' },
      { name: 'items', control: { kind: 'items' }, default: 'Never, Every day, Every week, Every month', part: '<SelectItem>s' },
      { name: 'value', control: { kind: 'text' }, default: 'Every week', twoWay: 'onChange' },
      { name: 'placeholder', control: { kind: 'text' }, default: 'Choose…' },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm') }, default: 'default', part: '<SelectTrigger size>' },
      { name: 'variant', control: { kind: 'enum', options: values('default', 'plain') }, default: 'default', part: '<SelectTrigger variant>' },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the chosen item' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <Select value={str(p.value) || null} onChange={(k) => on.onChange?.(k == null ? null : String(k))} placeholder={str(p.placeholder)} isDisabled={!!p.isDisabled} aria-label={p.label ? undefined : 'Select'}>
        {p.label ? <Label variant="field">{str(p.label)}</Label> : null}
        <SelectTrigger size={pick(p.size, ['default', 'sm'] as const, 'default')} variant={pick(p.variant, ['default', 'plain'] as const, 'default')} />
        <SelectContent>
          {itemsOf(p.items).map((it) => <SelectItem key={it.id} id={it.id}>{it.label}</SelectItem>)}
        </SelectContent>
      </Select>
    ),
    code: (g) => {
      parts(g, '@/components/ui/select', 'Select', 'SelectTrigger', 'SelectContent', 'SelectItem');
      const items = listCode(g, 'items', (it, v) => `<SelectItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} id={${field(it, v, 'id')}}>{${field(it, v, 'label')}}</SelectItem>`, '\n    ');
      return `<Select value={${g.expr('value')}}${g.on('onChange', toKey)}${g.attr('placeholder')}${g.attr('isDisabled')}>${labelCode(g)}\n  <SelectTrigger${g.attr('size')}${g.attr('variant')} />\n  <SelectContent>\n    ${items}\n  </SelectContent>\n</Select>`;
    },
  },
  ComboBox: {
    type: 'ComboBox', title: 'ComboBox', section: 'Forms and inputs', source: 'kit', icon: 'magnifier',
    description: 'A filterable text field with a suggestion list: type to narrow the options, arrow keys to move, Enter to commit, with optional custom values.',
    module: '@/components/ui/combobox', tag: 'ComboBox', focusable: true,
    uses: ['@/components/ui/label|Label', '@/components/ui/combobox|ComboBoxInput', '@/components/ui/combobox|ComboBoxContent', '@/components/ui/combobox|ComboBoxItem'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Assignee', part: '<Label variant="field">' },
      { name: 'items', control: { kind: 'items' }, default: 'Ana Torres, Kim Park, Lee Chen, Maya Okafor', part: '<ComboBoxItem>s' },
      { name: 'value', control: { kind: 'text' }, default: '', twoWay: 'onChange' },
      { name: 'placeholder', control: { kind: 'text' }, default: 'Search the team', part: '<ComboBoxInput placeholder>' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the chosen item' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <ComboBox value={str(p.value) || null} onChange={(k) => on.onChange?.(k == null ? null : String(k))} aria-label={p.label ? undefined : 'Choose'} menuTrigger="focus">
        {p.label ? <Label variant="field">{str(p.label)}</Label> : null}
        <ComboBoxInput placeholder={str(p.placeholder)} />
        <ComboBoxContent>
          {itemsOf(p.items).map((it) => <ComboBoxItem key={it.id} id={it.id} textValue={it.label}>{it.label}</ComboBoxItem>)}
        </ComboBoxContent>
      </ComboBox>
    ),
    code: (g) => {
      parts(g, '@/components/ui/combobox', 'ComboBox', 'ComboBoxInput', 'ComboBoxContent', 'ComboBoxItem');
      const items = listCode(g, 'items', (it, v) => `<ComboBoxItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} id={${field(it, v, 'id')}}>{${field(it, v, 'label')}}</ComboBoxItem>`, '\n    ');
      return `<ComboBox value={${g.expr('value')} || null}${g.on('onChange', toKey)} menuTrigger="focus">${labelCode(g)}\n  <ComboBoxInput${g.attr('placeholder')} />\n  <ComboBoxContent>\n    ${items}\n  </ComboBoxContent>\n</ComboBox>`;
    },
  },
  DateField: {
    type: 'DateField', title: 'DateField', section: 'Forms and inputs', source: 'kit', icon: 'calendar',
    description: "Segmented date and time fields: react-aria's DateField and TimeField, each part of the value its own spin-button, in the filled iOS field with a Label, description and error wired in.",
    module: '@/components/ui/date-field', tag: 'DateField', focusable: true, uses: ['@/components/ui/label|Label', '@/components/ui/date-field|DateInput'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Birthday', part: '<Label variant="field">' },
      { name: 'value', control: { kind: 'date' }, default: '2026-10-04', twoWay: 'onChange', help: 'An ISO date; parseDate() in code' },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm', 'lg') }, default: 'default', part: '<DateInput size>' },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the date (YYYY-MM-DD)' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <DateField value={date(p.value)} onChange={(v) => on.onChange?.(v ? v.toString() : null)} isDisabled={!!p.isDisabled} aria-label={p.label ? undefined : 'Date'}>
        {p.label ? <Label variant="field">{str(p.label)}</Label> : null}
        <DateInput size={pick(p.size, ['default', 'sm', 'lg'] as const, 'default')} />
      </DateField>
    ),
    code: (g) => {
      parts(g, '@/components/ui/date-field', 'DateField', 'DateInput');
      return `<DateField value={${dateCode(g, 'value')}}${g.on('onChange', (v) => `${v}?.toString() ?? ''`)}${g.attr('isDisabled')}>${labelCode(g)}\n  <DateInput${g.attr('size')} />\n</DateField>`;
    },
  },
  DatePicker: {
    type: 'DatePicker', title: 'DatePicker', section: 'Forms and inputs', source: 'kit', icon: 'calendar-fill',
    description: "A date field with a calendar button that opens a Calendar in a popover, and the same for a range: react-aria's DatePicker and DateRangePicker, composed from a field and a content part.",
    module: '@/components/ui/date-picker', tag: 'DatePicker', focusable: true,
    uses: ['@/components/ui/label|Label', '@/components/ui/date-picker|DatePickerField', '@/components/ui/date-picker|DatePickerContent'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Date', part: '<Label variant="field">' },
      { name: 'value', control: { kind: 'date' }, default: '2026-10-04', twoWay: 'onChange' },
      { name: 'size', control: { kind: 'enum', options: values('default', 'sm', 'lg') }, default: 'default', part: '<DatePickerField size>' },
      { name: 'isDisabled', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the date (YYYY-MM-DD)' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <DatePicker value={date(p.value)} onChange={(v) => on.onChange?.(v ? v.toString() : null)} isDisabled={!!p.isDisabled} aria-label={p.label ? undefined : 'Date'}>
        {p.label ? <Label variant="field">{str(p.label)}</Label> : null}
        <DatePickerField size={pick(p.size, ['default', 'sm', 'lg'] as const, 'default')} />
        <DatePickerContent />
      </DatePicker>
    ),
    code: (g) => {
      parts(g, '@/components/ui/date-picker', 'DatePicker', 'DatePickerField', 'DatePickerContent');
      return `<DatePicker value={${dateCode(g, 'value')}}${g.on('onChange', (v) => `${v}?.toString() ?? ''`)}${g.attr('isDisabled')}>${labelCode(g)}\n  <DatePickerField${g.attr('size')} />\n  <DatePickerContent />\n</DatePicker>`;
    },
  },
  Calendar: {
    type: 'Calendar', title: 'Calendar', section: 'Forms and inputs', source: 'kit', icon: 'calendar',
    description: "A month calendar and a range calendar: react-aria's Calendar and RangeCalendar with keyboard navigation, locale week starts, min/max and unavailable dates, drawn as iOS round day cells with a soft band joining a range.",
    module: '@/components/ui/calendar', tag: 'Calendar', focusable: true,
    props: [
      { name: 'value', control: { kind: 'date' }, default: '2026-10-04', twoWay: 'onChange' },
      { name: 'variant', control: { kind: 'enum', options: values('plain', 'card') }, default: 'card' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Date' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the date (YYYY-MM-DD)' }],
    layout: { width: 'fit' },
    render: ({ p, on }) => (
      <Calendar aria-label={str(p['aria-label'], 'Date')} variant={pick(p.variant, ['plain', 'card'] as const, 'card')} value={date(p.value)} onChange={(v) => on.onChange?.(v.toString())} />
    ),
    code: (g) => {
      g.use('@/components/ui/calendar', 'Calendar');
      return `<Calendar aria-label={${g.expr('aria-label')}}${g.attr('variant')} value={${dateCode(g, 'value')}}${g.on('onChange', toIso)} />`;
    },
  },
  ColorPicker: {
    type: 'ColorPicker', title: 'ColorPicker', section: 'Forms and inputs', source: 'kit', icon: 'drop',
    description: 'Color editing parts on react-aria: a ColorArea, ColorSliders, preset swatches, and a popover that composes them with a hex field behind a trigger that shows the current color.',
    module: '@/components/ui/color-picker', tag: 'ColorPicker', focusable: true,
    uses: ['@/components/ui/popover|PopoverTrigger', '@/components/ui/color-picker|ColorPickerTrigger', '@/components/ui/color-picker|ColorPickerContent'],
    props: [
      { name: 'value', control: { kind: 'text' }, default: START_COLOR, twoWay: 'onChange', help: 'A hex color' },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default', part: '<ColorPickerTrigger size>' },
      { name: 'showValue', control: { kind: 'boolean' }, default: true, part: '<ColorPickerTrigger showValue>' },
    ],
    events: [{ name: 'onChange', label: 'onChange', value: 'the color (hex)' }],
    layout: { width: 'fill' },
    render: ({ p, on }) => (
      <ColorPicker value={color(p.value)} onChange={(c) => on.onChange?.(c.toString('hex'))}>
        <PopoverTrigger>
          <ColorPickerTrigger size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} showValue={!!p.showValue} />
          <ColorPickerContent />
        </PopoverTrigger>
      </ColorPicker>
    ),
  },

  /* ── Menus and overlays ── */
  DropdownMenu: {
    type: 'DropdownMenu', title: 'DropdownMenu', section: 'Menus and overlays', source: 'kit', icon: 'ellipsis-circle',
    description: 'An iOS pull-down menu: rows with trailing icons, descriptions and shortcuts, section bands, selectable items and submenus.',
    module: '@/components/ui/dropdown-menu', tag: 'DropdownMenu', focusable: true,
    uses: ['@/components/ui/button|Button', '@/components/ui/dropdown-menu|DropdownMenuContent', '@/components/ui/dropdown-menu|DropdownMenuItem'],
    props: [
      { name: 'label', control: { kind: 'text' }, default: 'Sort', part: '<Button> trigger' },
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
        <DropdownMenu>
          <Button variant={pick(p.variant, BUTTON_VARIANTS, 'secondary')} size={size} aria-label={size.startsWith('icon') ? str(p.label) : undefined}>
            {size.startsWith('icon') ? null : str(p.label)}
            {p.icon ? <Icon name={str(p.icon)} size={14} sw={2.2} /> : null}
          </Button>
          <DropdownMenuContent onAction={(k) => on.onAction?.(String(k))}>
            {itemsOf(p.items).map((it) => <DropdownMenuItem key={it.id} id={it.id} icon={it.icon ? <Icon name={it.icon} size={16} sw={2} /> : undefined}>{it.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/dropdown-menu', 'DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem');
      g.use('@/components/ui/button', 'Button');
      g.use('@/lib/icon', 'Icon');
      const items = listCode(g, 'items', (it, v) => {
        const icon = field(it, v, 'icon');
        return `<DropdownMenuItem key=${it ? q(it.id) : `{${field(it, v, 'id')}}`} id={${field(it, v, 'id')}}${icon === 'undefined' ? '' : ` icon={<Icon name={${icon}} size={16} sw={2} />}`}>{${field(it, v, 'label')}}</DropdownMenuItem>`;
      }, '\n    ');
      const icon = g.attr('icon', 'name');
      return `<DropdownMenu>\n  <Button${g.attr('variant')}${g.attr('size')}>{${g.expr('label')}}${icon ? `<Icon${icon} size={14} sw={2.2} />` : ''}</Button>\n  <DropdownMenuContent${g.on('onAction', toKey)}>\n    ${items}\n  </DropdownMenuContent>\n</DropdownMenu>`;
    },
  },
  Tooltip: {
    type: 'Tooltip', title: 'Tooltip', section: 'Menus and overlays', source: 'kit', icon: 'text-bubble',
    description: 'A small inverted label that names a control on hover or keyboard focus, with a warm-up delay and an arrow toward the trigger; touch never opens it.',
    module: '@/components/ui/tooltip', tag: 'TooltipTrigger', uses: ['@/components/ui/tooltip|Tooltip'], container: 'component',
    props: [
      { name: 'text', control: { kind: 'text' }, default: 'Add a plant', part: '<Tooltip> children' },
      { name: 'placement', control: { kind: 'enum', options: values('top', 'bottom', 'left', 'right') }, default: 'top', part: '<Tooltip placement>' },
    ],
    events: [],
    layout: { axis: 'vertical', width: 'fit' },
    make: () => ({ children: [leaf('Button', { children: 'Hover me', variant: 'secondary', size: 'default', isDisabled: false, icon: null }, { layout: { width: 'fit' } })] }),
    render: ({ p, children }) => (
      <TooltipTrigger>
        {children}
        <Tooltip placement={pick(p.placement, ['top', 'bottom', 'left', 'right'] as const, 'top')}>{str(p.text)}</Tooltip>
      </TooltipTrigger>
    ),
  },
  Popover: {
    type: 'Popover', title: 'Popover', section: 'Menus and overlays', source: 'kit', icon: 'bubble',
    description: 'A floating panel anchored to a trigger: Popover is the styled surface, PopoverContent a padded dialog for arbitrary content, PopoverTrigger opens it.',
    module: '@/components/ui/popover', tag: 'PopoverTrigger', uses: ['@/components/ui/popover|PopoverContent'], container: 'component',
    slots: [{ name: 'trigger', label: 'Trigger' }],
    props: [
      { name: 'placement', control: { kind: 'enum', options: values('bottom', 'top', 'left', 'right', 'bottom start', 'bottom end') }, default: 'bottom', part: '<PopoverContent placement>' },
      { name: 'aria-label', control: { kind: 'text' }, default: 'Details', part: '<PopoverContent aria-label>' },
    ],
    events: [],
    layout: { axis: 'vertical', gap: 8, width: 'fit' },
    make: () => ({
      slots: { trigger: [leaf('Button', { children: 'Details', variant: 'secondary', size: 'sm', isDisabled: false, icon: null }, { layout: { width: 'fit' } })] },
      children: [leaf('Text', { children: 'Popover content: anything you put here.', textStyle: 'subhead', weight: 'default', color: null, align: 'left', lines: 0 }, { layout: { width: 'fill' } })],
    }),
    render: ({ p, children, slots, box }) => (
      <PopoverTrigger>
        {slots.trigger}
        <PopoverContent placement={str(p.placement, 'bottom') as 'bottom'} aria-label={str(p['aria-label'], 'Details')}>
          <div style={box}>{children}</div>
        </PopoverContent>
      </PopoverTrigger>
    ),
  },

  /* ── Feedback and status ── */
  Progress: {
    type: 'Progress', title: 'Progress', section: 'Feedback and status', source: 'kit', icon: 'line-3-horizontal',
    description: "iOS progress bar on react-aria's ProgressBar: a label, a springing fill with a rolling percentage, three sizes, tones and an indeterminate sliding bar.",
    module: '@/components/ui/progress', tag: 'Progress',
    props: [
      { name: 'value', control: { kind: 'number', min: 0, max: 100, step: 1 }, default: 60 },
      { name: 'label', control: { kind: 'text' }, default: 'Uploading' },
      { name: 'showValue', control: { kind: 'boolean' }, default: true },
      { name: 'size', control: { kind: 'enum', options: values('sm', 'default', 'lg') }, default: 'default' },
      { name: 'tone', control: { kind: 'enum', options: values('default', 'success', 'destructive') }, default: 'default' },
      { name: 'isIndeterminate', control: { kind: 'boolean' }, default: false },
    ],
    events: [],
    layout: { width: 'fill' },
    render: ({ p }) => (
      <Progress value={num(p.value)} label={p.label ? str(p.label) : undefined} aria-label={p.label ? undefined : 'Progress'} showValue={!!p.showValue} isIndeterminate={!!p.isIndeterminate}
        size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} tone={pick(p.tone, ['default', 'success', 'destructive'] as const, 'default')} />
    ),
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
      { name: 'isIndeterminate', control: { kind: 'boolean' }, default: false },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => (
      <ProgressRing value={num(p.value)} size={num(p.size, 56)} showValue={!!p.showValue} isIndeterminate={!!p.isIndeterminate} tone={pick(p.tone, ['default', 'success', 'warning', 'destructive'] as const, 'default')} aria-label="Progress" />
    ),
  },
  ProgressStepper: {
    type: 'ProgressStepper', title: 'ProgressStepper', section: 'Feedback and status', source: 'kit', icon: 'checklist',
    description: 'A row of milestones for a multi-step process, as filling bars or a joined line, with done, active and to-do states.',
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
    description: 'Loading indicators: the iOS activity indicator (eight fading spokes in discrete steps, the default) and twenty-two CSS loaders with three variants each. They draw in currentColor, scale to any size, take a speed, pause themselves off screen, and hold still under reduced motion.',
    module: '@/components/ui/spinner', tag: 'Spinner',
    props: [
      { name: 'animation', control: { kind: 'enum', options: values(...SPINNERS) }, default: 'ios' },
      { name: 'size', control: { kind: 'number', min: 12, max: 160, step: 1, unit: 'px' }, default: 28 },
      { name: 'speed', control: { kind: 'number', min: 0.25, max: 3, step: 0.05 }, default: 1 },
      { name: 'spin', control: { kind: 'boolean' }, default: true },
      { name: 'label', control: { kind: 'text' }, default: 'Loading' },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => <Spinner animation={pick(p.animation, SPINNERS, 'ios') as SpinnerAnimation} size={num(p.size, 28)} speed={num(p.speed, 1)} spin={!!p.spin} label={p.label ? str(p.label) : undefined} />,
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
    props: [{ name: 'inset', control: { kind: 'boolean' }, default: false }],
    events: [],
    layout: { axis: 'vertical', width: 'fill' },
    make: () => ({ children: [listSection('Section', ['First', 'Second', 'Third'])] }),
    render: ({ p, children }) => <List inset={!!p.inset}>{children}</List>,
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
    description: 'A row: a title, a subtitle, a trailing value and an accessory (chevron or check), with a leading view; swipe actions; pressable when it has an onPress.',
    module: '@/components/ui/list', tag: 'ListRow',
    slots: [{ name: 'leading', label: 'leading' }, { name: 'accessory', label: 'accessory (a control)' }],
    props: [
      { name: 'title', control: { kind: 'text' }, default: 'Title' },
      { name: 'subtitle', control: { kind: 'text' }, default: '' },
      { name: 'trailing', control: { kind: 'text' }, default: '' },
      { name: 'accessory', control: { kind: 'enum', options: values('none', 'chevron', 'check') }, default: 'chevron' },
      { name: 'checked', control: { kind: 'boolean' }, default: false },
      { name: 'destructive', control: { kind: 'boolean' }, default: false },
    ],
    events: [{ name: 'onPress', label: 'onPress' }],
    layout: { width: 'fill' },
    wrapperClass: '[&:last-child_[data-slot=list-row-content]]:[box-shadow:none]',
    render: ({ p, on, wired, slots }) => (
      <ListRow
        title={str(p.title)}
        subtitle={p.subtitle ? str(p.subtitle) : undefined}
        trailing={p.trailing ? str(p.trailing) : undefined}
        accessory={slots.accessory ?? (p.accessory === 'chevron' || p.accessory === 'check' ? p.accessory : undefined)}
        checked={!!p.checked}
        destructive={!!p.destructive}
        leading={slots.leading}
        onPress={wired('onPress') ? () => on.onPress?.() : undefined}
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
      { name: 'color', control: { kind: 'color' }, default: null },
      { name: 'src', control: { kind: 'text', placeholder: 'https://…' }, default: '' },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => (
      <Avatar name={str(p.name)} size={num(p.size, 40)} status={p.status && p.status !== 'none' ? (p.status as AvatarStatus) : undefined} color={cssColor(p.color as string | null)} src={p.src ? str(p.src) : undefined} />
    ),
  },
  AvatarGroup: {
    type: 'AvatarGroup', title: 'AvatarGroup', section: 'Lists and content', source: 'kit', icon: 'people',
    description: 'Overlapping avatars; past max the rest fold into a +N bubble, and pressing the group opens a menu of everyone.',
    module: '@/components/ui/avatar', tag: 'AvatarGroup', container: 'component',
    props: [
      { name: 'size', control: { kind: 'number', min: 16, max: 96, step: 1, unit: 'px' }, default: 32 },
      { name: 'max', control: { kind: 'number', min: 1, max: 12, step: 1 }, default: 4 },
      { name: 'menu', control: { kind: 'boolean' }, default: true },
      { name: 'label', control: { kind: 'text' }, default: 'People' },
    ],
    events: [{ name: 'onSelect', label: 'onSelect', value: 'the index pressed' }],
    layout: { axis: 'horizontal', width: 'fit' },
    make: () => ({ children: ['Ada', 'Miles', 'Noor', 'Theo', 'Hana', 'June'].map((name) => leaf('Avatar', { name, size: 32, status: 'none', color: null, src: '' }, { layout: { width: 'fit' } })) }),
    render: ({ p, on, childList }) => (
      <AvatarGroup size={num(p.size, 32)} max={num(p.max, 4)} menu={!!p.menu} label={str(p.label)} onSelect={(i) => on.onSelect?.(i)}>
        {childList}
      </AvatarGroup>
    ),
  },
  Disclosure: {
    type: 'Disclosure', title: 'Disclosure', section: 'Lists and content', source: 'kit', icon: 'chevron-down',
    description: 'Expandable sections on react-aria: a Disclosure with a trigger and an animated panel, grouped into an accordion.',
    module: '@/components/ui/disclosure', tag: 'Disclosure', container: 'component', focusable: true,
    uses: ['@/components/ui/disclosure|DisclosureTrigger', '@/components/ui/disclosure|DisclosurePanel'],
    props: [
      { name: 'title', control: { kind: 'text' }, default: 'When am I billed?', part: '<DisclosureTrigger>' },
      { name: 'isExpanded', control: { kind: 'boolean' }, default: true, twoWay: 'onExpandedChange' },
    ],
    events: [{ name: 'onExpandedChange', label: 'onExpandedChange', value: 'isExpanded' }],
    layout: { axis: 'vertical', gap: 8, width: 'fill' },
    make: () => ({ children: [leaf('Text', { children: 'On the same day each month you subscribed.', textStyle: 'subhead', weight: 'default', color: '$muted-foreground', align: 'left', lines: 0 }, { layout: { width: 'fill' } })] }),
    render: ({ p, on, children, box }) => (
      <Disclosure isExpanded={!!p.isExpanded} onExpandedChange={(v) => on.onExpandedChange?.(v)}>
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
    description: "A keycap for keyboard shortcuts, with a group wrapper for chords; inside a menu item it becomes the item's shortcut.",
    module: '@/components/ui/kbd', tag: 'Kbd',
    props: [text('children', '⌘K')], events: [], layout: { width: 'fit' },
    render: ({ p }) => <Kbd>{str(p.children)}</Kbd>,
  },
  QRSvg: {
    type: 'QRSvg', title: 'QRSvg', section: 'Lists and content', source: 'kit', icon: 'qrcode',
    description: 'A real, scannable QR code rendered as SVG paths, with rounded or square modules, four error-correction levels and any colors.',
    module: '@/components/ui/qr-svg', tag: 'QRSvg',
    props: [
      { name: 'value', control: { kind: 'text' }, default: 'https://blamy.github.io/ui/' },
      { name: 'size', control: { kind: 'number', min: 48, max: 400, step: 1, unit: 'px' }, default: 140 },
      { name: 'level', control: { kind: 'enum', options: values('L', 'M', 'Q', 'H') }, default: 'M' },
      { name: 'margin', control: { kind: 'number', min: 0, max: 8, step: 1 }, default: 1 },
    ],
    events: [],
    layout: { width: 'fit' },
    render: ({ p }) => <QRSvg value={str(p.value)} size={num(p.size, 140)} level={pick(p.level, ['L', 'M', 'Q', 'H'] as const, 'M')} margin={num(p.margin, 1)} />,
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
  TabView: {
    type: 'TabView', title: 'TabView', section: 'Navigation and layout', source: 'kit', icon: 'square-on-square',
    description: 'A compositional tab container on react-aria’s Tabs: the iOS tab bar at the bottom on a narrow screen and a side rail on a wide one, one panel per child (an embedded scene, usually a NavigationStack). Each tab keeps its state while another shows.',
    module: '@/components/ui/tab-view', tag: 'TabView', container: 'component', screen: true,
    uses: ['@/components/ui/tab-view|TabViewBar', '@/components/ui/tab-view|TabViewList', '@/components/ui/tab-view|TabViewTab', '@/components/ui/tab-view|TabViewPanels', '@/components/ui/tab-view|TabViewPanel'],
    props: [
      { name: 'tabs', control: { kind: 'items', icons: true }, default: 'First:star, Second:circle', part: '<TabViewTab>s', help: 'One per child, in order: Title:icon' },
      { name: 'selectedKey', label: 'selected', control: { kind: 'text' }, default: 'First', twoWay: 'onSelectionChange' },
      { name: 'placement', control: { kind: 'enum', options: values('auto', 'bottom', 'start', 'top') }, default: 'auto', help: 'auto: a tab bar along the bottom when narrow, a side rail when wide (≥ 700px), measured from its own width' },
    ],
    events: [{ name: 'onSelectionChange', label: 'onSelectionChange', value: 'the tab' }],
    layout: { axis: 'vertical', width: 'fill', height: 'fill' },
    render: (r) => <TabViewHost r={r} />,
  },
  SplitView: {
    type: 'SplitView', title: 'SplitView', section: 'Navigation and layout', source: 'kit', icon: 'sidebar-left',
    description: 'UISplitViewController, as composable parts: sidebar, supplementary and detail columns that tile when there’s room and collapse into a stack (with back buttons) on a narrow device. A Show Detail segue puts its scene in the detail column.',
    module: '@/components/ui/split-view', tag: 'SplitView', screen: true,
    uses: ['@/components/ui/split-view|SplitViewSidebar', '@/components/ui/split-view|SplitViewSupplementary', '@/components/ui/split-view|SplitViewDetail'],
    slots: [{ name: 'sidebar', label: 'sidebar' }, { name: 'supplementary', label: 'supplementary' }, { name: 'detail', label: 'detail' }],
    props: [
      { name: 'widthClass', control: { kind: 'enum', options: values('auto', 'compact', 'medium', 'regular') }, default: 'auto', help: 'auto: measured from its own width' },
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
    events: [{ name: 'onPress', label: 'onPress (an item)', value: 'the item' }],
    layout: { width: 'fill' },
    render: ({ p, on, wired }) => (
      <Breadcrumb size={pick(p.size, ['sm', 'default', 'lg'] as const, 'default')} items={itemsOf(p.items).map((it, i, all) => ({
        id: it.id, label: it.label, icon: it.icon, ...(i < all.length - 1 && wired('onPress') ? { onPress: () => on.onPress?.(it.id) } : null),
      }))} />
    ),
    code: (g) => {
      g.use('@/components/ui/breadcrumb', 'Breadcrumb');
      const press = g.handler('onPress');
      const items = g.list('items');
      const list = items
        ? `[${items.map((it, i) => `{ id: ${q(it.id)}, label: ${q(it.label)}${it.icon ? `, icon: ${q(it.icon)}` : ''}${press && i < items.length - 1 ? `, onPress: () => (${press})(${q(it.id)})` : ''} }`).join(', ')}]`
        : g.expr('items');
      return `<Breadcrumb${g.attr('size')} items={${list}} />`;
    },
  },
  Tabs: {
    type: 'Tabs', title: 'Tabs', section: 'Navigation and layout', source: 'kit', icon: 'rectangle-split',
    description: 'Tabs on react-aria with a sliding selection indicator and directional panels, in an iOS segmented look or a tinted underline. Each child is the panel of the tab at its place.',
    module: '@/components/ui/tabs', tag: 'Tabs', container: 'component', focusable: true,
    uses: ['@/components/ui/tabs|TabList', '@/components/ui/tabs|Tab', '@/components/ui/tabs|TabPanel'],
    props: [
      { name: 'tabs', control: { kind: 'items' }, default: 'Plan, Build, Review', part: '<Tab>s' },
      { name: 'selectedKey', label: 'selected', control: { kind: 'text' }, default: 'Plan', twoWay: 'onSelectionChange' },
      { name: 'variant', control: { kind: 'enum', options: values('segmented', 'underline') }, default: 'segmented' },
    ],
    events: [{ name: 'onSelectionChange', label: 'onSelectionChange', value: 'the tab' }],
    layout: { axis: 'vertical', width: 'fill' },
    make: () => ({ children: ['Plan', 'Build', 'Review'].map((t) => leaf('Stack', {}, { layout: { axis: 'vertical', gap: 8, padding: 4, width: 'fill' }, children: [leaf('Text', { children: `${t} panel`, textStyle: 'subhead', weight: 'default', color: '$muted-foreground', align: 'left', lines: 0 }, { layout: { width: 'fill' } })] })) }),
    render: ({ p, on, childList }) => {
      const tabs = itemsOf(p.tabs);
      return (
        <Tabs variant={pick(p.variant, ['segmented', 'underline'] as const, 'segmented')} selectedKey={str(p.selectedKey, tabs[0]?.id)} onSelectionChange={(k) => on.onSelectionChange?.(String(k))}>
          <TabList aria-label="Tabs">{tabs.map((t) => <Tab key={t.id} id={t.id}>{t.label}</Tab>)}</TabList>
          {tabs.map((t, i) => <TabPanel key={t.id} id={t.id}>{childList[i] ?? null}</TabPanel>)}
        </Tabs>
      );
    },
    code: (g) => {
      parts(g, '@/components/ui/tabs', 'Tabs', 'TabList', 'Tab', 'TabPanel');
      const tabs = g.list('tabs') ?? [];
      return `<Tabs${g.attr('variant')} selectedKey={${g.expr('selectedKey')}}${g.on('onSelectionChange', toKey)}>\n  <TabList aria-label="Tabs">\n${tabs.map((t) => `    <Tab id=${JSON.stringify(t.id)}>${t.label}</Tab>`).join('\n')}\n  </TabList>\n${tabs.map((t, i) => `  <TabPanel id=${JSON.stringify(t.id)}>\n${(g.children[i] ?? '').split('\n').map((l) => `    ${l}`).join('\n')}\n  </TabPanel>`).join('\n')}\n</Tabs>`;
    },
  },
  TabBar: {
    type: 'TabBar', title: 'TabBar', section: 'Navigation and layout', source: 'kit', icon: 'square-on-square', float: true,
    description: 'The iOS bottom tab bar in one component: icons over labels, a sliding indicator, hiding on scroll. It sits at the bottom of the scene.',
    module: '@/components/ui/tab-bar', tag: 'TabBar',
    props: [
      { name: 'items', control: { kind: 'items', icons: true }, default: 'Garden:flower, Calendar:calendar, Settings:gear' },
      { name: 'selected', control: { kind: 'text' }, default: 'Garden', twoWay: 'onSelect' },
    ],
    events: [{ name: 'onSelect', label: 'onSelect', value: 'the tab' }],
    render: ({ p, on }) => (
      <TabBar items={itemsOf(p.items).map((it) => ({ id: it.id, title: it.label, icon: it.icon ?? 'circle' }))} selected={str(p.selected)} onSelect={(id) => on.onSelect?.(id)} hideOnScroll={false} />
    ),
    code: (g) => {
      g.use('@/components/ui/tab-bar', 'TabBar');
      const items = g.list('items');
      const list = items ? `[${items.map((it) => `{ id: ${q(it.id)}, title: ${q(it.label)}, icon: ${q(it.icon ?? 'circle')} }`).join(', ')}]` : g.expr('items');
      return `<TabBar items={${list}} selected={${g.expr('selected')}}${g.on('onSelect')} />`;
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
  SyntaxHighlighting: {
    type: 'SyntaxHighlighting', title: 'SyntaxHighlighting', section: 'Editors and workbench', source: 'kit', icon: 'terminal',
    description: 'Code highlighted on the GPU by gpu-lexer: file header, copy button, line numbers, highlighted and diff lines, inline code.',
    module: '@/components/ui/syntax-highlighting', tag: 'SyntaxHighlighting',
    props: [
      { name: 'code', control: { kind: 'text', multiline: true, mono: true }, default: "const greeting = 'Hello';\nconsole.log(greeting);" },
      { name: 'language', control: { kind: 'enum', options: values('tsx', 'ts', 'js', 'json', 'css', 'bash', 'text') }, default: 'tsx' },
      { name: 'title', control: { kind: 'text' }, default: 'hello.ts' },
      { name: 'showCopy', control: { kind: 'boolean' }, default: true },
      { name: 'lineNumbers', control: { kind: 'boolean' }, default: false },
    ],
    events: [], layout: { width: 'fill' },
    render: ({ p }) => <SyntaxHighlighting code={str(p.code)} language={str(p.language, 'tsx')} title={p.title ? str(p.title) : undefined} showCopy={!!p.showCopy} lineNumbers={!!p.lineNumbers} />,
  },

  /* ── React ── */
  SceneRef: {
    type: 'SceneRef', title: 'Scene Component', section: 'React', source: 'react', icon: 'iphone',
    description: 'Another scene, rendered as a component (<Garden />): its props from bindings, its callback props from actions here, and everything in it selectable and editable in place. Xcode’s container view, and how a TabView or a NavigationStack holds a scene.',
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
    children: rows.map((t) => leaf('ListRow', { title: t, subtitle: '', trailing: '', accessory: 'chevron', checked: false, destructive: false }, { layout: { width: 'fill' }, slots: { leading: [], accessory: [] } })),
  });
}
