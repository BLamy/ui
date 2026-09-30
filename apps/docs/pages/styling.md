# Styling and variants

Every BL UI component is a small [cva](https://cva.style) recipe plus a thin React wrapper. The recipe is exported next to the component as `<name>Variants` (`buttonVariants`, `badgeVariants`, `listRowVariants`, `dialogVariants`, `toggleVariants`, `sliderVariants`, …), so you can use the same styles on any element, type your own props from it, compose it with more variants, or change its defaults. The [Variants reference](https://blamy.github.io/ui/#/variants) lists every recipe and its options.

## How a component is built

Three pieces, in every component:

- **A recipe** (`cva`): the base classes and the variants, written as Tailwind utilities that read [theme tokens](https://blamy.github.io/ui/#/theming).
- **A `data-slot` on the root**, which names the part (`data-slot="button"`). It is a stable hook for your CSS and for parent selectors such as `[&_[data-slot=badge]]:…`.
- **`className` merged last with `cn()`**, so the classes you pass win over the recipe's.

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex h-5.5 items-center gap-1 rounded-full px-2 text-caption font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'text-foreground shadow-hairline',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}
```

That is `Badge`, abridged. Interactive parts sit on [React Aria Components](https://react-aria.adobe.com/), whose `className` may be a function of the render state; there the recipe goes through `composeRenderProps(className, (cls) => cn(buttonVariants({ variant, size }), cls))`, so a function `className` keeps working.

## Use a recipe on any element

A recipe is a function from options to a class string. Put a button's look on a link, a router link or a plain `<a>`:

```tsx
import { Link } from 'react-aria-components'
import { buttonVariants } from '@/components/ui/button'

<a href="/docs" className={buttonVariants({ variant: 'link' })}>Docs</a>

<Link href="/pricing" className={buttonVariants({ size: 'lg' })}>
  See pricing
</Link>
```

React Aria's `Link` navigates through the router you configure with its `RouterProvider`, so the same line works with React Router, Next.js or TanStack Router. Because the recipe returns classes only, it never changes which element renders.

## Typed props with VariantProps

`VariantProps` turns a recipe into the props type of the options, so a wrapper or a story gets autocomplete and checking for free:

```tsx
import type { VariantProps } from 'class-variance-authority'
import { Button, buttonVariants } from '@/components/ui/button'

type ButtonStyle = VariantProps<typeof buttonVariants>
//   { variant?: 'default' | 'secondary' | … | null; size?: … | null }

function Toolbar({ style }: { style?: ButtonStyle }) {
  return <Button {...style}>Share</Button>
}
```

The components' own props types (`ButtonProps`, `BadgeProps`, …) already extend theirs.

## Compose your own recipe

Add a variant of your own on top of a shipped one with a second `cva`, and merge both with `cn`. `compoundVariants` cover the combinations:

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { Button, buttonVariants, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ctaVariants = cva('font-bold tracking-tight', {
  variants: {
    emphasis: { high: 'shadow-lg', low: '' },
  },
  compoundVariants: [
    // only the default button grows a ring when it is high emphasis
    { emphasis: 'high', class: 'ring-2 ring-primary/30' },
  ],
  defaultVariants: { emphasis: 'low' },
})

type CtaProps = ButtonProps & VariantProps<typeof ctaVariants>

export function Cta({ emphasis, className, ...props }: CtaProps) {
  return <Button className={cn(ctaVariants({ emphasis }), className)} {...props} />
}
```

`cn` runs `tailwind-merge` after `clsx`, so when your recipe and the base disagree (`rounded-ctl` and `rounded-full`, `h-9` and `h-11`), the later one wins instead of both being emitted.

## Change the defaults

- **Registry install (recommended).** The file is yours. Open `components/ui/button.tsx` and edit `defaultVariants`, delete a size you never use, or change a variant's classes. This is the reason the shadcn registry is the primary way to consume BL UI. Re-running `shadcn add … -o` later overwrites your edits, so keep them in a diff.

```tsx
defaultVariants: { variant: 'secondary', size: 'lg' },
```

- **npm package.** The source is not yours to edit, so wrap the component and set your defaults there:

```tsx
import { Button, type ButtonProps } from '@brett_lamy/ui'

export function AppButton(props: ButtonProps) {
  return <Button size="lg" variant="secondary" {...props} />
}
```

## Add a variant to an installed component

Because the recipe is a plain object in your copy, a new variant is one line, and TypeScript picks it up in `VariantProps` at once:

```tsx
variant: {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  ghost: 'bg-transparent text-foreground data-hovered:bg-accent',
  destructive: 'bg-destructive text-white',
  link: 'bg-transparent p-0 text-primary',
  success: 'bg-success text-white', // new
},
```

Use theme utilities (`bg-success`, `rounded-ctl`, `text-footnote`) rather than literals, so your variant follows the theme like the rest.

## State comes from data attributes

Interactive parts are React Aria elements, which expose their state as data attributes instead of pseudo-classes, and recipes style them with Tailwind's `data-*` variants:

| Variant | When |
| --- | --- |
| `data-pressed:` | pressed, by mouse, touch, keyboard or screen reader |
| `data-hovered:` | a mouse is over it (touch never sets it, so there is no stuck hover) |
| `data-focus-visible:` | focused by keyboard |
| `data-selected:` | selected, checked or on |
| `data-disabled:` | disabled |

Use `group-data-selected:` on a child that reacts to its parent's state. For your own classes on a shipped part, use the same variants:

```tsx
<Button className="data-pressed:scale-90 data-hovered:bg-accent">Tap</Button>
```

## The tailwind-merge caveat

`tailwind-merge` only knows Tailwind's default theme. BL UI registers its own tokens (`text-footnote` as a font size, `text-tertiary-foreground` as a color, `rounded-ctl`, `shadow-hairline`, `h-row`, `h-toolbar`, `font-mono`) in `cn()`, generated from the same `tokens.css` as the utilities, so `cn('text-footnote text-foreground')` keeps both and `cn('rounded-ctl rounded-full')` keeps the second.

If you call `twMerge` directly, or build your own helper, you lose that: `twMerge('text-footnote text-foreground')` cannot tell a size from a color and may drop one. Import `cn` from `@/lib/utils` (installed with any component) instead. If you add tokens of your own, add them to the `extendTailwindMerge` call in your copy of `lib/utils.ts`.

## Recipes in blocks

[Blocks](https://blamy.github.io/ui/#/blocks) define recipes for their own parts in the same way, next to the component that uses them, and export them the same way. The `discord-clone` block's `Message`, for example, has a `messageVariants` with a `variant` and an `appear` option:

```tsx
export const messageVariants = cva(
  'group/message relative flex gap-[11px] px-[18px] [&:hover]:bg-accent',
  {
    variants: {
      variant: {
        default: 'py-[7px]',
        /** a follow-up from the same author: no avatar or header, tighter rows */
        continued: 'py-[2px]',
      },
      /** rise into place (new messages) */
      appear: {
        true: 'animate-[ck-in_var(--duration-spring-smooth)_var(--ease-spring-smooth)_both] motion-reduce:animate-none',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', appear: false },
  },
)
```

This is abridged from `components/message.tsx` in the block (the base classes are shortened). A block's recipes are block-local: they do not belong to the library, so they appear in your project with the block and you edit them there.

## Reference

The [Variants reference](https://blamy.github.io/ui/#/variants) is generated from the code. It lists every exported recipe with its variants, options and defaults, and component pages carry a generated **cva recipes** section for the recipes that component exports.
