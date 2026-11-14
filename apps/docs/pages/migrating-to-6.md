# Migrating to 6.0

BL UI 6.0 keeps the look and changes what is underneath. Every interactive part is now built on [UI SDK](https://ui-sdk.dev) instead of react-aria-components, and its API is UI SDK's: `onClick` instead of `onPress`, `disabled` instead of `isDisabled`, `value` and `onValueChange(value, details)` instead of keys and selections, and roots with named parts instead of wrappers that take "the first child". This page lists every change, family by family, with the before and after.

The classes, tokens, radii, springs and sizes are the same as in 5.x. What you change is the props you pass, the parts you compose, and any CSS of yours that selected react-aria's state attributes.

## What changed and why

**UI SDK owns behavior.** Keyboard, focus, selection, dismissal, popups and their placement, drag and drop, and ARIA all come from UI SDK (`@ui-sdk/core` for the framework-free behaviors, `@ui-sdk/react` for the React parts). BL UI owns the look, the tokens and the iOS-flavored containers. A component that UI SDK ships (Button, Dialog, Popover, Menu, Select, Combobox, Tabs, Tooltip, Toast, Tree…) is UI SDK's part with BL UI's classes, so its props, parts and data attributes are the ones in UI SDK's docs. A component UI SDK does not ship (NavigationStack, SplitView, Credenza, Sidebar…) is a primitive built from UI SDK's behaviors, with the same conventions. Why UI SDK, and how the two fit, is on [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk).

**React 19 is required.** `react` and `react-dom` 19, and `@types/react` 19.2.10 or newer with TypeScript. `ref` is an ordinary prop on every part.

**react-aria is gone.** Neither the package nor a registry copy imports `react-aria`, `react-aria-components`, `@internationalized/date` or `react-resizable-panels` any more. Remove them from your app if nothing else of yours uses them. Dates are ISO strings (see [Dates](#dates)) and colors are CSS strings (see [Color](#color)).

### The `ui-sdk` cascade layer

UI SDK adds a little CSS to the page at runtime, in a cascade layer named `ui-sdk`: a rule that keeps closed parts hidden (`[data-slot][hidden]`, except `hidden="until-found"`), a reset for popup boxes (`[popover]` inset, size, margin, padding, border and background), the default backdrop of a modal sheet, the toast region's fixed position, and a few part defaults. Because it is in a layer, any style that is not in a layer, and any layer declared after it, wins over it.

Cascade layers rank in the order they are first declared, and a layer added at runtime without a declaration comes last, above every other layer. BL UI's own stylesheet (`@brett_lamy/ui/styles.css`) starts with `@layer ui-sdk, theme, base, components, docstream, utilities;`, so when it is the first stylesheet on the page there is nothing to do. When your app has its own Tailwind build (always, with a registry install), declare the layer at the very top of your global stylesheet, above `@import "tailwindcss"`, so your layers and utilities stay above UI SDK's rules:

```css
/* src/index.css */
@layer ui-sdk;
@import "tailwindcss";
```

A CSS Module loads too late to come first, so keep the line in the global stylesheet. With a Content Security Policy that has no `'unsafe-inline'` in `style-src`, give UI SDK your nonce with `<meta property="csp-nonce" nonce="…">` in the page's `<head>` (see "Content Security Policy" in UI SDK's [Styling and Animation](https://ui-sdk.dev) docs).

### Installing

BL UI uses its fork of UI SDK, published as `@brett_lamy/ui-sdk-core` and `@brett_lamy/ui-sdk-react` and installed under upstream's names through npm aliases. The fork is upstream plus layer hosts (popups contained in an element such as `BLProvider`'s root), a `when` option on `bindLayer`, and two exported kernel types; the other behaviors the containers need (size classes, the navigation stack, edge swipes, the platform back, pull to refresh) are BL UI's own, in `@/lib` (see [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk)). Every import, in the kit and in your code, is `@ui-sdk/core/…` and `@ui-sdk/react/…`.

With the npm package, `@brett_lamy/ui` depends on the two aliases, so installing it brings them:

{% command %}npm install @brett_lamy/ui@6 react@19 react-dom@19{% endcommand %}

With the registry, the copied source imports `@ui-sdk/core` and `@ui-sdk/react`, so your app needs the same two aliased dependencies. Add them before the first `shadcn add`:

{% command %}npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1{% endcommand %}

which writes:

```json
{
  "dependencies": {
    "@ui-sdk/core": "npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1",
    "@ui-sdk/react": "npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1"
  }
}
```

Pin both to the same version: `@ui-sdk/react` depends on `@ui-sdk/core`, and the app, the kit and any UI SDK component of your own must share one copy of the core. A package that declares `@ui-sdk/core` as a peer dependency resolves it to your aliased copy: Docstream 2.0 and the Docstream editor 2.0 (behind `MarkdownView`, `MarkdownEditor`, `Composer` and the replay, STL and Strudel parts) do, so they run on the same core as the kit. Your own code imports UI SDK the usual way: `import { Menu } from '@ui-sdk/react/menu'`.

## Changes that apply everywhere

Every component follows the same rules, so most of a migration is the same handful of renames.

| 5.x (react-aria) | 6.0 (UI SDK) | Notes |
| --- | --- | --- |
| `onPress={fn}` | `onClick={fn}` | A native `MouseEvent`, not a `PressEvent` (`e.pointerType` is gone; read `e.nativeEvent`). `onPressStart`, `onPressEnd`, `onPressChange`, `onPressUp` are gone: use `onPointerDown` / `onPointerUp`. |
| `isDisabled` | `disabled` | |
| `isReadOnly`, `isRequired`, `isInvalid` | `readOnly`, `required`, `invalid` on a `Field` (or `aria-invalid`) | |
| `isOpen`, `defaultOpen`, `onOpenChange(isOpen)` | `open`, `defaultOpen`, `onOpenChange(open, details)` | On the **root** (`Dialog`, `Popover`, `DropdownMenu`, `Select`…), not on a trigger wrapper or the content. |
| `isSelected`, `defaultSelected`, `onChange(isSelected)` | `checked` / `defaultChecked` / `onCheckedChange(checked, details)` (Switch, Checkbox) or `pressed` / `defaultPressed` / `onPressedChange(pressed, details)` (Toggle) | |
| `selectedKey(s)`, `defaultSelectedKey(s)`, `onSelectionChange(keys)` | `value`, `defaultValue`, `onValueChange(value, details)` | A single value is `T \| null`; a multiple one is `T[]`. Never a `Set`. `multiple` replaces `selectionMode="multiple"`. |
| `onChange(value)` on a value control | `onValueChange(value, details)` | `onChange` on an input is the native event handler again. |
| `minValue`, `maxValue` | `min`, `max` | |
| item `id`, `textValue` | item `value`, `label` | |
| `XSection title="…"` | `XGroup` + `XGroupLabel` | |
| `placement="bottom start"`, `offset`, `crossOffset` | `side="bottom" align="start"`, `sideOffset`, `alignOffset` | `start`/`end` sides are `side="inline-start"` / `"inline-end"`. |
| `isDismissable={false}`, `isKeyboardDismissDisabled` | `dismissible={false}` on the root | |
| `as`, `asChild`, `elementType`, wrapper components | `render={<a href="…" />}` | See [the render prop](#the-render-prop). |
| `composeRenderProps(className, fn)` | `cx(ours, className)` from `@/lib/utils` | |
| render props `{ isSelected, isHovered, isPressed, isFocusVisible }` | state `{ checked, pressed, selected, disabled, open… }` | Hover, press and focus are not state: use `hover:`, `active:`, `focus-visible:`. |
| `ref` to an imperative handle | a controller (`createXController()`, passed as `controller`) | See [controllers](#controllers). |
| `data-slot` values of our own | UI SDK's (`dialog-content`, `menu-item`, `tabs-tab`…) | Selectors in your CSS and tests change; each family's table lists them. |

```tsx
// 5.x
<Switch checked={wifi} onChange={setWifi} />
<Button variant="secondary" isDisabled={!dirty} onPress={save}>Save</Button>
<ToggleGroup selectionMode="single" selectedKeys={[view]} onSelectionChange={(keys) => setView([...keys][0] as View)}>
  <ToggleGroupItem id="list">List</ToggleGroupItem>
</ToggleGroup>

// 6.0
<Switch checked={wifi} onCheckedChange={setWifi} aria-label="Wi-Fi" />
<Button variant="secondary" disabled={!dirty} onClick={save}>Save</Button>
<ToggleGroup<View> value={[view]} onValueChange={([next]) => next && setView(next)} aria-label="View">
  <ToggleGroupItem value="list">List</ToggleGroupItem>
</ToggleGroup>
```

Defaults that used to name a control for you (`aria-label="Toggle"` on a Switch, `"Segmented control"` on a Segmented) are gone: name every control with a label part, `aria-label`, or by placing it in a `ListRow`, which still names its control.

### State selectors

Hover, press and keyboard focus are the platform's pseudo-classes; component state is UI SDK's data attributes. Translate any class or CSS of yours that used react-aria's attributes:

| 5.x | 6.0 |
| --- | --- |
| `data-hovered:` | `hover:` |
| `data-focus-visible:` | `focus-visible:` (a slider thumb: `has-focus-visible:`) |
| `data-pressed:` (held down) | `active:` |
| `data-focused:` | `focus:` or `focus-within:` |
| `data-selected` on Switch, Checkbox, Radio, Segmented | `data-checked` (Checkbox also `data-indeterminate`) |
| `data-selected` on Toggle, ToggleGroupItem, PlainToggleButton | `data-pressed` (a toggle that is on) |
| `data-focused` on a menu or list row | `data-highlighted` |
| `data-expanded` (disclosure) | `data-open` / `data-closed` |
| `data-entering` / `data-exiting` | `data-starting-style` / `data-ending-style` |
| `data-placement` | `data-side` (and `data-align`) |
| `--trigger-width`, `--trigger-anchor-point` | `--anchor-width`, `--transform-origin` |
| `data-current` | `aria-[current=page]:` |

`data-open`, `data-disabled`, `data-selected` (on options, tabs, rows), `data-invalid` and `data-dragging` remain; a part's own page lists its attributes. Enter and exit are transitions now: put the closed look on `data-starting-style` and `data-ending-style`, and the part stays mounted until its exit transition ends.

### Change details

Every change callback gets a second argument, `details`:

| Field | Meaning |
| --- | --- |
| `reason` | Why it changed: `"item-press"`, `"escape-key"`, `"outside-press"`, `"swipe"`, `"input-change"`, `"drag"`, `"imperative"` (a controller)… Each component lists its reasons. |
| `source` | How the user caused it: `"mouse"`, `"touch"`, `"pen"`, `"keyboard"`, `"virtual"`, `"agent"` or `"programmatic"`. For analytics and focus choices, not for behavior. |
| `event` | The DOM event behind it, when there is one. |
| `cancel()` | Stops the change (an uncontrolled component keeps its value; a dialog stays open). `details.canceled` says whether it was called. |

```tsx
<Dialog
  onOpenChange={(open, details) => {
    if (!open && details.reason === 'outside-press' && dirty) details.cancel()
  }}
>…</Dialog>
```

A `setState` still fits (`onOpenChange={setOpen}`), since it ignores the second argument. In tests, `toHaveBeenCalledWith(false)` becomes `toHaveBeenCalledWith(false, expect.anything())`.

### The render prop

A part renders one element. To make it another element, or one of your components, pass `render`: the part's props, ref and state attributes merge onto it, and the part's children become its children.

```tsx
// 5.x: the trigger was "the first pressable child"
<PopoverTrigger>
  <Button variant="secondary">Open</Button>
  <PopoverContent placement="bottom start">…</PopoverContent>
</PopoverTrigger>

// 6.0: a root, a trigger part with the button look, a content part
<Popover>
  <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Open</PopoverTrigger>
  <PopoverContent side="bottom" align="start">…</PopoverContent>
</Popover>
```

A popup trigger is already a button, so give it the kit's look with `buttonVariants` rather than `render={<Button />}`: a Button rendered inside a trigger is listed to agents twice under one name (the button and the popup). Keep `render` for when the element really changes, such as links: `<Button render={<a href="/docs" />}>Docs</Button>`, `<DropdownMenuItem render={<a href="/docs" />}>`, `<TabsTab render={<a href="…" />}>`.

### `className` and `style` as functions of state

A UI SDK part's `className` and `style` may be a string or a function of the part's state, so `composeRenderProps` is gone. To add classes to a part in a component of your own, merge with `cx` from `@/lib/utils` (`cn` for plain elements); the caller's classes merge last and win a conflict:

```tsx
import { cx } from '@/lib/utils'

function QuietToggle({ className, ...props }: ToggleProps) {
  return <Toggle className={cx('rounded-ctl data-pressed:bg-secondary', className)} {...props} />
}

<Toggle className={(state) => (state.pressed ? 'text-primary' : 'text-muted-foreground')} />
```

### Controllers

To drive a component from outside (open a dialog after an async flow, move a command menu's highlight, scroll a log to a row), create its controller once and pass it as `controller`. Every write through a controller reports `reason: "imperative"`.

```tsx
const [dialog] = useState(() => createDialogController())
<Dialog controller={dialog}>…</Dialog>
dialog.close()   // onOpenChange(false, { reason: 'imperative' }); works even when dismissible={false}
```

Controllers replace the imperative `ref` handles of 5.x (`LogListHandle`, `RequestTableHandle`, `WorkspaceImperativeHandle`, `CommandMenu`'s `menuRef`). A controller works only while its component is mounted.

### Popups render in the layer host

Popups (dialogs, sheets, menus, popovers, tooltips, toasts) render into the nearest `BLProvider` root, which is marked as a layer host, instead of `document.body`. A dialog opened inside a framed app covers the frame, not the page; a modal one makes the rest of the frame inert and leaves page scroll alone. Pass `container` to a popup root to put it elsewhere. `useLayerHost()` returns the host.

### Size classes follow the container

`presentation="auto"` (the default of `Credenza`, and an option on `Dialog`, `Popover`, `DropdownMenu`, `Select`, `Combobox` and `DatePicker`) is a sheet when the nearest **size-class scope** is compact, and the popup's own presentation when it is medium or regular, whatever the screen. The scope is a React context: `BLProvider`'s root, `SplitView`, `NavigationStack`, `SidebarProvider`, `SideDrawer` (with `presentation="auto"`) and `ArtifactChatContainer` each measure their own box and provide it, so a popup written in a compact column is a sheet even though it renders into `BLProvider`'s root. With no scope around it, UI SDK's own rule decides (a small touch screen). For a frame of your own, measure it with `useSizeClass()` and wrap its children in `<SizeClassProvider value={sizeClass}>` (both from `@/lib/container`); a `data-size-class` attribute alone doesn't change how popups present. See [Layout hooks](https://blamy.github.io/ui/#/hooks-layout).

### Tests

UI SDK's text controls listen to the native `input` event: `fireEvent.change(input, { target: { value } })` no longer reaches `onValueChange`, so use `fireEvent.input`. Set `globalThis.__UI_SDK_STRICT__ = true` in a test file to turn UI SDK's development warnings (an unnamed control, a missing part) into failures.

## Buttons and toggles

[Button](https://blamy.github.io/ui/#/button), [PlainButton](https://blamy.github.io/ui/#/plain-button), [Toggle](https://blamy.github.io/ui/#/toggle), [ToggleGroup](https://blamy.github.io/ui/#/toggle-group), [Segmented](https://blamy.github.io/ui/#/segmented), [Switch](https://blamy.github.io/ui/#/switch), [Checkbox](https://blamy.github.io/ui/#/checkbox), [RadioGroup](https://blamy.github.io/ui/#/radio-group), [Slider](https://blamy.github.io/ui/#/slider), [Progress](https://blamy.github.io/ui/#/progress), [ProgressRing](https://blamy.github.io/ui/#/progress-ring), [Separator](https://blamy.github.io/ui/#/separator), [Label](https://blamy.github.io/ui/#/label), [Kbd](https://blamy.github.io/ui/#/kbd), [Avatar](https://blamy.github.io/ui/#/avatar), [PencilKit](https://blamy.github.io/ui/#/pencilkit).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `button` | `isPending` | Return a Promise from `onClick`: the button is pending (`data-pending`, `aria-busy`) until it settles. There is no `pending` prop. |
| `button` | `ButtonProps` (react-aria props + `title`) | UI SDK `Button` props + `variant`, `size`, `active`. New: `focusableWhenDisabled`, `pendingAnnouncement`, `render`. `type` still defaults to `"button"`. |
| `plain-button` | `PlainButton onPress` | `PlainButton onClick` (UI SDK `Button`, unstyled) |
| `plain-button` | `PlainToggleButton isSelected / defaultSelected / onChange` | `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`; in a ToggleGroup it takes `value` (was `id`) |
| `plain-button` | `PlainButton`, `PlainToggleButton` components | UI SDK's `Button` and `Toggle` themselves, re-exported under those names (`PlainButton === Button`); same props, no wrapper in the tree |
| `toggle` | `Toggle isSelected / defaultSelected / onChange` | `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`. New: `ToggleIcon`, `createToggleController`. |
| `toggle-group` | `selectionMode="single" \| "multiple"` | `multiple` (single by default) |
| `toggle-group` | `selectedKeys` / `defaultSelectedKeys` (`Set`) | `value` / `defaultValue` (`string[]`) |
| `toggle-group` | `onSelectionChange(keys)` | `onValueChange(value: string[], details)` |
| `toggle-group` | `disallowEmptySelection` | `deselectable={false}` |
| `toggle-group` | `ToggleGroupItem id` | `ToggleGroupItem value` |
| `toggle-group` | sliding card `data-slot="toggle-group-indicator"` in each item | one `data-slot="selection-indicator"` in the group (filled single groups). Item slot is `toggle`. New: `createToggleGroupController`. |
| `segmented` | `options={[{ id, label }]} value onChange(id)` | `SegmentedItem value` children, `value` / `defaultValue` / `onValueChange(value \| null, details)`. `SegmentedOption` removed. |
| `segmented` | `aria-label` defaulted to `"Segmented control"` | No default: pass `aria-label` |
| `segmented` | slots `segmented`, `segmented-indicator` | `segmented-control`, `segmented-control-item`, `segmented-control-indicator`. New: `createSegmentedControlController`. |
| `switch` | `checked` (required) / `onChange(v)` | `checked` / `defaultChecked` / `onCheckedChange(checked, details)`; also `disabled`, `readOnly`, `required`, `name`, `value`, `controller` |
| `switch` | `aria-label` defaulted to `"Toggle"` | No default (a `ListRow` still names it) |
| `switch` | `label > input + span[switch-track] + span[switch-thumb]` | `button[role=switch]` (the root is the track) `> span[data-slot=switch-thumb]`. New: `SwitchThumb`, `createSwitchController`. |
| `checkbox` | `<Checkbox>Label</Checkbox>` (the root was the row) | `<Label variant="control"><Checkbox />Label</Label>` (the root is the box) |
| `checkbox` | `isSelected` / `defaultSelected` / `onChange` | `checked` / `defaultChecked` / `onCheckedChange(checked, details)` |
| `checkbox` | `isIndeterminate` | `checked="indeterminate"` |
| `checkbox` | `checkboxVariants` on the inner indicator (`group-data-selected:`) | on the root `button[role=checkbox]` (`data-checked:`, `data-indeterminate:`). New: `CheckboxIndicator`, `createCheckboxController`. |
| `checkbox` | `CheckboxGroup value / onChange(values)` | `value` / `defaultValue` / `onValueChange(values, details)`; `allValues` + a `Checkbox parent` is select-all. Name the group with `aria-label`. New: `createCheckboxGroupController`. |
| `radio-group` | `RadioGroup onChange(value)` | `onValueChange(value, details)` |
| `radio-group` | `<Radio value="a">Label</Radio>` | `<Label variant="control"><Radio value="a" />Label</Label>`; the dot is `RadioIndicator`. New: `createRadioGroupController`. |
| `radio-group` | `isInvalid`, `validate`, child `Label` / `FieldError` | Put the group in a `Field` (see [Forms](#forms-and-text-fields)) |
| `slider` | `minValue` / `maxValue`, `formatOptions` | `min` / `max`, `format` (Intl options or a function) |
| `slider` | `onChange` / `onChangeEnd` | `onValueChange(value, details)` / `onValueCommit(value, details)` |
| `slider` | `SliderTrack` (hit area, rail and fill) `> SliderThumb` | `SliderControl > SliderTrack > SliderIndicator + SliderThumb`. `SliderOutput` is `SliderValue`. New: `thumbLabels`, `createSliderController`. |
| `progress`, `progress-ring` | `minValue` / `maxValue`, `formatOptions`, `valueLabel`, `isIndeterminate` | `min` / `max`, `format`, `getValueLabel`, leave `value` out. New parts: `ProgressLabel`, `ProgressValue`, `ProgressTrack`, `ProgressIndicator`. ProgressRing's slot is `progress`. |
| `separator` | `elementType="div"` | `render={<div />}`; new `decorative` |
| `label` | auto-wired by its field's context | a native `<label>`: `htmlFor`, or wrap the control; inside a `Field`, use `FieldLabel`. New variant `control`. |
| `kbd` | react-aria `Keyboard` (a shortcut slot inside a menu item) | a plain `<kbd>`; new `keys="mod+k"` prop. In a menu, use the item's `shortcut`. |
| `avatar` | `src` drew an `<img>` over the initials, removed on error | `AvatarImage` shows once loaded; initials show while loading and on failure. New: `AvatarImage`, `AvatarFallback`, `onLoadingStatusChange`. |
| `avatar` | `AvatarGroup` overflow `data-slot="avatar-overflow"` | `data-overflow` attribute; its trigger slot is `dropdown-menu-trigger` |
| `avatar` | with `card`: a `<span role="img">` that only a pointer could open | the root is a `<button type="button">` named after the person, in the Tab order; focus opens the card after the delay, Escape closes it. Tests: `getByRole('img', { name })` → `getByRole('button', { name })` |
| `avatar` | status dot named `online` / `idle` / `dnd` / `offline` | `Online` / `Idle` / `Do not disturb` / `Offline` |
| `avatar` | `AvatarGroup menu={false}` with no `label`: a group with no name | named "N people" unless `label`, like the menu variant |
| `pencilkit` | `ToolPicker` / `InkPicker` / `WidthPicker onChange` | `onValueChange(value, details)`; `PencilToolButton onClick`, `disabled` |
| `pencilkit` | `PencilCanvas onStrokesChange(strokes, source: 'draw' \| 'erase')`, `PencilStrokesChangeSource` | `onStrokesChange(strokes, details)` with `details.reason`; types `PencilStrokesChangeDetails`, `PencilStrokesChangeReason` |
| `pencilkit` | `PencilToolbar` a plain `<div>`, `PencilActions` a `role="group"` usable anywhere | `PencilToolbar` is a UI SDK `Toolbar` ("Drawing tools", one tab stop); `PencilActions` is a `ToolbarGroup` and must sit inside a `PencilToolbar`; disabled actions use `aria-disabled` |

```tsx
// 5.x
<Segmented aria-label="View" options={[{ id: 'list', label: 'List' }, { id: 'grid', label: <Icon name="grid" /> }]} value={view} onChange={setView} />
<Checkbox defaultSelected onChange={setOn}>Remember me</Checkbox>
<RadioGroup value={plan} onChange={setPlan}>
  <Label>Plan</Label>
  <Radio value="monthly">Monthly</Radio>
</RadioGroup>
<Slider defaultValue={[20, 80]} minValue={0} maxValue={200} onChangeEnd={save}>
  <SliderTrack><SliderThumb index={0} /><SliderThumb index={1} /></SliderTrack>
</Slider>

// 6.0
<Segmented aria-label="View" value={view} onValueChange={(v) => v && setView(v)}>
  <SegmentedItem value="list">List</SegmentedItem>
  <SegmentedItem value="grid" aria-label="Grid"><Icon name="grid" /></SegmentedItem>
</Segmented>
<Label variant="control"><Checkbox defaultChecked onCheckedChange={setOn} />Remember me</Label>
<Label id="plan-label">Plan</Label>
<RadioGroup aria-labelledby="plan-label" value={plan} onValueChange={setPlan}>
  <Label variant="control"><Radio value="monthly" />Monthly</Label>
</RadioGroup>
<Slider defaultValue={[20, 80]} min={0} max={200} onValueCommit={save} aria-label="Price">
  <SliderControl>
    <SliderTrack>
      <SliderIndicator />
      <SliderThumb index={0} aria-label="Lowest price" />
      <SliderThumb index={1} aria-label="Highest price" />
    </SliderTrack>
  </SliderControl>
</Slider>
```

For Checkbox and Radio, a `className` that styled the old row (gap, text size, opacity) moves to the wrapping `Label`; one that styled the box stays and uses `data-checked:`. Children of a `Checkbox` are now a custom indicator, not its label. A Slider without children (`<Slider label="Volume" showValue />`) only changes prop names.

## Forms and text fields

[Field](https://blamy.github.io/ui/#/field), [Input](https://blamy.github.io/ui/#/input), [Textarea](https://blamy.github.io/ui/#/textarea), [SearchField](https://blamy.github.io/ui/#/search-field), [Form](https://blamy.github.io/ui/#/form), [FilterInput](https://blamy.github.io/ui/#/filter-input), [SqlEditor](https://blamy.github.io/ui/#/sql-console), [Spreadsheet](https://blamy.github.io/ui/#/spreadsheet).

`TextField` is gone. Its module is now `@/components/ui/field` (registry item `field`; the old item and file are deleted, with no alias), and `Field` owns only `name`, `disabled` and `invalid`: everything about the value moves onto the control.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `text-field` → `field` | `import … from '@/components/ui/text-field'` | `import … from '@/components/ui/field'` |
| `field` | `TextField`, `TextFieldProps` | `Field` (see the table below) |
| `field` | `Label` inside a field | `FieldLabel` (same `variant`s) |
| `field` | `FieldDescription` (a `<span>`) | `FieldDescription` (a `<p>`, `m-0`); right inside a `FieldSet` it describes the set |
| `field` | `FieldError` children `(validation) => validation.validationErrors…` | `FieldError` children `(state) => state.message`; `match?: boolean \| ValidityKey`. A static message needs `invalid` on the Field. |
| `field` | — | New: `FieldSet`, `FieldLegend`, `FieldGroup`, `FieldControl` (`render={<select />}` for a native control), `useFieldControl` |
| `input` | react-aria `Input` | UI SDK `Input`: native `onChange` still works; new `onValueChange(value, details)`, `controller`, `render`, `createInputController` |
| `input` | `data-focused`, `data-focus-visible`, `data-hovered`, `data-invalid` on a bare input | `focus:`, `focus-visible:`, `hover:`, `aria-invalid:`; `data-filled`, `data-disabled`, `data-readonly`, `data-required` (and `data-invalid` / `data-valid` / `data-focused` inside a `Field`) |
| `textarea` | react-aria `TextArea` | UI SDK `Textarea`; new `autoResize`, `submitShortcut` (`"enter"` \| `"mod+enter"`), `onSubmit(value, details)` |
| `search-field` | `onChange(value)` | `onValueChange(value, details)`; `reason` is `input-change`, `clear-press` (the button and Escape) or `imperative`. `onChange` is now the input's native handler. |
| `search-field` | `onSubmit(value)` | `onSubmit(value, details)`: `details` is UI SDK's change details (`reason` `enter-key` or `imperative`, `event`, `source`, `cancel()`); with `onSubmit`, Enter no longer submits a surrounding form, unless `details.cancel()` leaves the key to it. Agents can `submit` the field. New type `SearchFieldSubmitReason`. |
| `search-field` | a fixed prop list | every `Input` prop goes to the input (`disabled`, `name`, `controller`, `id`, `ref`…); `className` / `style` still style the pill |
| `form` | react-aria `Form` (`validationErrors`, `validationBehavior`) | a native `<form>` (`flex flex-col gap-5`); those two props are gone |
| `form` | `FormSection title description` | `FieldSet` + `FieldLegend` + `FieldDescription` from `field`; slot `form-section` → `field-set` |
| `filter-input` | `onValueChange(text)` | `onValueChange(text, details)` |
| `filter-input` | the result read out by a `role="status"` region inside it | UI SDK's `announce()` (`[data-ui-sdk-announcer]`); the input's `aria-describedby` is the hint only |
| `sql-editor` | `onChange`, `isDisabled`, `isReadOnly`, `isRunning` | `onValueChange(value, details)`, `disabled`, `readOnly`, `running` |
| `sql-editor` | Run on Ctrl+Enter or ⌘+Enter everywhere | ⌘+Enter on Apple platforms, Ctrl+Enter elsewhere (`submitShortcut="mod+enter"`) |
| `sql-editor` | textarea slot `sql-editor-input` | `textarea` (select `[data-slot=sql-editor] textarea`) |
| `sql-editor` | ⌥↑ / ⌥↓ step through `history`; Escape brings the draft back | ↑ with the caret on the first line and ↓ on the last (no modifier), UI SDK's `createInputHistory`; ↓ past the newest brings the draft back, and Escape is no longer claimed. A step reports `reason: 'imperative'` (Textarea has no `history-key` reason yet); cancel it in `onValueChange` and the key goes to the browser. |
| `sql-editor` | footer hint "⌘↵" and "⌥↑ history" on every platform | `Kbd keys="mod+enter"` and `keys="arrowup"`: ⌘↩ / ↑ on Apple platforms, Ctrl+Enter / Up elsewhere |
| `sql-editor` | `useSqlHistory(key?, max?)` on raw `localStorage`, this tab only | the same signature on UI SDK's `createLocalStorage`: the same JSON array under the same key, and it follows other tabs' writes; `clear()` removes the key |
| `spreadsheet` | `onChange(rows)`, `isReadOnly` | `onValueChange(rows, details)` (`reason` `cell-edit`, `paste`, `cut`, `clear`, `add-row`, `undo`, `redo`, `imperative`; `details.cancel()` refuses an uncontrolled change), `readOnly`; the cell editor slot is `spreadsheet-editor` |
| `spreadsheet` | `ref` to a `SpreadsheetHandle` (`focus`, `select(anchor, focus?)`, `undo`, `redo`) | `controller` from `createSpreadsheetController()`: `focus`, `select(anchor, end?)`, `edit(cell, text)`, `paste(text)`, `clear()`, `copy()`, `sort(col, dir?)`, `undo`, `redo`, `addRow`, `setColumnWidths`; each returns whether it did anything |
| `spreadsheet` | types `SpreadsheetCell { row, column }`, `SpreadsheetSelection { anchor, focus }` | UI SDK's `GridCell { row, col }` and `CellRange { anchor, end }` from `@ui-sdk/core` |
| `spreadsheet` | — | New: `columnWidths` / `defaultColumnWidths` / `onColumnWidthsChange(widths, details)`, types `SpreadsheetValueChangeReason`, `SpreadsheetColumnWidthsChangeReason` |
| `spreadsheet` | the grid focused with `aria-activedescendant`; a `[data-slot=spreadsheet-selection]` overlay; A1 selected before focus | roving focus on the `gridcell`s (read `document.activeElement`); cells carry `aria-selected`, `data-selected`, `data-active` and `data-range-edge` (`top right bottom left`) to style the outline from; nothing is active until focus enters. The sort result is announced with `announce()`. |
| `spreadsheet` | a paste without tabs guessed a CSV delimiter | a paste is tab-separated, as spreadsheets copy |

| On `<TextField>` in 5.x | In 6.0 |
| --- | --- |
| `name`, `isDisabled` | `name`, `disabled` on `<Field>` (or on the control) |
| `isInvalid` | `invalid` on `<Field>`: pass `true` or `undefined`, not `false` (`false` hides the browser's validation too) |
| `value`, `defaultValue`, `onChange(v)` | `value`, `defaultValue`, `onValueChange(v, details)` on the control |
| `isRequired`, `isReadOnly`, `type`, `autoComplete`, `autoFocus`, `inputMode`, `minLength`, `maxLength`, `pattern`, `aria-label` | `required`, `readOnly` and the rest on the control |
| `validate={(v) => message}` | No equivalent: compute the message, pass `invalid`, render it in `FieldError` |
| `validationBehavior="aria"` | No equivalent: native constraints show after a submit attempt, then live; for earlier errors compute `invalid` yourself |

```tsx
// 5.x
<TextField name="email" type="email" isRequired value={email} onChange={setEmail} isInvalid={taken} isDisabled={busy}>
  <Label variant="field">Email</Label>
  <Input placeholder="you@example.com" />
  <FieldDescription>We never share it.</FieldDescription>
  <FieldError />
</TextField>

// 6.0
<Field name="email" invalid={taken ? true : undefined} disabled={busy}>
  <FieldLabel variant="field">Email</FieldLabel>
  <Input type="email" required value={email} onValueChange={setEmail} placeholder="you@example.com" />
  <FieldDescription>We never share it.</FieldDescription>
  <FieldError />
</Field>
```

A custom rule and a server error:

```tsx
const problem = username.length < 3 ? 'Too short.' : ''

<Form onSubmit={save}>
  <Field name="username" invalid={problem ? true : undefined}>
    <FieldLabel variant="field">Username</FieldLabel>
    <Input value={username} onValueChange={setUsername} />
    <FieldError>{problem}</FieldError>
  </Field>
  <Field name="email" invalid={errors.email ? true : undefined}>
    <FieldLabel variant="field">Email</FieldLabel>
    <Input type="email" required onValueChange={() => setErrors({})} />
    <FieldError>{(state) => errors.email || state.message}</FieldError>
  </Field>
</Form>
```

```tsx
// 5.x
<FormSection title="Preferences" description="You can change these later in Settings.">{fields}</FormSection>
// 6.0
<FieldSet>
  <FieldLegend>Preferences</FieldLegend>
  {fields}
  <FieldDescription>You can change these later in Settings.</FieldDescription>
</FieldSet>
```

Other fields that borrowed `FieldDescription` and `FieldError` from `text-field` (DateField, DatePicker, Select, Combobox, RadioGroup, ColorField, TimeInput, CronEditor) import them from `@/components/ui/field` and sit inside a `<Field>`.

## Menus, selects and lists

[DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu), [ContextMenu](https://blamy.github.io/ui/#/context-menu), [Select](https://blamy.github.io/ui/#/select), [Combobox](https://blamy.github.io/ui/#/combobox), [Listbox](https://blamy.github.io/ui/#/list-box), [Breadcrumb](https://blamy.github.io/ui/#/breadcrumb), [TailscaleMenu](https://blamy.github.io/ui/#/tailscale-menu).

Rules for the whole family: items take `value` (was `id`) and `label` (was `textValue`); open state is on the root; sections are `…Group` + `…GroupLabel`; render-function collection children are gone (map children, or pass `items` to the root with an **empty** content part); `popoverClassName` and `className` merge into the content part's `className` (it is the popup and the list in one element); the open, active row is `data-highlighted`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `dropdown-menu` | `DropdownMenu` = `MenuTrigger`, first pressable child is the trigger | `DropdownMenu` root (`open`, `onOpenChange`, `onAction(value, details)`, `items`, `presentation`, `modal`, `loop`, `controller`…) + `DropdownMenuTrigger` (`className={buttonVariants({ … })}`) |
| `dropdown-menu` | `DropdownMenuContent aria-label onAction selectionMode selectedKeys disabledKeys items placement popoverClassName` | `DropdownMenuContent side align sideOffset alignOffset finalFocus keepMounted className`; `onAction` moves to the root (and sees submenu rows); no `aria-label` needed; `disabled` on each item |
| `dropdown-menu` | `DropdownMenuItem id variant="destructive" shortcut={<DropdownMenuShortcut>⌘R</…>} onAction href isDisabled` | `value`, `destructive`, `shortcut="mod+r"` (drawn per platform, sets `aria-keyshortcuts`), `onSelect(event)`, `render={<a href />}`, `disabled`, `closeOnSelect` |
| `dropdown-menu` | selectable items via `selectionMode` | `DropdownMenuCheckboxItem` (`checked`, `onCheckedChange`) and `DropdownMenuRadioGroup` (`value`, `onValueChange`) + `DropdownMenuRadioItem` |
| `dropdown-menu` | `DropdownMenuSection title`, `DropdownMenuLabel` | `DropdownMenuGroup` + `DropdownMenuGroupLabel` |
| `dropdown-menu` | `DropdownMenuSub` wrapping an item and a content | `DropdownMenuSub` wrapping `DropdownMenuSubTrigger` + `DropdownMenuSubContent` |
| `dropdown-menu` | `dropdownMenuItemVariants({ variant })`, generic `…Props<T>` | `dropdownMenuItemVariants()` (destructive is `data-destructive:`), non-generic props. New: `DropdownMenuItems`, `createMenuController`, `MenuData`. |
| `context-menu` | `ContextMenu` was the area `div` (`className`, `isDisabled`, `longPressDelay`, `anchor`) | `ContextMenu` root (no element) + `ContextMenuTrigger` (the area: `className`, `disabled`); `longPressDelay` and `anchor` removed. The area is no longer `relative`. |
| `context-menu` | `ContextMenuSection`, `ContextMenuLabel` | `ContextMenuGroup`, `ContextMenuGroupLabel`; new checkbox, radio and sub parts as in DropdownMenu |
| `select` | `Select` rendered a label/trigger/error column; `onChange(key)`, `selectionMode`, `isInvalid`, `className` | `Select` renders no element: wrap it in a `Field`. `onValueChange(value \| null, details)`, `multiple`, `items`, `disabled`, `required`, `readOnly`, `name`… |
| `select` | `Label` child | `FieldLabel` in the `Field`, `SelectLabel`, or `aria-label` on `SelectTrigger` |
| `select` | `SelectTrigger` role `button` | role `combobox` |
| `select` | `SelectContent items placement popoverClassName renderEmptyState` | `SelectContent side align sideOffset keepMounted className`; `items` on the root |
| `select` | `SelectItem id textValue isDisabled`, `SelectSection title` | `SelectItem value label disabled`, `SelectGroup` + `SelectGroupLabel`. New: `SelectSeparator`, `createSelectController`. |
| `combobox` | `ComboBox`, `ComboBoxInput`, `ComboBoxContent`, `ComboBoxItem`, `ComboBoxSection` | `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxItem`, `ComboboxGroup` + `ComboboxGroupLabel` (lower-case **b**, no alias) |
| `combobox` | the root rendered a label column | no element: wrap it in a `Field` |
| `combobox` | `defaultItems` / `items` + render function, `defaultFilter` | `items` (filtered by `filter`, default `'contains'` on `label` + `keywords`; `filter={false}` shows them as given) |
| `combobox` | `inputValue` / `onInputChange` | `query` / `defaultQuery` / `onQueryChange(query, details)` |
| `combobox` | `allowsCustomValue` | `allowCustomValue` (Enter makes the typed text the value) |
| `combobox` | `allowsEmptyCollection` + `renderEmptyState` | `<ComboboxEmpty>` beside `<ComboboxList>` in the content |
| `combobox` | `menuTrigger` | removed; open on focus with a controller's `open()` |
| `combobox` | chevron slot `combobox-button` | `combobox-trigger`. New: `ComboboxLabel`, `ComboboxSeparator`, `createComboboxController`. |
| `list-box` | `selectionMode` (default `none`), `selectedKeys`, `onSelectionChange`, `disallowEmptySelection`, `onAction`, `items` + render function | always selects (single by default): `value` / `onValueChange`, `multiple`, `activation`, `deselectable`, `items`. In a single list the arrow keys select; pass `activation="manual"` if moving must not change the value. |
| `list-box` | `ListBox`, `ListBoxItem`, `ListBoxProps`, `ListBoxItemProps`, `listBoxVariants`, `listBoxItemVariants` | `Listbox`, `ListboxItem`, `ListboxProps`, `ListboxItemProps`, `listboxVariants`, `listboxItemVariants` (UI SDK's spelling, lower-case **b**; the module stays `@/components/ui/list-box`) |
| `list-box` | `ListBoxItem id textValue isDisabled onAction href` | `value`, `label`, `disabled`; a per-item action is an `onClick` on the item, or a menu |
| `list-box` | `ListBoxSection`, `ListBoxHeader` | `ListboxGroup`, `ListboxGroupLabel`. New: `ListboxSeparator`, `createListboxController`. |
| `breadcrumb` | `onPress` on entries, `id: Key` | `onClick`, `id: string \| number` |
| `breadcrumb` | react-aria `Link`s through a `RouterProvider` | native `<a href>` links (full navigation unless something above intercepts them); for client routing give the entry `onClick={() => navigate(path)}` and no `href` |
| `breadcrumb` | `BreadcrumbEntry.label: ReactNode` + `textValue` for a rich label | `label: string`, the plain-text name (menus type-select by it); rich content goes in the new `children`. `{ label: <b>ui</b>, textValue: 'ui' }` becomes `{ label: 'ui', children: <b>ui</b> }`. `BreadcrumbItem label` is a string too. |
| `breadcrumb` | collapsing measured in React effects | the `breadcrumb` primitive (`lib/breadcrumb-primitive.ts`): root `data-collapsed` while items are hidden, `data-current` on the last shown item, and an agent entry named by `aria-label` with `activate(value)` |

```tsx
// 5.x
<DropdownMenu>
  <Button variant="secondary" size="icon" aria-label="More"><Icon name="ellipsis" /></Button>
  <DropdownMenuContent aria-label="Photo actions" onAction={(key) => run(String(key))}>
    <DropdownMenuSection title="Sort by" selectionMode="single" selectedKeys={new Set([sort])}
      onSelectionChange={(keys) => keys !== 'all' && setSort([...keys][0] as string)}>
      <DropdownMenuItem id="name">Name</DropdownMenuItem>
    </DropdownMenuSection>
    <DropdownMenuItem id="rename" shortcut={<DropdownMenuShortcut>⌘R</DropdownMenuShortcut>}>Rename</DropdownMenuItem>
    <DropdownMenuItem id="delete" variant="destructive" onAction={remove}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// 6.0
<DropdownMenu onAction={(value) => run(value)}>
  <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label="More">
    <Icon name="ellipsis" />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
      <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
      <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
    <DropdownMenuItem value="rename" shortcut="mod+r">Rename</DropdownMenuItem>
    <DropdownMenuItem value="delete" destructive onSelect={remove}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

A menu from data: `<DropdownMenu items={branches.map((b) => ({ value: b.name, label: b.name }))} onAction={checkout}>` with a trigger and an empty `<DropdownMenuContent />` (the content part must be placed, even empty). Data entries are strings or `{ value, label, disabled? }`, `{ type: 'group', label, items }` and `{ type: 'separator' }`.

```tsx
// 5.x
<ContextMenu className="rounded-xl" isDisabled={locked}>
  <Tile />
  <ContextMenuContent aria-label="Tile actions" onAction={run}>
    <ContextMenuItem id="copy">Copy</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>

// 6.0
<ContextMenu onAction={run}>
  <ContextMenuTrigger className="rounded-xl" disabled={locked}><Tile /></ContextMenuTrigger>
  <ContextMenuContent aria-label="Tile actions">
    <ContextMenuItem value="copy">Copy</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

Give `ContextMenuTrigger` `tabIndex={0}` if nothing inside it is focusable, so the menu key and Shift+F10 reach it.

```tsx
// 5.x
<Select value={repeat} onChange={(key) => setRepeat(key as string)} isInvalid={bad} className="w-60">
  <Label variant="field">Repeat</Label>
  <SelectTrigger />
  <SelectContent items={repeats} placement="bottom end">{(r) => <SelectItem id={r.id}>{r.name}</SelectItem>}</SelectContent>
  <FieldError>Pick one.</FieldError>
</Select>

// 6.0
<Field invalid={bad ? true : undefined} className="w-60">
  <FieldLabel variant="field">Repeat</FieldLabel>
  <Select items={repeats.map((r) => ({ value: r.id, label: r.name }))} value={repeat} onValueChange={setRepeat}>
    <SelectTrigger />
    <SelectContent align="end" />
  </Select>
  <FieldError>Pick one.</FieldError>
</Field>
```

```tsx
// 5.x
<ComboBox defaultItems={people} value={id} onChange={setId} allowsEmptyCollection>
  <Label variant="field">Assignee</Label>
  <ComboBoxInput placeholder="Search the team" />
  <ComboBoxContent renderEmptyState={() => <p>No one matches.</p>}>
    {(p) => <ComboBoxItem id={p.id} textValue={p.name}>{p.name}</ComboBoxItem>}
  </ComboBoxContent>
</ComboBox>

// 6.0
<Field>
  <FieldLabel variant="field">Assignee</FieldLabel>
  <Combobox items={people.map((p) => ({ value: p.id, label: p.name, keywords: [p.email] }))} value={id} onValueChange={setId}>
    <ComboboxInput placeholder="Search the team" />
    <ComboboxContent>
      <ComboboxEmpty>No one matches.</ComboboxEmpty>
      <ComboboxList />
    </ComboboxContent>
  </Combobox>
</Field>
```

```tsx
// 5.x
<ListBox aria-label="Share with" selectionMode="multiple" selectedKeys={set} onSelectionChange={setSet}>
  {people.map((p) => <ListBoxItem key={p.id} id={p.id} textValue={p.name}>{p.name}</ListBoxItem>)}
</ListBox>

// 6.0
<Listbox aria-label="Share with" multiple value={ids} onValueChange={setIds}>
  {people.map((p) => <ListboxItem key={p.id} value={p.id} label={p.name}>{p.name}</ListboxItem>)}
</Listbox>
```

A `Selection` becomes a `string[]` (`'all'` has no equivalent: pass every value). An action list with nothing selected: `<Listbox value={null} activation="manual" onValueChange={(v) => v && run(v)}>`, or a DropdownMenu or CommandMenu.

| 5.x slot | 6.0 slot |
| --- | --- |
| `dropdown-menu`, `dropdown-menu-content` | `menu-content` |
| `dropdown-menu-item` | `menu-item`, `menu-checkbox-item`, `menu-radio-item`; a submenu row `menu-trigger` |
| `dropdown-menu-section`, `dropdown-menu-label`, `dropdown-menu-separator`, `dropdown-menu-shortcut` | `menu-group` (`menu-radio-group`), `menu-group-label`, `menu-separator`, `menu-shortcut` |
| `context-menu` | `menu-context-trigger` |
| `select` (root) | none; `select-trigger`, `select-value`, `select-content`, `select-item`, `select-group`, `select-group-label`, `select-separator` |
| `combobox` (root), `combobox-button` | none, `combobox-trigger`; `combobox-input` is the `<input>`; new `combobox-list`, `combobox-empty`, `combobox-group` |
| `list-box`, `list-box-item`, `list-box-section`, `list-box-header` | `listbox`, `listbox-item`, `listbox-group`, `listbox-group-label`, `listbox-separator` |

## Overlays

[Popover](https://blamy.github.io/ui/#/popover), [Tooltip](https://blamy.github.io/ui/#/tooltip), [HoverCard](https://blamy.github.io/ui/#/hover-card), [Dialog](https://blamy.github.io/ui/#/dialog), [Sheet](https://blamy.github.io/ui/#/sheet), [Passkey vault](https://blamy.github.io/ui/#/passkey-vault).

Every overlay is a root + a trigger part + a content part. The trigger has no look of its own: move the old child Button's `variant` and `size` into `className={buttonVariants({ … })}` on the trigger and its children into the trigger. Modal overlays need an explicit **backdrop** part for the scrim (`DialogBackdrop`, `AlertDialogBackdrop`, `SheetBackdrop`); without one there is no dim. Render-function children `{({ close }) => …}` are gone: close with a Close part (`DialogClose`, `AlertDialogClose`, `PopoverClose`, `SheetClose`), which takes `action` (runs first; a returned Promise keeps the overlay open and the part pending) and `value` (comes back as `details.returnValue`), or with a controller.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `popover` | `PopoverTrigger` wrapper with `isOpen` / `onOpenChange` | `Popover` root (`open`, `onOpenChange`, `modal`, `openOnHover`, `delay`, `closeDelay`, `presentation`, `controller`, `container`) + `PopoverTrigger` part |
| `popover` | `Popover` = a bare styled surface (used with a `Dialog` or `ListBox` inside) | removed as a surface: `<PopoverContent variant="surface">` inside a `<Popover>`. Selects, comboboxes and menus own their own content parts. |
| `popover` | `PopoverContent` (`placement`, `offset`, `{close}` children) | `PopoverContent` (`variant: 'panel' \| 'surface'`, `side`, `align`, `sideOffset` 8, `alignOffset`, `initialFocus`, `finalFocus`, `keepMounted`). Name it with `PopoverTitle` (`className="sr-only"` to hide it): an `aria-label` on the content loses to the trigger's name. |
| `popover` | `<Heading slot="title">`, `close()` | `PopoverTitle`, `<PopoverClose render={<Button size="sm" />}>Done</PopoverClose>`. New: `PopoverArrow`, `PopoverDescription`, `createPopoverController`. |
| `tooltip` | `TooltipTrigger` wrapper (`delay` 500, `closeDelay` 200, `isOpen`, `isDisabled`, `trigger`) + `Tooltip` content | `Tooltip` root (`delay`, `closeDelay`, `open`, `disabled`, `type`, `toggleable`, `closeOnPress`, `shortcut`, `controller`) + `TooltipTrigger` part + `TooltipContent` (`side` top, `arrow`). `trigger="focus"` has no equivalent. |
| `tooltip` | `TooltipProps` = content props | `TooltipProps` = root props; `TooltipContentProps` = content props. New: `TooltipArrow`, `TooltipShortcut`, `createTooltipController`. |
| `tooltip` | always `aria-describedby` | names a trigger that has no name (`aria-labelledby`) and describes the others; `type` overrides |
| `hover-card` | `HoverCardTrigger` = a wrapper `<span>` around its first child | `HoverCard` root (`delay` 600, `closeDelay` 300, `open`, `disabled`, `controller`) + `HoverCardTrigger`, which **is** the element (an `<a>` by default: `href`, or `render={<button aria-label="…" />}`) |
| `hover-card` | `HoverCard` = the card (`placement`, `contentClassName`, `triggerRef`) | `HoverCardContent` (`side` bottom, `align`, `sideOffset`, `arrow` default false); merge `contentClassName` into `className` |
| `hover-card` | `useHoverCard()` | removed: `createHoverCardController<Payload>()` with `HoverCardTrigger controller payload`, or `controller.open({ anchor, payload })` for targets you hit-test yourself |
| `hover-card` | one card open at a time across independent cards, the next opening instantly | only within one shared controller; independent cards each wait their `delay`. Keyboard focus opens after the same delay. |
| `dialog` | `DialogTrigger` wrapper | `Dialog` root (`open`, `onOpenChange`, `dismissible`, `modal`, `presentation`, `controller`, `container`) + `DialogTrigger` part |
| `dialog` | `DialogContent` = overlay + modal + dialog (`size`, `isDismissable`, `role`, `overlayClassName`, `{close}`) | `DialogContent` (`size: 'default' \| 'lg'`, `initialFocus`, `finalFocus`) + a separate `DialogBackdrop` (`overlayClassName` → its `className`) |
| `dialog` | `size="alert"`, `DialogAction` | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogBackdrop`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter` (`orientation`), `AlertDialogClose` (`variant: default \| cancel \| destructive`, `value`, `action`) |
| `dialog` | `DialogClose` = always the round × | alone, the round ×; with children or `render`, any element that closes (`value`, `action`, `disabled`) |
| `dialog` | `dialogOverlayClass` | removed. New: `createDialogController`, `createAlertDialogController`, `createConfirm`. |
| `sheet` | `Sheet` wrapper + `SheetContent side` | `Sheet` root (UI SDK's Drawer: `side`, `open`, `onOpenChange`, `dismissible`, `modal`, `snapPoints`, `snapPoint`, `onSnapPointChange`, `physics`, `controller`) + `SheetTrigger` + `SheetBackdrop` + `SheetContent` (`grabber`, `animateHeight`) |
| `sheet` | sheets only animated in and out | every side follows a drag and springs back or away (reason `swipe`); `dismissible={false}` stops the swipe. New: `SheetHandle`, `createSheetController`. |
| `passkey-enroll-dialog` | `isOpen`, `onOpenChange(open)` | `open`, `onOpenChange(open, details)` |
| `lib/primitives` | `focusRing` on `data-focus-visible:`; `popoverMotion` on `data-entering` / `data-exiting` | `focus-visible:`; transitions on `data-starting-style` / `data-ending-style`, `origin-(--transform-origin)`, `data-[side=…]`. |

```tsx
// 5.x
<DialogTrigger onOpenChange={(open) => open && reset()}>
  <Button variant="secondary">Rename…</Button>
  <DialogContent overlayClassName="backdrop-blur-sm">
    {({ close }) => (<>
      <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onPress={close}>Cancel</Button>
        <Button isDisabled={empty} onPress={() => { save(); close() }}>Save</Button>
      </DialogFooter>
    </>)}
  </DialogContent>
</DialogTrigger>

// 6.0
<Dialog onOpenChange={(open) => open && reset()}>
  <DialogTrigger className={buttonVariants({ variant: 'secondary' })}>Rename…</DialogTrigger>
  <DialogBackdrop className="backdrop-blur-sm" />
  <DialogContent>
    <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
    <DialogFooter>
      <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
      <DialogClose render={<Button />} disabled={empty} value="save" action={save}>Save</DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

```tsx
// 5.x
<DialogTrigger>
  <Button variant="destructive">Delete…</Button>
  <DialogContent size="alert">
    <DialogHeader><DialogTitle>Delete photo?</DialogTitle></DialogHeader>
    <DialogFooter orientation="vertical">
      <DialogAction variant="cancel">Cancel</DialogAction>
      <DialogAction variant="destructive" onPress={del}>Delete</DialogAction>
    </DialogFooter>
  </DialogContent>
</DialogTrigger>

// 6.0
<AlertDialog>
  <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete…</AlertDialogTrigger>
  <AlertDialogBackdrop />
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Delete photo?</AlertDialogTitle></AlertDialogHeader>
    <AlertDialogFooter orientation="vertical">
      <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
      <AlertDialogClose variant="destructive" value="confirm" action={del}>Delete</AlertDialogClose>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Focus starts on the first `AlertDialogClose`, so put the safe answer first. An outside press never closes an alert; Escape does unless `dismissible={false}`. To ask from code: `const confirm = createConfirm()`, `<AlertDialog controller={confirm.controller}>…`, then `if (await confirm()) …` (it resolves `true` for `value="confirm"`).

```tsx
// 5.x
<Sheet>
  <Button variant="secondary">Filters</Button>
  <SheetContent side="right" aria-label="Filters" isDismissable={false}>
    {({ close }) => <SheetFooter><Button size="pill" onPress={() => { apply(); close() }}>Apply</Button></SheetFooter>}
  </SheetContent>
</Sheet>

// 6.0
<Sheet side="right" dismissible={false}>
  <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Filters</SheetTrigger>
  <SheetBackdrop />
  <SheetContent aria-label="Filters">
    <SheetFooter><SheetClose render={<Button size="pill" />} action={apply}>Apply</SheetClose></SheetFooter>
  </SheetContent>
</Sheet>
```

```tsx
// 5.x: useHoverCard on an element you render
const card = useHoverCard<HTMLDivElement>()
<div {...card.triggerProps} tabIndex={0}>…</div>
<HoverCard {...card.cardProps} placement="right top">…</HoverCard>

// 6.0: make the element the trigger
<HoverCard>
  <HoverCardTrigger render={<div tabIndex={0} aria-label="Q3 revenue" />}>…</HoverCardTrigger>
  <HoverCardContent side="right" align="start">…</HoverCardContent>
</HoverCard>

// 6.0: many triggers, one card (lists, avatar groups, feeds)
const [previews] = useState(() => createHoverCardController<Row>())
{rows.map((r) => (
  <HoverCardTrigger key={r.id} controller={previews} payload={r} render={<div className="flex w-full" />}><RowView r={r} /></HoverCardTrigger>
))}
<HoverCard controller={previews}>
  <HoverCardContent side="right" align="start">{({ payload }) => payload && <Preview row={payload} />}</HoverCardContent>
</HoverCard>
```

For a target you hit-test yourself (a canvas item, a map pin), call `controller.open({ anchor: element or { x, y }, payload })` and `controller.close()`; they are immediate (there is no `openSoon`).

| 5.x slot | 6.0 slot |
| --- | --- |
| `popover`, `popover-content` | `popover-content` (the surface); `popover-trigger`, `popover-title`, `popover-description`, `popover-close`, `popover-arrow` |
| `tooltip` | `tooltip-content`; `tooltip-trigger`, `tooltip-arrow`, `tooltip-shortcut` |
| `hover-card-trigger` (a span), `hover-card` | `hover-card-trigger` (the element itself), `hover-card-content` |
| `dialog-overlay`, `dialog-content` (modal), `dialog`, `dialog-action` | `dialog-backdrop`, `dialog-content` (the card, `role=dialog`), `dialog-trigger`, `dialog-title`, `dialog-description`, `dialog-close`; `alert-dialog-*` for alerts |
| `sheet-overlay`, `sheet`, `sheet-content` | `drawer-backdrop`, `drawer-viewport`, `drawer-content` (`data-side`, `data-dragging`), `drawer-trigger`, `drawer-title`, `drawer-close`, `drawer-handle` |

## Tabs, disclosure and scroll areas

[Tabs](https://blamy.github.io/ui/#/tabs), [TabView](https://blamy.github.io/ui/#/tab-view), [TabBar](https://blamy.github.io/ui/#/tab-bar), [Disclosure and DisclosureGroup](https://blamy.github.io/ui/#/disclosure), [ScrollArea](https://blamy.github.io/ui/#/scroll-area).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `tabs` | `TabList`, `Tab`, `TabPanel`, `tabVariants` | `TabsList` (draws the sliding indicator), `TabsTab`, `TabsPanel`, `tabsTabVariants`. New: `TabsTabIcon`, `tabsIndicatorVariants`, `createTabsController`. |
| `tabs` | `selectedKey` / `defaultSelectedKey` / `onSelectionChange` | `value` / `defaultValue` / `onValueChange(value \| null, details)`; reasons `item-press`, `list-navigation`, `find-in-page`, `item-removed`, `imperative` |
| `tabs` | `Tab id`, `TabPanel id shouldForceMount` | `TabsTab value`, `TabsPanel value keepMounted` (unselected panels unmount) |
| `tabs` | `keyboardActivation="manual"`, `isDisabled` / `disabledKeys` | `activation="manual"`, `disabled` on each `TabsTab` |
| `tabs` | `TabDirection`, `useTabPanelDirection()` | removed: panels read `data-activation-direction` and `data-starting-style` |
| `tabs` | slots `tab-list`, `tab`, `tab-indicator`, `tab-panel` | `tabs-list`, `tabs-tab`, `tabs-indicator`, `tabs-panel` |
| `tab-view` | `selectedKey` / `onSelectionChange`, `TabViewTab id textValue`, `TabViewPanel id shouldForceMount` | `value` / `onValueChange`, `TabViewTab value`, `TabViewPanel value keepMounted` |
| `tab-view` | `TabViewIndicator` inside each tab; `variant="pill" attention` | one `TabViewIndicator` inside `TabViewList`; `TabViewPill attention` inside each tab |
| `tab-view` | tab render state `{ isSelected, isHovered, … }` | `{ selected, disabled }`; hover with `group-hover/tab:` |
| `tab-view` | `TabViewAction onPress isDisabled`, `TabViewPanels items` | `onClick`, `disabled`; `TabViewPanels` is a plain `div` |
| `tabs`, `tab-view` | a tab was a `div` | UI SDK's tab, a `<button type="button">` (the kit resets its border, background and font); a tab that holds controls of its own takes `render={<div />}` |
| `tab-view` | `data-placement` on `TabView` and `TabViewBar` | `data-bar-placement` (`top`, `bottom`, `start`, `end`) |
| `tab-bar` | `items[].id`, `selected`, `onSelect(id)` | `items[].value`, `value` / `defaultValue`, `onValueChange(value, details)`; new `aria-label` (default "Tabs") |
| `disclosure` | `DisclosureGroup` of `Disclosure`s, `expandedKeys` / `onExpandedChange` (`Set`), `allowsMultipleExpanded` | `DisclosureGroup` (UI SDK Accordion) of `DisclosureGroupItem`s, `value` / `onValueChange(string[], details)`, `multiple`; new `collapsible`, `keepMounted`, `hiddenUntilFound` |
| `disclosure` | standalone `Disclosure isExpanded / onExpandedChange` | `Disclosure open / onOpenChange(open, details)` (UI SDK Collapsible) |
| `disclosure` | `DisclosureTrigger level={3}` | standalone: no heading built in; in a group: `DisclosureGroupHeader` (h3, `render={<h4 />}`) wraps `DisclosureGroupTrigger` |
| `disclosure` | `Accordion`, `AccordionItem id`, `AccordionTrigger`, `AccordionContent` | `DisclosureGroup`, `DisclosureGroupItem value`, `DisclosureGroupHeader` + `DisclosureGroupTrigger`, `DisclosureGroupPanel` (the `Accordion*` names are gone: one name per part) |
| `disclosure` | `data-expanded`, `--disclosure-panel-height` | `data-open` / `data-closed`, `--collapsible-panel-height` / `--accordion-panel-height` |
| `scroll-area` | `<ScrollArea>` = one scrolling div | `ScrollArea > ScrollAreaViewport > ScrollAreaContent`; `aria-label`, `onScroll` and a scroll `ref` go on the viewport. `tabIndex` is automatic. |
| `scroll-area` | `scrollAreaVariants` | `scrollAreaViewportVariants`. New: `ScrollAreaScrollbar`, `ScrollAreaThumb`, `ScrollAreaCorner`, `ScrollAreaScrollToEnd`, `stickToEnd`, `createScrollAreaController`. |

```tsx
// 5.x
<Tabs selectedKey={k} onSelectionChange={setK} keyboardActivation="manual">
  <TabList aria-label="Settings"><Tab id="a">A</Tab><Tab id="b" isDisabled>B</Tab></TabList>
  <TabPanel id="a">…</TabPanel>
</Tabs>
<TabBar items={[{ id: 'a', title: 'A', icon: 'star' }]} selected={t} onSelect={setT} />

// 6.0
<Tabs value={k} onValueChange={setK} activation="manual">
  <TabsList aria-label="Settings"><TabsTab value="a">A</TabsTab><TabsTab value="b" disabled>B</TabsTab></TabsList>
  <TabsPanel value="a">…</TabsPanel>
</Tabs>
<TabBar items={[{ value: 'a', title: 'A', icon: 'star' }]} value={t} onValueChange={setT} />
```

```tsx
// 5.x
<Accordion allowsMultipleExpanded defaultExpandedKeys={['a']}>
  <AccordionItem id="a"><AccordionTrigger>Title</AccordionTrigger><AccordionContent>…</AccordionContent></AccordionItem>
</Accordion>
<ScrollArea aria-label="Notes" className="h-44">{rows}</ScrollArea>

// 6.0
<DisclosureGroup multiple defaultValue={['a']}>
  <DisclosureGroupItem value="a">
    <DisclosureGroupHeader><DisclosureGroupTrigger>Title</DisclosureGroupTrigger></DisclosureGroupHeader>
    <DisclosureGroupPanel>…</DisclosureGroupPanel>
  </DisclosureGroupItem>
</DisclosureGroup>
<ScrollArea className="h-44">
  <ScrollAreaViewport aria-label="Notes"><ScrollAreaContent>{rows}</ScrollAreaContent></ScrollAreaViewport>
</ScrollArea>
```

## Dates

[Calendar](https://blamy.github.io/ui/#/calendar), [DateField](https://blamy.github.io/ui/#/date-field), [DatePicker](https://blamy.github.io/ui/#/date-picker), [TimeInput](https://blamy.github.io/ui/#/time-input).

Values are ISO strings, not `@internationalized/date` objects; `null` means empty. Helpers come from `@ui-sdk/core/date` (`todayDate`, `addDays`, `addMonths`, `toISODate`, `formatDate`…). Dates are Gregorian only, and there is no time-zone segment.

| 5.x | 6.0 |
| --- | --- |
| `parseDate('2026-09-09')` | `'2026-09-09'` |
| `today(getLocalTimeZone())` | `todayDate()` (or `todayDate(timeZone)`) |
| `new CalendarDate(y, m, d)` | `toISODate({ year: y, month: m, day: d })` |
| `date.add({ days: n })`, `date.compare(other)` | `addDays(date, n)`, `a < b` (ISO dates sort as strings) |
| `parseDateTime('2026-09-09T09:30')`, `new Time(9, 30)` | `'2026-09-09T09:30'`, `'09:30'` (always 24-hour) |
| `ZonedDateTime` | not supported: keep a local date-time and the zone separately |
| `{ start, end }` | `[start, end]`, or `null` until both ends exist |

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `calendar` | `RangeCalendar`, `RangeCalendarProps` | `Calendar mode="range"`, `CalendarProps<'range'>`; also `mode="multiple"` |
| `calendar` | `onChange`, `minValue` / `maxValue`, `isDateUnavailable` | `onValueChange(value, details)`, `min` / `max`, `unavailable` (an ISO date, `{ from, to }`, `{ weekday: [0, 6] }`, `{ before }`, `{ after }`, a function, or an array) |
| `calendar` | `visibleMonths`, paging by all visible months | `months` (any number), paging one month at a time unless `pageBy="page"` |
| `calendar` | `focusedValue` / `onFocusChange`, `firstDayOfWeek="mon"` | `month` / `defaultMonth` / `onMonthChange` (`'2026-09'`), `onFocusedChange`, `weekStartsOn={1}` |
| `calendar` | `CalendarCell date`, `CalendarGrid offset={{ months: 1 }}` | `CalendarDay value`, `CalendarGrid offset={1}`. New parts: `CalendarHeading`, `CalendarPrevious`, `CalendarNext`, `CalendarMonthSelect`, `CalendarYearSelect`, `CalendarWeekdays`, `CalendarWeeks`; `createCalendarController`. |
| `calendar` | `isDisabled`, `isReadOnly`, `allowsNonContiguousRanges`; `isInvalid`, `errorMessage`, `createCalendar`, `pageBehavior` | `disabled`, `readOnly`, `allowUnavailable` (and `minDays` / `maxDays`); the others are removed |
| `date-field` | `DateField` / `TimeField` = a wrapper with `Label`, `DateInput`, `FieldError` | `DateField` / `TimeField` = the segmented input itself, inside a `Field`. `DateInput` and `dateInputVariants` are `DateField` and `dateFieldVariants`. |
| `date-field` | `DateSegment` | `DateFieldSegment` / `TimeFieldSegment` |
| `date-field` | `onChange`, `isRequired`, `isInvalid`, `placeholderValue`, `validate` | `onValueChange`, `required`, `invalid` on the `Field`; the others are removed. `granularity` and `hourCycle` stay. |
| `date-picker` | `DateRangePicker`, `DateRangePickerField`, `DateRangePickerContent` | `DatePicker mode="range"`, `DatePickerField`, `DatePickerContent` |
| `date-picker` | `Label` / `FieldError` children | wrap the `DatePicker` in a `Field` |
| `date-picker` | a segmented input; `granularity="minute"` | a text input (`DatePickerInput`) that parses on Enter or blur; date only (compose a `TimeField`, or use `DateField granularity="minute"`) |
| `date-picker` | `DatePickerContent calendarProps={{ visibleMonths: 2 }} placement` | calendar props on the root (`months`, `pageBy`, `min`, `max`, `unavailable`…); `side` / `align` on the content; content children are calendar parts and `DatePickerPreset`s, not a `<Calendar>` |
| `date-picker` | `isOpen`, `shouldCloseOnSelect`, `onChange` | `open`, `closeOnSelect`, `onValueChange`. New: `DatePickerTrigger` (named "Choose date, …"), `DatePickerClear`, `DatePickerHint`, `presentation`, `createDatePickerController`. |
| `time-input` | `onValueChange({ text, result, … })`, `onChange(text)`, `isInvalid` | `onParseChange({ text, result, … })`, `onValueChange(text, details)`, `invalid` |

```tsx
// 5.x
<RangeCalendar aria-label="Stay" visibleMonths={2} minValue={today(getLocalTimeZone())}
  defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }}
  isDateUnavailable={(d) => isWeekend(d, 'en-US')} onChange={(r) => save(r.start.toString(), r.end.toString())} />
<DateRangePicker defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }} onChange={setRange}>
  <Label variant="field">Stay</Label>
  <DateRangePickerField />
  <DateRangePickerContent calendarProps={{ visibleMonths: 2 }} />
</DateRangePicker>

// 6.0
<Calendar mode="range" months={2} pageBy="page" min={todayDate()}
  defaultValue={['2026-09-08', '2026-09-13']}
  unavailable={{ weekday: [0, 6] }} onValueChange={(r) => r && save(r[0], r[1])} />
<Field>
  <FieldLabel variant="field">Stay</FieldLabel>
  <DatePicker mode="range" months={2} defaultValue={['2026-09-08', '2026-09-13']} onValueChange={setRange}>
    <DatePickerField />
    <DatePickerContent />
  </DatePicker>
</Field>
```

## Color

[ColorField](https://blamy.github.io/ui/#/color-field), [ColorPicker](https://blamy.github.io/ui/#/color-picker).

Colors are CSS strings, not `Color` objects. Color math comes from `@ui-sdk/core/color` (`parseColor`, which returns `null` on bad input, `formatColor`, `convertColor`, `contrastRatio`, `mixColor`, `isInGamut`, `toGamut`).

| 5.x | 6.0 |
| --- | --- |
| `value: string \| Color`, `onChange(color: Color)` | `value: string`, `onValueChange(value: string, details)` on every step, `onValueCommit(value, details)` when an interaction ends; never `null` |
| `color.toString('hex')` | the value itself (hex by default), or `formatColor(parseColor(value)!, 'hsl')`; in a callback, `formatColor(details.color, …)` |
| `color.getChannelValue('alpha')` | `parseColor(value)?.alpha` (`{ space, coords, alpha }` is plain data) |
| `colorSpace="hsb"` on each part | `space="hsv"` on the root (`hsv`, `hsl`, `srgb`, `oklch`); the picker writes back in `format` |

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `color-field` | `ColorField` = a wrapper holding `Label`, `ColorFieldGroup`, `FieldError` | `ColorField` = the filled field itself (a UI SDK `ColorPicker` root), inside a `Field`; `size` is on `ColorField`; children default to `<ColorFieldSwatch /><ColorFieldInput />` |
| `color-field` | `isInvalid`, `validate`, `errorMessage` | `invalid` on the `Field` |
| `color-field` | `channel` + `colorSpace` | `<ColorField space="hsl"><ColorFieldChannelInput channel="hue" /></ColorField>` |
| `color-field` | `colorFieldGroupVariants`; `ColorFieldGroup` required | `colorFieldVariants`; `ColorFieldGroup` only inside a `ColorPicker` |
| `color-field` | `ColorSwatch color?: string \| Color` (fell back to the picker in context) | `ColorSwatch color: string` (required, no context); inside a picker use `ColorFieldSwatch` |
| `color-picker` | `ColorPicker` rendered no element | renders a `div role="group"`: name it, and give it layout classes or none |
| `color-picker` | `ColorArea colorSpace xChannel yChannel` | `ColorPickerArea x y` (space from the root); `ColorPickerAreaCanvas` for OKLCH |
| `color-picker` | `ColorThumb` | `ColorPickerAreaThumb` / `ColorPickerSliderThumb` |
| `color-picker` | `ColorSlider colorSpace channel` | `ColorPickerSlider channel`; `className` styles the track |
| `color-picker` | `ColorSwatchPicker` (own value), `ColorSwatchPickerItem color` | `ColorPickerSwatches` (follows the picker's color), `ColorPickerSwatchItem value` |
| `color-picker` | `ColorPickerTrigger` (a Button in a `DialogTrigger`), `ColorPickerContent placement` | `ColorPickerTrigger` (a `PopoverTrigger`), `ColorPickerContent side align`. New: `ColorPickerEyeDropper`, `createColorPickerController`. |

```tsx
// 5.x
<ColorField defaultValue="#7f5af0" onChange={(c) => c && setAccent(c.toString('hex'))} isInvalid={bad}>
  <Label variant="field">Accent</Label>
  <ColorFieldGroup size="sm"><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
  <FieldError>Pick a darker color.</FieldError>
</ColorField>
<ColorPicker value={accent} onChange={(c) => setAccent(c.toString('hex'))}>
  <PopoverTrigger>
    <ColorPickerTrigger />
    <ColorPickerContent placement="bottom end" swatches={presets} alpha />
  </PopoverTrigger>
</ColorPicker>

// 6.0
<Field invalid={bad ? true : undefined}>
  <FieldLabel variant="field">Accent</FieldLabel>
  <ColorField size="sm" defaultValue="#7f5af0" onValueChange={setAccent} />
  <FieldError>Pick a darker color.</FieldError>
</Field>
<ColorPicker aria-label="Accent" value={accent} onValueChange={setAccent}>
  <Popover>
    <ColorPickerTrigger />
    <ColorPickerContent align="end" swatches={presets} alpha />
  </Popover>
</ColorPicker>
```

`ColorPicker` goes outside the `Popover`, so the trigger and the content share its state. In a composed panel the picker is the panel: `<ColorPicker aria-label="Accent" className="grid gap-4"><ColorPickerArea /><ColorPickerSlider channel="hue" label="Hue" /><ColorPickerSwatches aria-label="Presets">…</ColorPickerSwatches></ColorPicker>`.

## Trees

[Tree](https://blamy.github.io/ui/#/tree), [CallStack](https://blamy.github.io/ui/#/call-stack), [ObjectTree](https://blamy.github.io/ui/#/object-tree), SchemaTree (on [SQL console](https://blamy.github.io/ui/#/sql-console)).

`Tree` is UI SDK's Tree. The data form (`items`) keeps sort, search, flatten, icons, git status, context menus, previews, rename and drag and drop; without `items` or `paths`, `Tree` is UI SDK's composition (`TreeItem`, `TreeItemLabel`, `TreeItemIndicator`, `TreeItemCheckbox`, `TreeGroup`).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `tree` | `TreeNode { id, name }` | `TreeNode { value, label }` (+ `disabled`, `href`); `contextMenu`, `preview`, `onMove`… read `node.value` / `node.label` |
| `tree` | `selectedIds`, `defaultSelectedIds`, `onSelectionChange(ids)` (multi-select by default) | `value` / `defaultValue` / `onValueChange(value, details)`, single by default (`mode="multiple"` for an array, `"none"` to act only) |
| `tree` | `onAction(node)` on double-click or Return | `onAction(value, details)` on a press or Return; may return a Promise |
| `tree` | `defaultExpanded: 'all' \| 'none' \| ids`, `expandedIds` | `defaultExpanded: 'all' \| ids` (leave out for none), `autoExpand`; new controlled `expanded` / `onExpandedChange` |
| `tree` | `icons: 'minimal' \| 'standard' \| 'complete' \| 'none'`, `density` (or a number) | `icons: boolean`, `density: 'compact' \| 'default' \| 'relaxed'` |
| `tree` | `renamingId`, `onRename(node, name)`, `onRenameEnd()` | `editing`, `onRename(node, label, details)` (return `false` to keep the field open), `onEditingChange(editing \| null, details: TreeEditingChangeDetails)` (UI SDK change details: a cancel is `reason === 'escape-key'`, and `details.cancel()` refuses the change). F2 starts a rename when `onRename` is set. A controlled `editing` is truly controlled: F2 only asks through `onEditingChange`, and the field opens when you pass the id back. |
| `tree` | — | New: `checkable`, `checked`, `onCheckedChange`, `loadChildren`, `current`, `emptyMessage`, `controller`, `createTreeController`, `treeFromPaths`, `treeVariants`, `treeRowVariants`. Slot `tree-view` wraps UI SDK's `tree`, `tree-item`, `tree-label`. |
| `schema-tree` | `isLoading`; `onSelectTable(table)` / `onSelectColumn(table, column)` on selection | `loading`; `onAction(id, { table, column?, event })` on a press or Return |
| `call-stack` | `selectedId`, `defaultSelectedId`, `onSelect(frame, index)` | `value`, `defaultValue`, `onValueChange(value, { frame, index, reason, cancel })` |
| `object-tree` | `onSelect(node \| null)` | `value` / `defaultValue` (a row key, `objectTreeKey(ids)`) / `onValueChange(key, { node, reason, cancel })`, `mode`; Return on a row acts like a double press; indent reads `--tree-level` |

```tsx
// 5.x
<Tree aria-label="Files" items={nodes} expandedIds={open} selectedIds={sel ? [sel] : []}
  onSelectionChange={([id]) => setSel(id ?? null)} onAction={(node) => openFile(node.id)}
  renamingId={renaming} onRename={(node, name) => rename(node.id, name)} onRenameEnd={() => setRenaming(null)} />
<CallStack frames={frames} selectedId={id} onSelect={(frame, i) => select(frame.id, i)} />

// 6.0
<Tree aria-label="Files" items={nodes} autoExpand={open} value={sel}
  onValueChange={setSel} onAction={(value) => openFile(value)}
  editing={renaming} onEditingChange={(editing) => editing === null && setRenaming(null)}
  onRename={(node, label) => (isValidName(label) ? rename(node.value, label) : false)} />
<CallStack frames={frames} value={id} onValueChange={(value, { index }) => select(value, index)} />
```

## Tables and logs

[LogList](https://blamy.github.io/ui/#/log-list), [RequestTable](https://blamy.github.io/ui/#/request-table), ResultTable (on [SQL console](https://blamy.github.io/ui/#/sql-console)).

Rows take real roving focus (no `aria-activedescendant`): style them with `focus-visible:` on the row, not `group-data-focus-visible/grid:`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `log-list`, `request-table` | `selectedId`, `defaultSelectedId`, `onSelectionChange(id)` | `value`, `defaultValue`, `onValueChange(value, details)` |
| `log-list`, `request-table` | `onRowPress(row, index)` | `onAction(id, { row, index, reason, event })` |
| `log-list`, `request-table` | `ref` to `LogListHandle` / `RequestTableHandle` | `controller` from `createLogListController()` / `createRequestTableController()`; `ref` reaches the root `<div>` |
| `log-list`, `request-table` | `scrollToId(id, 'nearest')` | `controller.scrollToId(id, { align: 'auto' })`; also `focus()`, `setValue()`, and `setExpanded()` / `setPlayhead()` / `setSort()` / `setColumnWidths()` |
| `log-list` | `expandedIds: Set`, `onExpandedChange(Set)` | `expanded: RowId[]`, `onExpandedChange(RowId[], details)` |
| `log-list` | `onFollowChange(following)` | `onFollowingChange(following, details)` |
| `request-table` | `onSortChange(sort)`, `onColumnWidthsChange(widths)` (every move) | `(sort, details)`, `(widths, details)` (once, on release) |
| `request-table` | `RequestLink onPress isDisabled` | `onClick`, `disabled` |
| `request-table` | a sort button inside each column header | the column header itself is pressed (click, Enter, Space) |
| `request-table` | `stackBelow={480}` | `breakpoints={{ medium: 480 }}` (`RequestTableBreakpoints`, defaults `medium` 480 and `regular` 760): two-line rows below `medium`; the root writes `data-size-class` |
| `request-table` | column `hideBelow: number` (px; `type` 760, `size` 640) | `hideBelow: 'medium' \| 'regular'`, a size class; `type` and `size` both hide below `regular` (760px), so `size` now hides from 760px rather than 640px |
| `request-table` | `data-playhead`, `--request-*` on the root | on `[data-slot=request-table-grid]` |
| `result-table` | react-aria Table (`data-hovered`, `data-resizing`, a row header) | `hover:`, `focus-visible:`, `data-dragging` on the resizer; every body cell is a `gridcell`. New: `columnWidths`, `onColumnWidthsChange`. |

```tsx
// 5.x
const list = useRef<LogListHandle>(null)
<LogList ref={list} rows={rows} selectedId={id} onSelectionChange={setId}
  expandedIds={open} onExpandedChange={setOpen} onRowPress={(row) => seek(row.time)} onFollowChange={setFollowing} />
list.current?.scrollToId(id, 'nearest')

// 6.0
const [list] = useState(createLogListController)
<LogList controller={list} rows={rows} value={id} onValueChange={setId}
  expanded={open} onExpandedChange={setOpen} onAction={(id, { row }) => seek(row.time)} onFollowingChange={setFollowing} />
list.scrollToId(id, { align: 'auto' })
```

## Toast

[Toast](https://blamy.github.io/ui/#/toast).

The queue is UI SDK's toaster; `toast` and `createToaster` are UI SDK's. A region shows one queue, so banners and the HUD pill each get their own region.

| 5.x | 6.0 |
| --- | --- |
| `<Toaster />` | `<ToastRegion />` (banners) and `<ToastRegion variant="hud" />` (the HUD) |
| `<Toaster queue={q}>{children}</Toaster>` | `<ToastProvider toaster={q}>{children}</ToastProvider>` + `<ToastRegion toaster={q} />` |
| `placement="top" \| "bottom" \| "top-end" \| "bottom-end"` | `side="top" \| "bottom"`, `align="start" \| "center" \| "end"`; `placement="center"` is gone |
| `inline` | removed: a region renders into the nearest `BLProvider` root; `container` overrides |
| `expand` | `expanded` |
| `toast.hud('Copied')` | `hud('Copied')`; a HUD of your own is `createHud()` with `<ToastRegion variant="hud" toaster={myHud.toaster} />` |
| `createToastQueue({ maxVisibleToasts })`, `ToastQueue`, `defaultToastQueue`, `toastApi`, `toast.queue` | `createToaster({ duration })`, `<ToastRegion maxVisible>`; the rest removed |
| `useToast()` → `ToastApi` | `useToast()` → the nearest queue (same call shape as `toast`) |
| `timeout` (`0` = sticky) | `duration` (`Infinity` = sticky) |
| `onClose()` | `onDismiss(details)` |
| `tone: 'destructive' \| …` | `type: 'error' \| 'success' \| 'warning' \| 'info' \| 'loading' \| 'default'`; `toastIconVariants({ type })` |
| `loading: true` | `type: 'loading'`, `toast.loading()`, or `toast.promise(p, { loading, success, error })` |
| `icon` | `data: { icon }` |
| `variant: 'hud' \| 'banner'` | removed: the region decides the look |
| `action.onAction` returning `false` to stay open | `action: { label, onAction, dismiss: false }` |
| `toast.update(id, patch, { timeout })` | `toast.update(id, options)` (the patch carries `duration`) |
| types `ToastApi`, `ToastTone`, `ToasterProps`, `ToasterPlacement` | `Toaster`, `ToastType`, `ToastRegionProps`; new parts `Toast`, `ToastIcon`, `ToastTitle`, `ToastDescription`, `ToastAction`, `ToastClose` for a region's children function |

```tsx
// 5.x
<Toaster placement="top-end" />
toast('Saved', { description: 'Live.', icon: 'check', tone: 'success', timeout: 0 })
toast.hud('Copied')
const q = createToastQueue(); <Toaster queue={q} inline>{children}</Toaster>

// 6.0
<ToastRegion side="top" align="end" />
<ToastRegion variant="hud" />
toast.success('Saved', { description: 'Live.', data: { icon: 'check' }, duration: Infinity })
hud('Copied')
const [q] = useState(() => createToaster())
<BLProvider><ToastProvider toaster={q}>{children}</ToastProvider><ToastRegion toaster={q} /></BLProvider>
```

## File upload

[FileUpload](https://blamy.github.io/ui/#/file-upload), [useFileUpload](https://blamy.github.io/ui/#/use-file-upload).

Built on UI SDK's FileInput. Every part handles plain `File`s: `FileEntry` is gone, and a file's folder path is `relativePath(file)` from `@ui-sdk/react/file-input`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `file-upload` | `onFiles(entries: FileEntry[], info)` | `onFiles(files: File[], details)`; `info.source` (`drop` / `browse` / `paste`) is `details.reason` (`drop` / `picker` / `paste`). Only accepted files arrive; `onReject(rejected)` gets the rest. |
| `file-upload` | `acceptDirectory`, `defaultCamera` | `directory`, `capture="user" \| "environment" \| true` |
| `file-upload` | `pasteable` | removed: a drop zone takes pastes while focus is inside it; `pasteTarget="document"` for the page |
| `file-upload` | `FileDropZone isInvalid isDisabled`, react-aria DropZone props | `invalid`, `disabled`, `target`, `pasteTarget`, `render`; children state `{ dragging, dragAccept, dragReject, disabled }` |
| `file-upload` | `FileUploadButton isDisabled onPress` | `disabled`; it is a UI SDK trigger with `buttonVariants` |
| `file-upload` | slots `file-drop-zone`, `file-upload`, `data-drop-target` | `file-input-dropzone`, `file-upload` (the root, with `data-busy`), `data-dragging` / `data-drag-accept` / `data-drag-reject`; listed rows `file-input-item` (`[data-file-id]` selects any row) |
| `file-upload` | `FileList children(item)` returns anything | must return a `<FileItem item={item} />`; rejected rows are listed after the accepted ones |
| `file-upload-model` | `add(entries)`, `FileRules`, `validate(file, { path, files })` returning `false` | `add(files)` (while a `FileUpload` using the state is mounted), `FileUploadRules`, `validate(file)` returning a reason string |
| `file-upload-model` | `RejectionCode` `type`, `too-large`, `too-small`, `too-many`, `invalid` | `RejectionReason` `file-type`, `file-too-large`, `file-too-small`, `too-many-files`, `duplicate` or your own string; `messages` keys renamed to match |
| `file-upload-model` | `matchesAccept`, `parseAccept`, `validateFiles`, `readDropItems`, `entriesFromFileList`, `FileEntry`, `FilesInfo` | removed (FileInput does this). New: `inputProps`, `inputController`, `OnFiles`, `FileUploadInputProps`. |
| `file-upload-model` | `useFileUpload`, `useFilePreview`, `UseFileUploadOptions`, `isBusy` | `useFileUpload`, `useFilePreview` from `lib/use-file-upload`; options `FileUploadOptions` (from `lib/file-upload-primitive`, with `controller`); `busy`. The list is the `fileUpload` primitive: `createFileUploadController()` drives it, agents can `remove`, `retry`, `clear`, `uploadAll` |
| `file-upload-model`, `file-upload` | `files`, `defaultFiles`, `onFilesChange(files)` | `value`, `defaultValue`, `onValueChange(files, details)`: `details.reason` (`picker` / `drop` / `paste` / `remove-press` / `reset` / `imperative` / `reject` / `retry` / `clear` / `upload-start` / `progress` / `settle`), `source`, `id`, `added`, `removed`, `cancel()`. The hook still returns `files`; `remove`, `retry`, `clear` take `{ reason, event }`. |
| `format-bytes`, `file-upload`, `file-upload-model`, `request-table`, `sql-console` | `formatBytes(n)`: binary units, "1.5 KB" for 1536 bytes, "5 MB" for 5 × 1024² | removed: every size reads through UI SDK's locale-aware `formatFileSize(n)` from `@ui-sdk/core/file-input` (as the Composer does): decimal units, "1.5 kB" for 1500 bytes, "5 MB" for 5,000,000, "840 byte". Write limits in decimal (`maxSize={5_000_000}`) so hints read round |

```tsx
// 5.x
<FileDropZone isInvalid={!!error} acceptDirectory onFiles={(entries) => load(entries.map((e) => e.file))} />
<FileUploadButton isDisabled={busy} defaultCamera="environment" onFiles={([entry]) => setPhoto(entry.file)}>Photo</FileUploadButton>
<FileUpload pasteable accept={['image/*']} messages={{ type: 'Images only' }} />

// 6.0
<FileDropZone invalid={!!error} directory onFiles={(files) => load(files)} />
<FileUploadButton disabled={busy} capture="environment" onFiles={([file]) => setPhoto(file)}>Photo</FileUploadButton>
<FileUpload accept={['image/*']} messages={{ 'file-type': 'Images only' }} />
```

## Command menu

[CommandMenu](https://blamy.github.io/ui/#/command-menu).

Every part takes UI SDK's Command part names with the `CommandMenu` prefix, and the dialog is a separate root.

| 5.x | 6.0 |
| --- | --- |
| `CommandInput`, `CommandList`, `CommandPage`, `CommandGroup`, `CommandItem`, `CommandEmpty`, `CommandSeparator`, `CommandFooter`, `CommandLegendItem` | `CommandMenuInput`, `CommandMenuList`, `CommandMenuPage`, `CommandMenuGroup` + `CommandMenuGroupLabel`, `CommandMenuItem`, `CommandMenuEmpty` (beside the list, not in it), `CommandMenuSeparator`, `CommandMenuFooter`, `CommandMenuLegendItem` |
| `<CommandMenu variant="dialog" isOpen onOpenChange hotkey container overlayClassName aria-label>` | `CommandMenuDialog` (`open`, `onOpenChange`, `controller`, `container`) + `CommandMenuDialogTrigger shortcut="mod+k"` + `CommandMenuDialogContent aria-label overlayClassName` around a `CommandMenu` |
| `CommandList maxHeight` | `className="max-h-…"` (default `max-h-90`) |
| `CommandPage id="root"`, `onKeyDown(e, menu)` | the first page has no `value`; others `value="…"`; `onKeyDown(event, controller)` |
| `CommandGroup heading forceMount` | a `CommandMenuGroupLabel` as the first child; `forceMount` removed |
| `CommandItem shortcut="⇧⌘O"` (display only), `badge`, `onSelect(value)` | `trailing={<CommandMenuShortcut shortcut="mod+shift+o" />}` to display, or `shortcut="mod+shift+o"` to register it; `trailing` for a badge; `onSelect(event)` (or the menu's `onAction(value, details)`) |
| `boost`, `keywordWeight`, `searchDescription`, `ranking`, `escapeBehavior` | removed; pass commands as `items` to rank them. Escape always clears the search, then goes back a page, then closes. |
| `onPageChange(page, pages)` | `onPagesChange(pages, details)` (`[]` on the first page) |
| `menuRef`, `CommandMenuApi` | `controller={createCommandMenuController()}`; `useCommandMenu()` returns `{ query, pages, page, controller }` |
| `useCommandActive()` | `useCommandMenuValue()` |
| `CommandHighlight`, `commandMatch` | removed: string titles bold their matches; `matchRanges` / `fuzzyScore(text, query)` from `@ui-sdk/core/text-match` |
| `useHotkey(hotkey, handler, enabled)`, `matchesHotkey` | `useShortcut(enabled ? 'mod+k' : null, handler)` from `@ui-sdk/react/shortcuts` |
| row `data-active` | `data-highlighted`; the root has `data-depth` and `data-direction` |

```tsx
// 5.x
<CommandMenu variant="dialog" isOpen={open} onOpenChange={setOpen} hotkey="mod+k" aria-label="Search docs">
  <CommandInput placeholder="Search…" />
  <CommandList maxHeight={260}>
    <CommandEmpty />
    <CommandGroup heading="Pages">
      <CommandItem icon="doc-text" title="Intro" shortcut="⇧⌘I" onSelect={() => go('intro')} />
    </CommandGroup>
  </CommandList>
</CommandMenu>

// 6.0
<CommandMenuDialog open={open} onOpenChange={setOpen}>
  <CommandMenuDialogTrigger shortcut="mod+k" className={buttonVariants({ variant: 'secondary' })}>Search…</CommandMenuDialogTrigger>
  <CommandMenuDialogContent aria-label="Search docs">
    <CommandMenu>
      <CommandMenuInput placeholder="Search…" />
      <CommandMenuEmpty />
      <CommandMenuList className="max-h-65">
        <CommandMenuGroup>
          <CommandMenuGroupLabel>Pages</CommandMenuGroupLabel>
          <CommandMenuItem icon="doc-text" title="Intro" trailing={<CommandMenuShortcut shortcut="mod+shift+i" />} onSelect={() => go('intro')} />
        </CommandMenuGroup>
      </CommandMenuList>
    </CommandMenu>
  </CommandMenuDialogContent>
</CommandMenuDialog>
```

| `CommandMenuApi` (5.x) | 6.0 |
| --- | --- |
| `menu.setQuery(q)`, `menu.push(p)`, `menu.pop()` | `controller.setQuery(q)`, `controller.push(p)`, `controller.pop()` |
| `menu.page` (`'root'` at the bottom), `menu.depth` | `useCommandMenu().page` (`null` on the first page), `pages.length` |
| `menu.popTo(p)`, `menu.reset()` | `controller.setPages(pages.slice(0, pages.indexOf(p) + 1))`; `controller.setPages([])` + `controller.setQuery('')` |
| `menu.setActive(v)`, `menu.select(v?)`, `menu.move(delta)` | `controller.setValue(v)`, `controller.run(v?)`; no `move` |
| `menu.close()` | the dialog's controller (`createDialogController()` on `CommandMenuDialog controller`), or set `open` |

## Workspace

[Workspace](https://blamy.github.io/ui/#/workspace).

`Workspace` is a BL UI primitive now (splits are UI SDK's Resizable, tabsets UI SDK's Tabs), not a wrapper over react-resizable-panels, and it can be controlled.

| 5.x | 6.0 |
| --- | --- |
| `WorkspaceModel`, `WorkspaceModelInput` | `WorkspaceLayout`, `WorkspaceLayoutInput` (same shapes) |
| `defaultModel` (required), `onModelChanged(model, meta)` | `defaultLayout` (optional), `onLayoutCommit(layout, details)`; new controlled `layout` + `onLayoutChange(layout, details)` (every change; `details.cancel()` refuses it) |
| `meta.reason` (`set-model`…), `meta.isUserInteraction` | `details.action` (`set`…), `details.reason !== 'imperative'` |
| `workspaceRef`, `WorkspaceImperativeHandle`, `useWorkspaceRef()`, `useWorkspaceCallbackRef()` | `controller={createWorkspaceController()}`, `WorkspaceController`; `getModel` / `setModel` are `getLayout` / `setLayout`, and every write returns `boolean` |
| `useParentWorkspace`, `useParentTabset`, `useParentTabsetState`, `useParentTab`, `useParentTabState` | removed: `renderTabsetToolbar(tabset, state)` and `renderTabContent(tab, { selected, visible, tabsetId })` receive the state; act through your controller with `tabset.id` |
| `renderTab(tab, props)` spreading `props` | `renderTab(tab)` returning `WorkspaceTab` > `WorkspaceTabTrigger` + `WorkspaceTabClose` |
| `WorkspaceTabCloseButton` | `WorkspaceTabClose` |
| `disableDrop` (true rejects) | `accepts(tab, target)` (true allows) |
| `hiddenTabBehavior` | `keepMounted: boolean \| (tab) => boolean` (`'activity'` is not offered) |
| `renderSeparator`, `renderDragPreview`, `resizePreviewMode`, `serverRenderTabContent`, `styles` | removed: style `classNames.handle`, and the drag copy with `data-drag-preview:` in `classNames.tab` |
| `elementRef`; `classNames.tab` with `data-[tab-selected]:` | `ref`; `data-selected:`. Name the root with `aria-label`. |

```tsx
// 5.x
<Workspace defaultModel={model} workspaceRef={attach} onModelChanged={onChanged} disableDrop={narrow}
  renderTab={(tab, props) => <div {...props}><span>{tab.title}</span><WorkspaceTabCloseButton /></div>} />

// 6.0
const [ws] = useState(() => createWorkspaceController<TabData>())
<Workspace aria-label="Editor" controller={ws} defaultLayout={model} onLayoutCommit={onCommit}
  accepts={narrow ? () => false : undefined}
  renderTab={(tab) => (
    <WorkspaceTab value={tab.id}>
      <WorkspaceTabTrigger><span className="truncate">{tab.title}</span></WorkspaceTabTrigger>
      <WorkspaceTabClose />
    </WorkspaceTab>
  )} />
```

A controller works only while its Workspace is mounted, and there is no attach callback: run what used to run on attach from a mount effect.

## Containers

The containers UI SDK does not ship (NavigationStack, SplitView, Credenza, the drawers, Sidebar, List rows) are BL UI primitives now, built from UI SDK's behaviors: every state follows the `x` / `defaultX` / `onXChange(value, details)` shape, each one can be driven from outside with a controller (`createNavigationStackController()`, `createSplitViewController()`…), and each reads its size class from its own box with the kit's `bindSizeClass` instead of measuring pixels, and provides it to what it renders as a size-class scope (see [Size classes follow the container](#size-classes-follow-the-container)). For a shell of your own that only branches on compact, medium or regular, use `useSizeClass()` from `@/lib/container`: it returns `[ref, sizeClass]` and writes `data-size-class` on the element for CSS; wrap its children in `<SizeClassProvider value={sizeClass}>` so `presentation="auto"` popups inside follow it too. Keep `useContainerWidth` / `useContainerSize` for real pixels.

The hooks the 5.x containers were built from are gone, with UI SDK's behaviors, or the kit's own framework-free behaviors built on them, in their place (see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)):

| 5.x | 6.0 |
| --- | --- |
| `useEdgeSwipe`, `EdgeSwipeConfig` | `bindEdgeSwipe(el, options)` from `@/lib/edge-swipe` (`BindEdgeSwipeOptions`) |
| `usePullToRefresh` | `bindPullToRefresh(scroller, options)` from `@/lib/pull-to-refresh`, or `NavigationStackContent onRefresh` |
| `useBackHistory`, `armBackHistory` | `bindBack(el, { onBack })` from `@/lib/back` |
| `useScrollHidden` | `useChromeHidden()` from `@/lib/theme`; for floating chrome, `useHideOnScroll(hideOnScroll, scrollRef)` from `@/components/ui/floating-sheet` |
| `useSheetDrag`, `SHEET_TAP_SLOP`, `SHEET_MINIMIZE_TRAVEL`, `SheetDragOptions`, `SheetDragState` | a `Drawer` with `snapPoints`, `modalAbove`, `DrawerHandle` and `--drawer-progress` (see `floating-sheet.tsx`); any other vertical drag is `bindDrag` from `@ui-sdk/core` |
| `useDrawerSwipe` | UI SDK's Drawer swipes shut on its own; AdaptivePane's `swipeToOpen` opens it |
| `navigationPush` | removed |
| `useControllableState(value, defaultValue, onChange)` → `onChange(next)` | `useControllableChange<T, Reason>(value, defaultValue, onChange)` → `onChange(next, details)`; the setter takes `(next, { reason, event })` and returns whether it happened (`false` for the same value or a cancel) |
| `useTitleFlight(ref)` (registry) | `createTitleFlight(container, { parts, committed })` → `{ fly, end, destroy }`; it follows a swipe by itself |

## NavigationStack

[NavigationStack](https://blamy.github.io/ui/#/navigation-stack).

The `screens` array of descriptors is gone. A stack is a list of page keys (`pages` / `defaultPages` / `onPagesChange(pages, details)`), and each page is a `NavigationStackPage` child built from parts. `onPagesChange` replaces `onPop`: it gets the shorter list when a page pops (`details.reason` is `trigger-press` for the back button, `escape-key`, `back` for the platform back, `swipe` or `imperative`), and `details.cancel()` keeps the page.

| 5.x | 6.0 |
| --- | --- |
| `screens={Screen[]}` | `pages={keys}` (bottom to top) + one `<NavigationStackPage value={key}>` child per page; or `defaultPages` + `controller` |
| `onPop()` | `onPagesChange(pages, details)`: `(p) => setPath(p.slice(1))`, or `(p) => { if (p.length === 1) setSel(null) }` |
| `Screen.key` | `NavigationStackPage value` |
| `Screen.title` | `<NavigationStackBar><NavigationStackTitle>…</NavigationStackTitle></NavigationStackBar>`; the title also names the next page's back button |
| `Screen.largeTitle: true` | `<NavigationStackLargeTitle />` first inside `NavigationStackContent` (its text defaults to the Title) |
| `Screen.titleOnScroll: true` | `<NavigationStackTitle showOnScroll>` |
| `Screen.subheader` | `<NavigationStackSubheader>` after the large title |
| `Screen.content` | children of `<NavigationStackContent>` (the page's scroller) |
| `Screen.leading`, `Screen.trailing` | `<NavigationStackLeading>`, `<NavigationStackTrailing>` inside the Bar (leading still hides while there is a back button) |
| `Screen.overlay` | any other child of the page, after the Bar and Content |
| `Screen.grouped` | `NavigationStackPage grouped` |
| `Screen.hideChromeOnScroll: false` | `<NavigationStackBar hideOnScroll={false}>` |
| `Screen.onRefresh` | `<NavigationStackContent onRefresh>` (touch only now; `controller.refresh()` runs it from a button or key) |
| `Screen.maxW`, `Screen.bottomInset` | `<NavigationStackContent maxWidth bottomInset>` |
| `NavigationStack defIns` | `bottomInset` (the default for every page) |
| `rootBack={{ title, onPress }}` | `rootBack={{ title, onClick }}` |
| `Screen`, `ScreenWrap`, `ScreenWrapProps` | removed: return `<NavigationStackPage>` elements from your own components |
| — | New: `createNavigationStackController()` (`push`, `pop`, `popTo`, `replace`, `refresh`, `getPages`), `useNavigationStack()` (the same methods inside a page, `null` outside), `NavigationStackBack`, `onBarHiddenChange` |
| `[data-slot=screen]`, `data-screen-key`, `data-screen-label` | `[data-slot=navigation-stack-page]`, `data-value`; the label is the text of `[data-slot=navigation-stack-title]` |
| back button `button.bl-btn` | `[data-slot=navigation-stack-back]`. Pages carry `data-covered` (and `inert`) under the top, `data-starting-style` / `data-ending-style` as they push and pop, `data-swiping` and `--stack-progress` during an edge swipe, and `data-scrolled`; the bar `data-hidden` |

```tsx
// 5.x
const screens: Screen[] = [
  { key: 'list', title: 'Contacts', largeTitle: true, subheader: <SearchField />, content: <Rows onPress={setSel} /> },
]
if (sel) screens.push({ key: 'detail', title: sel.name, titleOnScroll: true, grouped: true,
  trailing: <Button>Edit</Button>, content: <Detail c={sel} /> })
<NavigationStack screens={screens} onPop={() => setSel(null)} />

// 6.0
<NavigationStack pages={sel ? ['list', 'detail'] : ['list']}
  onPagesChange={(pages) => { if (pages.length === 1) setSel(null) }}>
  <NavigationStackPage value="list">
    <NavigationStackBar><NavigationStackTitle>Contacts</NavigationStackTitle></NavigationStackBar>
    <NavigationStackContent>
      <NavigationStackLargeTitle />
      <NavigationStackSubheader><SearchField /></NavigationStackSubheader>
      <Rows onClick={setSel} />
    </NavigationStackContent>
  </NavigationStackPage>
  {sel ? (
    <NavigationStackPage value="detail" grouped>
      <NavigationStackBar>
        <NavigationStackTitle showOnScroll>{sel.name}</NavigationStackTitle>
        <NavigationStackTrailing><Button>Edit</Button></NavigationStackTrailing>
      </NavigationStackBar>
      <NavigationStackContent><Detail c={sel} /></NavigationStackContent>
    </NavigationStackPage>
  ) : null}
</NavigationStack>
```

Rendering a page only while it is in `pages` is fine: a page you stop rendering as it pops stays on screen until it has slid out. Pages must be direct children of the stack (fragments and arrays are fine); a component of your own works as a page if it is the direct child, takes `value` and renders a `NavigationStackPage`. For a drill-down, keep the path and map it: `<NavigationStack pages={['root', ...path]} onPagesChange={(p) => setPath(p.slice(1))}>`.

To push from inside a page, `useNavigationStack()?.push('detail', { reason: 'trigger-press', event })`. In a collapsed SplitView column the first page gets a back button to the previous column by itself, so a hand-made `leading` back button there can go (`rootBack={false}` turns it off).

Escape now goes through UI SDK's layers: popups inside a page close first, the innermost stack pops next, and the first page leaves Escape alone. A push focuses the new page; a pop returns focus to what pushed it.

## SplitView

[SplitView](https://blamy.github.io/ui/#/split-view).

Every state on the root is a UI SDK value now, and the split view no longer measures pixels (the layout is CSS). `onSizeClassChange` is not called on mount: start from your own default, or read `useSplitView()` inside.

| 5.x | 6.0 |
| --- | --- |
| `widthClass`, `onWidthClassChange`, `SplitViewWidthClass` | `sizeClass`, `onSizeClassChange` (not on mount), `SplitViewSizeClass` |
| `breakpoints: { medium, regular }` | the same, each optional |
| `selection` / `defaultSelection` / `onSelectionChange(selection)`, `SplitViewSelection` | `value` / `defaultValue` / `onValueChange(value, details)` (`details.column` says which column), `SplitViewValue` |
| `sidebarVisible` / `onSidebarVisibleChange(visible)` | `sidebarOpen` / `onSidebarOpenChange(open, details)` |
| `defaultSidebarVisible={x}` and `sidebarVisibility={{ medium }}` | `defaultSidebarOpen={x}` or `defaultSidebarOpen={{ regular: x, medium }}` |
| `defaultCompactColumn`, `onCompactColumnChange(column)` | also controlled `compactColumn`; `onCompactColumnChange(column, details)` |
| `supplementaryVisible` / `defaultSupplementaryVisible` / `onSupplementaryVisibleChange` | `supplementaryOpen` / `defaultSupplementaryOpen` / `onSupplementaryOpenChange(open, details)` |
| — | New: `columnWidths` / `defaultColumnWidths` / `onColumnWidthsChange(widths, details)` (once a divider is let go), `controller={createSplitViewController()}`; `className` and `style` may be functions of state |
| `useSplitView()` `.widthClass`, `.selection`, `.sidebarVisible`, `.setSidebarVisible`, `.supplementaryVisible`, `.setSupplementaryVisible`, `.topColumn`, `.widths` | `.sizeClass`, `.value`, `.sidebarOpen`, `.setSidebarOpen`, `.supplementaryOpen`, `.setSupplementaryOpen`, `.compactColumn`, `.columnWidths` |
| `useSplitView().width` | removed: measure your own element with `useContainerWidth` |
| `select`, `show`, `back`, `toggleSidebar`, `setColumnWidth` | the same; each takes `{ reason, event }` last and returns whether it happened |
| `SplitViewItem onPress` (after the select) | `onClick(event)`, before the select; `event.preventDefault()` stops it |
| `SplitViewItem` wrapped in `HoverCardTrigger` + `HoverCard` | `SplitViewItem preview={…}` |
| `SplitViewSection expanded` / `defaultExpanded` / `onExpandedChange` | `open` / `defaultOpen` / `onOpenChange(open, details)` (UI SDK Collapsible) |
| `SplitViewStack onDepthChange(depth)` | `onPagesChange(pages, details)` (keys from `"root"` to the top) |
| root `data-width-class`, `data-sidebar-visible`; item `data-split-item`; stack `data-split-stack-can-pop`, page `data-top` | root `data-size-class`, `data-sidebar-open`; item `data-slot="split-view-item"` with `data-selected`; stack `data-can-pop`, pages `data-covered` |

```tsx
// 5.x
<SplitView aria-label="Reminders" selection={selection} onSelectionChange={setSelection}
  sidebarVisibility={{ medium: true }} sidebarVisible={sidebar} onSidebarVisibleChange={setSidebar}
  onWidthClassChange={(wc) => setCompact(wc === 'compact')}>
  <HoverCardTrigger className="flex w-full">
    <SplitViewItem id={id} title={l.title} onPress={pick(l)} />
    <HoverCard placement="end top"><ListCard l={l} /></HoverCard>
  </HoverCardTrigger>
  <SplitViewSection title="Chats" collapsible defaultExpanded onExpandedChange={setOpen}>…</SplitViewSection>
</SplitView>

// 6.0
<SplitView aria-label="Reminders" value={selection} onValueChange={setSelection}
  defaultSidebarOpen={{ medium: true }} sidebarOpen={sidebar} onSidebarOpenChange={setSidebar}
  onSizeClassChange={(sc) => setCompact(sc === 'compact')}>
  <SplitViewItem id={id} title={l.title} onClick={pick(l)} preview={<ListCard l={l} />} />
  <SplitViewSection title="Chats" collapsible defaultOpen onOpenChange={(open) => setOpen(open)}>…</SplitViewSection>
</SplitView>
```

## Credenza

[Credenza](https://blamy.github.io/ui/#/credenza).

`Credenza` is UI SDK's Dialog with parts now, instead of one component that took everything as props. It is `presentation="auto"` by default: a centered card when the nearest size-class scope is medium or regular, a floating tray you drag down to dismiss when it is compact. `BLProvider` is a scope, and so are the containers inside it (a SplitView column, a NavigationStack, a SidebarProvider), so a Credenza that used to get `compact={…}` from one of them can leave `presentation` out, with or without a trigger; outside every scope "auto" falls back to a phone media query. Pass `presentation` when `compact` came from something else.

| 5.x | 6.0 |
| --- | --- |
| `onClose()` | `onOpenChange(open, details)`; reasons `escape-key`, `outside-press`, `close-press`, `swipe`, `imperative` |
| `compact={bool}` | `presentation={bool ? 'sheet' : 'dialog'}`, or leave it out to follow the size class |
| `isDismissable={false}` | `dismissible={false}`: Escape, the backdrop and the swipe are refused (`onDismissAttempt` runs) and the × is left out |
| `title` | `<CredenzaTitle>` in a `<CredenzaHeader>`; with no title, name `CredenzaContent` with `aria-label` |
| `canBack` + `onBack` | `<CredenzaBack hidden={!canBack} onClick={onBack} />`, first in the header |
| the built-in × | `<CredenzaClose />`, last in the header; with children or `render` it is any closing element |
| the built-in scrim | `<CredenzaBackdrop />`, the root's first child |
| children | children of `<CredenzaView>`, which springs the height and cross-fades between `view`s |
| `className`, `style` on the card (`[data-slot=credenza]`) | on `CredenzaContent` (`[data-slot=dialog-content]`, `data-presentation="dialog" \| "sheet"`); style the tray with `data-[presentation=sheet]:` |
| `data-autofocus` | `autoFocus` on the control, or `initialFocus` on `CredenzaContent` |
| `credenzaVariants({ compact })` | `credenzaVariants({ presentation: 'dialog' \| 'sheet' })` |
| — | New: `CredenzaTrigger`, `createCredenzaController` |

```tsx
// 5.x
<Credenza open={!!dialog} onClose={() => setDialog(null)} compact={compact}
  isDismissable={view !== 'deleting'} view={view} title={TITLES[view]}
  canBack={view === 'tracker'} onBack={() => setDialog('settings')} className="bg-muted">
  <div className="px-4 pt-1 pb-4">…</div>
  <Button variant="secondary" onPress={() => setDialog(null)}>Cancel</Button>
</Credenza>

// 6.0
<Credenza open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null) }}
  presentation={compact ? 'sheet' : 'dialog'} dismissible={view !== 'deleting'} view={view}>
  <CredenzaBackdrop />
  <CredenzaContent className="bg-muted">
    <CredenzaHeader>
      <CredenzaBack hidden={view !== 'tracker'} onClick={() => setDialog('settings')} />
      <CredenzaTitle>{TITLES[view]}</CredenzaTitle>
      <CredenzaClose />
    </CredenzaHeader>
    <CredenzaView>
      <div className="px-4 pt-1 pb-4">…</div>
      <CredenzaClose render={<Button variant="secondary" />}>Cancel</CredenzaClose>
    </CredenzaView>
  </CredenzaContent>
</Credenza>
```

It is a real modal now: focus moves in whenever it opens (also when it mounts open), Tab stays inside, the rest of the layer host is inert, and focus goes back to the trigger. Pass `initialFocus="none"` on `CredenzaContent` to leave focus where it is. Escape is `preventDefault()`ed rather than stopped, so a window key listener behind it should skip `event.defaultPrevented` keys.

## FloatingSheet and FloatingChat

[FloatingSheet](https://blamy.github.io/ui/#/floating-sheet), [FloatingChat](https://blamy.github.io/ui/#/floating-chat).

The sheet is a bottom UI SDK Drawer in its own layer host, with snap points at the peek, each detent and full height. At the peek the page stays usable; above it the sheet is modal to its own box (Tab stays in the sheet, and the scrim dims and catches presses). Its contents never remount between stops.

| 5.x | 6.0 |
| --- | --- |
| `onOpenChange(open)` | `onOpenChange(open, details)`; reasons `swipe`, `handle-press`, `handle-key`, `imperative` |
| `onDismiss()` | `onVisibleChange(visible, details)` (and `defaultVisible`); `onVisibleChange={(v) => { if (!v) close() }}` |
| `useFloatingSheet().progress` live on every drag frame | the resting stop (0 at the peek, 1 full); style live effects off the `--fs-grown` variable on `[data-slot=floating-sheet-surface]` |
| `label` named a region | `label` names the sheet (`role="dialog"`) |
| cap `[data-slot=floating-sheet-cap]` | UI SDK's `DrawerHandle` (`[data-slot=drawer-handle]`, "Expand" / "Collapse"): a press steps to the next stop, arrow keys, Home and End move between stops |
| scrim `[data-slot=floating-sheet-scrim]` | `[data-slot=drawer-backdrop]` |
| FAB `[data-slot=floating-sheet-fab]`, morphed from the surface | a separate button named "Open", hooked by `[data-floating-sheet-fab]` (its `data-slot` is UI SDK's `button`), that pops in as the sheet is dragged below its peek |
| `floatingSheetSurfaceVariants({ placement })` | `floatingSheetFabVariants({ appearance, position })`; the surface recipe keeps `appearance` and `hidden` |
| root variables `--ck-sheet-height`, `-width`, `-reveal`, `-radius`, `-grown`, `-minimize`, `-gutter`, `-dock-height`, `-scrim-opacity`… | removed; the surface reads UI SDK's `--drawer-progress` (`--fs-grown`, `--fs-extent`, `--fs-gutter`, `--fs-radius`). The body height, alpha, shadow and divider variables stay, on the surface. |
| root `data-dragging` | `data-dragging` on the surface |
| Escape on `document` | UI SDK's Escape, with focus in the sheet; it collapses to the peek |

```tsx
// 5.x
<FloatingSheet dismissible visible={dockOpen} onDismiss={() => setDockOpen(false)} onOpenChange={setOpen} />

// 6.0
<FloatingSheet dismissible visible={dockOpen} onVisibleChange={(v) => { if (!v) setDockOpen(false) }} onOpenChange={setOpen} />
```

FloatingChat keeps its props except its three change callbacks, which take details now (`details.cancel()` keeps the state as it is): `onOpenChange(open, details)` (reasons `handle-press`, `swipe`, `escape-key`, `outside-press`, `trigger-press`, `imperative`), `onMinimizedChange(minimized, details)` (`swipe` for a drag below rest, `trigger-press` for the FAB or the folded bump, `imperative`) and `onComposingChange(composing, details)` (`trigger-press` for the working status, `handle-press` or `swipe` when opening the chat brings the composer back, `imperative`, which includes `working` starting or stopping on an uncontrolled chat). An open chat is a layer in UI SDK's stack: Escape and a press outside it close it. The scrim is no longer a focusable "Close" button but a decorative `[data-slot=floating-chat-scrim]` whose press is the layer's outside press. Its working-status button is a UI SDK Button marked `data-floating-chat-working`.

## SideDrawer

[SideDrawer](https://blamy.github.io/ui/#/side-drawer), [AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane).

SideDrawer and AdaptivePane are primitives whose overlay presentations are UI SDK's Drawer, contained in their host: focus moves in and is trapped, Escape and a press on the scrim close, a swipe toward the edge closes, and focus goes back. Their children render once and move between presentations without remounting.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `side-drawer` | `mode: 'fixed' \| 'overlay'` + `compact` | `presentation: 'fixed' \| 'overlay' \| 'push' \| 'auto'` (default `auto`) |
| `side-drawer` | `mode="fixed"`; `mode="overlay"` (pushed on a compact host); `mode="overlay" compact={false}`; `compact` | `presentation="fixed"`; leave it out (`auto`); `presentation="overlay"`; `presentation="push"` |
| `side-drawer` | `compactBreakpoint` | `breakpoint` (still 520) |
| `side-drawer` | `open` (required), `onClose()` | `open` / `defaultOpen` / `onOpenChange(open, details)` / `controller`; reasons `close-press`, `escape-key`, `outside-press`, `swipe`, `back`, `imperative` |
| `side-drawer` | `sideDrawerVariants({ mode })` | `sideDrawerVariants({ presentation })` |
| `side-drawer` | root `data-mode`, `data-presentation="sheet" \| "push"`; the push panel always rendered | root `data-presentation="fixed" \| "overlay" \| "push"`, `data-open` / `data-closed`; the push panel is rendered only while open or leaving |
| `adaptive-pane` | `mode`, `AdaptivePaneMode` | `presentation`, `AdaptivePanePresentation` (same four values); root `data-presentation` |
| `adaptive-pane` | `open`, `onClose()` | `open` / `defaultOpen` / `onOpenChange(open, details)` / `controller` |
| `adaptive-pane` | `onOpen` (turned on the edge strip) | `swipeToOpen`; the open arrives as `onOpenChange(true, { reason: 'swipe' })` |
| `adaptive-pane` | `swipe` | unchanged: `swipe={false}` keeps the drawer from following a drag shut; `dismissible={false}` turns off every dismissal |
| `adaptive-pane` | `onResize(width, mode)` on every move | `widths` / `defaultWidths` / `onWidthsChange({ column, drawer }, details)` once a resize settles |
| `adaptive-pane` | `maxWidth: number \| string` | `maxWidth: number` (caps resizes) + `drawerMaxWidth: number \| string` (CSS) |
| `adaptive-pane`, `edge-drawer` | `scrimClassName` | `backdropClassName` |
| `adaptive-pane`, `edge-drawer` | `side: 'left' \| 'right'` (default `left`) | also UI SDK's logical `start` / `end`, which follow the reading direction; the default is `start` (the left in a left-to-right app, the right under `dir="rtl"`). SideDrawer's overlay comes from the `end`, the compact Sidebar's from the `start` |
| `adaptive-pane` | `swipeToOpen` opened on any swipe from the strip | it opens past a third of the host's width, or sooner with a flick, as the edge swipes do |
| `adaptive-pane` | `hidden` unmounted the children | children stay mounted, off the page |
| both | — | New: `createSideDrawerController()`, `createAdaptivePaneController()`, `columnClassName`, `aria-label` (the drawer's name), `dismissible`, `modal` |

```tsx
// 5.x
<SideDrawer mode={wide ? 'fixed' : 'overlay'} open={open} onClose={() => setOpen(false)} title="Info">…</SideDrawer>
<AdaptivePane mode={mode} open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)}
  resizable onResize={(w, m) => save(m, w)} maxWidth="84%">…</AdaptivePane>

// 6.0
<SideDrawer presentation={wide ? 'fixed' : 'auto'} open={open} onOpenChange={setOpen} title="Info">…</SideDrawer>
<AdaptivePane presentation={mode} open={open} onOpenChange={setOpen} swipeToOpen
  resizable onWidthsChange={(widths) => save(widths)} drawerMaxWidth="84%">…</AdaptivePane>
```

## Sidebar

[Sidebar](https://blamy.github.io/ui/#/sidebar).

`SidebarProvider` can be controlled now (`open`, `onOpenChange(open, details)`, `controller`), and `breakpoint` is its size class's medium breakpoint. Crossing it resets `open` through `onOpenChange` with reason `content-resize`, which you can cancel. On a compact provider the sidebar is a Drawer contained in the provider.

| 5.x | 6.0 |
| --- | --- |
| `useSidebar().narrow` | `.compact` (and `.sizeClass`) |
| `setOpen((o) => !o)` | `toggle()`, or `setOpen(!open)`: `setOpen` takes a boolean and returns whether it happened |
| `onClick={toggle}` | `onClick={() => toggle()}` (`toggle` takes options, not an event) |
| `SBCtx`, `SBCollapsedCtx` | removed; `useSidebarCollapsed()` |
| `SidebarItem onPress`, `SidebarSearch onPress` | `onClick`. A collapsed item is named by its label, and `active` sets `aria-current="page"` |
| `SidebarTrigger` (react-aria Button) | the primitive's trigger part: any button props, `render`, `aria-label` (default "Toggle sidebar"), `aria-expanded` |
| `Sidebar` | also takes `aria-label` (the drawer's name, default "Sidebar"); children no longer remount when the variant or size class changes |
| — | New: `createSidebarController()` (`isOpen`, `setOpen`, `toggle`) |

```tsx
// 5.x
const { narrow, setOpen, toggle } = useSidebar()
<button onClick={toggle}>…</button>
<SidebarItem icon="home" label="Home" onPress={() => { go('home'); if (narrow) setOpen(false) }} />

// 6.0
const { compact, setOpen, toggle } = useSidebar()
<button onClick={() => toggle()}>…</button>
<SidebarItem icon="home" label="Home" onClick={() => { go('home'); if (compact) setOpen(false) }} />
```

## Lists

[Lists](https://blamy.github.io/ui/#/lists), [IndexBar](https://blamy.github.io/ui/#/index-bar), [MessageScroller](https://blamy.github.io/ui/#/message-scroller), [Conversation](https://blamy.github.io/ui/#/conversation), [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container).

Swipe actions are UI SDK's `createSwipeActions` and reordering is `createReorder`, so both move the way UI SDK's do from the keyboard.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `list` | `ListRow onPress` | `onClick(event, details)` |
| `list` | `ListRow rowRole="option"` | removed: a list whose rows are chosen is a `Listbox`; a row that only shows the chosen value is `selected`, or `accessory="check" checked` (both set `aria-current`) |
| `list` | `ListSection innerRef` | `ref` |
| `list` | `ListSection onReorder(from, to)` | `onOrderChange(order, details)`: `order` is the rows' keys in their new order; `details.from` and `details.to` are the indexes |
| `list` | a grip moved its row on ↑ / ↓ | Space or Enter picks the row up, ↑ ↓ Home End move it, Space or Enter drops it, Esc puts it back; each move is announced |
| `list` | → showed the trailing actions, ← the leading ones | ← shows the trailing actions and → the leading ones (the way a swipe moves the row) |
| `list` | `ListRowAction.onAction()` | `onAction(details)` with `reason` `action-press`, `full-swipe` or `delete-key` |
| `list` | one open row at a time across every list | an open row closes on any press outside it |
| `list` | — | New: `ListRow controller={createListRowController()}` (`show('leading' \| 'trailing')`, `close()`) |
| `list` | rows directly in the section; buttons `[data-row-action]`, grip `[data-row-grip]` | each row wrapped in `[data-slot=list-section-item]` inside `[data-slot=list-section-rows]` (a `list`); buttons `[data-slot=list-row-action]`, grip `[data-slot=list-section-handle]`; actions `[data-slot=list-row-actions][data-side=start \| end]` |
| `index-bar` | `onJump(key, point, index)`, `onLetter(key)` | the same plus `details` (`reason` `drag`, `list-navigation`, `item-press`, `imperative`); keys stop at either end, PageUp and PageDown work; options are `[data-slot=index-bar-option]` with `data-highlighted` |
| `message-scroller` | `data-anchor="1"`; jump button `[data-slot=message-scroller-jump]` | `data-anchor=""`; `[data-slot=message-scroller-jump]` is the wrapper (`data-open` / `data-closed`), the button `[data-slot=message-scroller-jump-button]` |
| `conversation` | `Suggestion onPress` | `onClick`; `[data-slot=suggestion]` is UI SDK's `[data-slot=button]` |
| `conversation` | `WorkLog defaultOpen` | also `open` / `onOpenChange(open, details)` |
| `artifact-chat-container` | `useArtifactChatContainer().width` | `.sizeClass` (`.compact` is unchanged) |
| `artifact-chat-container` | `onMinimizedChange(minimized)` | `onMinimizedChange(minimized, details)`, FloatingChat's (`swipe`, `trigger-press`, `imperative`) |

```tsx
// 5.x
<ListSection animate onReorder={editing ? (from, to) => setSongs(move(songs, from, to)) : undefined}>
  {songs.map((s) => <ListRow key={s.id} title={s.title} onPress={() => play(s)} />)}
</ListSection>
{tones.map((t) => <ListRow key={t} title={t} accessory="check" checked={tone === t} rowRole="option" onPress={() => setTone(t)} />)}

// 6.0
<ListSection animate onOrderChange={editing ? (_, { from, to }) => setSongs(move(songs, from, to)) : undefined}>
  {songs.map((s) => <ListRow key={s.id} title={s.title} onClick={() => play(s)} />)}
</ListSection>
<Listbox aria-label="Ringtone" value={tone} onValueChange={setTone}>
  {tones.map((t) => <ListboxItem key={t} value={t}>{t}</ListboxItem>)}
</Listbox>
```

Ordering by key reads better when your rows have ids: `onOrderChange={(order) => setSongs(order.map((id) => byId[id]))}`. A test that pressed ArrowDown on a grip now presses Space, ArrowDown, Space; one that pressed ArrowRight to open trailing actions presses ArrowLeft.

## Composer

[Composer](https://blamy.github.io/ui/#/composer).

Most of the Composer keeps its props. The buttons are UI SDK Buttons, the select is a `DropdownMenu`, the add button and the drop zone are UI SDK's FileInput, and the bump drags with `bindDrag`.

| 5.x | 6.0 |
| --- | --- |
| `ComposerButton`, `ComposerStop`, `ComposerFab` `onPress`, `isDisabled` | `onClick`, `disabled`, `render` |
| `ComposerSelect onChange(id)` | `onValueChange(id, details)` |
| `Composer onValueChange(markdown)`, `onAttachmentsChange(attachments)`, `onExpandedChange(expanded)`, `onCollapsedChange(collapsed)` | the same with `details` second (`reason`, `event`, `source`, `cancel()`); they run before the state moves, so `details.cancel()` keeps an uncontrolled value |
| `ComposerBump onOpenChange(open)`, `onMinimizedChange(minimized)` | `onOpenChange(open, details)` (`press`, `drag`, `escape-key`, `imperative`), `onMinimizedChange(minimized, details)` (`drag`, `press`); `onMinimizedChange(false)` no longer fires on a tap when the bump isn't minimized |
| `ComposerQueue onItemsChange(items)`, `actions.edit()` / `sendNow()` / `remove()` | `onItemsChange(items, details)` (`queue`, `send`, `edit`, `remove`); the actions take the triggering event: `actions.remove(event.nativeEvent)` |
| `useComposer().setValue(md)`, `addAttachment(a)`, `removeAttachment(id)`, `setExpanded(x)`, `setCollapsed(x)` | the same, with an optional `{ reason, event }` second (third for `updateAttachment`); each returns `false` when the change was canceled |
| `ComposerSelect` committed an uncontrolled pick before `onValueChange` | `onValueChange` first; `details.cancel()` keeps the pill's value |
| file sizes "84 KB" (1024-based) | UI SDK's locale-aware `formatFileSize`: "86 kB" (1000-based) |
| `<ComposerMenuItem id="x" textValue="X">` | `<ComposerMenuItem value="x" label="X">` inside a `DropdownMenuRadioGroup` |
| `ComposerAdd allowsMultiple`, `acceptDirectory`, `defaultCamera`, `onPress` | `multiple`, `directory`, `capture="user" \| "environment" \| true`, `onClick` (runs before the picker opens) |
| `ComposerAttach accept="image/*,.pdf"` | `acceptedFileTypes={['image/*', '.pdf']}` |
| the hidden "Attach files: drop or paste here" button | removed: drop on the card, use the + button, or paste with focus anywhere in the card |
| drop overlay mounted only while hovered, `data-state` | always mounted and hidden; `data-dragging` while files hover |
| `ComposerBumpProgress.settling` while a spring wrote `progress` every frame | `progress` and `reveal` jump to the rest value on release; `settling` is true while the bump's CSS transition runs. Drive your own transitions off `dragging` alone. |
| `useComposerBump().handleProps` | `startDrag(event)`: call it from your handle's `onPointerDown` |
| `[data-slot=composer-send]`, `-stop`, `-attachment-open`, `-menu-item`, `-bump-grip` | `[data-state=send]` (or the button's name), the button named "Stop", `[data-attachment-open]`, `[data-slot=menu-radio-item]`, `[data-bump-grip]` |
| `[data-slot=annotate-lightbox]` | the dialog named "Annotate image" (`[data-slot=dialog-content]`) |
| `AnnotateLightbox src onClose onSave(dataUrl)`, open while mounted | UI SDK's open API: `open` / `defaultOpen` / `onOpenChange(open, details)`, `onOpenChangeComplete(open)`, `onSave(dataUrl, details)`. Cancel closes with `close-press`, Save with `action` after `onSave`, plus `escape-key` and `outside-press`; `details.cancel()` keeps it open. Unmount it from `onOpenChangeComplete(false)` so the exit plays. |
| `ComposerAttachProps` | removed: `ComposerAttach` takes `ComposerAddProps` |
| `ComposerSeparator` a `<span role="separator" data-slot="composer-separator">` | the kit's `Separator orientation="vertical"` (`data-slot="separator"`) |
| an open bump's Escape on `document` | the bump is a UI SDK layer, so a menu opened from it closes first |

```tsx
// 5.x
<ComposerSelect aria-label="Effort" options={efforts} value={effort} onChange={setEffort} />
<ComposerAdd allowsMultiple={false} acceptDirectory defaultCamera="environment" onPress={track} />
<ComposerAttach accept="image/*,.pdf" />
<ComposerButton variant="pill" onPress={stopServer} isDisabled={!running}>Stop</ComposerButton>
<div {...useComposerBump().handleProps}>…</div>

// 6.0
<ComposerSelect aria-label="Effort" options={efforts} value={effort} onValueChange={(id) => setEffort(id)} />
<ComposerAdd multiple={false} directory capture="environment" onClick={track} />
<ComposerAttach acceptedFileTypes={['image/*', '.pdf']} />
<ComposerButton variant="pill" onClick={stopServer} disabled={!running}>Stop</ComposerButton>
<div className="touch-none" onPointerDown={(e) => bump.startDrag?.(e)} onClick={() => bump.toggle()}>…</div>
```

```tsx
// 5.x
{shot ? <AnnotateLightbox src={shot} onClose={() => setShot(null)} onSave={(png) => { save(png); setShot(null) }} /> : null}

// 6.0
<AnnotateLightbox src={shot} open={open} onOpenChange={setOpen} onSave={(png) => save(png)}
  onOpenChangeComplete={(o) => { if (!o) setShot(null) }} />
```

## Filter and font picker

[Filter](https://blamy.github.io/ui/#/filter), [FontPicker](https://blamy.github.io/ui/#/font-picker).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `filter` | `onValueChange(filters)`, `onMatchChange(match)` | the same with `details` (`reason` `add`, `update`, `remove`, `clear`, `apply`, `imperative`; `item-press` for the match) |
| `filter` | an uncontrolled bar moved, then told you; nothing could refuse | `onValueChange` / `onMatchChange` run first with UI SDK's change details (`reason`, `event`, `source`, `cancel()`); `details.cancel()` keeps an uncontrolled bar as it was. `useFilters()`'s `setFilters`, `add`, `update`, `remove`, `clear` return whether the change went through. |
| `filter` | `[data-slot=filter-announcer]` live region | UI SDK's `announce()` (one page region, `[data-ui-sdk-announcer]`; announcements are deferred, so tests `waitFor` them) |
| `filter` | `FilterMenu children` = your trigger element | `render={<Button … />}` is the trigger, `children` its content |
| `filter` | `FilterMenu label="Add"` | `children` (they replace the icon and "Filter") |
| `filter` | `FilterMenu isOpen`, `placement="bottom end"` | `open`, `onOpenChange(open, details)`, `side` / `align` |
| `filter` | `FilterToolbar` = react-aria Toolbar; `FilterClear isDisabled` | UI SDK Toolbar (`orientation`, `loop`, `controller`); `disabled` |
| `filter` | `[data-slot=filter-menu-trigger]`, `filter-menu`, `filter-toolbar` | `[data-filter-trigger]`, `popover-content`, `toolbar` |
| `filter` | search fields `role="searchbox"`; the field list named "Fields" | `role="combobox"`; the list is named by its search ("Filter by"). Tests type with `fireEvent.input`. |
| `font-picker` | `value` (required) + `onChange` on `FontPicker`, `FontList`, `FontStackPicker` | `value` / `defaultValue` / `onValueChange(value, details)` |
| `font-picker` | `isDisabled`, `placement="bottom start"` | `disabled`, `side="bottom" align="start"` |
| `font-picker` | `triggerProps` = react-aria Button props | `PopoverTrigger` props (`onClick`) |
| `font-picker` | category filter `role="radio"`, `data-selected` | `ToggleGroup` buttons (`aria-pressed`, `data-pressed`) |
| `font-picker` | the stack's chips are grid rows | a `list` of `listitem` chips, each with a sortable handle: drag it, or Space, arrows, Space; Delete or Backspace on a handle removes the font |
| `font-picker` | rows `data-hovered`, `data-focused` | `data-highlighted` |
| `font-picker` | `onValueChange` after the value moved | `onValueChange(value, details)` first, with UI SDK's change details; `details.cancel()` keeps the value (and keeps the picker open) |

```tsx
// 5.x
<FilterMenu fields={fields} state={state} hotkey="g">
  <Button variant="secondary" size="sm" aria-keyshortcuts="G"><Icon name="plus" />Add filter</Button>
</FilterMenu>
<FontPicker aria-label="Font" value={font} onChange={setFont} placement="left top" />

// 6.0
<FilterMenu fields={fields} state={state} hotkey="g" render={<Button variant="secondary" size="sm" />}>
  <Icon name="plus" />Add filter
</FilterMenu>
<FontPicker aria-label="Font" value={font} onValueChange={setFont} side="left" align="start" />
```

## Other components

[CodeEditor](https://blamy.github.io/ui/#/code-editor), [CronEditor](https://blamy.github.io/ui/#/cron-editor), [DebugToolbar](https://blamy.github.io/ui/#/debug-toolbar), [EditBar](https://blamy.github.io/ui/#/edit-bar), [TailscaleLoginButton](https://blamy.github.io/ui/#/tailscale-login), [Morph](https://blamy.github.io/ui/#/morph), [VideoTimeline](https://blamy.github.io/ui/#/video-timeline).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `code-editor` | `onLineNumberPress`, `isLineNumberPressable` (also on `CodeEditorWindow`) | `onLineNumberClick`, `lineNumberClickable` |
| `code-editor` | gutter `onPress`, `isPressable`; marker `onPress`, `isActive` | gutter `onClick`, `clickable`; marker `onClick`, `active` |
| `code-editor` | `[data-slot=code-editor-marker]`, `code-editor-gutter-cell`, `code-editor-copy` on pressable cells and the copy button | UI SDK's `[data-slot=button]`; select cells with `[data-code-editor-cell="marker"]` (or the gutter id) |
| `code-editor` | `CodeEditorCopyButtonProps` = react-aria Button props | UI SDK Button props (`onClick`, `disabled`) |
| `code-editor` | `onChange(value, change)`, `onEdit(change)`, `CodeEditorChange` with `origin` (`input`, …) | `onValueChange(value, details)`, `onEdit(details)`: `CodeEditorValueChangeDetails`, UI SDK's change details (`reason`, `event`, `source`, `cancel()`) plus `from` / `to` / `newTo` / `text` / `removed`. `origin` is `reason`, and `input` is `input-change`. `cancel()` takes an edit back in an editor without `value` |
| `code-editor` | `onSelectionChange(selection)` | `onSelectionChange(selection, details)`, `details.reason` `press` / `drag` / `caret-move` / `select-all` / `escape-key` / an edit's / `imperative` |
| `code-editor` | gutter `onClick(lineNumber)`, `onLineNumberClick(lineNumber)`, marker `onClick(marker)` | `onClick(event, details)` / `onLineNumberClick(event, details)` with UI SDK's button details plus `details.line`; a marker's adds `details.marker`. A gutter whose cells hold controls of their own takes `focusable(lineNumber)` |
| `syntax-highlighting` | `SyntaxHighlighting`, `SyntaxHighlightingHeader` / `Title` / `CopyButton` / `Content`, `syntaxHighlightingVariants`, `useSyntaxHighlighting`, `SyntaxLineRange` (and the `syntax-highlighting` registry item) | removed: `<CodeEditor readOnly value={code} …>` with `CodeEditorHeader` / `Title` / `CopyButton` / `Content` (`CodeEditorContent value`, not `code`), `codeEditorVariants`, `useCodeEditor()` (`getValue()` for the text), `CodeLineRange`. Slots are `code-editor*`. |
| `qr-svg` | `seed` | removed: `value` |
| `utils` | `EASE` | removed: the `ease-ios` utility (`cubic-bezier(.32,.72,0,1)`) in CSS, or the spring tokens in `lib/motion.ts` |
| `cron-editor` | `isDisabled`; preset chips `data-selected` | `disabled`; chips are Toggles (`data-pressed`) in a UI SDK `ToggleGroup` named "Presets" (one Tab stop, ← →; disabled chips have `aria-disabled`) |
| `cron-editor` | `onValueChange(expression)` | `onValueChange(expression, details)`: `reason` `input-change` / `item-press` / `clear-press` / `reset` / `imperative`; `details.cancel()` refuses an uncontrolled change |
| `video-preview` | `PlaybackControls` a row of Buttons (`[data-slot=playback-controls]`) | a UI SDK `Toolbar` named "Playback" (`[data-slot=toolbar]`): one Tab stop, ← → between the buttons |
| `debug-toolbar`, `edit-bar` | a group of Buttons (`[data-slot=debug-toolbar]`, `[data-slot=edit-bar]`) | a UI SDK `Toolbar` (`[data-slot=toolbar]`): one Tab stop, ← → between actions; a disabled action stays focusable with `aria-disabled` |
| `tailscale-login-button` | react-aria Button props (`isDisabled`); `[data-slot=tailscale-login-button]` | UI SDK Button props (`disabled`, `render`); select it by `[data-status]` or its name |
| `morph` | `dragToDismiss` moved the element with a transform | it uses the CSS `translate` property (`--morph-drag-y`), so a `translate-*` class of yours conflicts with the drag; `data-dragging` while held |
| `morph` | `<Morph as="button" type="button">` | `<Morph render={<button type="button" />}>`, as on UI SDK parts; the element's props go under Morph's and the class names merge |
| `motion` | `useMotion()` (the framer-motion module), `loadMotion()` | removed: `import { motion, AnimatePresence } from 'framer-motion'`; delete `loadMotion()` calls (it did nothing) |
| `motion` | — | New: `usePresence(present)`, `usePresenceList(items, keyOf)`, `useEnterExit(ref, present)` from `@/lib/presence`, which keep an element mounted through its exit on UI SDK's `animateIn` / `animateOut` (see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)) |
| `icon-swap`, `animated-height` | `IconSwap` and `ContentSwap` on framer's `AnimatePresence` | the kit's presence, with CSS on `data-starting-style` / `data-ending-style`; glyphs are `[data-slot=icon-swap-glyph]`, views `[data-slot=content-swap-view]`. Same props. |
| `canvas` | `camera` / `defaultCamera` / `onCameraChange(camera)`, `Camera { x, y, z }` | `viewport` / `defaultViewport` / `onViewportChange(viewport, details)`, UI SDK's `Viewport { x, y, zoom }` (every `.z` becomes `.zoom`); reasons `wheel`, `drag`, `pinch`, `zoom-key`, `move-key`, `focus-in`, `find-in-page`, `track-press`, `imperative` |
| `canvas` | `zoomAt`, `fitCamera`, `clampZoom`, `MIN_ZOOM`, `MAX_ZOOM` from `canvas-math`; `useCanvas().camera` / `update(fn)` | `controller` from `createCanvasController()` (`zoomBy(k, at?)`, `zoomTo`, `fit(rect?, { padding })`, `reveal`, `panBy`, `setViewport`, `toCanvas`, `visible`), the same on `useCanvas()`; `minZoom` / `maxZoom` props (0.02 / 4); `toBoard` and `toScreen` take a `Viewport` |
| `canvas` | `onCanvasPointerDown/Move/Up(e: React.PointerEvent, info)`, `onCanvasDoubleClick(e: React.MouseEvent, info)`, `info.camera` | DOM events (`PointerEvent`, `MouseEvent`; `e.currentTarget` isn't the canvas: use `info.screen`), `info.viewport` |
| `canvas` | ⌘ + − 0 1 zoom | also plain + − 0, arrow keys you don't `preventDefault()` pan (Shift ×4), focusing a board item reveals it, find in page pans; zoom keys announce. The board is inside a `[data-slot=canvas-pane]`: read the viewport, not the board's `transform`. |
| `trace-timeline` | `onValueChange(time, { phase, stop })` | `onValueChange(time, details)` with UI SDK's change details plus `stop`: `phase: 'start'` is `reason: 'track-press'`, `'move'` is `'drag'`, a key is `'step-key'`, Escape during a scrub is `'escape-key'` (back to where it began) |
| `trace-timeline` | `phase: 'end'` | `onValueCommit(time, details)`, once per release, key, Escape or pinch take-back. `TraceValueInfo` is `TraceValueChangeDetails`, `TraceValueCommitDetails`, `TraceValueChangeReason`. |
| `trace-timeline` | `onViewChange(view)` | `onViewChange(view, details)`, `details.reason` `wheel` / `pinch` / `zoom-key` / `double-press` / `drag` / `playhead` / `range-change` / `imperative`; `cancel()` keeps the view |
| `trace-timeline` | `onFocusLane(laneKey)`, `onSelectThread(threadId, laneKey)`, `onSelectRequest(id)` | `focusedLane` / `defaultFocusedLane` / `onFocusedLaneChange(lane, details)`, `selectedThread` / `defaultSelectedThread` / `onSelectedThreadChange(thread, details)` (the lane is `details.lane`), `selectedRequest` / `defaultSelectedRequest` / `onSelectedRequestChange(request, details)` |
| `video-timeline` | track toggles `data-selected` | `data-pressed`; Escape during a clip drag cancels it |
| `video-timeline` | `timeline`, `onChange(timeline)` (no `onChange`: read-only) | `value` / `defaultValue`, `onValueChange(value, details)` with `details.id` and `details.action` (`move` / `resize` / `delete` / `track`); `readOnly` |
| `video-timeline` | `selection` / `defaultSelection` / `onSelectionChange(ids)`; `onZoomChange(zoom)` | `selectedClips` / `defaultSelectedClips` / `onSelectedClipsChange(ids, details)`; `onZoomChange(zoom, details)` |
| `video-timeline` | `onDropMedia(mediaId, drop)` | `onDropMedia(mediaId, details)`: `TimelineDropDetails`, UI SDK's change details (`reason: 'drop'`) with `trackId`, `time` and `index`; `cancel()` refuses the drop |
| `video-timeline` | every clip a Tab stop; ⇧←/→ nudged a clip a second; the ruler's Page Up/Down moved ten seconds | the clips are one Tab stop (⌥ + arrows move between them, Home/End along a track); ⇧←/→ trims the end, ⌥⇧←/→ the start, ↑/↓ change track; the ruler (UI SDK `Slider`) moves a second with ⇧ or Page Up/Down |

```tsx
// 5.x
const gutters = [{ id: 'bp', width: 16, onPress: toggle, isPressable: canBreak, render: dot }]
const markers = (line) => sites(line).map((column) => ({ column, label: `Break at ${column}`, isActive: on(line, column), onPress: () => flip(line, column) }))
<CodeEditor readOnly lines={lines} gutters={gutters} markers={markers} onLineNumberPress={jump} isLineNumberPressable={ran} />

// 6.0
const gutters = [{ id: 'bp', width: 16, onClick: toggle, clickable: canBreak, render: dot }]
const markers = (line) => sites(line).map((column) => ({ column, label: `Break at ${column}`, active: on(line, column), onClick: () => flip(line, column) }))
<CodeEditor readOnly lines={lines} gutters={gutters} markers={markers} onLineNumberClick={jump} lineNumberClickable={ran} />
```

```tsx
// 5.x
const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 })
<Canvas camera={camera} onCameraChange={setCamera} />
<Button onClick={() => setCamera(fitCamera(unionRect(rects), size))}>Fit</Button>
<TraceTimeline value={t} onValueChange={(t, { phase }) => { setT(t); if (phase === 'end') video.seek(t) }} />

// 6.0
const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
const [canvas] = useState(() => createCanvasController())
<Canvas controller={canvas} viewport={viewport} onViewportChange={setViewport} />
<Button onClick={() => canvas.fit(unionRect(rects))}>Fit</Button>
<TraceTimeline value={t} onValueChange={(t) => setT(t)} onValueCommit={(t) => video.seek(t)} />
```

## What looks different

6.0 was checked story by story against 5.16 screenshots. The look is the same except where UI SDK does something differently on purpose, or where a behavior fix changed what is drawn:

| Where | 5.16 | 6.0 |
| --- | --- | --- |
| Date and time fields | `9/9/2026` | Zero-padded segments: `09/09/2026` |
| Color fields and pickers | Uppercase hex | Lowercase hex; the hue track and thumb are painted for the current color |
| Slider range value | `20–80` | `20 – 80` (UI SDK's format) |
| File sizes (FileUpload, Composer, RequestTable, SQL console) | Binary units: `612 KB` | Decimal units from UI SDK's `formatFileSize`: `627 kB` |
| A dialog, alert or sheet rendered open | No focus ring until a key is pressed | Focus lands on its first control, with a ring |
| Combobox | Matches from the start of an option | Matches anywhere in it |
| Command menu | Ranked results | Results keep their written order; the inline Esc hint says "Clear" |
| Command palette in a framed app | Offset from the page | Offset from the frame it is in |
| Shortcut keycaps | `⌘⇧O` | Apple's order: `⇧⌘O` |
| Segmented control and toggle group, dark | Indicator hidden behind the panel | Indicator visible, in its token color |
| Icon-only segmented control | 34px | 31px, the standard height |
| Form radio rows | 12px label gap | The Field's 6px label gap |
| Rejected files in FileUpload | In drop order | Listed after the accepted ones |
| Disabled Calendar | Value hidden | Value shown, dimmed |
| Markdown editor task checkboxes | Square | Round (docstream-editor 2.0) |
| Chat transcripts and LogList markers | Up to 2px (transcripts) or about 40px (markers) off | Exactly at the bottom, exactly centered |
| SQL editor footer hint | `⌘ ↵` and `⌥↑ history` | `⌘↵` and `↑ history` (history is the arrow keys now) |
| Tooltips and popups | Whole pixels | Can land on half pixels, so text anti-aliases slightly differently |

Popups opened inside a `BLProvider` (or any layer host) stay inside it, as before, and a popup presented as a sheet now dims only that host.
