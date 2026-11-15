'use client';
import { Children, cloneElement, isValidElement, type ComponentProps, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Avatar, type AvatarProps } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, type DropdownMenuProps } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/* ══ AvatarGroup — avatars overlapped on one another ══
   <AvatarGroup max={4}>{people.map((p) => <Avatar key={p.id} name={p.name} />)}</AvatarGroup>    // a stack
   <AvatarGroup menu onAction={(id) => open(id)}>…</AvatarGroup>                                // press to list everyone

   Past `max` the rest fold into a `+N` bubble. A plain stack is a `group` named "N people", and each avatar keeps
   its own hover card. With `menu` the stack is one button that opens a menu of everyone (avatar and name); the
   menu's `onAction` receives the chosen avatar's `key`. In its own module so a lone Avatar never pulls in the menu. */

type AvatarElement = ReactElement<AvatarProps>;

const nameOf = (a: AvatarProps) => a['aria-label'] ?? a.name ?? a.initials ?? '';

/** `Children.toArray` prefixes keys with `.$`: the caller's key is what they know the person by. */
const keyOf = (el: AvatarElement, index: number) => (el.key == null ? String(index) : String(el.key).replace(/^\.\$/, ''));

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

export const avatarGroupVariants = cva(
  // Each avatar after the first tucks under its neighbour, ringed in the surface so the overlap reads as a cut.
  'inline-flex items-center rounded-full outline-none [&>*]:ring-2 [&>*]:ring-(--avatar-ring,var(--background)) [&>*+*]:-ms-(--avatar-overlap)',
);

export interface AvatarGroupProps extends Omit<ComponentProps<'div'>, 'children' | 'onSelect'> {
  /** The people: `<Avatar>`s, each with a `key` and a `name` (which labels it in the menu). */
  children?: ReactNode;
  /** How many avatars show before the rest fold into a `+N` bubble (default 5). */
  max?: number;
  /** Size of every avatar, in px (default 32); an avatar's own `size` wins. */
  size?: number;
  /** How far each avatar tucks under the one before it, in px (default 28% of the size). */
  overlap?: number;
  /** Make the stack one button that lists everyone in a menu (default false: a plain stack whose avatars keep
   *  their own hover cards). */
  menu?: boolean;
  /** With `menu`: a person was chosen. `value` is their avatar's `key` (or its index when it has none). */
  onAction?: (value: string, details: Parameters<NonNullable<DropdownMenuProps['onAction']>>[1]) => void;
}

export function AvatarGroup({
  children, max = 5, size = 32, overlap, menu = false, onAction, className, style, 'aria-label': ariaLabel, ...props
}: AvatarGroupProps) {
  const people = Children.toArray(children).filter((child): child is AvatarElement => isValidElement(child));
  const shown = people.slice(0, Math.max(0, max));
  const extra = people.length - shown.length;
  const groupStyle = { '--avatar-overlap': `${overlap ?? Math.round(size * 0.28)}px`, ...style } as CSSProperties;
  const stack = (
    <>
      {shown.map((person) =>
        cloneElement(person, {
          size: person.props.size ?? size,
          // Inside the menu's trigger a card avatar would be a button in a button, and the trigger already has
          // the group's name: the avatars are only the picture.
          ...(menu ? { card: undefined, 'aria-hidden': true } : null),
        }),
      )}
      {extra > 0 && (
        <Avatar
          data-overflow=""
          initials={`+${compact.format(extra)}`}
          aria-label={`${compact.format(extra)} more`}
          size={size}
          className="bg-secondary-strong text-secondary-foreground"
          style={{ '--avatar-bg': 'none' } as CSSProperties}
          {...(menu ? { 'aria-hidden': true } : null)}
        />
      )}
    </>
  );
  // Named by `aria-label`, else "N people": the same name on the group, or on the menu's trigger and its menu.
  const name = ariaLabel ?? `${people.length} ${people.length === 1 ? 'person' : 'people'}`;

  if (!menu) {
    return (
      <div data-slot="avatar-group" role="group" {...props} aria-label={name} className={cn(avatarGroupVariants(), className)} style={groupStyle}>
        {stack}
      </div>
    );
  }
  return (
    <DropdownMenu onAction={onAction}>
      <DropdownMenuTrigger
        {...(props as ComponentProps<typeof DropdownMenuTrigger>)}
        aria-label={name}
        className={cn(
          avatarGroupVariants(),
          'cursor-pointer border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        style={groupStyle}
      >
        {stack}
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={name} side="bottom" align="start">
        {people.map((person, i) => (
          <DropdownMenuItem key={keyOf(person, i)} value={keyOf(person, i)} label={nameOf(person.props)}>
            <span className="flex items-center gap-3">
              {cloneElement(person, { size: 28, className: undefined, style: undefined, card: undefined, 'aria-hidden': true })}
              <span className="truncate">{nameOf(person.props)}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
