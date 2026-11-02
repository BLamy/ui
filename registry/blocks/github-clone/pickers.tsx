/* GitHub's select menu: a button opening a searchable list. Multi-select applies when it closes (one write, one timeline
   event, however many boxes were ticked, as on GitHub); single-select applies at once. Arrow keys move through the list
   while typing filters it. <Menu> is the plain compact dropdown the block uses everywhere else. */
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Autocomplete, Button as AriaButton, Dialog, DialogTrigger, Input, ListBox, ListBoxItem, Menu as AriaMenu, MenuItem as AriaMenuItem, MenuSection, MenuTrigger, Header, Separator, TextField, useFilter, type Key,
} from 'react-aria-components';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Oct, ghButton } from './parts';

export interface PickItem {
  id: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  /** Text to match besides the label. */
  keywords?: string;
}

export interface SelectMenuProps {
  /** The menu's title and accessible name. */
  title: string;
  /** The button that opens it. */
  trigger: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  items: PickItem[];
  selected: string[];
  multiple?: boolean;
  /** Fires on close (multiple) or on selection (single), and only when something changed. */
  onApply: (ids: string[]) => void;
  /** Says what a search for nothing shows. */
  empty?: string;
  filterPlaceholder?: string;
  /** What's at the bottom of the list (e.g. "Create label"), given the current query. */
  footer?: (q: string, close: () => void) => ReactNode;
  /** The list hasn't loaded yet. */
  loading?: boolean;
  isDisabled?: boolean;
  /** A "clear" row at the top of a single-select. */
  clearLabel?: string;
}

export function SelectMenu({ title, trigger, triggerLabel, triggerClassName, items, selected, multiple, onApply, empty = 'Nothing found', filterPlaceholder = 'Filter', footer, loading, isDisabled, clearLabel }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<string[]>(selected);
  const { contains } = useFilter({ sensitivity: 'base' });
  const shown = useMemo(() => {
    // What's selected first, as on GitHub, in the order they came.
    const rest = items.filter((i) => !selected.includes(i.id));
    return [...items.filter((i) => selected.includes(i.id)), ...rest];
  }, [items, selected]);
  const change = (next: boolean) => {
    if (next) { setDraft(selected); setQ(''); }
    else if (multiple) {
      const same = draft.length === selected.length && draft.every((d) => selected.includes(d));
      if (!same) onApply(draft);
    }
    setOpen(next);
  };
  return (
    <DialogTrigger isOpen={open} onOpenChange={change}>
      <AriaButton aria-label={triggerLabel} isDisabled={isDisabled} className={triggerClassName ?? ghButton()}>{trigger}</AriaButton>
      <Popover placement="bottom end" className="w-[min(320px,calc(100vw-24px))]">
        <Dialog aria-label={title} className="flex max-h-[min(440px,70vh)] flex-col outline-none">
          {/* Autocomplete keeps Escape for itself; here it means "done", which is what applies a multi-select. */}
          <div className="contents" onKeyDownCapture={(e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); change(false); } }}>
          <header className="border-b border-border px-3 py-2 text-caption font-semibold">{title}</header>
          <Autocomplete filter={(text, input) => contains(text, input)} inputValue={q} onInputChange={setQ}>
            <TextField aria-label={`${title}: filter`} className="border-b border-border p-2" autoFocus>
              <Input placeholder={filterPlaceholder} autoComplete="off" spellCheck={false}
                className="box-border h-8 w-full rounded-md border border-border bg-background px-2 font-sans text-detail text-foreground outline-none select-text data-focused:border-primary data-focused:ring-1 data-focused:ring-primary group-data-[phone=true]/gh:h-11" />
            </TextField>
            {/* Multi-select is a real selection. Single-select is a list of actions: given both, react-aria runs the action and never selects. */}
            <ListBox aria-label={title} selectionMode={multiple ? 'multiple' : undefined} selectedKeys={multiple ? draft : undefined} className="bl-scroll min-h-0 flex-1 overflow-y-auto outline-none"
              renderEmptyState={() => <div className="px-3 py-6 text-center text-caption text-muted-foreground">{loading ? 'Loading…' : empty}</div>}
              onSelectionChange={multiple ? (keys) => setDraft(keys === 'all' ? items.map((i) => i.id) : ([...keys] as string[])) : undefined}
              onAction={multiple ? undefined : (key: Key) => {
                const id = String(key);
                if (id === '__clear') { if (selected.length) onApply([]); }
                else if (!selected.includes(id)) onApply([id]);
                setOpen(false);
              }}>
              {clearLabel && !q && !multiple ? <Row item={{ id: '__clear', label: clearLabel }} /> : null}
              {shown.map((i) => <Row key={i.id} item={i} current={!multiple && selected.includes(i.id)} />)}
            </ListBox>
          </Autocomplete>
          {footer ? <footer className="border-t border-border">{footer(q, () => change(false))}</footer> : null}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function Row({ item, current }: { item: PickItem; current?: boolean }) {
  return (
    <ListBoxItem id={item.id} textValue={`${item.label} ${item.keywords ?? ''}`}
      aria-current={current ? 'true' : undefined}
      className="group/row flex min-h-9 cursor-pointer items-center gap-2 border-t border-border px-3 py-1.5 text-detail text-foreground outline-none first:border-t-0 data-focused:bg-accent group-data-[phone=true]/gh:min-h-11">
      {({ isSelected }) => (
        <>
          <span className="grid w-4 shrink-0 place-items-center">{isSelected || current ? <Oct name="check" size={14} /> : null}</span>
          {item.leading}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{item.label}</span>
            {item.description ? <span className="block truncate text-caption text-muted-foreground">{item.description}</span> : null}
          </span>
        </>
      )}
    </ListBoxItem>
  );
}

export type MenuEntry =
  | { id: string; label: ReactNode; text?: string; icon?: ReactNode; danger?: boolean; disabled?: boolean; onAction: () => void; hint?: ReactNode; selected?: boolean; href?: string }
  | { separator: true; id: string }
  | { heading: string; id: string };

/** A compact dropdown. `trigger` is the button's content. */
export function Menu({ label, trigger, triggerClassName, entries, placement = 'bottom end', isDisabled }: {
  label: string; trigger: ReactNode; triggerClassName?: string; entries: (MenuEntry | false | null | undefined)[]; placement?: 'bottom start' | 'bottom end' | 'top end' | 'top start'; isDisabled?: boolean;
}) {
  const list = entries.filter(Boolean) as MenuEntry[];
  return (
    <MenuTrigger>
      <AriaButton aria-label={label} isDisabled={isDisabled} className={triggerClassName ?? ghButton()}>{trigger}</AriaButton>
      <Popover placement={placement} className="min-w-[200px] max-w-[min(340px,calc(100vw-24px))]">
        <AriaMenu aria-label={label} className="bl-scroll max-h-[60vh] overflow-y-auto py-1 outline-none">
          <MenuSection>
            {list.map((e) => {
              if ('separator' in e) return <Separator key={e.id} className="my-1 h-px border-0 bg-border" />;
              if ('heading' in e) return <Header key={e.id} className="px-3 py-1.5 text-caption font-semibold text-muted-foreground">{e.heading}</Header>;
              return (
                <AriaMenuItem key={e.id} id={e.id} textValue={e.text ?? (typeof e.label === 'string' ? e.label : e.id)} isDisabled={e.disabled} onAction={e.onAction}
                  href={e.href} target={e.href ? '_blank' : undefined} rel={e.href ? 'noreferrer' : undefined}
                  className={cn('flex min-h-8 cursor-pointer items-center gap-2 px-3 py-1.5 text-detail no-underline outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focused:bg-accent group-data-[phone=true]/gh:min-h-11',
                    e.danger ? 'text-(--gh-closed)' : 'text-foreground')}>
                  {e.selected !== undefined ? <span className="grid w-4 shrink-0 place-items-center">{e.selected ? <Oct name="check" size={14} /> : null}</span> : null}
                  {e.icon ? <span className="grid w-4 shrink-0 place-items-center text-muted-foreground">{e.icon}</span> : null}
                  <span className="min-w-0 flex-1">{e.label}{e.hint ? <span className="mt-0.5 block text-caption text-muted-foreground">{e.hint}</span> : null}</span>
                </AriaMenuItem>
              );
            })}
          </MenuSection>
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}
