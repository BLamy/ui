import * as React from 'react';
import { useState, useRef } from 'react';
import { GitbookEditor, type GitbookEditorProps } from '@brett_lamy/docstream-editor/editor';
import { astToTiptap } from '@brett_lamy/docstream-editor/convert';
import { parseMarkdown } from '@brett_lamy/docstream/gitbook';
import '@brett_lamy/docstream-editor/styles.css';
import { Button, ToggleButton } from './press';
import { cva } from 'class-variance-authority';
import { cn } from './util';
import { vib, tick } from './haptics';
import { WIcon, type WIconName } from './icons';

/* ══ Composer ══ */
const MODELS = ['Claude Opus 4.7', 'Claude Sonnet 4.9', 'Claude Haiku 4.5'];
const EFFORTS = ['Extra High', 'High', 'Medium'];
const ACCESS = ['Full access', 'Read only', 'Ask first'];

export interface PillProps {
  icon?: WIconName;
  label: string;
  onPress?: () => void;
  tint?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
/** Composer option pill (model / effort / access); `tint` colors it with the accent. */
export const pillVariants = cva(
  'wb-btn wb-hl flex cursor-pointer items-center gap-[5px] rounded-[7px] border-0 bg-transparent px-[7px] py-[5px] text-[12.5px] font-semibold',
  {
    variants: { tint: { true: 'text-wb-tint', false: 'text-wb-label2' } },
    defaultVariants: { tint: false },
  },
);

export function Pill({ icon, label, onPress, tint, className, style }: PillProps) {
  return (
    <Button
      data-slot="composer-pill"
      className={cn(pillVariants({ tint: !!tint }), className)}
      onPress={onPress}
      title={label}
      style={style}
    >
      {icon ? <WIcon name={icon} size={13.5} sw={2} /> : null}
      <span className="whitespace-nowrap">{label}</span>
      <WIcon name="chevD" size={11} sw={2.4} className="opacity-60" />
    </Button>
  );
}

interface Att {
  id: string;
  src: string;
}

type ComposerEditor = NonNullable<Parameters<NonNullable<GitbookEditorProps['onEditorReady']>>[0]>;

function caretOnPlainLine(editor: ComposerEditor): boolean {
  const { $from, empty } = editor.state.selection;
  return empty && $from.depth === 1 && $from.parent.type.name === 'paragraph';
}

const MARKDOWN_HINTS = [
  /^\s{0,3}#{1,6}\s/m,
  /^\s*(?:[-*+]|\d+[.)])\s/m,
  /^\s*>\s/m,
  /```/,
  /\{%\s*[a-z-]+/,
  /\*\*[^*\n]+\*\*|__[^_\n]+__/,
  /`[^`\n]+`/,
  /\[[^\]\n]+\]\([^)\s]+\)/,
  /^\s*\|.+\|\s*$/m,
  /^\s*(?:---|\*\*\*)\s*$/m,
];

function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_HINTS.some((pattern) => pattern.test(text));
}

/* AnnotateLightbox — click a pasted image: an annotation canvas overlays it; Save rasterizes image + strokes
   into one flattened PNG. Pass a drawing surface (e.g. PencilCanvas from @brett_lamy/pencilkit) as `canvas`. */
export interface AnnotateLightboxProps {
  src: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
  canvas?: React.ReactNode;
}
export function AnnotateLightbox({ src, onClose, onSave, canvas }: AnnotateLightboxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const save = () => {
    const img = imgRef.current,
      box = boxRef.current;
    if (!img || !box) return onClose();
    const w = img.clientWidth,
      h = img.clientHeight,
      sc = 2;
    const cv = document.createElement('canvas');
    cv.width = w * sc;
    cv.height = h * sc;
    const ctx = cv.getContext('2d');
    if (!ctx) return onClose();
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const fin = () => {
      vib([12]);
      onSave(cv.toDataURL('image/png'));
    };
    const svg = box.querySelector('svg');
    if (!svg) return fin();
    const cl = svg.cloneNode(true) as SVGElement;
    cl.setAttribute('width', String(w));
    cl.setAttribute('height', String(h));
    cl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    cl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const im = new Image();
    im.onload = () => {
      ctx.drawImage(im, 0, 0, cv.width, cv.height);
      fin();
    };
    im.onerror = fin;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  };
  const btn = (label: string, primary: boolean, onPress: () => void) => (
    <Button
      onPress={onPress}
      className={cn(
        'cursor-pointer rounded-[9px] px-3.5 py-[7px] font-ios text-[12.5px] font-[650] text-white',
        primary ? 'border-0 bg-[var(--wb-tint,#0A84FF)]' : 'border border-[rgba(255,255,255,.2)] bg-transparent',
      )}
    >
      {label}
    </Button>
  );
  return (
    // backdrop: a click outside the card closes (a scrim, not a control)
    <div data-slot="annotate-lightbox" onClick={onClose} className="fixed inset-0 z-400 grid place-items-center bg-[rgba(0,0,0,.74)]">
      <div role="dialog" aria-label="Annotate image" onClick={(e) => e.stopPropagation()} className="flex max-w-[90vw] flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="flex-1 font-ios text-[13px] font-[650] text-[#EDEDF2]">Annotate — PencilKit strokes flatten into the image on save</span>
          {btn('Cancel', false, onClose)}
          {btn('Save annotation', true, save)}
        </div>
        <div
          ref={boxRef}
          className="relative overflow-hidden rounded-[14px] border border-[rgba(255,255,255,.14)] bg-[#0C0C10] [--bl-card:#1C1C23] [--bl-fill2:rgba(255,255,255,.14)] [--bl-fill:rgba(255,255,255,.07)] [--bl-label2:rgba(235,235,245,.6)] [--bl-label3:rgba(235,235,245,.35)] [--bl-label:#EDEDF2] [--bl-sep:rgba(255,255,255,.12)] [--bl-tint:var(--wb-tint,#0A84FF)]"
        >
          <img ref={imgRef} src={src} alt="" className="block max-h-[68vh] min-h-[240px] max-w-[86vw] min-w-[340px] object-contain" />
          {canvas ?? (
            <div className="absolute inset-0 grid place-items-center font-ios text-[12.5px] text-[#9C9CA6]">loading PencilKit…</div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ComposerProps {
  onSend: (text: string, imgs?: string[]) => void;
  streaming?: boolean;
  onStop?: () => void;
  autoFocus?: boolean;
  wide?: boolean;
  /** optional replacement for the fallback model Pill */
  modelPicker?: React.ReactNode;
  /** optional drawing surface passed through to the AnnotateLightbox */
  annotateCanvas?: React.ReactNode;
  /** Initial GitBook-flavored Markdown shown in the Docstream editor. */
  defaultValue?: string;
  /** Called with serialized Markdown whenever the rich editor changes. */
  onChange?: (markdown: string) => void;
  /** Controls the tall drafting mode. Omit to let Composer manage it internally. */
  expanded?: boolean;
  /** Initial tall drafting mode when `expanded` is uncontrolled. */
  defaultExpanded?: boolean;
  /** Called when the expand or restore control is pressed. */
  onExpandedChange?: (expanded: boolean) => void;
  /** Shows the model, effort, and access selectors. */
  showOptions?: boolean;
  /** Shows the checkout and branch context row. */
  showCheckout?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function Composer({
  onSend,
  streaming,
  onStop,
  autoFocus,
  wide,
  modelPicker,
  annotateCanvas,
  defaultValue,
  onChange,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  showOptions = true,
  showCheckout = true,
  placeholder = 'Ask anything — @ files, / commands, paste images',
  className,
  style,
}: ComposerProps) {
  const [v, setV] = useState(() => defaultValue ?? '');
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;
  const setExpanded = (next: boolean) => {
    if (expanded === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  };
  const [mi, setMi] = useState(0),
    [ei, setEi] = useState(0),
    [ai, setAi] = useState(0);
  const [atts, setAtts] = useState<Att[]>([]);
  const [anno, setAnno] = useState<string | null>(null);
  const editorRef = useRef<ComposerEditor | null>(null);
  const markdownRef = useRef(v);
  markdownRef.current = v;
  const can = !!(v.trim() || atts.length);
  const send = () => {
    if (!can || streaming) return;
    vib([8]);
    const t = markdownRef.current.trim(),
      imgs = atts.map((a) => a.src);
    setAtts([]);
    if (editorRef.current) editorRef.current.commands.clearContent(true);
    else setV('');
    onSend(t, imgs);
  };
  const sendRef = useRef(send);
  sendRef.current = send;
  const handleKeyDown = (event: KeyboardEvent) => {
    const editor = editorRef.current;
    if (!editor || event.key !== 'Enter') return false;
    if (event.metaKey || event.ctrlKey) {
      sendRef.current();
      return true;
    }
    if (event.shiftKey) return editor.commands.insertContent({ type: 'hardBreak' });
    if (document.querySelector('.slash-menu') || !caretOnPlainLine(editor)) return false;
    sendRef.current();
    return true;
  };
  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    let gotImage = false;
    for (const item of Array.from(items ?? [])) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      gotImage = true;
      const reader = new FileReader();
      reader.onload = () => {
        vib([8]);
        setAtts((attachments) => [
          ...attachments,
          { id: 'att' + Date.now() + Math.random(), src: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    }
    if (gotImage) return true;

    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!looksLikeMarkdown(text) || !editorRef.current) return false;
    const doc = astToTiptap(parseMarkdown(text));
    if (!doc.content?.length) return false;
    editorRef.current.commands.insertContent(doc.content);
    return true;
  };
  const annoAtt = anno ? atts.find((a) => a.id === anno) : null;
  return (
    <div data-slot="composer" className={cn('box-border w-full', className)} style={style}>
      <div className="relative rounded-[15px] border border-wb-sep bg-wb-card shadow-[0_6px_24px_var(--wb-shadow,rgba(0,0,0,.28))]">
        <ToggleButton
          data-slot="composer-expand"
          className="wb-btn wb-hl absolute top-[7px] right-2 z-2 grid size-7 cursor-pointer place-items-center rounded-[7px] border-0 bg-wb-card p-0 text-wb-label2"
          aria-label={isExpanded ? 'Collapse composer' : 'Expand composer'}
          isSelected={isExpanded}
          onPress={() => {
            tick();
            setExpanded(!isExpanded);
          }}
          title={isExpanded ? 'Collapse composer' : 'Expand composer'}
        >
          <WIcon name={isExpanded ? 'restore' : 'expand'} size={14} sw={2} />
        </ToggleButton>
        {atts.length ? (
          <div className="flex flex-wrap gap-2 px-3 pt-2.5">
            {atts.map((a) => (
              <div key={a.id} className="relative">
                <Button
                  onPress={() => {
                    tick();
                    setAnno(a.id);
                  }}
                  title="Annotate with PencilKit"
                  className="block cursor-pointer overflow-hidden rounded-[10px] border border-wb-sep bg-wb-term p-0"
                >
                  <img src={a.src} alt="pasted attachment" className="block h-[58px] max-w-[130px] object-cover" />
                </Button>
                <span className="pointer-events-none absolute bottom-1 left-1 grid size-[18px] place-items-center rounded-md bg-[rgba(0,0,0,.55)] text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4l6 6-10 10H4v-6z" />
                  </svg>
                </span>
                <Button
                  onPress={() => {
                    tick();
                    setAtts((x) => x.filter((y) => y.id !== a.id));
                  }}
                  aria-label="Remove attachment"
                  className="absolute -top-1.5 -right-1.5 grid size-[18px] cursor-pointer place-items-center rounded-[50%] border border-wb-sep bg-wb-card2 p-0 text-[10px] leading-none text-wb-label2"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        <GitbookEditor
          markdown={v}
          onChange={(markdown) => {
            setV(markdown);
            onChange?.(markdown);
          }}
          toolbar={false}
          slashMenu
          placeholder={placeholder}
          autofocus={autoFocus}
          className={cn('wb-composer-doc', wide && 'wb-composer-doc-wide', isExpanded && 'wb-composer-doc-expanded')}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onEditorReady={(editor) => {
            editorRef.current = editor;
          }}
        />
        <div className="flex flex-wrap items-center gap-[5px] px-2 pt-1 pb-2">
          {showOptions ? (
            <>
              {modelPicker ?? (
                <Pill
                  icon="spark"
                  label={MODELS[mi]}
                  tint
                  onPress={() => {
                    setMi((i) => (i + 1) % MODELS.length);
                    tick();
                  }}
                />
              )}
              <Pill
                label={EFFORTS[ei]}
                onPress={() => {
                  setEi((i) => (i + 1) % EFFORTS.length);
                  tick();
                }}
              />
              <Pill
                icon="lock"
                label={ACCESS[ai]}
                onPress={() => {
                  setAi((i) => (i + 1) % ACCESS.length);
                  tick();
                }}
              />
            </>
          ) : null}
          <span className="flex-1" />
          {streaming ? (
            <Button
              data-slot="composer-stop"
              className="wb-btn relative grid size-[30px] cursor-pointer place-items-center border-0 bg-transparent text-wb-label"
              onPress={onStop}
              aria-label="Stop"
            >
              <svg width="30" height="30" viewBox="0 0 30 30" className="absolute inset-0 animate-[wbSpin_1s_linear_infinite]">
                <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--wb-fill2)" strokeWidth="2.5" />
                <circle cx="15" cy="15" r="12.5" fill="none" stroke="var(--wb-tint)" strokeWidth="2.5" strokeDasharray="24 55" strokeLinecap="round" />
              </svg>
              <WIcon name="stop" size={12} sw={2.4} />
            </Button>
          ) : (
            <Button
              data-slot="composer-send"
              className="wb-btn grid size-[30px] cursor-pointer place-items-center rounded-[50%] border-0 bg-wb-tint text-white transition-opacity duration-150 ease-[ease] data-disabled:cursor-default data-disabled:opacity-35"
              onPress={send}
              aria-label="Send"
              isDisabled={!can}
            >
              <WIcon name="up" size={16} sw={2.4} />
            </Button>
          )}
        </div>
      </div>
      {showCheckout ? (
        <div className="mx-2 mt-1.5 flex items-center gap-[7px] rounded-[9px] bg-wb-fill px-[11px] py-1.5 text-[12px] text-wb-label2">
          <WIcon name="folder" size={13.5} sw={1.9} />
          <span className="flex-1">Local checkout</span>
          <WIcon name="branch" size={13.5} sw={1.9} />
          <span className="font-mono text-[11.5px]">main</span>
          <WIcon name="chevD" size={11} sw={2.4} className="opacity-60" />
        </div>
      ) : null}
      {annoAtt ? (
        <AnnotateLightbox
          src={annoAtt.src}
          canvas={annotateCanvas}
          onClose={() => setAnno(null)}
          onSave={(d) => {
            setAtts((x) => x.map((y) => (y.id === anno ? { ...y, src: d } : y)));
            setAnno(null);
          }}
        />
      ) : null}
    </div>
  );
}
