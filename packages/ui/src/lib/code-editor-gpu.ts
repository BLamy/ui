/* CodeEditor with the library's own highlighter: gpu-lexer, a small model on WebGPU that labels any language. It lives
   apart from lib/code-editor-model.ts so that the editor doesn't bring gpu-lexer along unless it's asked for.

   gpu-lexer answers one text at a time, and a round trip costs about 2 ms whatever the size. So what a frame asks for goes
   as one text: a screenful costs one round trip, not sixty. Without a hardware adapter, lexSyntax falls back to its small
   regular expression lexer, which is fine for a screenful. */
import type { CodeHighlight, CodeToken } from '@/lib/code-editor-model';
import { lexSyntax, tokenizeLines, type SyntaxEngine } from '@/lib/syntax';

export interface GpuCodeHighlightOptions {
  /** `auto` (default): the GPU on a hardware adapter, else the fallback. See `SyntaxEngine`. */
  engine?: SyntaxEngine;
}

/** A `highlight` for CodeEditor that lexes on the GPU. Text shows plain until the answer arrives, usually a frame later. */
export function createGpuCodeHighlight({ engine = 'auto' }: GpuCodeHighlightOptions = {}): CodeHighlight {
  let batch: { text: string; resolve: (tokens: readonly CodeToken[] | null) => void }[] | null = null;

  const flush = () => {
    const items = batch ?? [];
    batch = null;
    const code = `${items.map((item) => item.text).join('\n')}\n`;
    lexSyntax(code, engine).then(
      ({ spans }) => {
        const lines = tokenizeLines(code, spans);
        items.forEach((item, i) => item.resolve(lines[i] ?? null));
      },
      () => {
        for (const item of items) item.resolve(null);
      },
    );
  };

  return (text) =>
    new Promise((resolve) => {
      if (!batch) {
        batch = [];
        queueMicrotask(flush);
      }
      batch.push({ text, resolve });
    });
}
