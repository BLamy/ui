# Variants reference

Every BL UI component is a [cva](https://cva.style) recipe. This page is generated from the source (90 recipes) — the same functions you can call on any element, and the defaults you can edit in your installed copy. See [Styling and variants](https://blamy.github.io/ui/#/styling) for how to use, compose and change them.

```tsx
import { buttonVariants } from '@/components/ui/button'

<a href="/docs" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Docs</a>
```

## ArtifactChatContainer

### `artifactChatContainerVariants`

Defined in `@/components/ui/artifact-chat-container`. Base classes:

```text
ck-artifact-chat relative isolate h-full w-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]
```

**`layout`** — default `split`

| Value | Adds |
| --- | --- |
| `split` (default) | `grid` |
| `floating` | `block` |

**`chatSide`** — default `left`

| Value | Adds |
| --- | --- |
| `left` (default) | — |
| `right` | — |

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

### `avatarGroupVariants`

Defined in `@/components/ui/avatar`. Base classes:

```text
inline-flex items-center rounded-full outline-none [&>*]:ring-2 [&>*]:ring-(--avatar-ring,var(--background)) [&>*+*]:-ml-(--avatar-overlap)
```

No variants.

## Badge

### `badgeVariants`

Defined in `@/components/ui/badge`. Base classes:

```text
box-border inline-flex h-[22px] shrink-0 items-center justify-center gap-1 rounded-full px-2 text-caption leading-none font-semibold whitespace-nowrap [&>svg]:size-3
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `tinted` | `bg-primary/15 text-primary` |
| `outline` | `text-foreground shadow-hairline` |
| `destructive` | `bg-destructive text-white` |
| `success` | `bg-success text-white` |

## Breadcrumb

### `breadcrumbVariants`

Defined in `@/components/ui/breadcrumb`. Base classes:

```text
relative block w-full min-w-0 overflow-clip whitespace-nowrap text-foreground [overflow-clip-margin:4px]
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
[ 'bl-btn box-border inline-flex max-w-full min-w-0 items-center rounded-md border-0 bg-transparent text-foreground/70 no-underline [font-family:inherit] whitespace-nowrap outline-none transition-colors motion-reduce:transition-none', 'data-current:text-foreground', 'data-focus-visible:ring-2 data-focus-visible:ring-ring', ]
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
| `true` (default) | `cursor-pointer data-hovered:bg-secondary data-hovered:text-foreground data-pressed:bg-secondary-strong aria-expanded:bg-secondary aria-expanded:text-foreground…` |
| `false` | `cursor-default` |

## Button

### `buttonVariants`

Defined in `@/components/ui/button`. Base classes:

```text
bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy data-pressed:not-aria-expanded:scale-[.97] motion-reduce:transition-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `ghost` | `bg-transparent text-foreground data-hovered:bg-accent` |
| `destructive` | `bg-destructive text-white` |
| `link` | `bg-transparent p-0 text-primary` |
| `quiet` | `bg-transparent text-muted-foreground data-hovered:bg-secondary` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-9 rounded-ctl px-4 text-subhead font-semibold` |
| `sm` | `h-8 rounded-lg px-3 text-footnote font-semibold` |
| `lg` | `h-11 rounded-xl px-5 text-callout font-semibold` |
| `pill` | `w-full rounded-card px-3 py-[13px] text-callout font-semibold` |
| `icon` | `size-9 rounded-full p-0` |
| `icon-sm` | `grid place-items-center rounded-[7px] p-[5px]` |

**`active`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

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

## Card

### `cardVariants`

Defined in `@/components/ui/card`. Base classes:

```text
flex flex-col overflow-hidden rounded-card text-card-foreground
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-card` |
| `elevated` | `bg-card shadow-[0_6px_24px_--alpha(black/10%),0_0_0_.5px_var(--border)]` |
| `outline` | `bg-transparent shadow-hairline` |

## Checkbox

### `checkboxVariants`

Defined in `@/components/ui/checkbox`. Base classes:

```text
[ 'box-border grid size-[22px] shrink-0 place-items-center border-[1.5px] border-tertiary-foreground text-white', 'transition-[background-color,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'group-data-selected:border-primary group-data-selected:bg-primary', 'group-data-indeterminate:border-primary group-data-indeterminate:bg-primary', 'group-data-pressed:scale-90 group-data-focus-visible:ring-[3px] group-data-focus-visible:ring-ring/45', 'group-data-invalid:border-destructive group-data-invalid:group-data-selected:bg-destructive', ]
```

**`shape`** — default `circle`

| Value | Adds |
| --- | --- |
| `circle` (default) | `rounded-full` |
| `square` | `rounded-md` |

## ColorField

### `colorFieldGroupVariants`

Defined in `@/components/ui/color-field`. Base classes:

```text
[ 'box-border flex w-full min-w-0 items-center gap-2 bg-input px-3 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset', 'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |

## Composer

### `composerFabVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
[ pressable, 'z-3 grid size-[52px] cursor-pointer place-items-center rounded-[50%] border border-border bg-card p-0 text-foreground shadow-[0_10px_30px_-8px_color-mix(in_srgb,black_45%,transparent),0_2px_8px_color-mix(in_srgb,black_14%,transparent)] outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary/60', ]
```

No variants.

### `composerCardVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
relative z-1 box-border flex min-w-0 flex-wrap items-center border border-border bg-card
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-[15px] shadow-[0_6px_24px_black] shadow-black/8 dark:shadow-black/28` |
| `lg` | `rounded-[22px] shadow-[0_8px_30px_black] shadow-black/8 dark:shadow-black/22` |

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

### `composerButtonVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
cn(pressable, 'flex shrink-0 cursor-pointer items-center justify-center border-0 font-sans outline-none data-disabled:cursor-default data-disabled:opacity-35 data-focus-visible:ring-2 data-focus-visible:ring-primary/60')
```

**`variant`** — default `ghost`

| Value | Adds |
| --- | --- |
| `ghost` (default) | `bg-transparent text-muted-foreground hover:bg-secondary!` |
| `pill` | `gap-[5px] rounded-[7px] bg-transparent px-[7px] py-[5px] text-[12.5px] font-semibold text-muted-foreground hover:bg-secondary!` |
| `primary` | `rounded-[50%] bg-primary text-white [transition:opacity_var(--duration-spring-snappy)_var(--ease-spring-snappy)]` |
| `destructive` | `rounded-[50%] bg-destructive text-white` |

**`size`** — default `icon`

| Value | Adds |
| --- | --- |
| `icon` (default) | `size-7 rounded-[7px] p-0` |
| `round` | `size-[30px] rounded-[50%] p-0` |
| `pill` | — |

**`tint`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `text-primary` |
| `false` (default) | — |

1 compound variant — see the source.

### `composerMenuItemVariants`

Defined in `@/components/ui/composer/composer`. Base classes:

```text
relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[7px] text-footnote text-foreground outline-none data-focused:bg-secondary data-pressed:bg-secondary-strong data-disabled:cursor-default data-disabled:opacity-40
```

No variants.

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
| `detached` | `rounded-[9px] bg-secondary` |
| `flush` | — |

6 compound variants — see the source.

## Credenza

### `credenzaVariants`

Defined in `@/components/ui/credenza`. Base classes:

```text
z-401 box-border overflow-hidden bg-card text-foreground shadow-[0_24px_80px_--alpha(black/34%),0_0_0_1px_var(--border)] outline-none
```

**`compact`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `absolute inset-x-2.5 bottom-2.5 touch-none rounded-[28px]` |
| `false` (default) | `absolute top-1/2 left-1/2 w-[400px] max-w-[calc(100%-44px)] rounded-[24px]` |

## CronEditor

### `cronEditorVariants`

Defined in `@/components/ui/cron-editor`. Base classes:

```text
flex min-w-0 flex-col gap-3 text-footnote
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `[&_[data-surface]]:rounded-panel [&_[data-surface]]:bg-secondary [&_[data-surface]]:p-3` |
| `plain` | `[&_[data-surface]]:px-1` |

## DateField

### `dateInputVariants`

Defined in `@/components/ui/date-field`. Base classes:

```text
flex min-w-0 items-center text-foreground [font-family:inherit] whitespace-nowrap
```

**`variant`** — default `field`

| Value | Adds |
| --- | --- |
| `field` (default) | `[ 'box-border w-full rounded-ctl bg-input px-3 outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', …` |
| `bare` | `flex-1` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `text-subhead` |
| `default` (default) | `text-body` |
| `lg` | `text-body` |

3 compound variants — see the source.

## DatePicker

### `datePickerFieldVariants`

Defined in `@/components/ui/date-picker`. Base classes:

```text
[ 'flex min-w-0 items-center gap-1 bg-input pl-3 pr-1.5 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-focus-within:bg-transparent data-focus-within:ring-[1.5px] data-focus-within:ring-primary data-focus-within:ring-inset', 'group-data-open:bg-transparent group-data-open:ring-[1.5px] group-data-open:ring-primary group-data-open:ring-inset', 'data-invalid:ring-[1.5px] data-invalid:ring-destructive data-invalid:ring-inset data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |

## Dialog

### `dialogVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
relative box-border flex max-h-full flex-col overflow-hidden bg-card text-card-foreground shadow-[0_24px_80px_--alpha(black/30%),0_0_0_.5px_var(--border)] outline-none
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `alert` | `w-[270px] rounded-card data-entering:animate-bl-alert-in data-exiting:animate-bl-alert-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-ex…` |
| `default` (default) | `w-full max-w-[400px] rounded-[20px] data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduc…` |
| `lg` | `w-full max-w-[560px] rounded-[20px] data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduc…` |

### `dialogActionVariants`

Defined in `@/components/ui/dialog`. Base classes:

```text
cn('bl-btn box-border flex h-11 cursor-pointer items-center justify-center border-0 bg-transparent px-3 [font-family:inherit] text-body whitespace-nowrap text-primary transition-[background-color] duration-exit data-pressed:bg-accent data-disabled:cursor-default data-disabled:opacity-40', focusRing, 'data-focus-visible:ring-inset')
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `font-normal` |
| `cancel` | `font-semibold` |
| `destructive` | `font-normal text-destructive` |

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
| `inset` | `overflow-hidden rounded-panel bg-card px-4` |

## DropdownMenu

### `dropdownMenuItemVariants`

Defined in `@/components/ui/dropdown-menu`. Base classes:

```text
[ 'bl-btn relative box-border flex min-h-11 cursor-pointer items-center gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px] outline-none', 'data-focused:bg-accent data-pressed:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40', // Hairline between rows — not under the last row, nor above a section band. 'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden [&:has(+[role=separator])]:after:hidden', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground` |
| `destructive` | `text-destructive` |

## Edge Drawer

### `edgeDrawerVariants`

Defined in `@/components/ui/edge-drawer`. Base classes:

```text
absolute inset-y-0 z-(--edge-drawer-z) transition-[translate,box-shadow] duration-spring-tray ease-spring-tray motion-reduce:transition-none
```

**`side`** — default `left`

| Value | Adds |
| --- | --- |
| `left` (default) | `left-0` |
| `right` | `right-0` |

**`open`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

**`lifted`** — default `true`

| Value | Adds |
| --- | --- |
| `true` (default) | — |
| `false` | — |

3 compound variants — see the source.

## FileUpload

### `fileDropZoneVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
group/zone relative box-border flex border-2 border-dashed border-border text-center outline-none transition-[border-color,background-color,box-shadow,opacity] duration-spring-snappy motion-reduce:transition-none data-drop-target:border-primary data-drop-target:bg-primary/10 data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-invalid:border-destructive data-disabled:opacity-40
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-h-40 flex-col items-center justify-center gap-2 rounded-card p-6` |
| `compact` | `flex-row items-center justify-start gap-3 rounded-panel p-3 text-left` |

### `fileItemVariants`

Defined in `@/components/ui/file-upload`. Base classes:

```text
box-border flex items-center gap-3 rounded-panel border border-border bg-card p-3 text-card-foreground transition-colors duration-spring-snappy motion-reduce:transition-none data-[status=error]:border-destructive data-[status=rejected]:border-destructive
```

No variants.

## Filter

### `filterBarVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
flex min-w-0 flex-col gap-2
```

No variants.

### `filterToolbarVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
flex min-w-0 flex-wrap items-center gap-1.5
```

No variants.

### `filterChipVariants`

Defined in `@/components/ui/filter`. Base classes:

```text
box-border inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-lg text-foreground
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-7 text-footnote` |
| `sm` | `h-6 text-caption` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-secondary shadow-hairline` |
| `preview` | `bg-primary/10 text-foreground shadow-hairline` |

## FilterInput

### `filterInputVariants`

Defined in `@/components/ui/filter-input`. Base classes:

```text
flex min-w-0 flex-col gap-1.5
```

No variants.

## FloatingChat

### `floatingChatVariants`

Defined in `@/components/ui/floating-chat`. Base classes:

```text
ck-floating-chat pointer-events-none absolute inset-0 z-40 text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]
```

**`tone`** — default `auto`

| Value | Adds |
| --- | --- |
| `auto` (default) | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `dark` | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `light` | `[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]` |

### `floatingChatBumpVariants`

Defined in `@/components/ui/floating-chat`. Base classes:

```text
ck-floating-chat__bump
```

**`appearance`** — default `glass`

| Value | Adds |
| --- | --- |
| `glass` (default) | `border-[color:rgba(var(--ck-sheet-line),.14)] bg-[color:rgba(var(--ck-sheet-surface),calc(.5_+_.4_*_var(--bump-progress,0)))] [box-shadow:inset_0_1px_0_color-m…` |
| `sheet` | `border-[color:rgba(var(--ck-sheet-line),.1)] bg-(--ck-host-card)` |

### `floatingChatFabVariants`

Defined in `@/components/ui/floating-chat`. Base classes:

```text
absolute border-[color:rgba(var(--ck-sheet-line),.14)] text-foreground
```

**`appearance`** — default `glass`

| Value | Adds |
| --- | --- |
| `glass` (default) | `bg-[color:rgba(var(--ck-sheet-surface),.62)]` |
| `sheet` | `bg-card` |

**`position`** — default `bottom-center`

| Value | Adds |
| --- | --- |
| `top-left` | `top-(--ck-chat-gutter) left-(--ck-chat-gutter)` |
| `top-center` | `top-(--ck-chat-gutter) left-1/2 -translate-x-1/2` |
| `top-right` | `top-(--ck-chat-gutter) right-(--ck-chat-gutter)` |
| `center-left` | `top-1/2 left-(--ck-chat-gutter) -translate-y-1/2` |
| `center-right` | `top-1/2 right-(--ck-chat-gutter) -translate-y-1/2` |
| `bottom-left` | `bottom-(--ck-chat-gutter) left-(--ck-chat-gutter)` |
| `bottom-center` (default) | `bottom-[max(var(--ck-chat-gutter),20px)] left-1/2 -translate-x-1/2` |
| `bottom-right` | `bottom-(--ck-chat-gutter) right-(--ck-chat-gutter)` |

## FloatingSheet

### `floatingSheetSurfaceVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
surfaceBase
```

**`appearance`** — default `glass`

| Value | Adds |
| --- | --- |
| `glass` (default) | `border-[color:rgba(var(--ck-sheet-line),var(--ck-sheet-border-alpha,.12))] bg-[color:rgba(var(--ck-sheet-surface),var(--ck-sheet-bg-alpha,.28))] bg-[linear-gra…` |
| `sheet` | `border-[color:rgba(var(--ck-sheet-line),calc(var(--ck-sheet-border-alpha,.12)_*_.5))] bg-card [box-shadow:0_-1px_0_rgba(var(--ck-sheet-line),.04),0_2px_10px_co…` |

**`placement`** — default `resting`

| Value | Adds |
| --- | --- |
| `resting` (default) | `[transform:translateX(-50%)]` |
| `hidden` | `[transform:translate(-50%,calc(100%_+_44px))]` |
| `top-left` | `top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:none]` |
| `top-center` | `top-[var(--ck-sheet-gutter,20px)] right-auto bottom-auto left-1/2 [transform:translateX(-50%)]` |
| `top-right` | `top-[var(--ck-sheet-gutter,20px)] right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:none]` |
| `center-left` | `top-1/2 right-auto bottom-auto left-[var(--ck-sheet-gutter,20px)] [transform:translateY(-50%)]` |
| `center-right` | `top-1/2 right-[var(--ck-sheet-gutter,20px)] bottom-auto left-auto [transform:translateY(-50%)]` |
| `bottom-left` | `top-auto right-auto bottom-[var(--ck-sheet-gutter,20px)] left-[var(--ck-sheet-gutter,20px)] [transform:none]` |
| `bottom-center` | `top-auto right-auto bottom-[max(var(--ck-sheet-gutter,20px),20px)] left-1/2 [transform:translateX(-50%)]` |
| `bottom-right` | `top-auto right-[var(--ck-sheet-gutter,20px)] bottom-[var(--ck-sheet-gutter,20px)] left-auto [transform:none]` |

**`hidden`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `pointer-events-none opacity-0` |
| `false` (default) | — |

### `floatingSheetVariants`

Defined in `@/components/ui/floating-sheet`. Base classes:

```text
ck-floating-sheet pointer-events-none absolute inset-0 z-40 text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]
```

**`tone`** — default `auto`

| Value | Adds |
| --- | --- |
| `auto` (default) | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `dark` | `[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]` |
| `light` | `[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]` |

## FontPicker

### `fontListItemVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
h-10 min-h-0 scroll-my-1.5 py-0 data-hovered:bg-accent
```

No variants.

### `fontPickerTriggerVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
[ 'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-input px-3 text-left text-foreground outline-none', 'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy data-pressed:bg-secondary-strong', 'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'data-disabled:cursor-default data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |

### `fontStackPickerVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
flex w-full flex-wrap items-center gap-1.5 rounded-ctl bg-input p-1.5 data-disabled:opacity-50
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `min-h-8 rounded-lg p-1 text-footnote` |
| `default` (default) | `min-h-11 text-subhead` |

## IndexBar

### `indexBarVariants`

Defined in `@/components/ui/index-bar`. Base classes:

```text
absolute z-80 flex cursor-pointer touch-none flex-col justify-center rounded-lg outline-offset-2 select-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `items-center` |
| `wave` | `items-stretch` |

**`side`** — default `right`

| Value | Adds |
| --- | --- |
| `right` (default) | `right-0` |
| `left` | `left-0` |

## Input

### `inputVariants`

Defined in `@/components/ui/input`. Base classes:

```text
[ 'box-border w-full min-w-0 rounded-ctl border-0 bg-input px-3 [font-family:inherit] text-foreground outline-none', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground', 'data-focused:bg-transparent data-focused:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50', selectableText, ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 text-subhead` |
| `default` (default) | `h-11 text-body` |
| `lg` | `h-[50px] rounded-xl text-body` |

## Label

### `labelVariants`

Defined in `@/components/ui/label`. Base classes:

```text
inline-flex items-center gap-1.5 font-medium group-data-disabled:opacity-50
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-subhead text-foreground` |
| `field` | `px-1 text-footnote text-muted-foreground` |

## List

### `listRowVariants`

Defined in `@/components/ui/list`. Base classes:

```text
[ // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row. 'relative box-border flex min-h-row w-full touch-pan-y items-center gap-3 py-0 pl-4 text-left text-body leading-[normal] tracking-[normal] outline-none', 'focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]', // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent). 'pr-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]', ]
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `center` (default) | — |
| `top` | `[&>[data-slot=list-row-leading]]:self-start [&>[data-slot=list-row-leading]]:pt-[7px]` |

**`selected`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-accent` |
| `false` (default) | `bg-card` |

**`destructive`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `text-destructive` |
| `false` (default) | `text-foreground` |

**`interactive`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cursor-pointer` |
| `false` (default) | `cursor-default` |

## ListBox

### `listBoxVariants`

Defined in `@/components/ui/list-box`. Base classes:

```text
outline-none
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `overflow-hidden rounded-panel bg-card data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45` |
| `popup` | `bl-scroll box-border max-h-[min(320px,var(--visual-viewport-height,320px))] overflow-y-auto p-1.5` |

### `listBoxItemVariants`

Defined in `@/components/ui/list-box`. Base classes:

```text
bl-btn group/item relative box-border flex cursor-pointer items-center gap-2.5 text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `inset`

| Value | Adds |
| --- | --- |
| `inset` (default) | `[ 'min-h-11 px-4 py-[11px] text-body leading-[22px]', 'after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-4 a…` |
| `popup` | `[ 'min-h-9 rounded-lg py-[7px] pr-3 pl-2 text-subhead leading-5', 'data-focused:bg-accent data-pressed:bg-secondary-strong', ]` |

## MarkdownEditor

### `markdownEditorVariants`

Defined in `@/components/ui/markdown-editor`. Base classes:

```text
[ 'bl-mde group/mde relative box-border flex w-full min-w-0 flex-col text-left [font-family:inherit] text-foreground', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy', 'data-disabled:cursor-not-allowed data-disabled:opacity-50', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-ctl bg-input focus-within:bg-transparent focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)] data-readonly:focus-within:bg-input data-readonly:focus…` |
| `ghost` | `rounded-none bg-transparent` |
| `card` | `rounded-card bg-card shadow-[0_0_0_1px_var(--border),0_1px_2px_--alpha(black/4%)] focus-within:shadow-[0_0_0_1.5px_var(--primary),0_1px_2px_--alpha(black/4%)] …` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `bl-mde-sm` |
| `default` (default) | `bl-mde-md` |
| `lg` | `bl-mde-lg` |

## Passkey Enroll Dialog

### `recoveryKeyVariants`

Defined in `@/components/ui/passkey-enroll-dialog`. Base classes:

```text
grid gap-x-3 gap-y-1 rounded-ctl bg-secondary px-3 py-3 font-mono text-callout font-semibold tracking-wide text-foreground tabular-nums select-text [-webkit-user-select:text]
```

**`layout`** — default `grid`

| Value | Adds |
| --- | --- |
| `grid` (default) | `grid-cols-2` |
| `row` | `grid-cols-4` |

## PencilKit

### `pencilToolButtonVariants`

Defined in `@/components/ui/pencilkit/pencil-toolbar`. Base classes:

```text
grid h-[34px] w-[38px] cursor-pointer place-items-center rounded-[9px] border-0 p-0 data-disabled:cursor-default data-disabled:opacity-[.32]
```

**`active`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-primary text-primary-foreground` |
| `false` (default) | `bg-transparent text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground` |

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
absolute inset-y-0 left-0 rounded-full
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary` |
| `success` | `bg-success` |
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
| `success` | `[--ring-color:var(--success,oklch(0.723_0.191_149.6))]` |
| `warning` | `[--ring-color:var(--warning,oklch(0.769_0.165_70.1))]` |
| `destructive` | `[--ring-color:var(--destructive)]` |

### `countdownRingLabelVariants`

Defined in `@/components/ui/progress-ring`. Base classes:

```text
absolute inset-0 grid place-items-center font-semibold tabular-nums transition-colors duration-300
```

**`labelSize`** — default `auto`

| Value | Adds |
| --- | --- |
| `auto` (default) | `text-(length:--ring-font)` |
| `sm` | `text-[9.36px]` |
| `md` | `text-[10.5px]` |
| `lg` | `text-footnote` |
| `xl` | `text-title` |

**`warn`** — default `false`

| Value | Adds |
| --- | --- |
| `false` (default) | `text-muted-foreground` |
| `true` | `text-(--ring-warn)` |

## ProgressStepper

### `progressStepperVariants`

Defined in `@/components/ui/progress-stepper`. Base classes:

```text
m-0 flex list-none p-0 [--ck-stepper-accent:var(--primary)] [--ck-stepper-idle:var(--secondary)]
```

**`variant`** — default `bars`

| Value | Adds |
| --- | --- |
| `bars` (default) | `gap-[6px]` |
| `line` | `gap-0` |

## RadioGroup

### `radioGroupVariants`

Defined in `@/components/ui/radio-group`. Base classes:

```text
group flex
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `flex-col gap-3` |
| `horizontal` | `flex-row flex-wrap gap-5` |

### `radioVariants`

Defined in `@/components/ui/radio-group`. Base classes:

```text
[ 'box-border size-[22px] shrink-0 rounded-full border-[1.5px] border-tertiary-foreground bg-transparent', 'transition-[border-width,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none', 'group-data-selected:border-[7px] group-data-selected:border-primary group-data-selected:bg-white', 'group-data-pressed:scale-90 group-data-focus-visible:ring-[3px] group-data-focus-visible:ring-ring/45', 'group-data-invalid:border-destructive', ]
```

No variants.

## ScrollArea

### `scrollAreaVariants`

Defined in `@/components/ui/scroll-area`. Base classes:

```text
bl-scroll relative min-h-0 overscroll-contain outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45
```

**`orientation`** — default `vertical`

| Value | Adds |
| --- | --- |
| `vertical` (default) | `overflow-x-hidden overflow-y-auto` |
| `horizontal` | `overflow-x-auto overflow-y-hidden` |
| `both` | `overflow-auto` |

## Select

### `selectTriggerVariants`

Defined in `@/components/ui/select`. Base classes:

```text
[ 'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 px-3 text-left [font-family:inherit] text-foreground outline-none', 'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy data-pressed:bg-secondary-strong', 'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 group-data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'group-data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-default data-disabled:opacity-50', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-input` |
| `plain` | `w-auto justify-end bg-transparent px-1 text-muted-foreground data-pressed:bg-transparent data-pressed:opacity-60 group-data-open:shadow-none` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |

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
| `true` | — |
| `false` (default) | — |

1 compound variant — see the source.

## Sheet

### `sheetVariants`

Defined in `@/components/ui/sheet`. Base classes:

```text
absolute box-border flex flex-col bg-card text-card-foreground shadow-[0_0_40px_black] shadow-black/22 outline-none motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out
```

**`side`** — default `bottom`

| Value | Adds |
| --- | --- |
| `bottom` (default) | `inset-x-0 bottom-0 max-h-[calc(100%-48px)] rounded-t-card pb-[max(12px,env(safe-area-inset-bottom))] data-entering:animate-bl-sheet-in-bottom data-exiting:anim…` |
| `top` | `inset-x-0 top-0 max-h-[calc(100%-48px)] rounded-b-card pt-(--bl-safe-top) data-entering:animate-bl-sheet-in-top data-exiting:animate-bl-sheet-out-top` |
| `left` | `inset-y-0 left-0 w-[85%] max-w-[360px] rounded-r-card data-entering:animate-bl-sheet-in-left data-exiting:animate-bl-sheet-out-left` |
| `right` | `inset-y-0 right-0 w-[85%] max-w-[360px] rounded-l-card data-entering:animate-bl-sheet-in-right data-exiting:animate-bl-sheet-out-right` |

## SideDrawer

### `sideDrawerVariants`

Defined in `@/components/ui/side-drawer`. Base classes:

```text
(none)
```

**`mode`**

| Value | Adds |
| --- | --- |
| `fixed` | `w-(--side-drawer-w) shrink-0 overflow-hidden bg-background transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none` |
| `overlay` | `absolute inset-0 z-350 pointer-events-none` |

## Skeleton

### `skeletonVariants`

Defined in `@/components/ui/skeleton`. Base classes:

```text
block bg-secondary-strong [background-image:linear-gradient(90deg,transparent_25%,color-mix(in_oklab,var(--card)_55%,transparent)_50%,transparent_75%)] [background-size:200%_100%] [background-position:150%_0] [background-repeat:no-repeat] animate-bl-shimmer motion-reduce:animate-none
```

**`shape`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `rounded-ctl` |
| `rounded` | `rounded-ctl` |
| `rect` | `rounded-[3px]` |
| `text` | `h-3.5 rounded-full` |
| `circle` | `shrink-0 rounded-full` |

## Slider

### `sliderVariants`

Defined in `@/components/ui/slider`. Base classes:

```text
group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 data-disabled:opacity-40
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `onDark` | `[--bl-slider-track:--alpha(white/22%)] [--bl-slider-fill:--alpha(white/88%)]` |
| `onLight` | `[--bl-slider-track:--alpha(black/14%)] [--bl-slider-fill:--alpha(black/72%)]` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `sm` | — |

## SplitView

### `splitViewItemVariants`

Defined in `@/components/ui/split-view`. Base classes:

```text
[ 'bl-btn group/item relative flex w-full cursor-pointer items-center gap-3 border-0 text-left [font-family:inherit] text-foreground outline-none', 'transition-[background-color,color] duration-150', 'data-[focus-visible]:ring-2 data-[focus-visible]:ring-ring data-[focus-visible]:ring-inset', ]
```

**`variant`** — default `pill`

| Value | Adds |
| --- | --- |
| `pill` (default) | `min-h-[40px] rounded-ctl px-2.5 py-1.5 text-[15.5px]` |
| `row` | `min-h-row px-4 py-2.5 text-[15.5px]` |

**`selected`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | `bg-transparent data-[hovered]:bg-secondary data-[pressed]:bg-accent` |

**`tinted`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

4 compound variants — see the source.

### `splitViewSectionLabelVariants`

Defined in `@/components/ui/split-view`. Base classes:

```text
(none)
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `px-2.5 pt-4 pb-1.5 text-footnote font-semibold tracking-[-.1px] text-muted-foreground` |
| `prominent` | `px-1 pt-6 pb-2 text-title font-bold tracking-[-.2px] text-foreground` |

## SqlConsole

### `resultTableVariants`

Defined in `@/components/ui/result-table`. Base classes:

```text
flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | `[--result-pad:calc(var(--spacing)*1.5)]` |
| `comfortable` | `[--result-pad:calc(var(--spacing)*2.5)]` |

### `schemaTreeVariants`

Defined in `@/components/ui/schema-tree`. Base classes:

```text
flex min-h-0 min-w-0 flex-col text-footnote text-foreground outline-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `card` | `rounded-panel bg-card p-1 shadow-hairline` |

### `sqlConsoleVariants`

Defined in `@/components/ui/sql-console`. Base classes:

```text
flex min-h-0 min-w-0 flex-col gap-3 text-foreground
```

**`layout`** — default `split`

| Value | Adds |
| --- | --- |
| `split` (default) | `md:grid md:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] md:items-start` |
| `stacked` | — |

### `sqlEditorVariants`

Defined in `@/components/ui/sql-editor`. Base classes:

```text
flex min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline transition-shadow duration-spring-snappy ease-spring-snappy focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[--editor-rows:8]` |
| `sm` | `[--editor-rows:4]` |
| `lg` | `[--editor-rows:14]` |

## SyntaxHighlighting

### `syntaxHighlightingVariants`

Defined in `@/components/ui/syntax-highlighting`. Base classes:

```text
bl-syntax
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bl-syntax-card` |
| `ghost` | `bl-syntax-ghost` |
| `inline` | `bl-syntax-inline` |

## TabView

### `tabViewVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
flex min-h-0 min-w-0
```

**`placement`** — default `bottom`

| Value | Adds |
| --- | --- |
| `top` | `flex-col` |
| `bottom` (default) | `flex-col-reverse` |
| `start` | `flex-row` |
| `end` | `flex-row-reverse` |

### `tabViewBarVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
box-border
```

**`variant`** — default `bar`

| Value | Adds |
| --- | --- |
| `bar` (default) | `absolute inset-x-0 bottom-0 z-120 flex h-[62px] [border-top:1px_solid_var(--border)] bg-bar pb-1 backdrop-blur-[20px] backdrop-saturate-[1.7] transition-transf…` |
| `rail` | `relative flex w-[76px] shrink-0 flex-col gap-1 bg-bar py-2 data-[placement=end]:[border-left:1px_solid_var(--border)] data-[placement=start]:[border-right:1px_…` |
| `workspace` | `flex w-[52px] shrink-0 flex-col items-center gap-[8px] border-r border-border bg-muted px-0 py-[10px]` |
| `plain` | `flex shrink-0 data-[orientation=vertical]:flex-col` |

### `tabViewListVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
outline-none
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `bar` | `flex flex-1` |
| `rail` | `flex flex-col gap-1 px-1.5` |
| `workspace` | `flex min-h-0 w-full flex-col items-center gap-[8px] overflow-y-auto overscroll-contain -mt-1 -mb-1.5 pt-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:…` |
| `plain` (default) | `flex data-[orientation=vertical]:flex-col` |

### `tabViewTabVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
relative cursor-pointer outline-none
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `bar` | `bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 text-center leading-[normal] [font-family:inherit] text-tertiary-…` |
| `rail` | `bl-btn flex flex-col items-center justify-center gap-[3px] rounded-panel px-1 pt-[7px] pb-1.5 text-center leading-[normal] text-tertiary-foreground transition-…` |
| `workspace` | `group flex w-full shrink-0 justify-center data-disabled:cursor-default` |
| `plain` (default) | `data-disabled:cursor-default` |

### `tabViewIndicatorVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
pointer-events-none absolute
```

**`variant`** — default `bar`

| Value | Adds |
| --- | --- |
| `bar` (default) | `bg-primary transition-[translate,width,height] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none` |
| `pill` | `start-0 top-1/2 h-0 w-1 -translate-y-1/2 rounded-e-[4px] bg-foreground opacity-0 transition-[height,opacity] duration-spring-snappy ease-spring-snappy data-att…` |

**`orientation`** — default `horizontal`

| Value | Adds |
| --- | --- |
| `horizontal` (default) | — |
| `vertical` | — |

2 compound variants — see the source.

### `tabViewActionVariants`

Defined in `@/components/ui/tab-view`. Base classes:

```text
cursor-pointer outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `bar` | `bl-btn flex flex-1 flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 leading-[normal] [font-family:inherit] text-tertiary-foreground d…` |
| `rail` | `bl-btn mx-1.5 flex flex-col items-center justify-center gap-[3px] rounded-panel border-0 bg-transparent px-1 pt-[7px] pb-1.5 leading-[normal] [font-family:inhe…` |
| `workspace` | `grid size-[34px] shrink-0 place-items-center rounded-[17px] border border-dashed border-border bg-transparent text-tertiary-foreground [transition:border-radiu…` |
| `plain` (default) | `bl-btn border-0 bg-transparent p-0 [font-family:inherit]` |

## Tabs

### `tabsListVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
isolate flex
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `gap-0.5 rounded-[9px] bg-secondary p-0.5` |
| `underline` | `gap-5 shadow-hairline-b` |

### `tabVariants`

Defined in `@/components/ui/tabs`. Base classes:

```text
bl-btn relative box-border flex cursor-pointer items-center justify-center gap-1.5 font-semibold whitespace-nowrap outline-none transition-[color] duration-spring-snappy ease-spring-snappy data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `segmented`

| Value | Adds |
| --- | --- |
| `segmented` (default) | `flex-1 rounded-[7px] px-3 py-[5px] text-footnote text-foreground data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45` |
| `underline` | `-mb-px h-10 px-0.5 text-subhead text-muted-foreground data-hovered:text-foreground data-selected:text-primary data-focus-visible:rounded-md data-focus-visible:…` |

## TailscaleLoginButton

### `tailscaleLoginButtonVariants`

Defined in `@/components/ui/tailscale-login-button`. Base classes:

```text
box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] font-semibold whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy data-pressed:scale-[.97] motion-reduce:transition-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-foreground text-background` |
| `outline` | `bg-background text-foreground shadow-hairline data-hovered:bg-secondary` |
| `secondary` | `bg-secondary text-secondary-foreground` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-10 rounded-ctl px-4 text-subhead` |
| `sm` | `h-8 rounded-lg px-3 text-footnote` |
| `lg` | `h-11 rounded-xl px-5 text-callout` |
| `pill` | `h-11 w-full rounded-card px-4 text-callout` |

**`tone`** — default `idle`

| Value | Adds |
| --- | --- |
| `idle` (default) | — |
| `busy` | — |
| `connected` | — |
| `error` | `bg-secondary text-foreground shadow-none` |

### `tailscaleStatusBadgeVariants`

Defined in `@/components/ui/tailscale-login-button`. Base classes:

```text
inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-footnote
```

**`layout`** — default `inline`

| Value | Adds |
| --- | --- |
| `inline` (default) | — |
| `stacked` | `flex-col items-start` |

## TailscaleMenu

### `tailscaleMenuVariants`

Defined in `@/components/ui/tailscale-menu`. Base classes:

```text
flex flex-col
```

**`variant`** — default `radio`

| Value | Adds |
| --- | --- |
| `radio` (default) | `gap-3` |
| `networks` | `gap-2` |

### `tailscaleExitNodesVariants`

Defined in `@/components/ui/tailscale-menu`. Base classes:

```text
flex flex-col
```

**`variant`** — default `radio`

| Value | Adds |
| --- | --- |
| `radio` (default) | `gap-1.5` |
| `networks` | `gap-1` |

## Textarea

### `textareaVariants`

Defined in `@/components/ui/textarea`. Base classes:

```text
[ 'box-border block w-full min-w-0 resize-none rounded-ctl border-0 bg-input px-3 py-2.5 [font-family:inherit] text-body leading-[22px] text-foreground outline-none', 'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground', 'data-focused:bg-transparent data-focused:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50', selectableText, ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `min-h-24` |
| `sm` | `min-h-16 text-subhead leading-[20px]` |
| `lg` | `min-h-36` |

## TimeInput

### `timeInputVariants`

Defined in `@/components/ui/time-input`. Base classes:

```text
flex min-w-0 flex-col gap-2 text-footnote
```

**`variant`** — default `card`

| Value | Adds |
| --- | --- |
| `card` (default) | `[&_[data-slot=time-input-preview]]:rounded-panel [&_[data-slot=time-input-preview]]:bg-secondary [&_[data-slot=time-input-preview]]:p-3` |
| `plain` | `[&_[data-slot=time-input-preview]]:px-1` |

## Toast

### `toastVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
outline-none data-[focus-visible]:ring-2 focus-visible:ring-2 focus-visible:ring-[var(--primary)]
```

**`variant`** — default `banner`

| Value | Adds |
| --- | --- |
| `hud` | `flex items-center gap-2 rounded-full bg-[rgba(30,30,32,.86)] px-4 py-2.5 text-detail font-semibold text-white shadow-[0_8px_30px_black] shadow-black/25 backdro…` |
| `banner` (default) | `flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-2xl bg-card px-3.5 py-3 text-foreground shadow-[0_10px_34px_--alpha(black/16%),0_0_0_.5px_var(--…` |

### `toastIconVariants`

Defined in `@/components/ui/toast`. Base classes:

```text
grid shrink-0 place-items-center
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-primary` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `destructive` | `text-destructive` |

## Toggle

### `toggleVariants`

Defined in `@/components/ui/toggle`. Base classes:

```text
[ 'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap text-foreground outline-none', 'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy data-pressed:not-aria-expanded:scale-[.96] motion-reduce:transition-none [&_svg]:shrink-0', 'data-hovered:bg-accent data-pressed:bg-secondary-strong', 'data-selected:bg-primary/15 data-selected:text-primary data-selected:data-pressed:bg-primary/25', 'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40', ]
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-transparent` |
| `filled` | `bg-secondary` |
| `outline` | `bg-transparent shadow-hairline data-selected:shadow-[inset_0_0_0_1px_transparent]` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 min-w-8 rounded-lg px-2 text-footnote` |
| `default` (default) | `h-9 min-w-9 rounded-ctl px-2.5 text-subhead` |
| `lg` | `h-11 min-w-11 rounded-xl px-3.5 text-body` |

## ToggleGroup

### `toggleGroupVariants`

Defined in `@/components/ui/toggle-group`. Base classes:

```text
isolate inline-flex w-fit items-center
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `gap-1` |
| `filled` | `gap-0.5 rounded-[11px] bg-secondary p-0.5` |
| `outline` | `gap-0 overflow-hidden rounded-ctl shadow-hairline` |

## Waveform

### `waveformVariants`

Defined in `@/components/ui/waveform`. Base classes:

```text
relative block h-full w-full
```

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground/55` |
| `primary` | `text-primary` |
| `success` | `text-success` |
| `muted` | `text-muted-foreground` |
