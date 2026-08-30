/* 22 — Popover + Dropdown: floating primitives (Trigger clones its child, react-aria asChild style)
   25 — Cite: inline citation popover — sugar over Popover */
import * as React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, BMONO, C, Kbd, P, card, cn, mut, vib } from './base';

export interface PopoverContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
export const PopCtx = createContext<PopoverContextValue | null>(null);
export function usePopover() {
  const c = useContext(PopCtx);
  if (!c) throw new Error('Popover parts must be rendered inside <Popover> / <Dropdown>');
  return c;
}

export interface PopoverProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function Popover({ children, style, className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', h);
    return () => document.removeEventListener('pointerdown', h);
  }, [open]);
  return (
    <PopCtx.Provider value={{ open, setOpen }}>
      <span
        data-slot="popover"
        ref={ref}
        className={cn(className)}
        style={{ position: 'relative', display: 'inline-block', ...style }}
      >
        {children}
      </span>
    </PopCtx.Provider>
  );
}

export function PopoverTrigger({ children }: { children: React.ReactElement }) {
  const c = usePopover();
  return React.cloneElement(React.Children.only(children) as React.ReactElement<{ onClick?: () => void }>, {
    onClick: () => {
      c.setOpen((o) => !o);
      vib([5]);
    },
  });
}

export interface PopoverContentProps {
  align?: 'start' | 'end';
  width?: number;
  children?: ReactNode;
}
export function PopoverContent({ align = 'start', width = 250, children }: PopoverContentProps) {
  const c = usePopover();
  if (!c.open) return null;
  return (
    <div
      data-slot="popover-content"
      style={{
        position: 'absolute',
        top: '100%',
        [align === 'end' ? 'right' : 'left']: 0,
        marginTop: 6,
        width,
        zIndex: 30,
        ...card({ padding: 12, background: '#17171D', boxShadow: '0 14px 36px rgba(0,0,0,.5)' }),
        animation: 'bui-in .16s ' + BEASE,
        fontSize: 12.5,
        color: mut,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}
Popover.Trigger = PopoverTrigger;
Popover.Content = PopoverContent;

export function Dropdown(props: PopoverProps) {
  return <Popover {...props} />;
}

export interface DropdownMenuProps {
  align?: 'start' | 'end';
  width?: number;
  children?: ReactNode;
}
export function DropdownMenu({ align = 'start', width = 190, children }: DropdownMenuProps) {
  const c = usePopover();
  if (!c.open) return null;
  return (
    <div
      data-slot="dropdown-menu"
      style={{
        position: 'absolute',
        top: '100%',
        [align === 'end' ? 'right' : 'left']: 0,
        marginTop: 6,
        width,
        zIndex: 30,
        display: 'grid',
        gap: 1,
        ...card({ padding: 5, background: '#17171D', boxShadow: '0 14px 36px rgba(0,0,0,.5)' }),
        animation: 'bui-in .16s ' + BEASE,
      }}
    >
      {children}
    </div>
  );
}

export interface DropdownItemProps {
  icon?: string | ReactNode;
  kbd?: ReactNode;
  danger?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}
export function DropdownItem({ icon, kbd, danger, onSelect, children }: DropdownItemProps) {
  const c = usePopover();
  return (
    <button
      data-slot="dropdown-item"
      className="bui-hl"
      onClick={() => {
        c.setOpen(false);
        vib([5]);
        onSelect && onSelect();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        border: 0,
        borderRadius: 7,
        background: 'none',
        padding: '7px 9px',
        cursor: 'pointer',
        fontFamily: BFONT,
        fontSize: 12.5,
        color: danger ? C.red : 'var(--wb-label)',
        textAlign: 'left',
      }}
    >
      {icon && (
        <span style={{ display: 'grid', color: danger ? C.red : mut }}>
          <BIcon d={typeof icon === 'string' ? P[icon] : (icon as string)} size={14} />
        </span>
      )}
      <span style={{ flex: 1 }}>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

export function DropdownSeparator() {
  return <div data-slot="dropdown-separator" style={{ height: 1, background: 'var(--wb-sep)', margin: '4px 6px' }} />;
}
Dropdown.Trigger = PopoverTrigger;
Dropdown.Menu = DropdownMenu;
Dropdown.Item = DropdownItem;
Dropdown.Separator = DropdownSeparator;

/* 25 — Cite */
export interface CiteProps {
  n?: ReactNode;
  children?: ReactNode;
}
export function Cite({ n, children }: CiteProps) {
  return (
    <Popover>
      <Popover.Trigger>
        <button
          data-slot="cite"
          style={{
            border: 0,
            background: 'rgba(10,132,255,.14)',
            color: C.blue,
            fontFamily: BMONO,
            fontSize: 9.5,
            fontWeight: 700,
            borderRadius: 5,
            padding: '1px 5px',
            cursor: 'pointer',
            verticalAlign: 'super',
            lineHeight: 1.4,
          }}
        >
          {n}
        </button>
      </Popover.Trigger>
      <Popover.Content width={260}>{children}</Popover.Content>
    </Popover>
  );
}
export function CiteQuote({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="cite-quote"
      style={{
        fontSize: 12,
        color: 'var(--wb-label)',
        lineHeight: 1.55,
        borderLeft: '2px solid ' + C.blue,
        paddingLeft: 9,
        marginBottom: 9,
      }}
    >
      {children}
    </div>
  );
}
export interface CiteSourceProps {
  kind?: string;
  children?: ReactNode;
}
export function CiteSource({ kind = 'PDF', children }: CiteSourceProps) {
  const tone = kind === 'CSV' ? C.green : kind === 'WEB' ? C.teal : C.red;
  return (
    <span
      data-slot="cite-source"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: mut,
        border: '1px solid var(--wb-sep)',
        borderRadius: 7,
        padding: '3px 8px',
      }}
    >
      <span style={{ fontSize: 9.5, fontWeight: 800, color: tone }}>{kind}</span>
      {children}
    </span>
  );
}
Cite.Quote = CiteQuote;
Cite.Source = CiteSource;
