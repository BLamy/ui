'use client';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { Avatar as SdkAvatar, AvatarFallback as SdkAvatarFallback, AvatarImage as SdkAvatarImage } from '@ui-sdk/react/avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cx } from '@/lib/utils';

/* ══ Avatar — a person, a bot or a workspace, as initials, an image or a glyph, on UI SDK's Avatar ══
   <Avatar name="Wei Chen" />                                              // initials on a gradient hashed from the name
   <Avatar name="Ada Lovelace" tint="royalblue" status="online" />           // an accent, a presence dot
   <Avatar name="Stitch" shape="square" icon={<Icon name="sparkle" />} />  // a bot: rounded square, a glyph for initials
   <Avatar name="Ada" src="/ada.png" />                                    // an image (initials while it loads or if it fails)
   <Avatar name="Ada" card={<HoverCardHeader … />} />                       // a hover card about them

   With no children it renders its AvatarImage (for `src`) and AvatarFallback (the initials or the glyph) from its
   props; pass the parts yourself for another image or fallback:

   <Avatar name="Ada">
     <AvatarImage src="/ada.png" srcSet="/ada@2x.png 2x" loading="lazy" />
     <AvatarFallback delay={300}>AL</AvatarFallback>
   </Avatar>

   A named avatar is an image called after the person (and their status): beside the name in a row, pass
   `aria-hidden` so the name is not read twice. Overlapping stacks are `AvatarGroup` (avatar-group.tsx). */

/** A stable hue per name (whitespace ignored, so "Wei Chen" and "WeiChen" match). */
const hue = (s: string) => { let h = 0; for (const ch of s.replace(/\s+/g, '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

/** The hashed gradient. OKLCH at a fixed perceptual lightness, so white initials keep at least 3.5:1 at the top
    stop and 4.5:1 in the middle whatever the hue (avatar.test.tsx checks). The olive band (hues 55–125), which
    turns muddy at that lightness, is skipped: the hash's 360 steps spread over the other 290°. */
const avatarGradient = (name: string) => {
  let h = Math.round((hue(name) * 290) / 360);
  if (h >= 55) h += 70;
  return `linear-gradient(180deg, oklch(0.59 0.13 ${h}), oklch(0.48 0.14 ${h}))`;
};

/** Up to two initials: the first letters of the first and last word. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return (words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const avatarVariants = cva(
  'grid size-(--avatar-size) shrink-0 place-items-center bg-(image:--avatar-bg) font-semibold tracking-[.5px] text-white select-none [font-size:var(--avatar-font)]',
  {
    variants: {
      /** A rounded square (bots, workspaces) instead of a circle. */
      shape: { circle: 'rounded-full', square: 'rounded-(--avatar-radius)' },
    },
    defaultVariants: { shape: 'circle' },
  },
);

/** The presence dot, ringed in the surface the avatar sits on: `--avatar-ring`, which Card and List set to `--card`,
    Popover and HoverCard to `--popover`, and the page background elsewhere. Set it on any other surface: `[--avatar-ring:var(--sidebar)]`. */
export const avatarStatusVariants = cva(
  'absolute -right-[2px] -bottom-[2px] box-border size-[max(10px,calc(var(--avatar-size)*.36))] rounded-full border-[2.5px] border-(--avatar-ring,var(--background))',
  {
    variants: {
      status: { online: 'bg-success', idle: 'bg-warning', dnd: 'bg-destructive', offline: 'bg-tertiary-foreground' },
    },
    defaultVariants: { status: 'online' },
  },
);

export type AvatarStatus = 'online' | 'idle' | 'dnd' | 'offline';

/** What the presence dot is called, for a screen reader or an agent. */
const avatarStatusLabels: Record<AvatarStatus, string> = { online: 'Online', idle: 'Idle', dnd: 'Do not disturb', offline: 'Offline' };

/** A card's trigger is a button: reachable with Tab, so focus opens the card as the pointer does. */
const cardTriggerClass = 'cursor-default border-0 bg-transparent p-0 [font-family:inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export interface AvatarProps extends Omit<ComponentProps<typeof SdkAvatar>, 'children'>, VariantProps<typeof avatarVariants> {
  /** An AvatarImage and AvatarFallback of your own, in place of the ones made from `src`, `icon` and the name. */
  children?: ReactNode;
  /** Who it is: the initials come from it (first and last word), its hash colors the avatar when there is no
   *  `tint`, and it names the avatar for screen readers. */
  name?: string;
  /** Replaces the computed initials. */
  initials?: string;
  /** Accent: the gradient runs from it to a fainter copy of itself. Any CSS color. */
  tint?: string;
  /** An image; the initials show until it loads, and instead of it if it fails. */
  src?: string;
  /** A glyph in place of the initials (a bot's spark). */
  icon?: ReactNode;
  /** A presence dot on the lower right. */
  status?: AvatarStatus;
  /** Width and height in px (default 40). */
  size?: number;
  /** A HoverCard's content about them (HoverCardHeader and a line or two), shown while the pointer rests on the
   *  avatar or keyboard focus stays on it. With a card the avatar is a button, in the Tab order, named after them.
   *  It is shorthand for `<HoverCard><HoverCardTrigger render={<Avatar … />} /><HoverCardContent>…`. */
  card?: ReactNode;
}

export function Avatar({ name, initials, tint, src, icon, status, size = 40, shape, card, className, style, children, ...props }: AvatarProps) {
  const label = initials ?? initialsOf(name ?? '');
  // Size and the gradient are computed per render and handed to the classes as variables.
  const vars = {
    '--avatar-size': `${size}px`,
    '--avatar-font': `${size * 0.38}px`,
    '--avatar-radius': `${size * 0.3}px`,
    '--avatar-bg': tint
      ? `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 53%, transparent))`
      : avatarGradient(name ?? ''),
  } as CSSProperties;
  // The person, then their presence: one name for the whole avatar, so the dot and the initials stay silent.
  const who = props['aria-label'] ?? name;
  const ariaLabel = who && status ? `${who}, ${avatarStatusLabels[status]}` : who;
  const el = (
    <SdkAvatar
      // UI SDK's "Interactive Avatar": an avatar that does something is a button. Alone, a named one is an image.
      render={card ? <button type="button" /> : undefined}
      role={!card && ariaLabel ? 'img' : undefined}
      className={cx([avatarVariants({ shape }), card && cardTriggerClass, (status || src || children != null) && 'relative'], className)}
      style={typeof style === 'function' ? (state) => ({ ...vars, ...style(state) }) : { ...vars, ...style }}
      {...props}
      aria-label={ariaLabel}
    >
      {children ?? (
        <>
          {src ? <AvatarImage src={src} /> : null}
          <AvatarFallback aria-hidden>{icon ?? label}</AvatarFallback>
        </>
      )}
      {status && (
        <span
          data-slot="avatar-status"
          data-status={status}
          // Named on its own only when the avatar has no name to carry it.
          {...(ariaLabel ? { 'aria-hidden': true } : { role: 'img', 'aria-label': avatarStatusLabels[status] })}
          className={avatarStatusVariants({ status })}
        />
      )}
    </SdkAvatar>
  );
  if (!card) return el;
  return (
    <HoverCard>
      <HoverCardTrigger render={el} />
      <HoverCardContent>{card}</HoverCardContent>
    </HoverCard>
  );
}

/** The image: a real `<img>` that covers the avatar once it has loaded. Decorative by default (`alt=""`): the
    avatar's `aria-label`, or the name beside it, says who it is. */
export function AvatarImage({ className, alt = '', draggable = false, ...props }: ComponentProps<typeof SdkAvatarImage>) {
  return <SdkAvatarImage alt={alt} draggable={draggable} className={cx('absolute inset-0 size-full rounded-[inherit] object-cover', className)} {...props} />;
}

/** What shows while there is no loaded image: the initials or a glyph. `delay` waits before showing it, so a
    fast image never flashes it. */
export function AvatarFallback({ className, ...props }: ComponentProps<typeof SdkAvatarFallback>) {
  return <SdkAvatarFallback className={cx('contents', className)} {...props} />;
}
