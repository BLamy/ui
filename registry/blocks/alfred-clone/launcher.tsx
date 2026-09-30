/* The Alfred bar: an inline CommandMenu — a big input, the current page's results, a preview pane beside them
   on wide bars (clipboard, snippets, emoji, files), and a footer whose legend follows the page's keys. */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ContentSwap } from '@/components/ui/animated-height';
import { CommandEmpty, CommandFooter, CommandInput, CommandList, CommandMenu, useCommandActive, useCommandMenu, type CommandLegendItem, type CommandMenuApi } from '@/components/ui/command-menu';
import { IconSwap } from '@/components/ui/icon-swap';
import { TextMorph } from '@/components/ui/text-morph';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { SNIPPETS, nodeAt, pathOf } from './data';
import { ALL_EMOJI, APPS, appTile, renderPage } from './pages';
import { ClipGlyph, FileGlyph, Hat, fileKindLabel } from './parts';
import { useAlfred } from './state';

export interface LauncherProps {
  /** Pages to open on (below the root). */
  initialPages?: string[];
  initialQuery?: string;
  /** The bar's width, for the preview pane and the emoji grid. */
  width: number;
  /** The list's max height (the room the desktop leaves). */
  listHeight: number;
  autoFocus?: boolean;
  onClose: () => void;
  /** The menu's API, so the desktop can reset it. */
  menuRef?: React.Ref<CommandMenuApi | null>;
}

type PreviewKind = 'clip' | 'snippet' | 'emoji' | 'file';
const previewKind = (page: string): PreviewKind | null =>
  page === 'clipboard' ? 'clip' : page === 'snippets' ? 'snippet' : page === 'emoji' ? 'emoji' : page.startsWith('folder:') ? 'file' : null;

/** The app a page belongs to, for the tile at the input's end. */
function pageApp(page: string) {
  if (page.startsWith('folder:')) return APPS[4];
  if (page.startsWith('confirm:')) return APPS[5];
  if (page.startsWith('gh-') || page.startsWith('timer')) return APPS[7];
  return APPS.find((a) => a.page === page) ?? null;
}

export function Launcher({ initialPages, initialQuery = '', width, listHeight, autoFocus = true, onClose, menuRef }: LauncherProps) {
  const [query, setQuery] = useState(initialQuery);
  const { dark } = useAlfred();
  const wide = width >= 600;
  return (
    <CommandMenu
      variant="inline"
      aria-label="Alfred"
      query={query}
      onQueryChange={setQuery}
      defaultPages={initialPages}
      menuRef={menuRef}
      // The best match leads, whichever group it is in (an app, a file, a snippet, a calculation).
      ranking="global"
      onOpenChange={(open) => { if (!open) onClose(); }}
      className={cn(
        // A translucent card over the wallpaper: the surface var feeds the card and the sticky headings alike.
        'rounded-[20px] backdrop-blur-3xl backdrop-saturate-[1.8]',
        dark
          ? '[--command-surface:color-mix(in_oklab,var(--popover)_76%,transparent)] shadow-[0_30px_80px_-12px_rgba(0,0,0,.6),0_0_0_.5px_rgba(255,255,255,.16),inset_0_.5px_0_rgba(255,255,255,.12)]'
          : '[--command-surface:color-mix(in_oklab,var(--popover)_80%,transparent)] shadow-[0_30px_80px_-12px_rgba(20,20,60,.35),0_0_0_.5px_rgba(0,0,0,.1),inset_0_.5px_0_rgba(255,255,255,.8)]',
        // The input: Alfred's big, light type.
        '[&_[data-slot=command-input-wrapper]]:h-[68px] [&_[data-slot=command-input-wrapper]]:gap-3 [&_[data-slot=command-input-wrapper]]:px-5',
        '[&_[data-slot=command-page-title]]:h-7 [&_[data-slot=command-page-title]]:rounded-lg [&_[data-slot=command-page-title]]:bg-primary/14 [&_[data-slot=command-page-title]]:px-2.5 [&_[data-slot=command-page-title]]:text-[14px] [&_[data-slot=command-page-title]]:text-primary',
        // Rows: app-sized icons, a tinted selection.
        '[&_[data-slot=command-item-icon]]:size-8 [&_[data-slot=command-item][data-active]]:bg-primary/14 [&_[data-slot=command-item]]:rounded-[11px]',
        // Small caps headings. They scroll with their rows (stickyHeadings={false}): a sticky band would stack a
        // second translucent layer on the card.
        '[&_[data-slot=command-group-heading]]:text-[11.5px] [&_[data-slot=command-group-heading]]:font-semibold [&_[data-slot=command-group-heading]]:tracking-wide [&_[data-slot=command-group-heading]]:uppercase',
      )}
    >
      <CommandInput placeholder="Search apps, files and snippets — or type math" className="text-[24px] font-light tracking-[-0.01em]" autoFocus={autoFocus} trailing={<InputTile />} />
      <Body wide={wide} width={width} listHeight={listHeight} />
      <Footer wide={wide} />
    </CommandMenu>
  );
}

function InputTile() {
  const { page } = useCommandMenu();
  const app = pageApp(page);
  return (
    <span className="grid size-9 shrink-0 place-items-center">
      <IconSwap id={app?.page ?? 'alfred'}>
        {app ? appTile(app.tone, 'icon' in app ? app.icon : undefined, 32) : <span className="text-tertiary-foreground"><Hat size={30} /></span>}
      </IconSwap>
    </span>
  );
}

function Body({ wide, width, listHeight }: { wide: boolean; width: number; listHeight: number }) {
  const { page } = useCommandMenu();
  const kind = previewKind(page);
  const preview = wide && kind;
  // The emoji grid fills the list column: ~52px cells.
  const listWidth = preview ? width * 0.58 : width;
  const columns = Math.max(5, Math.min(10, Math.floor((listWidth - 24) / 52)));
  return (
    <div className="flex min-h-0 border-t border-border/70">
      <div className="min-w-0 flex-1" style={{ '--alfred-list-min': `${Math.min(300, listHeight)}px` } as CSSProperties}>
        <CommandList maxHeight={listHeight} stickyHeadings={false} className={preview ? 'min-h-(--alfred-list-min)' : undefined}>
          {(p) => (
            <>
              <CommandEmpty>
                <span className="flex flex-col items-center gap-2"><Hat size={34} className="text-tertiary-foreground" />No results — try the web search</span>
              </CommandEmpty>
              {renderPage(p, columns)}
            </>
          )}
        </CommandList>
      </div>
      {preview ? (
        <aside data-slot="alfred-preview" className="relative w-[42%] shrink-0 animate-bl-fade-in border-l border-border/70">
          <div className="absolute inset-0 overflow-hidden"><Preview kind={kind} /></div>
        </aside>
      ) : null}
    </div>
  );
}

/* ── Preview pane ── */

function Preview({ kind }: { kind: PreviewKind }) {
  const active = useCommandActive();
  return (
    <ContentSwap id={active ?? 'none'} className="h-full [&>*]:h-full">
      <div className="flex h-full flex-col p-4">
        {!active ? <Blank /> : kind === 'clip' ? <ClipPreview text={active} /> : kind === 'snippet' ? <SnippetPreview keyword={active} /> : kind === 'emoji' ? <EmojiPreview name={active} /> : <FilePreview name={active} />}
      </div>
    </ContentSwap>
  );
}

function Blank() {
  return <div className="m-auto text-[13px] text-tertiary-foreground">Nothing selected</div>;
}

function Meta({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="m-0 mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border/70 pt-3 text-[12.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="m-0 truncate text-right text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ClipPreview({ text }: { text: string }) {
  const { clips } = useAlfred();
  const c = clips.find((x) => x.text === text);
  if (!c) return <Blank />;
  const body = c.kind === 'color' ? (
    <div className="flex flex-1 flex-col gap-3">
      <div className="min-h-24 flex-1 rounded-[12px] shadow-[inset_0_0_0_.5px_rgba(0,0,0,.12)]" style={{ background: c.text }} />
      <div className="font-mono text-[15px] font-semibold">{c.text}</div>
    </div>
  ) : c.kind === 'image' && c.image ? (
    <div className="flex flex-1 items-center justify-center">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[10px] shadow-[0_6px_20px_rgba(0,0,0,.18)]" style={{ backgroundImage: `linear-gradient(135deg, ${c.image.from}, ${c.image.to})` }}>
        <div className="absolute inset-x-3 top-3 h-2 rounded-full bg-white/50" />
        <div className="absolute inset-x-3 top-7 bottom-3 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="rounded-md bg-white/30" />)}</div>
      </div>
    </div>
  ) : c.kind === 'link' ? (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center gap-2 text-[13px] font-semibold"><Icon name="globe" size={16} sw={1.8} className="text-muted-foreground" />{new URL(c.text).host}</div>
      <div className="text-[13.5px] leading-[20px] break-all text-link">{c.text}</div>
    </div>
  ) : (
    <pre className={cn('m-0 flex-1 overflow-hidden text-[13.5px] leading-[20px] whitespace-pre-wrap', c.kind === 'code' ? 'rounded-[10px] bg-code p-3 font-mono text-[12.5px] text-code-foreground' : 'font-[inherit]')}>{c.text}</pre>
  );
  return (
    <>
      {body}
      <Meta rows={[
        ['Source', <span key="s" className="inline-flex items-center gap-1.5"><ClipGlyph kind={c.kind} text={c.text} size={14} />{c.app}</span>],
        ['Copied', c.when],
        [c.kind === 'image' && c.image ? 'Size' : 'Characters', c.kind === 'image' && c.image ? `${c.image.w} × ${c.image.h}` : String(c.text.length)],
      ]} />
    </>
  );
}

function SnippetPreview({ keyword }: { keyword: string }) {
  const s = SNIPPETS.find((x) => x.keyword === keyword);
  if (!s) return <Blank />;
  return (
    <>
      <div className="text-[13px] font-semibold">{s.name}</div>
      <pre className="m-0 mt-2 flex-1 overflow-hidden rounded-[10px] bg-background/60 p-3 font-[inherit] text-[13.5px] leading-[20px] whitespace-pre-wrap shadow-[inset_0_0_0_.5px_var(--border)]">{s.text}</pre>
      <Meta rows={[['Keyword', <span key="k" className="font-mono text-primary">{s.keyword}</span>], ['Collection', s.collection], ['Expands', 'Anywhere, as you type']]} />
    </>
  );
}

function EmojiPreview({ name }: { name: string }) {
  const em = ALL_EMOJI.find((x) => x.name === name);
  if (!em) return <Blank />;
  const code = [...em.char].map((ch) => 'U+' + (ch.codePointAt(0) ?? 0).toString(16).toUpperCase()).filter((u) => u !== 'U+FE0F').join(' ');
  return (
    <>
      <div className="grid flex-1 place-items-center"><span className="text-[72px] leading-none">{em.char}</span></div>
      <div className="text-center text-[14px] font-semibold">{em.name}</div>
      <Meta rows={[['Keywords', em.keywords.join(', ') || '—'], ['Unicode', <span key="u" className="font-mono">{code}</span>]]} />
    </>
  );
}

function FilePreview({ name }: { name: string }) {
  const path = pathOf(name) ?? '~';
  const n = nodeAt(path);
  if (!n) return <Blank />;
  const where = path.split('/').slice(0, -1).join('/');
  return (
    <>
      <div className="grid flex-1 place-items-center"><FileGlyph kind={n.kind} size={72} /></div>
      <div className="truncate text-center text-[14px] font-semibold">{n.name}</div>
      <Meta rows={[
        ['Kind', fileKindLabel(n.kind)],
        [n.kind === 'folder' ? 'Contains' : 'Size', n.kind === 'folder' ? `${n.children?.length ?? 0} items` : (n.size ?? '—')],
        ['Modified', n.modified],
        ['Where', where],
      ]} />
    </>
  );
}

/* ── Footer ── */

const k = (keys: ReactNode[], label: string): CommandLegendItem => ({ keys, label });
const arrows = [<Icon key="u" name="arrow-up" size={12} sw={2.2} />, <Icon key="d" name="arrow-down" size={12} sw={2.2} />];

function legendFor(page: string, depth: number): CommandLegendItem[] {
  const back = depth > 0 ? [k(['⌫'], 'Back')] : [];
  if (page === 'root') return [k(arrows, 'Navigate'), k(['↵'], 'Open'), k(['⌘', '1–9'], 'Quick select'), k(['esc'], 'Hide')];
  if (page === 'calc') return [k(['↵'], 'Copy result'), k(['⇥'], 'Use result'), ...back];
  if (page === 'clipboard') return [k(['↵'], 'Paste'), k(['⌘', 'P'], 'Pin'), k(['⌘', '⌫'], 'Delete'), ...back];
  if (page === 'emoji') return [k([<Icon key="l" name="arrow-left" size={12} sw={2.2} />, <Icon key="r" name="arrow-right" size={12} sw={2.2} />, ...arrows], 'Move'), k(['↵'], 'Copy'), ...back];
  if (page === 'snippets') return [k(arrows, 'Navigate'), k(['↵'], 'Paste'), ...back];
  if (page.startsWith('folder:')) return [k(['↵'], 'Open'), k([<Icon key="r" name="arrow-right" size={12} sw={2.2} />], 'Into folder'), k(['⌘', '↵'], 'Reveal'), ...back];
  return [k(arrows, 'Navigate'), k(['↵'], 'Select'), ...back, k(['esc'], 'Hide')];
}

function Footer({ wide }: { wide: boolean }) {
  const { page, depth } = useCommandMenu();
  const legend = legendFor(page, depth);
  return (
    <CommandFooter legend={wide ? legend : legend.slice(0, 2)} className="[--command-surface:transparent] bg-transparent">
      <FooterStatus page={page} />
    </CommandFooter>
  );
}

function FooterStatus({ page }: { page: string }) {
  const active = useCommandActive();
  const { clips, history } = useAlfred();
  let text = 'Alfred';
  if (page === 'emoji') { const em = ALL_EMOJI.find((x) => x.name === active); text = em ? `${em.char} ${em.name}` : 'Emoji'; }
  else if (page === 'clipboard') text = `${clips.length} items`;
  else if (page === 'calc') text = `${history.length} in history`;
  else if (page === 'snippets') text = active ?? 'Snippets';
  else if (page.startsWith('folder:')) text = page.slice(7);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium">
      {page === 'root' ? <Hat size={16} /> : null}
      <TextMorph className="truncate">{text}</TextMorph>
    </span>
  );
}
