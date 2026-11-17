# Variants reference

Every BL UI component is a [cva](https://cva.style) recipe. This page is generated from the source (103 recipes) — the same functions you can call on any element, and the defaults you can edit in your installed copy. See [Styling and variants](https://blamy.github.io/ui/#/styling) for how to use, compose and change them.

```tsx
import { buttonVariants } from '@/components/ui/button'

<a href="/docs" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Docs</a>
```

## ArtifactChatContainer

### `artifactChatContainerVariants`

Defined in `@/components/ui/artifact-chat-container`. Base classes:

```text
ck-artifact-chat relative isolate h-full w-full min-h-0 min-w-0 overflow-hidden bg-background font-sans text-foreground
```

**`presentation`** — default `split`

| Value | Adds |
| --- | --- |
| `split` (default) | `grid` |
| `floating` | `block` |

**`chatSide`** — default `start`

| Value | Adds |
| --- | --- |
| `start` (default) | — |
| `end` | — |

2 compound variants — see the source.

## Avatar

### `avatarVariants`

Defined in `@/components/ui/avatar`. Base classes:

```text
grid size-(--avatar-size) shrink-0 place-items-center bg-(image:--avatar-bg) font-semibold tracking-[.5px] text-white select-none [font-size:var(--avatar-font)]
```

**`shape`** — default `circle`

| Value | Adds |
| --- | --- |
| `circle` (default) | `rounded-full` |
| `square` | `rounded-(--avatar-radius)` |

### `avatarStatusVariants`

Defined in `@/components/ui/avatar`. Base classes:

```text
absolute -right-[2px] -bottom-[2px] box-border size-[max(10px,calc(var(--avatar-size)*.36))] rounded-full border-[2.5px] border-(--avatar-ring,var(--background))
```

**`status`** — default `online`

| Value | Adds |
| --- | --- |
| `online` (default) | `bg-success` |
| `idle` | `bg-warning` |
| `dnd` | `bg-destructive` |
| `offline` | `bg-tertiary-foreground` |

## AvatarGroup

### `avatarGroupVariants`

Defined in `@/components/ui/avatar-group`. Base classes:

```text
inline-flex items-center rounded-full outline-none [&>*]:ring-2 [&>*]:ring-(--avatar-ring,var(--background)) [&>*+*]:-ms-(--avatar-overlap)
```

No variants.

## Badge

### `badgeVariants`

Defined in `@/components/ui/badge`. Base classes:

```text
box-border inline-flex shrink-0 items-center justify-center gap-1 rounded-full leading-none font-semibold whitespace-nowrap tabular-nums
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `tinted` | `bg-primary/15 text-[color-mix(in_oklab,var(--primary)_78%,black)] dark:text-primary` |
| `outline` | `text-foreground shadow-hairline` |
| `destructive` | `bg-destructive text-white` |
| `success` | `bg-success text-black` |
| `warning` | `bg-warning text-black` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-[18px] min-w-[18px] px-1.5 text-caption2 [&>svg]:size-2.5` |
| `default` (default) | `h-[22px] min-w-[22px] px-2 text-caption [&>svg]:size-3` |

## Breadcrumb

### `breadcrumbVariants`

Defined in `@/components/ui/breadcrumb`. Base classes:

```text
relative block w-full min-w-0 overflow-clip whitespace-nowrap text-foreground [overflow-clip-margin:4px] pointer-coarse:[overflow-clip-margin:12px] [contain:inline-size]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-caption` |
| `default` (default) | `text-footnote` |
| `lg` | `text-subhead` |

### `breadcrumbItemVariants`

Defined in `@/components/ui/breadcrumb`. Base classes:

```text
[ 'bl-btn relative box-border inline-flex max-w-full min-w-0 items-center rounded-md border-0 bg-transparent py-0 text-foreground/70 no-underline [font:inherit] whitespace-nowrap outline-none transition-colors motion-reduce:transition-none', // On touch the face keeps its measured width but its hit area grows to 44px tall. "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']", 'aria-[current=page]:text-foreground', 'focus-visible:ring-2 focus-visible:ring-ring', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-5 gap-1 px-1` |
| `default` (default) | `h-6 gap-1.5 px-1.5` |
| `lg` | `h-7 gap-1.5 px-2` |

**`interactive`** — default `true`

| Value | Adds |
| --- | --- |
| `true` (default) | `cursor-pointer hover:bg-secondary hover:text-foreground active:bg-secondary-strong aria-expanded:bg-secondary aria-expanded:text-foreground data-disabled:curso…` |
| `false` | `cursor-default` |

## Button

### `buttonVariants`

Defined in `@/components/ui/button`. Base classes:

```text
[ 'bl-btn box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap [&_svg]:shrink-0', 'transition-[scale,background-color,opacity,filter] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none', pressableFocusRing, // Pending dims a little (not as far as disabled), so the wait shows without a pointer; a spinner is yours to add. 'data-disabled:cursor-default data-disabled:opacity-40 data-pending:cursor-progress data-pending:opacity-70', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `['bg-primary text-primary-foreground', filledHover]` |
| `secondary` | `['bg-secondary text-secondary-foreground', filledHover]` |
| `outline` | `bg-transparent text-foreground shadow-hairline hover:not-data-disabled:bg-accent` |
| `contrast` | `['bg-foreground text-background', filledHover]` |
| `ghost` | `bg-transparent text-foreground hover:not-data-disabled:bg-accent` |
| `quiet` | `bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary hover:not-data-disabled:text-foreground` |
| `destructive` | `['bg-destructive text-destructive-foreground', filledHover]` |
| `plain` | `bg-transparent text-primary hover:not-data-disabled:opacity-70 active:not-data-disabled:opacity-50` |
| `link` | `bg-transparent text-link no-underline underline-offset-4 hover:not-data-disabled:underline active:not-data-disabled:opacity-60` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg px-3 text-footnote font-semibold` |
| `default` (default) | `h-9 rounded-ctl px-4 text-subhead font-semibold` |
| `lg` | `h-11 rounded-xl px-5 text-callout font-semibold` |
| `pill` | `h-11 w-full rounded-card px-4 text-callout font-semibold` |
| `icon-sm` | `['relative size-7 rounded-lg p-0', coarseHitArea]` |
| `icon` | `size-9 rounded-full p-0` |
| `icon-lg` | `size-11 rounded-full p-0` |

1 compound variant — see the source.

## Calendar

### `calendarVariants`

Defined in `@/components/ui/calendar`. Base classes:

```text
flex w-fit max-w-full flex-col text-foreground data-disabled:opacity-50
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `plain` (default) | — |
| `card` | `rounded-panel bg-secondary p-3` |

## Canvas

### `canvasFrameVariants`

Defined in `@/components/ui/canvas`. Base classes:

```text
pointer-events-none absolute rounded-(--canvas-frame-radius) outline-(length:--canvas-frame-line) outline-offset-(--canvas-frame-offset) outline-primary
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `outline-solid` |
| `dashed` | `outline-dashed` |

## Card

### `cardVariants`

Defined in `@/components/ui/card`. Base classes:

```text
flex flex-col overflow-hidden rounded-panel text-card-foreground
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-card [--avatar-ring:var(--card)]` |
| `elevated` | `bg-card shadow-raised [--avatar-ring:var(--card)]` |
| `outline` | `bg-transparent shadow-hairline` |

## Checkbox

### `checkboxVariants`

Defined in `@/components/ui/checkbox`. Base classes:

```text
[ 'box-border grid size-[22px] shrink-0 cursor-pointer place-items-center border-[1.5px] border-control-border bg-transparent p-0 text-primary-foreground', 'transition-[background-color,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'data-checked:border-primary data-checked:bg-primary', 'data-indeterminate:border-primary data-indeterminate:bg-primary', 'active:not-data-disabled:scale-90', pressableFocusRing, // Invalid: the box itself (`aria-invalid`, which a Field writes on its control) or the group around it. 'aria-invalid:border-destructive group-aria-invalid/checkbox-group:border-destructive', 'aria-invalid:data-checked:border-destructive aria-invalid:data-checked:bg-destructive group-aria-invalid/checkbox-group:data-checked:border-destructive group-aria-invalid/checkbox-group:data-checked:bg-destructive', 'data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`shape`** — default `circle`

| Value | Adds |
| --- | --- |
| `circle` (default) | `rounded-full` |
| `square` | `rounded-md` |

## CodeEditor

### `codeEditorVariants`

Defined in `@/components/ui/code-editor`. Base classes:

```text
bl-syntax
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bl-syntax-card` |
| `plain` | `bl-syntax-plain` |
| `inline` | `bl-syntax-inline` |

## Code Editor Window

### `codeEditorLineVariants`

Defined in `@/lib/code-editor-window`. Base classes:

```text
pointer-events-none absolute inset-x-0 h-(--code-editor-line)
```

**`tone`** — default `none`

| Value | Adds |
| --- | --- |
| `none` (default) | — |
| `current` | `bg-primary/15 shadow-[inset_3px_0_var(--primary)]` |
| `info` | `bg-primary/10 shadow-[inset_3px_0_color-mix(in_srgb,var(--primary)_45%,transparent)]` |
| `success` | `bg-success/15` |
| `warning` | `bg-warning/15` |
| `destructive` | `bg-destructive/15` |
| `muted` | `bg-secondary` |

### `codeEditorGutterCellVariants`

Defined in `@/lib/code-editor-window`. Base classes:

```text
box-border flex h-full shrink-0 items-center overflow-hidden
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `start` | `justify-start` |
| `center` (default) | `justify-center` |
| `end` | `justify-end` |

## ColorPicker

### `colorPickerTriggerVariants`

Defined in `@/components/ui/color-picker`. Base classes:

```text
bl-btn w-full cursor-pointer justify-start text-left active:not-data-disabled:bg-secondary-strong aria-expanded:bg-transparent aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `fieldSurfaceVariants({ size: 'sm' })` |
| `default` (default) | `fieldSurfaceVariants({ size: 'default' })` |
| `lg` | `fieldSurfaceVariants({ size: 'lg' })` |

## Composer

### `composerCardVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
[ 'group/composer-card relative z-1 box-border flex min-w-0 flex-wrap items-center border border-border bg-card shadow-raised', // Folded into the FAB, the card sits where the Composer's `fabAlign` says. 'group-data-[fab-align=start]/composer:data-folded:self-start group-data-[fab-align=center]/composer:data-folded:self-center group-data-[fab-align=end]/composer:data-folded:self-end', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-card` |
| `lg` | `rounded-sheet` |

### `composerAddonVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
box-border flex min-w-0 items-center gap-[5px]
```

**`align`** — default `block-end`

| Value | Adds |
| --- | --- |
| `block-start` | `order-[-2] w-full px-3 pt-2.5` |
| `inline-start` | `order-[-1] shrink-0 self-start pt-2 pl-2` |
| `inline-end` | `order-1 shrink-0 self-start pt-2 pr-2` |
| `block-end` (default) | `order-2 w-full px-2 pt-1 pb-2` |

### `composerBumpVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
relative box-border flex min-w-0 flex-col text-caption text-muted-foreground
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `top` | `order-[-1]` |
| `bottom` (default) | `order-1` |

**`variant`** — default `attached`

| Value | Adds |
| --- | --- |
| `attached` (default) | `border border-border bg-popover` |
| `detached` | `rounded-lg bg-secondary` |
| `plain` | — |

6 compound variants — see the source.

## DataTable

### `dataTableVariants`

Defined in `@/components/ui/data-table`. Base classes:

```text
group/table relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']
```

**`density`** — default `default`

| Value | Adds |
| --- | --- |
| `compact` | `text-caption` |
| `default` (default) | `text-footnote` |
| `comfortable` | `text-footnote` |

## DateInput

### `dateInputVariants`

Defined in `@/components/ui/date-input`. Base classes:

```text
flex min-w-0 items-center text-foreground tabular-nums [font-family:inherit] whitespace-nowrap
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `w-full` |
| `plain` | `flex-1` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-subhead` |
| `default` (default) | `text-body` |
| `lg` | `text-body` |

## DatePicker

### `datePickerInputGroupVariants`

Defined in `@/components/ui/date-picker`. Base classes:

```text
(none)
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `[fieldSurfaceVariants({ size: 'sm' }), pickerField]` |
| `default` (default) | `[fieldSurfaceVariants({ size: 'default' }), pickerField]` |
| `lg` | `[fieldSurfaceVariants({ size: 'lg' }), pickerField]` |

## Diagram

### `diagramNodeVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
relative size-full
```

**`kind`** — default `node`

| Value | Adds |
| --- | --- |
| `node` (default) | `flex flex-col overflow-hidden rounded-ctl border border-border bg-card text-card-foreground shadow-hairline` |
| `group` | `flex flex-col overflow-hidden rounded-card border border-border bg-secondary/35 text-card-foreground` |
| `region` | `flex flex-col rounded-card text-card-foreground` |
| `root` | `flex flex-col overflow-hidden rounded-card border border-border bg-background/60 text-card-foreground` |
| `marker` | `rounded-full bg-foreground` |

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `dashed` | `border-dashed` |
| `double` | `outline-1 -outline-offset-4 outline-border` |

### `diagramEdgeVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
fill-none ${LINE}
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `stroke-muted-foreground` |
| `dashed` | `stroke-muted-foreground [stroke-dasharray:calc(5px/var(--diagram-z))_calc(3px/var(--diagram-z))]` |
| `dotted` | `stroke-muted-foreground [stroke-dasharray:calc(1.5px/var(--diagram-z))_calc(3px/var(--diagram-z))] [stroke-linecap:round]` |
| `strong` | `stroke-foreground` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `destructive` | `stroke-destructive` |

1 compound variant — see the source.

### `diagramItemVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
flex max-w-full min-w-0 items-center gap-1.5
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-md border border-border bg-background px-2 py-0.5 text-foreground shadow-hairline` |
| `list` | `text-foreground` |
| `code` | `text-foreground` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[&_[data-part=glyph]]:text-muted-foreground` |
| `success` | `border-success/40 [&_[data-part=glyph]]:text-success` |
| `warning` | `border-warning/50 [&_[data-part=glyph]]:text-warning` |
| `destructive` | `border-destructive/40 text-destructive [&_[data-part=glyph]]:text-destructive` |
| `muted` | `text-muted-foreground [&_[data-part=glyph]]:text-muted-foreground` |

**`pressable`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pointer-events-auto cursor-pointer motion-safe:transition-colors hover:bg-accent active:bg-secondary-strong` |
| `false` (default) | — |

1 compound variant — see the source.

### `diagramEdgeLabelVariants`

Defined in `@/components/ui/diagram`. Base classes:

```text
absolute border border-border bg-card text-card-foreground shadow-hairline
```

**`variant`** — default `pill`

| Value | Adds |
| --- | --- |
| `pill` (default) | `flex items-center justify-center gap-1 rounded-full px-2.5 py-1 whitespace-nowrap` |
| `card` | `flex flex-col items-start gap-1.5 rounded-ctl px-2.5 pt-1.5 pb-2` |

## Dialog

### `dialogVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
group/dialog outline-none
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `lg` | — |

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `cn( dialogCard, 'data-[presentation=sheet]:m-0 data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-b-none data-[presentation=she…` |
| `tray` | `cn( dialogCard, 'data-[presentation=sheet]:mx-2.5 data-[presentation=sheet]:mt-0 data-[presentation=sheet]:mb-[max(10px,env(safe-area-inset-bot…` |
| `plain` | — |

2 compound variants — see the source.

### `alertDialogCloseVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
cn( 'bl-btn box-border flex h-11 cursor-pointer items-center justify-center border-0 bg-transparent px-3 [font-family:inherit] text-body whitespace-nowrap text-primary transition-[background-color] duration-exit active:bg-accent disabled:cursor-default disabled:opacity-40 data-pending:cursor-progress', focusRing, 'focus-visible:ring-inset', )
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `font-normal` |
| `cancel` | `font-semibold` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `destructive` | `text-destructive` |

## Disclosure

### `disclosureGroupVariants`

Defined in `@/components/ui/disclosure`. Base classes:

```text
flex flex-col
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `inset` | `cn(cardVariants(), 'px-4')` |

## DropdownMenu

### `dropdownMenuContentVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[popoverSurface, popoverMotion, popoverSheet, 'bl-scroll box-border overflow-y-auto']
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-w-[230px]` |
| `sm` | `min-w-[190px] p-1` |

### `dropdownMenuItemVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[ // A row rendered as a link (`render={<a href/>}`) looks like every other row: no underline. 'bl-btn relative box-border flex cursor-pointer items-center text-foreground no-underline outline-none', 'data-highlighted:bg-accent data-highlighted:not-data-disabled:active:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40 data-destructive:text-destructive data-pending:cursor-progress', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[ 'min-h-11 gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px]', // Hairline between rows — not under the last row, nor above a group band.…` |
| `sm` | `min-h-8 gap-2 rounded-lg px-2.5 py-1.5 text-footnote leading-[18px]` |

## EmptyState

### `emptyStateVariants`

Defined in `@/components/ui/empty-state`. Base classes:

```text
flex flex-col items-center justify-center text-center text-balance
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `gap-0.5 px-3 py-6` |
| `default` (default) | `h-full gap-1 p-6` |
| `lg` | `h-full gap-1.5 p-8` |

## FileUpload

### `fileUploadDropzoneVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
[ 'group/zone relative box-border flex border-2 border-dashed border-border text-center outline-none transition-[border-color,background-color,box-shadow,opacity] duration-spring-snappy motion-reduce:transition-none', 'data-dragging:border-primary data-dragging:bg-primary/10 in-data-invalid:border-destructive has-[[data-invalid]]:border-destructive data-disabled:opacity-40', ]
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `min-h-40 flex-col items-center justify-center gap-2 rounded-card p-6` |
| `horizontal` | `flex-row items-center justify-start gap-3 rounded-panel p-3 text-start` |

### `fileUploadItemVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
box-border flex items-center gap-3 rounded-panel border border-border bg-card p-3 text-card-foreground outline-none transition-colors duration-spring-snappy motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring data-[status=error]:border-destructive data-[status=rejected]:border-destructive
```

No variants.

## Filter

### `filterChipVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
box-border inline-flex max-w-full min-w-0 items-stretch rounded-lg text-foreground
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-7 text-footnote` |
| `sm` | `h-6 text-caption` |

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-secondary shadow-hairline` |
| `preview` | `bg-primary/10 text-foreground shadow-hairline` |

## FloatingSheet

### `floatingSheetSurfaceVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
surfaceBase
```

**`hidden`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pointer-events-none translate-y-[calc(100%_+_44px)] opacity-0` |
| `false` (default) | — |

### `floatingSheetFabVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
cn( 'pointer-events-auto absolute z-1 grid size-[52px] cursor-pointer place-items-center rounded-full border p-0 text-foreground transition-[opacity,scale] duration-spring-snappy ease-spring-snappy data-folded:pointer-events-none data-folded:scale-60 data-folded:opacity-0 motion-reduce:transition-none', focusRing, )
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `top` | `top-(--fs-fab-gutter)` |
| `bottom` (default) | `bottom-(--fs-fab-gutter)` |
| `start` | `start-(--fs-fab-gutter)` |
| `end` | `end-(--fs-fab-gutter)` |

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `start` | — |
| `center` (default) | — |
| `end` | — |

6 compound variants — see the source.

### `floatingSheetVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
ck-floating-sheet pointer-events-none absolute inset-0 z-40 overflow-clip font-sans text-foreground [contain:layout]
```

No variants.

## FontPicker

### `fontStackPickerInputGroupVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
h-auto w-full flex-wrap gap-1.5 aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `[fieldSurfaceVariants({ size: 'sm' }), 'min-h-8 p-1 text-footnote']` |
| `default` (default) | `[fieldSurfaceVariants({ size: 'default' }), 'min-h-11 p-1.5 text-subhead']` |
| `lg` | `[fieldSurfaceVariants({ size: 'lg' }), 'min-h-[50px] p-2 text-subhead']` |

## IndexBar

### `indexBarVariants`

Defined in `@/components/ui/index-bar`. Base classes:

```text
absolute top-0 bottom-0 z-80 flex cursor-pointer touch-none flex-col justify-center rounded-lg outline-offset-2 select-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `w-[22px] items-center` |
| `wave` | `w-10 items-stretch` |

**`side`** — default `end`

| Value | Adds |
| --- | --- |
| `end` (default) | `end-0` |
| `start` | `start-0` |

## Input

### `fieldSurfaceVariants`

Defined in `@/components/ui/input`. Base classes:

```text
[surface, 'flex items-center gap-2']
```

No variants.

### `inputVariants`

Defined in `@/components/ui/input`. Base classes:

```text
[surface, 'block w-full placeholder:text-tertiary-foreground', selectableText]
```

No variants.

## Label

### `labelVariants`

Defined in `@/components/ui/label`. Base classes:

```text
inline-flex items-center group-data-disabled:opacity-50
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1.5 text-subhead font-medium text-foreground` |
| `field` | `gap-1.5 px-1 text-footnote font-medium text-foreground/70` |
| `control` | `cursor-pointer gap-3 text-body text-foreground has-data-disabled:cursor-default has-data-disabled:text-foreground/40` |

## List

### `listVariants`

Defined in `@/components/ui/list`. Base classes:

```text
[--avatar-ring:var(--card)]
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `plain` (default) | `p-0` |
| `inset` | `px-4 py-0` |

### `listRowVariants`

Defined in `@/components/ui/list`. Base classes:

```text
[ // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row. 'relative z-1 box-border flex w-full touch-pan-y items-center gap-3 py-0 ps-4 text-start text-body leading-[normal] tracking-[normal] outline-none', 'focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]', // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent). 'pe-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]', // The swipe offset (`--swipe-x`, from UI SDK) moves the surface; it springs back unless a finger holds it. 'translate-x-(--swipe-x) transition-[translate] duration-spring-snappy ease-spring-snappy group-data-swiping/row:transition-none motion-reduce:transition-none', ]
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `center` (default) | — |
| `top` | `[&>[data-slot=list-row-leading]]:self-start [&>[data-slot=list-row-leading]]:pt-[7px]` |

**`justify`** — default `start`

| Value | Adds |
| --- | --- |
| `start` (default) | — |
| `center` | `[&_[data-slot=list-row-body]]:justify-center [&_[data-slot=list-row-title]]:flex-none` |

**`density`** — default `default`

| Value | Adds |
| --- | --- |
| `compact` | `min-h-9` |
| `default` (default) | `min-h-row` |
| `comfortable` | `min-h-14` |

**`current`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-card bg-linear-to-r from-secondary-strong to-secondary-strong` |
| `false` (default) | `bg-card` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `destructive` | `text-destructive` |

**`interactive`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cursor-pointer` |
| `false` (default) | `cursor-default` |

**`disabled`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cursor-default *:opacity-45` |
| `false` (default) | — |

## Listbox

### `listboxVariants`

Defined in `@/components/ui/listbox`. Base classes:

```text
outline-none
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `overflow-hidden rounded-panel bg-card focus-visible:ring-[3px] focus-visible:ring-ring/45` |
| `popup` | `bl-scroll box-border max-h-[min(320px,var(--available-height,320px))] overflow-y-auto p-1.5` |

### `listboxItemVariants`

Defined in `@/components/ui/listbox`. Base classes:

```text
bl-btn group/item relative box-border flex cursor-pointer items-center gap-2.5 text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `[ 'min-h-11 px-4 py-[11px] text-body leading-[22px]', // The hairline starts under the text: past the icon when the row has one ('--listbox…` |
| `popup` | `[ 'min-h-9 rounded-lg py-[7px] pr-3 pl-2 text-subhead leading-5', // In a popup presented as a sheet (a touch layout), rows reach the 44px …` |

## LogList

### `logListVariants`

Defined in `@/components/ui/log-list`. Base classes:

```text
@container relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground after:pointer-events-none after:absolute after:inset-0 after:z-3 after:rounded-[inherit] after:shadow-hairline after:content-['']
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | `[--log-pad:3px]` |
| `default` | `[--log-pad:5px]` |
| `comfortable` | `[--log-pad:7px]` |

## MarkdownEditor

### `markdownEditorVariants`

Defined in `@/components/ui/markdown-editor`. Base classes:

```text
[ 'bl-mde group/mde relative box-border flex w-full min-w-0 flex-col text-left [font-family:inherit] text-foreground', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `plain` | `rounded-none bg-transparent` |
| `card` | `rounded-card bg-card shadow-hairline focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)] data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `bl-mde-sm` |
| `default` (default) | `bl-mde-md` |
| `lg` | `bl-mde-lg` |

## OpenCode

### `openCodeVariants`

Defined in `@/components/ui/open-code`. Base classes:

```text
group/open-code flex min-h-80 min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `rounded-card border border-border` |
| `plain` | — |

## Popover

### `popoverContentVariants`

Defined in `@/components/ui/popover`. Base classes:

```text
[popoverSurface, popoverMotion, popoverSheet, 'box-border [--avatar-ring:var(--popover)]']
```

**`variant`** — default `panel`

| Value | Adds |
| --- | --- |
| `panel` (default) | `w-72 p-4` |
| `plain` | `min-w-(--anchor-width)` |

## Primitives

### `sectionLabelVariants`

Defined in `@/lib/primitives`. Base classes:

```text
m-0 min-w-0
```

**`variant`** — default `grouped`

| Value | Adds |
| --- | --- |
| `grouped` (default) | `text-footnote leading-[18px] font-normal tracking-[.02em] text-foreground/70 uppercase` |
| `sidebar` | `text-caption2 leading-4 font-bold tracking-[.06em] whitespace-nowrap text-foreground/65 uppercase` |
| `menu` | `text-footnote leading-[18px] font-semibold text-muted-foreground` |

### `calloutVariants`

Defined in `@/lib/primitives`. Base classes:

```text
m-0 flex items-start gap-2 rounded-ctl px-3 py-2.5 text-footnote text-foreground [&>[data-slot=icon]]:mt-px [&>[data-slot=icon]]:shrink-0
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-secondary [&>[data-slot=icon]]:text-muted-foreground` |
| `success` | `bg-success/12 [&>[data-slot=icon]]:text-success` |
| `warning` | `bg-warning/14 [&>[data-slot=icon]]:text-warning` |
| `destructive` | `bg-destructive/10 [&>[data-slot=icon]]:text-destructive` |

## Progress

### `progressVariants`

Defined in `@/components/ui/progress`. Base classes:

```text
relative w-full overflow-hidden rounded-full bg-secondary-strong
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-1` |
| `default` (default) | `h-1.5` |
| `lg` | `h-2.5` |

### `progressIndicatorVariants`

Defined in `@/components/ui/progress`. Base classes:

```text
absolute inset-y-0 start-0 rounded-full transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none rtl:[--bl-progress-dir:-1] data-indeterminate:w-2/5 data-indeterminate:animate-bl-progress data-indeterminate:transition-none motion-reduce:data-indeterminate:w-full motion-reduce:data-indeterminate:animate-none motion-reduce:data-indeterminate:opacity-35
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary` |
| `success` | `bg-success` |
| `warning` | `bg-warning` |
| `destructive` | `bg-destructive` |

## ProgressRing

### `progressRingVariants`

Defined in `@/components/ui/progress-ring`. Base classes:

```text
relative inline-grid size-(--ring-px) shrink-0 place-items-center align-middle
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[--ring-color:var(--primary)]` |
| `success` | `[--ring-color:var(--color-success)]` |
| `warning` | `[--ring-color:var(--color-warning)]` |
| `destructive` | `[--ring-color:var(--destructive)]` |

### `countdownRingValueVariants`

Defined in `@/components/ui/progress-ring`. Base classes:

```text
absolute inset-0 grid place-items-center font-semibold tabular-nums text-(length:--ring-font) transition-colors duration-300
```

**`urgent`** — default `false`

| Value | Adds |
| --- | --- |
| `false` (default) | `text-muted-foreground` |
| `true` | `text-(--ring-urgent)` |

## ProgressStepper

### `progressStepperVariants`

Defined in `@/components/ui/progress-stepper`. Base classes:

```text
m-0 flex list-none p-0 [--stepper-accent:var(--primary)] [--stepper-track:var(--secondary-strong)]
```

**`variant`** — default `bars`

| Value | Adds |
| --- | --- |
| `bars` (default) | `gap-1.5` |
| `line` | `gap-0` |

## RadioGroup

### `radioGroupVariants`

Defined in `@/components/ui/radio-group`. Base classes:

```text
group/radio-group flex
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `flex-col gap-3` |
| `horizontal` | `flex-row flex-wrap gap-5` |

### `radioVariants`

Defined in `@/components/ui/radio-group`. Base classes:

```text
[ 'box-border grid size-[22px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-control-border bg-transparent p-0', 'transition-[border-width,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'data-checked:border-[7px] data-checked:border-primary', 'active:not-data-disabled:scale-90', pressableFocusRing, // Invalid: the radio itself (`aria-invalid`, which a Field writes on its control) or the group around it. 'aria-invalid:border-destructive group-aria-invalid/radio-group:border-destructive', 'data-disabled:cursor-default data-disabled:opacity-40', ]
```

No variants.

## Schedule Preview

### `previewPanelVariants`

Defined in `@/lib/schedule-preview`. Base classes:

```text
flex min-w-0 flex-col gap-2
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `rounded-panel p-3 shadow-hairline` |
| `plain` | `px-1` |

## ScrollArea

### `scrollAreaViewportVariants`

Defined in `@/components/ui/scroll-area`. Base classes:

```text
bl-scroll min-h-0 flex-1 overscroll-contain rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `overflow-x-hidden! overflow-y-auto!` |
| `horizontal` | `overflow-x-auto! overflow-y-hidden!` |
| `both` | `overflow-auto` |

## SearchInput

### `searchInputVariants`

Defined in `@/components/ui/search-input`. Base classes:

```text
[ 'box-border flex min-w-0 items-center bg-secondary text-foreground transition-[box-shadow] duration-spring-snappy ease-spring-snappy', // The fill stays on focus, as on iOS; the focus line is the field's. fieldFocusRing, 'has-[input:disabled]:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 gap-1.5 rounded-lg px-2 text-footnote` |
| `default` (default) | `h-9 gap-[7px] rounded-[11px] px-[9px] text-body` |

## Segmented

### `segmentTrackVariants`

Defined in `@/components/ui/segmented`. Base classes:

```text
group/segments relative isolate gap-0.5 bg-secondary p-0.5 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `rounded-lg` |
| `default` (default) | `rounded-ctl` |
| `lg` | `rounded-xl` |

### `segmentItemVariants`

Defined in `@/components/ui/segmented`. Base classes:

```text
[ 'bl-btn relative box-border flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent [font-family:inherit] font-medium whitespace-nowrap text-foreground outline-none [&_svg]:shrink-0', 'data-checked:font-semibold data-selected:font-semibold data-pressed:font-semibold', // An unselected segment dims under the finger (as on iOS) until the card slides to it. 'transition-opacity duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'active:not-data-disabled:not-data-checked:not-data-selected:not-data-pressed:opacity-60', // Stacked, each segment keeps its height instead of sharing the track's. 'group-data-[orientation=vertical]/segments:flex-none', // The solid ring of every control, without the offset: the neighbours are 2px away. 'focus-visible:ring-2 focus-visible:ring-ring', 'pointer-coarse:group-data-[orientation=horizontal]/segments:after:absolute pointer-coarse:group-data-[orientation=horizontal]/segments:after:inset-x-0', 'data-disabled:cursor-default not-in-data-disabled:data-disabled:opacity-40', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-7 px-2.5 text-footnote leading-[inherit] rounded-[calc(var(--radius-lg)-2px)] pointer-coarse:after:-inset-y-2` |
| `default` (default) | `h-8 px-3 text-subhead leading-[inherit] rounded-[calc(var(--radius-ctl)-2px)] pointer-coarse:after:-inset-y-1.5` |
| `lg` | `h-10 px-3.5 text-callout leading-[inherit] rounded-[calc(var(--radius-xl)-2px)] pointer-coarse:after:-inset-y-0.5` |

### `segmentIndicatorVariants`

Defined in `@/components/ui/segmented`. Base classes:

```text
bg-segment shadow-[0_1px_4px_black] shadow-black/14
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `rounded-[calc(var(--radius-lg)-2px)]` |
| `default` (default) | `rounded-[calc(var(--radius-ctl)-2px)]` |
| `lg` | `rounded-[calc(var(--radius-xl)-2px)]` |

## Select

### `selectTriggerVariants`

Defined in `@/components/ui/select`. Base classes:

```text
bl-btn box-border flex cursor-pointer items-center gap-2 border-0 text-left [font-family:inherit] text-foreground outline-none data-disabled:cursor-default
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `w-full justify-between active:not-data-disabled:bg-secondary-strong data-open:bg-transparent data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]` |
| `plain` | `[ 'w-auto justify-end rounded-lg bg-transparent px-1 text-muted-foreground transition-opacity duration-spring-snappy ease-spring-snappy', '…` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 text-subhead` |
| `default` (default) | `h-11 text-body` |
| `lg` | `h-[50px] text-body` |

## Separator

### `separatorVariants`

Defined in `@/components/ui/separator`. Base classes:

```text
m-0 shrink-0 border-0 bg-border
```

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | `h-px w-full` |
| `vertical` | `w-px self-stretch` |

**`inset`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `ms-4 w-[calc(100%-16px)] data-[orientation=vertical]:ms-0 data-[orientation=vertical]:w-px` |
| `false` (default) | — |

## Sheet

### `sheetVariants`

Defined in `@/components/ui/sheet`. Base classes:

```text
pointer-events-auto relative box-border flex flex-col shadow-[0_0_40px_black] shadow-black/22 outline-none after:absolute after:bg-inherit after:content-[''] data-dragging:select-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-card text-card-foreground` |
| `tray` | `rounded-sheet bg-card text-card-foreground after:hidden` |
| `panel` | `bg-background text-foreground` |

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `bottom` (default) | `max-h-[calc(100%-48px)] w-full pb-[max(12px,env(safe-area-inset-bottom))] after:inset-x-0 after:top-full after:h-24` |
| `top` | `max-h-[calc(100%-48px)] w-full pt-(--bl-safe-top) after:inset-x-0 after:bottom-full after:h-24` |
| `left` | `mr-auto h-full w-[85%] max-w-[360px] after:inset-y-0 after:right-full after:w-24` |
| `right` | `ml-auto h-full w-[85%] max-w-[360px] after:inset-y-0 after:left-full after:w-24` |

12 compound variants — see the source.

## Sidebar

### `sidebarItemVariants`

Defined in `@/components/ui/sidebar`. Base classes:

```text
[ 'relative flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-start font-sans select-none', 'outline-none transition-colors duration-150 hover:bg-secondary active:bg-secondary-strong', 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', 'data-disabled:cursor-default data-disabled:opacity-40 data-disabled:hover:bg-transparent', ]
```

**`current`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-secondary-strong font-medium [&_[data-slot=sidebar-icon]]:text-primary` |
| `false` (default) | — |

**`compact`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `min-h-11 text-subhead` |
| `false` (default) | `min-h-8 text-footnote` |

**`tinted`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `font-semibold text-(color:--sidebar-tint) [&_[data-slot=sidebar-icon]]:text-(color:--sidebar-tint)` |
| `false` (default) | — |

2 compound variants — see the source.

## Skeleton

### `skeletonVariants`

Defined in `@/components/ui/skeleton`. Base classes:

```text
[ // The sheen is lighter than the bar in both appearances: the card color in light, a whisper of the foreground in // dark (the dark card is darker than the bar, and would sweep a shadow across it). '[--skeleton-sheen:color-mix(in_oklab,var(--card)_55%,transparent)] dark:[--skeleton-sheen:color-mix(in_oklab,var(--foreground)_8%,transparent)]', 'block bg-secondary-strong [background-image:linear-gradient(90deg,transparent_25%,var(--skeleton-sheen)_50%,transparent_75%)] [background-size:200%_100%] [background-position:150%_0] [background-repeat:no-repeat] animate-bl-shimmer motion-reduce:animate-none', ]
```

**`shape`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-ctl` |
| `rect` | `rounded-[3px]` |
| `text` | `h-3.5 rounded-full` |
| `circle` | `shrink-0 rounded-full` |

## Slider

### `sliderVariants`

Defined in `@/components/ui/slider`. Base classes:

```text
[ 'group/slider grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40', // Stood up: the label and value over a control that takes the rest of the parent's height. 'data-[orientation=vertical]:flex data-[orientation=vertical]:h-full data-[orientation=vertical]:w-fit data-[orientation=vertical]:flex-col', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `overlay` | `[--bl-slider-track:light-dark(--alpha(black/14%),--alpha(white/22%))] [--bl-slider-fill:light-dark(--alpha(black/72%),--alpha(white/88%))]` |

## SplitView

### `splitViewItemVariants`

Defined in `@/components/ui/split-view`. Base classes:

```text
[ 'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-start [font-family:inherit] text-subhead text-foreground outline-none', 'transition-[background-color,color] duration-150', 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', 'disabled:cursor-default disabled:opacity-45', ]
```

**`variant`** — default `pill`

| Value | Adds |
| --- | --- |
| `pill` (default) | `min-h-10 rounded-ctl px-2.5 py-1.5 group-data-[size-class=compact]/split:min-h-11` |
| `row` | `min-h-row px-4 py-2.5` |

**`current`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | `bg-transparent not-disabled:hover:bg-secondary not-disabled:active:bg-accent` |

**`tinted`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

4 compound variants — see the source.

## Spreadsheet

### `spreadsheetVariants`

Defined in `@/components/ui/spreadsheet`. Base classes:

```text
relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | — |
| `default` | — |
| `comfortable` | — |

## Surface parts

### `surfaceHeaderVariants`

Defined in `@/lib/surface`. Base classes:

```text
flex
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `flex-col gap-1 px-5 pt-5 pb-3` |
| `bar` | `relative z-2 min-h-[54px] shrink-0 items-start gap-2.5 ps-5 pe-4 pt-4 pb-2` |

### `surfaceTitleVariants`

Defined in `@/lib/surface`. Base classes:

```text
m-0 font-semibold text-foreground
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-body leading-[22px]` |
| `default` (default) | `text-title leading-[25px] tracking-[-.3px]` |

### `surfaceDescriptionVariants`

Defined in `@/lib/surface`. Base classes:

```text
m-0 text-muted-foreground
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-footnote leading-[18px]` |
| `default` (default) | `text-subhead leading-[20px]` |

### `surfaceBodyVariants`

Defined in `@/lib/surface`. Base classes:

```text
bl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-2 text-subhead
```

No variants.

### `surfaceFooterVariants`

Defined in `@/lib/surface`. Base classes:

```text
flex gap-2 px-5 pt-3 pb-5
```

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | `items-center justify-end` |
| `vertical` | `flex-col` |

### `closeButtonVariants`

Defined in `@/lib/surface`. Base classes:

```text
cn( "bl-btn grid size-[30px] shrink-0 after:absolute after:-inset-[7px] after:rounded-full after:content-[''] cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground transition-[background-color,color] duration-exit hover:text-foreground active:bg-secondary-strong disabled:cursor-default disabled:opacity-40", focusRing, )
```

**`layout`** — default `inline`

| Value | Adds |
| --- | --- |
| `inline` (default) | `relative` |
| `pinned` | `absolute top-4 end-4 z-2` |

### `sheetGrabberVariants`

Defined in `@/lib/surface`. Base classes:

```text
mx-auto mt-[5px] mb-px block h-[5px] w-9 shrink-0 rounded-full bg-secondary-strong
```

**`handle`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cn('relative cursor-grab border-0 p-0 after:absolute after:-inset-x-4 after:-inset-y-3 active:cursor-grabbing', focusRing)` |
| `false` (default) | — |

## Switch

### `switchVariants`

Defined in `@/components/ui/switch`. Base classes:

```text
[ 'group/switch relative inline-block shrink-0 cursor-pointer rounded-full border-0 bg-secondary-strong p-0 transition-[background-color] duration-spring-smooth ease-spring-smooth', pressableFocusRing, 'data-checked:bg-success data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-[31px] w-[51px]` |
| `sm` | `h-[22px] w-[38px]` |

## Tabs

### `tabsVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
flex min-h-0 min-w-0 [&>[data-slot=tabs-panels]~[data-slot=tabs-bar]]:-order-1 [&>[data-slot=tabs-panels]~[data-slot=tabs-list]]:-order-1 [&>[data-slot=tabs-panel]~[data-slot=tabs-list]]:-order-1
```

**`side`** — default `top`

| Value | Adds |
| --- | --- |
| `top` (default) | `flex-col` |
| `bottom` | `flex-col-reverse` |
| `start` | `flex-row` |
| `end` | `flex-row-reverse` |

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `gap-4` |
| `underline` | `gap-4` |
| `bar` | — |
| `rail` | — |
| `switcher` | — |
| `plain` | — |

### `tabsBarVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
box-border
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `segmented` | `inline` |
| `underline` | `inline` |
| `bar` | `cn( 'absolute inset-x-0 bottom-0 z-120 flex data-[side=top]:top-0 data-[side=top]:bottom-auto transition-transform duration-spring-smooth ease-spring-s…` |
| `rail` | `relative flex w-19 shrink-0 flex-col gap-1 bg-bar py-2 data-[side=end]:border-s data-[side=start]:border-e border-border` |
| `switcher` | `flex w-13 shrink-0 flex-col items-center gap-2 border-e border-border bg-muted px-0 py-2.5` |
| `plain` (default) | `inline` |

### `tabsListVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
relative outline-none
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `flex` |
| `underline` | `isolate flex gap-5 shadow-hairline-b data-[orientation=vertical]:flex-col data-[orientation=vertical]:gap-0 data-[orientation=vertical]:border-e data-[orientat…` |
| `bar` | `flex flex-1` |
| `rail` | `flex flex-col gap-1 px-1.5` |
| `switcher` | `flex min-h-0 w-full flex-col items-center gap-2 overflow-y-auto overscroll-contain -mt-1 -mb-1.5 pt-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidd…` |
| `plain` | `flex data-[orientation=vertical]:flex-col` |

### `tabsTabVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
group/tab relative box-border cursor-pointer border-0 bg-transparent [font-family:inherit] outline-none data-disabled:cursor-default
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | — |
| `underline` | `cn( 'bl-btn -mb-px flex items-center justify-center gap-1.5 px-0.5 py-0 leading-[inherit] font-semibold whitespace-nowrap hover:not-data-selected:not…` |
| `bar` | `cn( 'bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] p-0 text-center leading-[normal] data-selected:text-primary focus-visible:roun…` |
| `rail` | `cn( 'bl-btn flex flex-col items-center justify-center gap-[3px] rounded-panel px-1 pt-[7px] pb-1.5 text-center leading-[normal] hover:not-data-select…` |
| `switcher` | `group flex w-full shrink-0 justify-center p-0 text-inherit pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5` |
| `plain` | `p-0 text-inherit` |

4 compound variants — see the source.

### `tabsIndicatorVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
absolute
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `inset-0` |
| `underline` | `bg-primary` |
| `bar` | `bg-primary` |
| `rail` | `bg-primary` |
| `switcher` | `bg-primary` |
| `plain` | `bg-primary` |

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | — |
| `vertical` | — |

5 compound variants — see the source.

### `tabsPillVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
pointer-events-none absolute start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-sm bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none data-attention:h-1.5 data-attention:opacity-100 group-hover/tab:not-data-selected:h-3.5 group-hover/tab:not-data-selected:opacity-100 data-selected:h-7 data-selected:opacity-100
```

No variants.

### `tabsActionVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `segmented` | `bl-btn border-0 bg-transparent p-0 [font-family:inherit] text-muted-foreground hover:not-data-disabled:text-foreground` |
| `underline` | `bl-btn border-0 bg-transparent p-0 [font-family:inherit] text-muted-foreground hover:not-data-disabled:text-foreground` |
| `bar` | `bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-muted-foreground acti…` |
| `rail` | `bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inhe…` |
| `switcher` | `relative grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-muted-foreground [transition:border…` |
| `plain` (default) | `bl-btn border-0 bg-transparent p-0 [font-family:inherit]` |

## Tailscale controls

### `tailscaleStatusBadgeVariants`

Defined in `@/components/ui/tailscale-controls`. Base classes:

```text
inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-footnote
```

**`variant`** — default `inline`

| Value | Adds |
| --- | --- |
| `inline` (default) | — |
| `stacked` | `flex-col items-start` |
| `pill` | — |

## Terminal

### `terminalVariants`

Defined in `@/components/ui/terminal`. Base classes:

```text
[ 'bl-scroll size-full min-h-0 min-w-0 rounded-none px-3 py-2.5 font-mono shadow-none', 'has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-ring has-[textarea:focus]:ring-inset', '[--term-bg:var(--background)] [--term-fg:var(--foreground)] [--term-cursor:var(--primary)]', '[--term-selection-bg:color-mix(in_oklab,var(--primary)_30%,transparent)] selection:bg-primary/30', '[--term-search-match:color-mix(in_oklab,var(--term-yellow)_30%,transparent)] [--term-search-active:color-mix(in_oklab,var(--term-yellow)_55%,transparent)] [--term-search-border:var(--term-yellow)]', '[--term-red:var(--destructive)] [--term-green:var(--success)] [--term-yellow:var(--warning)] [--term-blue:var(--link,var(--primary))]', '[--term-magenta:color-mix(in_oklch,var(--term-red),var(--term-blue))] [--term-cyan:color-mix(in_oklch,var(--term-blue),var(--term-green))]', '[--term-color-0:var(--foreground)] [--term-color-7:color-mix(in_oklab,var(--foreground)_55%,var(--background))] [--term-color-8:color-mix(in_oklab,var(--foreground)_55%,var(--background))] [--term-color-15:color-mix(in_oklab,var(--foreground)_70%,var(--background))]', '[--term-color-1:color-mix(in_oklab,var(--term-red)_85%,black)] [--term-color-2:color-mix(in_oklab,var(--term-green)_65%,black)] [--term-color-3:color-mix(in_oklab,var(--term-yellow)_55%,black)]', '[--term-color-4:color-mix(in_oklab,var(--term-blue)_85%,black)] [--term-color-5:color-mix(in_oklab,var(--term-magenta)_80%,black)] [--term-color-6:color-mix(in_oklab,var(--term-cyan)_65%,black)]', '[--term-color-9:var(--term-red)] [--term-color-10:color-mix(in_oklab,var(--term-green)_80%,black)] [--term-color-11:color-mix(in_oklab,var(--term-yellow)_70%,black)]', '[--term-color-12:var(--term-blue)] [--term-color-13:var(--term-magenta)] [--term-color-14:color-mix(in_oklab,var(--term-cyan)_80%,black)]', 'dark:not-[.light]:[--term-color-0:color-mix(in_oklab,var(--foreground)_18%,var(--background))] dark:not-[.light]:[--term-color-7:color-mix(in_oklab,var(--foreground)_80%,var(--background))] dark:not-[.light]:[--term-color-15:var(--foreground)]', 'dark:not-[.light]:[--term-color-1:var(--term-red)] dark:not-[.light]:[--term-color-2:var(--term-green)] dark:not-[.light]:[--term-color-3:var(--term-yellow)] dark:not-[.light]:[--term-color-4:var(--term-blue)] dark:not-[.light]:[--term-color-5:var(--term-magenta)] dark:not-[.light]:[--term-color-6:var(--term-cyan)]', 'dark:not-[.light]:[--term-color-9:color-mix(in_oklab,var(--term-red)_75%,white)] dark:not-[.light]:[--term-color-10:color-mix(in_oklab,var(--term-green)_75%,white)] dark:not-[.light]:[--term-color-11:color-mix(in_oklab,var(--term-yellow)_75%,white)]', 'dark:not-[.light]:[--term-color-12:color-mix(in_oklab,var(--term-blue)_75%,white)] dark:not-[.light]:[--term-color-13:color-mix(in_oklab,var(--term-magenta)_75%,white)] dark:not-[.light]:[--term-color-14:color-mix(in_oklab,var(--term-cyan)_75%,white)]', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `[--term-font-size:var(--text-caption)] [--term-row-height:16px]` |
| `default` (default) | `[--term-font-size:var(--text-footnote)] [--term-row-height:18px]` |

## Textarea

### `textareaVariants`

Defined in `@/components/ui/textarea`. Base classes:

```text
['block h-auto w-full resize-none py-2.5 leading-[22px] placeholder:text-tertiary-foreground', selectableText]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `min-h-16 text-subhead leading-[20px]` |
| `default` (default) | `min-h-24 text-body` |
| `lg` | `min-h-36 text-body` |

## Toast

### `toastRegionVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
group/toasts outline-none data-[side=top]:top-[calc(env(safe-area-inset-top,0px)_+_var(--bl-toast-offset))] data-[side=top]:[--bl-toast-dir:1] data-[side=bottom]:bottom-[calc(var(--keyboard-inset,0px)_+_env(safe-area-inset-bottom,0px)_+_var(--bl-toast-offset))] data-[side=bottom]:[--bl-toast-dir:-1] data-[align=start]:start-[calc(env(safe-area-inset-left,0px)_+_var(--bl-toast-offset))] data-[align=end]:end-[calc(env(safe-area-inset-right,0px)_+_var(--bl-toast-offset))]
```

**`variant`** — default `banner`

| Value | Adds |
| --- | --- |
| `banner` (default) | `h-[calc(var(--toast-front-height)_+_clamp(0,var(--toast-count)_-_1,2)_*_14px)] w-[min(360px,calc(100%-32px))] transition-[height] duration-spring-smooth ease-s…` |
| `hud` | `w-max max-w-[calc(100%-32px)] *:flex *:flex-col *:items-center *:gap-2` |

### `toastVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
['flex', pressableFocusRing]
```

**`variant`** — default `banner`

| Value | Adds |
| --- | --- |
| `banner` (default) | `[ 'absolute inset-x-0 z-[calc(100_-_var(--toast-index))] box-border h-(--toast-height) items-start gap-3 overflow-hidden rounded-card bg-card px-3.5 py…` |
| `hud` | `[ 'w-fit items-center gap-2 rounded-full bg-hud px-4 py-2.5 text-detail font-semibold text-hud-foreground shadow-hud backdrop-blur-xl backdrop-saturate…` |

### `toastIconVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
grid shrink-0 place-items-center
```

**`type`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-primary` |
| `info` | `text-primary` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `error` | `text-destructive` |
| `loading` | — |

## Toggle

### `toggleVariants`

Defined in `@/components/ui/toggle`. Base classes:

```text
[ 'bl-btn box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap [&_svg]:shrink-0', 'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none', pressableFocusRing, 'data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[ 'bg-transparent text-foreground hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong', 'data-pressed:bg-primary…` |
| `secondary` | `[ 'bg-secondary text-foreground hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong', 'data-pressed:bg-primary/1…` |
| `outline` | `[ 'bg-transparent text-foreground shadow-hairline hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong', 'data-pr…` |
| `quiet` | `[ 'bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary hover:not-data-disabled:text-foreground', 'data-pressed:bg-sec…` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 min-w-8 rounded-lg px-2 text-footnote` |
| `default` (default) | `h-9 min-w-9 rounded-ctl px-2.5 text-subhead` |
| `lg` | `h-11 min-w-11 rounded-xl px-3.5 text-callout` |
| `icon-sm` | `['relative size-7 rounded-lg p-0', coarseHitArea]` |
| `icon` | `size-9 rounded-full p-0` |
| `icon-lg` | `size-11 rounded-full p-0` |

### `toggleGroupVariants`

Defined in `@/components/ui/toggle`. Base classes:

```text
group/toggle-group relative isolate inline-flex w-fit items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1` |
| `secondary` | `gap-1` |
| `quiet` | `gap-1` |
| `outline` | `gap-0 rounded-ctl shadow-hairline` |
| `segmented` | — |

## Toolbar

### `toolbarVariants`

Defined in `@/components/ui/toolbar`. Base classes:

```text
box-border flex min-w-0 items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `plain` (default) | — |
| `floating` | `w-fit bg-popover p-1 text-popover-foreground shadow-popover` |
| `bar` | `cn(barSurface, 'w-full shrink-0 justify-between px-2')` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `gap-0.5` |
| `default` (default) | `gap-1` |
| `lg` | `gap-2` |

3 compound variants — see the source.

## TraceTimeline

### `traceTimelineVariants`

Defined in `@/components/ui/trace-timeline`. Base classes:

```text
font-sans touch-none select-none
```

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | `relative block h-(--tt-height) w-full cursor-crosshair rounded-[inherit] bg-background -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline…` |
| `vertical` | `absolute top-0 bottom-0 z-80 w-11 cursor-pointer rounded-lg -outline-offset-2 [outline:2px_solid_transparent] focus-visible:[outline:2px_solid_var(--primary)]` |

**`side`** — default `end`

| Value | Adds |
| --- | --- |
| `end` (default) | — |
| `start` | — |

2 compound variants — see the source.

## Tree

### `treeVariants`

Defined in `@/components/ui/tree`. Base classes:

```text
text-footnote text-foreground
```

**`density`** — default `default`

| Value | Adds |
| --- | --- |
| `compact` | `[--tree-row-height:24px] [--tree-pad-x:6.4px] [--tree-gap:4.8px] [--tree-indent:18.6875px] [--tree-nudge:0.8px] [--tree-inset:1.6px]` |
| `default` (default) | `[--tree-row-height:30px] [--tree-pad-x:8px] [--tree-gap:6px] [--tree-indent:21.5px] [--tree-nudge:1px] [--tree-inset:2px]` |
| `comfortable` | `[--tree-row-height:36px] [--tree-pad-x:9.6px] [--tree-gap:7.2px] [--tree-indent:24.28125px] [--tree-nudge:1.2px] [--tree-inset:2.4px]` |

### `treeRowVariants`

Defined in `@/components/ui/tree`. Base classes:

```text
[ 'group/tree-row relative box-border flex h-(--tree-row-height) w-full min-w-0 cursor-default items-center gap-(--tree-gap) rounded-ctl pe-(--tree-pad-x) leading-(--tree-row-height) select-none', // Logical, so a row's own `ps-*` (ObjectTree's capped indent) merges with it, and the indent follows the text direction. 'ps-[calc(var(--tree-pad-x)+(var(--tree-level,1)-1)*var(--tree-indent))]', 'hover:not-data-disabled:not-data-selected:bg-secondary data-selected:bg-primary/16 data-current:font-medium data-disabled:opacity-50 data-pending:cursor-progress', 'group-focus-visible/tree-item:[box-shadow:inset_0_0_0_2px_var(--ring)]', 'group-data-dimmed/tree-item:opacity-60 group-data-drop-target/tree-item:bg-secondary group-data-drop-target/tree-item:[box-shadow:inset_0_0_0_2px_var(--primary)]', ]
```

No variants.

## Vault Gate

### `vaultRecoveryKeyVariants`

Defined in `@/components/ui/vault-gate`. Base classes:

```text
grid justify-center gap-x-6 gap-y-1 rounded-ctl bg-secondary px-3 py-3 font-mono text-callout font-semibold tracking-wide text-foreground tabular-nums select-text [-webkit-user-select:text]
```

**`variant`** — default `grid`

| Value | Adds |
| --- | --- |
| `grid` (default) | `grid-cols-[repeat(2,max-content)]` |
| `row` | `grid-cols-[repeat(4,max-content)]` |

## Waveform

### `waveformVariants`

Defined in `@/components/ui/waveform`. Base classes:

```text
relative block h-full w-full
```

**`variant`** — default `mirror`

| Value | Adds |
| --- | --- |
| `mirror` (default) | — |
| `bottom` | — |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground/70` |
| `muted` | `text-muted-foreground/60` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `destructive` | `text-destructive` |
