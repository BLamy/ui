/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { aliases } from '../../tools/alias.mjs';

/* The Tailscale router's service worker must be served from the site's root (a worker only controls pages under its own
   path). An app copies it into public/; the docs serve the library's copy in place, so there is one source. */
function tailscaleServiceWorker(): Plugin {
  const file = new URL('../../packages/ui/src/lib/tailscale-router/tailscale-sw.js', import.meta.url);
  return {
    name: 'bl-docs-tailscale-sw',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || new URL(req.url, 'http://x').pathname !== `${server.config.base}tailscale-sw.js`) return next();
        res.setHeader('content-type', 'text/javascript; charset=utf-8');
        res.setHeader('cache-control', 'no-cache');
        res.end(readFileSync(file, 'utf8'));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'tailscale-sw.js', source: readFileSync(file, 'utf8') });
    },
  };
}

/* FFmpeg (lib/ffmpeg) runs on threads, so its page must be cross-origin isolated. Every document gets
   `Document-Isolation-Policy: isolate-and-credentialless`, which isolates it in Chrome without COOP (popups such as the
   Tailscale sign-in keep their opener) or COEP's demands on iframes. Browsers without it get COOP/COEP on the URLs that
   ask (`?isolate`, and the video editor's demos), and the FFmpeg files carry the matching COEP so their workers may
   start there. The worker script is the library's copy, served next to the wasm build in public/ffmpeg
   (`node tools/ffmpeg-wasm/build.mjs`). */
function ffmpegIsolation(): Plugin {
  const worker = new URL('../../packages/ui/src/lib/ffmpeg/ffmpeg-worker.js', import.meta.url);
  const isolate: Plugin['configureServer'] = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://x');
      const base = server.config.base;
      if (url.pathname.startsWith(`${base}ffmpeg/`)) {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        if (url.pathname === `${base}ffmpeg/ffmpeg-worker.js`) {
          res.setHeader('content-type', 'text/javascript; charset=utf-8');
          res.setHeader('cache-control', 'no-cache');
          res.end(readFileSync(worker, 'utf8'));
          return;
        }
      } else if (req.headers['sec-fetch-dest'] === 'document' || req.headers.accept?.includes('text/html')) {
        res.setHeader('Document-Isolation-Policy', 'isolate-and-credentialless');
        const demo = url.searchParams.get('demo') ?? '';
        if (url.searchParams.has('isolate') || /^(blocks\/video-editor|video-[\w-]+\/|ffmpeg\/)/.test(demo)) {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        }
      }
      next();
    });
  };
  return {
    name: 'bl-docs-ffmpeg',
    configureServer: isolate,
    configurePreviewServer: isolate as Plugin['configurePreviewServer'],
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'ffmpeg/ffmpeg-worker.js', source: readFileSync(worker, 'utf8') });
    },
  };
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  base: process.env.GITHUB_ACTIONS ? '/ui/' : '/',
  cacheDir: '../../node_modules/.vite/apps/docs',
  server: {
    port: 4206,
    host: 'localhost',
  },
  preview: {
    port: 4206,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss(), tailscaleServiceWorker(), ffmpegIsolation()],
  resolve: { conditions: ['@org/source'], alias: aliases },
  optimizeDeps: {
    // PGlite finds its WebAssembly with `new URL('./pglite.wasm', import.meta.url)`; pre-bundling would move the JS
    // away from the .wasm / .data files next to it. Serve it from where it is (see the PGlite page).
    exclude: ['@electric-sql/pglite', '@electric-sql/pglite-tools'],
    include: [
      '@tiptap/core',
      '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-list',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-table',
      '@tiptap/pm/changeset',
      '@tiptap/pm/commands',
      '@tiptap/pm/dropcursor',
      '@tiptap/pm/gapcursor',
      '@tiptap/pm/history',
      '@tiptap/pm/inputrules',
      '@tiptap/pm/keymap',
      '@tiptap/pm/model',
      '@tiptap/pm/schema-list',
      '@tiptap/pm/state',
      '@tiptap/pm/tables',
      '@tiptap/pm/transform',
      '@tiptap/pm/view',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/suggestion',
      'highlight.js/lib/core',
      'highlight.js/lib/languages/*',
      'lowlight',
      'lowlight > highlight.js',
      // docstream pulls CommonJS deps (style-to-js, debug) the browser can't import unbundled; pre-bundle it whole.
      '@brett_lamy/ui > @brett_lamy/docstream',
      '@brett_lamy/ui > @brett_lamy/docstream-editor',
      // ReplayPreview's player (rrweb loads from it lazily).
      '@brett_lamy/ui > @brett_lamy/docstream/replay',
      // The live example card (ReactDemo with an in-page preview).
      '@brett_lamy/docstream/playground',
    ],
  },
  // PGlite's worker (examples/pglite/worker) imports the engine, which code-splits: workers must build as ES modules.
  worker: { format: 'es' },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
