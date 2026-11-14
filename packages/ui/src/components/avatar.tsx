'use client';
import { Children, cloneElement, isValidElement, type ComponentProps, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { Avatar as SdkAvatar, AvatarFallback as SdkAvatarFallback, AvatarImage as SdkAvatarImage } from '@ui-sdk/react/avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn, cx } from '@/lib/utils';

/* ══ Avatar — a person, a bot or a workspace, as initials, an image or a glyph, on UI SDK's Avatar ══
   <Avatar c={{ f: 'Wei', l: 'Chen' }} />                                  // a contact: initials on a gradient hashed from the name
   <Avatar name="Ada Lovelace" color="royalblue" status="online" />          // a name, an accent, a presence dot
   <Avatar name="Stitch" shape="square" icon={<Icon name="sparkle" />} />  // a bot: rounded square, a glyph for initials
   <Avatar name="Ada" src="/ada.png" />                                    // an image (initials while it loads or if it fails)
   <Avatar name="Ada" card={<HoverCardHeader … />} />                       // a hover card about them

   With no children it renders its AvatarImage (for `src`) and AvatarFallback (the initials or the glyph) from its
   props; pass the parts yourself for another image or fallback:

   <Avatar name="Ada">
     <AvatarImage src="/ada.png" srcSet="/ada@2x.png 2x" loading="lazy" />
     <AvatarFallback delay={300}>AL</AvatarFallback>
   </Avatar>

   <AvatarGroup max={5}>                                                  // overlapped; press for everyone's names
     <Avatar name="Ada" /> <Avatar name="Miles" /> …
   </AvatarGroup> */

const hue = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

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

/** The presence dot, ringed in the surface the avatar sits on (`--avatar-ring`, the page background by default). */
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
  /** Contact-like record: `f` first name, `l` last name. The initials are `f[0]` + `l[0]`. */
  c?: { f: string; l: string };
  /** A display name: the initials come from it (and its hash colors the avatar when there is no `color`). */
  name?: string;
  /** Replaces the computed initials. */
  initials?: string;
  /** Accent: the gradient runs from it to a fainter copy of itself. Any CSS color. */
  color?: string;
  /** An image; the initials show until it loads, and instead of it if it fails. */
  src?: string;
  /** A glyph in place of the initials (a bot's spark). */
  icon?: ReactNode;
  /** A presence dot on the lower right. */
  status?: AvatarStatus;
  /** Width and height in px (default 40). */
  size?: number;
  /** A HoverCard's content about them (HoverCardHeader and a line or two), shown while the pointer rests on the
   *  avatar or keyboard focus stays on it. With a card the avatar is a button, in the Tab order, named after them. */
  card?: ReactNode;
}

export function Avatar({ c, name, initials, color, src, icon, status, size = 40, shape, card, className, style, children, ...props }: AvatarProps) {
  // A contact's two initials stay two text nodes, as they always were: one node would kern the pair differently.
  const label = initials ?? (c ? <>{c.f[0]}{c.l[0]}</> : initialsOf(name ?? ''));
  const h = hue(c ? c.f + c.l : (name ?? ''));
  // Size and the gradient are computed per render and handed to the classes as variables.
  const vars = {
    '--avatar-size': `${size}px`,
    '--avatar-font': `${size * 0.38}px`,
    '--avatar-radius': `${size * 0.3}px`,
    '--avatar-bg': color
      ? `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 53%, transparent))`
      : `linear-gradient(180deg, hsl(${h} 62% 64%), hsl(${h} 55% 47%))`,
  } as CSSProperties;
  // A card's trigger needs a name, so with a card the avatar is named after the person unless it is told otherwise.
  const ariaLabel = props['aria-label'] ?? (card ? name ?? (c ? `${c.f} ${c.l}` : undefined) : undefined);
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
          <AvatarFallback>{icon ?? label}</AvatarFallback>
        </>
      )}
      {status && (
        <span data-slot="avatar-status" data-status={status} role="img" aria-label={avatarStatusLabels[status]} className={avatarStatusVariants({ status })} />
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

/* ══ AvatarGroup ══ */

type AvatarElement = ReactElement<AvatarProps>;

const nameOf = (a: AvatarProps) => a['aria-label'] ?? a.name ?? (a.c ? `${a.c.f} ${a.c.l}` : a.initials ?? '');

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

export const avatarGroupVariants = cva(
  // Each avatar after the first tucks under its neighbour, ringed in the surface so the overlap reads as a cut.
  'inline-flex items-center rounded-full outline-none [&>*]:ring-2 [&>*]:ring-(--avatar-ring,var(--background)) [&>*+*]:-ml-(--avatar-overlap)',
);

export interface AvatarGroupProps {
  /** The people: `<Avatar>`s. Each one's `name` (or `c`) labels it in the menu. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** How many avatars show before the rest fold into a `+N` bubble (default 5). */
  max?: number;
  /** Size of every avatar, in px (default 32); an avatar's own `size` wins. */
  size?: number;
  /** How far each avatar tucks under the one before it, in px (default 28% of the size). */
  overlap?: number;
  /** Press the group to list everyone with their names (default true). `false` leaves a plain, non-interactive stack. */
  menu?: boolean;
  /** The group's accessible name (default "N people"). */
  label?: string;
  /** A person was chosen from the menu, by their position in `children`. */
  onSelect?: (index: number) => void;
}

/** Avatars overlapped on one another. Past `max` the rest become a `+N` bubble, and pressing the group opens a menu
 *  of everyone — avatar and name. */
export function AvatarGroup({ children, max = 5, size = 32, overlap, menu = true, label, onSelect, className, style }: AvatarGroupProps) {
  const people = Children.toArray(children).filter((child): child is AvatarElement => isValidElement(child));
  const shown = people.slice(0, Math.max(0, max));
  const extra = people.length - shown.length;
  const groupStyle = { '--avatar-overlap': `${overlap ?? Math.round(size * 0.28)}px`, ...style } as CSSProperties;
  const stack = (
    <>
      {/* Inside the menu's trigger a card avatar would be a button in a button: the menu lists everyone instead. */}
      {shown.map((person) => cloneElement(person, { size: person.props.size ?? size, card: menu ? undefined : person.props.card }))}
      {extra > 0 && (
        <Avatar
          data-overflow=""
          initials={`+${compact.format(extra)}`}
          size={size}
          className="bg-secondary-strong text-secondary-foreground"
          style={{ '--avatar-bg': 'none' } as CSSProperties}
        />
      )}
    </>
  );
  const name = label ?? `${people.length} ${people.length === 1 ? 'person' : 'people'}`;

  if (!menu) {
    return (
      <div data-slot="avatar-group" role="group" aria-label={name} className={cn(avatarGroupVariants(), className)} style={groupStyle}>
        {stack}
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={name}
        className={cn(avatarGroupVariants(), 'cursor-pointer border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
        style={groupStyle}
      >
        {stack}
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={name} side="bottom" align="start">
        {people.map((person, i) => (
          <DropdownMenuItem key={person.key ?? i} value={String(i)} label={nameOf(person.props)} onSelect={() => onSelect?.(i)}>
            <span className="flex items-center gap-3">
              {cloneElement(person, { size: 28, className: undefined, style: undefined, card: undefined })}
              <span className="truncate">{nameOf(person.props)}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
