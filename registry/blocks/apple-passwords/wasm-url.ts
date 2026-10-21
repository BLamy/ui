/* Where Tailscale's WebAssembly client is served: `main.wasm`, about 26 MB, fetched only when someone presses
   "Sign in with Tailscale". This is Vite's `?url` import, which docs, Storybook and most apps use. With another bundler,
   replace the line below with whatever gives you main.wasm's URL (a file in `public/`, or `new URL('…', import.meta.url)`). */
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url';

export default wasmURL;
