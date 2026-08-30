/* 29 — CommandMenu: ⌘K palette — Input / List / Group / Item compose; items self-filter on the shared query */
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BEASE, BFONT, BIcon, C, Kbd, P, card, mut3, vib } from './base';

export interface CommandMenuContextValue {
  q: string;
  setQ: React.Dispatch<React.SetStateAction<string>>;
  onClose?: () => void;
}
export const CmdCtx = createContext<CommandMenuContextValue | null>(null);
export function useCommandMenu() {
  const c = useContext(CmdCtx);
  if (!c) throw new Error('CommandMenu parts must be rendered inside <CommandMenu>');
  return c;
}

export interface CommandMenuProps {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
}
export function CommandMenu({ open, onClose, children }: CommandMenuProps) {
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  return (
    <CmdCtx.Provider value={{ q, setQ, onClose }}>
      <div
        data-slot="command-menu"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,.5)',
          display: 'grid',
          justifyItems: 'center',
          alignItems: 'start',
          paddingTop: 36,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .22s',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...card({ background: '#17171D', width: 'min(400px, 90%)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.6)' }),
            transform: open ? 'none' : 'scale(.96) translateY(-6px)',
            transition: 'transform .28s ' + BEASE,
          }}
        >
          {children}
        </div>
      </div>
    </CmdCtx.Provider>
  );
}

export function CommandMenuInput({ placeholder = 'Type a command…' }: { placeholder?: string }) {
  const c = useCommandMenu();
  return (
    <div
      data-slot="command-menu-input"
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderBottom: '1px solid var(--wb-sep)' }}
    >
      <span style={{ color: mut3, display: 'grid' }}>
        <BIcon d={P['search']} size={15} />
      </span>
      <input
        value={c.q}
        onChange={(e) => c.setQ(e.target.value)}
        placeholder={placeholder}
        style={{ border: 0, background: 'none', outline: 'none', color: 'var(--wb-label)', fontSize: 13.5, fontFamily: BFONT, flex: 1 }}
      />
      <Kbd>esc</Kbd>
    </div>
  );
}

export function CommandMenuList({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="command-menu-list" className="wb-scroll" style={{ maxHeight: 240, overflowY: 'auto', padding: 6 }}>
      {children}
    </div>
  );
}

export interface CommandMenuGroupProps {
  title?: ReactNode;
  children?: ReactNode;
}
export function CommandMenuGroup({ title, children }: CommandMenuGroupProps) {
  const c = useCommandMenu();
  const kids = React.Children.toArray(children).filter((k) => {
    const props = (React.isValidElement(k) ? k.props : {}) as { children?: ReactNode; keywords?: string };
    const hay = ((typeof props.children === 'string' ? props.children : '') + ' ' + (props.keywords || '')).toLowerCase();
    return !c.q || hay.includes(c.q.toLowerCase());
  });
  if (!kids.length) return null;
  return (
    <div data-slot="command-menu-group">
      {title && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '.6px',
            textTransform: 'uppercase',
            color: mut3,
            padding: '8px 9px 3px',
          }}
        >
          {title}
        </div>
      )}
      {kids}
    </div>
  );
}

export interface CommandMenuItemProps {
  icon?: string | ReactNode;
  kbd?: ReactNode;
  keywords?: string;
  onSelect?: () => void;
  children?: ReactNode;
}
export function CommandMenuItem({ icon, kbd, onSelect, children }: CommandMenuItemProps) {
  const c = useCommandMenu();
  return (
    <button
      data-slot="command-menu-item"
      className="bui-hl"
      onClick={() => {
        vib([6]);
        c.onClose && c.onClose();
        onSelect && onSelect();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        border: 0,
        borderRadius: 8,
        background: 'none',
        padding: '8px 9px',
        cursor: 'pointer',
        fontFamily: BFONT,
        fontSize: 13,
        color: 'var(--wb-label)',
        textAlign: 'left',
      }}
    >
      {icon && (
        <span style={{ color: C.blue, display: 'grid' }}>
          <BIcon d={typeof icon === 'string' ? P[icon] : (icon as string)} size={14} />
        </span>
      )}
      <span style={{ flex: 1 }}>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}
CommandMenu.Input = CommandMenuInput;
CommandMenu.List = CommandMenuList;
CommandMenu.Group = CommandMenuGroup;
CommandMenu.Item = CommandMenuItem;
